const { readTextFile, writeTextFile } = window.__TAURI__.fs;
const { BaseDirectory, join } = window.__TAURI__.path;
const { appWindow } = window.__TAURI__.window;

document.addEventListener("DOMContentLoaded", async () => {
    const backupPeriodLabel = document.getElementById("backup-period-label");
    const backupPeriodNote = document.getElementById("backup-period-note");
    const backupMaxLabel = document.getElementById("backup-max-label");
    const backupMaxNote = document.getElementById("backup-max-note");
    const backup = document.getElementById("backup");
    const backupCheck = document.getElementById("backup-check");
    const backupSettings = document.getElementById("backup-settings");
    const backupMaxInput = document.getElementById("backup-max-input");
    const backupPeriodInput = document.getElementById("backup-period-input");

    const settings = JSON.parse(
        await readTextFile(await join("../res", "settings.json"), { dir: BaseDirectory.Resource })
    );

    const optionsLanguage =
        settings.lang === "ru"
            ? JSON.parse(await readTextFile(await join("../res", "ru.json"), { dir: BaseDirectory.Resource })).options
            : JSON.parse(await readTextFile(await join("../res", "en.json"), { dir: BaseDirectory.Resource })).options;

    backupPeriodLabel.innerHTML = optionsLanguage.backupPeriodLabel;
    backupPeriodNote.innerHTML = optionsLanguage.backupPeriodNote;
    backupMaxLabel.innerHTML = optionsLanguage.backupMaxLabel;
    backupMaxNote.innerHTML = optionsLanguage.backupMaxNote;
    backup.innerHTML = optionsLanguage.backup;

    backupMaxInput.value = settings.backup.max;
    backupPeriodInput.value = settings.backup.period;
    backupCheck.innerHTML = settings.backup.enabled ? "check" : "";

    if (!backupCheck.textContent) {
        backupSettings.classList.add("hidden");
        backupSettings.classList.add("-translate-y-full");
    } else {
        backupSettings.classList.add("flex");
        backupSettings.classList.add("translate-y-0");
    }

    backupCheck.addEventListener("click", () => {
        if (!backupCheck.textContent) {
            backupSettings.classList.replace("hidden", "flex");
            requestAnimationFrame(() => {
                backupSettings.classList.replace("-translate-y-full", "translate-y-0");
            });
        } else {
            backupSettings.classList.replace("translate-y-0", "-translate-y-full");
            backupSettings.addEventListener(
                "transitionend",
                () => {
                    backupSettings.classList.replace("flex", "hidden");
                },
                { once: true }
            );
        }
        backupCheck.innerHTML = !backupCheck.textContent ? "check" : "";
    });

    backupMaxInput.addEventListener("input", () => {
        backupMaxInput.value = backupMaxInput.value.replaceAll(/[^0-9]/g, "");
        const backupMaxValue = Number.parseInt(backupMaxInput.value);
        backupMaxInput.value = backupMaxValue < 1 ? 1 : backupMaxValue > 99 ? 99 : backupMaxValue;
    });

    backupPeriodInput.addEventListener("input", () => {
        backupPeriodInput.value = backupPeriodInput.value.replaceAll(/[^0-9]/g, "");
        const backupPeriodValue = Number.parseInt(backupPeriodInput.value);
        backupPeriodInput.value = backupPeriodValue < 60 ? 60 : backupPeriodValue > 3600 ? 3600 : backupPeriodValue;
    });

    appWindow.onCloseRequested(async () => {
        writeTextFile(
            await join("../res", "settings.json"),
            JSON.stringify({
                backup: {
                    enabled: backupCheck.textContent ? true : false,
                    max: backupMaxInput.value,
                    period: backupPeriodInput.value,
                },
                lang: settings.lang,
            }),
            { dir: BaseDirectory.Resource }
        );
    });
});
