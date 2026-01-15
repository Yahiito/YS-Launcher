/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */
// import panel
import Login from "./panels/login.js";
import Home from "./panels/home.js";
import Settings from "./panels/settings.js";

// import modules
import {
  logger,
  config,
  changePanel,
  database,
  popup,
  setBackground,
  accountSelect,
  addAccount,
  pkg,
} from "./utils.js";
const { AZauth, Microsoft, Mojang } = require("minecraft-java-core");

// libs
const { ipcRenderer } = require("electron");
const fs = require("fs");
const os = require("os");

class Launcher {
  async init() {
    console.log("Étape 1 : Initialisation du launcher...");
    this.initLog();
    console.log("Étape 2 : Raccourcis configurés.");
    this.shortcut();
    // Important: restaurer la DB AVANT toute lecture (thème, comptes, etc.).
    try { await ipcRenderer.invoke('launcher-data-restore-if-missing'); } catch {}
    console.log("Étape 3 : Arrière-plan défini.");
    await setBackground();
    console.log("Étape 4 : Cadre de la fenêtre initialisé.");
    this.initFrame();
    console.log("Étape 5 : Thème initialisé.");
    this.initializeTheme();
    console.log("Étape 6 : Configuration chargée.");
    this.config = await config
      .GetConfig()
      .then((res) => res)
      .catch((err) => err);
    if (await this.config.error) return this.errorConnect();
    this.db = new database();
    await this.initConfigClient();
    this.createPanels(Login, Home, Settings);
    this.startLauncher();
  }

  initLog() {
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey && e.shiftKey && e.keyCode == 73) || e.keyCode == 123) {
        ipcRenderer.send("main-window-dev-tools-close");
        ipcRenderer.send("main-window-dev-tools");
      }
    });
    new logger(pkg.name, "#7289da");
  }

  shortcut() {
    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.keyCode == 87) {
        ipcRenderer.send("main-window-close");
      }
    });
  }

  errorConnect() {
    new popup().openPopup({
      title: this.config.error.code,
      content: this.config.error.message,
      color: "red",
      exit: true,
      options: true,
    });
  }

  initFrame() {
    console.log("Initializing Frame...");
    const platform = os.platform() === "darwin" ? "darwin" : "other";

    document.querySelector(`.${platform} .frame`).classList.toggle("hide");

    document
      .querySelector(`.${platform} .frame #minimize`)
      .addEventListener("click", () => {
        ipcRenderer.send("main-window-minimize");
      });

    let maximized = false;
    let maximize = document.querySelector(`.${platform} .frame #maximize`);
    maximize.addEventListener("click", () => {
      if (maximized) ipcRenderer.send("main-window-maximize");
      else ipcRenderer.send("main-window-maximize");
      maximized = !maximized;
      maximize.classList.toggle("icon-maximize");
      maximize.classList.toggle("icon-restore-down");
    });

    document
      .querySelector(`.${platform} .frame #close`)
      .addEventListener("click", () => {
        ipcRenderer.send("main-window-close");
      });
  }

  async initConfigClient() {
    console.log("Initializing Config Client...");
    let configClient = await this.db.readData("configClient");

    if (!configClient) {
      await this.db.createData("configClient", {
        account_selected: null,
        instance_selct: null,
        java_config: {
          java_path: null,
          java_memory: {
            min: 2,
            max: 4,
          },
        },
        game_config: {
          screen_size: {
            width: 854,
            height: 480,
          },
        },
        launcher_config: {
          download_multi: 5,
          theme: "auto",
          closeLauncher: "close-launcher",
          intelEnabledMac: true,
        },
      });
    }
  }

  createPanels(...panels) {
    let panelsElem = document.querySelector(".panels");
    for (let panel of panels) {
      console.log(`Initializing ${panel.name} Panel...`);
      let div = document.createElement("div");
      div.classList.add("panel", panel.id);
      div.innerHTML = fs.readFileSync(
        `${__dirname}/panels/${panel.id}.html`,
        "utf8"
      );
      panelsElem.appendChild(div);
      new panel().init(this.config);
    }
  }

  async startLauncher() {
    try {
      const configClient = await this.db.readData("configClient");
      // Récupère tous les comptes locaux
      const allAccounts = await this.db.readAllData("accounts");
      let connectedAccounts = [];
      for (const acc of allAccounts) {
        if (acc.username && acc.password) {
          try {
            // Tente une connexion automatique au site web
            const response = await fetch("https://lapepterie.com/Minecraft/auth.php", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ username: acc.username, password: acc.password }),
              credentials: "include"
            });
            const data = await response.json();
            if (data && data.username) {
              connectedAccounts.push(acc);
              // Optionnel : mettre à jour la session locale si besoin
            }
          } catch (e) {
            console.warn("[YS-Launcher]: Connexion auto échouée pour", acc.username, e);
          }
        }
        new logger(pkg.name, '#7289da')
    }

    // ...existing code...
      // Si au moins un compte connecté, sélectionne le premier
      if (connectedAccounts.length > 0) {
        const account = connectedAccounts[0];
        // Ajoute le compte à l'UI (liste comptes paramètre)
        if (typeof addAccount === "function") {
          addAccount(account);
        }
        if (typeof accountSelect === "function") {
          try {
            await accountSelect(account);
          } catch (e) {
            console.error("[YS-Launcher]: Erreur lors de accountSelect:", e);
          }
        }
        // ...lance le jeu ou la home comme avant...
        const username = account.name || account.username || "OfflineUser";
        if (typeof this.launchOffline === "function") {
          await this.launchOffline({
            type: "offline",
            username,
            version: this.config?.version || "1.20.1",
          });
        } else {
          changePanel("home");
        }
        return;
      }
      // Sinon, panel login
      changePanel("login");
    } catch (err) {
      console.error("[YS-Launcher]: Erreur startLauncher:", err);
      changePanel("login");
    }
  }

  // Added a new method to handle theme initialization
  initializeTheme() {
    document.addEventListener('DOMContentLoaded', async () => {
        let configClient = await this.db.readData('configClient');
        let theme = configClient?.launcher_config?.theme || "auto";
        let isDarkTheme = await ipcRenderer.invoke('is-dark-theme', theme).then(res => res);
        document.body.className = isDarkTheme ? 'dark global' : 'light global';
    });
  }
}

new Launcher().init();
