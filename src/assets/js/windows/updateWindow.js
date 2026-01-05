/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */

"use strict";
const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");
const os = require("os");
const Store = require("electron-store");
let dev = process.env.DEV_TOOL === 'open';
let updateWindow = undefined;
const store = new Store();

function getWindow() {
    return updateWindow;
}

function destroyWindow() {
    if (!updateWindow) return;
    updateWindow.close();
    updateWindow = undefined;
    console.log("Étape 1 : Fenêtre de mise à jour détruite.");
}

function createWindow() {
    destroyWindow();

    // Retrieve saved window bounds or use defaults
    const defaultBounds = { width: 400, height: 500 };
    const bounds = store.get("updateWindowBounds", defaultBounds);

    updateWindow = new BrowserWindow({
        title: "Mise à jour",
        ...bounds,
        resizable: false,
        icon: path.resolve(__dirname, `../../images/icon/icon.${os.platform() === "win32" ? "ico" : "png"}`),
        icon: `./src/assets/images/icon/icon.${os.platform() === "win32" ? "ico" : "png"}`,
        frame: false,
        show: false,
        webPreferences: {
            contextIsolation: false,
            nodeIntegration: true, // Required: renderer code uses require()
            preload: path.resolve(__dirname, "../preload.js") // Use preload script if needed
        },
    });

    Menu.setApplicationMenu(null);
    updateWindow.setMenuBarVisibility(false);

    updateWindow.loadFile(path.resolve(app.getAppPath(), "src/index.html"))
        .catch(err => console.error("Failed to load update window HTML:", err));

    updateWindow.once("ready-to-show", () => {
        if (updateWindow) {
            if (dev) updateWindow.webContents.openDevTools({ mode: "detach" });
            updateWindow.show();
        }
    });

    // Save window bounds on close
    updateWindow.on("close", () => {
        store.set("updateWindowBounds", updateWindow.getBounds());
    });

    console.log("Étape 2 : Fenêtre de mise à jour créée.");
}

module.exports = {
    getWindow,
    createWindow,
    destroyWindow,
};