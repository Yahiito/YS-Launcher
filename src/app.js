/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */

const { app, ipcMain, nativeTheme } = require("electron");
const deleteSkinsFolder = require("./deleteSkinsFolder");
// Supprimer le dossier %appdata%/.YS-Launcher/assets/skins au lancement
deleteSkinsFolder();
console.log("Étape 1 : Suppression du dossier des skins réussie.");

const { Microsoft } = require("minecraft-java-core");
const { autoUpdater } = require("electron-updater");

const path = require("path");
const fs = require("fs");
const Store = require("electron-store");

Store.initRenderer();

const UpdateWindow = require("./assets/js/windows/updateWindow.js");
const MainWindow = require("./assets/js/windows/mainWindow.js");

let dev = process.env.NODE_ENV === "dev";

function getLauncherDataPaths() {
  const userDataPath = app.getPath("userData");
  const dbDir = dev
    ? path.resolve(userDataPath, "..")
    : path.resolve(userDataPath, "databases");
  const primaryFile = path.join(dbDir, "launcher-data.json");

  // Backup hors du dossier userData/databases pour survivre aux updates.
  const backupDir = path.resolve(app.getPath("appData"), "YS-Launcher-backup");
  const backupFile = path.join(backupDir, "launcher-data.json");
  return { dbDir, primaryFile, backupDir, backupFile };
}

function backupLauncherData() {
  try {
    const { primaryFile, backupDir, backupFile } = getLauncherDataPaths();
    if (!fs.existsSync(primaryFile)) return;
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    fs.copyFileSync(primaryFile, backupFile);
    console.log("[YS-Launcher]: Backup launcher-data OK ->", backupFile);
  } catch (e) {
    console.error("[YS-Launcher]: Backup launcher-data échoué:", e);
  }
}

function restoreLauncherDataIfMissing() {
  try {
    const { dbDir, primaryFile, backupFile } = getLauncherDataPaths();
    if (fs.existsSync(primaryFile)) return true;
    if (!fs.existsSync(backupFile)) return false;

    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    fs.copyFileSync(backupFile, primaryFile);
    console.log("[YS-Launcher]: Restauration launcher-data OK ->", primaryFile);
    return true;
  } catch (e) {
    console.error("[YS-Launcher]: Restauration launcher-data échouée:", e);
    return false;
  }
}

if (dev) {
  let appPath = path.resolve("./data/Launcher").replace(/\\/g, "/");
  let appdata = path.resolve("./data").replace(/\\/g, "/");
  if (!fs.existsSync(appPath)) fs.mkdirSync(appPath, { recursive: true });
  if (!fs.existsSync(appdata)) fs.mkdirSync(appdata, { recursive: true });
  app.setPath("userData", appPath);
  app.setPath("appData", appdata);
  console.log("Étape 2 : Chemins des données créés en mode développement.");
}

if (!app.requestSingleInstanceLock()) app.quit();
else
  app.whenReady().then(() => {
    if (dev) return MainWindow.createWindow();
    UpdateWindow.createWindow();
    console.log("Étape 3 : Fenêtre principale ou de mise à jour créée.");
  });

// Sauvegarde à la fermeture (couvre fermeture normale + quitAndInstall).
app.on("before-quit", () => {
  backupLauncherData();
});

ipcMain.on("main-window-open", () => MainWindow.createWindow());
ipcMain.on("main-window-dev-tools", () =>
  MainWindow.getWindow().webContents.openDevTools({ mode: "detach" })
);
ipcMain.on("main-window-dev-tools-close", () =>
  MainWindow.getWindow().webContents.closeDevTools()
);
ipcMain.on("main-window-close", () => MainWindow.destroyWindow());
ipcMain.on("main-window-reload", () => MainWindow.getWindow().reload());
ipcMain.on("main-window-progress", (event, options) =>
  MainWindow.getWindow().setProgressBar(options.progress / options.size)
);
ipcMain.on("main-window-progress-reset", () =>
  MainWindow.getWindow().setProgressBar(-1)
);
ipcMain.on("main-window-progress-load", () =>
  MainWindow.getWindow().setProgressBar(2)
);
ipcMain.on("main-window-minimize", () => MainWindow.getWindow().minimize());

ipcMain.on("update-window-close", () => UpdateWindow.destroyWindow());
ipcMain.on("update-window-dev-tools", () =>
  UpdateWindow.getWindow().webContents.openDevTools({ mode: "detach" })
);
ipcMain.on("update-window-progress", (event, options) =>
  UpdateWindow.getWindow().setProgressBar(options.progress / options.size)
);
ipcMain.on("update-window-progress-reset", () =>
  UpdateWindow.getWindow().setProgressBar(-1)
);
ipcMain.on("update-window-progress-load", () =>
  UpdateWindow.getWindow().setProgressBar(2)
);

ipcMain.handle("path-user-data", () => app.getPath("userData"));
ipcMain.handle("appData", (e) => app.getPath("appData"));

// Appelé au démarrage AVANT toute initialisation d'electron-store côté renderer.
ipcMain.handle("launcher-data-restore-if-missing", () => {
  return restoreLauncherDataIfMissing();
});

ipcMain.on("main-window-maximize", () => {
  if (MainWindow.getWindow().isMaximized()) {
    MainWindow.getWindow().unmaximize();
  } else {
    MainWindow.getWindow().maximize();
  }
});

ipcMain.on("main-window-hide", () => MainWindow.getWindow().hide());
ipcMain.on("main-window-show", () => MainWindow.getWindow().show());

ipcMain.handle("Microsoft-window", async (_, client_id) => {
  return await new Microsoft(client_id).getAuth();
});

ipcMain.handle("is-dark-theme", (_, theme) => {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return nativeTheme.shouldUseDarkColors;
});

app.on("window-all-closed", () => app.quit());

autoUpdater.autoDownload = false;

ipcMain.handle("update-app", async () => {
  return await new Promise(async (resolve, reject) => {
    autoUpdater
      .checkForUpdates()
      .then((res) => {
        resolve(res);
      })
      .catch((error) => {
        reject({
          error: true,
          message: error,
        });
      });
  });
});

autoUpdater.on("update-available", () => {
  const updateWindow = UpdateWindow.getWindow();
  if (updateWindow) updateWindow.webContents.send("updateAvailable");
});

ipcMain.on("start-update", () => {
  autoUpdater.downloadUpdate();
});

autoUpdater.on("update-not-available", () => {
  const updateWindow = UpdateWindow.getWindow();
  if (updateWindow) updateWindow.webContents.send("update-not-available");
});

autoUpdater.on("update-downloaded", () => {
  autoUpdater.quitAndInstall();
});

autoUpdater.on("download-progress", (progress) => {
  const updateWindow = UpdateWindow.getWindow();
  if (updateWindow)
    updateWindow.webContents.send("download-progress", progress);
});

autoUpdater.on("error", (err) => {
  const updateWindow = UpdateWindow.getWindow();
  if (updateWindow) updateWindow.webContents.send("error", err);
});
