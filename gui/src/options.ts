import { readTextFile, writeTextFile } from "@tauri-apps/api/fs";
import { BaseDirectory, join } from "@tauri-apps/api/path";
import { appWindow } from "@tauri-apps/api/window";

document.addEventListener("DOMContentLoaded", async (): Promise<void> => {
    const backupPeriodLabel: HTMLSpanElement = document.getElementById("backup-period-label") as HTMLSpanElement;
    const backupPeriodNote: HTMLSpanElement = document.getElementById("backup-period-note") as HTMLSpanElement;
    const backupMaxLabel: HTMLSpanElement = document.getElementById("backup-max-label") as HTMLSpanElement;
    const backupMaxNote: HTMLSpanElement = document.getElementById("backup-max-note") as HTMLSpanElement;
    const backup: HTMLSpanElement = document.getElementById("backup") as HTMLSpanElement;
    const backupCheck: HTMLSpanElement = document.getElementById("backup-check") as HTMLSpanElement;
    const backupSettings: HTMLDivElement = document.getElementById("backup-settings") as HTMLDivElement;
    const backupMaxInput: HTMLInputElement = document.getElementById("backup-max-input") as HTMLInputElement;
    const backupPeriodInput: HTMLInputElement = document.getElementById("backup-period-input") as HTMLInputElement;

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

    const optionsLanguage: optionsTranslation =
        settings.lang === "ru"
            ? JSON.parse(await readTextFile(await join("../res", "ru.json"), { dir: BaseDirectory.Resource })).options
            : JSON.parse(await readTextFile(await join("../res", "en.json"), { dir: BaseDirectory.Resource })).options;

    const themes = JSON.parse(
        await readTextFile(await join("../res", "themes.json"), { dir: BaseDirectory.Resource })
    ) as ThemeObject;
    const theme: Theme = settings.theme ? themes[settings.theme] : themes["cool-zinc"];
    setTheme(theme);

    backupPeriodLabel.innerHTML = optionsLanguage.backupPeriodLabel;
    backupPeriodNote.innerHTML = optionsLanguage.backupPeriodNote;
    backupMaxLabel.innerHTML = optionsLanguage.backupMaxLabel;
    backupMaxNote.innerHTML = optionsLanguage.backupMaxNote;
    backup.innerHTML = optionsLanguage.backup;

    backupMaxInput.value = settings.backup.max.toString();
    backupPeriodInput.value = settings.backup.period.toString();
    backupCheck.innerHTML = settings.backup.enabled ? "check" : "";

    if (!backupCheck.textContent) {
        backupSettings.classList.add("hidden");
        backupSettings.classList.add("-translate-y-full");
    } else {
        backupSettings.classList.add("flex");
        backupSettings.classList.add("translate-y-0");
    }

    backupCheck.addEventListener("click", (): void => {
        if (!backupCheck.textContent) {
            backupSettings.classList.replace("hidden", "flex");
            requestAnimationFrame((): void => {
                backupSettings.classList.replace("-translate-y-full", "translate-y-0");
            });
        } else {
            backupSettings.classList.replace("translate-y-0", "-translate-y-full");
            backupSettings.addEventListener(
                "transitionend",
                (): void => {
                    backupSettings.classList.replace("flex", "hidden");
                },
                { once: true }
            );
        }
        backupCheck.innerHTML = !backupCheck.textContent ? "check" : "";
    });

    backupMaxInput.addEventListener("input", (): void => {
        backupMaxInput.value = backupMaxInput.value.replaceAll(/[^0-9]/g, "");
        const backupMaxValue: number = Number.parseInt(backupMaxInput.value);

        backupMaxInput.value = (backupMaxValue < 1 ? 1 : backupMaxValue > 99 ? 99 : backupMaxValue).toString();
    });

    backupPeriodInput.addEventListener("input", (): void => {
        backupPeriodInput.value = backupPeriodInput.value.replaceAll(/[^0-9]/g, "");
        const backupPeriodValue: number = Number.parseInt(backupPeriodInput.value);

        backupPeriodInput.value = (
            backupPeriodValue < 60 ? 60 : backupPeriodValue > 3600 ? 3600 : backupPeriodValue
        ).toString();
    });

    appWindow.onCloseRequested(async (): Promise<void> => {
        writeTextFile(
            await join("../res", "settings.json"),
            JSON.stringify({
                backup: {
                    enabled: backupCheck.textContent ? true : false,
                    max: backupMaxInput.value,
                    period: backupPeriodInput.value,
                },
                theme: theme,
                lang: settings.lang,
            }),
            { dir: BaseDirectory.Resource }
        );
    });
});
