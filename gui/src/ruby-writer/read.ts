import { readBinaryFile, readDir, writeTextFile } from "@tauri-apps/api/fs";
import { OrderedSet } from "immutable";
import { load } from "@hyrious/marshal";
import { inflate } from "pako";

import { getValueBySymbolDesc } from "./symbol-utils";

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
export async function readMap(inputPath: string, outputPath: string): Promise<void> {
    const decoder = new TextDecoder();

    const re = /^Map[0-9].*(rxdata|rvdata|rvdata2)$/;
    const files = (await readDir(inputPath)).filter((filename) => re.test(filename.name!));

    const filesData: ArrayBuffer[] = await Promise.all(files.map((filename) => readBinaryFile(filename.path)));

    const objArr = filesData.map((file) => load(file) as RubyObject);

    const lines = OrderedSet().asMutable() as OrderedSet<string>;
    const namesLines = OrderedSet().asMutable() as OrderedSet<string>;

    for (const obj of objArr) {
        const displayName: string | Uint8Array = getValueBySymbolDesc(obj, "@display_name");

        if (typeof displayName === "string" && displayName.length > 0) {
            namesLines.add(displayName);
        } else if (displayName instanceof Uint8Array) {
            const decoded = decoder.decode(displayName);

            if (decoded.length > 0) {
                namesLines.add(decoded);
            }
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

                            if (typeof parameter === "string" && parameter.length > 0) {
                                line.push(parameter);
                            } else if (parameter instanceof Uint8Array) {
                                const decoded = decoder.decode(parameter);

                                if (decoded.length > 0) {
                                    line.push(decoded);
                                }
                            }
                        } else {
                            if (inSeq) {
                                lines.add(line.join("\\#"));
                                line.length = 0;
                                inSeq = false;
                            }

                            switch (code) {
                                case 102:
                                    if (Array.isArray(parameter)) {
                                        for (const param of parameter as (string | Uint8Array)[]) {
                                            if (typeof param === "string" && param.length > 0) {
                                                lines.add(param);
                                            } else if (param instanceof Uint8Array) {
                                                const decoded = decoder.decode(param);

                                                if (decoded.length > 0) {
                                                    lines.add(decoded);
                                                }
                                            }
                                        }
                                    }
                                    break;

                                case 356:
                                    if (typeof parameter === "string" && parameter.length > 0) {
                                        lines.add(parameter);
                                    } else if (parameter instanceof Uint8Array) {
                                        const decoded = decoder.decode(parameter);

                                        if (decoded.length > 0) {
                                            lines.add(decoded);
                                        }
                                    }
                                    break;
                            }
                        }
                    }
                }
            }
        }
    }

    await writeTextFile(`${outputPath}/maps.txt`, lines.join("\n"));
    await writeTextFile(`${outputPath}/maps_trans.txt`, "\n".repeat(lines.size ? lines.size - 1 : 0));
    await writeTextFile(`${outputPath}/names.txt`, namesLines.join("\n"));
    await writeTextFile(`${outputPath}/names_trans.txt`, "\n".repeat(namesLines.size ? namesLines.size - 1 : 0));
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
    logString: string
): Promise<void> {
    const decoder = new TextDecoder();

    const re = /^(?!Map|Tilesets|Animations|States|System|Scripts|Areas).*(rxdata|rvdata|rvdata2)$/;
    const filenames = (await readDir(inputPath)).filter((filename) => re.test(filename.name!));

    const filesData: ArrayBuffer[] = await Promise.all(filenames.map((filename) => readBinaryFile(filename.path)));

    const objArrMap = new Map(
        // Slicing off the first element in array as it is null
        filenames.map((filename, i) => [filename.name!, (load(filesData[i]) as RubyObject[]).slice(1)])
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

                if (typeof name === "string" && name.length > 0) {
                    lines.add(name);
                } else if (name instanceof Uint8Array) {
                    const decoded = decoder.decode(name);

                    if (decoded.length > 0) {
                        lines.add(decoded);
                    }
                }

                if (typeof nickname === "string" && nickname.length > 0) {
                    lines.add(nickname);
                } else if (nickname instanceof Uint8Array) {
                    const decoded = decoder.decode(nickname);

                    if (decoded.length > 0) {
                        lines.add(decoded);
                    }
                }

                if (typeof description === "string" && description.length > 0) {
                    lines.add(description.replaceAll(/\r\n|\n/g, "\\#"));
                } else if (description instanceof Uint8Array) {
                    const decoded = decoder.decode(description);

                    if (decoded.length > 0) {
                        lines.add(decoded.replaceAll(/\r\n|\n/g, "\\#"));
                    }
                }

                if (typeof note === "string" && note.length > 0) {
                    lines.add(note.replaceAll(/\r\n|\n/g, "\\#"));
                } else if (note instanceof Uint8Array) {
                    const decoded = decoder.decode(note);

                    if (decoded.length > 0) {
                        lines.add(decoded.replaceAll(/\r\n|\n/g, "\\#"));
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

                                if (typeof parameter === "string" && parameter.length > 0) {
                                    line.push(parameter);
                                } else if (parameter instanceof Uint8Array) {
                                    const decoded = decoder.decode(parameter);

                                    if (decoded.length > 0) {
                                        line.push(decoded);
                                    }
                                }
                            } else {
                                if (inSeq) {
                                    lines.add(line.join("\\#"));
                                    line.length = 0;
                                    inSeq = false;
                                }

                                switch (code) {
                                    case 102:
                                        if (Array.isArray(parameter)) {
                                            for (const param of parameter as (string | Uint8Array)[]) {
                                                if (typeof param === "string" && param.length > 0) {
                                                    lines.add(param);
                                                } else if (param instanceof Uint8Array) {
                                                    const decoded = decoder.decode(param);

                                                    if (decoded.length > 0) {
                                                        lines.add(decoded);
                                                    }
                                                }
                                            }
                                        }
                                        break;

                                    case 356:
                                        if (typeof parameter === "string" && parameter.length > 0) {
                                            lines.add(parameter);
                                        } else if (parameter instanceof Uint8Array) {
                                            const decoded = decoder.decode(parameter);

                                            if (decoded.length > 0) {
                                                lines.add(decoded);
                                            }
                                        }
                                        break;
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

        await writeTextFile(`${outputPath}/${processedFilename}.txt`, lines.join("\n"));
        await writeTextFile(
            `${outputPath}/${processedFilename}_trans.txt`,
            "\n".repeat(lines.size ? lines.size - 1 : 0)
        );
    }
}

/**
 * Reads System .rx/rv/rvdata2 file from inputFilePath and parses it into .txt file in outputPath.
 *
 * Based on the engine type, strings can be either UTF-8 encoded or binary.
 * This function handles both cases.
 * @param {string} inputFilePath - path to .rx/rv/rvdata2 file
 * @param {string} outputPath - path to output directory
 * @param {boolean} logging - whether to log or not
 * @param {string} logString - string to log
 * @returns {Promise<void>}
 */
export async function readSystem(inputFilePath: string, outputPath: string): Promise<void> {
    const decoder = new TextDecoder();

    const file = await readBinaryFile(inputFilePath);
    const obj = load(file) as RubyObject;
    const ext = inputFilePath.slice(inputFilePath.lastIndexOf(".") + 1, inputFilePath.length);

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
    const currencyUnit = getValueBySymbolDesc(obj, symbolDescs[4]) as string | Uint8Array | undefined;
    // Game terms (vocabulary), called "words" in RPG Maker XP
    const terms = getValueBySymbolDesc(obj, symbolDescs[5]) as RubyObject;
    // Game title
    const gameTitle = getValueBySymbolDesc(obj, symbolDescs[6]) as Uint8Array | string;

    for (const arr of [elements, skillTypes, weaponTypes, armorTypes]) {
        if (!arr) {
            continue;
        }

        for (const string of arr) {
            if (typeof string === "string" && string.length > 0) {
                lines.add(string);
            } else if (string instanceof Uint8Array) {
                const decoded = decoder.decode(string);

                if (decoded.length > 0) {
                    lines.add(decoded);
                }
            }
        }
    }

    if (typeof currencyUnit === "string" && currencyUnit.length > 0) {
        lines.add(currencyUnit);
    } else if (currencyUnit instanceof Uint8Array) {
        const decoded = decoder.decode(currencyUnit);

        if (decoded.length > 0) {
            lines.add(decoded);
        }
    }

    const termsSymbols = Object.getOwnPropertySymbols(terms);

    for (let i = 0; i < termsSymbols.length; i++) {
        const value = terms[termsSymbols[i]] as Uint8Array | string[];

        if (value instanceof Uint8Array) {
            const decoded = decoder.decode(value);

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

    if (typeof gameTitle === "string" && gameTitle.length > 0) {
        lines.add(gameTitle);
    } else if (gameTitle instanceof Uint8Array) {
        const decoded = decoder.decode(gameTitle);

        if (decoded.length > 0) {
            lines.add(decoded);
        }
    }

    await writeTextFile(`${outputPath}/system.txt`, lines.join("\n"));
    await writeTextFile(`${outputPath}/system_trans.txt`, "\n".repeat(lines.size ? lines.size - 1 : 0));
}

/**
 * Reads Scripts .rx/rv/rvdata2 file from inputFilePath and parses it into .txt file in outputPath.
 * @param {string} inputFilePath - path to .rx/rv/rvdata2 file
 * @param {string} outputPath - path to output directory
 * @param {boolean} logging - whether to log or not
 * @param {string} logString - string to log
 * @returns {Promise<void>}
 */
export async function readScripts(inputFilePath: string, outputPath: string): Promise<void> {
    const decoder = new TextDecoder();

    const file = await readBinaryFile(inputFilePath);
    const uintarrArr = load(file, { string: "binary" }) as Uint8Array[][];

    const fullCode = [];
    for (let i = 0; i < uintarrArr.length; i++) {
        // To convert Ruby code to string, it needs to be inflated
        // Then we decode our inflated string to the actual UTF-8 encoded string
        // And then replace \r\ns with \#s, which are out custom newline marks
        const codeString = decoder.decode(inflate(uintarrArr[i][2])).replaceAll(/\r?\n/g, "\\#");
        fullCode.push(codeString);
    }

    const joinedCode = fullCode.join("\n");
    await writeTextFile(`${outputPath}/scripts.txt`, joinedCode);
    await writeTextFile(`${outputPath}/scripts_trans.txt`, joinedCode);
}
