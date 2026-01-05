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
    console.log("Étape 6 : Configuration chargée.");
    this.config = await config
      .GetConfig()
      .then((res) => res)
      .catch((err) => err);
    if (await this.config.error) return this.errorConnect();
    this.db = new database();
    await this.initConfigClient();
    await this.initializeTheme();
    this.createPanels(Login, Home, Settings);
    await this.startLauncher();
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
      const allAccounts = await this.db.readAllData("accounts");

      if (!Array.isArray(allAccounts) || allAccounts.length === 0) {
        changePanel("login");
        return;
      }

      // Populate UI list (settings accounts list)
      if (typeof addAccount === "function") {
        for (const account of allAccounts) addAccount(account);
      }

      const selectedIdRaw = configClient?.account_selected;
      const selectedId = selectedIdRaw != null ? Number(selectedIdRaw) : NaN;
      const selectedAccount =
        (!Number.isNaN(selectedId)
          ? allAccounts.find((a) => Number(a.ID) === selectedId)
          : null) || allAccounts[0];

      // Best-effort: refresh website session for offline accounts
      const loginName = selectedAccount?.username || selectedAccount?.name;
      if (loginName && selectedAccount?.password) {
        try {
          await fetch("https://lapepterie.com/Minecraft/auth.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: loginName, password: selectedAccount.password }),
            credentials: "include",
          });
        } catch (e) {
          console.warn("[YS-Launcher]: Connexion auto (session web) échouée:", e);
        }
      }

      if (typeof accountSelect === "function") {
        try {
          await accountSelect(selectedAccount);
        } catch (e) {
          console.error("[YS-Launcher]: Erreur lors de accountSelect:", e);
        }
      }

      // Ensure selected account is persisted
      if (configClient && selectedAccount?.ID != null) {
        configClient.account_selected = selectedAccount.ID;
        await this.db.updateData("configClient", configClient);
      }

      changePanel("home");
    } catch (err) {
      console.error("[YS-Launcher]: Erreur startLauncher:", err);
      changePanel("login");
    }
  }

  // Added a new method to handle theme initialization
  async initializeTheme() {
    try {
      const configClient = await this.db.readData("configClient");
      const theme = configClient?.launcher_config?.theme || "auto";
      const isDarkTheme = await ipcRenderer.invoke("is-dark-theme", theme);
      document.body.className = isDarkTheme ? "dark global" : "light global";
    } catch (e) {
      // Keep default styling if anything fails
    }
  }
}

new Launcher().init();
