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
    let accounts = await this.db.readAllData("accounts");
    let configClient = await this.db.readData("configClient");
    let accountSelected = configClient ? configClient.account_selected : null;
    let popupRefresh = new popup();

    if (accounts?.length) {
      for (let account of accounts) {
        const accountID = account.ID;

        if (account?.error) {
          await this.db.deleteData("accounts", accountID);
          continue;
        }

        const type = account?.meta?.type;

        // Keep compatibility with upstream account types
        if (type === "Xbox") {
          popupRefresh.openPopup({
            title: "Connexion",
            content: `Refresh account Type: ${type} | Username: ${account.name}`,
            color: "var(--color)",
            background: false,
          });

          const refreshed = await new Microsoft(this.config.client_id).refresh(account);
          if (refreshed?.error) {
            await this.db.deleteData("accounts", accountID);
            if (accountID == accountSelected) {
              configClient.account_selected = null;
              await this.db.updateData("configClient", configClient);
            }
            continue;
          }

          refreshed.ID = accountID;
          await this.db.updateData("accounts", refreshed, accountID);
          await addAccount(refreshed);
          if (accountID == accountSelected) accountSelect(refreshed);
          continue;
        }

        if (type === "AZauth") {
          popupRefresh.openPopup({
            title: "Connexion",
            content: `Refresh account Type: ${type} | Username: ${account.name}`,
            color: "var(--color)",
            background: false,
          });

          const refreshed = await new AZauth(this.config.online).verify(account);
          if (refreshed?.error) {
            await this.db.deleteData("accounts", accountID);
            if (accountID == accountSelected) {
              configClient.account_selected = null;
              await this.db.updateData("configClient", configClient);
            }
            continue;
          }

          refreshed.ID = accountID;
          await this.db.updateData("accounts", refreshed, accountID);
          await addAccount(refreshed);
          if (accountID == accountSelected) accountSelect(refreshed);
          continue;
        }

        if (type === "Mojang") {
          popupRefresh.openPopup({
            title: "Connexion",
            content: `Refresh account Type: ${type} | Username: ${account.name}`,
            color: "var(--color)",
            background: false,
          });

          let refreshed;
          if (account?.meta?.online === false) {
            refreshed = await Mojang.login(account.name);
          } else {
            refreshed = await Mojang.refresh(account);
          }

          if (refreshed?.error) {
            await this.db.deleteData("accounts", accountID);
            if (accountID == accountSelected) {
              configClient.account_selected = null;
              await this.db.updateData("configClient", configClient);
            }
            continue;
          }

          refreshed.ID = accountID;
          await this.db.updateData("accounts", refreshed, accountID);
          await addAccount(refreshed);
          if (accountID == accountSelected) accountSelect(refreshed);
          continue;
        }

        // Your website/offline accounts: just load them, no refresh required.
        if (type === "offline") {
          await addAccount(account);
          if (accountID == accountSelected) accountSelect(account);
          continue;
        }

        // Unknown type -> cleanup
        await this.db.deleteData("accounts", accountID);
        if (accountID == accountSelected) {
          configClient.account_selected = null;
          await this.db.updateData("configClient", configClient);
        }
      }

      accounts = await this.db.readAllData("accounts");
      configClient = await this.db.readData("configClient");
      accountSelected = configClient ? configClient.account_selected : null;

      if (!accountSelected && accounts.length) {
        configClient.account_selected = accounts[0].ID;
        await this.db.updateData("configClient", configClient);
        accountSelect(accounts[0]);
      }

      if (!accounts.length) {
        popupRefresh.closePopup();
        return changePanel("login");
      }

      popupRefresh.closePopup();
      return changePanel("home");
    }

    popupRefresh.closePopup();
    return changePanel("login");
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
