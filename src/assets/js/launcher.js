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
      const accounts = Array.isArray(allAccounts) ? allAccounts : [];

      // Si on a déjà un compte sélectionné localement, on le reprend (même sans password).
      let selectedAccount = null;
      if (configClient?.account_selected) {
        selectedAccount = accounts.find((a) => a.ID === configClient.account_selected) || null;
      }
      if (!selectedAccount && accounts.length > 0) selectedAccount = accounts[0];

      // Hydrate la liste des comptes dans l'UI (settings) si disponible
      if (typeof addAccount === "function") {
        for (const acc of accounts) {
          try { await addAccount(acc); } catch (_) {}
        }
      }

      if (selectedAccount) {
        // Si on a username+password, on tente l'auth web. Sinon on garde la session locale.
        if (selectedAccount.username && selectedAccount.password) {
          try {
            const response = await fetch("https://lapepterie.com/Minecraft/auth.php", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ username: selectedAccount.username, password: selectedAccount.password }),
              credentials: "include",
            });
            const data = await response.json();
            if (!response.ok || data?.error) {
              changePanel("login");
              return;
            }
          } catch (e) {
            console.warn("[YS-Launcher]: Connexion auto échouée pour", selectedAccount.username, e);
            changePanel("login");
            return;
          }
        }

        if (typeof accountSelect === "function") {
          try { await accountSelect(selectedAccount); } catch (e) {
            console.error("[YS-Launcher]: Erreur lors de accountSelect:", e);
          }
        }

        changePanel("home");
        return;
      }

      // Aucun compte local => panel login
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
