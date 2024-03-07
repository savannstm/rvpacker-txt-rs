const { app, BrowserWindow, Menu, screen } = require("electron");
const { join } = require("path");

const DEBUG = false;
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

	createWindow();

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
				label: "Горячие клавиши",
				click: () => {
					const win = new BrowserWindow({
						width: 640,
						height: 480,
						titleBarStyle: "hiddenInset",
						autoHideMenuBar: true
					});
					win.loadFile(join(__dirname, "../frontend/help.html"));
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
				autoHideMenuBar: true
			});
			win.loadFile(join(__dirname, "../frontend/about.html"));
		}
	}
];
