import { writeFileSync, readFileSync } from "fs";
import { dump } from "@hyrious/marshal";

function getSymbolByDesc(collection: object, description: string) {
    if (!collection) {
        return null;
    }

    const symbols = Object.getOwnPropertySymbols(collection);

    for (const symbol of symbols) {
        if (symbol.description === description) {
            return collection[symbol];
        }
    }
}

function setSymbolByDesc(collection: any, description: string, newValue: any) {
    const symbols = Object.getOwnPropertySymbols(collection);

    for (const symbol of symbols) {
        if (symbol.description === description) {
            collection[symbol] = newValue;
        }
    }
}

function mergeSeq(json: any) {
    let first: null | number = null;
    let number: number = -1;
    let prev: boolean = false;
    const stringArray: string[] = [];

    for (let i = 0; i < json.length; i++) {
        const object = json[i];
        const code = getSymbolByDesc(object, "@code");

        if (code === 401) {
            if (first === null) {
                first = i;
            }

            number += 1;
            stringArray.push(getSymbolByDesc(object, "@parameters")[0]);
            prev = true;
        } else if (i > 0 && prev && first !== null && number !== -1) {
            const newParameters = getSymbolByDesc(json[first], "@parameters");
            newParameters[0] = stringArray.join("\n");
            setSymbolByDesc(json[first], "@parameters", newParameters);

            const startIndex = first + 1;
            const itemsToDelete = startIndex + number;
            json.splice(startIndex, itemsToDelete);

            stringArray.length = 0;
            i -= number;
            number = -1;
            first = null;
            prev = false;
        }
    }

    return json;
}

export function mergeMap(json: any) {
    for (const event of Object.values(getSymbolByDesc(json, "@events") || [])) {
        if (!getSymbolByDesc(event, "@pages")) continue;

        for (const page of getSymbolByDesc(event, "@pages")) {
            setSymbolByDesc(page, "@list", mergeSeq(getSymbolByDesc(page, "@list")));
        }
    }

    return json;
}

export function mergeOther(json: any) {
    for (const element of json) {
        if (Array.isArray(getSymbolByDesc(element, "@pages"))) {
            for (const page of getSymbolByDesc(element, "@pages")) {
                setSymbolByDesc(page, "@list", mergeSeq(getSymbolByDesc(page, "@list")));
            }
        } else if (Array.isArray(getSymbolByDesc(element, "@list"))) {
            setSymbolByDesc(element, "@list", mergeSeq(getSymbolByDesc(element, "@list")));
        }
    }

    return json;
}

export function writeMap(json: any, outputDir: string, textMap: Map<string, string>, namesMap: Map<string, string>) {
    for (const [f, file] of json) {
        if (namesMap.has(getSymbolByDesc(file, "@display_name"))) {
            setSymbolByDesc(file, "@display_name", namesMap.get(getSymbolByDesc(file, "@display_name"))!);
        }

        for (const event of Object.values(getSymbolByDesc(file, "@events") || []).slice(1)) {
            if (!getSymbolByDesc(event, "@pages")) {
                return;
            }

            for (const page of getSymbolByDesc(event, "@pages")) {
                for (const list of getSymbolByDesc(page, "@list") || []) {
                    const code: number = getSymbolByDesc(list, "@code");

                    for (const [i, parameter] of getSymbolByDesc(list, "@parameters").entries() as [number, string][]) {
                        if (typeof parameter === "string") {
                            if (
                                [401, 402, 324].includes(code) ||
                                (code === 356 &&
                                    (parameter.startsWith("GabText") ||
                                        (parameter.startsWith("choice_text") && !parameter.endsWith("????"))))
                            ) {
                                if (textMap.has(parameter)) {
                                    const newParameters = getSymbolByDesc(list, "@parameters");
                                    newParameters[i] = textMap.get(parameter);
                                    setSymbolByDesc(list, "@parameters", newParameters);
                                }
                            }
                        } else if (code == 102 && Array.isArray(parameter)) {
                            for (const [j, param] of (parameter as string[]).entries()) {
                                if (typeof param === "string") {
                                    if (textMap.has(param.replaceAll("\\n[", "\\N["))) {
                                        const newParameters = getSymbolByDesc(list, "@parameters");
                                        newParameters[i][j] = textMap.get(param.replaceAll("\\n[", "\\N["));

                                        setSymbolByDesc(list, "@parameters", newParameters);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        writeFileSync(`${outputDir}/${f}`, dump(file));
    }
}

export function writeOther(json: any, outputDir: string, otherDir: string) {
    for (const [f, file] of json) {
        const otherOriginalText: string[] = readFileSync(`${otherDir}/${f.slice(0, f.lastIndexOf("."))}.txt`, "utf8")
            .split("\n")
            .map((l: string) => l.replaceAll("\\n", "\n"));

        const otherTranslatedText: string[] = readFileSync(
            `${otherDir}/${f.slice(0, f.lastIndexOf("."))}_trans.txt`,
            "utf8"
        )
            .split("\n")
            .map((l: string) => l.replaceAll("\\n", "\n"));

        const map: Map<string, string> = new Map();

        for (let i = 0; i < otherOriginalText.length; i++) {
            map.set(otherOriginalText[i], otherTranslatedText[i]);
        }

        if (f !== "Commonevents.rvdata2" && f != "Troops.rvdata2") {
            for (const element of file) {
                if (map.has(getSymbolByDesc(element, "@name"))) {
                    setSymbolByDesc(element, "@name", map.get(getSymbolByDesc(element, "@name")));
                }

                if (typeof getSymbolByDesc(element, "@description") === "string") {
                    if (map.has(getSymbolByDesc(element, "@description"))) {
                        setSymbolByDesc(element, "@description", map.get(getSymbolByDesc(element, "@description")));
                    }
                }

                if (f === "Classes.rvdata2") {
                    if (map.has(getSymbolByDesc(element, "@note"))) {
                        setSymbolByDesc(element, "@note", map.get(getSymbolByDesc(element, "@note")));
                    }
                } else if (f === "Items.json") {
                    //! Need to define custom logic for items's note
                }
            }
        } else {
            for (const element of file.slice(1)) {
                const pagesLength = f == "Troops.rvdata2" ? getSymbolByDesc(element, "@pages").length : 1;

                for (let i = 0; i < pagesLength; i++) {
                    const iterableObject =
                        f == "Troops.rvdata2"
                            ? getSymbolByDesc(getSymbolByDesc(element, "@pages")[i], "@list")
                            : getSymbolByDesc(element, "@list");

                    if (!Array.isArray(iterableObject)) {
                        for (const list of iterableObject) {
                            const code = getSymbolByDesc(list, "@code");

                            for (const [i, parameter] of getSymbolByDesc(list, "@parameters").entries()) {
                                if (typeof parameter === "string") {
                                    if (
                                        [401, 402, 324].includes(code) ||
                                        (code === 356 &&
                                            (parameter.startsWith("GabText") ||
                                                (parameter.startsWith("choice_text") && !parameter.endsWith("????"))))
                                    ) {
                                        if (map.has(parameter)) {
                                            const newParameters = getSymbolByDesc(list, "@parameters");
                                            newParameters[i] = map.get(parameter);

                                            setSymbolByDesc(list, "@parameters", newParameters);
                                        }
                                    }
                                } else if (code === 102 && Array.isArray(parameter)) {
                                    for (const [j, param] of (parameter as string[]).entries()) {
                                        if (typeof param === "string") {
                                            if (map.has(param.replaceAll("\\n[", "\\N["))) {
                                                const newParameters = getSymbolByDesc(list, "@parameters");
                                                newParameters[i][j] = map.get(param.replaceAll("\\n[", "\\N["));

                                                setSymbolByDesc(list, "@parameters", newParameters);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        writeFileSync(`${outputDir}/${f}`, dump(file));
    }
}

export function writeSystem(json: any, outputDir: string, systemTextMap: Map<string, string>) {
    const symbols = ["@skill_types", "@weapon_types", "@armor_types", "@currency_unit", "@terms"];
    const arrays = [
        getSymbolByDesc(json, symbols[0]),
        getSymbolByDesc(json, symbols[1]),
        getSymbolByDesc(json, symbols[2]),
    ];

    for (const [i, arr] of arrays.entries()) {
        for (const [j, element] of arr.entries()) {
            if (element.length !== 0) {
                if (systemTextMap.has(element)) {
                    const newArr = arr;
                    newArr[j] = systemTextMap.get(element);

                    setSymbolByDesc(json, symbols[i], newArr);
                }
            }
        }
    }

    setSymbolByDesc(json, getSymbolByDesc(json, symbols[3]), systemTextMap.get(getSymbolByDesc(json, symbols[3])));

    for (const obj of Object.values(getSymbolByDesc(json, symbols[4]))) {
        const newObj = obj;

        for (const [j, value] of Object.values(obj).entries()) {
            if (typeof value === "string") {
                if (systemTextMap.has(value)) {
                    newObj[j] = systemTextMap.get(value);
                }
            }
        }

        setSymbolByDesc(json, symbols[4], newObj);
    }

    writeFileSync(`${outputDir}/System.rvdata2`, dump(json));
}
