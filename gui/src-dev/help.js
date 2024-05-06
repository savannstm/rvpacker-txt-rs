const { readTextFile } = window.__TAURI__.fs;
const { BaseDirectory, join } = window.__TAURI__.path;

document.addEventListener("DOMContentLoaded", async () => {
    const helpTitle = document.getElementById("help-title");
    const help = document.getElementById("help");

    const settings = JSON.parse(
        await readTextFile(await join("../res", "settings.json"), { dir: BaseDirectory.Resource })
    );

    const helpLanguage =
        settings.lang === "ru"
            ? JSON.parse(await readTextFile(await join("../res", "ru.json"), { dir: BaseDirectory.Resource })).help
            : JSON.parse(await readTextFile(await join("../res", "en.json"), { dir: BaseDirectory.Resource })).help;

    helpTitle.innerHTML = helpLanguage.helpTitle;
    help.innerHTML = helpLanguage.help;
});
