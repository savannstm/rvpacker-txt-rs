const { app, BrowserWindow, Menu, ipcMain, shell, screen, dialog } = require("electron");
const { readFileSync, writeFileSync, rmdirSync } = require("fs");
const { copySync } = require("fs-extra");
const { join } = require("path");

const DEBUG = true;
const PLATFORM = process.platform;
const firstLaunch = JSON.parse(readFileSync(join(__dirname, "launch.json"), "utf8")).firstLaunch;
let forceClose;

if (DEBUG && !firstLaunch) {
    writeFileSync(join(__dirname, "launch.json"), JSON.stringify({ firstLaunch: true }, null, 4));
}

app.on("ready", () => {
    const createWindow = () => {
        const { width, height } = screen.getPrimaryDisplay().workAreaSize;

        const win = new BrowserWindow({
            width: width,
            height: height,
            titleBarStyle: "hiddenInset",
            webPreferences: {
                preload: join(__dirname, "../frontend/main.js"),
                nodeIntegration: true,
            },
            show: false,
        });

        if (DEBUG) {
            win.webContents.openDevTools();
        }

        const mainWindowMenu = [
            {
                label: "Файл",
                submenu: [
                    {
                        label: "Перегрузить",
                        accelerator: "F5",
                        click: () => {
                            win.webContents.send("reload");
                        },
                    },
                    {
                        label: "Закрыть",
                        accelerator: "Alt+F4",
                    },
                ],
            },
            {
                label: "Редактирование",
                submenu: [
                    {
                        label: "Отменить",
                        role: "undo",
                    },
                    {
                        label: "Повторить",
                        role: "redo",
                    },
                    {
                        type: "separator",
                    },
                    {
                        label: "Вырезать",
                        role: "cut",
                    },
                    {
                        label: "Копировать",
                        role: "copy",
                    },
                    {
                        label: "Вставить",
                        role: "paste",
                    },
                ],
            },
            {
                label: "Помощь",
                submenu: [
                    {
                        label: "Как пользоваться программой?",
                        click: () => {
                            const helpWin = new BrowserWindow({
                                width: 640,
                                height: 480,
                                autoHideMenuBar: true,
                            });

                            helpWin.moveTop(true);
                            helpWin.loadFile(join(__dirname, "../frontend/help.html"));
                        },
                    },
                    {
                        label: "Горячие клавиши",
                        click: () => {
                            const hotkeysWin = new BrowserWindow({
                                width: 640,
                                height: 480,
                                autoHideMenuBar: true,
                            });

                            hotkeysWin.moveTop(true, "pop-up-menu");
                            hotkeysWin.loadFile(join(__dirname, "../frontend/hotkeys.html"));
                        },
                    },
                ],
            },
            {
                label: "О программе",
                click: () => {
                    const aboutWin = new BrowserWindow({
                        width: 640,
                        height: 480,
                        autoHideMenuBar: true,
                        webPreferences: {
                            preload: join(__dirname, "../frontend/about.js"),
                            nodeIntegration: true,
                        },
                    });

                    aboutWin.moveTop(true);
                    aboutWin.loadFile(join(__dirname, "../frontend/about.html"));
                },
            },
        ];

        win.setMenu(Menu.buildFromTemplate(mainWindowMenu));
        win.loadFile(join(__dirname, "../frontend/main.html"));

        win.once("ready-to-show", () => {
            win.show();
            win.maximize();
            win.focus();
            win.moveTop();

            if (firstLaunch) {
                createHelpWindow();

                if (!DEBUG) {
                    writeFileSync(join(__dirname, "launch.json"), JSON.stringify({ firstLaunch: false }, null, 4));
                }
            }
        });

        win.on("close", (event) => {
            if (forceClose) {
                return app.quit();
            }

            event.preventDefault();
            win.webContents.send("exit-sequence", true);

            console.log("close");
            return;
        });
    };

    const createHelpWindow = () => {
        const helpWin = new BrowserWindow({
            width: 800,
            height: 600,
            autoHideMenuBar: true,
        });

        helpWin.moveTop(true);
        helpWin.loadFile(join(__dirname, "../frontend/help.html"));
    };

    createWindow();

    app.on("window-all-closed", () => {
        if (PLATFORM !== "darwin") {
            return app.quit();
        }
    });

    ipcMain.on("quit", () => {
        forceClose = true;
        return app.quit();
    });

    ipcMain.handle("quit-confirm", async () => {
        const result = await dialog
            .showMessageBox({
                type: "warning",
                title: "У вас остались несохранённые изменения",
                message: "Вы уверены, что хотите выйти?",
                buttons: ["Сохранить и выйти", "Выйти без сохранения", "Отмена"],
                defaultId: 2,
                cancelId: 2,
            })
            .then(({ response: clickedButton }) => {
                if (clickedButton === 0) {
                    return true;
                } else if (clickedButton === 1) {
                    forceClose = true;
                    return app.quit();
                } else {
                    return false;
                }
            });

        return result;
    });

    /*
    ipcMain.handle("get-translation-files", async () => {
        if (PLATFORM !== "win32") {
            dialog.showMessageBoxSync({
                type: "info",
                message: "Скачивание файлов перевода поддерживается только на Windows",
                buttons: ["ОК"],
            });
            return app.quit();
        }

        const result = await dialog
            .showMessageBox({
                type: "warning",
                title: "Скачать файлы перевода?",
                message: "Вы уверены, что хотите скачать файлы перевода?",
                buttons: ["Скачать", "Выйти"],
                defaultId: 1,
                cancelId: 1,
            })
            .then(async ({ response: clickedButton }) => {
                if (clickedButton === 0) {
                    const cloningResult = await Clone(
                        "https://github.com/savannstm/fh-termina-json-writer.git",
                        join(__dirname, "../../../../temp")
                    ).then(() => {
                        copySync(
                            join(__dirname, "../../../../temp/translation"),
                            join(__dirname, "../../../../translation")
                        );

                        rmdirSync(join(__dirname, "../../../../temp"), { recursive: true, force: true });

                        return true;
                    });

                    return cloningResult;
                } else {
                    forceClose = true;
                    return app.quit();
                }
            });

        return result;
    });
    */

    ipcMain.on("openLink", (_event, link) => {
        shell.openExternal(link);
        return;
    });

    ipcMain.handleOnce("create-settings-file", async () => {
        const result = await dialog
            .showMessageBox({
                type: "question",
                title: "Создать файл настроек?",
                message: "Файл с настройками программы не был найден. Создать его?",
                detail: "Отказ приведёт к закрытию программы.",
                buttons: ["Создать", "Отмена"],
                defaultId: 0,
                cancelId: 1,
            })
            .then(({ response: clickedButton }) => {
                if (clickedButton === 0) {
                    writeFileSync(
                        join(__dirname, "../frontend/settings.json"),
                        JSON.stringify(
                            {
                                backup: {
                                    enabled: true,
                                    period: 60,
                                    max: 99,
                                },
                            },
                            null,
                            4
                        ),
                        "utf8"
                    );

                    dialog.showMessageBoxSync({
                        type: "info",
                        message:
                            "Был создан стандартный файл настроек программы с опциями: - резервное копирование включено\n- интервал резервного копирования 60 секунд\n- максимальное количество резервных копий 99.",
                        buttons: ["ОК"],
                    });

                    return true;
                } else {
                    return app.quit();
                }
            });

        return result;
    });

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
