const { ensureDirSync, readFileSync, writeFileSync, readdirSync } = require("fs-extra");
const { join } = require("path");

function merge401(array) {
    let first = undefined;
    let number = -1;
    let prevIs401 = false;
    const newString = [];

    for (let i = 0; i < array.length; i++) {
        const object = array[i];
        const code = object.code;

        if (code === 401) {
            if (!first) first = i;
            number++;
            newString.push(object.parameters[0]);
            prevIs401 = true;
        } else if (i > 0 && prevIs401 && first) {
            array[first].parameters[0] = newString.join("\n");
            array.splice(first + 1, number);
            newString.length = 0;
            i -= number;
            number = -1;
            first = undefined;
            prevIs401 = false;
        }
    }
    return array;
}

function mergeMap401(file) {
    const outputJSON = JSON.parse(readFileSync(file, "utf8"));

    for (const [ev, event] of outputJSON?.events?.entries() || []) {
        for (const [pg, page] of event?.pages?.entries() || []) {
            outputJSON.events[ev].pages[pg].list = merge401(page.list);
        }
    }
    return outputJSON;
}

function mergeOther401(file) {
    const outputJSON = JSON.parse(readFileSync(file, "utf8"));

    for (const element of outputJSON) {
        if (element?.pages) {
            for (const [pg, page] of element.pages.entries()) {
                element.pages[pg].list = merge401(page.list);
            }
        } else {
            if (element?.list) {
                element.list = merge401(element.list);
            }
        }
    }
    return outputJSON;
}

const dirPaths = {
    original: join(__dirname, "../../../../original"),
    output: join(__dirname, "../../../../data"),
    maps: join(__dirname, "../../../../copies/maps/maps.txt"),
    mapsTrans: join(__dirname, "../../../../copies/maps/maps_trans.txt"),
    names: join(__dirname, "../../../../copies/maps/names.txt"),
    namesTrans: join(__dirname, "../../../../copies/maps/names_trans.txt"),
    other: join(__dirname, "../../../../copies/other"),
    plugins: join(__dirname, "../../../../translation/plugins"),
};

const mapsJSON = readdirSync(dirPaths.original)
    .filter((file) => {
        return file.startsWith("Map");
    })
    .map((file) => {
        return mergeMap401(join(dirPaths.original, file));
    });

const otherJSON = readdirSync(dirPaths.original)
    .filter((file) => {
        const prefixes = ["Map", "Tilesets", "Animations", "States", "System"];
        return !prefixes.some((prefix) => file.startsWith(prefix));
    })
    .map((file) => {
        return mergeOther401(join(dirPaths.original, file));
    });

const systemJSON = JSON.parse(readFileSync(join(dirPaths.original, "System.json"), "utf8"));

function extractPluginsJSON() {
    const pluginsPath = join(dirPaths.plugins, "plugins.js");
    const fileContent = readFileSync(pluginsPath, "utf8").split("\n");
    const newString = [];

    for (let i = 3; i < fileContent.length - 1; i++) {
        newString.push(fileContent[i]);
    }

    return newString.join("").slice(0, -1);
}

const pluginsJSON = JSON.parse(extractPluginsJSON());
writeFileSync(join(__dirname, "plugins.json"), JSON.stringify(pluginsJSON), "utf8");

function isUselessLine(line) {
    const uselessLines = [
        "gfx",
        "WakeUP",
        "LegHURT",
        "smokePipe",
        "DEFAULT CHARACTER",
        "RITUAL CIRCLE",
        "GameOver",
        "deathCheck",
        "REMOVEmembers",
        "Beartrap",
        "TransferSTATStoFUSION",
        "PartyREARRANGE",
        "SKILLSdemonSeedAVAILABLE",
        "TransferSKILLStoMARRIAGE",
        "counter-magic Available?",
        "greater magic Available?",
        "Blood sacrifice Available?",
        "Back from Mahabre",
        "BLINDNESS?",
        "Crippled?",
        "WhileBackstab",
        "TransferSTATStoMARRIAGE",
    ];
    const prefixes = ["//", "??", "RANDOM", "Empty scroll", "TALK"];

    return (
        line.includes("_") ||
        line.includes("---") ||
        /\d$|[A-Z\s]+$|[A-Z]+$/.test(line) ||
        uselessLines.includes(line) ||
        prefixes.some((prefix) => line.startsWith(prefix))
    );
}

function writeMaps(files, originalTextFile, translatedTextFile) {
    const filenames = readdirSync(dirPaths.original).filter((file) => {
        return file.startsWith("Map");
    });

    const originalText = readFileSync(originalTextFile, "utf8").split("\n");
    const translatedText = readFileSync(translatedTextFile, "utf8").split("\n");
    const textHashMap = new Map(
        originalText.map((item, i) => [
            item.replaceAll("\\n[", "\\N[").replaceAll("\\n", "\n"),
            translatedText[i].replaceAll("\\n", "\n").trim(),
        ])
    );

    const originalNames = readFileSync(dirPaths.names, "utf8").split("\n");
    const translatedNames = readFileSync(dirPaths.namesTrans, "utf8").split("\n");
    const namesHashMap = new Map(originalNames.map((item, i) => [item.trim(), translatedNames[i].trim()]));

    for (const [f, file] of files.entries()) {
        const outputJSON = file;
        const outputDir = dirPaths.output;

        ensureDirSync(outputDir);

        const outputPath = join(outputDir, filenames[f]);
        const locationName = outputJSON?.displayName;

        if (namesHashMap.has(locationName)) {
            outputJSON.displayName = namesHashMap.get(locationName);
        }

        for (const event of outputJSON?.events || []) {
            for (const page of event?.pages || []) {
                for (const item of page.list) {
                    const code = item.code;

                    for (const [pr, parameter] of item.parameters.entries()) {
                        const parameterText =
                            !Array.isArray(parameter) && typeof parameter === "string"
                                ? parameter.replaceAll("\\n[", "\\N[")
                                : undefined;

                        switch (parameterText) {
                            case undefined:
                                if (code === 102 && Array.isArray(parameter)) {
                                    for (const [p, param] of parameter.entries()) {
                                        if (typeof param === "string") {
                                            const paramText = param.replaceAll("\\n[", "\\N[");

                                            if (textHashMap.has(paramText)) {
                                                item.parameters[pr][p] = textHashMap.get(paramText);
                                            }
                                        }
                                    }
                                }
                                break;
                            default:
                                if (
                                    code === 401 ||
                                    code === 402 ||
                                    code === 324 ||
                                    (code === 356 &&
                                        (parameterText.startsWith("GabText") ||
                                            (parameterText.startsWith("choice_text") &&
                                                !parameterText.endsWith("????"))))
                                ) {
                                    if (textHashMap.has(parameterText)) {
                                        item.parameters[pr] = textHashMap.get(parameterText);
                                    }
                                }
                                break;
                        }
                    }
                }
            }
        }
        writeFileSync(outputPath, JSON.stringify(outputJSON), "utf8");
    }
    return;
}

function writeOther(files, originalTextFile, translatedTextFile) {
    const filenames = readdirSync(dirPaths.original).filter((file) => {
        const prefixes = ["Map", "Tilesets", "Animations", "States", "System"];
        return !prefixes.some((prefix) => file.startsWith(prefix));
    });

    const originalText = readdirSync(originalTextFile)
        .map((entry) => {
            if (entry.endsWith("_trans.txt") || entry.startsWith("System")) return undefined;
            return readFileSync(join(originalTextFile, entry), "utf8").split("\n");
        })
        .filter((element) => element !== undefined);

    const translatedText = readdirSync(translatedTextFile)
        .map((entry) => {
            if (!entry.endsWith("_trans.txt") || entry.startsWith("System")) return undefined;
            return readFileSync(join(translatedTextFile, entry), "utf8").split("\n");
        })
        .filter((element) => element !== undefined);

    for (const [f, file] of files.entries()) {
        const outputJSON = file;
        const outputDir = dirPaths.output;

        const hashMap = new Map(
            originalText[f].map((item, i) => [
                item.replaceAll("\\n", "\n"),
                translatedText[f][i].replaceAll("\\n", "\n"),
            ])
        );
        ensureDirSync(outputDir);

        const outputPath = join(outputDir, filenames[f]);

        for (const element of outputJSON) {
            if (!element) continue;

            if (!element.pages) {
                if (!element.list) {
                    const attributes = ["name", "description", "note"];
                    const prefixes = [
                        "Alchem",
                        "Recipes",
                        "Rifle",
                        "NLU",
                        "The Last",
                        "Soldier's",
                        "The Tale",
                        "Half-Cocooned",
                        "Ratkin",
                    ];

                    for (const attr of attributes) {
                        if (
                            element[attr] &&
                            (attr === "note" ||
                                !isUselessLine(element[attr]) ||
                                element[attr].endsWith("phobia") ||
                                prefixes.some((prefix) => element[attr].startsWith(prefix)))
                        ) {
                            if (hashMap.has(element[attr])) {
                                element[attr] = hashMap.get(element[attr]);
                            }
                        }
                    }
                } else {
                    const name = element.name;

                    if (name && !isUselessLine(name)) {
                        if (hashMap.has(name)) {
                            element.name = hashMap.get(name);
                        }
                    }
                }
            }

            const pagesLength = element.pages !== undefined ? element.pages.length : 1;

            for (let i = 0; i < pagesLength; i++) {
                const iterableObj = pagesLength !== 1 ? element.pages[i] : element;

                for (const list of iterableObj.list || []) {
                    const code = list.code;

                    for (const [pr, parameter] of list.parameters.entries()) {
                        const parameterText =
                            !Array.isArray(parameter) && typeof parameter === "string"
                                ? parameter.replaceAll("\\n[", "\\N[")
                                : undefined;

                        switch (parameterText) {
                            case undefined:
                                if (code === 102 && Array.isArray(parameter)) {
                                    for (const [p, param] of parameter.entries()) {
                                        if (typeof param === "string") {
                                            const paramText = param.replaceAll("\\n[", "\\N[");

                                            if (hashMap.has(paramText)) {
                                                list.parameters[pr][p] = hashMap.get(paramText);
                                            }
                                        }
                                    }
                                }
                                break;
                            default:
                                if (
                                    code === 401 ||
                                    code === 402 ||
                                    code === 108 ||
                                    (code === 356 &&
                                        (parameterText.startsWith("choice_text") ||
                                            parameterText.startsWith("GabText")) &&
                                        !parameterText.endsWith("????"))
                                ) {
                                    if (hashMap.has(parameterText)) {
                                        list.parameters[pr] = hashMap.get(parameterText);
                                    }
                                }
                                break;
                        }
                    }
                }
            }
        }
        writeFileSync(outputPath, JSON.stringify(outputJSON), "utf8");
    }
    return;
}

function writeSystem(file, originalTextFile, translatedTextFile) {
    const outputJSON = file;
    const originalText = readFileSync(originalTextFile, "utf8").split("\n");
    const translatedText = readFileSync(translatedTextFile, "utf8").split("\n");
    const hashMap = new Map(originalText.map((item, i) => [item, translatedText[i]]));

    for (const [el, element] of outputJSON.equipTypes.entries()) {
        if (element && hashMap.has(element)) {
            outputJSON.equipTypes[el] = hashMap.get(element);
        }
    }

    for (const [el, element] of outputJSON.skillTypes.entries()) {
        if (element && hashMap.has(element)) {
            outputJSON.skillTypes[el] = hashMap.get(element);
        }
    }

    for (const [el, element] of outputJSON.variables.entries()) {
        if (element.endsWith("phobia")) {
            if (hashMap.has(element)) {
                outputJSON.variables[el] = hashMap.get(element);
            }
            if (element === "Panophobia") {
                break;
            }
        }
    }

    for (const key in outputJSON.terms) {
        if (key !== "messages") {
            for (const [i, str] of outputJSON.terms[key].entries()) {
                if (str && hashMap.has(str)) {
                    outputJSON.terms[key][i] = hashMap.get(str);
                }
            }
        } else {
            for (const messageKey in outputJSON.terms.messages) {
                const message = outputJSON.terms.messages[messageKey];

                if (message && hashMap.has(message)) {
                    outputJSON.terms.messages[messageKey] = hashMap.get(message);
                }
            }
        }
    }

    writeFileSync(join(dirPaths.output, "System.json"), JSON.stringify(outputJSON), "utf8");
    return;
}

function writePlugins(file, originalTextFile, translatedTextFile) {
    const outputJSON = file;
    const originalText = Array.from(new Set(readFileSync(originalTextFile, "utf8").split("\n")));
    const translatedText = Array.from(new Set(readFileSync(translatedTextFile, "utf8").split("\n")));
    const hashMap = new Map(originalText.map((item, i) => [item, translatedText[i]]));

    for (const obj of outputJSON) {
        const name = obj.name;
        const pluginNames = new Set([
            "YEP_BattleEngineCore",
            "YEP_OptionsCore",
            "SRD_NameInputUpgrade",
            "YEP_KeyboardConfig",
            "YEP_ItemCore",
            "YEP_X_ItemDiscard",
            "YEP_EquipCore",
            "YEP_ItemSynthesis",
            "ARP_CommandIcons",
            "YEP_X_ItemCategories",
            "Olivia_OctoBattle",
        ]);

        if (pluginNames.has(name)) {
            if (name === "YEP_OptionsCore") {
                for (const key in obj.parameters) {
                    let param = obj.parameters[key];

                    if (key === "OptionsCategories") {
                        for (const [i, text] of originalText.entries()) {
                            param = param.replace(text, translatedText[i]);
                        }

                        obj.parameters[key] = param;
                    } else {
                        if (hashMap.has(param)) {
                            obj.parameters[key] = hashMap.get(param);
                        }
                    }
                }
            } else {
                for (const key in obj.parameters) {
                    const param = obj.parameters[key];

                    if (hashMap.has(param)) {
                        obj.parameters[key] = hashMap.get(param);
                    }
                }
            }
        }
    }

    const prefix = "// Generated by RPG Maker.\n// Do not edit this file directly.\nvar $plugins =\n";
    ensureDirSync("./js");
    writeFileSync(join("./js", "plugins.js"), prefix + JSON.stringify(outputJSON), "utf8");
    return;
}

writeMaps(mapsJSON, dirPaths.maps, dirPaths.mapsTrans);
writeOther(otherJSON, dirPaths.other, dirPaths.other);
writeSystem(systemJSON, join(dirPaths.other, "System.txt"), join(dirPaths.other, "System_trans.txt"));
writePlugins(pluginsJSON, join(dirPaths.plugins, "plugins.txt"), join(dirPaths.plugins, "plugins_trans.txt"));
