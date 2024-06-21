import { readdir } from "node:fs/promises";
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
export async function readMap(
    inputPath: string,
    outputPath: string,
    logging: boolean,
    logString: string
): Promise<void> {
    const decoder = new TextDecoder();

    const re = /^Map[0-9].*(rxdata|rvdata|rvdata2)$/;
    const files = (await readdir(inputPath)).filter((filename) => re.test(filename));

    const filesData: ArrayBuffer[] = await Promise.all(
        files.map((filename) => Bun.file(`${inputPath}/${filename}`).arrayBuffer())
    );

    const objMap = new Map(files.map((filename, i) => [filename, load(filesData[i]) as RubyObject]));

    const lines = OrderedSet().asMutable() as OrderedSet<string>;
    const namesLines = OrderedSet().asMutable() as OrderedSet<string>;

    for (const [filename, obj] of objMap) {
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
    logString: string
): Promise<void> {
    const decoder = new TextDecoder();

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
            //Skipping first element in array as it is null
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

        await Bun.write(`${outputPath}/${processedFilename}.txt`, lines.join("\n"));
        await Bun.write(`${outputPath}/${processedFilename}_trans.txt`, "\n".repeat(lines.size ? lines.size - 1 : 0));
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
export async function readSystem(
    inputFilePath: string,
    outputPath: string,
    logging: boolean,
    logString: string
): Promise<void> {
    const decoder = new TextDecoder();

    const file = Bun.file(inputFilePath);
    const obj = load(await file.arrayBuffer()) as RubyObject;
    const type = inputFilePath.slice(inputFilePath.lastIndexOf(".") + 1, inputFilePath.length);

    const lines = OrderedSet().asMutable() as OrderedSet<string>;
    // rvdata2 contains elements, skill_types, weapon_types and armor_types arrays, that should be parsed
    // Along with currency unit string and terms object, that contains game terms and vocabulary
    if (type === "rvdata2") {
        const symbolDescs = ["@elements", "@skill_types", "@weapon_types", "@armor_types", "@currency_unit", "@terms"];

        const [elements, skillTypes, weaponTypes, armorTypes, currencyUnit, terms] = symbolDescs.map((desc) =>
            getValueBySymbolDesc(obj, desc)
        ) as [string[], string[], string[], string[], string, RubyObject];

        for (const arr of [elements, skillTypes, weaponTypes, armorTypes]) {
            for (const string of arr) {
                if (string.length > 0) {
                    lines.add(string);
                }
            }
        }

        if (currencyUnit.length > 0) {
            lines.add(currencyUnit);
        }

        const termsSymbols = Object.getOwnPropertySymbols(terms);

        for (let i = 0; i < termsSymbols.length; i++) {
            for (const string of terms[termsSymbols[i]] as string[]) {
                if (string.length > 0) {
                    lines.add(string);
                }
            }
        }
    }
    // Older version contain only terms (words in XP) object
    else {
        const symbolsDesc = type === "rvdata" ? "@terms" : "@words";

        const termsObj = getValueBySymbolDesc(obj, symbolsDesc) as RubyObject;
        const termsSymbols = Object.getOwnPropertySymbols(termsObj);

        for (let i = 0; i < termsSymbols.length; i++) {
            const value = termsObj[termsSymbols[i]];

            if (value instanceof Uint8Array) {
                const decoded = decoder.decode(value);

                if (decoded.length > 0) {
                    lines.add(decoded);
                }
            }
        }

        const elements = getValueBySymbolDesc(obj, "@elements") as Uint8Array[];

        for (const element of elements) {
            if (element instanceof Uint8Array) {
                const decoded = decoder.decode(element);

                if (decoded.length > 0) {
                    lines.add(decoded);
                }
            }
        }
    }

    // Every engine has game title string, that should be parsed
    const gameTitle = getValueBySymbolDesc(obj, "@game_title") as Uint8Array | string;
    if (typeof gameTitle === "string") {
        if (gameTitle.length > 0) {
            lines.add(gameTitle);
        }
    } else {
        const decoded = decoder.decode(gameTitle);

        if (decoded.length > 0) {
            lines.add(decoded);
        }
    }

    if (logging) {
        console.log(`${logString} ${file.name}`);
    }

    await Bun.write(`${outputPath}/system.txt`, lines.join("\n"));
    await Bun.write(`${outputPath}/system_trans.txt`, "\n".repeat(lines.size ? lines.size - 1 : 0));
}

/**
 * Reads Scripts .rx/rv/rvdata2 file from inputFilePath and parses it into .txt file in outputPath.
 * @param {string} inputFilePath - path to .rx/rv/rvdata2 file
 * @param {string} outputPath - path to output directory
 * @param {boolean} logging - whether to log or not
 * @param {string} logString - string to log
 * @returns {Promise<void>}
 */
export async function readScripts(
    inputFilePath: string,
    outputPath: string,
    logging: boolean,
    logString: string
): Promise<void> {
    const decoder = new TextDecoder();

    const file = Bun.file(inputFilePath);
    const uintarrArr = load(await file.arrayBuffer(), { string: "binary" }) as Uint8Array[][];

    const fullCode = [];
    for (let i = 0; i < uintarrArr.length; i++) {
        // To convert Ruby code to string, it needs to be inflated
        // Then we decode our inflated string to the actual UTF-8 encoded string
        // And then replace \r\ns with \#s, which are out custom newline marks
        const codeString = decoder.decode(inflate(uintarrArr[i][2])).replaceAll(/\r?\n/g, "\\#");
        fullCode.push(codeString);
    }

    if (logging) {
        console.log(`${logString} ${file.name}.`);
    }

    const joinedCode = fullCode.join("\n");
    await Bun.write(`${outputPath}/scripts.txt`, joinedCode);
    await Bun.write(`${outputPath}/scripts_trans.txt`, joinedCode);
}
