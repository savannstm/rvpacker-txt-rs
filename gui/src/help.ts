import { readTextFile } from "@tauri-apps/api/fs";
import { BaseDirectory, join } from "@tauri-apps/api/path";

document.addEventListener("DOMContentLoaded", async (): Promise<void> => {
    const helpTitle: HTMLDivElement = document.getElementById("help-title") as HTMLDivElement;
    const help: HTMLDivElement = document.getElementById("help") as HTMLDivElement;

    const settings: Settings = JSON.parse(
        await readTextFile(await join("../res", "settings.json"), { dir: BaseDirectory.Resource })
    );

    const helpLanguage: helpTranslation =
        settings.lang === "ru"
            ? JSON.parse(await readTextFile(await join("../res", "ru.json"), { dir: BaseDirectory.Resource })).help
            : JSON.parse(await readTextFile(await join("../res", "en.json"), { dir: BaseDirectory.Resource })).help;

    helpTitle.innerHTML = helpLanguage.helpTitle;
    help.innerHTML = helpLanguage.help;
});
