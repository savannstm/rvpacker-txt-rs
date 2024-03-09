const {
	app,
	BrowserWindow,
	Menu,
	ipcMain,
	shell,
	screen
} = require("electron");
const { readFileSync, writeFileSync } = require("fs");
const { join } = require("path");

const DEBUG = true;
const firstLaunch = JSON.parse(
	readFileSync(join(__dirname, "launch.json"), "utf8")
).firstLaunch;

app.on("ready", () => {
	const { width, height } = screen.getPrimaryDisplay().workAreaSize;

	const createWindow = () => {
		const win = new BrowserWindow({
			width: width,
			height: height,
			titleBarStyle: "hiddenInset",
			webPreferences: {
				preload: join(__dirname, "../frontend/preload.js"),
				nodeIntegration: true
			}
		});

		if (DEBUG) {
			win.webContents.openDevTools();
		}
		win.setMenu(Menu.buildFromTemplate(menuTemplate));
		win.loadFile(join(__dirname, "../frontend/index.html"));
	};

	const createHelpWindow = () => {
		const helpWin = new BrowserWindow({
			width: 800,
			height: 600,
			titleBarStyle: "hiddenInset"
		});

		helpWin.loadFile(join(__dirname, "../frontend/help.html"));
	};

	createWindow();
	if (firstLaunch) {
		createHelpWindow();
		writeFileSync(
			join(__dirname, "launch.json"),
			JSON.stringify({ firstLaunch: false }, null, 4)
		);
	}

	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
	}
});

ipcMain.on("quit", () => {
	app.quit();
});

ipcMain.on("openLink", (event, link) => {
	shell.openExternal(link);
});

const menuTemplate = [
	{
		label: "Файл",
		submenu: [
			{
				label: "Перегрузить",
				accelerator: "F5",
				role: "reload"
			},
			{
				label: "Закрыть",
				click: () => {
					app.quit();
				}
			}
		]
	},
	{
		label: "Редактирование",
		submenu: [
			{
				label: "Отменить",
				role: "undo"
			},
			{
				label: "Повторить",
				role: "redo"
			},
			{
				type: "separator"
			},
			{
				label: "Вырезать",
				role: "cut"
			},
			{
				label: "Копировать",
				role: "copy"
			},
			{
				label: "Вставить",
				role: "paste"
			}
		]
	},
	{
		label: "Помощь",
		submenu: [
			{
				label: "Как пользоваться программой?",
				click: () => {
					const win = new BrowserWindow({
						width: 640,
						height: 480,
						titleBarStyle: "hiddenInset",
						autoHideMenuBar: true
					});
					win.loadFile(join(__dirname, "../frontend/help.html"));
				}
			},
			{
				label: "Горячие клавиши",
				click: () => {
					const win = new BrowserWindow({
						width: 640,
						height: 480,
						titleBarStyle: "hiddenInset",
						autoHideMenuBar: true
					});
					win.loadFile(join(__dirname, "../frontend/hotkeys.html"));
				}
			}
		]
	},
	{
		label: "О программе",
		click: () => {
			const win = new BrowserWindow({
				width: 640,
				height: 480,
				titleBarStyle: "hiddenInset",
				autoHideMenuBar: true,
				webPreferences: {
					preload: join(__dirname, "../frontend/about.js"),
					nodeIntegration: true
				}
			});
			win.loadFile(join(__dirname, "../frontend/about.html"));
		}
	}
];
