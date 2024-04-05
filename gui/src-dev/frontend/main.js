const { ipcRenderer } = require("electron");
const {
    constants,
    readFileSync,
    readdirSync,
    ensureDirSync,
    copyFileSync,
    accessSync,
    writeFileSync,
    pathExistsSync,
} = require("fs-extra");
const { fork } = require("child_process");
const { join } = require("path");

const PRODUCTION = false;

function render() {
    const copiesRoot = PRODUCTION ? join(__dirname, "../../../../copies") : join(__dirname, "../../../copies");
    const backupRoot = PRODUCTION ? join(__dirname, "../../../../backups") : join(__dirname, "../../../backups");
    const translationRoot = PRODUCTION
        ? join(__dirname, "../../../../translation")
        : join(__dirname, "../../../translation");

    ensureStart();

    copy();

    const contentContainer = document.getElementById("content-container");
    const searchInput = document.getElementById("search-input");
    const replaceInput = document.getElementById("replace-input");
    const leftPanel = document.getElementById("left-panel");
    const searchPanel = document.getElementById("search-results");
    const searchPanelFound = document.getElementById("search-content");
    const searchPanelReplaced = document.getElementById("replace-content");
    const saveButton = document.getElementById("save-button");
    const compileButton = document.getElementById("compile-button");
    const searchCaseButton = document.getElementById("case-button");
    const searchWholeButton = document.getElementById("whole-button");
    const searchRegexButton = document.getElementById("regex-button");
    const searchTranslationButton = document.getElementById("translate-button");
    const searchLocationButton = document.getElementById("location-button");
    const backupCheck = document.getElementById("backup-check");
    const backupSettings = document.getElementById("backup-settings");
    const backupPeriodInput = document.getElementById("backup-period-input");
    const backupMaxInput = document.getElementById("backup-max-input");
    const goToRowInput = document.getElementById("goto-row-input");

    const replaced = new Map();

    /** @type {boolean} */
    let backupEnabled;
    /** @type {number} */
    let backupPeriod;
    /** @type {number} */
    let backupMax;

    getSettings();

    let searchRegex = false;
    let searchWhole = false;
    let searchCase = false;
    let searchTranslation = false;
    let searchLocation = false;
    let optionsOpened = false;

    let state = "main";
    let previousState = "main";

    let saved = true;

    backupCheck.innerHTML = backupEnabled ? "check" : "close";
    backupSettings.classList.toggle("hidden", !backupEnabled);
    backupPeriodInput.value = backupPeriod;
    backupMaxInput.value = backupMax;

    if (!pathExistsSync(join(__dirname, "replacement-log.json"))) {
        writeFileSync(join(__dirname, "replacement-log.json"), "{}", "utf8");
    }
    ensureDirSync(backupRoot);
    let nextBackupNumber = parseInt(determineLastBackupNumber()) + 1;
    if (backupEnabled) backup(backupPeriod);

    createContent();
    arrangeElements();

    const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (entry.isIntersecting) {
                entry.target.firstElementChild.classList.remove("hidden");
            } else {
                entry.target.firstElementChild.classList.add("hidden");
            }
        }
        return;
    });

    ipcRenderer.on("exit-sequence", () => {
        if (saved) {
            ipcRenderer.send("quit");
            return;
        }

        ipcRenderer.invoke("quit-confirm").then((response) => {
            if (response) {
                save();

                setTimeout(() => {
                    ipcRenderer.send("quit");
                }, 1000);
                return;
            } else {
                return;
            }
        });
    });

    function getSettings() {
        try {
            const settings = JSON.parse(readFileSync(join(__dirname, "settings.json"), "utf8"));

            backupEnabled = settings.backup.enabled;
            backupPeriod = settings.backup.period;
            backupMax = settings.backup.max;
            return;
        } catch (err) {
            alert("Не удалось получить настройки.");
            ipcRenderer.invoke("create-settings-file").then((response) => {
                if (response) {
                    getSettings();
                }
            });
        }
    }

    function ensureStart() {
        try {
            accessSync(translationRoot, constants.F_OK);
            return;
        } catch {
            alert(
                "Не удалось найти файлы перевода. Убедитесь, что вы включили папку translation в корневую директорию программы."
            );
            ipcRenderer.send("quit");
        }

        try {
            accessSync(join(translationRoot, "maps"), constants.F_OK);
            accessSync(join(translationRoot, "other"), constants.F_OK);
            accessSync(join(translationRoot, "plugins"), constants.F_OK);
            return;
        } catch {
            alert(
                "Программа не может обнаружить папки с файлами перевода внутри папки translation. Убедитесь, что в папке translation присутствуют подпапки maps и other."
            );
            ipcRenderer.send("quit");
        }
    }

    function arrangeElements() {
        window.scrollTo(0, 0);

        requestAnimationFrame(() => {
            for (const child of contentContainer.children) {
                replaceTwoWay(child, "hidden", "flex");

                let heights = new Uint32Array(child.children.length);

                let i = 0;
                for (const node of child.children) {
                    const { height: h } = node.getBoundingClientRect();
                    heights.set([h], i);
                    i++;
                }

                i = 0;
                for (const node of child.children) {
                    node.style.minHeight = `${heights[i]}px`;
                    node.firstElementChild.classList.add("hidden");
                    i++;
                }

                i = null;
                heights = null;
                child.style.minHeight = `${child.scrollHeight}px`;
                child.classList.add("h-auto");

                replaceTwoWay(child, "hidden", "flex");

                requestAnimationFrame(() => {
                    document.body.classList.remove("invisible");
                });
            }
        });
        return;
    }

    function determineLastBackupNumber() {
        const backups = readdirSync(backupRoot);
        return backups.length === 0 ? "00" : backups.map((backup) => backup.slice(-2)).sort((a, b) => b - a)[0];
    }

    function createRegularExpression(text) {
        text = text.trim();

        try {
            if (text.startsWith("/")) {
                const first = text.indexOf("/");
                const last = text.lastIndexOf("/");
                const expression = text.slice(first + 1, last);
                const flags = text.slice(last + 1);
                return new RegExp(expression, flags);
            }

            const expressionProperties = {
                text: searchRegex
                    ? text
                    : searchWhole
                    ? `\\b${text.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`
                    : text.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                attr: searchRegex ? "g" : searchCase ? "g" : "gi",
            };

            return new RegExp(expressionProperties.text, expressionProperties.attr);
        } catch (error) {
            alert(`Неверное регулярное выражение (${text.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")}): ${error}`);
            return;
        }
    }

    /**
     * @param {Map<HTMLElement, string>} map
     * @param {string} text
     * @param {HTMLTextAreaElement} node
     * @returns {void}
     */
    // ! TODO: This function mustn't set nodes to map, but instead create new string with divs, and they must be immeadiately appended to search panel.
    function setMatches(expr, node) {
        const nodeText =
            node.tagName === "TEXTAREA"
                ? node.value.replaceAll("<", "&lt;").replaceAll(">", "&gt;")
                : node.innerHTML.replaceAll("<", "&lt;").replaceAll(">", "&gt;");
        const textMatches = nodeText.match(expr) || [];

        if (textMatches.length === 0) return;

        const result = [];
        let lastIndex = 0;

        for (const match of textMatches) {
            const start = nodeText.indexOf(match, lastIndex);
            const end = start + match.length;

            const beforeDiv = `<div class="inline">${nodeText.slice(lastIndex, start)}</div>`;
            const matchDiv = `<div class="inline bg-gray-500">${match}</div>`;

            result.push(beforeDiv);
            result.push(matchDiv);

            lastIndex = end;
        }

        const afterDiv = `<div class="inline">${nodeText.slice(lastIndex)}</div>`;
        result.push(afterDiv);

        return result.join("");
    }

    /**
     * @param {string} text
     * @returns {Map<HTMLDivElement|HTMLTextAreaElement, string>}
     */
    function searchText(text) {
        text = text.trim();
        if (!text) return;

        /** @type {Map<HTMLDivElement|HTMLTextAreaElement, string>} */
        const matches = new Map();
        const targetElements = searchLocation
            ? [...document.getElementById(`${state}-content`).children]
            : [...contentContainer.children].flatMap((parent) => [...parent.children]);

        const expr = createRegularExpression(text);
        if (!expr) return;

        for (const child of targetElements) {
            const node = child.firstElementChild.children;

            const match = setMatches(expr, node[2]);
            if (match) matches.set(node[2], match);
            if (matches.size > 10000) {
                alert("Совпадения превышают 10 000. Чтобы избежать утечку памяти, поиск был остановлен.");
                return;
            }

            if (!searchTranslation) {
                const match = setMatches(expr, node[1]);
                if (match) matches.set(node[1], match);
                if (matches.size > 10000) {
                    alert("Совпадения превышают 10 000. Чтобы избежать утечку памяти, поиск был остановлен.");
                    return;
                }
            }
        }

        return matches;
    }

    function showSearchPanel(hide = true) {
        if (hide) {
            if (searchPanel.getAttribute("moving") === "false") {
                replaceTwoWay(searchPanel, "translate-x-0", "translate-x-full");
                searchPanel.setAttribute("moving", "true");
            }
        } else {
            searchPanel.classList.remove("translate-x-full");
            searchPanel.classList.add("translate-x-0");
            searchPanel.setAttribute("moving", "true");
        }

        const searchSwitch = document.getElementById("switch-search-content");

        function handleSearchSwitch() {
            replaceTwoWay(searchPanelFound, "hidden", "flex");
            replaceTwoWay(searchPanelReplaced, "hidden", "flex");

            if (searchSwitch.innerHTML.trim() === "search") {
                searchSwitch.innerHTML = "menu_book";

                const replacementLogContent = JSON.parse(readFileSync(join(__dirname, "replacement-log.json"), "utf8"));

                const replacedObserver = new IntersectionObserver(
                    (entries) => {
                        for (const entry of entries) {
                            if (entry.isIntersecting) {
                                entry.target.firstElementChild.classList.remove("hidden");
                            } else {
                                entry.target.firstElementChild.classList.add("hidden");
                            }
                        }
                    },
                    { root: searchPanelReplaced, threshold: 0.1 }
                );

                for (const [key, value] of Object.entries(replacementLogContent)) {
                    const replacedContainer = document.createElement("div");

                    const replacedElement = document.createElement("div");
                    replacedElement.classList.add(
                        "text-white",
                        "text-xl",
                        "cursor-pointer",
                        "bg-gray-700",
                        "my-1",
                        "p-1",
                        "border-2",
                        "border-gray-600"
                    );

                    replacedElement.innerHTML = `<div class="text-base text-gray-400">${key}</div><div class="text-base">${value.original}</div><div class="flex justify-center items-center text-xl text-white font-material">arrow_downward</div><div class="text-base">${value.translated}</div>`;

                    replacedContainer.appendChild(replacedElement);
                    searchPanelReplaced.appendChild(replacedContainer);
                }

                foundObserver.disconnect();
                searchPanelReplaced.style.height = `${searchPanelReplaced.scrollHeight}px`;

                for (const container of searchPanelReplaced.children) {
                    const { width: w, height: h } = container.getBoundingClientRect();

                    container.style.width = `${w}px`;
                    container.style.height = `${h}px`;

                    replacedObserver.observe(container);
                    container.firstElementChild.classList.add("hidden");
                }

                function handleReplacedClick(event) {
                    const element = event.target.parentElement;

                    if (element.hasAttribute("reverted")) return;
                    if (!searchPanelReplaced.contains(element)) return;

                    const clicked = document.getElementById(element.firstElementChild.textContent);

                    if (event.button === 0) {
                        changeState(
                            clicked.parentElement.parentElement.parentElement.id.replace("-content", ""),
                            false
                        );

                        //* it takes two frames to change the state
                        requestAnimationFrame(() => {
                            requestAnimationFrame(() => {
                                clicked.parentElement.parentElement.scrollIntoView({
                                    block: "center",
                                    inline: "center",
                                });
                            });
                        });
                    } else if (event.button === 2) {
                        clicked.value = element.children[1].textContent;

                        element.innerHTML = `<div class="inline text-base">Текст на позиции\n<code class="inline">${element.firstElementChild.textContent}</code>\nбыл возвращён к исходному значению\n<code class="inline">${element.children[1].textContent}</code></div>`;
                        element.setAttribute("reverted", "");
                        delete replacementLogContent[clicked.id];

                        writeFileSync(
                            join(__dirname, "replacement-log.json"),
                            JSON.stringify(replacementLogContent, null, 4),
                            "utf8"
                        );
                    }
                }

                searchPanelReplaced.addEventListener("mousedown", (event) => {
                    handleReplacedClick(event);
                });
            } else {
                searchSwitch.innerHTML = "search";
                searchPanelReplaced.innerHTML = "";

                searchPanelReplaced.removeEventListener("mousedown", (event) => {
                    handleReplacedClick(event);
                });
            }

            return;
        }

        let loadingContainer;
        if (searchPanelFound.children.length > 0 && searchPanelFound.firstElementChild.id !== "no-results") {
            loadingContainer = document.createElement("div");
            loadingContainer.classList.add("flex", "justify-center", "items-center", "h-full", "w-full");
            loadingContainer.innerHTML = searchPanel.classList.contains("translate-x-0")
                ? `<div class="text-4xl animate-spin font-material">refresh</div>`
                : "";

            searchPanelFound.appendChild(loadingContainer);
        }

        if (searchPanel.getAttribute("shown") === "false") {
            searchPanel.addEventListener(
                "transitionend",
                () => {
                    if (loadingContainer) searchPanelFound.removeChild(loadingContainer);
                    searchSwitch.addEventListener("click", handleSearchSwitch);
                    searchPanel.setAttribute("shown", "true");
                    searchPanel.setAttribute("moving", "false");
                    return;
                },
                { once: true }
            );
        } else {
            if (searchPanel.classList.contains("translate-x-full")) {
                searchPanel.setAttribute("shown", "false");
                searchPanel.setAttribute("moving", "true");

                searchSwitch.removeEventListener("click", handleSearchSwitch);
                searchPanel.addEventListener(
                    "transitionend",
                    () => {
                        searchPanel.setAttribute("moving", "false");
                    },
                    { once: true }
                );
                return;
            }

            if (loadingContainer) searchPanelFound.removeChild(loadingContainer);
            searchPanel.setAttribute("moving", "false");
        }
    }

    /**
     * @param {string} id
     * @returns {[HTMLElement, number]}
     */
    function displaySearchResults(text = null, hide = true) {
        if (!text) {
            showSearchPanel(hide);
            return;
        }

        /**
         * Finds the counterpart element based on the given id.
         *
         * @param {string} id - The id of the element to search for.
         * @return {[HTMLElement, number]} - An array containing the counterpart element and a flag indicating type of match.
         */
        function findCounterpart(id) {
            if (id.includes("original")) {
                return [document.getElementById(id.replace("original", "translated")), 1];
            } else {
                return [document.getElementById(id.replace("translated", "original")), 0];
            }
        }

        function extractInfo(element) {
            const parts = element.id.split("-");
            const parentId = parts[parts.length - 2];
            const id = parts[parts.length - 1];
            return [parentId, id];
        }

        function handleResultClick(button, currentState, element, resultElement, counterpartIndex) {
            if (button === 0) {
                changeState(currentState.id.replace("-content", ""), false);

                //* it takes two frames to change the state
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        element.parentElement.parentElement.scrollIntoView({
                            block: "center",
                            inline: "center",
                        });
                    });
                });
            } else if (button === 2) {
                if (element.id.includes("original")) {
                    alert("Оригинальные строки не могут быть заменены.");
                    return;
                } else {
                    if (replaceInput.value.trim()) {
                        const newText = replaceText(element);

                        if (newText) {
                            const index = counterpartIndex === 1 ? 3 : 0;
                            resultElement.children[index].innerHTML = newText;
                        }
                        return;
                    }
                }
            }
        }

        text = text.trim();
        if (!text) return;

        const results = searchText(text);

        if (!results || results.size === 0) {
            searchPanelFound.innerHTML = `<div id="no-results" class="flex justify-center items-center h-full">Нет совпадений</div>`;
            showSearchPanel(hide);
            return;
        }

        const foundObserver = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        entry.target.firstElementChild.classList.remove("hidden");
                    } else {
                        entry.target.firstElementChild.classList.add("hidden");
                    }
                }
            },
            { root: searchPanelFound, threshold: 0.1 }
        );

        for (const [element, result] of results) {
            const resultContainer = document.createElement("div");

            const resultElement = document.createElement("div");
            resultElement.classList.add(
                "text-white",
                "text-xl",
                "cursor-pointer",
                "bg-gray-700",
                "my-1",
                "p-1",
                "border-2",
                "border-gray-600"
            );

            const thirdParent = element.parentElement.parentElement.parentElement;

            const [counterpart, counterpartIndex] = findCounterpart(element.id);
            const [elementParentId, elementId] = extractInfo(element);
            const [counterpartParentId, counterpartId] = extractInfo(counterpart);

            resultElement.innerHTML = `<div class="text-base">${result}</div><div class="text-xs text-gray-400">${element.parentElement.parentElement.id.slice(
                0,
                element.parentElement.parentElement.id.lastIndexOf("-")
            )} - ${elementParentId} - ${elementId}</div><div class="flex justify-center items-center text-xl text-white font-material">arrow_downward</div><div class="text-base">${
                counterpart.tagName === "TEXTAREA"
                    ? counterpart.value.replaceAll("<", "&lt;").replaceAll(">", "&gt;")
                    : counterpart.innerHTML.replaceAll("<", "&lt;").replaceAll(">", "&gt;")
            }</div><div class="text-xs text-gray-400">${counterpart.parentElement.parentElement.id.slice(
                0,
                counterpart.parentElement.parentElement.id.lastIndexOf("-")
            )} - ${counterpartParentId} - ${counterpartId}</div>`;

            resultElement.setAttribute("data", `${thirdParent.id},${element.id},${counterpartIndex}`);
            resultContainer.appendChild(resultElement);
            searchPanelFound.appendChild(resultContainer);
        }

        foundObserver.disconnect();
        searchPanelFound.style.height = `${searchPanelFound.scrollHeight}px`;

        for (const container of searchPanelFound.children) {
            const { width: w, height: h } = container.getBoundingClientRect();

            container.style.width = `${w}px`;
            container.style.height = `${h}px`;

            foundObserver.observe(container);
            container.firstElementChild.classList.add("hidden");
        }

        showSearchPanel(hide);

        /**
         * A function that handles result selection based on the event coordinates.
         *
         * @param {MouseEvent} event - the event object containing the coordinates
         * @return {void}
         */
        function handleResultSelecting(event) {
            const resultElement = event.target.parentElement.hasAttribute("data")
                ? event.target.parentElement
                : event.target.parentElement.parentElement;
            if (!searchPanelFound.contains(resultElement)) return;

            const [thirdParent, element, counterpartIndex] = resultElement.getAttribute("data").split(",");

            handleResultClick(
                event.button,
                document.getElementById(thirdParent),
                document.getElementById(element),
                resultElement,
                parseInt(counterpartIndex)
            );
        }

        searchPanelFound.removeEventListener("mousedown", (event) => {
            handleResultSelecting(event);
        });

        searchPanelFound.addEventListener("mousedown", (event) => {
            handleResultSelecting(event);
        });
        return;
    }

    /**
     * @param {HTMLTextAreaElement|string} text
     * @returns {void}
     */
    function replaceText(text, isAll = false) {
        if (!isAll) {
            const regex = createRegularExpression(searchInput.value);
            const replacementValue = replaceInput.value;
            const highlightedReplacement = document.createElement("div");
            highlightedReplacement.classList.add("inline", "bg-red-600");
            highlightedReplacement.textContent = replacementValue;

            const newText = text.value.split(regex);
            const newTextParts = newText.flatMap((part, i) => [
                part,
                i < newText.length - 1 ? highlightedReplacement : "",
            ]);

            const newValue = newText.join(replacementValue);

            replaced.set(text.id, { original: text.value, translated: newValue });
            const prevFile = JSON.parse(readFileSync(join(__dirname, "replacement-log.json"), "utf8"));
            const newObject = { ...prevFile, ...Object.fromEntries([...replaced]) };

            writeFileSync(join(__dirname, "replacement-log.json"), JSON.stringify(newObject, null, 4), "utf8");
            replaced.clear();

            text.value = newValue;
            return newTextParts.join("");
        }

        text = text.trim();
        if (!text) return;

        const results = searchText(text);
        if (!results || results.size === 0) return;

        const regex = createRegularExpression(text);
        if (!regex) return;

        for (const textarea of results.keys()) {
            if (!textarea.id.includes("original")) {
                const newValue = textarea.value.replace(regex, replaceInput.value);

                replaced.set(textarea.id, {
                    original: textarea.value,
                    translated: newValue,
                });

                textarea.value = newValue;
            }
        }

        const prevFile = JSON.parse(readFileSync(join(__dirname, "replacement-log.json"), "utf8"));
        const newObject = { ...prevFile, ...Object.fromEntries([...replaced]) };

        writeFileSync(join(__dirname, "replacement-log.json"), JSON.stringify(newObject, null, 4), "utf8");
        replaced.clear();

        return;
    }

    function copy() {
        function isCopied() {
            ensureDirSync(copiesRoot);
            ensureDirSync(join(copiesRoot, "maps"));
            ensureDirSync(join(copiesRoot, "other"));
            ensureDirSync(join(copiesRoot, "plugins"));

            const mapsLength = readdirSync(join(translationRoot, "maps")).length;
            const otherLength = readdirSync(join(translationRoot, "other")).length;
            const pluginsLength = readdirSync(join(translationRoot, "plugins")).length;
            const copiesMapsLength = readdirSync(join(copiesRoot, "maps")).length;
            const copiesOtherLength = readdirSync(join(copiesRoot, "other")).length;
            const copiesPluginsLength = readdirSync(join(copiesRoot, "plugins")).length;

            if (
                copiesMapsLength === mapsLength &&
                copiesOtherLength === otherLength &&
                copiesPluginsLength === pluginsLength
            ) {
                return true;
            }

            return false;
        }

        if (isCopied()) return;

        for (const file of readdirSync(join(translationRoot, "maps"))) {
            copyFileSync(join(translationRoot, "maps", file), join(copiesRoot, "maps", file));
        }

        for (const file of readdirSync(join(translationRoot, "other"))) {
            copyFileSync(join(translationRoot, "other", file), join(copiesRoot, "other", file));
        }

        for (const file of readdirSync(join(translationRoot, "plugins"))) {
            copyFileSync(join(translationRoot, "plugins", file), join(copiesRoot, "plugins", file));
        }
        return;
    }

    function save(backup = false) {
        const fileMappings = {
            "maps-content": "./maps/maps_trans.txt",
            "maps-names-content": "./maps/names_trans.txt",
            "actors-content": "./other/Actors_trans.txt",
            "armors-content": "./other/Armors_trans.txt",
            "classes-content": "./other/Classes_trans.txt",
            "common-events-content": "./other/CommonEvents_trans.txt",
            "enemies-content": "./other/Enemies_trans.txt",
            "items-content": "./other/Items_trans.txt",
            "skills-content": "./other/Skills_trans.txt",
            "system-content": "./other/System_trans.txt",
            "troops-content": "./other/Troops_trans.txt",
            "weapons-content": "./other/Weapons_trans.txt",
            "plugins-content": "./plugins/plugins_trans.txt",
        };

        saveButton.classList.add("animate-spin");

        requestAnimationFrame(() => {
            let dirName = copiesRoot;

            if (backup) {
                const date = new Date();

                const dateProperties = {
                    year: date.getFullYear(),
                    month: date.getMonth() + 1,
                    day: date.getDate(),
                    hour: date.getHours(),
                    minute: date.getMinutes(),
                    second: date.getSeconds(),
                };

                for (const [key, value] of Object.entries(dateProperties)) {
                    dateProperties[key] = value.toString().padStart(2, "0");
                }

                if (nextBackupNumber === 99) nextBackupNumber = 1;

                const backupFolderName = `${Object.values(dateProperties).join("-")}_${nextBackupNumber
                    .toString()
                    .padStart(2, "0")}`;

                nextBackupNumber++;

                dirName = join(backupRoot, backupFolderName);

                ensureDirSync(dirName);
                ensureDirSync(join(dirName, "maps"));
                ensureDirSync(join(dirName, "other"));
                ensureDirSync(join(dirName, "plugins"));
            }

            for (const contentElement of contentContainer.children) {
                const outputArray = [];

                for (const child of contentElement.children) {
                    const node = child.firstElementChild.children[2];

                    outputArray.push(node.value.replaceAll("\n", "\\n"));
                }

                const filePath = fileMappings[contentElement.id];

                if (filePath) {
                    const dir = join(dirName, filePath);

                    writeFileSync(dir, outputArray.join("\n"), "utf8");
                    if (!backup) saved = true;
                }
            }

            setTimeout(() => {
                saveButton.classList.remove("animate-spin");
            }, 1000);
        });
        return;
    }

    function backup(s) {
        if (!backupEnabled) return;

        setTimeout(() => {
            if (backupEnabled) {
                save(true);
                backup(s);
            }
            return;
        }, s * 1000);
        return;
    }

    /**
     * @param {string} id
     * @param {string} originalText
     * @param {string} translatedText
     */
    function createContentChildren(id, originalText, translatedText) {
        const content = document.createElement("div");
        content.id = id;
        content.classList.add("hidden", "flex-col");

        for (const [i, text] of originalText.entries()) {
            const contentParent = document.createElement("div");
            contentParent.id = `${id}-${i + 1}`;
            contentParent.classList.add("w-full", "z-10", "h-auto", "p-1");

            const contentChild = document.createElement("div");
            contentChild.classList.add("flex", "flex-row", "h-auto");

            //* Original text field
            const originalTextDiv = document.createElement("div");
            originalTextDiv.id = `${id}-original-${i + 1}`;
            originalTextDiv.textContent = text.replaceAll("\\n[", "\\N[").replaceAll("\\n", "\n");
            originalTextDiv.classList.add(
                ..."p-1 w-full h-auto bg-gray-800 outline outline-2 outline-gray-700 mr-2 inline-block whitespace-pre-wrap".split(
                    " "
                )
            );

            //* Translated text field
            const translatedTextInput = document.createElement("textarea");
            const splittedTranslatedText = translatedText[i].split("\\n");
            translatedTextInput.id = `${id}-translated-${i + 1}`;
            translatedTextInput.rows = splittedTranslatedText.length;
            translatedTextInput.value = splittedTranslatedText.join("\n");
            translatedTextInput.classList.add(
                ..."p-1 w-full h-auto bg-gray-800 resize-none outline outline-2 outline-gray-700 focus:outline-gray-400".split(
                    " "
                )
            );

            //* Row field
            const row = document.createElement("div");
            row.id = `${id}-row-${i + 1}`;
            row.textContent = i + 1;
            row.classList.add(..."p-1 w-36 h-auto bg-gray-800 outline-none".split(" "));

            //* Append elements to containers
            contentChild.appendChild(row);
            contentChild.appendChild(originalTextDiv);
            contentChild.appendChild(translatedTextInput);
            contentParent.appendChild(contentChild);
            content.appendChild(contentParent);
        }

        contentContainer.appendChild(content);
        return;
    }

    /**
     * @param {string} newState
     * @param {string} contentId
     * @param {boolean} slide
     * @returns {void}
     */
    function updateState(newState, contentId, slide = true) {
        const currentState = document.getElementById("current-state");
        const pageLoadedDisplay = document.getElementById("is-loaded");

        requestAnimationFrame(() => {
            pageLoadedDisplay.innerHTML = "refresh";
            pageLoadedDisplay.classList.toggle("animate-spin");

            currentState.innerHTML = newState;

            requestAnimationFrame(() => {
                const contentParent = document.getElementById(contentId);
                contentParent.classList.remove("hidden");
                contentParent.classList.add("flex", "flex-col");

                if (previousState !== "main") {
                    replaceTwoWay(document.getElementById(`${previousState}-content`), "flex", "hidden");
                    observer.disconnect();
                }

                for (const child of contentParent.children) {
                    observer.observe(child);
                }

                if (slide) {
                    replaceTwoWay(leftPanel, "-translate-x-full", "translate-x-0");
                }

                pageLoadedDisplay.innerHTML = "done";
                pageLoadedDisplay.classList.toggle("animate-spin");
            });
        });
        return;
    }

    /**
     * @param {string} newState
     * @param {boolean} [slide=true]
     * @returns {void}
     */
    function changeState(newState, slide = true) {
        if (state === newState) return;

        switch (newState) {
            case "main":
                state = "main";
                document.getElementById("current-state").innerHTML = "";
                pageLoadedDisplay.innerHTML = "check_indeterminate_small";

                observer.disconnect();
                for (const child of contentContainer.children) {
                    for (const element of child.children) {
                        element.firstElementChild.classList.add("hidden");
                    }
                }
                break;
            default:
                previousState = state;
                state = newState;
                updateState(newState, `${newState}-content`, slide);
                break;
        }
        return;
    }

    function goToRow() {
        goToRowInput.classList.remove("hidden");
        goToRowInput.focus();

        const element = document.getElementById(`${state}-content`);
        const lastRow = element.lastElementChild.id.split("-").at(-1);

        goToRowInput.placeholder = `Перейти к строке... от 1 до ${lastRow}`;

        goToRowInput.addEventListener("keydown", function handleKeydown(event) {
            if (event.code === "Enter") {
                const rowNumber = goToRowInput.value;

                const targetRow = document.getElementById(`${state}-content-${rowNumber}`);

                if (targetRow) {
                    targetRow.scrollIntoView({
                        block: "center",
                        inline: "center",
                    });
                }

                goToRowInput.value = "";
                goToRowInput.classList.add("hidden");

                goToRowInput.removeEventListener("keydown", handleKeydown);
            }

            if (event.code === "Escape") {
                goToRowInput.value = "";
                goToRowInput.classList.add("hidden");

                goToRowInput.removeEventListener("keydown", handleKeydown);
            }
        });

        return;
    }

    /**
     * @param {KeyboardEvent} event
     * @returns {void}
     */
    function handleKeypressBody(event) {
        switch (event.code) {
            case "Escape":
                changeState("main", false);
                break;
            case "Tab":
                replaceTwoWay(leftPanel, "translate-x-0", "-translate-x-full");
                break;
            case "KeyR":
                displaySearchResults();
                break;
            case "Digit1":
                changeState("maps", false);
                break;
            case "Digit2":
                changeState("maps-names", false);
                break;
            case "Digit3":
                changeState("actors", false);
                break;
            case "Digit4":
                changeState("armors", false);
                break;
            case "Digit5":
                changeState("classes", false);
                break;
            case "Digit6":
                changeState("common-events", false);
                break;
            case "Digit7":
                changeState("enemies", false);
                break;
            case "Digit8":
                changeState("items", false);
                break;
            case "Digit9":
                changeState("skills", false);
                break;
            case "Digit0":
                changeState("system", false);
                break;
            case "Minus":
                changeState("troops", false);
                break;
            case "Equal":
                changeState("weapons", false);
                break;
        }
        return;
    }

    /**
     * Jump to the row based on the key pressed.
     *
     * @param {string} key - the key pressed
     * @return {void}
     */
    function jumpToRow(key) {
        const focusedElement = document.activeElement;
        if (!focusedElement || !focusedElement.id || (key !== "alt" && key !== "ctrl")) return;

        const idParts = focusedElement.id.split("-");
        const index = parseInt(idParts.pop(), 10);
        const baseId = idParts.join("-");

        if (isNaN(index)) return;

        const step = key === "alt" ? 1 : -1;
        const nextIndex = index + step;
        const nextElementId = `${baseId}-${nextIndex}`;
        const nextElement = document.getElementById(nextElementId);

        if (!nextElement) return;

        const scrollOffset = nextElement.clientHeight + 8;
        window.scrollBy(0, step * scrollOffset);
        focusedElement.blur();
        nextElement.focus();
        nextElement.setSelectionRange(0, 0);
        return;
    }

    /**
     * @param {KeyboardEvent} event
     * @returns {void}
     */
    function handleKeypressGlobal(event) {
        switch (event.code) {
            case "Escape":
                document.activeElement.blur();
                break;
            case "Enter":
                if (event.altKey) {
                    jumpToRow("alt");
                } else if (event.ctrlKey) {
                    jumpToRow("ctrl");
                }
                break;
            case "KeyS":
                if (event.ctrlKey) {
                    save();
                }
                break;
            case "KeyF":
                if (event.ctrlKey) {
                    searchInput.focus();
                }
                break;
            case "KeyC":
                if (document.activeElement !== searchInput && event.altKey) {
                    compile();
                }
                break;
            case "KeyG":
                if (event.ctrlKey) {
                    if (state !== "main") {
                        if (goToRowInput.classList.contains("hidden")) {
                            goToRow();
                        } else {
                            goToRowInput.classList.add("hidden");
                        }
                    }
                }
                break;
        }
        return;
    }

    /**
     * @param {KeyboardEvent} event
     * @returns {void}
     */
    function handleKeypressSearch(event) {
        if (event.code === "Enter") {
            event.preventDefault();

            if (event.ctrlKey) {
                searchInput.value += "\n";
            } else {
                if (searchInput.value.trim()) {
                    searchPanelFound.innerHTML = "";
                    displaySearchResults(searchInput.value, false);
                } else {
                    searchPanelFound.innerHTML = `<div class="flex justify-center items-center h-full">Результатов нет</div>`;
                }
            }
        }

        if (event.altKey) {
            switch (event.code) {
                case "KeyC":
                    switchCaseButton();
                    break;
                case "KeyW":
                    switchWholeButton();
                    break;
                case "KeyR":
                    switchRegexButton();
                    break;
                case "KeyT":
                    switchTranslationButton();
                    break;
                case "KeyL":
                    switchLocationButton();
                    break;
            }
        }
    }

    // ! Single-call function
    function createContent() {
        const copiesDirs = {
            originalMapText: "maps/maps.txt",
            translatedMapText: "maps/maps_trans.txt",
            originalMapNames: "maps/names.txt",
            translatedMapNames: "maps/names_trans.txt",
            originalActors: "other/Actors.txt",
            translatedActors: "other/Actors_trans.txt",
            originalArmors: "other/Armors.txt",
            translatedArmors: "other/Armors_trans.txt",
            originalClasses: "other/Classes.txt",
            translatedClasses: "other/Classes_trans.txt",
            originalCommonEvents: "other/CommonEvents.txt",
            translatedCommonEvents: "other/CommonEvents_trans.txt",
            originalEnemies: "other/Enemies.txt",
            translatedEnemies: "other/Enemies_trans.txt",
            originalItems: "other/Items.txt",
            translatedItems: "other/Items_trans.txt",
            originalSkills: "other/Skills.txt",
            translatedSkills: "other/Skills_trans.txt",
            originalSystem: "other/System.txt",
            translatedSystem: "other/System_trans.txt",
            originalTroops: "other/Troops.txt",
            translatedTroops: "other/Troops_trans.txt",
            originalWeapons: "other/Weapons.txt",
            translatedWeapons: "other/Weapons_trans.txt",
            originalPlugins: "plugins/plugins.txt",
            translatedPlugins: "plugins/plugins_trans.txt",
        };

        const contentTypes = [
            {
                id: "maps-content",
                original: "originalMapText",
                translated: "translatedMapText",
            },
            {
                id: "maps-names-content",
                original: "originalMapNames",
                translated: "translatedMapNames",
            },
            {
                id: "actors-content",
                original: "originalActors",
                translated: "translatedActors",
            },
            {
                id: "armors-content",
                original: "originalArmors",
                translated: "translatedArmors",
            },
            {
                id: "classes-content",
                original: "originalClasses",
                translated: "translatedClasses",
            },
            {
                id: "common-events-content",
                original: "originalCommonEvents",
                translated: "translatedCommonEvents",
            },
            {
                id: "enemies-content",
                original: "originalEnemies",
                translated: "translatedEnemies",
            },
            {
                id: "items-content",
                original: "originalItems",
                translated: "translatedItems",
            },
            {
                id: "skills-content",
                original: "originalSkills",
                translated: "translatedSkills",
            },
            {
                id: "system-content",
                original: "originalSystem",
                translated: "translatedSystem",
            },
            {
                id: "troops-content",
                original: "originalTroops",
                translated: "translatedTroops",
            },
            {
                id: "weapons-content",
                original: "originalWeapons",
                translated: "translatedWeapons",
            },
            {
                id: "plugins-content",
                original: "originalPlugins",
                translated: "translatedPlugins",
            },
        ];

        const result = new Map();

        for (const [key, path] of Object.entries(copiesDirs)) {
            result.set(key, readFileSync(join(copiesRoot, path), "utf8").split("\n"));
        }

        for (const content of contentTypes) {
            createContentChildren(content.id, result.get(content.original), result.get(content.translated));
        }

        return;
    }

    function compile() {
        compileButton.classList.add("animate-spin");

        const writer = fork(join(__dirname, "../resources/write.js"), [], { timeout: 15000 });

        writer.on("error", (err) => {
            compileButton.classList.remove("animate-spin");
            alert(`Не удалось записать файлы: ${err}`);
            writer.kill();
            return;
        });

        writer.on("close", () => {
            compileButton.classList.remove("animate-spin");
            alert("Все файлы записаны успешно.");
            return;
        });

        return;
    }

    function showOptions() {
        function handleBackupCheck() {
            backupEnabled = !backupEnabled;

            if (backupEnabled) {
                backupSettings.classList.remove("hidden");
                backup(backupPeriod);
            } else {
                backupSettings.classList.add("hidden");
            }

            backupCheck.innerHTML = "check" ? "close" : "check";
            return;
        }

        function handleBackupPeriod() {
            backupPeriod = parseInt(backupPeriodInput.value);
            backupPeriodInput.value = backupPeriod < 60 ? 60 : backupPeriod > 3600 ? 3600 : backupPeriod;
            return;
        }

        function handleBackupMax() {
            backupMax = parseInt(backupMaxInput.value);

            backupMaxInput.value = backupMax < 1 ? 1 : backupMax > 100 ? 100 : backupMax;
            return;
        }

        optionsOpened = !optionsOpened;
        document.getElementById("options-menu").classList.toggle("hidden");

        if (optionsOpened) {
            document.body.classList.add("overflow-hidden");

            backupCheck.addEventListener("click", handleBackupCheck);
            backupPeriodInput.addEventListener("change", handleBackupPeriod);
            backupMaxInput.addEventListener("change", handleBackupMax);
        } else {
            document.body.classList.remove("overflow-hidden");

            backupCheck.removeEventListener("click", handleBackupCheck);
            backupPeriodInput.removeEventListener("change", handleBackupPeriod);
            backupMaxInput.removeEventListener("change", handleBackupMax);

            const appSettings = {
                backup: {
                    enabled: backupEnabled,
                    period: backupPeriod,
                    max: backupMax,
                },
            };

            writeFileSync(join(__dirname, "settings.json"), JSON.stringify(appSettings, null, 4), "utf8");
        }
        return;
    }

    function replaceTwoWay(element, firstClass, secondClass) {
        const containsClass = element.classList.contains(secondClass);
        element.classList.toggle(firstClass, containsClass);
        element.classList.toggle(secondClass, !containsClass);
    }

    function preventKeyDefaults(event) {
        switch (event.key) {
            case "Tab":
                event.preventDefault();
                break;
            case event.altKey:
                event.preventDefault();
                break;
            case "F4":
                if (!event.altKey) return;

                event.preventDefault();

                if (saved) {
                    ipcRenderer.send("quit");
                    return;
                }

                ipcRenderer.invoke("quit-confirm").then((response) => {
                    if (response) {
                        save();
                        setTimeout(() => {
                            ipcRenderer.send("quit");
                        }, 1000);
                        return;
                    } else {
                        return;
                    }
                });
                break;
            case "F5":
                event.preventDefault();

                document.body.classList.add("hidden");

                requestAnimationFrame(() => {
                    location.reload();
                });
                break;
            default:
                if (
                    saved &&
                    document.activeElement !== document.body &&
                    document.activeElement !== searchInput &&
                    document.activeElement !== replaceInput
                ) {
                    saved = false;
                }
        }
        return;
    }

    function menuButtonClick() {
        replaceTwoWay(leftPanel, "translate-x-0", "-translate-x-full");
        return;
    }

    function searchButtonClick() {
        if (searchInput.value) {
            searchPanelFound.innerHTML = "";
            displaySearchResults(searchInput.value, false);
        } else if (document.activeElement === document.body) {
            searchInput.focus();
        }
        return;
    }

    function replaceButtonClick() {
        if (searchInput.value && replaceInput.value) {
            replaceText(searchInput.value, false);
        }
        return;
    }

    function switchCaseButton() {
        if (!searchRegex) {
            searchCase = !searchCase;
            searchCaseButton.classList.toggle("bg-gray-500");
        }
        return;
    }

    function switchWholeButton() {
        if (!searchRegex) {
            searchWhole = !searchWhole;
            searchWholeButton.classList.toggle("bg-gray-500");
        }
        return;
    }

    function switchRegexButton() {
        searchRegex = !searchRegex;

        if (searchRegex) {
            searchCase = false;
            searchCaseButton.classList.remove("bg-gray-500");

            searchWhole = false;
            searchWholeButton.classList.remove("bg-gray-500");
        }

        searchRegexButton.classList.toggle("bg-gray-500");
        return;
    }

    function switchTranslationButton() {
        searchTranslation = !searchTranslation;
        searchTranslationButton.classList.toggle("bg-gray-500");
        return;
    }

    function switchLocationButton() {
        searchLocation = !searchLocation;
        searchLocationButton.classList.toggle("bg-gray-500");
        return;
    }

    document.addEventListener("keydown", (event) => {
        if (document.activeElement === document.body) handleKeypressBody(event);
        handleKeypressGlobal(event);
        return;
    });

    searchInput.addEventListener("keydown", (event) => handleKeypressSearch(event));
    leftPanel.addEventListener("click", (event) => changeState(event.target.id));
    document.getElementById("menu-button").addEventListener("click", menuButtonClick);
    document.getElementById("search-button").addEventListener("click", searchButtonClick);
    document.getElementById("replace-button").addEventListener("click", replaceButtonClick);
    searchCaseButton.addEventListener("click", switchCaseButton);
    searchWholeButton.addEventListener("click", switchWholeButton);
    searchRegexButton.addEventListener("click", switchRegexButton);
    searchTranslationButton.addEventListener("click", switchTranslationButton);
    searchLocationButton.addEventListener("click", switchLocationButton);
    saveButton.addEventListener("click", save);
    compileButton.addEventListener("click", compile);
    document.getElementById("options-button").addEventListener("click", showOptions);
    document.addEventListener("keydown", (event) => preventKeyDefaults(event));

    const activeGhostLines = [];

    function trackFocus(focusedElement) {
        for (const ghost of activeGhostLines) {
            ghost.remove();
        }

        function getNewLinePositions(textarea) {
            const positions = [];
            const lines = textarea.value.split("\n");
            const lineHeight = parseFloat(window.getComputedStyle(textarea).lineHeight);

            const textareaRect = textarea.getBoundingClientRect();
            const y = textareaRect.y + window.scrollY;
            const x = textareaRect.x;

            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");
            context.font = '18px "Segoe UI"';

            let top = y;

            for (let i = 0; i < lines.length - 1; i++) {
                const line = lines[i];
                const textWidth = context.measureText(`${line} `).width;
                const left = x + textWidth;

                positions.push({ left, top });
                top += lineHeight;
            }

            return positions;
        }

        const result = getNewLinePositions(focusedElement);
        if (result.length === 0) return;

        for (const object of result) {
            const { left, top } = object;
            const ghostNewLine = document.createElement("div");
            ghostNewLine.classList.add(
                "text-gray-400",
                "absolute",
                "font-lg",
                "z-50",
                "select-none",
                "cursor-default",
                "pointer-events-none"
            );
            ghostNewLine.textContent = "\\n";
            ghostNewLine.style.left = `${left}px`;
            ghostNewLine.style.top = `${top}px`;

            activeGhostLines.push(ghostNewLine);
            document.body.appendChild(ghostNewLine);
        }
    }

    let currentFocusedElement = null;

    function calculateTextAreaHeight(target) {
        let lineBreaks = target.value.split("\n").length;

        const { lineHeight, paddingTop, paddingBottom, borderTopWidth, borderBottomWidth } =
            window.getComputedStyle(target);

        let newHeight =
            lineBreaks * parseFloat(lineHeight) +
            parseFloat(paddingTop) +
            parseFloat(paddingBottom) +
            parseFloat(borderTopWidth) +
            parseFloat(borderBottomWidth);

        target.style.height = `${newHeight}px`;
    }

    function handleFocus(event) {
        const target = event.target;

        for (const ghost of activeGhostLines) {
            ghost.remove();
        }

        if (target !== currentFocusedElement) {
            currentFocusedElement = target;

            if (target.tagName === "TEXTAREA") {
                target.addEventListener("keyup", () => {
                    calculateTextAreaHeight(target);
                });

                target.addEventListener("input", () => {
                    trackFocus(target);
                });

                trackFocus(target);
            }
        }
    }

    function handleBlur(event) {
        const target = event.target;

        for (const ghost of activeGhostLines) {
            ghost.remove();
        }

        if (target === currentFocusedElement) {
            currentFocusedElement = null;

            if (target.tagName === "TEXTAREA") {
                target.removeEventListener("input", () => {
                    trackFocus(target);
                });

                target.removeEventListener("keyup", () => {
                    calculateTextAreaHeight(target);
                });
            }
        }
    }

    document.addEventListener("focus", handleFocus, true);
    document.addEventListener("blur", handleBlur, true);
    return;
}

document.addEventListener("DOMContentLoaded", render);
