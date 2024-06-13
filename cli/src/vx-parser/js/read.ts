import { writeFileSync, readFileSync, readdirSync } from "fs";
import { OrderedSet } from "immutable";

export function readMap(inputDir: string, outputDir: string) {
    const files = readdirSync(inputDir).filter((f: string) => f.startsWith("Map"));

    const jsonData: Map<string, RubyMap> = new Map();

    for (const file of files) {
        jsonData.set(file, JSON.parse(readFileSync(`${inputDir}/${file}`, "utf8")));
    }

    const lines: OrderedSet<string> = OrderedSet().asMutable() as OrderedSet<string>;

    for (const [filename, json] of jsonData.entries()) {
        for (const event of Object.values(json?.events || {})) {
            if (!event) continue;

            for (const page of event.pages) {
                let inSeq: boolean = false;
                const line: string[] = [];

                for (const list of page.list) {
                    const code = list.code;

                    for (const parameter of list.parameters) {
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
                                        for (const param in parameter) {
                                            if (typeof param === "string") {
                                                lines.add(param);
                                            }
                                        }
                                    }
                                    break;

                                case 356:
                                    if (typeof parameter === "string") {
                                        if (
                                            parameter.startsWith("GabText") &&
                                            parameter.startsWith("choice_text") &&
                                            !parameter.endsWith("????")
                                        ) {
                                            lines.add(parameter);
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

    writeFileSync(`${outputDir}/maps.txt`, lines.join("\n"), "utf8");
}

export function readOther(inputDir: string, outputDir: string) {
    const files: string[] = readdirSync(inputDir).filter((f: string) => {
        const filenames: string[] = ["Map", "Tilesets", "Animations", "States", "System", "Plugins"];

        for (const filename of filenames) {
            if (f.startsWith(filename)) {
                return false;
            }
        }

        return true;
    });

    const jsonData: Map<string, RubyItem | RubyPage[]> = new Map();

    for (const file of files) {
        jsonData.set(file, JSON.parse(readFileSync(`${inputDir}/${file}`, "utf8")));
    }

    for (const [filename, json] of jsonData.entries()) {
        const lines: OrderedSet<string> = OrderedSet().asMutable() as OrderedSet<string>;

        if (filename !== "CommonEvents.json" && filename != "Troops.json") {
            for (const obj of json as unknown as RubyItem[]) {
                if (typeof obj?.name === "string") {
                    if (obj.name.length !== 0) {
                        lines.add(obj.name);
                    }
                }

                if (typeof obj?.description === "string") {
                    if (obj.description.length !== 0) {
                        lines.add(obj.description.replaceAll("\n", "\\n"));
                    }
                }

                if (typeof obj?.note === "string") {
                    if (obj.note.length !== 0) {
                        lines.add(obj.note.replaceAll("\r\n", "\\r\\n").replaceAll("\n", "\\n"));
                    }
                }
            }

            writeFileSync(`${outputDir}/${filename.replace(".json", ".txt").toLowerCase()}`, lines.join("\n"), "utf8");

            continue;
        }

        const jsonCasted = filename === "CommonEvents.json" ? (json as unknown as RubyEvent[]) : (json as RubyPage[]);

        for (const obj of jsonCasted) {
            const pagesLength: number = Array.isArray(obj?.pages) ? obj.pages.length : 1;

            for (let i = 0; i < pagesLength; i++) {
                const iterableObject = pagesLength !== 1 ? obj.pages[i].list : obj?.list;

                if (!Array.isArray(iterableObject)) continue;

                let inSeq = false;
                const line: string[] = [];

                for (const list of iterableObject) {
                    const code = list.code;

                    for (const parameter of list.parameters) {
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
                                        for (const param in parameter) {
                                            if (typeof param === "string") {
                                                lines.add(param);
                                            }
                                        }
                                    }
                                    break;

                                case 356:
                                    if (typeof parameter === "string") {
                                        if (
                                            parameter.startsWith("GabText") &&
                                            parameter.startsWith("choice_text") &&
                                            !parameter.endsWith("????")
                                        ) {
                                            lines.add(parameter);
                                        }
                                    }
                                    break;

                                case 405:
                                    if (typeof parameter === "string") {
                                        lines.add(parameter);
                                    }
                                    break;
                            }
                        }
                    }
                }
            }

            writeFileSync(`${outputDir}/${filename.replace(".json", ".txt").toLowerCase()}`, lines.join("\n"), "utf8");
        }
    }
}

interface RubySystem {
    skill_types: string[];
    weapon_types: string[];
    armor_types: string[];
    currency_unit: string;
    terms: { [key: string]: string[] };
}

export function readSystem(inputDir: string, outputDir: string) {
    const systemPath = `${inputDir}/System.json`;

    const json: RubySystem = JSON.parse(readFileSync(systemPath, "utf8"));

    const lines = OrderedSet().asMutable();

    for (const arr of [json?.skill_types, json?.weapon_types, json?.armor_types, json?.currency_unit]) {
        for (const element of arr) {
            if (typeof element === "string") {
                if (element.length !== 0) {
                    lines.add(element);
                }
            }
        }
    }

    for (const arr of Object.values(json.terms)) {
        for (const element of arr) {
            if (typeof element === "string") {
                if (element.length !== 0) {
                    lines.add(element);
                }
            }
        }
    }

    writeFileSync(`${outputDir}/system.txt`, lines.join("\n"), "utf8");
}
