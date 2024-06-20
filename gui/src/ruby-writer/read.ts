import { readDir, writeTextFile, readBinaryFile } from "@tauri-apps/api/fs";
import { OrderedSet } from "immutable";
import { load } from "@hyrious/marshal";
import { inflate } from "pako";

import { getValueBySymbolDesc } from "./symbol-utils";

export async function readMap(originalPath: string, outputPath: string): Promise<void> {
    const decoder = new TextDecoder();

    const re = /^Map[0-9].*(rxdata|rvdata|rvdata2)$/;
    const files = (await readDir(originalPath)).filter((filename) => re.test(filename.name!));

    const filesData: ArrayBuffer[] = await Promise.all(files.map((filename) => readBinaryFile(filename.path)));

    const objArr = filesData.map((data) => load(data, { string: "binary" }) as RubyObject);

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
    }

    await writeTextFile(`${outputPath}/maps.txt`, lines.join("\n"));
    await writeTextFile(`${outputPath}/maps_trans.txt`, "\n".repeat(lines.size ? lines.size - 1 : 0));
    await writeTextFile(`${outputPath}/names.txt`, namesLines.join("\n"));
    await writeTextFile(`${outputPath}/names_trans.txt`, "\n".repeat(namesLines.size ? namesLines.size - 1 : 0));
}

export async function readOther(originalPath: string, outputPath: string): Promise<void> {
    const decoder = new TextDecoder();

    const re = /^(?!Map|Tilesets|Animations|States|System|Scripts|Areas).*(rxdata|rvdata|rvdata2)$/;
    const filenames = (await readDir(originalPath)).filter((filename) => re.test(filename.name!));

    const filesData: ArrayBuffer[] = await Promise.all(filenames.map((filename) => readBinaryFile(filename.path)));

    const objArrMap = new Map(filenames.map((filename, i) => [filename.name!, load(filesData[i]) as RubyObject[]]));

    for (const [filename, objArr] of objArrMap) {
        const processed_filename = filename.toLowerCase().slice(0, filename.lastIndexOf("."));
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

            await writeTextFile(`${outputPath}/${processed_filename}.txt`, lines.join("\n"));
            await writeTextFile(
                `${outputPath}/${processed_filename}_trans.txt`,
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

        await writeTextFile(`${outputPath}/${processed_filename}.txt`, lines.join("\n"));
        await writeTextFile(
            `${outputPath}/${processed_filename}_trans.txt`,
            "\n".repeat(lines.size ? lines.size - 1 : 0)
        );
    }
}

export async function readSystem(systemPath: string, outputPath: string): Promise<void> {
    const decoder = new TextDecoder();

    const obj = load(await readBinaryFile(systemPath)) as RubyObject;
    const type = systemPath.slice(systemPath.lastIndexOf(".") + 1);

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

    await writeTextFile(`${outputPath}/system.txt`, lines.join("\n"));
    await writeTextFile(`${outputPath}/system_trans.txt`, "\n".repeat(lines.size ? lines.size - 1 : 0));
}

export async function readScripts(scriptsPath: string, outputPath: string): Promise<void> {
    const decoder = new TextDecoder();
    const uintarrArr = load(await readBinaryFile(scriptsPath), { string: "binary" }) as Uint8Array[][];

    const fullCode = [];
    for (let i = 0; i < uintarrArr.length; i++) {
        const codeString = decoder.decode(inflate(uintarrArr[i][2])).replaceAll(/\r?\n/g, "\\#");
        fullCode.push(codeString);
    }

    const joinedCode = fullCode.join("\n");
    await writeTextFile(`${outputPath}/scripts.txt`, joinedCode);
    await writeTextFile(`${outputPath}/scripts_trans.txt`, joinedCode);
}
