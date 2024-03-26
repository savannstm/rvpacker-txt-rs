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
    //#region Directories
    const copiesRoot = PRODUCTION ? join(__dirname, "../../../../copies") : join(__dirname, "../../../copies");
    const backupRoot = PRODUCTION ? join(__dirname, "../../../../backups") : join(__dirname, "../../../backups");
    const translationRoot = PRODUCTION
        ? join(__dirname, "../../../../translation")
        : join(__dirname, "../../../translation");

    ensureStart();
    //#endregion

    //#region Main logic
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
                entry.target.children[0].classList.remove("hidden");
            } else {
                entry.target.children[0].classList.add("hidden");
            }
        }
        return;
    });

    async function getSettings() {
        try {
            const settings = JSON.parse(readFileSync(join(__dirname, "settings.json"), "utf8"));

            backupEnabled = settings.backup.enabled;
            backupPeriod = settings.backup.period;
            backupMax = settings.backup.max;
            return;
        } catch (err) {
            alert("Не удалось получить настройки.");
            const response = await ipcRenderer.invoke("create-settings-file");
            if (response) {
                getSettings();
            }
        }
    }

    function ensureStart() {
        try {
            accessSync(translationRoot, constants.F_OK);
            return;
        } catch (err) {
            alert(
                "Не удалось найти файлы перевода. Убедитесь, что вы включили папку translation в корневую директорию программы."
            );
            ipcRenderer.send("quit");
        }

        try {
            accessSync(join(translationRoot, "maps"), constants.F_OK);
            accessSync(join(translationRoot, "other"), constants.F_OK);
            return;
        } catch (err) {
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
                child.classList.remove("hidden");
                child.classList.add("flex", "flex-col");

                const nodeYCoordinates = new Map();
                const nodeXCoordinates = new Map();
                let margin = 0;

                for (const node of child.children) {
                    const { x, y } = node.getBoundingClientRect();

                    nodeXCoordinates.set(node.id, x);
                    nodeYCoordinates.set(node.id, y + margin);
                    margin += 8;
                }

                for (const node of child.children) {
                    const id = node.id;

                    node.style.position = "absolute";
                    node.style.left = `${nodeXCoordinates.get(id)}px`;
                    node.style.top = `${nodeYCoordinates.get(id)}px`;
                    node.style.width = "1840px";
                    node.children[0].classList.add("hidden");
                }

                const lastChild = Array.from(child.children).at(-1);
                child.style.height = `${nodeYCoordinates.get(lastChild.id) - 64}px`;
                child.classList.remove("flex", "flex-col");
                child.classList.add("hidden");

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

                const expression = text.substring(first + 1, last);
                const flags = text.substring(last + 1);

                return new RegExp(expression, flags);
            }

            const expressionProperties = {
                text: searchRegex ? text : searchWhole ? `\\b${text}\\b` : text,
                attr: searchRegex ? "g" : searchCase ? "g" : "gi",
            };

            return new RegExp(expressionProperties.text, expressionProperties.attr);
        } catch (error) {
            alert(`Неверное регулярное выражение: ${error}`);
            return;
        }
    }

    /**
     * @param {Map<HTMLElement, string>} map
     * @param {string} text
     * @param {HTMLTextAreaElement} node
     * @returns {void}
     */
    // TODO: Replace nodeText constant with function argument
    function setMatches(map, expr, node) {
        const nodeText = node.tagName === "TEXTAREA" ? node.value : node.innerHTML;
        const matches = nodeText.match(expr) || [];

        if (matches.length === 0) return;

        const result = [];
        let lastIndex = 0;

        for (const match of matches) {
            const start = nodeText.indexOf(match, lastIndex);
            const end = start + match.length;

            result.push(`<div class="inline">${nodeText.slice(lastIndex, start)}</div>`);
            result.push(`<div class="inline bg-gray-500">${match}</div>`);

            lastIndex = end;
        }

        result.push(`<div class="inline">${nodeText.slice(lastIndex)}</div>`);

        map.set(node, result.join(""));

        return;
    }

    /**
     * @param {string} text
     * @returns {Map<HTMLDivElement|HTMLTextAreaElement, string>}
     */
    function searchText(text) {
        text = text.trim();

        /** @type {Map<HTMLDivElement|HTMLTextAreaElement, string>} */
        const matches = new Map();
        const targetElements = searchLocation
            ? [...document.getElementById(`${state}-content`).children]
            : [...contentContainer.children].flatMap((parent) => [...parent.children]);
        const expr = createRegularExpression(text);
        if (!expr) return;

        for (const child of targetElements) {
            const node = child.children[0].children;
            setMatches(matches, expr, node[2]);

            if (!searchTranslation) {
                setMatches(matches, expr, node[1]);
            }
        }

        return matches;
    }

    /**
     * @param {string} id
     * @returns {[HTMLElement, number]}
     */
    // TODO: Heavily refactor
    function displaySearchResults(text = null, hide = true) {
        function showSearchPanel(hide = true) {
            if (hide) {
                if (searchPanel.getAttribute("moving") === "false") {
                    searchPanel.classList.toggle("translate-x-full");
                    searchPanel.classList.toggle("translate-x-0");
                    searchPanel.setAttribute("moving", true);
                }
            } else {
                searchPanel.classList.remove("translate-x-full");
                searchPanel.classList.add("translate-x-0");
                searchPanel.setAttribute("moving", true);
            }

            const searchSwitch = document.getElementById("switch-search-content");

            function handleSearchSwitch() {
                searchPanelFound.classList.toggle("hidden");
                searchPanelFound.classList.toggle("flex");
                searchPanelFound.classList.toggle("flex-col");

                searchPanelReplaced.classList.toggle("hidden");
                searchPanelReplaced.classList.toggle("flex");
                searchPanelReplaced.classList.toggle("flex-col");

                if (searchSwitch.innerHTML.trim() === "search") {
                    searchSwitch.innerHTML = "menu_book";

                    const replacementLogContent = JSON.parse(
                        readFileSync(join(__dirname, "replacement-log.json"), "utf8")
                    );

                    for (const [key, value] of Object.entries(replacementLogContent)) {
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

                        replacedElement.innerHTML = `<div class="text-base text-gray-400">${key}</div>
                            <div class="text-base">${value.original}</div>
                            <div class="flex justify-center items-center text-xl text-white font-material">arrow_downward</div>
                            <div class="text-base">${value.translated}</div>`;

                        searchPanelReplaced.appendChild(replacedElement);
                    }

                    function handleReplacedClick(event) {
                        const element = event.target.parentElement;
                        if (element.hasAttribute("reverted")) return;
                        const clicked = document.getElementById(element.children[0].textContent);

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

                            element.innerHTML = `<div class="inline text-base">Текст на позиции\n<code class="inline">${element.children[0].textContent}</code>\nбыл возвращён к исходному значению\n<code class="inline">${element.children[1].textContent}</code></div>`;
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
            if (searchPanelFound.children.length > 0 && searchPanelFound.children[0].id !== "no-results") {
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
                        for (const child of searchPanelFound.children) {
                            child.classList.toggle("hidden");
                        }

                        if (loadingContainer) searchPanelFound.removeChild(loadingContainer);
                        searchSwitch.addEventListener("click", handleSearchSwitch);
                        searchPanel.setAttribute("shown", "true");
                        searchPanel.setAttribute("moving", false);
                        return;
                    },
                    { once: true }
                );
            } else {
                if (searchPanel.classList.contains("translate-x-full")) {
                    searchPanel.setAttribute("shown", "false");
                    searchPanel.setAttribute("moving", true);

                    searchSwitch.removeEventListener("click", handleSearchSwitch);
                    searchPanel.addEventListener(
                        "transitionend",
                        () => {
                            searchPanel.setAttribute("moving", false);
                        },
                        { once: true }
                    );
                    return;
                }

                for (const child of searchPanelFound.children) {
                    child.classList.toggle("hidden");
                }

                if (loadingContainer) searchPanelFound.removeChild(loadingContainer);
                searchPanel.setAttribute("moving", false);
            }
        }

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

        function handleResultClick(event, currentState, element, resultElement, counterpartIndex) {
            if (event.button === 0) {
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
            } else if (event.button === 2) {
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

        for (const [element, result] of results) {
            const resultElement = document.createElement("div");
            resultElement.classList.add(
                "text-white",
                "text-xl",
                "cursor-pointer",
                "bg-gray-700",
                "my-1",
                "p-1",
                "border-2",
                "border-gray-600",
                "hidden"
            );

            const thirdParent = element.parentElement.parentElement.parentElement;

            const [counterpart, counterpartIndex] = findCounterpart(element.id);
            const [elementParentId, elementId] = extractInfo(element);
            const [counterpartParentId, counterpartId] = extractInfo(counterpart);

            resultElement.innerHTML = `
					<div class="text-base">${result}</div>
					<div class="text-xs text-gray-400">${element.parentElement.parentElement.id.slice(
                        0,
                        element.parentElement.parentElement.id.lastIndexOf("-")
                    )} - ${elementParentId} - ${elementId}</div>
					<div class="flex justify-center items-center text-xl text-white font-material">arrow_downward</div>
					<div class="text-base">${counterpart.tagName === "TEXTAREA" ? counterpart.value : counterpart.innerHTML}</div>
					<div class="text-xs text-gray-400">${counterpart.parentElement.parentElement.id.slice(
                        0,
                        counterpart.parentElement.parentElement.id.lastIndexOf("-")
                    )} - ${counterpartParentId} - ${counterpartId}</div>
				`;

            resultElement.setAttribute("data", `${thirdParent.id},${element.id},${counterpartIndex}`);
            searchPanelFound.appendChild(resultElement);
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
            const [thirdParent, element, counterpartIndex] = resultElement.getAttribute("data").split(",");

            handleResultClick(
                event,
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
            const highlightedReplacement = `<div class="inline bg-red-600">${replacementValue}</div>`;

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

            const mapsLength = readdirSync(join(translationRoot, "maps")).length;
            const otherLength = readdirSync(join(translationRoot, "other")).length;
            const copiesMapsLength = readdirSync(join(copiesRoot, "maps")).length;
            const copiesOtherLength = readdirSync(join(copiesRoot, "other")).length;

            if (copiesMapsLength === mapsLength && copiesOtherLength === otherLength) {
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

                ensureDirSync(join(dirName, "maps"), {
                    recursive: true,
                });

                ensureDirSync(join(dirName, "other"), {
                    recursive: true,
                });
            }

            for (const contentElement of contentContainer.children) {
                const outputArray = [];

                for (const child of contentElement.children) {
                    const node = child.children[0].children[2];

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
        content.classList.add("hidden");

        for (const [i, text] of originalText.entries()) {
            const contentParent = document.createElement("div");
            contentParent.id = `${id}-${i}`;
            contentParent.classList.add("w-full", "z-10");

            const contentChild = document.createElement("div");
            contentChild.classList.add("flex", "flex-row");

            //* Original text field
            const originalTextDiv = document.createElement("div");
            originalTextDiv.id = `${id}-original-${i}`;
            originalTextDiv.textContent = text.replaceAll("\\n", "\n");
            originalTextDiv.classList.add(
                ..."p-1 w-full h-auto text-xl bg-gray-800 outline outline-2 outline-gray-700 mr-2 inline-block whitespace-pre-wrap".split(
                    " "
                )
            );

            //* Translated text field
            const translatedTextInput = document.createElement("textarea");
            const splittedTranslatedText = translatedText[i].split("\\n");
            translatedTextInput.id = `${id}-translated-${i}`;
            translatedTextInput.rows = splittedTranslatedText.length;
            translatedTextInput.value = splittedTranslatedText.join("\n");
            translatedTextInput.classList.add(
                ..."p-1 w-full h-auto text-xl bg-gray-800 resize-none outline outline-2 outline-gray-700 focus:outline-gray-400".split(
                    " "
                )
            );

            //* Row field
            const row = document.createElement("div");
            row.id = `${id}-row-${i}`;
            row.textContent = i;
            row.classList.add(..."p-1 w-36 h-auto text-xl bg-gray-800 outline-none".split(" "));

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
                    document.getElementById(`${previousState}-content`).classList.remove("flex", "flex-col");
                    document.getElementById(`${previousState}-content`).classList.add("hidden");
                    observer.disconnect();
                }

                for (const child of contentParent.children) {
                    observer.observe(child);
                }

                if (slide) {
                    leftPanel.classList.toggle("translate-x-0");
                    leftPanel.classList.toggle("-translate-x-full");
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

                for (const child of contentContainer.children) {
                    child.classList.remove("flex", "flex-col");
                    child.classList.add("hidden");
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
        const lastChild = element.children[element.children.length - 1];
        const lastRow = lastChild.id.slice(lastChild.id.lastIndexOf("-") + 1);

        goToRowInput.placeholder = `Перейти к строке... от 0 до ${lastRow}`;

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
                leftPanel.classList.toggle("translate-x-0");
                leftPanel.classList.toggle("-translate-x-full");
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
                if (event.altKey) {
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
        return;
    }

    // ! Single-call function
    function createContent() {
        const copiesDirs = {
            originalMapText: join(copiesRoot, "maps/maps.txt"),
            translatedMapText: join(copiesRoot, "maps/maps_trans.txt"),
            originalMapNames: join(copiesRoot, "maps/names.txt"),
            translatedMapNames: join(copiesRoot, "maps/names_trans.txt"),
            originalActors: join(copiesRoot, "other/Actors.txt"),
            translatedActors: join(copiesRoot, "other/Actors_trans.txt"),
            originalArmors: join(copiesRoot, "other/Armors.txt"),
            translatedArmors: join(copiesRoot, "other/Armors_trans.txt"),
            originalClasses: join(copiesRoot, "other/Classes.txt"),
            translatedClasses: join(copiesRoot, "other/Classes_trans.txt"),
            originalCommonEvents: join(copiesRoot, "other/CommonEvents.txt"),
            translatedCommonEvents: join(copiesRoot, "other/CommonEvents_trans.txt"),
            originalEnemies: join(copiesRoot, "other/Enemies.txt"),
            translatedEnemies: join(copiesRoot, "other/Enemies_trans.txt"),
            originalItems: join(copiesRoot, "other/Items.txt"),
            translatedItems: join(copiesRoot, "other/Items_trans.txt"),
            originalSkills: join(copiesRoot, "other/Skills.txt"),
            translatedSkills: join(copiesRoot, "other/Skills_trans.txt"),
            originalSystem: join(copiesRoot, "other/System.txt"),
            translatedSystem: join(copiesRoot, "other/System_trans.txt"),
            originalTroops: join(copiesRoot, "other/Troops.txt"),
            translatedTroops: join(copiesRoot, "other/Troops_trans.txt"),
            originalWeapons: join(copiesRoot, "other/Weapons.txt"),
            translatedWeapons: join(copiesRoot, "other/Weapons_trans.txt"),
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
        ];

        const result = new Map();

        for (const [key, path] of Object.entries(copiesDirs)) {
            result.set(key, readFileSync(path, "utf-8").split("\n"));
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

            writeFileSync(join(__dirname, "settings.json"), JSON.stringify(appSettings, null, 4), "utf-8");
        }
        return;
    }
    //#endregion

    //#region Event listeners
    document.addEventListener("keydown", (event) => {
        if (document.activeElement === document.body) handleKeypressBody(event);
        handleKeypressGlobal(event);
        return;
    });

    searchInput.addEventListener("keydown", (event) => {
        handleKeypressSearch(event);
        return;
    });

    leftPanel.addEventListener("click", (event) => {
        changeState(event.target.id);
    });

    document.getElementById("menu-button").addEventListener("click", () => {
        leftPanel.classList.toggle("translate-x-0");
        leftPanel.classList.toggle("-translate-x-full");
        return;
    });

    document.getElementById("search-button").addEventListener("click", () => {
        if (searchInput.value) {
            searchPanelFound.innerHTML = "";
            displaySearchResults(searchInput.value, false);
        } else if (document.activeElement === document.body) {
            searchInput.focus();
        }
        return;
    });

    document.getElementById("replace-button").addEventListener("click", () => {
        if (searchInput.value && replaceInput.value) {
            replaceText(searchInput.value, true);
        }
        return;
    });

    searchCaseButton.addEventListener("click", () => {
        if (!searchRegex) {
            searchCase = !searchCase;
            searchCaseButton.classList.toggle("bg-gray-500");
        }
        return;
    });

    searchWholeButton.addEventListener("click", () => {
        if (!searchRegex) {
            searchWhole = !searchWhole;
            searchWholeButton.classList.toggle("bg-gray-500");
        }
        return;
    });

    searchRegexButton.addEventListener("click", () => {
        searchRegex = !searchRegex;

        searchCase = false;
        searchCaseButton.classList.remove("bg-gray-500");

        searchWhole = false;
        searchWholeButton.classList.remove("bg-gray-500");

        searchRegexButton.classList.toggle("bg-gray-500");
        return;
    });

    searchTranslationButton.addEventListener("click", () => {
        searchTranslation = !searchTranslation;
        searchTranslationButton.classList.toggle("bg-gray-500");
        return;
    });

    searchLocationButton.addEventListener("click", () => {
        searchLocation = !searchLocation;
        searchLocationButton.classList.toggle("bg-gray-500");
        return;
    });

    saveButton.addEventListener("click", save);
    compileButton.addEventListener("click", compile);
    document.getElementById("options-button").addEventListener("click", showOptions);

    document.addEventListener("keydown", (e) => {
        switch (e.key) {
            case "Tab":
                e.preventDefault();
                break;
            case e.altKey:
                e.preventDefault();
                break;
            case "F4" && e.altKey:
                e.preventDefault();

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
                e.preventDefault();

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
    });

    //#endregion
    return;
}

document.addEventListener("DOMContentLoaded", render);
