/**
 * @author Luuxis
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
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
    this.initLog();
    console.log("Initializing Launcher...");
    this.shortcut();
    await setBackground();
    this.initFrame();
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
      const accountId = configClient?.account_selected;

      console.log("[YS-Launcher]: Account ID selected:", accountId);

      const account = accountId
        ? await this.db.readData("accounts", accountId)
        : null;

      if (!account) {
        console.warn("[YS-Launcher]: Pas de compte : retour au login.");
        return changePanel("login");
      }

      console.log("[YS-Launcher]: Account found:", account);

      // Evite d'appeler accountSelect si l'élément ciblé n'existe pas
      if (typeof accountSelect === "function") {
        try {
          await accountSelect(account);
        } catch (e) {
          console.error("[YS-Launcher]: Erreur lors de accountSelect:", e);
        }
      } else {
        console.warn("[YS-Launcher]: accountSelect n'est pas une fonction");
      }

      const username = account.name || account.username || "OfflineUser";

      // Exemple d'appel à launchOffline si c'est une méthode existante
      if (typeof this.launchOffline === "function") {
        await this.launchOffline({
          type: "offline",
          username,
          version: this.config?.version || "1.20.1",
        });
      } else {
        console.warn("[YS-Launcher]: launchOffline n'est pas défini");
        changePanel("home");
      }
    } catch (err) {
      console.error("[YS-Launcher]: Erreur startLauncher:", err);
      changePanel("login");
    }

    if (!account) {
      console.warn("Pas de compte : retour au login.");
      return changePanel("login");
    }
  }
}

new Launcher().init();
