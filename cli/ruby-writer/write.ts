import { readdir } from "node:fs/promises";
import { dump, load } from "@hyrious/marshal";
import { deflate } from "pako";

import "./shuffle";
import { getValueBySymbolDesc, setValueBySymbolDesc } from "./symbol-utils";

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
export function mergeMap(obj: RubyObject): RubyObject {
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
export function mergeOther(objArr: RubyObject[]): RubyObject[] {
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
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

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

    const mapsTranslationMap = new Map(mapsOriginalText.map((string, i) => [string, mapsTranslatedText[i]]));
    const namesTranslationMap = new Map(namesOriginalText.map((string, i) => [string, namesTranslatedText[i]]));

    //401 - dialogue lines
    //102, 402 - dialogue choices
    //356 - system lines (special texts)
    const ALLOWED_CODES: Uint16Array = new Uint16Array([401, 402, 356, 102]);

    for (const [filename, obj] of objMap) {
        const displayName: string | Uint8Array = getValueBySymbolDesc(obj, "@display_name");

        if (typeof displayName === "string" && namesTranslationMap.has(displayName)) {
            setValueBySymbolDesc(obj, "@display_name", namesTranslationMap.get(displayName)!);
        } else if (displayName instanceof Uint8Array) {
            const decoded = decoder.decode(displayName);

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

                    if (!ALLOWED_CODES.includes(code)) {
                        continue;
                    }

                    const parameters: (string | Uint8Array)[] = getValueBySymbolDesc(item, "@parameters");

                    for (const [i, parameter] of parameters.entries()) {
                        if (typeof parameter === "string") {
                            if (code === 401 || code === 402 || code === 356) {
                                if (mapsTranslationMap.has(parameter)) {
                                    parameters[i] = mapsTranslationMap.get(parameter)!;
                                    setValueBySymbolDesc(item, "@parameters", parameters);
                                }
                            }
                        } else if (parameter instanceof Uint8Array) {
                            const decoded = decoder.decode(parameter);

                            if (code === 401 || code === 402 || code === 356) {
                                if (mapsTranslationMap.has(decoded)) {
                                    parameters[i] = encoder.encode(mapsTranslationMap.get(decoded)!);
                                    setValueBySymbolDesc(item, "@parameters", parameters);
                                }
                            }
                        } else if (code == 102 && Array.isArray(parameter)) {
                            for (const [j, param] of (parameter as (string | Uint8Array)[]).entries()) {
                                if (typeof param === "string") {
                                    if (mapsTranslationMap.has(param)) {
                                        (parameters[i][j] as string) = mapsTranslationMap.get(param)!;

                                        setValueBySymbolDesc(item, "@parameters", parameters);
                                    }
                                } else if (param instanceof Uint8Array) {
                                    const decoded = decoder.decode(param);
                                    if (mapsTranslationMap.has(decoded)) {
                                        (parameters[i][j] as unknown as Uint8Array) = encoder.encode(
                                            mapsTranslationMap.get(decoded)!
                                        );

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
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    const re = /^(?!Map|Tilesets|Animations|States|System|Scripts|Areas).*(rxdata|rvdata|rvdata2)$/;
    const filtered = (await readdir(originalPath)).filter((filename) => re.test(filename));

    const filesData = await Promise.all(
        filtered.map((filename) => Bun.file(`${originalPath}/${filename}`).arrayBuffer())
    );

    const objMap = new Map(
        //Slicing off the first element in array as it is null
        filtered.map((filename, i) => [
            filename,
            mergeOther(load(filesData[i]) as RubyObject[]).slice(1) as RubyObject[],
        ])
    );

    //401 - dialogue lines
    //102, 402 - dialogue choices
    //356 - system lines (special texts)
    //405 - credits lines
    const ALLOWED_CODES = new Uint16Array([401, 402, 405, 356, 102]);

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

        const translationMap = new Map(otherOriginalText.map((string, i) => [string, otherTranslatedText[i]]));

        // Other files except CommonEvents.json and Troops.json have the structure that consists
        // of name, nickname, description and note
        if (!filename.startsWith("Common") && !filename.startsWith("Troops")) {
            for (const obj of objArr) {
                if (!obj) {
                    continue;
                }

                const name: string | Uint8Array = getValueBySymbolDesc(obj, "@name");
                const nickname: string | Uint8Array = getValueBySymbolDesc(obj, "@nickname");
                const description: string | Uint8Array = getValueBySymbolDesc(obj, "@description");
                const note: string | Uint8Array = getValueBySymbolDesc(obj, "@note");

                if (typeof name === "string" && translationMap.has(name)) {
                    setValueBySymbolDesc(obj, "@name", translationMap.get(name));
                } else if (name instanceof Uint8Array) {
                    const decoded = decoder.decode(name);

                    if (translationMap.has(decoded)) {
                        setValueBySymbolDesc(obj, "@name", encoder.encode(translationMap.get(decoded)!));
                    }
                }

                if (typeof nickname === "string" && translationMap.has(nickname)) {
                    setValueBySymbolDesc(obj, "@nickname", translationMap.get(nickname));
                } else if (nickname instanceof Uint8Array) {
                    const decoded = decoder.decode(nickname);

                    if (translationMap.has(decoded)) {
                        setValueBySymbolDesc(obj, "@nickname", encoder.encode(translationMap.get(decoded)!));
                    }
                }

                if (typeof description === "string" && translationMap.has(description)) {
                    setValueBySymbolDesc(obj, "@description", translationMap.get(description));
                } else if (description instanceof Uint8Array) {
                    const decoded = decoder.decode(description);

                    if (translationMap.has(decoded)) {
                        setValueBySymbolDesc(obj, "@description", encoder.encode(translationMap.get(decoded)!));
                    }
                }

                if (typeof note === "string" && translationMap.has(note)) {
                    setValueBySymbolDesc(obj, "@note", translationMap.get(note));
                } else if (note instanceof Uint8Array) {
                    const decoded = decoder.decode(note);

                    if (translationMap.has(decoded)) {
                        setValueBySymbolDesc(obj, "@note", encoder.encode(translationMap.get(decoded)!));
                    }
                }
            }
        } else {
            for (const obj of objArr.slice(1)) {
                //CommonEvents doesn't have pages, so we can just check if it's Troops
                const pages: RubyObject[] = getValueBySymbolDesc(obj, "@pages");
                const pagesLength = filename.startsWith("Troops") ? pages.length : 1;

                for (let i = 0; i < pagesLength; i++) {
                    //If element has pages, then we'll iterate over them
                    //Otherwise we'll just iterate over the list
                    const list: RubyObject[] = filename.startsWith("Troops")
                        ? getValueBySymbolDesc(pages[i], "@list")
                        : getValueBySymbolDesc(obj, "@list");

                    if (!Array.isArray(list)) {
                        continue;
                    }

                    for (const item of list) {
                        const code: number = getValueBySymbolDesc(item, "@code");

                        if (!ALLOWED_CODES.includes(code)) {
                            continue;
                        }

                        const parameters: (string | Uint8Array)[] | (string | Uint8Array)[][] = getValueBySymbolDesc(
                            item,
                            "@parameters"
                        );

                        for (const [i, parameter] of parameters.entries()) {
                            if (typeof parameter === "string") {
                                if ([401, 402, 405, 356].includes(code)) {
                                    if (translationMap.has(parameter)) {
                                        parameters[i] = translationMap.get(parameter)!;
                                        setValueBySymbolDesc(item, "@parameters", parameters);
                                    }
                                }
                            } else if (parameter instanceof Uint8Array) {
                                const decoded = decoder.decode(parameter);

                                if ([401, 402, 405, 356].includes(code)) {
                                    if (translationMap.has(decoded)) {
                                        parameters[i] = encoder.encode(translationMap.get(decoded)!);
                                        setValueBySymbolDesc(item, "@parameters", parameters);
                                    }
                                }
                            } else if (code === 102 && Array.isArray(parameter)) {
                                for (const [j, param] of (parameter as (string | Uint8Array)[]).entries()) {
                                    if (typeof param === "string") {
                                        if (translationMap.has(param)) {
                                            (parameters[i][j] as string) = translationMap.get(param)!;
                                            setValueBySymbolDesc(item, "@parameters", parameters);
                                        }
                                    } else if (param instanceof Uint8Array) {
                                        const decoded = decoder.decode(param);

                                        if (translationMap.has(decoded)) {
                                            (parameters[i][j] as Uint8Array) = encoder.encode(
                                                translationMap.get(decoded)!
                                            );
                                            setValueBySymbolDesc(item, "@parameters", parameters);
                                        }
                                    }
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

/**
 * Writes system.txt file back to its initial form.
 *
 * For inner code documentation, check readSystem function.
 * @param {string} inputFilePath - path to System.rx/rv/rvdata2 file
 * @param {string} otherPath - path to other directory
 * @param {string} outputPath - path to output directory
 * @param {number} drunk - drunkness level
 * @param {boolean} logging - whether to log or not
 * @param {string} logString - string to log
 * @returns {Promise<void>}
 */
export async function writeSystem(
    inputFilePath: string,
    otherPath: string,
    outputPath: string,
    drunk: number,
    logging: boolean,
    logString: string
): Promise<void> {
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    const obj = load(await Bun.file(inputFilePath).arrayBuffer()) as RubyObject;
    const ext = inputFilePath.slice(inputFilePath.lastIndexOf(".") + 1, inputFilePath.length);

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

    if (ext === "rvdata2") {
        const symbolDescs = ["@elements", "@skill_types", "@weapon_types", "@armor_types", "@currency_unit", "@terms"];
        const [elements, skillTypes, weaponTypes, armorTypes, currencyUnit, terms] = symbolDescs.map((desc) =>
            getValueBySymbolDesc(obj, desc)
        ) as [string[], string[], string[], string[], string, RubyObject];

        for (const [i, arr] of [elements, skillTypes, weaponTypes, armorTypes].entries()) {
            for (const [j, string] of arr.entries()) {
                if (string && translationMap.has(string)) {
                    arr[j] = translationMap.get(string)!;

                    setValueBySymbolDesc(obj, symbolDescs[i], arr);
                }
            }
        }

        setValueBySymbolDesc(obj, currencyUnit, translationMap.get(currencyUnit));

        const termsSymbols = Object.getOwnPropertySymbols(terms);
        const termsValues: string[][] = termsSymbols.map((symbol) => terms[symbol]);

        for (let i = 0; i < termsSymbols.length; i++) {
            for (const [j, termValue] of termsValues.entries()) {
                if (translationMap.has(termValue[j])) {
                    termValue[j] = translationMap.get(termValue[j])!;
                }

                setValueBySymbolDesc(terms, termsSymbols[i].description!, termValue);
            }
        }
    } else {
        const symbolsDesc = ext === "rvdata" ? "@terms" : "@words";

        const termsObj = getValueBySymbolDesc(obj, symbolsDesc) as RubyObject;
        const termsSymbols = Object.getOwnPropertySymbols(termsObj);

        for (let i = 0; i < termsSymbols.length; i++) {
            const value = termsObj[termsSymbols[i]] as Uint8Array;

            if (value instanceof Uint8Array) {
                const decoded = decoder.decode(value);

                if (translationMap.has(decoded)) {
                    termsObj[termsSymbols[i]] = encoder.encode(translationMap.get(decoded)!);
                }
            }
        }
    }

    const gameTitle = getValueBySymbolDesc(obj, "@game_title") as Uint8Array | string;
    if (typeof gameTitle === "string") {
        if (translationMap.has(gameTitle)) {
            setValueBySymbolDesc(obj, "@game_title", translationMap.get(gameTitle)!);
        }
    } else {
        const decoded = decoder.decode(gameTitle);

        if (translationMap.has(decoded)) {
            setValueBySymbolDesc(obj, "@game_title", encoder.encode(translationMap.get(decoded)!));
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
 * @param {string} inputFilePath - path to Scripts.rx/rv/rvdata2 file
 * @param {string} otherPath - path to other directory
 * @param {string} outputPath - path to output directory
 * @param {boolean} logging - whether to log or not
 * @param {string} logString - string to log
 * @returns {Promise<void>}
 */
export async function writeScripts(
    inputFilePath: string,
    otherPath: string,
    outputPath: string,
    logging: boolean,
    logString: string
): Promise<void> {
    const decoder = new TextDecoder();

    const scriptsArr = load(await Bun.file(inputFilePath).arrayBuffer(), {
        string: "binary",
    }) as (string | Uint8Array)[][];
    const ext = inputFilePath.slice(inputFilePath.lastIndexOf(".") + 1, inputFilePath.length);

    const translationArr = (await Bun.file(`${otherPath}/scripts_trans.txt`).text()).split("\n");

    for (let i = 0; i < scriptsArr.length; i++) {
        const magic = scriptsArr[i][0];
        const title = scriptsArr[i][1];

        // Magic number should be encoded as string
        if (magic instanceof Uint8Array) {
            scriptsArr[i][0] = decoder.decode(magic);
        }

        // And title too
        if (title instanceof Uint8Array) {
            scriptsArr[i][1] = decoder.decode(title);
        }

        // Ruby code should be a deflated string
        scriptsArr[i][2] = deflate(translationArr[i].replaceAll("\\#", "\r\n"));
    }

    if (logging) {
        console.log(`${logString} Scripts.${ext}`);
    }

    await Bun.write(`${outputPath}/Scripts.${ext}`, dump(scriptsArr));
}
