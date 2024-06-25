import { readdir } from "node:fs/promises";
import { dump, load } from "@hyrious/marshal";
import { deflate } from "pako";

import "./shuffle";
import { readGameTitle } from "./read";
import { getValueBySymbolDesc, setValueBySymbolDesc } from "./symbol-utils";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const encode = (string: string): Uint8Array => encoder.encode(string);
const decode = (buffer: Uint8Array): string => decoder.decode(buffer);

let parsingMethod: string;
const parsingRegExps = {} as { [key: string]: RegExp };

export async function setWriteParsingMethod(systemFilePath: string) {
    const gameTitle = await readGameTitle(systemFilePath);
    const lowercased = gameTitle!.toLowerCase();

    if (lowercased.includes("lisa")) {
        parsingMethod = "lisa";
        parsingRegExps.lisaMaps = /^\\et\[[0-9]+\]/;
        parsingRegExps.lisaTroops = /^\\nbt/;
        parsingRegExps.lisaOtheVariable = /^<.*>\.?$/;
    }
}

function getVariable(variable: string | Uint8Array): void | string | Uint8Array {
    let type = "string";

    if (variable instanceof Uint8Array) {
        type = "Uint8Array";
        variable = decode(variable);
    }

    if (typeof variable === "string" && variable.length > 0) {
        if (translationMap!.has(variable)) {
            const gotten = translationMap!.get(variable);

            if (gotten) {
                return type === "string" ? gotten : encode(gotten);
            }
        }
    }
}

let translationMap: null | Map<string, string>;

function getCode(code: number, parameter: string | string[] | Uint8Array): undefined | string | string[] | Uint8Array {
    switch (code) {
        case 401 || 402 || 356 || 405:
            {
                let type = "string";

                if (parameter instanceof Uint8Array) {
                    type = "Uint8Array";
                    parameter = decode(parameter);
                }

                if (typeof parameter === "string" && parameter.length > 0) {
                    switch (parsingMethod) {
                        case "lisa":
                            const match =
                                parameter.match(parsingRegExps.lisaMaps) ?? parameter.match(parsingRegExps.lisaTroops);

                            if (match) {
                                parameter = parameter.slice(match[0].length);
                            }
                            break;
                    }

                    if (translationMap!.has(parameter)) {
                        const gotten = translationMap!.get(parameter);

                        if (gotten) {
                            return type === "string" ? gotten : encode(gotten);
                        }
                    }
                }
            }
            break;
        case 102:
            {
                let type = "string";

                if (parameter instanceof Uint8Array) {
                    type = "Uint8Array";
                    parameter = decode(parameter);
                }

                if (typeof parameter === "string" && parameter.length > 0) {
                    if (translationMap!.has(parameter)) {
                        const gotten = translationMap!.get(parameter);

                        if (gotten) {
                            return type === "string" ? gotten : encode(gotten);
                        }
                    }
                }
            }
            break;
    }
}

/**
 * Merges sequences of objects with codes 401 and 405 inside list objects.
 * Merging is perfectly valid, and it's much faster and easier than replacing text in each object in a loop.
 * @param {RubyObject[]} objArr - list object, which objects with codes 401 and 405 should be merged
 * @returns {RubyObject[]}
 */
function mergeSeq(objArr: RubyObject[]): RubyObject[] {
    let first: null | number = null;
    let number: number = -1;
    let prev: boolean = false;
    const stringArray: string[] = [];

    for (let i = 0; i < objArr.length; i++) {
        const obj = objArr[i];
        const code: number = getValueBySymbolDesc(obj, "@code");

        if (code === 401 || code === 405) {
            if (first === null) {
                first = i;
            }

            number += 1;
            stringArray.push(getValueBySymbolDesc(obj, "@parameters")[0]);
            prev = true;
        } else if (i > 0 && prev && first !== null && number !== -1) {
            const parameters = getValueBySymbolDesc(objArr[first], "@parameters");
            parameters[0] = stringArray.join("\n");
            setValueBySymbolDesc(objArr[first], "@parameters", parameters);

            const startIndex = first + 1;
            const itemsToDelete = startIndex + number;
            objArr.splice(startIndex, itemsToDelete);

            stringArray.length = 0;
            i -= number;
            number = -1;
            first = null;
            prev = false;
        }
    }

    return objArr;
}

/**
 * Merges lists's objects with codes 401 and 405 in Map files
 * @param {RubyObject} obj - object, which lists's objects with codes 401 and 405 should be merged
 * @returns {RubyObject}
 */
function mergeMap(obj: RubyObject): RubyObject {
    const events: RubyObject = getValueBySymbolDesc(obj, "@events");

    for (const event of Object.values(events || {})) {
        const pages: RubyObject[] = getValueBySymbolDesc(event as RubyObject, "@pages");
        if (!pages) {
            continue;
        }

        for (const page of pages) {
            const list: RubyObject[] = getValueBySymbolDesc(page, "@list");
            setValueBySymbolDesc(page, "@list", mergeSeq(list));
        }
    }

    return obj;
}

/**
 * Merges lists's objects with codes 401 and 405 in Other files
 * @param {RubyObject} objArr - array of objects, which lists's objects with codes 401 and 405 should be merged
 * @returns {RubyObject}
 */
function mergeOther(objArr: RubyObject[]): RubyObject[] {
    for (const obj of objArr) {
        if (!obj) {
            continue;
        }

        const pages: RubyObject[] = getValueBySymbolDesc(obj, "@pages");

        if (Array.isArray(pages)) {
            for (const page of pages) {
                const list: RubyObject[] = getValueBySymbolDesc(page, "@list");
                setValueBySymbolDesc(page, "@list", mergeSeq(list));
            }
        } else {
            const list: RubyObject[] = getValueBySymbolDesc(obj, "@list");

            if (Array.isArray(list)) {
                setValueBySymbolDesc(obj, "@list", mergeSeq(list));
            }
        }
    }

    return objArr;
}

/**
 * Writes .txt files from maps folder back to their initial form
 * @param {string} mapsPath - path to the maps directory
 * @param {string} originalPath - path to the original directory
 * @param {string} outputPath - path to the output directory
 * @param {number} drunk - drunkness level
 * @param {boolean} logging - whether to log or not
 * @param {string} logString - string to log
 * @returns {Promise<void>}
 */
export async function writeMap(
    mapsPath: string,
    originalPath: string,
    outputPath: string,
    drunk: number,
    logging: boolean,
    logString: string
): Promise<void> {
    const re = /^Map[0-9].*(rxdata|rvdata|rvdata2)$/;
    const filtered = (await readdir(originalPath)).filter((filename) => re.test(filename));

    const filesData = await Promise.all(
        filtered.map((filename) => Bun.file(`${originalPath}/${filename}`).arrayBuffer())
    );

    const objMap = new Map(filtered.map((filename, i) => [filename, mergeMap(load(filesData[i]) as RubyObject)]));

    const mapsOriginalText = (await Bun.file(`${mapsPath}/maps.txt`).text())
        .split("\n")
        .map((line) => line.replaceAll("\\#", "\n").trim());

    const namesOriginalText = (await Bun.file(`${mapsPath}/names.txt`).text())
        .split("\n")
        .map((line) => line.replaceAll("\\#", "\n").trim());

    let mapsTranslatedText = (await Bun.file(`${mapsPath}/maps_trans.txt`).text())
        .split("\n")
        .map((line) => line.replaceAll("\\#", "\n").trim());

    let namesTranslatedText = (await Bun.file(`${mapsPath}/names_trans.txt`).text())
        .split("\n")
        .map((line) => line.replaceAll("\\#", "\n").trim());

    if (drunk > 0) {
        mapsTranslatedText = mapsTranslatedText.shuffle();
        namesTranslatedText = namesTranslatedText.shuffle();

        if (drunk === 2) {
            mapsTranslatedText = mapsTranslatedText.map((string) => {
                return shuffleWords(string)!;
            });
        }
    }

    translationMap = new Map(mapsOriginalText.map((string, i) => [string, mapsTranslatedText[i]]));
    const namesTranslationMap = new Map(namesOriginalText.map((string, i) => [string, namesTranslatedText[i]]));

    //401 - dialogue lines
    //102, 402 - dialogue choices
    //356 - system lines (special texts)
    const allowedCodes: Uint16Array = new Uint16Array([401, 402, 356, 102]);

    for (const [filename, obj] of objMap) {
        const displayName: string | Uint8Array = getValueBySymbolDesc(obj, "@display_name");

        if (typeof displayName === "string" && namesTranslationMap.has(displayName)) {
            setValueBySymbolDesc(obj, "@display_name", namesTranslationMap.get(displayName)!);
        } else if (displayName instanceof Uint8Array) {
            const decoded = decode(displayName);

            if (namesTranslationMap.has(decoded)) {
                setValueBySymbolDesc(obj, "@display_name", namesTranslationMap.get(decoded)!);
            }
        }

        const events: object = getValueBySymbolDesc(obj, "@events");

        for (const event of Object.values(events || {})) {
            const pages: RubyObject[] = getValueBySymbolDesc(event, "@pages");
            if (!pages) {
                continue;
            }

            for (const page of pages) {
                const list: RubyObject[] = getValueBySymbolDesc(page, "@list");

                for (const item of list || []) {
                    const code: number = getValueBySymbolDesc(item, "@code");

                    if (!allowedCodes.includes(code)) {
                        continue;
                    }

                    const parameters: (string | Uint8Array)[] = getValueBySymbolDesc(item, "@parameters");

                    for (const [i, parameter] of parameters.entries()) {
                        if ([401, 402, 356].includes(code)) {
                            const gotten = getCode(code, parameter);

                            if (gotten) {
                                parameters[i] = gotten as string | Uint8Array;
                                setValueBySymbolDesc(item, "@parameters", parameters);
                            }
                        } else if (code === 102) {
                            if (Array.isArray(parameter)) {
                                for (const [j, param] of parameter.entries()) {
                                    const gotten = getCode(code, param) as string | Uint8Array;

                                    if (gotten) {
                                        (parameters[i][j] as string | Uint8Array) = gotten;
                                    }
                                }

                                setValueBySymbolDesc(item, "@parameters", parameters);
                            }
                        }
                    }
                }
            }

            if (logging) {
                console.log(`${logString} ${filename}`);
            }
        }

        await Bun.write(`${outputPath}/${filename}`, dump(obj));
    }
}

/**
 * Writes .txt files from other folder back to their initial form.
 * @param {string} otherPath - path to the other folder
 * @param {string} originalPath - path to the original folder
 * @param {string} outputPath - path to the output folder
 * @param {number} drunk - drunkness level
 * @param {boolean} logging - whether to log or not
 * @param {string} logString - string to log
 * @returns {Promise<void>}
 */
export async function writeOther(
    otherPath: string,
    originalPath: string,
    outputPath: string,
    drunk: number,
    logging: boolean,
    logString: string
): Promise<void> {
    const re = /^(?!Map|Tilesets|Animations|States|System|Scripts|Areas).*(rxdata|rvdata|rvdata2)$/;
    const filtered = (await readdir(originalPath)).filter((filename) => re.test(filename));

    const filesData = await Promise.all(
        filtered.map((filename) => Bun.file(`${originalPath}/${filename}`).arrayBuffer())
    );

    const objMap = new Map(
        //Slicing off the first element in array as it is null
        filtered.map((filename, i) => [filename, mergeOther(load(filesData[i]) as RubyObject[]).slice(1)])
    );

    //401 - dialogue lines
    //102, 402 - dialogue choices
    //356 - system lines (special texts)
    //405 - credits lines
    const allowedCodes = new Uint16Array([401, 402, 405, 356, 102]);

    for (const [filename, objArr] of objMap) {
        const processedFilename = filename.slice(0, filename.lastIndexOf(".")).toLowerCase();

        const otherOriginalText = (await Bun.file(`${otherPath}/${processedFilename}.txt`).text())
            .split("\n")
            .map((string) => string.replaceAll("\\#", "\n"));

        let otherTranslatedText = (await Bun.file(`${otherPath}/${processedFilename}_trans.txt`).text())
            .split("\n")
            .map((string) => string.replaceAll("\\#", "\n"));

        if (drunk > 0) {
            otherTranslatedText = otherTranslatedText.shuffle();

            if (drunk === 2) {
                otherTranslatedText = otherTranslatedText.map((string) => {
                    return shuffleWords(string)!;
                });
            }
        }

        translationMap = new Map(otherOriginalText.map((string, i) => [string, otherTranslatedText[i]]));

        // Other files except CommonEvents.json and Troops.json have the structure that consists
        // of name, nickname, description and note
        if (!filename.startsWith("Common") && !filename.startsWith("Troops")) {
            for (const obj of objArr) {
                if (!obj) {
                    continue;
                }

                const nameSymbolDesc = "@name";
                const name: string | Uint8Array = getValueBySymbolDesc(obj, nameSymbolDesc);

                const nicknameSymbolDesc = "@nickname";
                const nickname: string | Uint8Array = getValueBySymbolDesc(obj, nicknameSymbolDesc);

                const descriptionSymbolDesc = "@description";
                const description: string | Uint8Array = getValueBySymbolDesc(obj, descriptionSymbolDesc);

                const noteSymbolDesc = "@note";
                const note: string | Uint8Array = getValueBySymbolDesc(obj, noteSymbolDesc);

                for (const [symbol, variable] of [
                    [nameSymbolDesc, name],
                    [nicknameSymbolDesc, nickname],
                    [descriptionSymbolDesc, description],
                    [noteSymbolDesc, note],
                ]) {
                    const gotten = getVariable(variable);

                    if (gotten) {
                        setValueBySymbolDesc(obj, symbol as string, gotten);
                    }
                }
            }
        } else {
            for (const obj of objArr) {
                //CommonEvents doesn't have pages, so we can just check if it's Troops
                const pages: RubyObject[] = getValueBySymbolDesc(obj, "@pages");
                const pagesLength = filename.startsWith("Troops") ? pages.length : 1;

                for (let i = 0; i < pagesLength; i++) {
                    //If it's Troops, we'll iterate over the pages
                    //Otherwise we'll just iterate over the list
                    const list: RubyObject[] = filename.startsWith("Troops")
                        ? getValueBySymbolDesc(pages[i], "@list")
                        : getValueBySymbolDesc(obj, "@list");

                    if (!Array.isArray(list)) {
                        continue;
                    }

                    for (const item of list) {
                        const code: number = getValueBySymbolDesc(item, "@code");

                        if (!allowedCodes.includes(code)) {
                            continue;
                        }

                        const parameters: (string | Uint8Array)[] = getValueBySymbolDesc(item, "@parameters");

                        for (const [i, parameter] of parameters.entries()) {
                            if ([401, 402, 356, 405].includes(code)) {
                                const gotten = getCode(code, parameter);

                                if (gotten) {
                                    parameters[i] = gotten as string | Uint8Array;
                                    setValueBySymbolDesc(item, "@parameters", parameters);
                                }
                            } else if (code === 102) {
                                if (Array.isArray(parameter)) {
                                    for (const [j, param] of parameter.entries()) {
                                        const gotten = getCode(code, param) as string | Uint8Array;

                                        if (gotten) {
                                            (parameters[i][j] as string | Uint8Array) = gotten;
                                        }
                                    }

                                    setValueBySymbolDesc(item, "@parameters", parameters);
                                }
                            }
                        }
                    }
                }
            }
        }

        if (logging) {
            console.log(`${logString} ${filename}`);
        }

        await Bun.write(`${outputPath}/${filename}`, dump(objArr));
    }
}

translationMap = null;

/**
 * Writes system.txt file back to its initial form.
 *
 * For inner code documentation, check readSystem function.
 * @param {string} systemFilePath - path to System.rx/rv/rvdata2 file
 * @param {string} otherPath - path to other directory
 * @param {string} outputPath - path to output directory
 * @param {number} drunk - drunkness level
 * @param {boolean} logging - whether to log or not
 * @param {string} logString - string to log
 * @returns {Promise<void>}
 */
export async function writeSystem(
    systemFilePath: string,
    otherPath: string,
    outputPath: string,
    drunk: number,
    logging: boolean,
    logString: string
): Promise<void> {
    const obj = load(await Bun.file(systemFilePath).arrayBuffer()) as RubyObject;
    const ext = systemFilePath.slice(systemFilePath.lastIndexOf(".") + 1, systemFilePath.length);

    const systemOriginalText = (await Bun.file(`${otherPath}/system.txt`).text()).split("\n");
    let systemTranslatedText = (await Bun.file(`${otherPath}/system_trans.txt`).text()).split("\n");

    if (drunk > 0) {
        systemTranslatedText = systemTranslatedText.shuffle();

        if (drunk === 2) {
            systemTranslatedText = systemTranslatedText.map((string) => {
                return shuffleWords(string)!;
            });
        }
    }

    const translationMap = new Map(systemOriginalText.map((string, i) => [string, systemTranslatedText[i]]));

    const termsDesc = ext !== "rxdata" ? "@terms" : "@words";
    const symbolDescs = [
        "@elements",
        "@skill_types",
        "@weapon_types",
        "@armor_types",
        "@currency_unit",
        termsDesc,
        "@game_title",
    ];

    const elements = getValueBySymbolDesc(obj, symbolDescs[0]) as (string | Uint8Array)[] | undefined;
    const skillTypes = getValueBySymbolDesc(obj, symbolDescs[1]) as (string | Uint8Array)[] | undefined;
    const weaponTypes = getValueBySymbolDesc(obj, symbolDescs[2]) as (string | Uint8Array)[] | undefined;
    const armorTypes = getValueBySymbolDesc(obj, symbolDescs[3]) as (string | Uint8Array)[] | undefined;
    let currencyUnit = getValueBySymbolDesc(obj, symbolDescs[4]) as string | Uint8Array | undefined;
    const terms = getValueBySymbolDesc(obj, symbolDescs[5]) as RubyObject;
    let gameTitle = getValueBySymbolDesc(obj, symbolDescs[6]) as Uint8Array | string;

    for (const [i, arr] of [elements, skillTypes, weaponTypes, armorTypes].entries()) {
        if (!arr) {
            continue;
        }

        for (let [j, string] of arr.entries()) {
            let type = "string";

            if (string instanceof Uint8Array) {
                type = "Uint8Array";
                string = decode(string);
            }

            if (typeof string === "string" && translationMap.has(string)) {
                const gotten = translationMap.get(string)!;
                arr[j] = type === "string" ? gotten : encode(gotten);
                setValueBySymbolDesc(obj, symbolDescs[i], arr);
            }
        }
    }

    {
        let type = "string";

        if (currencyUnit instanceof Uint8Array) {
            type = "Uint8Array";
            currencyUnit = decode(currencyUnit);
        }

        if (typeof currencyUnit === "string" && translationMap.has(currencyUnit)) {
            const gotten = translationMap.get(currencyUnit)!;
            setValueBySymbolDesc(obj, symbolDescs[4], type === "string" ? gotten : encode(gotten));
        }
    }

    const termsSymbols = Object.getOwnPropertySymbols(terms);
    const termsValues: string[][] = termsSymbols.map((symbol) => terms[symbol]);

    for (let i = 0; i < termsSymbols.length; i++) {
        const value = terms[termsSymbols[i]] as Uint8Array | string[];

        if (value instanceof Uint8Array) {
            const decoded = decode(value);

            if (translationMap.has(decoded)) {
                terms[termsSymbols[i]] = encode(translationMap.get(decoded)!);
            }
            continue;
        }

        for (const [j, termValue] of termsValues.entries()) {
            if (translationMap.has(termValue[j])) {
                termValue[j] = translationMap.get(termValue[j])!;
            }

            setValueBySymbolDesc(terms, termsSymbols[i].description!, termValue);
        }
    }

    {
        let type = "string";

        if (gameTitle instanceof Uint8Array) {
            type = "Uint8Array";
            gameTitle = decode(gameTitle);
        }

        if (typeof gameTitle === "string") {
            if (translationMap.has(gameTitle)) {
                const gotten = translationMap.get(gameTitle)!;
                setValueBySymbolDesc(obj, "@game_title", type === "string" ? gotten : encode(gotten));
            }
        }
    }

    if (logging) {
        console.log(`${logString} System.${ext}`);
    }

    await Bun.write(`${outputPath}/System.${ext}`, dump(obj));
}

/**
 * Writes system.txt file back to its initial form.
 *
 * Does not support drunk, because shuffling the data will produce invalid data.
 * @param {string} scriptsFilePath - path to Scripts.rx/rv/rvdata2 file
 * @param {string} otherPath - path to other directory
 * @param {string} outputPath - path to output directory
 * @param {boolean} logging - whether to log or not
 * @param {string} logString - string to log
 * @returns {Promise<void>}
 */
export async function writeScripts(
    scriptsFilePath: string,
    otherPath: string,
    outputPath: string,
    logging: boolean,
    logString: string
): Promise<void> {
    const scriptsArr = load(await Bun.file(scriptsFilePath).arrayBuffer(), {
        string: "binary",
    }) as (string | Uint8Array)[][];
    const ext = scriptsFilePath.slice(scriptsFilePath.lastIndexOf(".") + 1, scriptsFilePath.length);

    const translationArr = (await Bun.file(`${otherPath}/scripts_trans.txt`).text()).split("\n");

    for (let i = 0; i < scriptsArr.length; i++) {
        const magic = scriptsArr[i][0];
        const title = scriptsArr[i][1];

        // Magic number should be encoded as string
        if (magic instanceof Uint8Array) {
            scriptsArr[i][0] = decode(magic);
        }

        // And title too
        if (title instanceof Uint8Array) {
            scriptsArr[i][1] = decode(title);
        }

        // Ruby code should be a deflated string
        scriptsArr[i][2] = deflate(translationArr[i].replaceAll("\\#", "\r\n"));
    }

    if (logging) {
        console.log(`${logString} Scripts.${ext}`);
    }

    await Bun.write(`${outputPath}/Scripts.${ext}`, dump(scriptsArr));
}
