const { copyFile, exists, readDir, readTextFile, removeDir, removeFile, writeTextFile, createDir } =
    window.__TAURI__.fs;
const { BaseDirectory, join } = window.__TAURI__.path;
const { ask, message } = window.__TAURI__.dialog;
const { invoke } = window.__TAURI__.tauri;
const { exit } = window.__TAURI__.process;
const { appWindow, WebviewWindow } = window.__TAURI__.window;
const { writeText: clipboardWrite, readText: clipboardRead } = window.__TAURI__.clipboard;
const { locale } = window.__TAURI__.os;

String.prototype.replaceAllMultiple = function (replacementObj) {
    return this.replaceAll(Object.keys(replacementObj).join("|"), (match) => replacementObj[match]);
};

String.prototype.countChars = function (char) {
    let occurrences = 0;

    for (let i = 0; i < this.length; i++) {
        if (char === this[i]) {
            occurrences++;
        }
    }

    return occurrences;
};

HTMLElement.prototype.toggleMultiple = function (...classes) {
    for (const className of classes) {
        this.classList.toggle(className);
    }
};

HTMLElement.prototype.secondHighestParent = function (childElement) {
    let parent = childElement.parentElement;
    let previous = childElement;

    while (parent !== this) {
        previous = parent;
        parent = parent.parentElement;
    }

    return previous;
};

HTMLTextAreaElement.prototype.calculateHeight = function () {
    const lineBreaks = this.value.countChars("\n") + 1;

    const { lineHeight, paddingTop, paddingBottom, borderTopWidth, borderBottomWidth } = window.getComputedStyle(this);

    const newHeight =
        lineBreaks * Number.parseFloat(lineHeight) +
        Number.parseFloat(paddingTop) +
        Number.parseFloat(paddingBottom) +
        Number.parseFloat(borderTopWidth) +
        Number.parseFloat(borderBottomWidth);

    for (const child of this.parentElement.children) {
        child.style.height = `${newHeight}px`;
    }
};

document.addEventListener("DOMContentLoaded", async () => {
    const resourceDir = "res";
    const translationDir = "translation";
    const originalDir = "original";
    const copiesDir = "copies";
    const backupDir = "backups";
    const repoDir = "repo";

    const mapsDir = "maps";
    const otherDir = "other";
    const pluginsDir = "plugins";

    const settingsFile = "settings.json";
    const logFile = "replacement-log.json";

    async function copyDir(sourceDir, targetDir, fsOptions) {
        await createDir(targetDir, fsOptions);

        for (const file of await readDir(sourceDir, fsOptions)) {
            if (file.children) {
                await copyDir(await join(sourceDir, file.name), await join(targetDir, file.name), fsOptions);
            } else {
                await copyFile(await join(sourceDir, file.name), await join(targetDir, file.name), fsOptions);
            }
        }
    }

    async function getSettings() {
        if (await exists(await join(resourceDir, settingsFile), { dir: BaseDirectory.Resource })) {
            const settings = JSON.parse(
                await readTextFile(await join(resourceDir, settingsFile), { dir: BaseDirectory.Resource })
            );

            mainLanguage =
                settings.lang === "ru"
                    ? JSON.parse(
                          await readTextFile(await join(resourceDir, "ru.json"), { dir: BaseDirectory.Resource })
                      ).main
                    : JSON.parse(
                          await readTextFile(await join(resourceDir, "en.json"), { dir: BaseDirectory.Resource })
                      ).main;

            return settings;
        }

        const systemLocale = await locale();
        mainLanguage = systemLocale.startsWith("ru")
            ? JSON.parse(await readTextFile(await join(resourceDir, "ru.json"), { dir: BaseDirectory.Resource })).main
            : JSON.parse(await readTextFile(await join(resourceDir, "en.json"), { dir: BaseDirectory.Resource })).main;

        await message(mainLanguage.cannotGetSettings);
        const askCreateSettings = await ask(mainLanguage.askCreateSettings);

        if (askCreateSettings) {
            await writeTextFile(
                await join(resourceDir, settingsFile),
                JSON.stringify({
                    backup: { enabled: true, period: 60, max: 99 },
                    lang: systemLocale.split("-")[0],
                    firstLaunch: true,
                }),
                {
                    dir: BaseDirectory.Resource,
                }
            );

            alert(mainLanguage.createdSettings);
            return JSON.parse(
                await readTextFile(await join(resourceDir, settingsFile), { dir: BaseDirectory.Resource })
            );
        } else {
            await exit(0);
        }
    }

    async function cloneRepository() {
        function animateEllipsis() {
            if (!progressText.textContent.endsWith("...")) {
                progressText.textContent += ".";
                setTimeout(animateEllipsis, 500);
            } else if (progressText.textContent.endsWith("...")) {
                progressText.innerHTML = progressText.textContent.slice(0, -3);
                setTimeout(animateEllipsis, 500);
            }
        }

        const progressDisplay = document.getElementById("progress-display");
        const progressText = document.getElementById("progress-text");
        const progressStatus = document.getElementById("progress-status");
        progressText.innerHTML = mainLanguage.downloadingTranslation;

        progressDisplay.classList.replace("hidden", "flex");
        animateEllipsis();

        let downloading = true;

        const unlistenProgress = await appWindow.listen("progress", (event) => {
            if (event.payload !== "ended") {
                progressStatus.innerHTML = `${event.payload} ${mainLanguage.mb}`;
            } else {
                downloading = false;
            }
        });

        await appWindow.emit("clone");

        async function awaitDownload() {
            try {
                if (downloading) {
                    throw null;
                }
            } catch (err) {
                await new Promise((resolve) => setTimeout(resolve, 2000));
                await awaitDownload();
            }
        }

        await awaitDownload();

        unlistenProgress();
        progressDisplay.remove();
    }

    async function changeLanguage(language) {
        await awaitSaving();

        if (await exitProgram()) {
            const settings = JSON.parse(
                await readTextFile(await join(resourceDir, settingsFile), { dir: BaseDirectory.Resource })
            );

            await writeTextFile(
                await join(resourceDir, settingsFile),
                JSON.stringify({ ...settings, lang: language }),
                {
                    dir: BaseDirectory.Resource,
                }
            );

            location.reload();
        }
    }

    async function prepareTranslation() {
        const dirsToLeave = [translationDir, originalDir];

        const repoDirPath = await join(resourceDir, repoDir);
        const repositoryExists = await exists(repoDirPath, {
            dir: BaseDirectory.Resource,
        });

        if (repositoryExists) {
            await removeDir(repoDirPath, {
                dir: BaseDirectory.Resource,
                recursive: true,
            });
        }

        await cloneRepository();

        for (const dir of await readDir(repoDirPath, {
            dir: BaseDirectory.Resource,
        })) {
            if (dirsToLeave.includes(dir.name)) {
                await copyDir(await join(repoDirPath, dir.name), await join(resourceDir, dir.name), {
                    dir: BaseDirectory.Resource,
                    recursive: true,
                });
            }
        }

        await removeDir(repoDirPath, { dir: BaseDirectory.Resource, recursive: true });
    }

    async function ensureStart() {
        const dirs = [mapsDir, otherDir, pluginsDir];

        for (const dir of dirs) {
            if (!(await exists(await join(resourceDir, translationDir, dir), { dir: BaseDirectory.Resource }))) {
                if (await ask(mainLanguage.askDownloadTranslation)) {
                    await prepareTranslation();
                    alert(mainLanguage.downloadedTranslation);
                } else if (await ask(mainLanguage.startBlankProject)) {
                    await prepareTranslation();

                    const files = await readDir(await join(resourceDir, translationDir, dir), {
                        dir: BaseDirectory.Resource,
                        recursive: true,
                    });

                    for (const file of files
                        .flatMap((dir) => dir.children)
                        .filter((file) => file.name.endsWith("_trans.txt"))) {
                        const numberOfLines = (
                            await readTextFile(await join(resourceDir, translationDir, dir, file.name), {
                                dir: BaseDirectory.Resource,
                            })
                        ).countChars("\n");

                        await removeFile(await join(resourceDir, translationDir, dir, file.name), {
                            dir: BaseDirectory.Resource,
                        });

                        await writeTextFile(
                            await join(resourceDir, translationDir, dir, file.name),
                            "\n".repeat(numberOfLines),
                            { dir: BaseDirectory.Resource }
                        );
                    }
                } else {
                    await message(mainLanguage.whatNext);
                    await exit(0);
                }
                return;
            }
        }
    }

    function arrangeElements() {
        for (const child of contentContainer.children) {
            child.toggleMultiple("hidden", "flex");

            const heights = new Uint32Array(child.children.length);
            let i = 0;

            for (const node of child.children) {
                heights.set([node.firstElementChild.children[1].clientHeight], i);
                i++;
            }

            i = 0;
            for (const node of child.children) {
                node.style.minHeight = `${heights[i] + 8}px`;
                node.firstElementChild.style.minHeight = `${heights[i]}px`;

                for (const child of node.firstElementChild.children) {
                    child.style.minHeight = `${heights[i]}px`;
                }

                node.firstElementChild.classList.add("hidden");
                i++;
            }

            child.style.minHeight = `${child.scrollHeight}px`;
            child.toggleMultiple("hidden", "flex");

            document.body.firstElementChild.classList.remove("invisible");
        }
    }

    async function determineLastBackupNumber() {
        const backups = await readDir(await join(resourceDir, backupDir), { dir: BaseDirectory.Resource });
        return backups.length === 0 ? "00" : backups.map((backup) => backup.name.slice(-2)).sort((a, b) => b - a)[0];
    }

    async function createRegExp(text) {
        text = text.trim();
        if (!text) {
            return;
        }

        const regexp = await invoke("unescape_text", {
            text: text,
            option: searchRegex ? "regex" : searchWhole ? "whole" : "none",
        }).then((regexp) => regexp);

        const attr = searchCase ? "g" : "gi";

        try {
            return new RegExp(regexp, attr);
        } catch (err) {
            await message(`${mainLanguage.invalidRegexp} (${text.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")}), err`);
            return;
        }
    }

    function appendMatch(element, result) {
        const resultContainer = document.createElement("div");

        const resultElement = document.createElement("div");
        resultElement.classList.add("search-result");

        const thirdParent = element.parentElement.parentElement.parentElement;

        const [counterpartElement, sourceIndex] = findCounterpart(element.id);
        const [source, row] = extractInfo(element);

        const mainDiv = document.createElement("div");
        mainDiv.classList.add("text-base");

        const resultDiv = document.createElement("div");
        resultDiv.innerHTML = result;
        mainDiv.appendChild(resultDiv);

        const originalInfo = document.createElement("div");
        originalInfo.classList.add("text-xs", "text-zinc-400");

        const currentFile = element.parentElement.parentElement.id.slice(
            0,
            element.parentElement.parentElement.id.lastIndexOf("-")
        );
        originalInfo.innerHTML = `${currentFile} - ${source} - ${row}`;
        mainDiv.appendChild(originalInfo);

        const arrow = document.createElement("div");
        arrow.classList.add("search-result-arrow");
        arrow.innerHTML = "arrow_downward";
        mainDiv.appendChild(arrow);

        const counterpart = document.createElement("div");
        counterpart.innerHTML =
            counterpartElement.tagName === "TEXTAREA"
                ? counterpartElement.value.replaceAllMultiple({ "<": "&lt;", ">": "&gt;" })
                : counterpartElement.innerHTML.replaceAllMultiple({ "<": "&lt;", ">": "&gt;" });
        mainDiv.appendChild(counterpart);

        const counterpartInfo = document.createElement("div");
        counterpartInfo.classList.add("text-xs", "text-zinc-400");

        counterpartInfo.innerHTML = `${currentFile} - ${sourceIndex === 0 ? "original" : "translation"} - ${row}`;
        mainDiv.appendChild(counterpartInfo);

        resultElement.appendChild(mainDiv);

        resultElement.setAttribute("data", `${thirdParent.id},${element.id},${sourceIndex}`);
        resultContainer.appendChild(resultElement);
        searchPanelFound.appendChild(resultContainer);
    }

    function createMatchesContainer(elementText, matches) {
        const result = [];
        let lastIndex = 0;

        for (const match of matches) {
            const start = elementText.indexOf(match, lastIndex);
            const end = start + match.length;

            const beforeDiv = `<span>${elementText.slice(lastIndex, start)}</span>`;
            const matchDiv = `<span class="bg-zinc-500">${match}</span>`;

            result.push(beforeDiv);
            result.push(matchDiv);

            lastIndex = end;
        }

        const afterDiv = `<span>${elementText.slice(lastIndex)}</span>`;
        result.push(afterDiv);

        return result.join("");
    }

    async function searchText(text, replace) {
        const regexp = await createRegExp(text);
        if (!regexp) {
            return;
        }

        for (const file of await readDir(resourceDir, { dir: BaseDirectory.Resource })) {
            if (file.name.startsWith("matches")) {
                await removeFile(await join(resourceDir, file.name), { dir: BaseDirectory.Resource });
            }
        }

        let results = new Map();
        let objectToWrite = {};
        let count = 1;
        let file = 0;

        for (const child of searchLocation
            ? [...document.getElementById(state).children]
            : [...contentContainer.children].flatMap((parent) => [...parent.children])) {
            const node = child.firstElementChild.children;

            {
                const elementText = node[2].value.replaceAllMultiple({ "<": "&lt;", ">": "&gt;" });
                const matches = elementText.match(regexp);

                if (matches) {
                    const result = createMatchesContainer(elementText, matches);

                    if (replace) {
                        results.set(node[2], result);
                    } else {
                        objectToWrite[node[2].id] = result;
                        results = false;
                    }

                    count++;
                }
            }

            if (!searchTranslation) {
                const elementText = node[1].innerHTML.replaceAllMultiple({ "<": "&lt;", ">": "&gt;" });
                const matches = elementText.match(regexp);

                if (matches) {
                    const result = createMatchesContainer(elementText, matches);

                    if (replace) {
                        results.set(node[1], result);
                    } else {
                        objectToWrite[node[1].id] = result;
                        results = false;
                    }

                    count++;
                }
            }

            if (count % 1000 === 0) {
                await writeTextFile(await join(resourceDir, `matches-${file}.json`), JSON.stringify(objectToWrite), {
                    dir: BaseDirectory.Resource,
                });

                objectToWrite = {};
                file++;
            }
        }

        if (file === 0) {
            await writeTextFile(await join(resourceDir, "matches-0.json"), JSON.stringify(objectToWrite), {
                dir: BaseDirectory.Resource,
            });
        }

        searchTotalPages.textContent = file;
        searchCurrentPage.textContent = "0";

        for (const [id, result] of Object.entries(
            JSON.parse(await readTextFile(await join(resourceDir, "matches-0.json"), { dir: BaseDirectory.Resource }))
        )) {
            appendMatch(document.getElementById(id), result);
        }

        return results;
    }

    async function handleReplacedClick(event) {
        const element = event.target.classList.contains("replaced-element") ? event.target : event.target.parentElement;

        if (element.hasAttribute("reverted") || !searchPanelReplaced.contains(element)) {
            return;
        }

        const clicked = document.getElementById(element.firstElementChild.textContent);

        if (event.button === 0) {
            changeState(clicked.parentElement.parentElement.parentElement.id);

            clicked.parentElement.parentElement.scrollIntoView({
                block: "center",
                inline: "center",
            });
        } else if (event.button === 2) {
            clicked.value = element.children[1].textContent;

            element.innerHTML = `<span class="text-base"><code>${element.firstElementChild.textContent}</code>\n${mainLanguage.textReverted}\n<code>${element.children[1].textContent}</code></span>`;
            element.setAttribute("reverted", "");

            const replacementLogContent = JSON.parse(
                await readTextFile(await join(resourceDir, logFile), { dir: BaseDirectory.Resource })
            );

            delete replacementLogContent[clicked.id];

            await writeTextFile(await join(resourceDir, logFile), JSON.stringify(replacementLogContent), {
                dir: BaseDirectory.Resource,
            });
        }
    }

    function showSearchPanel(hide = true) {
        if (JSON.parse(searchPanel.getAttribute("moving")) === false) {
            if (hide) {
                searchPanel.toggleMultiple("translate-x-0", "translate-x-full");
            } else {
                searchPanel.classList.replace("translate-x-full", "translate-x-0");
            }
            searchPanel.setAttribute("moving", true);
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

        if (JSON.parse(searchPanel.getAttribute("shown")) === false) {
            searchPanel.addEventListener(
                "transitionend",
                () => {
                    if (loadingContainer) {
                        searchPanelFound.removeChild(loadingContainer);
                    }
                    searchPanel.setAttribute("shown", true);
                    searchPanel.setAttribute("moving", false);
                },
                { once: true }
            );
        } else {
            if (searchPanel.classList.contains("translate-x-full")) {
                searchPanel.setAttribute("shown", false);
                searchPanel.setAttribute("moving", true);

                searchPanel.addEventListener("transitionend", () => searchPanel.setAttribute("moving", false), {
                    once: true,
                });
                return;
            }

            if (loadingContainer) {
                searchPanelFound.removeChild(loadingContainer);
            }
            searchPanel.setAttribute("moving", false);
        }
    }

    function findCounterpart(id) {
        if (id.includes(originalDir)) {
            return [document.getElementById(id.replace(originalDir, translationDir)), 1];
        } else {
            return [document.getElementById(id.replace(translationDir, originalDir)), 0];
        }
    }

    function extractInfo(element) {
        const parts = element.id.split("-");
        const source = parts[1];
        const row = parts[2];
        return [source, row];
    }

    async function handleResultClick(button, currentState, element, resultElement, counterpartIndex) {
        if (button === 0) {
            changeState(currentState.id);

            element.parentElement.parentElement.scrollIntoView({
                block: "center",
                inline: "center",
            });
        } else if (button === 2) {
            if (element.id.includes(originalDir)) {
                alert(mainLanguage.originalTextIrreplacable);
                return;
            } else {
                if (replaceInput.value.trim()) {
                    const newText = await replaceText(element, false);

                    if (newText) {
                        saved = false;
                        const index = counterpartIndex === 1 ? 3 : 0;
                        resultElement.children[index].innerHTML = newText;
                    }
                    return;
                }
            }
        }
    }

    async function handleResultSelecting(event) {
        const resultElement = event.target.parentElement.hasAttribute("data")
            ? event.target.parentElement
            : event.target.parentElement.parentElement.hasAttribute("data")
            ? event.target.parentElement.parentElement
            : event.target.parentElement.parentElement.parentElement;

        if (!searchPanelFound.contains(resultElement)) {
            return;
        }

        const [thirdParent, element, counterpartIndex] = resultElement.getAttribute("data").split(",");

        await handleResultClick(
            event.button,
            document.getElementById(thirdParent),
            document.getElementById(element),
            resultElement,
            Number.parseInt(counterpartIndex)
        );
    }

    async function displaySearchResults(text = null, hide = true) {
        if (!text) {
            showSearchPanel(hide);
            return;
        }

        text = text.trim();
        if (!text) {
            return;
        }

        const noMatches = await searchText(text, false);

        if (noMatches) {
            searchPanelFound.innerHTML = `<div id="no-results" class="flex justify-center items-center h-full">${mainLanguage.noMatches}</div>`;
            showSearchPanel(false);
            return;
        }

        observerFound.disconnect();
        searchPanelFound.style.height = `${searchPanelFound.scrollHeight}px`;

        for (const container of searchPanelFound.children) {
            container.style.width = `${container.clientWidth}px`;
            container.style.height = `${container.clientHeight}px`;

            observerFound.observe(container);
        }

        for (const container of searchPanelFound.children) {
            container.firstElementChild.classList.add("hidden");
        }

        showSearchPanel(hide);

        searchPanelFound.removeEventListener("mousedown", async (event) => await handleResultSelecting(event));
        searchPanelFound.addEventListener("mousedown", async (event) => await handleResultSelecting(event));
    }

    async function replaceText(text, replaceAll) {
        if (!replaceAll) {
            const regexp = await createRegExp(searchInput.value);
            if (!regexp) {
                return;
            }

            const replacementValue = replaceInput.value;

            const highlightedReplacement = document.createElement("span");
            highlightedReplacement.classList.add("bg-red-600");
            highlightedReplacement.textContent = replacementValue;

            const newText = text.value.split(regexp);
            const newTextParts = newText.flatMap((part, i) => [
                part,
                i < newText.length - 1 ? highlightedReplacement : "",
            ]);

            const newValue = newText.join(replacementValue);

            replaced.set(text.id, { original: text.value, translation: newValue });
            const prevFile = JSON.parse(
                await readTextFile(await join(resourceDir, logFile), { dir: BaseDirectory.Resource })
            );
            const newObject = { ...prevFile, ...Object.fromEntries([...replaced]) };

            await writeTextFile(await join(resourceDir, logFile), JSON.stringify(newObject), {
                dir: BaseDirectory.Resource,
            });
            replaced.clear();

            text.value = newValue;
            return newTextParts.join("");
        }

        text = text.trim();
        if (!text) {
            return;
        }

        const results = await searchText(text, true);
        if (!results) {
            return;
        }

        const regexp = await createRegExp(text);
        if (!regexp) {
            return;
        }

        for (const textarea of results.keys()) {
            if (!textarea.id.includes(originalDir)) {
                const newValue = textarea.value.replace(regexp, replaceInput.value);

                replaced.set(textarea.id, {
                    original: textarea.value,
                    translation: newValue,
                });

                textarea.value = newValue;
            }
        }

        const prevFile = JSON.parse(
            await readTextFile(await join(resourceDir, logFile), { dir: BaseDirectory.Resource })
        );
        const newObject = { ...prevFile, ...Object.fromEntries([...replaced]) };

        await writeTextFile(await join(resourceDir, logFile), JSON.stringify(newObject), {
            dir: BaseDirectory.Resource,
        });
        replaced.clear();
    }

    async function isFilesCopied() {
        let copied = true;

        for (const dir of await readDir(await join(resourceDir, translationDir), {
            dir: BaseDirectory.Resource,
            recursive: true,
        })) {
            await createDir(await join(resourceDir, copiesDir, dir.name), {
                dir: BaseDirectory.Resource,
                recursive: true,
            });

            if (
                dir.children.length !==
                (
                    await readDir(await join(resourceDir, copiesDir, dir.name), {
                        dir: BaseDirectory.Resource,
                    })
                ).length
            ) {
                copied = false;
            }
        }

        return copied;
    }

    async function createFilesCopies() {
        if (await isFilesCopied()) {
            return;
        }

        for (const folder of await readDir(await join(resourceDir, translationDir), {
            dir: BaseDirectory.Resource,
            recursive: true,
        })) {
            for (const file of folder.children) {
                await copyFile(
                    await join(resourceDir, translationDir, folder.name, file.name),
                    await join(resourceDir, copiesDir, folder.name, file.name),
                    { dir: BaseDirectory.Resource }
                );
            }
        }
    }

    async function save(backup = false) {
        if (saving) {
            return;
        }

        saving = true;
        saveButton.firstElementChild.classList.add("animate-spin");

        let dirName = await join(resourceDir, copiesDir);

        if (backup) {
            const date = new Date();
            const formattedDate = [
                date.getFullYear(),
                (date.getMonth() + 1).toString().padStart(2, "0"),
                date.getDate().toString().padStart(2, "0"),
                date.getHours().toString().padStart(2, "0"),
                date.getMinutes().toString().padStart(2, "0"),
                date.getSeconds().toString().padStart(2, "0"),
            ].join("-");

            nextBackupNumber = (nextBackupNumber % backupMax) + 1;

            dirName = await join(
                resourceDir,
                backupDir,
                `${formattedDate}_${nextBackupNumber.toString().padStart(2, "0")}`
            );

            for (const subDir of [mapsDir, otherDir, pluginsDir]) {
                await createDir(await join(dirName, subDir), { dir: BaseDirectory.Resource, recursive: true });
            }
        }

        let i = 0;
        for (const contentElement of contentContainer.children) {
            const outputArray = [];

            for (const child of contentElement.children) {
                const node = child.firstElementChild.children[2];
                outputArray.push(node.value.replaceAll("\n", "\\n"));
            }

            const dirPath = i < 2 ? mapsDir : i < 12 ? otherDir : pluginsDir;
            const filePath = `${dirPath}/${contentElement.id}_trans.txt`;

            await writeTextFile(await join(dirName, filePath), outputArray.join("\n"), {
                dir: BaseDirectory.Resource,
            });
            i++;
        }

        if (!backup) {
            saved = true;
        }

        saveButton.firstElementChild.classList.remove("animate-spin");
        saving = false;
    }

    function backup(s) {
        if (!backupEnabled) {
            return;
        }

        setTimeout(async () => {
            if (backupEnabled) {
                await save(true);
                backup(s);
            }
        }, s * 1000);
    }

    function updateState(newState, slide = true) {
        currentState.innerHTML = newState;

        const contentParent = document.getElementById(newState);
        contentParent.classList.replace("hidden", "flex");

        if (statePrevious) {
            const previousStateContainer = document.getElementById(statePrevious);

            if (previousStateContainer) {
                previousStateContainer.toggleMultiple("flex", "hidden");
            }

            observerMain.disconnect();
        }

        for (const child of contentParent.children) {
            observerMain.observe(child);
        }

        if (slide) {
            leftPanel.toggleMultiple("-translate-x-full", "translate-x-0");
        }
    }

    function changeState(newState, slide = false) {
        if (state === newState) {
            return;
        }

        switch (newState) {
            case null:
                state = null;
                currentState.innerHTML = "";

                observerMain.disconnect();
                for (const child of contentContainer.children) {
                    child.classList.replace("flex", "hidden");
                }
                break;
            default:
                statePrevious = state;
                state = newState;
                updateState(newState, slide);
                break;
        }
    }

    function goToRow() {
        goToRowInput.classList.remove("hidden");
        goToRowInput.focus();

        const element = document.getElementById(state);
        const lastRow = element.lastElementChild.id.split("-").at(-1);

        goToRowInput.placeholder = `Перейти к строке... от 1 до ${lastRow}`;
        goToRowInput.addEventListener(
            "keydown",
            (event) => {
                if (event.code === "Enter") {
                    const rowNumber = goToRowInput.value;
                    const targetRow = document.getElementById(`${state}-${rowNumber}`);

                    if (targetRow) {
                        targetRow.scrollIntoView({
                            block: "center",
                            inline: "center",
                        });
                    }

                    goToRowInput.value = "";
                    goToRowInput.classList.add("hidden");
                }

                if (event.code === "Escape") {
                    goToRowInput.value = "";
                    goToRowInput.classList.add("hidden");
                }
            },
            { once: true }
        );
    }
    function jumpToRow(key) {
        const focusedElement = document.activeElement;
        if (!contentContainer.contains(focusedElement) && focusedElement.tagName !== "TEXTAREA") {
            return;
        }

        const idParts = focusedElement.id.split("-");
        const index = Number.parseInt(idParts.pop());
        const baseId = idParts.join("-");

        if (isNaN(index)) {
            return;
        }

        const step = key === "alt" ? 1 : -1;
        const nextIndex = index + step;
        const nextElementId = `${baseId}-${nextIndex}`;
        const nextElement = document.getElementById(nextElementId);

        if (!nextElement) {
            return;
        }

        const scrollOffset = nextElement.clientHeight + 8;
        window.scrollBy(0, step * scrollOffset);
        focusedElement.blur();
        nextElement.focus();
        nextElement.setSelectionRange(0, 0);
    }

    async function handleKeypress(event) {
        if (event.key === "Tab") {
            event.preventDefault();
        }

        if (document.activeElement === document.body) {
            switch (event.code) {
                case "Escape":
                    changeState(null);
                    break;
                case "Tab":
                    leftPanel.toggleMultiple("translate-x-0", "-translate-x-full");
                    break;
                case "KeyR":
                    await displaySearchResults();
                    break;
                case "KeyZ":
                    if (event.ctrlKey) {
                        event.preventDefault();

                        for (const key of selectedTextareas.keys()) {
                            const textarea = document.getElementById(key);
                            textarea.value = selectedTextareas.get(key);
                        }

                        for (const key of replacedTextareas.keys()) {
                            const textarea = document.getElementById(key);
                            textarea.value = replacedTextareas.get(key);
                            textarea.calculateHeight();
                        }

                        replacedTextareas.clear();
                    }
                    break;
                case "KeyS":
                    if (event.ctrlKey) {
                        await save();
                    }
                    break;
                case "KeyC":
                    if (event.altKey) {
                        await compile();
                    }
                    break;
                case "Digit1":
                    changeState(mapsDir);
                    break;
                case "Digit2":
                    changeState("names");
                    break;
                case "Digit3":
                    changeState("actors");
                    break;
                case "Digit4":
                    changeState("armors");
                    break;
                case "Digit5":
                    changeState("classes");
                    break;
                case "Digit6":
                    changeState("commonevents");
                    break;
                case "Digit7":
                    changeState("enemies");
                    break;
                case "Digit8":
                    changeState("items");
                    break;
                case "Digit9":
                    changeState("skills");
                    break;
                case "Digit0":
                    changeState("system");
                    break;
                case "Minus":
                    changeState("troops");
                    break;
                case "Equal":
                    changeState("weapons");
                    break;
            }
        } else {
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
                case "KeyF":
                    if (event.ctrlKey) {
                        event.preventDefault();
                        searchInput.focus();
                    }
                    break;
                case "KeyC":
                    if (event.ctrlKey) {
                        if (
                            contentContainer.contains(document.activeElement) &&
                            document.activeElement.tagName === "TEXTAREA"
                        ) {
                            if (!selectedMultiple) {
                                return;
                            }

                            event.preventDefault();

                            selectedTextareas.set(document.activeElement.id, document.activeElement.value);
                            await clipboardWrite(Array.from(selectedTextareas.values()).join("#"));

                            for (const key of selectedTextareas.keys()) {
                                const textarea = document.getElementById(key);
                                textarea.classList.replace("outline-zinc-500", "outline-zinc-700");
                            }
                        }
                    }
                    break;
                case "KeyX":
                    if (event.ctrlKey) {
                        if (
                            contentContainer.contains(document.activeElement) &&
                            document.activeElement.tagName === "TEXTAREA"
                        ) {
                            event.preventDefault();

                            selectedTextareas.set(document.activeElement.id, document.activeElement.value);
                            await clipboardWrite(Array.from(selectedTextareas.values()).join("#"));

                            for (const key of selectedTextareas.keys()) {
                                const textarea = document.getElementById(key);
                                textarea.classList.replace("outline-zinc-500", "outline-zinc-700");
                                textarea.value = "";
                            }

                            saved = false;
                        }
                    }
                    break;
                case "KeyG":
                    if (event.ctrlKey) {
                        event.preventDefault();
                        if (state) {
                            if (goToRowInput.classList.contains("hidden")) {
                                goToRow();
                            } else {
                                goToRowInput.classList.add("hidden");
                            }
                        }
                    }
                    break;
                case "F4":
                    if (event.altKey) {
                        await appWindow.close();
                    }
                    break;
                case "KeyV":
                    if (event.ctrlKey) {
                        if (
                            contentContainer.contains(document.activeElement) &&
                            document.activeElement.tagName === "TEXTAREA"
                        ) {
                            const clipboardText = await clipboardRead();
                            if (!clipboardText.includes("#")) {
                                return;
                            }

                            const clipboardTextSplitted = clipboardText.split("#");
                            const textRows = clipboardTextSplitted.length;

                            if (textRows <= 0) {
                                return;
                            } else {
                                const focusedElement = document.activeElement;
                                const focusedElementId = focusedElement.id.split("-");
                                const focusedElementNumber = Number.parseInt(focusedElementId.pop());

                                for (let i = 0; i < textRows; i++) {
                                    const elementToReplace = document.getElementById(
                                        `${focusedElementId.join("-")}-${focusedElementNumber + i}`
                                    );

                                    replacedTextareas.set(
                                        elementToReplace.id,
                                        elementToReplace.value.replaceAll(clipboardText, "")
                                    );
                                    elementToReplace.value = clipboardTextSplitted[i];
                                    elementToReplace.calculateHeight();
                                }

                                saved = false;
                            }
                        }
                    }
                    break;
            }
        }

        if (event.key === "Shift") {
            if (!event.repeat) {
                shiftPressed = true;
            }
        }
    }

    async function handleKeypressSearch(event) {
        if (event.code === "Enter") {
            event.preventDefault();

            if (event.ctrlKey) {
                searchInput.value += "\n";
            } else {
                if (searchInput.value.trim()) {
                    searchPanelFound.innerHTML = "";
                    await displaySearchResults(searchInput.value, false);
                }
            }
        }

        if (event.altKey) {
            switch (event.code) {
                case "KeyC":
                    switchCase();
                    break;
                case "KeyW":
                    switchWhole();
                    break;
                case "KeyR":
                    switchRegExp();
                    break;
                case "KeyT":
                    switchTranslation();
                    break;
                case "KeyL":
                    switchLocation();
                    break;
            }
        }
    }

    async function createContent() {
        const contentNames = [];
        const content = [];

        for (const folder of await readDir(await join(resourceDir, copiesDir), {
            dir: BaseDirectory.Resource,
            recursive: true,
        })) {
            for (const file of folder.children) {
                if (!file.name.endsWith(".txt")) {
                    continue;
                }

                contentNames.push(file.name.slice(0, -4));
                content.push(
                    (
                        await readTextFile(await join(resourceDir, copiesDir, folder.name, file.name), {
                            dir: BaseDirectory.Resource,
                        })
                    ).split("\n")
                );
            }
        }

        for (let i = 0; i < contentNames.length - 1; i += 2) {
            const contentName = contentNames[i];
            const contentDiv = document.createElement("div");
            contentDiv.id = contentName;
            contentDiv.classList.add("hidden", "flex-col", "h-auto");

            for (let j = 0; j < content[i].length; j++) {
                const originalText = content[i][j];
                const translationText = content[i + 1][j];

                const textParent = document.createElement("div");
                textParent.id = `${contentName}-${j + 1}`;
                textParent.classList.add("content-parent");

                const textContainer = document.createElement("div");
                textContainer.classList.add("flex", "content-child");

                const originalTextElement = document.createElement("div");
                originalTextElement.id = `${contentName}-original-${j + 1}`;
                originalTextElement.textContent = originalText.replaceAll("\\n[", "\\N[").replaceAll("\\n", "\n");
                originalTextElement.classList.add("original-text-div");

                const translationTextElement = document.createElement("textarea");
                const translationTextSplitted = translationText.split("\\n");
                translationTextElement.id = `${contentName}-translation-${j + 1}`;
                translationTextElement.rows = translationTextSplitted.length;
                translationTextElement.value = translationTextSplitted.join("\n");
                translationTextElement.classList.add("translation-text-input", "outline-zinc-700");

                const rowElement = document.createElement("div");
                rowElement.id = `${contentName}-row-${j + 1}`;
                rowElement.textContent = j + 1;
                rowElement.classList.add("row");

                textContainer.appendChild(rowElement);
                textContainer.appendChild(originalTextElement);
                textContainer.appendChild(translationTextElement);
                textParent.appendChild(textContainer);
                contentDiv.appendChild(textParent);
            }

            contentContainer.appendChild(contentDiv);
        }
    }

    async function compile() {
        compileButton.firstElementChild.classList.add("animate-spin");

        const unlistenCompile = await appWindow.listen("compile-finished", (message) => {
            compileButton.firstElementChild.classList.remove("animate-spin");
            alert(message.payload);
            unlistenCompile();
        });

        await appWindow.emit("compile");
    }

    function getNewLinePositions(textarea) {
        const positions = [];
        const lines = textarea.value.split("\n");
        const lineHeight = Number.parseFloat(window.getComputedStyle(textarea).lineHeight);

        const y = textarea.offsetTop + window.scrollY;
        const x = textarea.offsetLeft;

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

    function trackFocus(focusedElement) {
        for (const ghost of activeGhostLines) {
            ghost.remove();
        }

        const result = getNewLinePositions(focusedElement);
        if (result.length === 0) {
            return;
        }

        for (const object of result) {
            const { left, top } = object;
            const ghostNewLine = document.createElement("div");
            ghostNewLine.classList.add("ghost-new-line");
            ghostNewLine.innerHTML = "\\n";
            ghostNewLine.style.left = `${left}px`;
            ghostNewLine.style.top = `${top}px`;

            activeGhostLines.push(ghostNewLine);
            document.body.appendChild(ghostNewLine);
        }
    }

    function handleFocus(event) {
        const target = event.target;

        for (const ghost of activeGhostLines) {
            ghost.remove();
        }

        if (
            contentContainer.contains(target) &&
            target.tagName === "TEXTAREA" &&
            target.id !== currentFocusedElement[0]
        ) {
            currentFocusedElement = [target.id, target.value];

            target.addEventListener("keyup", () => {
                target.calculateHeight();
            });

            target.addEventListener("input", () => {
                trackFocus(target);
            });

            trackFocus(target);
        }
    }

    function handleBlur(event) {
        const target = event.target;

        for (const ghost of activeGhostLines) {
            ghost.remove();
        }

        if (target.id == currentFocusedElement[0]) {
            if (saved && currentFocusedElement[1] !== target.value) {
                saved = false;
            }

            currentFocusedElement = [];

            if (contentContainer.contains(target) && target.tagName === "TEXTAREA") {
                target.removeEventListener("input", () => {
                    trackFocus(target);
                });

                target.removeEventListener("keyup", () => {
                    target.calculateHeight();
                });
            }
        }
    }

    function switchCase() {
        searchCase = !searchCase;
        searchCaseButton.classList.toggle("bg-zinc-500");
    }

    function switchWhole() {
        searchWhole = !searchWhole;
        searchWholeButton.classList.toggle("bg-zinc-500");
    }

    function switchRegExp() {
        searchRegex = !searchRegex;
        searchRegexButton.classList.toggle("bg-zinc-500");
    }

    function switchTranslation() {
        searchTranslation = !searchTranslation;
        searchTranslationButton.classList.toggle("bg-zinc-500");
    }

    function switchLocation() {
        searchLocation = !searchLocation;
        searchLocationButton.classList.toggle("bg-zinc-500");
    }

    function createOptionsWindow() {
        new WebviewWindow("options", {
            url: "./options.html",
            title: mainLanguage.optionsButtonTitle,
            width: 800,
            height: 600,
            center: true,
        });
    }

    async function exitProgram() {
        let askExitUnsaved;
        if (saved) {
            askExitUnsaved = true;
        } else {
            askExitUnsaved = await ask(mainLanguage.unsavedChanges);
        }

        let askExit;
        if (!askExitUnsaved) {
            askExit = await ask(mainLanguage.exit);
        } else {
            if (!saved) {
                await save();
            }
            return true;
        }

        if (!askExit) {
            return false;
        } else {
            return true;
        }
    }

    async function fileMenuClick(target) {
        fileMenu.classList.replace("flex", "hidden");

        switch (target.id) {
            case "reload-button":
                await awaitSaving();

                if (await exitProgram()) {
                    location.reload();
                }
                break;
        }
    }

    function helpMenuClick(target) {
        helpMenu.classList.replace("flex", "hidden");

        switch (target.id) {
            case "help-button-sub":
                new WebviewWindow("help", {
                    url: "./help.html",
                    title: mainLanguage.helpButton,
                    width: 640,
                    height: 480,
                    center: true,
                });
                break;
            case "about-button":
                new WebviewWindow("about", {
                    url: "./about.html",
                    title: mainLanguage.aboutButton,
                    width: 640,
                    height: 480,
                    center: true,
                });
                break;
            case "hotkeys-button":
                new WebviewWindow("hotkeys", {
                    url: "./hotkeys.html",
                    title: mainLanguage.hotkeysButton,
                    width: 640,
                    height: 480,
                    center: true,
                });
                break;
        }
    }

    async function languageMenuClick(target) {
        languageMenu.classList.replace("flex", "hidden");

        switch (target.id) {
            case "ru-button":
                if (language !== "ru") {
                    await awaitSaving();

                    if (await exitProgram()) {
                        await changeLanguage("ru");
                    }
                }
                break;
            case "en-button":
                if (language !== "en") {
                    await awaitSaving();

                    if (await exitProgram()) {
                        await changeLanguage("en");
                    }
                }
                break;
        }
    }

    function menuBarClick(target) {
        switch (target.id) {
            case "file":
                fileMenu.toggleMultiple("hidden", "flex");
                helpMenu.classList.replace("flex", "hidden");
                languageMenu.classList.replace("flex", "hidden");

                fileMenu.style.top = `${fileMenuButton.offsetTop + fileMenuButton.offsetHeight}px`;
                fileMenu.style.left = `${fileMenuButton.offsetLeft}px`;

                fileMenu.addEventListener("click", async (event) => await fileMenuClick(event.target), {
                    once: true,
                });
                break;
            case "help":
                helpMenu.toggleMultiple("hidden", "flex");
                fileMenu.classList.replace("flex", "hidden");
                languageMenu.classList.replace("flex", "hidden");

                helpMenu.style.top = `${helpMenuButton.offsetTop + helpMenuButton.offsetHeight}px`;
                helpMenu.style.left = `${helpMenuButton.offsetLeft}px`;

                helpMenu.addEventListener("click", (event) => helpMenuClick(event.target), { once: true });
                break;
            case "language":
                languageMenu.toggleMultiple("hidden", "flex");
                helpMenu.classList.replace("flex", "hidden");
                fileMenu.classList.replace("flex", "hidden");

                languageMenu.style.top = `${languageMenuButton.offsetTop + languageMenuButton.offsetHeight}px`;
                languageMenu.style.left = `${languageMenuButton.offsetLeft}px`;

                languageMenu.addEventListener("click", async (event) => await languageMenuClick(event.target), {
                    once: true,
                });
                break;
        }
    }

    async function awaitSaving() {
        try {
            if (saving) {
                throw null;
            }
        } catch (err) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            await awaitSaving();
        }
    }

    async function createLogFile() {
        const logPath = await join(resourceDir, logFile);
        if (!(await exists(logPath, { dir: BaseDirectory.Resource }))) {
            await writeTextFile(logPath, "{}", { dir: BaseDirectory.Resource });
        }
    }

    const contentContainer = document.getElementById("content-container");
    const searchInput = document.getElementById("search-input");
    const replaceInput = document.getElementById("replace-input");
    const menuButton = document.getElementById("menu-button");
    const leftPanel = document.getElementById("left-panel");
    const searchPanel = document.getElementById("search-results");
    const searchPanelFound = document.getElementById("search-content");
    const searchPanelReplaced = document.getElementById("replace-content");
    const searchCurrentPage = document.getElementById("search-current-page");
    const searchTotalPages = document.getElementById("search-total-pages");
    const topPanel = document.getElementById("top-panel");
    const topPanelButtons = document.getElementById("top-panel-buttons");
    const saveButton = document.getElementById("save-button");
    const compileButton = document.getElementById("compile-button");
    const optionsButton = document.getElementById("options-button");
    const searchCaseButton = document.getElementById("case-button");
    const searchWholeButton = document.getElementById("whole-button");
    const searchRegexButton = document.getElementById("regex-button");
    const searchTranslationButton = document.getElementById("translate-button");
    const searchLocationButton = document.getElementById("location-button");
    const goToRowInput = document.getElementById("goto-row-input");
    const menuBar = document.getElementById("menu-bar");
    const fileMenuButton = document.getElementById("file");
    const helpMenuButton = document.getElementById("help");
    const languageMenuButton = document.getElementById("language");
    const fileMenu = document.getElementById("file-menu");
    const reloadButton = document.getElementById("reload-button");
    const helpMenu = document.getElementById("help-menu");
    const helpButtonSub = document.getElementById("help-button-sub");
    const aboutButton = document.getElementById("about-button");
    const hotkeysButton = document.getElementById("hotkeys-button");
    const languageMenu = document.getElementById("language-menu");
    const currentState = document.getElementById("current-state");

    const replaced = new Map();
    const activeGhostLines = [];

    let mainLanguage;

    let settings = await getSettings();

    const { enabled: backupEnabled, period: backupPeriod, max: backupMax } = settings.backup;

    const language = settings.lang;

    await ensureStart();
    await createFilesCopies();

    if (settings.firstLaunch) {
        new WebviewWindow("help", {
            url: "./help.html",
            title: mainLanguage.helpButton,
            width: 640,
            height: 480,
            center: true,
            alwaysOnTop: true,
        });

        await writeTextFile(
            await join(resourceDir, settingsFile),
            JSON.stringify({ ...settings, firstLaunch: false }),
            { dir: BaseDirectory.Resource }
        );
    }

    settings = null;

    menuButton.title = mainLanguage.menuButtonTitle;
    saveButton.title = mainLanguage.saveButtonTitle;
    compileButton.title = mainLanguage.compileButtonTitle;
    optionsButton.title = mainLanguage.optionsButtonTitle;

    searchCaseButton.title = mainLanguage.caseButtonTitle;
    searchWholeButton.title = mainLanguage.wholeButtonTitle;
    searchRegexButton.title = mainLanguage.regexButtonTitle;
    searchTranslationButton.title = mainLanguage.translationButtonTitle;
    searchLocationButton.title = mainLanguage.locationButtonTitle;

    fileMenuButton.innerHTML = mainLanguage.fileMenu;
    helpMenuButton.innerHTML = mainLanguage.helpMenu;
    languageMenuButton.innerHTML = mainLanguage.languageMenu;

    reloadButton.innerHTML = mainLanguage.reloadButton;

    helpButtonSub.innerHTML = mainLanguage.helpButton;
    aboutButton.innerHTML = mainLanguage.aboutButton;
    hotkeysButton.innerHTML = mainLanguage.hotkeysButton;

    let searchRegex = false;
    let searchWhole = false;
    let searchCase = false;
    let searchTranslation = false;
    let searchLocation = false;

    let state = null;
    let statePrevious = null;

    let saved = true;
    let saving = false;
    let currentFocusedElement = [];

    let shiftPressed = false;

    let selectedMultiple = false;
    const selectedTextareas = new Map();
    const replacedTextareas = new Map();

    leftPanel.style.height = `${window.innerHeight - topPanel.clientHeight - menuBar.clientHeight}px`;

    await createLogFile();
    await createDir(await join(resourceDir, backupDir), { dir: BaseDirectory.Resource, recursive: true });

    let nextBackupNumber = Number.parseInt(await determineLastBackupNumber());
    if (backupEnabled) {
        backup(backupPeriod);
    }

    await createContent();
    arrangeElements();

    const observerMain = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            entry.target.firstElementChild.classList.toggle("hidden", !entry.isIntersecting);
        }
    });

    const observerFound = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                entry.target.firstElementChild.classList.toggle("hidden", !entry.isIntersecting);
            }
        },
        { root: searchPanelFound, threshold: 0.1 }
    );

    const observerReplaced = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                entry.target.firstElementChild.classList.toggle("hidden", !entry.isIntersecting);
            }
        },
        { root: searchPanelReplaced, threshold: 0.1 }
    );

    leftPanel.addEventListener("click", (event) => {
        const newState = leftPanel.secondHighestParent(event.target).textContent;
        changeState(newState, true);
    });

    topPanelButtons.addEventListener("click", async (event) => {
        if (event.target === topPanelButtons) {
            return;
        }

        const target = topPanelButtons.secondHighestParent(event.target);

        switch (target.id) {
            case "menu-button":
                leftPanel.toggleMultiple("translate-x-0", "-translate-x-full");
                break;
            case "save-button":
                await save();
                break;
            case "compile-button":
                await compile();
                break;
            case "options-button":
                createOptionsWindow();
                break;
            case "search-button":
                if (searchInput.value) {
                    searchPanelFound.innerHTML = "";
                    await displaySearchResults(searchInput.value, false);
                } else if (document.activeElement === document.body) {
                    searchInput.focus();
                }
                break;
            case "replace-button":
                if (searchInput.value && replaceInput.value) {
                    await replaceText(searchInput.value, true);
                }
                break;
            case "case-button":
                switchCase();
                break;
            case "whole-button":
                switchWhole();
                break;
            case "regex-button":
                switchRegExp();
                break;
            case "translation-button":
                switchTranslation();
                break;
            case "location-button":
                switchLocation();
                break;
        }
    });

    searchPanel.addEventListener("click", async (event) => {
        switch (event.target.id) {
            case "switch-search-content":
                searchPanelFound.toggleMultiple("hidden", "flex");
                searchPanelReplaced.toggleMultiple("hidden", "flex");

                const searchSwitch = event.target;

                if (searchSwitch.innerHTML.trim() === "search") {
                    searchSwitch.innerHTML = "menu_book";

                    const replacementLogContent = JSON.parse(
                        await readTextFile(await join(resourceDir, logFile), { dir: BaseDirectory.Resource })
                    );

                    for (const [key, value] of Object.entries(replacementLogContent)) {
                        const replacedContainer = document.createElement("div");

                        const replacedElement = document.createElement("div");
                        replacedElement.classList.add("replaced-element");

                        replacedElement.innerHTML = `<div class="text-base text-zinc-400">${key}</div><div class=text-base>${value.original}</div><div class="flex justify-center items-center text-xl text-zinc-300 font-material">arrow_downward</div><div class="text-base">${value.translation}</div>`;

                        replacedContainer.appendChild(replacedElement);
                        searchPanelReplaced.appendChild(replacedContainer);
                    }

                    observerFound.disconnect();
                    searchPanelReplaced.style.height = `${searchPanelReplaced.scrollHeight}px`;

                    for (const container of searchPanelReplaced.children) {
                        container.style.width = `${container.clientWidth}px`;
                        container.style.height = `${container.clientHeight}px`;

                        observerReplaced.observe(container);
                        container.firstElementChild.classList.add("hidden");
                    }

                    searchPanelReplaced.addEventListener(
                        "mousedown",
                        async (event) => await handleReplacedClick(event)
                    );
                } else {
                    searchSwitch.innerHTML = "search";
                    searchPanelReplaced.innerHTML = "";

                    searchPanelReplaced.removeEventListener(
                        "mousedown",
                        async (event) => await handleReplacedClick(event)
                    );
                }
                break;
            case "previous-page-button":
                if (Number.parseInt(searchCurrentPage.textContent) > 1) {
                    searchCurrentPage.textContent = page - 1;

                    searchPanelFound.innerHTML = "";

                    for (const [id, result] of Object.entries(
                        JSON.parse(
                            await readTextFile(
                                await join(
                                    resourceDir,
                                    `matches-${Number.parseInt(searchCurrentPage.textContent) - 1}.json`
                                ),
                                {
                                    dir: BaseDirectory.Resource,
                                }
                            )
                        )
                    )) {
                        appendMatch(document.getElementById(id), result);
                    }
                }
                break;
            case "next-page-button":
                const page = Number.parseInt(searchCurrentPage.textContent);

                if (Number.parseInt(searchCurrentPage.textContent) < searchTotalPages.textContent) {
                    searchCurrentPage.textContent = page + 1;

                    searchPanelFound.innerHTML = "";

                    for (const [id, result] of Object.entries(
                        JSON.parse(
                            await readTextFile(
                                await join(
                                    resourceDir,
                                    `matches-${Number.parseInt(searchCurrentPage.textContent) + 1}.json`
                                ),
                                {
                                    dir: BaseDirectory.Resource,
                                }
                            )
                        )
                    )) {
                        appendMatch(document.getElementById(id), result);
                    }
                }
                break;
        }
    });

    searchInput.addEventListener("blur", () => (searchInput.value = searchInput.value.trim()));
    replaceInput.addEventListener("blur", () => (replaceInput.value = replaceInput.value.trim()));

    searchInput.addEventListener("keydown", async (event) => await handleKeypressSearch(event));
    menuBar.addEventListener("click", (event) => menuBarClick(event.target));

    document.addEventListener("keydown", async (event) => await handleKeypress(event));
    document.addEventListener("keyup", (event) => {
        if (event.key === "Shift") {
            shiftPressed = false;
        }
    });

    document.addEventListener("focus", handleFocus, true);
    document.addEventListener("blur", handleBlur, true);

    function handleMousedown(event) {
        if (event.button === 0) {
            if (shiftPressed) {
                if (
                    contentContainer.contains(document.activeElement) &&
                    document.activeElement.tagName === "TEXTAREA"
                ) {
                    event.preventDefault();
                    selectedTextareas.clear();

                    selectedMultiple = true;

                    const targetId = event.target.id.split("-");
                    const targetRow = targetId.pop();

                    const focusedElementId = document.activeElement.id.split("-");
                    const focusedElementRow = focusedElementId.pop();

                    let rowsRange = targetRow - focusedElementRow;
                    let rowsToSelect = Math.abs(rowsRange);

                    for (let i = 1; i < rowsToSelect + 1; i++) {
                        if (rowsRange > 0) {
                            const nextElement = document.getElementById(
                                `${targetId.join("-")}-${Number.parseInt(focusedElementRow) + i}`
                            );

                            nextElement.classList.replace("outline-zinc-700", "outline-zinc-500");
                            selectedTextareas.set(nextElement.id, nextElement.value);
                        } else if (rowsRange < 0) {
                            const nextElement = document.getElementById(
                                `${targetId.join("-")}-${Number.parseInt(focusedElementRow) - i}`
                            );

                            nextElement.classList.replace("outline-zinc-700", "outline-zinc-500");
                            selectedTextareas.set(nextElement.id, nextElement.value);
                        }
                    }
                }
            } else {
                selectedMultiple = false;

                for (const key of selectedTextareas.keys()) {
                    const textarea = document.getElementById(key);
                    textarea.classList.replace("outline-zinc-500", "outline-zinc-700");
                }
            }
        }
    }

    document.addEventListener("mousedown", (event) => handleMousedown(event));

    await appWindow.onCloseRequested(async (event) => {
        await awaitSaving();
        (await exitProgram()) ? await exit(0) : event.preventDefault();
    });
});
