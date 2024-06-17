import { open as openLink } from "@tauri-apps/api/shell";
import { readTextFile } from "@tauri-apps/api/fs";
import { BaseDirectory, join } from "@tauri-apps/api/path";
import { getVersion } from "@tauri-apps/api/app";

window.addEventListener("DOMContentLoaded", async (): Promise<void> => {
    const version: HTMLSpanElement = document.getElementById("version") as HTMLSpanElement;
    const versionNumber: HTMLSpanElement = document.getElementById("version-number") as HTMLSpanElement;
    const about: HTMLDivElement = document.getElementById("about") as HTMLDivElement;
    const socials: HTMLDivElement = document.getElementById("socials") as HTMLDivElement;
    const vkLink: HTMLAnchorElement = document.getElementById("vk-link") as HTMLAnchorElement;
    const tgLink: HTMLAnchorElement = document.getElementById("tg-link") as HTMLAnchorElement;
    const githubLink: HTMLAnchorElement = document.getElementById("github-link") as HTMLAnchorElement;
    const license: HTMLSpanElement = document.getElementById("license") as HTMLSpanElement;
    const licenseLink: HTMLAnchorElement = document.getElementById("license-link") as HTMLAnchorElement;
    const wtpflLink: HTMLAnchorElement = document.getElementById("wtfpl-link") as HTMLAnchorElement;

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

    const aboutLanguage: aboutTranslation =
        settings.lang === "ru"
            ? JSON.parse(await readTextFile(await join("../res", "ru.json"), { dir: BaseDirectory.Resource })).about
            : JSON.parse(await readTextFile(await join("../res", "en.json"), { dir: BaseDirectory.Resource })).about;

    const themes = JSON.parse(
        await readTextFile(await join("../res", "themes.json"), { dir: BaseDirectory.Resource })
    ) as ThemeObject;
    const theme: Theme = settings.theme ? themes[settings.theme] : themes["cool-zinc"];
    setTheme(theme);

    version.innerHTML = aboutLanguage.version;
    versionNumber.innerHTML = await getVersion();
    about.innerHTML = aboutLanguage.about;
    socials.innerHTML = aboutLanguage.socials;
    vkLink.innerHTML = aboutLanguage.vkLink;
    tgLink.innerHTML = aboutLanguage.tgLink;
    githubLink.innerHTML = aboutLanguage.githubLink;
    license.innerHTML = aboutLanguage.license;

    const links: Map<HTMLAnchorElement, string> = new Map([
        [vkLink, "https://vk.com/stivhuis228"],
        [tgLink, "https://t.me/Arsen1337Curduke"],
        [githubLink, "https://github.com/savannstm/fh-termina-json-writer"],
        [licenseLink, "http://www.wtfpl.net/about"],
        [wtpflLink, "http://www.wtfpl.net"],
    ]);

    for (const [id, url] of links) {
        id.addEventListener("click", async (): Promise<void> => await openLink(url));
    }
});
