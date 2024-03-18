const { ipcRenderer } = require("electron");
const {
    constants,
    readFileSync,
    readdirSync,
    ensureDirSync,
    copyFileSync,
    accessSync,
    writeFileSync,
} = require("fs-extra");
const { spawn } = require("child_process");
const { join } = require("path");

const production = false;

function render() {
    //#region Directories
    const copiesRoot = production ? join(__dirname, "../../../../copies") : join(__dirname, "../../copies");
    const backupRoot = production ? join(__dirname, "../../../../backups") : join(__dirname, "../../backups");
    const translationRoot = production
        ? join(__dirname, "../../../../translation")
        : join(__dirname, "../../../translation");

    ensureStart();
    //#endregion

    //#region Main logic
    copy();

    const contentContainer = document.getElementById("content-container");
    const leftPanelElements = document.getElementsByClassName("left-panel-element");
    const searchInput = document.getElementById("search-input");
    const replaceInput = document.getElementById("replace-input");
    const leftPanel = document.getElementById("left-panel");
    const searchPanel = document.getElementById("search-results");
    const saveButton = document.getElementById("save-button");
    const compileButton = document.getElementById("compile-button");
    const searchCaseButton = document.getElementById("case-button");
    const searchWholeButton = document.getElementById("whole-button");
    const searchRegexButton = document.getElementById("regex-button");
    const searchTranslationButton = document.getElementById("translate-button");
    const backupCheck = document.getElementById("backup-check");
    const backupSettings = document.getElementById("backup-settings");
    const backupPeriodInput = document.getElementById("backup-period-input");
    const backupMaxInput = document.getElementById("backup-max-input");
    const goToRowInput = document.getElementById("goto-row-input");

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
    let optionsOpened = false;

    let state = "main";
    let previousState = "main";

    backupCheck.innerHTML = backupEnabled ? "check" : "close";
    backupSettings.classList.toggle("hidden", !backupEnabled);
    backupPeriodInput.value = backupPeriod;
    backupMaxInput.value = backupMax;

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

    function getSettings() {
        try {
            const settings = JSON.parse(readFileSync(join(__dirname, "settings.json"), "utf-8"));

            backupEnabled = settings.backup.enabled;
            backupPeriod = settings.backup.period;
            backupMax = settings.backup.max;
            return;
        } catch (err) {
            alert("Не удалось получить настройки.");
            ipcRenderer.send("quit");
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
                    const { y, x } = node.getBoundingClientRect();

                    nodeYCoordinates.set(node.id, y + margin);
                    nodeXCoordinates.set(node.id, x);
                    margin += 8;
                }

                for (const node of child.children) {
                    const { id } = node;
                    node.style.position = "absolute";
                    node.style.top = `${nodeYCoordinates.get(id)}px`;
                    node.style.left = `${nodeXCoordinates.get(id)}px`;
                    node.style.width = "1840px";
                    node.children[0].classList.add("hidden");
                }

                const lastChild = Array.from(child.children).at(-1);
                child.style.height = `${nodeYCoordinates.get(lastChild.id) - 64}px`;
                child.classList.remove("flex", "flex-col");
                child.classList.add("hidden");
            }

            requestAnimationFrame(() => {
                document.body.classList.remove("invisible");
            });
        });
    }

    function determineLastBackupNumber() {
        const backups = readdirSync(backupRoot);

        if (backups.length === 0) {
            return "00";
        } else {
            return backups.map((backup) => backup.slice(-2)).sort((a, b) => b - a)[0];
        }
    }

    function createRegularExpression(text) {
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
    function setMatches(map, text, node) {
        const expr = createRegularExpression(text);
        const nodeText = node.tagName === "TEXTAREA" ? node.value : node.innerHTML;
        const matches = nodeText.match(expr) || [];

        if (matches.length === 0) {
            return;
        } else {
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
        }

        return;
    }
    /**
     * @param {string} text
     * @returns {Map<HTMLElement, string>}
     */
    function searchText(text) {
        /** @type {Map<HTMLElement, string>} */
        const matches = new Map();

        for (const parent of contentContainer.children) {
            for (const child of parent.children) {
                const node = child.children[0].children;

                if (searchTranslation) {
                    setMatches(matches, text, node[2]);
                } else {
                    for (let i = 1; i < 3; i++) {
                        setMatches(matches, text, node[i]);
                    }
                }
            }
        }

        return matches;
    }

    /**
     * @param {string} id
     * @returns {[HTMLElement, number]}
     */

    function displaySearchResults(text) {
        function findCounterpart(id) {
            if (id.includes("original")) {
                return [document.getElementById(id.replace("original", "translated")), 1];
            } else {
                return [document.getElementById(id.replace("translated", "original")), 0];
            }
        }

        const results = searchText(text);

        if (results.size === 0) {
            searchPanel.innerHTML = `<div class="flex justify-center items-center h-full">Нет совпадений</div>`;
        } else {
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

                const grandGrandParent = element.parentElement.parentElement.parentElement;

                const [counterpart, counterpartIndex] = findCounterpart(element.id);

                /**
                 * @param {HTMLElement} element
                 * @returns {[parentId: string, id: string]}
                 */
                function extractInfo(element) {
                    const parts = element.id.split("-");
                    const parentId = parts[parts.length - 2];
                    const id = parts[parts.length - 1];
                    return [parentId, id];
                }

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

                resultElement.addEventListener("mousedown", (event) => {
                    if (event.button === 0) {
                        const currentState = grandGrandParent.id.replace("-content", "");

                        changeState(currentState, false);

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
                        } else {
                            if (replaceInput.value.trim()) {
                                const newText = replaceText(element);

                                if (newText) {
                                    const index = counterpartIndex === 1 ? 3 : 0;
                                    resultElement.children[index].innerHTML = newText;
                                }
                            }
                        }
                    }
                });

                searchPanel.append(resultElement);
            }
        }

        let showAfterTranslation = false;
        if (!searchPanel.classList.contains("translate-x-0")) {
            searchPanel.classList.remove("translate-x-full");
            searchPanel.classList.add("translate-x-0");
            showAfterTranslation = true;
        }

        const loadingContainer = document.createElement("div");
        loadingContainer.classList.add("flex", "justify-center", "items-center", "h-full", "w-full");
        loadingContainer.innerHTML = `<div class="text-4xl animate-spin font-material">refresh</div>`;
        searchPanel.appendChild(loadingContainer);

        if (showAfterTranslation) {
            searchPanel.addEventListener("transitionend", function handleTransitionEnd() {
                for (const child of searchPanel.children) {
                    child.classList.remove("hidden");
                }
                searchPanel.removeChild(loadingContainer);
                searchPanel.removeEventListener("transitionend", handleTransitionEnd);
            });
        } else {
            for (const child of searchPanel.children) {
                child.classList.remove("hidden");
            }
            searchPanel.removeChild(loadingContainer);
        }
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

            text.value = newText.join(replacementValue);
            return newTextParts.join("");
        }

        const results = searchText(text);
        if (results.size === 0) return;

        const regex = createRegularExpression(text);

        for (const textarea of results.keys()) {
            if (!textarea.id.includes("original")) textarea.value = textarea.value.replace(regex, replaceInput.value);
        }

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
                console.log("Files are already copied.");
                return true;
            }

            console.log("Files are not copied yet.");
            return false;
        }

        if (isCopied()) return;

        console.log("Copying files...");

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

                if (nextBackupNumber === 99) {
                    nextBackupNumber = 1;
                }

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
                    writeFileSync(dir, outputArray.join("\n"), "utf-8");
                }
            }

            setTimeout(() => {
                saveButton.classList.remove("animate-spin");
            }, 1000);
        });
        return;
    }

    function backup(s) {
        if (backupEnabled) {
            setTimeout(() => {
                save(true);
                backup(s);
            }, s * 1000);
        } else {
            return;
        }
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
            originalTextDiv.innerHTML = text.replaceAll("\\n", "\n");
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
            row.innerHTML = i;
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

        pageLoadedDisplay.innerHTML = "refresh";
        pageLoadedDisplay.classList.toggle("animate-spin");

        currentState.innerHTML = newState;

        requestAnimationFrame(() => {
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

                console.log(`Current state is ${newState}`);
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
        if (state === newState) {
            return;
        }

        switch (newState) {
            case "main":
                state = "main";
                currentState.innerHTML = "";
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
                searchPanel.classList.toggle("translate-x-full");
                searchPanel.classList.toggle("translate-x-0");

                const loadingContainer = document.createElement("div");
                loadingContainer.classList.add("flex", "justify-center", "items-center", "h-full", "w-full");
                loadingContainer.innerHTML = searchPanel.classList.contains("translate-x-0")
                    ? `<div class="text-4xl animate-spin font-material">refresh</div>`
                    : "";

                searchPanel.appendChild(loadingContainer);

                searchPanel.addEventListener("transitionend", function handleTransitionEnd() {
                    for (const child of searchPanel.children) {
                        child.classList.toggle("hidden");
                    }

                    searchPanel.removeChild(loadingContainer);
                    searchPanel.removeEventListener("transitionend", handleTransitionEnd);
                });
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
                    const focusedElement = document.activeElement;
                    const idParts = focusedElement.id.split("-");
                    const index = parseInt(idParts.pop()) + 1;
                    const elementToFocus = document.getElementById(`${idParts.join("-")}-${index}`);

                    if (elementToFocus) {
                        window.scrollBy(0, elementToFocus.clientHeight + 8);
                        focusedElement.blur();
                        elementToFocus.focus();
                        elementToFocus.setSelectionRange(0, 0);
                    }
                }

                if (event.ctrlKey) {
                    const focusedElement = document.activeElement;
                    const idParts = focusedElement.id.split("-");
                    const index = parseInt(idParts.pop()) - 1;
                    const elementToFocus = document.getElementById(`${idParts.join("-")}-${index}`);

                    if (elementToFocus) {
                        window.scrollBy(0, -elementToFocus.clientHeight - 8);
                        focusedElement.blur();
                        elementToFocus.focus();
                        elementToFocus.setSelectionRange(0, 0);
                    }
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
                if (searchInput.value) {
                    searchPanel.innerHTML = "";
                    displaySearchResults(searchInput.value.trim());
                } else {
                    searchPanel.innerHTML = `<div class="flex justify-center items-center h-full">Результатов нет</div>`;
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

        const writer = spawn(join(__dirname, "../resources/write.exe"), [], {
            cwd: join(__dirname, "../resources"),
        });

        let error = false;

        writer.stderr.on("data", (err) => {
            alert(`Не удалось записать файлы: ${err}`);
            error = true;
        });

        writer.on("close", () => {
            compileButton.classList.remove("animate-spin");
            if (!error) alert("Все файлы записаны успешно.");
            else alert("Файлы не были записаны.");
        });

        return;
    }

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

        if (backupPeriod < 60) {
            backupPeriodInput.value = 60;
        } else if (backupPeriod > 3600) {
            backupPeriodInput.value = 3600;
        }

        return;
    }

    function handleBackupMax() {
        backupMax = parseInt(backupMaxInput.value);

        if (backupMax < 1) {
            backupMaxInput.value = 1;
        } else if (backupMax > 100) {
            backupMaxInput.value = 100;
        }

        return;
    }

    function showOptions() {
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

    for (const element of leftPanelElements) {
        element.addEventListener("click", () => {
            changeState(element.id);
            return;
        });
    }

    document.getElementById("menu-button").addEventListener("click", () => {
        leftPanel.classList.toggle("translate-x-0");
        leftPanel.classList.toggle("-translate-x-full");
        return;
    });

    document.getElementById("search-button").addEventListener("click", () => {
        if (searchInput.value) {
            searchPanel.innerHTML = "";
            displaySearchResults(searchInput.value.trim());
        } else if (document.activeElement === document.body) {
            searchInput.focus();
        } else {
            searchPanel.innerHTML = `<div class="flex justify-center items-center h-full">Результатов нет</div>`;
        }
        return;
    });

    document.getElementById("replace-button").addEventListener("click", () => {
        if (searchInput.value && replaceInput.value) {
            replaceText(searchInput.value.trim(), true);
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

        if (searchCase) {
            searchCase = false;
            searchCaseButton.classList.remove("bg-gray-500");
        }

        if (searchWhole) {
            searchWhole = false;
            searchWholeButton.classList.remove("bg-gray-500");
        }

        searchRegexButton.classList.toggle("bg-gray-500");
        return;
    });

    searchTranslationButton.addEventListener("click", () => {
        searchTranslation = !searchTranslation;
        searchTranslationButton.classList.toggle("bg-gray-500");
        return;
    });

    saveButton.addEventListener("click", save);
    compileButton.addEventListener("click", compile);
    document.getElementById("options-button").addEventListener("click", showOptions);

    //#endregion
    return;
}

document.addEventListener("DOMContentLoaded", render);
document.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
        e.preventDefault();
    }

    if (e.altKey) {
        e.preventDefault();
    }

    return;
});
