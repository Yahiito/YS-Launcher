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
    const setup = () => {
      console.log("Initializing Frame...");
      const platform = os.platform() === "darwin" ? "darwin" : "other";

      const frame = document.querySelector(`.${platform} .frame`);
      if (!frame) {
        console.warn(`[YS-Launcher]: Frame introuvable pour platform=${platform}`);
        return;
      }

      frame.classList.toggle("hide");

      const minimizeBtn = frame.querySelector("#minimize");
      if (minimizeBtn) {
        minimizeBtn.addEventListener("click", () => {
          ipcRenderer.send("main-window-minimize");
        });
      }

      let maximized = false;
      const maximizeBtn = frame.querySelector("#maximize");
      if (maximizeBtn) {
        maximizeBtn.addEventListener("click", () => {
          ipcRenderer.send("main-window-maximize");
          maximized = !maximized;
          maximizeBtn.classList.toggle("icon-maximize");
          maximizeBtn.classList.toggle("icon-restore-down");
        });
      }

      const closeBtn = frame.querySelector("#close");
      if (closeBtn) {
        closeBtn.addEventListener("click", () => {
          ipcRenderer.send("main-window-close");
        });
      }
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", setup, { once: true });
      return;
    }

    setup();
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
    let account_selected = configClient ? configClient.account_selected : null;
    let popupRefresh = new popup();

    if (accounts?.length) {
      for (let account of accounts) {
        let account_ID = account.ID;

        if (account.error) {
          await this.db.deleteData("accounts", account_ID);
          continue;
        }

        if (account?.meta?.type === "Xbox") {
          popupRefresh.openPopup({
            title: "Connexion",
            content: `Refresh account Type: ${account.meta.type} | Username: ${account.name}`,
            color: "var(--color)",
            background: false,
          });

          let refresh_accounts = await new Microsoft(this.config.client_id).refresh(account);

          if (refresh_accounts.error) {
            await this.db.deleteData("accounts", account_ID);
            if (account_ID == account_selected) {
              configClient.account_selected = null;
              await this.db.updateData("configClient", configClient);
            }
            console.error(`[Account] ${account.name}: ${refresh_accounts.errorMessage}`);
            continue;
          }

          refresh_accounts.ID = account_ID;
          await this.db.updateData("accounts", refresh_accounts, account_ID);
          await addAccount(refresh_accounts);
          if (account_ID == account_selected) await accountSelect(refresh_accounts);
          continue;
        }

        if (account?.meta?.type === "AZauth") {
          popupRefresh.openPopup({
            title: "Connexion",
            content: `Refresh account Type: ${account.meta.type} | Username: ${account.name}`,
            color: "var(--color)",
            background: false,
          });

          let refresh_accounts = await new AZauth(this.config.online).verify(account);

          if (refresh_accounts.error) {
            await this.db.deleteData("accounts", account_ID);
            if (account_ID == account_selected) {
              configClient.account_selected = null;
              await this.db.updateData("configClient", configClient);
            }
            console.error(`[Account] ${account.name}: ${refresh_accounts.message}`);
            continue;
          }

          refresh_accounts.ID = account_ID;
          await this.db.updateData("accounts", refresh_accounts, account_ID);
          await addAccount(refresh_accounts);
          if (account_ID == account_selected) await accountSelect(refresh_accounts);
          continue;
        }

        if (account?.meta?.type === "Mojang") {
          popupRefresh.openPopup({
            title: "Connexion",
            content: `Refresh account Type: ${account.meta.type} | Username: ${account.name}`,
            color: "var(--color)",
            background: false,
          });

          if (account?.meta?.online === false) {
            // Web/offline provider: no token refresh, just load it.
            if (account?.meta?.provider === "web") {
              await addAccount(account);
              if (account_ID == account_selected) await accountSelect(account);
              continue;
            }

            let refresh_accounts = await Mojang.login(account.name);
            refresh_accounts.ID = account_ID;
            await addAccount(refresh_accounts);
            await this.db.updateData("accounts", refresh_accounts, account_ID);
            if (account_ID == account_selected) await accountSelect(refresh_accounts);
            continue;
          }

          let refresh_accounts = await Mojang.refresh(account);

          if (refresh_accounts.error) {
            await this.db.deleteData("accounts", account_ID);
            if (account_ID == account_selected) {
              configClient.account_selected = null;
              await this.db.updateData("configClient", configClient);
            }
            console.error(`[Account] ${account.name}: ${refresh_accounts.errorMessage}`);
            continue;
          }

          refresh_accounts.ID = account_ID;
          await this.db.updateData("accounts", refresh_accounts, account_ID);
          await addAccount(refresh_accounts);
          if (account_ID == account_selected) await accountSelect(refresh_accounts);
          continue;
        }

        console.error(`[Account] ${account?.name}: Account Type Not Found`);
        await this.db.deleteData("accounts", account_ID);
        if (account_ID == account_selected) {
          configClient.account_selected = null;
          await this.db.updateData("configClient", configClient);
        }
      }

      accounts = await this.db.readAllData("accounts");
      configClient = await this.db.readData("configClient");
      account_selected = configClient ? configClient.account_selected : null;

      if (!accounts?.length) {
        popupRefresh.closePopup();
        if (configClient) {
          configClient.account_selected = null;
          await this.db.updateData("configClient", configClient);
        }
        return changePanel("login");
      }

      if (!account_selected) {
        configClient.account_selected = accounts[0].ID;
        await this.db.updateData("configClient", configClient);
        await accountSelect(accounts[0]);
      }

      popupRefresh.closePopup();
      changePanel("home");
    } else {
      popupRefresh.closePopup();
      changePanel("login");
    }
  }

  // Added a new method to handle theme initialization
  initializeTheme() {
    document.addEventListener("DOMContentLoaded", async () => {
      // Defensive: init() calls this before `this.db` exists.
      const db = this.db || new database();
      let configClient = await db.readData("configClient");
      let theme = configClient?.launcher_config?.theme || "auto";
      let isDarkTheme = await ipcRenderer.invoke("is-dark-theme", theme).then((res) => res);
      document.body.className = isDarkTheme ? "dark global" : "light global";
    });
  }
}

new Launcher().init();
