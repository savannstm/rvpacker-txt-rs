const { ipcRenderer } = require("electron");

window.addEventListener("DOMContentLoaded", () => {
    /** @param {string} link */
    function openLink(link) {
        ipcRenderer.send("openLink", link);
    }

    const links = new Map([
        [document.getElementById("vk-link"), "https://vk.com/stivhuis228"],
        [document.getElementById("tg-link"), "https://t.me/Arsen1337Curduke"],
        [document.getElementById("github-link"), "https://github.com/savannstm/fh-termina-json-writer"],
        [document.getElementById("license-link"), "http://www.wtfpl.net/about"],
        [document.getElementById("wtfpl-link"), "http://www.wtfpl.net"],
    ]);

    for (const [id, url] of links) {
        id.addEventListener("click", () => openLink(url));
    }
});
