import { readTextFile } from "@tauri-apps/api/fs";
import { BaseDirectory, join } from "@tauri-apps/api/path";

document.addEventListener("DOMContentLoaded", async (): Promise<void> => {
    const hotkeysTitle: HTMLDivElement = document.getElementById("hotkeys-title") as HTMLDivElement;
    const hotkeys: HTMLDivElement = document.getElementById("hotkeys") as HTMLDivElement;

    function setTheme(newTheme: Theme): void {
        for (const [key, value] of Object.entries(newTheme)) {
            const elements = document.querySelectorAll(`.${key}`) as NodeListOf<HTMLElement>;

            for (const element of elements) {
                element.style.setProperty(`--${key}`, value);
            }
        }
    }

    const settings: Settings = JSON.parse(
        await readTextFile(await join("../res", "settings.json"), { dir: BaseDirectory.Resource })
    );

    const themes = JSON.parse(
        await readTextFile(await join("../res", "themes.json"), { dir: BaseDirectory.Resource })
    ) as ThemeObject;
    const theme: Theme = settings.theme ? themes[settings.theme] : themes["cool-zinc"];
    setTheme(theme);

    const hotkeysLanguage: hotkeysTranslation =
        settings.lang === "ru"
            ? JSON.parse(await readTextFile(await join("../res", "ru.json"), { dir: BaseDirectory.Resource })).hotkeys
            : JSON.parse(await readTextFile(await join("../res", "en.json"), { dir: BaseDirectory.Resource })).hotkeys;

    hotkeysTitle.innerHTML = hotkeysLanguage.hotkeysTitle;
    hotkeys.innerHTML = hotkeysLanguage.hotkeys;
});
