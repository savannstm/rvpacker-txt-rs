import { writeFileSync, readFileSync, readdirSync } from "fs";
import { OrderedSet } from "immutable";
import { load, dump } from "@hyrious/marshal";
import { inflateSync } from "zlib";

import { getValueBySymbolDesc } from "./symbol-utils";

export function readMap(inputDir: string, outputDir: string, logging: boolean, logString: string): void {
    const files = readdirSync(inputDir).filter(
        (filename) => filename.startsWith("Map") && !filename.startsWith("MapInfos")
    );

    const objMap = new Map(
        files.map((filename) => [filename, load(readFileSync(`${inputDir}/${filename}`)) as object])
    );

    const lines = OrderedSet().asMutable() as OrderedSet<string>;
    const namesLines = OrderedSet().asMutable() as OrderedSet<string>;

    for (const [filename, obj] of objMap) {
        const displayName = getValueBySymbolDesc(obj, "@display_name");

        if (displayName) {
            namesLines.add(displayName);
        }

        const events: object = getValueBySymbolDesc(obj, "@events");

        for (const event of Object.values(events || {})) {
            const pages: object[] = getValueBySymbolDesc(event, "@pages");
            if (!pages) {
                continue;
            }

            for (const page of pages) {
                let inSeq: boolean = false;
                const line: string[] = [];
                const list: object[] = getValueBySymbolDesc(page, "@list");

                for (const item of list) {
                    const code: number = getValueBySymbolDesc(item, "@code");
                    const parameters: string[] = getValueBySymbolDesc(item, "@parameters");

                    for (const parameter of parameters) {
                        if (code === 401) {
                            inSeq = true;

                            if (typeof parameter === "string") {
                                line.push(parameter);
                            }
                        } else {
                            if (inSeq) {
                                const lineJoined = line.join("\\n");

                                lines.add(lineJoined);
                                line.length = 0;
                                inSeq = false;
                            }

                            switch (code) {
                                case 102:
                                    if (Array.isArray(parameter)) {
                                        for (const param of parameter) {
                                            if (typeof param === "string") {
                                                lines.add(param);
                                            }
                                        }
                                    }
                                    break;

                                case 356:
                                    if (
                                        typeof parameter === "string" &&
                                        parameter.startsWith("GabText") &&
                                        parameter.startsWith("choice_text") &&
                                        !parameter.endsWith("????")
                                    ) {
                                        lines.add(parameter);
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

    writeFileSync(`${outputDir}/maps.txt`, lines.join("\n"), "utf8");
    writeFileSync(`${outputDir}/maps_trans.txt`, "\n".repeat(lines.size - 1), "utf8");
    writeFileSync(`${outputDir}/names.txt`, namesLines.join("\n"), "utf8");
    writeFileSync(`${outputDir}/names_trans.txt`, "\n".repeat(namesLines.size - 1), "utf8");
}

export function readOther(inputDir: string, outputDir: string, logging: boolean, logString: string): void {
    const filenames = readdirSync(inputDir).filter((filename: string) => {
        const files = ["Map", "Tilesets", "Animations", "States", "System", "Plugins", "Scripts"];
        return files.some((file) => filename.startsWith(file)) ? false : true;
    });

    const objArrMap = new Map(
        filenames.map((filename) => [filename, load(readFileSync(`${inputDir}/${filename}`)) as object[]])
    );

    for (const [filename, objArr] of objArrMap) {
        const lines = OrderedSet().asMutable() as OrderedSet<string>;

        if (!filename.startsWith("Common") && !filename.startsWith("Troops")) {
            for (const obj of objArr.slice(1)) {
                const name: string = getValueBySymbolDesc(obj, "@name");
                const description: string = getValueBySymbolDesc(obj, "@description");
                const note: string = getValueBySymbolDesc(obj, "@note");

                if (typeof name === "string" && name) {
                    lines.add(name);
                }

                if (typeof description === "string" && description) {
                    lines.add(description.replaceAll("\n", "\\n"));
                }

                if (typeof note === "string" && note) {
                    lines.add(note.replaceAll("\r\n", "\\r\\n").replaceAll("\n", "\\n"));
                }
            }

            writeFileSync(
                `${outputDir}/${filename.toLowerCase().slice(0, filename.lastIndexOf("."))}.txt`,
                lines.join("\n"),
                "utf8"
            );
            writeFileSync(
                `${outputDir}/${filename.toLowerCase().slice(0, filename.lastIndexOf("."))}_trans.txt`,
                "\n".repeat(lines.size - 1),
                "utf8"
            );
            continue;
        } else {
            for (const obj of objArr.slice(1)) {
                const pages: object[] = getValueBySymbolDesc(obj, "@pages");
                const pagesLength = pages ? pages.length : 1;

                for (let i = 0; i < pagesLength; i++) {
                    const list: object[] =
                        pagesLength > 1 ? getValueBySymbolDesc(pages[i], "@list") : getValueBySymbolDesc(obj, "@list");

                    if (!Array.isArray(list)) {
                        continue;
                    }

                    let inSeq: boolean = false;
                    const line: string[] = [];

                    for (const item of list) {
                        const code: number = getValueBySymbolDesc(item, "@code");
                        const parameters: string[] = getValueBySymbolDesc(item, "@parameters");

                        for (const parameter of parameters) {
                            if (code === 401 || code === 405) {
                                inSeq = true;

                                if (typeof parameter === "string") {
                                    line.push(parameter);
                                }
                            } else {
                                if (inSeq) {
                                    const lineJoined = line.join("\\n");

                                    lines.add(lineJoined);
                                    line.length = 0;
                                    inSeq = false;
                                }

                                switch (code) {
                                    case 102:
                                        if (Array.isArray(parameter)) {
                                            for (const param in parameter) {
                                                if (typeof param === "string") {
                                                    lines.add(param);
                                                }
                                            }
                                        }
                                        break;

                                    case 356:
                                        if (
                                            typeof parameter === "string" &&
                                            parameter.startsWith("GabText") &&
                                            parameter.startsWith("choice_text") &&
                                            !parameter.endsWith("????")
                                        ) {
                                            lines.add(parameter);
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

        writeFileSync(
            `${outputDir}/${filename.toLowerCase().slice(0, filename.lastIndexOf("."))}.txt`,
            lines.join("\n"),
            "utf8"
        );

        writeFileSync(
            `${outputDir}/${filename.toLowerCase().slice(0, filename.lastIndexOf("."))}_trans.txt`,
            "\n".repeat(lines.size - 1),
            "utf8"
        );
    }
}

export function readSystem(inputDir: string, outputDir: string, logging: boolean, logString: string): void {
    const systemPath = `${inputDir}/System.rvdata2`;
    const obj = load(readFileSync(systemPath)) as object;

    const lines = OrderedSet().asMutable() as OrderedSet<string>;
    const symbols = ["@skill_types", "@weapon_types", "@armor_types", "@currency_unit", "@terms"];

    const [skillTypes, weaponTypes, armorTypes, currencyUnit, terms] = symbols.map((symbol) =>
        getValueBySymbolDesc(obj, symbol)
    );

    for (const arr of [skillTypes, weaponTypes, armorTypes]) {
        for (const element of arr) {
            if (element) {
                lines.add(element);
            }
        }
    }

    lines.add(currencyUnit);

    const termsSymbols = Object.getOwnPropertySymbols(terms);

    for (let i = 0; i < termsSymbols.length; i++) {
        for (const element of terms[termsSymbols[i]] as string[]) {
            if (element) {
                lines.add(element);
            }
        }
    }

    if (logging) {
        console.log(`${logString} system.txt`);
    }

    writeFileSync(`${outputDir}/system.txt`, lines.join("\n"), "utf8");
    writeFileSync(`${outputDir}/system_trans.txt`, "\n".repeat(lines.size - 1), "utf8");
}

export function readScripts(inputDir: string, outputDir: string, logging: boolean, logString: string): void {
    const scriptsPath = `${inputDir}/Scripts.rvdata2`;
    const json = load(readFileSync(scriptsPath), { string: "binary" }) as string[][];

    const fullCode = [];
    for (const [magic, title, code] of json) {
        const codeString = inflateSync(code).toString("utf8").replace(/\r?\n/g, "\\n");
        fullCode.push(codeString);
    }

    console.log(fullCode.length);

    writeFileSync(`${outputDir}/scripts.txt`, dump(fullCode.join("\n")), "utf8");
    writeFileSync(`${outputDir}/scripts_trans.txt`, dump(fullCode.join("\n")), "utf8");
}
