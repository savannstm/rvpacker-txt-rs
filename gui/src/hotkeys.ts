import { Theme } from "./themes";

import { readTextFile } from "@tauri-apps/api/fs";
import { BaseDirectory, join } from "@tauri-apps/api/path";

document.addEventListener("DOMContentLoaded", async (): Promise<void> => {
    const hotkeysTitle: HTMLDivElement = document.getElementById("hotkeys-title") as HTMLDivElement;
    const hotkeys: HTMLDivElement = document.getElementById("hotkeys") as HTMLDivElement;

    function setTheme(theme: Theme): void {
        for (const [key, value] of Object.entries(theme)) {
            const elements: NodeListOf<HTMLElement> = document.querySelectorAll(`.${key}`) as NodeListOf<HTMLElement>;

            for (const element of elements) {
                element.classList.add(value);
            }
        }
    }

    const settings: Settings = JSON.parse(
        await readTextFile(await join("../res", "settings.json"), { dir: BaseDirectory.Resource })
    );

    const theme: Theme = settings.theme ? new Theme(settings.theme) : new Theme();

    setTheme(theme);

    const hotkeysLanguage: hotkeysTranslation =
        settings.lang === "ru"
            ? JSON.parse(await readTextFile(await join("../res", "ru.json"), { dir: BaseDirectory.Resource })).hotkeys
            : JSON.parse(await readTextFile(await join("../res", "en.json"), { dir: BaseDirectory.Resource })).hotkeys;

    hotkeysTitle.innerHTML = hotkeysLanguage.hotkeysTitle;
    hotkeys.innerHTML = hotkeysLanguage.hotkeys;
});
