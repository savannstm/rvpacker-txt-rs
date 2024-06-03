import { Theme } from "./themes";

import { readTextFile } from "@tauri-apps/api/fs";
import { BaseDirectory, join } from "@tauri-apps/api/path";

document.addEventListener("DOMContentLoaded", async (): Promise<void> => {
    const helpTitle: HTMLDivElement = document.getElementById("help-title") as HTMLDivElement;
    const help: HTMLDivElement = document.getElementById("help") as HTMLDivElement;
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

    const helpLanguage: helpTranslation =
        settings.lang === "ru"
            ? JSON.parse(await readTextFile(await join("../res", "ru.json"), { dir: BaseDirectory.Resource })).help
            : JSON.parse(await readTextFile(await join("../res", "en.json"), { dir: BaseDirectory.Resource })).help;

    helpTitle.innerHTML = helpLanguage.helpTitle;
    help.innerHTML = helpLanguage.help;
});
