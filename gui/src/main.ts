import "./string-extensions";
import "./htmlelement-extensions";

import {
    FileEntry,
    FsDirOptions,
    copyFile,
    exists,
    readDir,
    readTextFile,
    removeDir,
    removeFile,
    writeTextFile,
    createDir,
} from "@tauri-apps/api/fs";
import { BaseDirectory, resourceDir, join } from "@tauri-apps/api/path";
import { ask, message } from "@tauri-apps/api/dialog";
import { invoke } from "@tauri-apps/api/tauri";
import { exit } from "@tauri-apps/api/process";
import { appWindow, CloseRequestedEvent, WebviewWindow } from "@tauri-apps/api/window";
import { Command } from "@tauri-apps/api/shell";
import { writeText as writeToClipboard, readText as readFromClipboard } from "@tauri-apps/api/clipboard";
import { platform, locale as getLocale } from "@tauri-apps/api/os";
import { Event, UnlistenFn } from "@tauri-apps/api/event";

document.addEventListener("DOMContentLoaded", async (): Promise<void> => {
    const resDir: string = "res";
    const translationDir: string = "translation";
    const originalDir: string = "original";
    const backupDir: string = "backups";
    const repoDir: string = "main/fh-termina-json-writer-main";

    const mapsDir: string = "maps";
    const otherDir: string = "other";
    const pluginsDir: string = "plugins";

    const settingsFile: string = "settings.json";
    const logFile: string = "replacement-log.json";
    const ruTranslation: string = "ru.json";
    const enTranslation: string = "en.json";

    async function copyDir(sourceDir: string, targetDir: string, fsOptions: FsDirOptions | undefined): Promise<void> {
        await createDir(targetDir, fsOptions);

        for (const file of await readDir(sourceDir, fsOptions)) {
            const name: string = file.name as string;

            if (file.children) {
                await copyDir(await join(sourceDir, name), await join(targetDir, name), fsOptions);
            } else {
                await copyFile(await join(sourceDir, name), await join(targetDir, name), fsOptions);
            }
        }
    }

    async function createSettings(): Promise<Settings | void> {
        await message(mainLanguage.cannotGetSettings);
        const askCreateSettings: boolean = await ask(mainLanguage.askCreateSettings);

        if (askCreateSettings) {
            await writeTextFile(
                await join(resDir, settingsFile),
                JSON.stringify({
                    backup: { enabled: true, period: 60, max: 99 },
                    lang: language,
                    firstLaunch: true,
                }),
                {
                    dir: BaseDirectory.Resource,
                }
            );

            alert(mainLanguage.createdSettings);
            return JSON.parse(await readTextFile(await join(resDir, settingsFile), { dir: BaseDirectory.Resource }));
        } else {
            await exit(0);
        }
    }

    async function cloneRepository(): Promise<void> {
        function animateEllipsis(): void {
            if (!progressText.textContent?.endsWith("...")) {
                progressText.textContent += ".";
                setTimeout(animateEllipsis, 500);
            } else if (progressText.textContent?.endsWith("...")) {
                progressText.innerHTML = progressText.textContent.slice(0, -3);
                setTimeout(animateEllipsis, 500);
            }
        }

        const progressDisplay: HTMLDivElement = document.getElementById("progress-display") as HTMLDivElement;
        const progressText: HTMLDivElement = document.getElementById("progress-text") as HTMLDivElement;
        progressText.innerHTML = mainLanguage.downloadingTranslation;

        progressDisplay.classList.replace("hidden", "flex");
        animateEllipsis();

        const command: string = (await platform()) === "win32" ? "powershell" : "sh";
        const resourcePath: string = await join(await resourceDir(), resDir);
        await new Command(command, [], { cwd: resourcePath }).execute();

        await invoke("unzip", {
            path: await join(resourcePath, "main.zip"),
            dest: await join(resourcePath, "main"),
        });

        progressDisplay.remove();
    }

    async function changeLanguage(language: string): Promise<void> {
        await awaitSaving();

        if (await exitProgram()) {
            const settings: Settings = JSON.parse(
                await readTextFile(await join(resDir, settingsFile), { dir: BaseDirectory.Resource })
            );

            await writeTextFile(await join(resDir, settingsFile), JSON.stringify({ ...settings, lang: language }), {
                dir: BaseDirectory.Resource,
            });

            location.reload();
        }
    }

    async function prepareTranslation(): Promise<void> {
        const dirsToLeave: [string, string] = [translationDir, originalDir];

        const repoPath: string = await join(resDir, repoDir);
        const repositoryExists: boolean = await exists(repoPath, {
            dir: BaseDirectory.Resource,
        });

        if (repositoryExists) {
            await removeDir(repoPath, {
                dir: BaseDirectory.Resource,
                recursive: true,
            });
        }

        await cloneRepository();

        for (const dir of await readDir(repoPath, {
            dir: BaseDirectory.Resource,
        })) {
            if (dir.name && dirsToLeave.includes(dir.name)) {
                await copyDir(await join(repoPath, dir.name), await join(resDir, dir.name), {
                    dir: BaseDirectory.Resource,
                    recursive: true,
                });
            }
        }

        await removeDir(await join(resDir, "main"), { dir: BaseDirectory.Resource, recursive: true });
    }

    async function ensureStart(): Promise<void> {
        const dirs: [string, string, string] = [mapsDir, otherDir, pluginsDir];

        for (const dir of dirs) {
            if (!(await exists(await join(resDir, translationDir, dir), { dir: BaseDirectory.Resource }))) {
                if (await ask(mainLanguage.askDownloadTranslation)) {
                    await prepareTranslation();
                    alert(mainLanguage.downloadedTranslation);
                } else if (await ask(mainLanguage.startBlankProject)) {
                    await prepareTranslation();

                    const files: FileEntry[] = await readDir(await join(resDir, translationDir, dir), {
                        dir: BaseDirectory.Resource,
                        recursive: true,
                    });

                    for (const file of (files
                        .flatMap((dir: FileEntry) => dir.children)
                        .filter((file: FileEntry | undefined) => file?.name?.endsWith("_trans.txt")) as FileEntry[]) ??
                        []) {
                        const name = file.name as string;

                        const numberOfLines: number = (
                            await readTextFile(await join(resDir, translationDir, dir, name), {
                                dir: BaseDirectory.Resource,
                            })
                        ).count("\n");

                        await removeFile(await join(resDir, translationDir, dir, name), {
                            dir: BaseDirectory.Resource,
                        });

                        await writeTextFile(await join(resDir, translationDir, dir, name), "\n".repeat(numberOfLines), {
                            dir: BaseDirectory.Resource,
                        });
                    }
                } else {
                    await message(mainLanguage.whatNext);
                    await exit(0);
                }
                return;
            }
        }
    }

    function arrangeElements(): void {
        for (const child of (contentContainer?.children as HTMLCollectionOf<HTMLDivElement>) ?? []) {
            child.toggleMultiple("hidden", "flex");

            const heights: Uint32Array = new Uint32Array(child.children.length);
            let i: number = 0;

            for (const node of child.children) {
                heights.set([node?.firstElementChild?.children[1].clientHeight as number], i);
                i++;
            }

            i = 0;
            for (const node of child.children as HTMLCollectionOf<HTMLDivElement>) {
                node.style.minHeight = `${heights[i] + 8}px`;
                (node.firstElementChild as HTMLDivElement).style.minHeight = `${heights[i]}px`;

                for (const child of (node.firstElementChild?.children as HTMLCollectionOf<HTMLDivElement>) ?? []) {
                    child.style.minHeight = `${heights[i]}px`;
                }

                node.firstElementChild?.classList.add("hidden");
                i++;
            }

            child.style.minHeight = `${child.scrollHeight}px`;
            child.toggleMultiple("hidden", "flex");

            document.body.firstElementChild?.classList.remove("invisible");
        }
    }

    async function determineLastBackupNumber(): Promise<string> {
        const backups: FileEntry[] = await readDir(await join(resDir, backupDir), { dir: BaseDirectory.Resource });
        return backups.length === 0
            ? "00"
            : backups
                  .map((backup) => Number.parseInt((backup.name as string).slice(-2)))
                  .sort((a: number, b: number) => b - a)[0]
                  .toString();
    }

    async function createRegExp(text: string): Promise<RegExp | undefined> {
        text = text.trim();
        if (!text) {
            return;
        }

        let regexp: string = searchRegex
            ? text
            : await invoke("escape_text", {
                  text: text,
              });

        regexp = searchWhole
            ? /[а-яА-ЯЁё]/.test(regexp)
                ? `(?<![\w\u{4E00}-\u{9FFF}])(${regexp})(?![\w\u{4E00}-\u{9FFF}])`
                : `\\b(${regexp})\\b`
            : regexp;

        const attr: string = searchCase ? "gu" : "giu";

        try {
            return new RegExp(regexp, attr);
        } catch (err) {
            await message(`${mainLanguage.invalidRegexp} (${text.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")}), err`);
            return;
        }
    }

    function appendMatch(element: HTMLDivElement, result: string): void {
        const resultContainer: HTMLDivElement = document.createElement("div");

        const resultElement: HTMLDivElement = document.createElement("div");
        resultElement.classList.add("search-result");

        const thirdParent: HTMLDivElement = element.parentElement?.parentElement?.parentElement as HTMLDivElement;

        const [counterpartElement, sourceIndex]: [HTMLElement, number] = findCounterpart(element.id);
        const [source, row]: [string, string] = extractInfo(element);

        const mainDiv: HTMLDivElement = document.createElement("div");
        mainDiv.classList.add("text-base");

        const resultDiv: HTMLDivElement = document.createElement("div");
        resultDiv.innerHTML = result;
        mainDiv.appendChild(resultDiv);

        const originalInfo: HTMLDivElement = document.createElement("div");
        originalInfo.classList.add("text-xs", "text-zinc-400");

        const currentFile: string = element.parentElement?.parentElement?.id.slice(
            0,
            element.parentElement.parentElement.id.lastIndexOf("-")
        ) as string;
        originalInfo.innerHTML = `${currentFile} - ${source} - ${row}`;
        mainDiv.appendChild(originalInfo);

        const arrow: HTMLDivElement = document.createElement("div");
        arrow.classList.add("search-result-arrow");
        arrow.innerHTML = "arrow_downward";
        mainDiv.appendChild(arrow);

        const counterpart: HTMLDivElement = document.createElement("div");
        counterpart.innerHTML =
            counterpartElement.tagName === "TEXTAREA"
                ? (counterpartElement as HTMLTextAreaElement).value.replaceAllMultiple({ "<": "&lt;", ">": "&gt;" })
                : counterpartElement.innerHTML.replaceAllMultiple({ "<": "&lt;", ">": "&gt;" });
        mainDiv.appendChild(counterpart);

        const counterpartInfo: HTMLDivElement = document.createElement("div");
        counterpartInfo.classList.add("text-xs", "text-zinc-400");

        counterpartInfo.innerHTML = `${currentFile} - ${sourceIndex === 0 ? "original" : "translation"} - ${row}`;
        mainDiv.appendChild(counterpartInfo);

        resultElement.appendChild(mainDiv);

        resultElement.setAttribute("data", `${thirdParent.id},${element.id},${sourceIndex}`);
        resultContainer.appendChild(resultElement);
        searchPanelFound.appendChild(resultContainer);
    }

    function createMatchesContainer(elementText: string, matches: string[]): string {
        const result: string[] = [];
        let lastIndex: number = 0;

        for (const match of matches) {
            const start: number = elementText.indexOf(match, lastIndex);
            const end: number = start + match.length;

            const beforeDiv: string = `<span>${elementText.slice(lastIndex, start)}</span>`;
            const matchDiv: string = `<span class="bg-zinc-500">${match}</span>`;

            result.push(beforeDiv);
            result.push(matchDiv);

            lastIndex = end;
        }

        const afterDiv: string = `<span>${elementText.slice(lastIndex)}</span>`;
        result.push(afterDiv);

        return result.join("");
    }

    async function searchText(
        text: string,
        replace: boolean
    ): Promise<null | undefined | Map<HTMLTextAreaElement, string>> {
        const regexp: RegExp | undefined = await createRegExp(text);
        if (!regexp) {
            return;
        }

        for (const file of await readDir(resDir, { dir: BaseDirectory.Resource })) {
            if (file.name?.startsWith("matches")) {
                await removeFile(await join(resDir, file.name), { dir: BaseDirectory.Resource });
            }
        }

        let results: null | Map<HTMLTextAreaElement, string> = new Map();
        let objectToWrite: { [key: string]: string } = {};
        let count: number = 1;
        let file: number = 0;

        const searchArray: HTMLElement[] = (
            searchLocation && state
                ? [...(document.getElementById(state)?.children as HTMLCollectionOf<HTMLElement>)]
                : [...contentContainer.children].flatMap((parent) => [...parent.children])
        ) as HTMLElement[];

        for (const child of searchArray) {
            const node: HTMLCollectionOf<HTMLTextAreaElement> = child.firstElementChild
                ?.children as HTMLCollectionOf<HTMLTextAreaElement>;

            {
                const elementText: string = node[2].value.replaceAllMultiple({
                    "<": "&lt;",
                    ">": "&gt;",
                });
                const matches: RegExpMatchArray | null = elementText.match(regexp);

                if (matches) {
                    const result: string = createMatchesContainer(elementText, matches);

                    if (replace) {
                        (results as Map<HTMLElement, string>).set(node[2], result);
                    } else {
                        objectToWrite[node[2].id] = result;
                        results = null;
                    }

                    count++;
                }
            }

            if (!searchTranslation) {
                const elementText: string = node[1].innerHTML.replaceAllMultiple({ "<": "&lt;", ">": "&gt;" });
                const matches: RegExpMatchArray | null = elementText.match(regexp);

                if (matches) {
                    const result: string = createMatchesContainer(elementText, matches);

                    if (replace) {
                        (results as Map<HTMLElement, string>).set(node[1], result);
                    } else {
                        objectToWrite[node[1].id] = result;
                        results = null;
                    }

                    count++;
                }
            }

            if (count % 1000 === 0) {
                await writeTextFile(await join(resDir, `matches-${file}.json`), JSON.stringify(objectToWrite), {
                    dir: BaseDirectory.Resource,
                });

                objectToWrite = {};
                file++;
            }
        }

        if (file === 0) {
            await writeTextFile(await join(resDir, "matches-0.json"), JSON.stringify(objectToWrite), {
                dir: BaseDirectory.Resource,
            });
        }

        searchTotalPages.textContent = file.toString();
        searchCurrentPage.textContent = "0";

        for (const [id, result] of Object.entries(
            JSON.parse(await readTextFile(await join(resDir, "matches-0.json"), { dir: BaseDirectory.Resource }))
        )) {
            appendMatch(document.getElementById(id) as HTMLDivElement, result as string);
        }

        return results;
    }

    async function handleReplacedClick(event: MouseEvent): Promise<void> {
        const element: HTMLElement = (
            (event.target as HTMLElement).classList.contains("replaced-element")
                ? event.target
                : (event.target as HTMLElement).parentElement
        ) as HTMLElement;

        if (element.hasAttribute("reverted") || !searchPanelReplaced.contains(element)) {
            return;
        }

        const clicked: HTMLTextAreaElement = document.getElementById(
            element.firstElementChild?.textContent!
        ) as HTMLTextAreaElement;

        if (event.button === 0) {
            changeState(clicked.parentElement?.parentElement?.parentElement?.id as State);

            clicked.parentElement?.parentElement?.scrollIntoView({
                block: "center",
                inline: "center",
            });
        } else if (event.button === 2) {
            clicked.value = element.children[1].textContent!;

            element.innerHTML = `<span class="text-base"><code>${element.firstElementChild?.textContent}</code>\n${mainLanguage.textReverted}\n<code>${element.children[1].textContent}</code></span>`;
            element.setAttribute("reverted", "");

            const replacementLogContent: { [key: string]: { original: string; translation: string } } = JSON.parse(
                await readTextFile(await join(resDir, logFile), { dir: BaseDirectory.Resource })
            );

            delete replacementLogContent[clicked.id];

            await writeTextFile(await join(resDir, logFile), JSON.stringify(replacementLogContent), {
                dir: BaseDirectory.Resource,
            });
        }
    }

    function showSearchPanel(hide: boolean = true): void {
        if (searchPanel.getAttribute("moving") === "false") {
            if (hide) {
                searchPanel.toggleMultiple("translate-x-0", "translate-x-full");
            } else {
                searchPanel.classList.replace("translate-x-full", "translate-x-0");
            }
            searchPanel.setAttribute("moving", "true");
        }

        let loadingContainer: HTMLDivElement | null = null;

        if (searchPanelFound.children.length > 0 && searchPanelFound.firstElementChild?.id !== "no-results") {
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
                (): void => {
                    if (loadingContainer) {
                        searchPanelFound.removeChild(loadingContainer);
                    }
                    searchPanel.setAttribute("shown", "true");
                    searchPanel.setAttribute("moving", "false");
                },
                { once: true }
            );
        } else {
            if (searchPanel.classList.contains("translate-x-full")) {
                searchPanel.setAttribute("shown", "false");
                searchPanel.setAttribute("moving", "true");

                searchPanel.addEventListener("transitionend", (): void => searchPanel.setAttribute("moving", "false"), {
                    once: true,
                });
                return;
            }

            if (loadingContainer) {
                searchPanelFound.removeChild(loadingContainer);
            }
            searchPanel.setAttribute("moving", "false");
        }
    }

    function findCounterpart(id: string): [HTMLElement | HTMLTextAreaElement, number] {
        if (id.includes(originalDir)) {
            return [document.getElementById(id.replace(originalDir, translationDir)) as HTMLElement, 1];
        } else {
            return [document.getElementById(id.replace(translationDir, originalDir)) as HTMLElement, 0];
        }
    }

    function extractInfo(element: HTMLElement): [string, string] {
        const parts: string[] = element.id.split("-");
        const source: string = parts[1];
        const row: string = parts[2];
        return [source, row];
    }

    async function handleResultClick(
        button: number,
        currentState: HTMLElement,
        element: HTMLElement,
        resultElement: HTMLDivElement,
        counterpartIndex: number
    ): Promise<void> {
        if (button === 0) {
            changeState(currentState.id as State);

            element.parentElement?.parentElement?.scrollIntoView({
                block: "center",
                inline: "center",
            });
        } else if (button === 2) {
            if (element.id.includes(originalDir)) {
                alert(mainLanguage.originalTextIrreplacable);
                return;
            } else {
                if (replaceInput.value.trim()) {
                    const newText = await replaceText(element as HTMLTextAreaElement, false);

                    if (newText) {
                        saved = false;
                        const index: number = counterpartIndex === 1 ? 3 : 0;
                        resultElement.children[index].innerHTML = newText;
                    }
                    return;
                }
            }
        }
    }

    async function handleResultSelecting(event: MouseEvent): Promise<void> {
        const target: HTMLDivElement = event.target as HTMLDivElement;

        const resultElement: HTMLDivElement = (
            target.parentElement?.hasAttribute("data")
                ? target.parentElement
                : target.parentElement?.parentElement?.hasAttribute("data")
                ? target.parentElement.parentElement
                : target.parentElement?.parentElement?.parentElement
        ) as HTMLDivElement;

        if (!searchPanelFound.contains(resultElement)) {
            return;
        }

        const [thirdParent, element, counterpartIndex]: string[] = resultElement
            .getAttribute("data")
            ?.split(",") as string[];

        await handleResultClick(
            event.button,
            document.getElementById(thirdParent) as HTMLElement,
            document.getElementById(element) as HTMLElement,
            resultElement,
            Number.parseInt(counterpartIndex)
        );
    }

    async function displaySearchResults(text: string | null = null, hide: boolean = true): Promise<void> {
        if (!text) {
            showSearchPanel(hide);
            return;
        }

        text = text.trim();
        if (!text) {
            return;
        }

        const noMatches: null | undefined | Map<HTMLTextAreaElement, string> = await searchText(text, false);

        if (noMatches) {
            searchPanelFound.innerHTML = `<div id="no-results" class="flex justify-center items-center h-full">${mainLanguage.noMatches}</div>`;
            showSearchPanel(false);
            return;
        }

        observerFound.disconnect();
        searchPanelFound.style.height = `${searchPanelFound.scrollHeight}px`;

        for (const container of (searchPanelFound.children as HTMLCollectionOf<HTMLDivElement>) ?? []) {
            container.style.width = `${container.clientWidth}px`;
            container.style.height = `${container.clientHeight}px`;

            observerFound.observe(container);
        }

        for (const container of (searchPanelFound.children as HTMLCollectionOf<HTMLDivElement>) ?? []) {
            container.firstElementChild?.classList.add("hidden");
        }

        showSearchPanel(hide);

        searchPanelFound.removeEventListener(
            "mousedown",
            async (event): Promise<void> => await handleResultSelecting(event)
        );
        searchPanelFound.addEventListener(
            "mousedown",
            async (event): Promise<void> => await handleResultSelecting(event)
        );
    }

    async function replaceText(text: string | HTMLTextAreaElement, replaceAll: boolean): Promise<string | undefined> {
        if (!replaceAll && text instanceof HTMLTextAreaElement) {
            const regexp: RegExp | undefined = await createRegExp(searchInput.value);
            if (!regexp) {
                return;
            }

            const replacementValue: string = replaceInput.value;

            const highlightedReplacement: HTMLSpanElement = document.createElement("span");
            highlightedReplacement.classList.add("bg-red-600");
            highlightedReplacement.textContent = replacementValue;

            const newText = text.value.split(regexp);
            const newTextParts = newText.flatMap((part, i) => [
                part,
                i < newText.length - 1 ? highlightedReplacement : "",
            ]);

            const newValue: string = newText.join(replacementValue);

            replaced.set(text.id, { original: text.value, translation: newValue });
            const prevFile: { [key: string]: { [key: string]: string } } = JSON.parse(
                await readTextFile(await join(resDir, logFile), { dir: BaseDirectory.Resource })
            );

            const newObject: { [key: string]: { [key: string]: string } } = {
                ...prevFile,
                ...Object.fromEntries([...replaced]),
            };

            await writeTextFile(await join(resDir, logFile), JSON.stringify(newObject), {
                dir: BaseDirectory.Resource,
            });
            replaced.clear();

            text.value = newValue;
            return newTextParts.join("");
        }

        text = (text as string).trim();
        if (!text) {
            return;
        }

        const results: null | undefined | Map<HTMLTextAreaElement, string> = await searchText(text, true);
        if (!results) {
            return;
        }

        const regexp: RegExp | undefined = await createRegExp(text);
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

        const prevFile: { [key: string]: { [key: string]: string } } = JSON.parse(
            await readTextFile(await join(resDir, logFile), { dir: BaseDirectory.Resource })
        );

        const newObject: { [key: string]: { [key: string]: string } } = {
            ...prevFile,
            ...Object.fromEntries([...replaced]),
        };

        await writeTextFile(await join(resDir, logFile), JSON.stringify(newObject), {
            dir: BaseDirectory.Resource,
        });
        replaced.clear();
    }

    async function save(backup: boolean = false): Promise<void> {
        if (saving) {
            return;
        }

        saving = true;
        saveButton.firstElementChild?.classList.add("animate-spin");

        let dirName: string = await join(resDir, translationDir);

        if (backup) {
            const date: Date = new Date();
            const formattedDate: string = [
                date.getFullYear(),
                (date.getMonth() + 1).toString().padStart(2, "0"),
                date.getDate().toString().padStart(2, "0"),
                date.getHours().toString().padStart(2, "0"),
                date.getMinutes().toString().padStart(2, "0"),
                date.getSeconds().toString().padStart(2, "0"),
            ].join("-");

            nextBackupNumber = (nextBackupNumber % backupMax) + 1;

            dirName = await join(resDir, backupDir, `${formattedDate}_${nextBackupNumber.toString().padStart(2, "0")}`);

            for (const subDir of [mapsDir, otherDir, pluginsDir]) {
                await createDir(await join(dirName, subDir), { dir: BaseDirectory.Resource, recursive: true });
            }
        }

        let i: number = 0;
        for (const contentElement of contentContainer.children) {
            const outputArray: string[] = [];

            for (const child of contentElement.children) {
                const node: HTMLTextAreaElement = child.firstElementChild?.children[2] as HTMLTextAreaElement;
                outputArray.push(node.value.replaceAll("\n", "\\n"));
            }

            const dirPath: string = i < 2 ? mapsDir : i < 12 ? otherDir : pluginsDir;
            const filePath: string = `${dirPath}/${contentElement.id}_trans.txt`;

            await writeTextFile(await join(dirName, filePath), outputArray.join("\n"), {
                dir: BaseDirectory.Resource,
            });
            i++;
        }

        if (!backup) {
            saved = true;
        }

        saveButton.firstElementChild?.classList.remove("animate-spin");
        saving = false;
    }

    function backup(s: number): void {
        if (!backupEnabled) {
            return;
        }

        setTimeout(async (): Promise<void> => {
            if (backupEnabled) {
                await save(true);
                backup(s);
            }
        }, s * 1000);
    }

    function updateState(newState: string, slide: boolean = true): void {
        currentState.innerHTML = newState;

        const contentParent: HTMLDivElement = document.getElementById(newState) as HTMLDivElement;
        contentParent.classList.replace("hidden", "flex");

        if (statePrevious) {
            const previousStateContainer: HTMLDivElement | null = document.getElementById(
                statePrevious
            ) as HTMLDivElement;

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

    function changeState(newState: State, slide: boolean = false): void {
        if (state === newState) {
            return;
        }

        if (newState === null) {
            state = null;
            currentState.innerHTML = "";

            observerMain.disconnect();
            for (const child of contentContainer.children) {
                child.classList.replace("flex", "hidden");
            }
        } else {
            statePrevious = state;
            state = newState;
            updateState(newState, slide);
        }
    }

    function goToRow(): void {
        goToRowInput.classList.remove("hidden");
        goToRowInput.focus();

        const element: HTMLElement = document.getElementById(state as string) as HTMLElement;
        const lastRow: string = element?.lastElementChild?.id.split("-").at(-1) as string;

        goToRowInput.placeholder = `Перейти к строке... от 1 до ${lastRow}`;
    }

    function jumpToRow(key: string): void {
        const focusedElement: HTMLElement = document.activeElement as HTMLElement;
        if (!contentContainer.contains(focusedElement) && focusedElement && focusedElement.tagName !== "TEXTAREA") {
            return;
        }

        const idParts: string[] = focusedElement.id.split("-");
        const index: number = Number.parseInt(idParts.pop() as string);
        const baseId: string = idParts.join("-");

        if (isNaN(index)) {
            return;
        }

        const step: number = key === "alt" ? 1 : -1;
        const nextIndex: number = index + step;
        const nextElementId: string = `${baseId}-${nextIndex}`;
        const nextElement: HTMLTextAreaElement = document.getElementById(nextElementId) as HTMLTextAreaElement;

        if (!nextElement) {
            return;
        }

        const scrollOffset: number = nextElement.clientHeight + 8;
        window.scrollBy(0, step * scrollOffset);
        focusedElement.blur();
        nextElement.focus();
        nextElement.setSelectionRange(0, 0);
    }

    async function handleKeypress(event: KeyboardEvent): Promise<void> {
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
                            const textarea: HTMLTextAreaElement = document.getElementById(key) as HTMLTextAreaElement;
                            textarea.value = selectedTextareas.get(key) as string;
                        }

                        for (const key of replacedTextareas.keys()) {
                            const textarea: HTMLTextAreaElement = document.getElementById(key) as HTMLTextAreaElement;
                            textarea.value = replacedTextareas.get(key) as string;
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
                case "KeyG":
                    if (event.ctrlKey) {
                        event.preventDefault();

                        if (state && goToRowInput.classList.contains("hidden")) {
                            goToRow();
                        } else if (!goToRowInput.classList.contains("hidden")) {
                            goToRowInput.classList.add("hidden");
                        }
                    }
                    break;
                case "KeyF":
                    if (event.ctrlKey) {
                        event.preventDefault();
                        searchInput.focus();
                    }
                    break;
                case "F4":
                    if (event.altKey) {
                        await appWindow.close();
                    }
                    break;
                case "Digit1":
                    changeState("maps");
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
                    if (document.activeElement) {
                        (document.activeElement as HTMLElement).blur();
                    }
                    break;
                case "Enter":
                    if (event.altKey) {
                        jumpToRow("alt");
                    } else if (event.ctrlKey) {
                        jumpToRow("ctrl");
                    }
                    break;
                case "KeyC":
                    if (event.ctrlKey) {
                        if (
                            contentContainer.contains(document.activeElement) &&
                            document.activeElement &&
                            document.activeElement.tagName === "TEXTAREA"
                        ) {
                            if (!selectedMultiple) {
                                return;
                            }

                            event.preventDefault();

                            selectedTextareas.set(
                                document.activeElement.id,
                                (document.activeElement as HTMLTextAreaElement).value
                            );
                            await writeToClipboard(Array.from(selectedTextareas.values()).join("#"));

                            for (const key of selectedTextareas.keys()) {
                                const textarea: HTMLTextAreaElement = document.getElementById(
                                    key
                                ) as HTMLTextAreaElement;
                                textarea?.classList.replace("outline-zinc-500", "outline-zinc-700");
                            }
                        }
                    }
                    break;
                case "KeyX":
                    if (event.ctrlKey) {
                        if (
                            contentContainer.contains(document.activeElement) &&
                            document.activeElement?.tagName === "TEXTAREA"
                        ) {
                            if (!selectedMultiple) {
                                return;
                            }

                            event.preventDefault();

                            selectedTextareas.set(
                                document.activeElement.id,
                                (document.activeElement as HTMLTextAreaElement).value
                            );
                            await writeToClipboard(Array.from(selectedTextareas.values()).join("#"));

                            for (const key of selectedTextareas.keys()) {
                                const textarea: HTMLTextAreaElement = document.getElementById(
                                    key
                                ) as HTMLTextAreaElement;
                                textarea.classList.replace("outline-zinc-500", "outline-zinc-700");
                                textarea.value = "";
                            }

                            saved = false;
                        }
                    }
                    break;
                case "KeyV":
                    if (event.ctrlKey) {
                        if (
                            contentContainer.contains(document.activeElement) &&
                            document.activeElement?.tagName === "TEXTAREA"
                        ) {
                            const clipboardText: string | null = await readFromClipboard();

                            if (!clipboardText || !clipboardText.includes("#")) {
                                return;
                            }

                            const clipboardTextSplitted: string[] = clipboardText.split("#");
                            const textRows: number = clipboardTextSplitted.length;

                            if (textRows <= 0) {
                                return;
                            } else {
                                const focusedElement: HTMLElement = document.activeElement as HTMLElement;
                                const focusedElementId: string[] = focusedElement.id.split("-");
                                const focusedElementNumber: number = Number.parseInt(focusedElementId.pop() as string);

                                for (let i = 0; i < textRows; i++) {
                                    const elementToReplace: HTMLTextAreaElement = document.getElementById(
                                        `${focusedElementId.join("-")}-${focusedElementNumber + i}`
                                    ) as HTMLTextAreaElement;

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

    async function handleKeypressSearch(event: KeyboardEvent): Promise<void> {
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

    async function createContent(): Promise<void> {
        const contentNames: string[] = [];
        const content: string[][] = [];

        for (const folder of await readDir(await join(resDir, translationDir), {
            dir: BaseDirectory.Resource,
            recursive: true,
        })) {
            const f = folder.name as string;

            for (const file of folder.children ?? []) {
                const name = file.name as string;

                if (!name.endsWith(".txt")) {
                    continue;
                }

                contentNames.push(name.slice(0, -4));
                content.push(
                    (
                        await readTextFile(await join(resDir, translationDir, f, name), {
                            dir: BaseDirectory.Resource,
                        })
                    ).split("\n")
                );
            }
        }

        for (let i = 0; i < contentNames.length - 1; i += 2) {
            const contentName: string = contentNames[i];
            const contentDiv: HTMLDivElement = document.createElement("div");
            contentDiv.id = contentName;
            contentDiv.classList.add("hidden", "flex-col", "h-auto");

            for (let j = 0; j < content[i].length; j++) {
                const originalText: string = content[i][j];
                const translationText: string = content[i + 1][j];

                const textParent: HTMLDivElement = document.createElement("div");
                textParent.id = `${contentName}-${j + 1}`;
                textParent.classList.add("content-parent");

                const textContainer: HTMLDivElement = document.createElement("div");
                textContainer.classList.add("flex", "content-child");

                const originalTextElement: HTMLDivElement = document.createElement("div");
                originalTextElement.id = `${contentName}-original-${j + 1}`;
                originalTextElement.textContent = originalText.replaceAll("\\n[", "\\N[").replaceAll("\\n", "\n");
                originalTextElement.classList.add("original-text-div");

                const translationTextElement: HTMLTextAreaElement = document.createElement("textarea");
                const translationTextSplitted: string[] = translationText.split("\\n");
                translationTextElement.id = `${contentName}-translation-${j + 1}`;
                translationTextElement.rows = translationTextSplitted.length;
                translationTextElement.value = translationTextSplitted.join("\n");
                translationTextElement.classList.add("translation-text-input", "outline-zinc-700");

                const rowElement: HTMLDivElement = document.createElement("div");
                rowElement.id = `${contentName}-row-${j + 1}`;
                rowElement.textContent = (j + 1).toString();
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

    async function compile(): Promise<void> {
        compileButton.firstElementChild?.classList.add("animate-spin");

        const unlistenCompile: UnlistenFn = await appWindow.listen(
            "compile-finished",
            (message: Event<string>): void => {
                compileButton.firstElementChild?.classList.remove("animate-spin");
                alert(message.payload);
                unlistenCompile();
            }
        );

        await appWindow.emit("compile");
    }

    function getNewLinePositions(textarea: HTMLTextAreaElement): { left: number; top: number }[] {
        const positions: { left: number; top: number }[] = [];
        const lines: string[] = textarea.value.split("\n");
        const lineHeight: number = Number.parseFloat(window.getComputedStyle(textarea).lineHeight);

        const y: number = textarea.offsetTop;
        const x: number = textarea.offsetLeft;

        const canvas: HTMLCanvasElement = document.createElement("canvas");
        const context: CanvasRenderingContext2D = canvas.getContext("2d") as CanvasRenderingContext2D;
        context.font = '18px "Segoe UI"';

        let top: number = y;

        for (let i = 0; i < lines.length - 1; i++) {
            const line: string = lines[i];
            const textWidth: number = context.measureText(`${line} `).width;
            const left: number = x + textWidth;

            positions.push({ left, top });
            top += lineHeight;
        }

        return positions;
    }

    function trackFocus(focusedElement: HTMLTextAreaElement): void {
        for (const ghost of activeGhostLines) {
            ghost.remove();
        }

        const result: { left: number; top: number }[] = getNewLinePositions(focusedElement);
        if (result.length === 0) {
            return;
        }

        for (const object of result) {
            const { left, top }: { left: number; top: number } = object;
            const ghostNewLine: HTMLDivElement = document.createElement("div");
            ghostNewLine.classList.add("ghost-new-line");
            ghostNewLine.innerHTML = "\\n";
            ghostNewLine.style.left = `${left}px`;
            ghostNewLine.style.top = `${top}px`;

            activeGhostLines.push(ghostNewLine);
            document.body.appendChild(ghostNewLine);
        }
    }

    function handleFocus(event: FocusEvent): void {
        const target: HTMLTextAreaElement = event.target as HTMLTextAreaElement;

        for (const ghost of activeGhostLines) {
            ghost.remove();
        }

        if (
            contentContainer.contains(target) &&
            target.tagName === "TEXTAREA" &&
            target.id !== currentFocusedElement[0]
        ) {
            currentFocusedElement = [target.id, target.value];

            target.addEventListener("keyup", (): void => {
                target.calculateHeight();
            });

            target.addEventListener("input", (): void => {
                trackFocus(target);
            });

            trackFocus(target);
        }
    }

    function handleBlur(event: FocusEvent): void {
        const target: HTMLTextAreaElement = event.target as HTMLTextAreaElement;

        for (const ghost of activeGhostLines) {
            ghost.remove();
        }

        if (target.id == currentFocusedElement[0]) {
            if (saved && currentFocusedElement[1] !== target.value) {
                saved = false;
            }

            currentFocusedElement = [];

            if (contentContainer.contains(target) && target.tagName === "TEXTAREA") {
                target.removeEventListener("input", (): void => {
                    trackFocus(target);
                });

                target.removeEventListener("keyup", (): void => {
                    target.calculateHeight();
                });
            }
        }
    }

    function switchCase(): void {
        searchCase = !searchCase;
        searchCaseButton.classList.toggle("bg-zinc-500");
    }

    function switchWhole(): void {
        searchWhole = !searchWhole;
        searchWholeButton.classList.toggle("bg-zinc-500");
    }

    function switchRegExp(): void {
        searchRegex = !searchRegex;
        searchRegexButton.classList.toggle("bg-zinc-500");
    }

    function switchTranslation(): void {
        searchTranslation = !searchTranslation;
        searchTranslationButton.classList.toggle("bg-zinc-500");
    }

    function switchLocation(): void {
        searchLocation = !searchLocation;
        searchLocationButton.classList.toggle("bg-zinc-500");
    }

    function createOptionsWindow(): void {
        new WebviewWindow("options", {
            url: "./options.html",
            title: mainLanguage.optionsButtonTitle,
            width: 800,
            height: 600,
            center: true,
        });
    }

    async function exitProgram(): Promise<boolean> {
        let askExitUnsaved: boolean;
        if (saved) {
            askExitUnsaved = true;
        } else {
            askExitUnsaved = await ask(mainLanguage.unsavedChanges);
        }

        let askExit: boolean;
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

    async function fileMenuClick(target: HTMLElement): Promise<void> {
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

    function helpMenuClick(target: HTMLElement): void {
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

    async function languageMenuClick(target: HTMLElement): Promise<void> {
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

    function menuBarClick(target: HTMLElement): void {
        switch (target.id) {
            case "file":
                fileMenu.toggleMultiple("hidden", "flex");
                helpMenu.classList.replace("flex", "hidden");
                languageMenu.classList.replace("flex", "hidden");

                fileMenu.style.top = `${fileMenuButton.offsetTop + fileMenuButton.offsetHeight}px`;
                fileMenu.style.left = `${fileMenuButton.offsetLeft}px`;

                fileMenu.addEventListener(
                    "click",
                    async (event: MouseEvent): Promise<void> => await fileMenuClick(event.target as HTMLElement),
                    {
                        once: true,
                    }
                );
                break;
            case "help":
                helpMenu.toggleMultiple("hidden", "flex");
                fileMenu.classList.replace("flex", "hidden");
                languageMenu.classList.replace("flex", "hidden");

                helpMenu.style.top = `${helpMenuButton.offsetTop + helpMenuButton.offsetHeight}px`;
                helpMenu.style.left = `${helpMenuButton.offsetLeft}px`;

                helpMenu.addEventListener(
                    "click",
                    (event: MouseEvent): void => helpMenuClick(event.target as HTMLElement),
                    {
                        once: true,
                    }
                );
                break;
            case "language":
                languageMenu.toggleMultiple("hidden", "flex");
                helpMenu.classList.replace("flex", "hidden");
                fileMenu.classList.replace("flex", "hidden");

                languageMenu.style.top = `${languageMenuButton.offsetTop + languageMenuButton.offsetHeight}px`;
                languageMenu.style.left = `${languageMenuButton.offsetLeft}px`;

                languageMenu.addEventListener(
                    "click",
                    async (event: MouseEvent): Promise<void> => await languageMenuClick(event.target as HTMLElement),
                    {
                        once: true,
                    }
                );
                break;
        }
    }

    async function awaitSaving(): Promise<void> {
        if (saving) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            await awaitSaving();
        }
    }

    async function createLogFile(): Promise<void> {
        const logPath: string = await join(resDir, logFile);

        if (!(await exists(logPath, { dir: BaseDirectory.Resource }))) {
            await writeTextFile(logPath, "{}", { dir: BaseDirectory.Resource });
        }
    }

    const contentContainer: HTMLDivElement = document.getElementById("content-container") as HTMLDivElement;
    const searchInput: HTMLTextAreaElement = document.getElementById("search-input") as HTMLTextAreaElement;
    const replaceInput: HTMLTextAreaElement = document.getElementById("replace-input") as HTMLTextAreaElement;
    const menuButton: HTMLButtonElement = document.getElementById("menu-button") as HTMLButtonElement;
    const leftPanel: HTMLDivElement = document.getElementById("left-panel") as HTMLDivElement;
    const searchPanel: HTMLDivElement = document.getElementById("search-results") as HTMLDivElement;
    const searchPanelFound: HTMLDivElement = document.getElementById("search-content") as HTMLDivElement;
    const searchPanelReplaced: HTMLDivElement = document.getElementById("replace-content") as HTMLDivElement;
    const searchCurrentPage: HTMLSpanElement = document.getElementById("search-current-page") as HTMLSpanElement;
    const searchSeparator: HTMLSpanElement = document.getElementById("search-separator") as HTMLSpanElement;
    const searchTotalPages: HTMLSpanElement = document.getElementById("search-total-pages") as HTMLSpanElement;
    const topPanel: HTMLDivElement = document.getElementById("top-panel") as HTMLDivElement;
    const topPanelButtons: HTMLDivElement = document.getElementById("top-panel-buttons") as HTMLDivElement;
    const saveButton: HTMLButtonElement = document.getElementById("save-button") as HTMLButtonElement;
    const compileButton: HTMLButtonElement = document.getElementById("compile-button") as HTMLButtonElement;
    const optionsButton: HTMLButtonElement = document.getElementById("options-button") as HTMLButtonElement;
    const searchCaseButton: HTMLButtonElement = document.getElementById("case-button") as HTMLButtonElement;
    const searchWholeButton: HTMLButtonElement = document.getElementById("whole-button") as HTMLButtonElement;
    const searchRegexButton: HTMLButtonElement = document.getElementById("regex-button") as HTMLButtonElement;
    const searchTranslationButton: HTMLButtonElement = document.getElementById(
        "translation-button"
    ) as HTMLButtonElement;
    const searchLocationButton: HTMLButtonElement = document.getElementById("location-button") as HTMLButtonElement;
    const goToRowInput: HTMLInputElement = document.getElementById("goto-row-input") as HTMLInputElement;
    const menuBar: HTMLDivElement = document.getElementById("menu-bar") as HTMLDivElement;
    const fileMenuButton: HTMLButtonElement = document.getElementById("file") as HTMLButtonElement;
    const helpMenuButton: HTMLButtonElement = document.getElementById("help") as HTMLButtonElement;
    const languageMenuButton: HTMLButtonElement = document.getElementById("language") as HTMLButtonElement;
    const fileMenu: HTMLDivElement = document.getElementById("file-menu") as HTMLDivElement;
    const reloadButton: HTMLButtonElement = document.getElementById("reload-button") as HTMLButtonElement;
    const helpMenu: HTMLDivElement = document.getElementById("help-menu") as HTMLDivElement;
    const helpButtonSub: HTMLButtonElement = document.getElementById("help-button-sub") as HTMLButtonElement;
    const aboutButton: HTMLButtonElement = document.getElementById("about-button") as HTMLButtonElement;
    const hotkeysButton: HTMLButtonElement = document.getElementById("hotkeys-button") as HTMLButtonElement;
    const languageMenu: HTMLDivElement = document.getElementById("language-menu") as HTMLDivElement;
    const currentState: HTMLDivElement = document.getElementById("current-state") as HTMLDivElement;

    const replaced: Map<string, { [key: string]: string }> = new Map();
    const activeGhostLines: HTMLDivElement[] = [];

    let settings: Settings | null = (await exists(await join(resDir, settingsFile), { dir: BaseDirectory.Resource }))
        ? JSON.parse(await readTextFile(await join(resDir, settingsFile), { dir: BaseDirectory.Resource }))
        : null;

    let locale: string | null = await getLocale();

    const language: string = locale
        ? settings
            ? settings.lang
            : ["ru", "uk", "be"].some((x: string): boolean => locale!.startsWith(x))
            ? "ru"
            : "en"
        : "en";

    locale = null;

    const mainLanguage: mainTranslation =
        language === "ru"
            ? JSON.parse(await readTextFile(await join(resDir, ruTranslation), { dir: BaseDirectory.Resource })).main
            : JSON.parse(await readTextFile(await join(resDir, enTranslation), { dir: BaseDirectory.Resource })).main;

    if (!settings) {
        settings = (await createSettings()) as Settings;
    }

    const { enabled: backupEnabled, period: backupPeriod, max: backupMax }: Backup = settings.backup;

    await ensureStart();

    if (settings.firstLaunch) {
        new WebviewWindow("help", {
            url: "./help.html",
            title: mainLanguage.helpButton,
            width: 640,
            height: 480,
            center: true,
            alwaysOnTop: true,
        });

        await writeTextFile(await join(resDir, settingsFile), JSON.stringify({ ...settings, firstLaunch: false }), {
            dir: BaseDirectory.Resource,
        });
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

    searchCurrentPage.innerHTML = mainLanguage.currentPage;
    searchSeparator.innerHTML = mainLanguage.separator;

    let searchRegex: boolean = false;
    let searchWhole: boolean = false;
    let searchCase: boolean = false;
    let searchTranslation: boolean = false;
    let searchLocation: boolean = false;

    let state: State = null;
    let statePrevious: string | null = null;

    let saved: boolean = true;
    let saving: boolean = false;
    let currentFocusedElement: [string, string] | [] = [];

    let shiftPressed: boolean = false;

    let selectedMultiple: boolean = false;
    const selectedTextareas: Map<string, string> = new Map();
    const replacedTextareas: Map<string, string> = new Map();

    leftPanel.style.height = `${window.innerHeight - topPanel.clientHeight - menuBar.clientHeight}px`;

    await createLogFile();
    await createDir(await join(resDir, backupDir), { dir: BaseDirectory.Resource, recursive: true });

    let nextBackupNumber: number = Number.parseInt(await determineLastBackupNumber());
    if (backupEnabled) {
        backup(backupPeriod);
    }

    await createContent();
    arrangeElements();

    const observerMain: IntersectionObserver = new IntersectionObserver(
        (entries: IntersectionObserverEntry[]): void => {
            for (const entry of entries) {
                entry.target.firstElementChild?.classList.toggle("hidden", !entry.isIntersecting);
            }
        },
        {
            root: document.body,
            rootMargin: "128px",
        }
    );

    const observerFound: IntersectionObserver = new IntersectionObserver(
        (entries: IntersectionObserverEntry[]): void => {
            for (const entry of entries) {
                entry.target.firstElementChild?.classList.toggle("hidden", !entry.isIntersecting);
            }
        },
        { root: searchPanelFound, threshold: 0.1 }
    );

    const observerReplaced: IntersectionObserver = new IntersectionObserver(
        (entries: IntersectionObserverEntry[]): void => {
            for (const entry of entries) {
                entry.target.firstElementChild?.classList.toggle("hidden", !entry.isIntersecting);
            }
        },
        { root: searchPanelReplaced, threshold: 0.1 }
    );

    leftPanel.addEventListener("click", (event: MouseEvent): void => {
        const newState: State = leftPanel.secondHighestParent(event.target as HTMLElement).textContent! as State;
        changeState(newState, true);
    });

    topPanelButtons.addEventListener("click", async (event: MouseEvent): Promise<void> => {
        if (!event.target || event.target === topPanelButtons) {
            return;
        }

        const target: HTMLElement = topPanelButtons.secondHighestParent(event.target as HTMLElement);

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

    searchPanel.addEventListener("click", async (event: MouseEvent): Promise<void> => {
        const target: HTMLElement = event.target as HTMLElement;
        let page: number | null = null;

        switch (target.id) {
            case "switch-search-content":
                searchPanelFound.toggleMultiple("hidden", "flex");
                searchPanelReplaced.toggleMultiple("hidden", "flex");

                const searchSwitch: HTMLElement = target;

                if (searchSwitch.innerHTML.trim() === "search") {
                    searchSwitch.innerHTML = "menu_book";

                    const replacementLogContent: { [key: string]: { original: string; translation: string } } =
                        JSON.parse(await readTextFile(await join(resDir, logFile), { dir: BaseDirectory.Resource }));

                    for (const [key, value] of Object.entries(replacementLogContent)) {
                        const replacedContainer: HTMLDivElement = document.createElement("div");

                        const replacedElement: HTMLDivElement = document.createElement("div");
                        replacedElement.classList.add("replaced-element");

                        replacedElement.innerHTML = `<div class="text-base text-zinc-400">${key}</div><div class=text-base>${value.original}</div><div class="flex justify-center items-center text-xl text-zinc-300 font-material">arrow_downward</div><div class="text-base">${value.translation}</div>`;

                        replacedContainer.appendChild(replacedElement);
                        searchPanelReplaced.appendChild(replacedContainer);
                    }

                    observerFound.disconnect();
                    searchPanelReplaced.style.height = `${searchPanelReplaced.scrollHeight}px`;

                    const searchPanelReplacedChildren: HTMLCollectionOf<HTMLElement> =
                        searchPanelReplaced.children as HTMLCollectionOf<HTMLElement>;

                    for (const container of searchPanelReplacedChildren) {
                        container.style.width = `${container.clientWidth}px`;
                        container.style.height = `${container.clientHeight}px`;

                        observerReplaced.observe(container);
                        container.firstElementChild?.classList.add("hidden");
                    }

                    searchPanelReplaced.addEventListener(
                        "mousedown",
                        async (event: MouseEvent): Promise<void> => await handleReplacedClick(event)
                    );
                } else {
                    searchSwitch.innerHTML = "search";
                    searchPanelReplaced.innerHTML = "";

                    searchPanelReplaced.removeEventListener(
                        "mousedown",
                        async (event): Promise<void> => await handleReplacedClick(event)
                    );
                }
                break;
            case "previous-page-button":
                page = Number.parseInt(searchCurrentPage.textContent!);

                if (Number.parseInt(searchCurrentPage.textContent!) > 1) {
                    searchCurrentPage.textContent = (page - 1).toString();

                    searchPanelFound.innerHTML = "";

                    for (const [id, result] of Object.entries(
                        JSON.parse(
                            await readTextFile(
                                await join(
                                    resDir,
                                    `matches-${Number.parseInt(searchCurrentPage.textContent) - 1}.json`
                                ),
                                {
                                    dir: BaseDirectory.Resource,
                                }
                            )
                        )
                    )) {
                        appendMatch(document.getElementById(id) as HTMLDivElement, result as string);
                    }
                }
                break;
            case "next-page-button":
                page = Number.parseInt(searchCurrentPage.textContent!);

                if (Number.parseInt(searchCurrentPage.textContent!) < Number.parseInt(searchTotalPages.textContent!)) {
                    searchCurrentPage.textContent = (page + 1).toString();
                    searchPanelFound.innerHTML = "";

                    for (const [id, result] of Object.entries(
                        JSON.parse(
                            await readTextFile(
                                await join(
                                    resDir,
                                    `matches-${Number.parseInt(searchCurrentPage.textContent) + 1}.json`
                                ),
                                {
                                    dir: BaseDirectory.Resource,
                                }
                            )
                        )
                    )) {
                        appendMatch(document.getElementById(id) as HTMLDivElement, result as string);
                    }
                }
                break;
        }
    });

    searchInput.addEventListener("blur", (): string => (searchInput.value = searchInput.value.trim()));
    replaceInput.addEventListener("blur", (): string => (replaceInput.value = replaceInput.value.trim()));

    searchInput.addEventListener(
        "keydown",
        async (event: KeyboardEvent): Promise<void> => await handleKeypressSearch(event)
    );
    menuBar.addEventListener("click", (event: MouseEvent): void => menuBarClick(event.target as HTMLElement));

    document.addEventListener("keydown", async (event: KeyboardEvent): Promise<void> => await handleKeypress(event));
    document.addEventListener("keyup", (event: KeyboardEvent): void => {
        if (event.key === "Shift") {
            shiftPressed = false;
        }
    });

    document.addEventListener("focus", handleFocus, true);
    document.addEventListener("blur", handleBlur, true);

    function handleMousedown(event: MouseEvent): void {
        if (event.button === 0) {
            if (shiftPressed) {
                if (
                    contentContainer.contains(document.activeElement) &&
                    document.activeElement?.tagName === "TEXTAREA"
                ) {
                    event.preventDefault();
                    selectedTextareas.clear();

                    selectedMultiple = true;
                    const target: HTMLTextAreaElement = event.target as HTMLTextAreaElement;

                    const targetId: string[] = target.id.split("-");
                    const targetRow: number = Number.parseInt(targetId.pop() as string);

                    const focusedElementId: string[] = document.activeElement.id.split("-");
                    const focusedElementRow: number = Number.parseInt(focusedElementId.pop() as string);

                    let rowsRange: number = targetRow - focusedElementRow;
                    let rowsToSelect: number = Math.abs(rowsRange);

                    for (let i = 1; i < rowsToSelect + 1; i++) {
                        if (rowsRange > 0) {
                            const nextElement: HTMLTextAreaElement = document.getElementById(
                                `${targetId.join("-")}-${focusedElementRow + i}`
                            ) as HTMLTextAreaElement;

                            nextElement.classList.replace("outline-zinc-700", "outline-zinc-500");
                            selectedTextareas.set(nextElement.id, nextElement.value);
                        } else if (rowsRange < 0) {
                            const nextElement: HTMLTextAreaElement = document.getElementById(
                                `${targetId.join("-")}-${focusedElementRow - i}`
                            ) as HTMLTextAreaElement;

                            nextElement.classList.replace("outline-zinc-700", "outline-zinc-500");
                            selectedTextareas.set(nextElement.id, nextElement.value);
                        }
                    }
                }
            } else {
                selectedMultiple = false;

                for (const key of selectedTextareas.keys()) {
                    const textarea: HTMLTextAreaElement = document.getElementById(key) as HTMLTextAreaElement;
                    textarea.classList.replace("outline-zinc-500", "outline-zinc-700");
                }
            }
        }
    }

    goToRowInput.addEventListener("keydown", (event: KeyboardEvent): void => {
        if (event.code === "Enter") {
            const rowNumber: string = goToRowInput.value;
            const targetRow: HTMLTextAreaElement = document.getElementById(
                `${state}-${rowNumber}`
            ) as HTMLTextAreaElement;

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
    });

    document.addEventListener("mousedown", (event: MouseEvent): void => handleMousedown(event));

    await appWindow.onCloseRequested(async (event: CloseRequestedEvent): Promise<void> => {
        await awaitSaving();
        (await exitProgram()) ? await exit(0) : event.preventDefault();
    });
});
