const { readTextFile } = window.__TAURI__.fs;
const { BaseDirectory, join } = window.__TAURI__.path;

document.addEventListener("DOMContentLoaded", async () => {
    const hotkeysTitle = document.getElementById("hotkeys-title");
    const hotkeys = document.getElementById("hotkeys");

    const settings = JSON.parse(
        await readTextFile(await join("../res", "settings.json"), { dir: BaseDirectory.Resource })
    );

    const hotkeysLanguage =
        settings.lang === "ru"
            ? JSON.parse(await readTextFile(await join("../res", "ru.json"), { dir: BaseDirectory.Resource })).hotkeys
            : JSON.parse(await readTextFile(await join("../res", "en.json"), { dir: BaseDirectory.Resource })).hotkeys;

    hotkeysTitle.innerHTML = hotkeysLanguage.hotkeysTitle;
    hotkeys.innerHTML = hotkeysLanguage.hotkeys;
});
