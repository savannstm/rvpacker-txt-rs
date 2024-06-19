import { readdir } from "node:fs/promises";
import { OrderedSet } from "immutable";
import { load } from "@hyrious/marshal";
import { inflate } from "pako";

import { getValueBySymbolDesc } from "./symbol-utils";

export async function readMap(inputDir: string, outputDir: string, logging: boolean, logString: string): Promise<void> {
    const decoder = new TextDecoder();

    const files = (await readdir(inputDir)).filter(
        (filename) => filename.startsWith("Map") && !filename.startsWith("MapInfos")
    );

    const filesData: ArrayBuffer[] = await Promise.all(
        files.map((filename) => Bun.file(`${inputDir}/${filename}`).arrayBuffer())
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
                    const code: number = getValueBySymbolDesc(item, "@code");
                    const parameters: (string | Uint8Array)[] | (string | Uint8Array)[][] = getValueBySymbolDesc(
                        item,
                        "@parameters"
                    );

                    for (const parameter of parameters as (string | Uint8Array)[]) {
                        if (code === 401) {
                            inSeq = true;

                            if (typeof parameter === "string" && parameter) {
                                line.push(parameter);
                            } else if (parameter instanceof Uint8Array) {
                                const decoded = decoder.decode(parameter);

                                if (decoded) {
                                    line.push(decoded);
                                }
                            }
                        } else {
                            if (inSeq) {
                                const lineJoined = line.join("\\#");

                                lines.add(lineJoined);
                                line.length = 0;
                                inSeq = false;
                            }

                            switch (code) {
                                case 102:
                                    if (Array.isArray(parameter)) {
                                        for (const param of parameter as (string | Uint8Array)[]) {
                                            if (typeof param === "string" && param) {
                                                lines.add(param);
                                            } else if (param instanceof Uint8Array) {
                                                const decoded = decoder.decode(param);

                                                if (decoded) {
                                                    lines.add(decoded);
                                                }
                                            }
                                        }
                                    }
                                    break;

                                case 356:
                                    if (typeof parameter === "string" && parameter) {
                                        lines.add(parameter);
                                    } else if (parameter instanceof Uint8Array) {
                                        const decoded = decoder.decode(parameter);

                                        if (decoded) {
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

    await Bun.write(`${outputDir}/maps.txt`, lines.join("\n"));
    await Bun.write(`${outputDir}/maps_trans.txt`, "\n".repeat(lines.size ? lines.size - 1 : 0));
    await Bun.write(`${outputDir}/names.txt`, namesLines.join("\n"));
    await Bun.write(`${outputDir}/names_trans.txt`, "\n".repeat(namesLines.size ? namesLines.size - 1 : 0));
}

export async function readOther(
    inputDir: string,
    outputDir: string,
    logging: boolean,
    logString: string
): Promise<void> {
    const decoder = new TextDecoder();

    const filesToFilter = ["Map", "Tilesets", "Animations", "States", "System", "Plugins", "Scripts", "Areas"];
    const filenames = (await readdir(inputDir)).filter((filename) => {
        return filesToFilter.some((file) => filename.startsWith(file)) ? false : true;
    });

    const filesData: ArrayBuffer[] = await Promise.all(
        filenames.map((filename) => Bun.file(`${inputDir}/${filename}`).arrayBuffer())
    );

    const objArrMap = new Map(filenames.map((filename, i) => [filename, load(filesData[i]) as RubyObject[]]));

    for (const [filename, objArr] of objArrMap) {
        const lines = OrderedSet().asMutable() as OrderedSet<string>;

        if (!filename.startsWith("Common") && !filename.startsWith("Troops")) {
            for (const obj of objArr.slice(1)) {
                const name: string | Uint8Array = getValueBySymbolDesc(obj, "@name");
                const nickname: string | Uint8Array = getValueBySymbolDesc(obj, "@nickname");
                const description: string | Uint8Array = getValueBySymbolDesc(obj, "@description");
                const note: string | Uint8Array = getValueBySymbolDesc(obj, "@note");

                if (typeof name === "string" && name) {
                    lines.add(name);
                } else if (name instanceof Uint8Array) {
                    const decoded = decoder.decode(name);

                    if (decoded) {
                        lines.add(decoded);
                    }
                }

                if (typeof nickname === "string" && nickname) {
                    lines.add(nickname);
                } else if (nickname instanceof Uint8Array) {
                    const decoded = decoder.decode(nickname);

                    if (decoded) {
                        lines.add(decoded);
                    }
                }

                if (typeof description === "string" && description) {
                    lines.add(description.replaceAll(/\r\n|\n/g, "\\#"));
                } else if (description instanceof Uint8Array) {
                    const decoded = decoder.decode(description);

                    if (decoded) {
                        lines.add(decoded.replaceAll(/\r\n|\n/g, "\\#"));
                    }
                }

                if (typeof note === "string" && note) {
                    lines.add(note.replaceAll(/\r\n|\n/g, "\\#"));
                } else if (note instanceof Uint8Array) {
                    const decoded = decoder.decode(note);

                    if (decoded) {
                        lines.add(decoded.replaceAll(/\r\n|\n/g, "\\#"));
                    }
                }
            }

            await Bun.write(
                `${outputDir}/${filename.toLowerCase().slice(0, filename.lastIndexOf("."))}.txt`,
                lines.join("\n")
            );
            await Bun.write(
                `${outputDir}/${filename.toLowerCase().slice(0, filename.lastIndexOf("."))}_trans.txt`,
                "\n".repeat(lines.size ? lines.size - 1 : 0)
            );
            continue;
        } else {
            for (const obj of objArr.slice(1)) {
                const pages: RubyObject[] = getValueBySymbolDesc(obj, "@pages");
                const pagesLength = pages ? pages.length : 1;

                for (let i = 0; i < pagesLength; i++) {
                    const list: RubyObject[] =
                        pagesLength > 1 ? getValueBySymbolDesc(pages[i], "@list") : getValueBySymbolDesc(obj, "@list");

                    if (!Array.isArray(list)) {
                        continue;
                    }

                    let inSeq: boolean = false;
                    const line: string[] = [];

                    for (const item of list) {
                        const code: number = getValueBySymbolDesc(item, "@code");
                        const parameters: (string | Uint8Array)[] | (string | Uint8Array)[][] = getValueBySymbolDesc(
                            item,
                            "@parameters"
                        );

                        for (const parameter of parameters as (string | Uint8Array)[]) {
                            if (code === 401 || code === 405) {
                                inSeq = true;

                                if (typeof parameter === "string" && parameter) {
                                    line.push(parameter);
                                } else if (parameter instanceof Uint8Array) {
                                    const decoded = decoder.decode(parameter);

                                    if (decoded) {
                                        line.push(decoded);
                                    }
                                }
                            } else {
                                if (inSeq) {
                                    const lineJoined = line.join("\\#");

                                    lines.add(lineJoined);
                                    line.length = 0;
                                    inSeq = false;
                                }

                                switch (code) {
                                    case 102:
                                        if (Array.isArray(parameter)) {
                                            for (const param of parameter as (string | Uint8Array)[]) {
                                                if (typeof param === "string" && param) {
                                                    lines.add(param);
                                                } else if (param instanceof Uint8Array) {
                                                    const decoded = decoder.decode(param);

                                                    if (decoded) {
                                                        lines.add(decoded);
                                                    }
                                                }
                                            }
                                        }
                                        break;

                                    case 356:
                                        if (typeof parameter === "string" && parameter) {
                                            lines.add(parameter);
                                        } else if (parameter instanceof Uint8Array) {
                                            const decoded = decoder.decode(parameter);

                                            if (decoded) {
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

        await Bun.write(
            `${outputDir}/${filename.toLowerCase().slice(0, filename.lastIndexOf("."))}.txt`,
            lines.join("\n")
        );

        await Bun.write(
            `${outputDir}/${filename.toLowerCase().slice(0, filename.lastIndexOf("."))}_trans.txt`,
            "\n".repeat(lines.size ? lines.size - 1 : 0)
        );
    }
}

export async function readSystem(
    inputFile: string,
    outputDir: string,
    logging: boolean,
    logString: string
): Promise<void> {
    const decoder = new TextDecoder();

    const obj = load(await Bun.file(inputFile).arrayBuffer()) as RubyObject;
    const type = inputFile.slice(inputFile.lastIndexOf(".") + 1);

    const lines = OrderedSet().asMutable() as OrderedSet<string>;
    if (type === "rvdata2") {
        const symbolDescs = ["@skill_types", "@weapon_types", "@armor_types", "@currency_unit", "@terms"];

        const [skillTypes, weaponTypes, armorTypes, currencyUnit, terms] = symbolDescs.map((desc) =>
            getValueBySymbolDesc(obj, desc)
        ) as [string[], string[], string[], string, RubyObject];

        for (const arr of [skillTypes, weaponTypes, armorTypes]) {
            for (const string of arr) {
                if (string) {
                    lines.add(string);
                }
            }
        }

        lines.add(currencyUnit);

        const termsSymbols = Object.getOwnPropertySymbols(terms);

        for (let i = 0; i < termsSymbols.length; i++) {
            for (const string of terms[termsSymbols[i]] as string[]) {
                if (string) {
                    lines.add(string);
                }
            }
        }
    } else {
        const symbolsDesc = type === "rvdata" ? "@terms" : "@words";

        const termsObj = getValueBySymbolDesc(obj, symbolsDesc) as RubyObject;
        const termsSymbols = Object.getOwnPropertySymbols(termsObj);

        for (let i = 0; i < termsSymbols.length; i++) {
            const value = termsObj[termsSymbols[i]];

            if (value instanceof Uint8Array) {
                const decoded = decoder.decode(value);

                if (decoded) {
                    lines.add(decoded);
                }
            }
        }

        const elements = getValueBySymbolDesc(obj, "@elements") as Uint8Array[];

        for (const element of elements) {
            if (element instanceof Uint8Array) {
                const decoded = decoder.decode(element);

                if (decoded) {
                    lines.add(decoded);
                }
            }
        }

        const gameTitle = getValueBySymbolDesc(obj, "@game_title") as Uint8Array;
        const decoded = decoder.decode(gameTitle);

        if (decoded) {
            lines.add(decoded);
        }
    }

    if (logging) {
        console.log(`${logString} system.txt`);
    }

    await Bun.write(`${outputDir}/system.txt`, lines.join("\n"));
    await Bun.write(`${outputDir}/system_trans.txt`, "\n".repeat(lines.size ? lines.size - 1 : 0));
}

export async function readScripts(
    inputFile: string,
    outputDir: string,
    logging: boolean,
    logString: string
): Promise<void> {
    const decoder = new TextDecoder();
    const uintarrArr = load(await Bun.file(inputFile).arrayBuffer(), { string: "binary" }) as Uint8Array[][];

    const fullCode = [];
    for (let i = 0; i < uintarrArr.length; i++) {
        const codeString = decoder.decode(inflate(uintarrArr[i][2])).replaceAll(/\r?\n/g, "\\#");
        fullCode.push(codeString);
    }

    if (logging) {
        console.log(`${logString} scripts.txt`);
    }

    const joinedCode = fullCode.join("\n");
    await Bun.write(`${outputDir}/scripts.txt`, joinedCode);
    await Bun.write(`${outputDir}/scripts_trans.txt`, joinedCode);
}
