/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */

const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");
const os = require("os");
const pkg = require("../../../../package.json");
const Store = require("electron-store");
let dev = process.env.DEV_TOOL === 'open';
let mainWindow = undefined;
const store = new Store();

function getWindow() {
    return mainWindow;
}

function destroyWindow() {
    if (!mainWindow) return;
    app.quit();
    mainWindow = undefined;
    console.log("Étape 1 : Fenêtre principale détruite.");
}

function createWindow() {
    destroyWindow();
    console.log("Étape 2 : Fenêtre principale créée.");

    // Retrieve saved window bounds or use defaults
    const defaultBounds = { width: 1280, height: 720 };
    const bounds = store.get("mainWindowBounds", defaultBounds);

    mainWindow = new BrowserWindow({
        title: app.getName(),
        ...bounds,
        minWidth: 980,
        minHeight: 552,
        resizable: true,
        icon: path.resolve(__dirname, `../../images/icon/icon.${os.platform() === "win32" ? "ico" : "png"}`),
        width: 1280,
        height: 720,
        minWidth: 980,
        minHeight: 552,
        resizable: true,
        icon: `./src/assets/images/icon/icon.${os.platform() === "win32" ? "ico" : "png"}`,
        frame: false,
        show: false,
        webPreferences: {
            contextIsolation: false,
            nodeIntegration: true, // Required: renderer code uses require()
        },
    });

    Menu.setApplicationMenu(null);
    mainWindow.setMenuBarVisibility(false);

    mainWindow.loadFile(path.resolve(app.getAppPath(), "src/launcher.html"))
        .catch(err => console.error("Failed to load main window HTML:", err));

    mainWindow.once("ready-to-show", () => {
        if (mainWindow) {
            if (dev) mainWindow.webContents.openDevTools({ mode: "detach" });
            mainWindow.show();
        }
    });

    // Save window bounds on close
    mainWindow.on("close", () => {
        store.set("mainWindowBounds", mainWindow.getBounds());
    });

    mainWindow.webContents.on("before-input-event", (event, input) => {
        if (input.control && input.shift && input.key.toLowerCase() === "i") {
            mainWindow.webContents.openDevTools({ mode: "detach" });
            event.preventDefault();
        }
    });
}

module.exports = {
    getWindow,
    createWindow,
    destroyWindow,
};