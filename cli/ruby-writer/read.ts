import { readdir } from "node:fs/promises";
import { OrderedSet } from "immutable";
import { load } from "@hyrious/marshal";
import { inflate } from "pako";

import { getValueBySymbolDesc } from "./symbol-utils";

const decoder = new TextDecoder();

const decode = (buffer: Uint8Array): string => {
    return decoder.decode(buffer);
};

function parseCode(code: number, parameter: (string | Uint8Array) | string[], gameType: string): string | void {
    switch (code) {
        case 401 || 405:
            if (parameter instanceof Uint8Array) {
                parameter = decode(parameter);
            }

            if (typeof parameter === "string" && parameter.length > 0) {
                switch (gameType) {
                    case "lisa":
                        const match = parameter.match(/^\\et\[[0-9]+\]/) ?? parameter.match(/^\\et\[[0-9]+\]/);

                        if (match) {
                            parameter = parameter.slice(match[0].length);
                        }
                        break;
                }

                return parameter;
            }
        case 102:
            if (parameter instanceof Uint8Array) {
                parameter = decode(parameter);
            }

            if (typeof parameter === "string" && parameter.length > 0) {
                return parameter;
            }
            break;
        case 356:
            if (parameter instanceof Uint8Array) {
                parameter = decode(parameter);
            }

            if (typeof parameter === "string" && parameter.length > 0) {
                return parameter as string;
            }
            break;
    }
}

function parseVariable(variable: string | Uint8Array, gameType: string): string | undefined {
    if (variable instanceof Uint8Array) {
        variable = decode(variable);
    }

    if (typeof variable === "string" && variable.length > 0) {
        const linesCount = variable.match(/\r?\n/g)?.length ?? 0;

        if (linesCount >= 1) {
            switch (gameType) {
                case "lisa":
                    variable = variable.replaceAll(/\r?\n/g, "\\#");

                    if (!variable.split("\\#").every((line) => /^<.*>\.?$/.test(line) || line.length === 0)) {
                        return variable;
                    } else {
                        return undefined;
                    }
                    break;
            }
        }
    }

    return variable;
}

/**
 * Reads all Map .rx/rv/rvdata2 files of inputPath and parses them into .txt files in outputPath.
 *
 * Based on the engine type, strings can be either UTF-8 encoded or binary.
 * This function handles both cases.
 * @param {string} inputPath - path to directory than contains .rx/rv/rvdata2 files
 * @param {string} outputPath - path to output directory
 * @param {boolean} logging - whether to log or not
 * @param {string} logString - string to log
 * @returns {Promise<void>}
 */
export async function readMap(
    inputPath: string,
    outputPath: string,
    logging: boolean,
    logString: string,
    gameType: string
): Promise<void> {
    const re = /^Map[0-9].*(rxdata|rvdata|rvdata2)$/;
    const files = (await readdir(inputPath)).filter((filename) => re.test(filename));

    const filesData: ArrayBuffer[] = await Promise.all(
        files.map((filename) => Bun.file(`${inputPath}/${filename}`).arrayBuffer())
    );

    const objMap = new Map(files.map((filename, i) => [filename, load(filesData[i]) as RubyObject]));

    const lines = OrderedSet().asMutable() as OrderedSet<string>;
    const namesLines = OrderedSet().asMutable() as OrderedSet<string>;

    for (const [filename, obj] of objMap) {
        let displayName: string | Uint8Array = getValueBySymbolDesc(obj, "@display_name");

        if (displayName instanceof Uint8Array) {
            displayName = decode(displayName);
        }

        if (typeof displayName === "string" && displayName.length > 0) {
            namesLines.add(displayName);
        }

        const events: object = getValueBySymbolDesc(obj, "@events");

        for (const event of Object.values(events || {})) {
            const pages: RubyObject[] = getValueBySymbolDesc(event, "@pages");
            if (!pages) {
                continue;
            }

            for (const page of pages) {
                let inSeq: boolean = false;
                const line: string[] = [];
                const list: RubyObject[] = getValueBySymbolDesc(page, "@list");

                if (!Array.isArray(list)) {
                    continue;
                }

                for (const item of list) {
                    //401 - dialogue lines
                    //102 - dialogue choices
                    //356 - system lines (special texts)
                    const code: number = getValueBySymbolDesc(item, "@code");

                    const parameters: (string | Uint8Array)[] | (string | Uint8Array)[][] = getValueBySymbolDesc(
                        item,
                        "@parameters"
                    );

                    for (const parameter of parameters as (string | Uint8Array)[]) {
                        if (code === 401) {
                            inSeq = true;

                            const parsed = parseCode(code, parameter, gameType);

                            if (parsed) {
                                line.push(parsed);
                            }
                        } else {
                            if (inSeq) {
                                lines.add(line.join("\\#"));
                                line.length = 0;
                                inSeq = false;
                            }

                            if (code === 102) {
                                if (Array.isArray(parameter)) {
                                    for (const param of parameter) {
                                        const parsed = parseCode(code, param, gameType);

                                        if (parsed) {
                                            lines.add(parsed);
                                        }
                                    }
                                }
                            } else if (code === 356) {
                                const parsed = parseCode(code, parameter, gameType);

                                if (parsed) {
                                    lines.add(parsed);
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

    await Bun.write(`${outputPath}/maps.txt`, lines.join("\n"));
    await Bun.write(`${outputPath}/maps_trans.txt`, "\n".repeat(lines.size ? lines.size - 1 : 0));
    await Bun.write(`${outputPath}/names.txt`, namesLines.join("\n"));
    await Bun.write(`${outputPath}/names_trans.txt`, "\n".repeat(namesLines.size ? namesLines.size - 1 : 0));
}

/**
 * Reads all non-Map .rx/rv/rvdata2 files of inputPath (except System and Scripts) and parses them into .txt files in outputPath.
 *
 * Based on the engine type, strings can be either UTF-8 encoded or binary.
 * This function handles both cases.
 * @param {string} inputPath - path to directory than contains .rx/rv/rvdata2 files
 * @param {string} outputPath - path to output directory
 * @param {boolean} logging - whether to log or not
 * @param {string} logString - string to log
 * @returns {Promise<void>}
 */
export async function readOther(
    inputPath: string,
    outputPath: string,
    logging: boolean,
    logString: string,
    gameType: string
): Promise<void> {
    const re = /^(?!Map|Tilesets|Animations|States|System|Scripts|Areas).*(rxdata|rvdata|rvdata2)$/;
    const filenames = (await readdir(inputPath)).filter((filename) => re.test(filename));

    const filesData: ArrayBuffer[] = await Promise.all(
        filenames.map((filename) => Bun.file(`${inputPath}/${filename}`).arrayBuffer())
    );

    const objArrMap = new Map(
        // Slicing off the first element in array as it is null
        filenames.map((filename, i) => [filename, (load(filesData[i]) as RubyObject[]).slice(1)])
    );

    for (const [filename, objArr] of objArrMap) {
        const processedFilename = filename.toLowerCase().slice(0, filename.lastIndexOf("."));
        const lines = OrderedSet().asMutable() as OrderedSet<string>;

        // Other files except CommonEvents.json and Troops.json have the structure that consists
        // of name, nickname, description and note
        if (!filename.startsWith("Common") && !filename.startsWith("Troops")) {
            for (const obj of objArr) {
                const name: string | Uint8Array = getValueBySymbolDesc(obj, "@name");
                const nickname: string | Uint8Array = getValueBySymbolDesc(obj, "@nickname");
                const description: string | Uint8Array = getValueBySymbolDesc(obj, "@description");
                const note: string | Uint8Array = getValueBySymbolDesc(obj, "@note");

                for (const variable of [name, nickname, description, note]) {
                    const parsed = parseVariable(variable, gameType);

                    if (parsed) {
                        lines.add(parsed);
                    }
                }
            }
        }
        //Other files have the structure somewhat similar to Maps.json files
        else {
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

                    let inSeq: boolean = false;
                    const line: string[] = [];

                    for (const item of list) {
                        //401 - dialogue lines
                        //102 - dialogue choices
                        //356 - system lines (special texts)
                        //405 - credits lines
                        const code: number = getValueBySymbolDesc(item, "@code");
                        const parameters: (string | Uint8Array)[] | (string | Uint8Array)[][] = getValueBySymbolDesc(
                            item,
                            "@parameters"
                        );

                        for (const parameter of parameters as (string | Uint8Array)[]) {
                            if (code === 401 || code === 405) {
                                inSeq = true;

                                const parsed = parseCode(code, parameter, gameType);

                                if (parsed) {
                                    line.push(parsed);
                                }
                            } else {
                                if (inSeq) {
                                    lines.add(line.join("\\#"));
                                    line.length = 0;
                                    inSeq = false;
                                }

                                if (code === 102) {
                                    if (Array.isArray(parameter)) {
                                        for (const param of parameter) {
                                            const parsed = parseCode(code, param, gameType);

                                            if (parsed) {
                                                lines.add(parsed);
                                            }
                                        }
                                    }
                                } else if (code === 356) {
                                    const parsed = parseCode(code, parameter, gameType);

                                    if (parsed) {
                                        lines.add(parsed);
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

        await Bun.write(`${outputPath}/${processedFilename}.txt`, lines.join("\n"));
        await Bun.write(`${outputPath}/${processedFilename}_trans.txt`, "\n".repeat(lines.size ? lines.size - 1 : 0));
    }
}

/**
 * Reads System .rx/rv/rvdata2 file from inputFilePath and parses it into .txt file in outputPath.
 *
 * Based on the engine type, strings can be either UTF-8 encoded or binary.
 * This function handles both cases.
 * @param {string} systemFilePath - path to .rx/rv/rvdata2 file
 * @param {string} outputPath - path to output directory
 * @param {boolean} logging - whether to log or not
 * @param {string} logString - string to log
 * @returns {Promise<void>}
 */
export async function readSystem(
    systemFilePath: string,
    outputPath: string,
    logging: boolean,
    logString: string
): Promise<void> {
    const file = Bun.file(systemFilePath);
    const obj = load(await file.arrayBuffer()) as RubyObject;
    const ext = systemFilePath.slice(systemFilePath.lastIndexOf(".") + 1, systemFilePath.length);

    const lines = OrderedSet().asMutable() as OrderedSet<string>;

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

    // Game damage elements names
    const elements = getValueBySymbolDesc(obj, symbolDescs[0]) as (string | Uint8Array)[] | undefined;
    // Game skill types names
    const skillTypes = getValueBySymbolDesc(obj, symbolDescs[1]) as (string | Uint8Array)[] | undefined;
    // Game weapon types names
    const weaponTypes = getValueBySymbolDesc(obj, symbolDescs[2]) as (string | Uint8Array)[] | undefined;
    // Game armor types names
    const armorTypes = getValueBySymbolDesc(obj, symbolDescs[3]) as (string | Uint8Array)[] | undefined;
    // Game currency unit name
    let currencyUnit = getValueBySymbolDesc(obj, symbolDescs[4]) as string | Uint8Array | undefined;
    // Game terms (vocabulary), called "words" in RPG Maker XP
    const terms = getValueBySymbolDesc(obj, symbolDescs[5]) as RubyObject;
    // Game title
    let gameTitle = getValueBySymbolDesc(obj, symbolDescs[6]) as Uint8Array | string;

    for (const arr of [elements, skillTypes, weaponTypes, armorTypes]) {
        if (!arr) {
            continue;
        }

        for (let string of arr) {
            if (string instanceof Uint8Array) {
                string = decode(string);
            }

            if (typeof string === "string" && string.length > 0) {
                lines.add(string);
            }
        }
    }

    if (currencyUnit instanceof Uint8Array) {
        currencyUnit = decode(currencyUnit);
    }

    if (typeof currencyUnit === "string" && currencyUnit.length > 0) {
        lines.add(currencyUnit);
    }

    const termsSymbols = Object.getOwnPropertySymbols(terms);

    for (let i = 0; i < termsSymbols.length; i++) {
        const value = terms[termsSymbols[i]] as Uint8Array | string[];

        if (value instanceof Uint8Array) {
            const decoded = decode(value);

            if (decoded.length > 0) {
                lines.add(decoded);
            }
            continue;
        }

        for (const string of value) {
            if (string.length > 0) {
                lines.add(string as string);
            }
        }
    }

    if (gameTitle instanceof Uint8Array) {
        gameTitle = decode(gameTitle);
    }

    if (typeof gameTitle === "string" && gameTitle.length > 0) {
        lines.add(gameTitle);
    }

    if (logging) {
        console.log(`${logString} ${file.name}`);
    }

    await Bun.write(`${outputPath}/system.txt`, lines.join("\n"));
    await Bun.write(`${outputPath}/system_trans.txt`, "\n".repeat(lines.size ? lines.size - 1 : 0));
}

/**
 * Reads Scripts .rx/rv/rvdata2 file from inputFilePath and parses it into .txt file in outputPath.
 * @param {string} scriptsFilePath - path to .rx/rv/rvdata2 file
 * @param {string} outputPath - path to output directory
 * @param {boolean} logging - whether to log or not
 * @param {string} logString - string to log
 * @returns {Promise<void>}
 */
export async function readScripts(
    scriptsFilePath: string,
    outputPath: string,
    logging: boolean,
    logString: string
): Promise<void> {
    const file = Bun.file(scriptsFilePath);
    const uintarrArr = load(await file.arrayBuffer(), { string: "binary" }) as Uint8Array[][];

    const fullCode = [];
    for (let i = 0; i < uintarrArr.length; i++) {
        // To convert Ruby code to string, it needs to be inflated
        // Then we decode our inflated string to the actual UTF-8 encoded string
        // And then replace \r\ns with \#s, which are out custom newline marks
        const codeString = decode(inflate(uintarrArr[i][2])).replaceAll(/\r?\n/g, "\\#");
        fullCode.push(codeString);
    }

    if (logging) {
        console.log(`${logString} ${file.name}.`);
    }

    const joinedCode = fullCode.join("\n");
    await Bun.write(`${outputPath}/scripts.txt`, joinedCode);
    await Bun.write(`${outputPath}/scripts_trans.txt`, joinedCode);
}
