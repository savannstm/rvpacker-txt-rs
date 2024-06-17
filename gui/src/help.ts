import { readTextFile } from "@tauri-apps/api/fs";
import { BaseDirectory, join } from "@tauri-apps/api/path";

document.addEventListener("DOMContentLoaded", async (): Promise<void> => {
    const helpTitle: HTMLDivElement = document.getElementById("help-title") as HTMLDivElement;
    const help: HTMLDivElement = document.getElementById("help") as HTMLDivElement;

    function setTheme(newTheme: Theme): void {
        for (const [key, value] of Object.entries(newTheme)) {
            const elements = document.querySelectorAll(`.${key}`) as NodeListOf<HTMLElement>;
            console.log(elements);

            for (const element of elements) {
                element.style.setProperty(`--${key}`, value);
                console.log(element.style.getPropertyValue(`--${key}`));
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

    const helpLanguage: helpTranslation =
        settings.lang === "ru"
            ? JSON.parse(await readTextFile(await join("../res", "ru.json"), { dir: BaseDirectory.Resource })).help
            : JSON.parse(await readTextFile(await join("../res", "en.json"), { dir: BaseDirectory.Resource })).help;

    helpTitle.innerHTML = helpLanguage.helpTitle;
    help.innerHTML = helpLanguage.help;
});
