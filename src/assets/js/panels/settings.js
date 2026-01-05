/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */

import {
  changePanel,
  accountSelect,
  database,
  Slider,
  config,
  setStatus,
  popup,
  appdata,
  setBackground,
} from "../utils.js";
const { ipcRenderer } = require("electron");
const os = require("os");

class Settings {
  static id = "settings";
  async init(config) {
    this.config = config;
    this.db = new database();
    this.navBTN();
    this.accounts();
    this.ram();
    this.javaPath();
    this.resolution();
    this.launcher();
    this.skinTab();
  }

  navBTN() {
    document.querySelector(".nav-box").addEventListener("click", (e) => {
      if (!e.target.classList.contains("nav-settings-btn")) return;

      const id = e.target.id;
      const activeSettingsBTN = document.querySelector(".active-settings-BTN");
      const activeContainerSettings = document.querySelector(
        ".active-container-settings"
      );

      if (id === "save") {
        if (activeSettingsBTN)
          activeSettingsBTN.classList.toggle("active-settings-BTN");
        document.querySelector("#account").classList.add("active-settings-BTN");

        if (activeContainerSettings)
          activeContainerSettings.classList.toggle("active-container-settings");
        document
          .querySelector("#account-tab")
          .classList.add("active-container-settings");

        window.location.reload();
        return;
      }

      if (activeSettingsBTN)
        activeSettingsBTN.classList.toggle("active-settings-BTN");
      e.target.classList.add("active-settings-BTN");

      if (activeContainerSettings)
        activeContainerSettings.classList.toggle("active-container-settings");
      document
        .querySelector(`#${id}-tab`)
        .classList.add("active-container-settings");
    });
  }

  accounts() {
    document
      .querySelector(".accounts-list")
      .addEventListener("click", async (e) => {
        let popupAccount = new popup();
        try {
          let id = e.target.id;
          if (e.target.classList.contains("account")) {
            popupAccount.openPopup({
              title: "Connexion",
              content: "Veuillez patienter...",
              color: "var(--color)",
            });

            if (id == "add") {
              document.querySelector(".cancel-home").style.display = "inline";
              return changePanel("login");
            }

            let account = await this.db.readData("accounts", id);
            let configClient = await this.setInstance(account);
            await accountSelect(account);
            configClient.account_selected = account.ID;
            return await this.db.updateData("configClient", configClient);
          }

          if (e.target.classList.contains("delete-profile")) {
            popupAccount.openPopup({
              title: "Connexion",
              content: "Veuillez patienter...",
              color: "var(--color)",
            });

            // Déconnexion = aucun compte conservé
            await this.db.clearTable("accounts");
            let configClient = await this.db.readData("configClient");
            if (configClient) {
              configClient.account_selected = null;
              await this.db.updateData("configClient", configClient);
            }

            return changePanel("login");
          }
        } catch (err) {
          console.error(err);
        } finally {
          popupAccount.closePopup();
        }
      });
  }

  async setInstance(auth) {
    let configClient = await this.db.readData("configClient");
    let instanceSelect = configClient.instance_select;
    let instancesList = await config.getInstanceList();

    for (let instance of instancesList) {
      if (instance.whitelistActive) {
        let whitelist = instance.whitelist.find(
          (whitelist) => whitelist == auth.name
        );
        if (whitelist !== auth.name) {
          if (instance.name == instanceSelect) {
            let newInstanceSelect = instancesList.find(
              (i) => i.whitelistActive == false
            );
            configClient.instance_select = newInstanceSelect.name;
            await setStatus(newInstanceSelect.status);
          }
        }
      }
    }
    return configClient;
  }

  async ram() {
    let config = await this.db.readData("configClient");
    let totalMem = Math.trunc((os.totalmem() / 1073741824) * 10) / 10;
    let freeMem = Math.trunc((os.freemem() / 1073741824) * 10) / 10;

    document.getElementById("total-ram").textContent = `${totalMem} Go`;
    document.getElementById("free-ram").textContent = `${freeMem} Go`;

    let sliderDiv = document.querySelector(".memory-slider");
    sliderDiv.setAttribute("max", Math.trunc((80 * totalMem) / 100));

    let ram = config?.java_config?.java_memory
      ? {
          ramMin: config.java_config.java_memory.min,
          ramMax: config.java_config.java_memory.max,
        }
      : { ramMin: "1", ramMax: "2" };

    if (totalMem < ram.ramMin) {
      config.java_config.java_memory = { min: 1, max: 2 };
      this.db.updateData("configClient", config);
      ram = { ramMin: "1", ramMax: "2" };
    }

    let slider = new Slider(
      ".memory-slider",
      parseFloat(ram.ramMin),
      parseFloat(ram.ramMax)
    );

    let minSpan = document.querySelector(".slider-touch-left span");
    let maxSpan = document.querySelector(".slider-touch-right span");

    minSpan.setAttribute("value", `${ram.ramMin} Go`);
    maxSpan.setAttribute("value", `${ram.ramMax} Go`);

    slider.on("change", async (min, max) => {
      let config = await this.db.readData("configClient");
      minSpan.setAttribute("value", `${min} Go`);
      maxSpan.setAttribute("value", `${max} Go`);
      config.java_config.java_memory = { min: min, max: max };
      this.db.updateData("configClient", config);
    });
  }

  async javaPath() {
    let javaPathText = document.querySelector(".java-path-txt");
    javaPathText.textContent = `${await appdata()}/${
      process.platform == "darwin"
        ? this.config.dataDirectory
        : `.${this.config.dataDirectory}`
    }/runtime`;

    let configClient = await this.db.readData("configClient");
    let javaPath =
      configClient?.java_config?.java_path ||
      "Utiliser la version de java livre avec le launcher";
    let javaPathInputTxt = document.querySelector(".java-path-input-text");
    let javaPathInputFile = document.querySelector(".java-path-input-file");
    javaPathInputTxt.value = javaPath;

    document
      .querySelector(".java-path-set")
      .addEventListener("click", async () => {
        javaPathInputFile.value = "";
        javaPathInputFile.click();
        await new Promise((resolve) => {
          let interval;
          interval = setInterval(() => {
            if (javaPathInputFile.value != "") resolve(clearInterval(interval));
          }, 100);
        });

        if (
          javaPathInputFile.value.replace(".exe", "").endsWith("java") ||
          javaPathInputFile.value.replace(".exe", "").endsWith("javaw")
        ) {
          let configClient = await this.db.readData("configClient");
          let file = javaPathInputFile.files[0].path;
          javaPathInputTxt.value = file;
          configClient.java_config.java_path = file;
          await this.db.updateData("configClient", configClient);
        } else alert("Le nom du fichier doit être java ou javaw");
      });

    document
      .querySelector(".java-path-reset")
      .addEventListener("click", async () => {
        let configClient = await this.db.readData("configClient");
        javaPathInputTxt.value =
          "Utiliser la version de java livre avec le launcher";
        configClient.java_config.java_path = null;
        await this.db.updateData("configClient", configClient);
      });
  }

  async resolution() {
    let configClient = await this.db.readData("configClient");
    let resolution = configClient?.game_config?.screen_size || {
      width: 1920,
      height: 1080,
    };

    let width = document.querySelector(".width-size");
    let height = document.querySelector(".height-size");
    let resolutionReset = document.querySelector(".size-reset");

    width.value = resolution.width;
    height.value = resolution.height;

    width.addEventListener("change", async () => {
      let configClient = await this.db.readData("configClient");
      configClient.game_config.screen_size.width = width.value;
      await this.db.updateData("configClient", configClient);
    });

    height.addEventListener("change", async () => {
      let configClient = await this.db.readData("configClient");
      configClient.game_config.screen_size.height = height.value;
      await this.db.updateData("configClient", configClient);
    });

    resolutionReset.addEventListener("click", async () => {
      let configClient = await this.db.readData("configClient");
      configClient.game_config.screen_size = { width: "854", height: "480" };
      width.value = "854";
      height.value = "480";
      await this.db.updateData("configClient", configClient);
    });
  }

  async launcher() {
    let configClient = await this.db.readData("configClient");

    let maxDownloadFiles = configClient?.launcher_config?.download_multi || 5;
    let maxDownloadFilesInput = document.querySelector(".max-files");
    let maxDownloadFilesReset = document.querySelector(".max-files-reset");
    maxDownloadFilesInput.value = maxDownloadFiles;

    maxDownloadFilesInput.addEventListener("change", async () => {
      let configClient = await this.db.readData("configClient");
      configClient.launcher_config.download_multi = maxDownloadFilesInput.value;
      await this.db.updateData("configClient", configClient);
    });

    maxDownloadFilesReset.addEventListener("click", async () => {
      let configClient = await this.db.readData("configClient");
      maxDownloadFilesInput.value = 5;
      configClient.launcher_config.download_multi = 5;
      await this.db.updateData("configClient", configClient);
    });

    let themeBox = document.querySelector(".theme-box");
    let theme = configClient?.launcher_config?.theme || "auto";

    if (theme == "auto") {
      document.querySelector(".theme-btn-auto").classList.add("active-theme");
    } else if (theme == "dark") {
      document.querySelector(".theme-btn-sombre").classList.add("active-theme");
    } else if (theme == "light") {
      document.querySelector(".theme-btn-clair").classList.add("active-theme");
    }

    themeBox.addEventListener("click", async (e) => {
      if (e.target.classList.contains("theme-btn")) {
        let activeTheme = document.querySelector(".active-theme");
        if (e.target.classList.contains("active-theme")) return;
        activeTheme?.classList.remove("active-theme");

        if (e.target.classList.contains("theme-btn-auto")) {
          setBackground();
          theme = "auto";
          e.target.classList.add("active-theme");
        } else if (e.target.classList.contains("theme-btn-sombre")) {
          setBackground(true);
          theme = "dark";
          e.target.classList.add("active-theme");
        } else if (e.target.classList.contains("theme-btn-clair")) {
          setBackground(false);
          theme = "light";
          e.target.classList.add("active-theme");
        }

        let configClient = await this.db.readData("configClient");
        configClient.launcher_config.theme = theme;
        await this.db.updateData("configClient", configClient);
      }
    });

    let closeBox = document.querySelector(".close-box");
    let closeLauncher =
      configClient?.launcher_config?.closeLauncher || "close-launcher";

    if (closeLauncher == "close-launcher") {
      document.querySelector(".close-launcher").classList.add("active-close");
    } else if (closeLauncher == "close-all") {
      document.querySelector(".close-all").classList.add("active-close");
    } else if (closeLauncher == "close-none") {
      document.querySelector(".close-none").classList.add("active-close");
    }

    closeBox.addEventListener("click", async (e) => {
      if (e.target.classList.contains("close-btn")) {
        let activeClose = document.querySelector(".active-close");
        if (e.target.classList.contains("active-close")) return;
        activeClose?.classList.toggle("active-close");

        let configClient = await this.db.readData("configClient");

        if (e.target.classList.contains("close-launcher")) {
          e.target.classList.toggle("active-close");
          configClient.launcher_config.closeLauncher = "close-launcher";
          await this.db.updateData("configClient", configClient);
        } else if (e.target.classList.contains("close-all")) {
          e.target.classList.toggle("active-close");
          configClient.launcher_config.closeLauncher = "close-all";
          await this.db.updateData("configClient", configClient);
        } else if (e.target.classList.contains("close-none")) {
          e.target.classList.toggle("active-close");
          configClient.launcher_config.closeLauncher = "close-none";
          await this.db.updateData("configClient", configClient);
        }
      }
    });
  }

  async skinTab() {
    // Suppression du chargement dynamique du CDN, on suppose que skinview3d est déjà inclus en local

    // Gestion navigation onglet
    const skinTabBtn = document.getElementById("skin");
    const skinTab = document.getElementById("skin-tab");
    skinTabBtn.addEventListener("click", () => {
      document
        .querySelector(".active-settings-BTN")
        .classList.remove("active-settings-BTN");
      skinTabBtn.classList.add("active-settings-BTN");
      document
        .querySelector(".active-container-settings")
        .classList.remove("active-container-settings");
      skinTab.classList.add("active-container-settings");
      this.updateSkinViewer();
    });

    // Bouton changer de skin
    const changeSkinBtn = document.getElementById("change-skin-btn");
    const skinUpload = document.getElementById("skin-upload");
    changeSkinBtn.addEventListener("click", () => skinUpload.click());
    skinUpload.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const account = await this.getSelectedAccount();
      if (!account) return;
      const formData = new FormData();
      formData.append("skin", file);
      formData.append("username", account.name);
      // Upload skin
      fetch("https://lapepterie.com/Minecraft/upload_skin.php", {
        method: "POST",
        body: formData,
      })
        .then((res) => res.json())
        .then(async (data) => {
          if (data.success) {
            // Met à jour le skin localement
            account.skin = data.filename;
            await this.db.updateData("accounts", account.ID, account);
            this.updateSkinViewer();
          } else {
            alert("Erreur upload skin: " + (data.error || ""));
          }
        });
    });

    // Met à jour le skin si on change de compte
    document.querySelector(".accounts-list").addEventListener("click", () => {
      setTimeout(() => this.updateSkinViewer(), 300);
    });

    this.updateSkinViewer();
  }

  async getSelectedAccount() {
    const configClient = await this.db.readData("configClient");
    if (!configClient?.account_selected) return null;
    return await this.db.readData("accounts", configClient.account_selected);
  }

  async updateSkinViewer() {
    const viewerDiv = document.getElementById("skin-viewer");
    const filenameDiv = document.getElementById("skin-filename");
    if (!viewerDiv) return;
    viewerDiv.innerHTML = "";
    let account = await this.getSelectedAccount();
    let username = account && account.name ? account.name : null;
    let skinName = username ? username + ".png" : "Steve (défaut)";
    filenameDiv.textContent = skinName;
    let remoteSkinUrl = username ? `https://lapepterie.com/Minecraft/Images/Skins/textures/${username}.png` : null;
    let defaultSkinUrl = "assets/images/skin/steve.png";
    let skinUrl = defaultSkinUrl;
    let cacheBuster = '?t=' + Date.now();
    if (username) {
      // Teste si l'image distante existe
      let remoteAvailable = false;
      try {
        await new Promise((resolve, reject) => {
          const img = new window.Image();
          img.onload = () => resolve();
          img.onerror = () => reject();
          img.src = remoteSkinUrl + cacheBuster;
        });
        remoteAvailable = true;
      } catch {}
      if (remoteAvailable) {
        skinUrl = remoteSkinUrl + cacheBuster;
      } else {
        skinUrl = defaultSkinUrl;
      }
    }
    if (window.skinview3d) {
      const viewer = new skinview3d.SkinViewer({
        canvas: Object.assign(document.createElement("canvas"), {
          width: 220,
          height: 320,
        }),
        width: 220,
        height: 320,
        skin: skinUrl,
      });
      viewerDiv.appendChild(viewer.canvas);
      viewer.controls.enableRotate = true;
      // Compatibilité skinview3d v2 et v3+
      if (viewer.animations && typeof viewer.animations.add === "function") {
        viewer.animations.add(new skinview3d.WalkingAnimation());
        viewer.animations.play();
      } else if (typeof skinview3d.WalkingAnimation === "function") {
        viewer.animation = new skinview3d.WalkingAnimation();
      }
    } else {
      viewerDiv.innerHTML = '<div style="color:red;text-align:center">Erreur : skinview3d non chargé</div>';
    }
  }
}

export default Settings;