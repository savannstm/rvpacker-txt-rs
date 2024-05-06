const { open: openLink } = window.__TAURI__.shell;
const { readTextFile } = window.__TAURI__.fs;
const { BaseDirectory, join } = window.__TAURI__.path;

window.addEventListener("DOMContentLoaded", async () => {
    const version = document.getElementById("version");
    const about = document.getElementById("about");
    const socials = document.getElementById("socials");
    const vkLink = document.getElementById("vk-link");
    const tgLink = document.getElementById("tg-link");
    const githubLink = document.getElementById("github-link");
    const license = document.getElementById("license");
    const licenseLink = document.getElementById("license-link");
    const wtpflLink = document.getElementById("wtfpl-link");

    const settings = JSON.parse(
        await readTextFile(await join("../res", "settings.json"), { dir: BaseDirectory.Resource })
    );

    const aboutLanguage =
        settings.lang === "ru"
            ? JSON.parse(await readTextFile(await join("../res", "ru.json"), { dir: BaseDirectory.Resource })).about
            : JSON.parse(await readTextFile(await join("../res", "en.json"), { dir: BaseDirectory.Resource })).about;

    version.innerHTML = aboutLanguage.version;
    about.innerHTML = aboutLanguage.about;
    socials.innerHTML = aboutLanguage.socials;
    vkLink.innerHTML = aboutLanguage.vkLink;
    tgLink.innerHTML = aboutLanguage.tgLink;
    githubLink.innerHTML = aboutLanguage.githubLink;
    license.innerHTML = aboutLanguage.license;

    const links = new Map([
        [vkLink, "https://vk.com/stivhuis228"],
        [tgLink, "https://t.me/Arsen1337Curduke"],
        [githubLink, "https://github.com/savannstm/fh-termina-json-writer"],
        [licenseLink, "http://www.wtfpl.net/about"],
        [wtpflLink, "http://www.wtfpl.net"],
    ]);

    for (const [id, url] of links) {
        id.addEventListener("click", async () => await openLink(url));
    }
});
