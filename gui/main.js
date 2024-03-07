const { app, BrowserWindow, screen } = require("electron");
const path = require("path");

app.on("ready", () => {
	const { width, height } = screen.getPrimaryDisplay().workAreaSize;

	const createWindow = () => {
		const win = new BrowserWindow({
			width: width,
			height: height,
			titleBarStyle: "hiddenInset",
			webPreferences: {
				preload: path.join(__dirname, "preload.js"),
				nodeIntegration: true
			}
		});

		win.webContents.openDevTools();
		win.loadFile("index.html");
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
