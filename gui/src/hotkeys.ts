import { readTextFile } from "@tauri-apps/api/fs";
import { BaseDirectory, join } from "@tauri-apps/api/path";

document.addEventListener("DOMContentLoaded", async (): Promise<void> => {
    const hotkeysTitle: HTMLDivElement = document.getElementById("hotkeys-title") as HTMLDivElement;
    const hotkeys: HTMLDivElement = document.getElementById("hotkeys") as HTMLDivElement;

    const settings: Settings = JSON.parse(
        await readTextFile(await join("../res", "settings.json"), { dir: BaseDirectory.Resource })
    );

    const hotkeysLanguage: hotkeysTranslation =
        settings.lang === "ru"
            ? JSON.parse(await readTextFile(await join("../res", "ru.json"), { dir: BaseDirectory.Resource })).hotkeys
            : JSON.parse(await readTextFile(await join("../res", "en.json"), { dir: BaseDirectory.Resource })).hotkeys;

    hotkeysTitle.innerHTML = hotkeysLanguage.hotkeysTitle;
    hotkeys.innerHTML = hotkeysLanguage.hotkeys;
});
