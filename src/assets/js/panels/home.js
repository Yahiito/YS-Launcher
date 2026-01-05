/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */
import {
  config,
  database,
  logger,
  changePanel,
  appdata,
  setStatus,
  pkg,
  popup,
} from "../utils.js";

const { Launch } = require("minecraft-java-core");
const { shell, ipcRenderer } = require("electron");

class Home {
  static id = "home";
  async init(config) {
    this.config = config;
    this.db = new database();
    this.news();
    this.socialLick();
    this.settingsBtn();
    this.instancesSelect();
    await this.showWelcomeMessage();
  }

  settingsBtn() {
    const settingsBtn = document.querySelector(".settings-btn");
    if (!settingsBtn) return;

    settingsBtn.addEventListener("click", () => {
      changePanel("settings");
    });
  }

  async news() {
    const newsElement = document.querySelector(".news-list");
    if (!newsElement) return;

    const news = await config
      .getNews(this.config)
      .then((res) => res)
      .catch(() => false);

    if (news && Array.isArray(news)) {
      if (!news.length) {
        const blockNews = document.createElement("div");
        const date = this.getdate(new Date());
        blockNews.classList.add("news-block");
        blockNews.innerHTML = `
          <div class="news-header">
            <img class="server-status-icon" src="assets/images/icon/icon.png">
            <div class="header-text">
              <div class="title">Aucune news n'est actuellement disponible.</div>
            </div>
            <div class="date">
              <div class="day">${date.day}</div>
              <div class="month">${date.month}</div>
            </div>
          </div>
          <div class="news-content">
            <div class="bbWrapper">
              <p>Vous pourrez suivre ici toutes les news relatives au serveur.</p>
            </div>
          </div>`;
        newsElement.appendChild(blockNews);
        return;
      }

      for (const item of news) {
        const date = this.getdate(item.publish_date);
        const blockNews = document.createElement("div");
        blockNews.classList.add("news-block");
        blockNews.innerHTML = `
          <div class="news-header">
            <img class="server-status-icon" src="assets/images/icon/icon.png">
            <div class="header-text">
              <div class="title">${item.title}</div>
            </div>
            <div class="date">
              <div class="day">${date.day}</div>
              <div class="month">${date.month}</div>
            </div>
          </div>
          <div class="news-content">
            <div class="bbWrapper">
              <p>${String(item.content || "").replace(/\n/g, "</br>")}</p>
              <p class="news-author">Auteur - <span>${item.author ?? ""}</span></p>
            </div>
          </div>`;
        newsElement.appendChild(blockNews);
      }
      return;
    }

    const blockNews = document.createElement("div");
    const date = this.getdate(new Date());
    blockNews.classList.add("news-block");
    blockNews.innerHTML = `
      <div class="news-header">
        <img class="server-status-icon" src="assets/images/icon/icon.png">
        <div class="header-text">
          <div class="title">Erreur.</div>
        </div>
        <div class="date">
          <div class="day">${date.day}</div>
          <div class="month">${date.month}</div>
        </div>
      </div>
      <div class="news-content">
        <div class="bbWrapper">
          <p>Impossible de contacter le serveur des news.</br>Merci de vérifier votre configuration.</p>
        </div>
      </div>`;
    newsElement.appendChild(blockNews);
  }

  socialLick() {
    let socials = document.querySelectorAll(".social-block");

    socials.forEach((social) => {
      social.addEventListener("click", (e) => {
        shell.openExternal(e.target.dataset.url);
      });
    });
  }

  async instancesSelect() {
    let configClient = await this.db.readData('configClient');
    let auth = await this.db.readData('accounts', configClient.account_selected);
    let instancesList = await config.getInstanceList();
    let instanceSelect = instancesList.find(i => i.name == configClient?.instance_select) ? configClient?.instance_select : null;

    let instanceBTN = document.querySelector('.play-instance');
    let instancePopup = document.querySelector('.instance-popup');
    let instancesListPopup = document.querySelector('.instances-List');
    let instanceCloseBTN = document.querySelector('.close-popup');

    if (instancesList.length === 1) {
      document.querySelector('.instance-select').style.display = 'none';
      instanceBTN.style.paddingRight = '0';
    }

    if (!instanceSelect) {
      let newInstanceSelect = instancesList.find(i => i.whitelistActive == false);
      configClient.instance_select = newInstanceSelect.name;
      instanceSelect = newInstanceSelect.name;
      await this.db.updateData('configClient', configClient);
    }

    for (let instance of instancesList) {
      if (instance.whitelistActive) {
        let whitelist = instance.whitelist.find(whitelist => whitelist == auth?.name);
        if (whitelist !== auth?.name) {
          if (instance.name == instanceSelect) {
            let newInstanceSelect = instancesList.find(i => i.whitelistActive == false);
            configClient.instance_select = newInstanceSelect.name;
            instanceSelect = newInstanceSelect.name;
            setStatus(newInstanceSelect.status);
            await this.db.updateData('configClient', configClient);
          }
        }
      }
      if (instance.name == instanceSelect) setStatus(instance.status);
    }

    instancePopup.addEventListener('click', async (e) => {
      if (!instanceSelect) {
        let newInstanceSelect = instancesList.find(i => i.whitelistActive == false);
        configClient.instance_select = newInstanceSelect.name;
        instanceSelect = newInstanceSelect.name;
        await this.db.updateData('configClient', configClient);
      }

      if (e.target.classList.contains('instance-elements')) {
        let newInstanceSelect = e.target.id;
        let activeInstanceSelect = document.querySelector('.active-instance');

        if (activeInstanceSelect)
          activeInstanceSelect.classList.toggle('active-instance');
        e.target.classList.add('active-instance');

        configClient.instance_select = newInstanceSelect;
        await this.db.updateData('configClient', configClient);
        instanceSelect = newInstanceSelect;
        instancePopup.style.display = 'none';
        let instance = await config.getInstanceList();
        let options = instance.find(i => i.name == configClient.instance_select);
        await setStatus(options.status);
      }
    });

    instanceBTN.addEventListener('click', async (e) => {
      let configClient = await this.db.readData('configClient');
      let instanceSelect = configClient.instance_select;
      let auth = await this.db.readData('accounts', configClient.account_selected);

      if (e.target.classList.contains('instance-select')) {
        instancesListPopup.innerHTML = '';
        for (let instance of instancesList) {
          if (instance.whitelistActive) {
            instance.whitelist.map(whitelist => {
              if (whitelist == auth?.name) {
                if (instance.name == instanceSelect) {
                  instancesListPopup.innerHTML += `<div id="${instance.name}" class="instance-elements active-instance">${instance.name}</div>`;
                } else {
                  instancesListPopup.innerHTML += `<div id="${instance.name}" class="instance-elements">${instance.name}</div>`;
                }
              }
            });
          } else {
            if (instance.name == instanceSelect) {
              instancesListPopup.innerHTML += `<div id="${instance.name}" class="instance-elements active-instance">${instance.name}</div>`;
            } else {
              instancesListPopup.innerHTML += `<div id="${instance.name}" class="instance-elements">${instance.name}</div>`;
            }
          }
        }

        instancePopup.style.display = 'flex';
      }

      if (!e.target.classList.contains('instance-select')) this.startGame();
    });

    instanceCloseBTN.addEventListener('click', () => (instancePopup.style.display = 'none'));
  }

  async showWelcomeMessage() {
    const configClient = await this.db.readData("configClient");
    const account = await this.db.readData("accounts", configClient.account_selected);

    const welcomeElem = document.getElementById("welcome-message");
    const playerHeadElem = document.querySelector(".player-head");
    if (!welcomeElem || !playerHeadElem) return;

    if (account && account.name) {
      welcomeElem.textContent = `Bienvenue, ${account.name} !`;

      const skinUrl = `https://lapepterie.com/Minecraft/Images/Skins/textures/${account.name}.png?t=${Date.now()}`;
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      canvas.style.borderRadius = "20%";
      canvas.style.overflow = "hidden";

      const ctx = canvas.getContext("2d");
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = function () {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 8, 8, 8, 8, 0, 0, 64, 64);
      };
      img.onerror = function () {
        ctx.clearRect(0, 0, 64, 64);
      };
      img.src = skinUrl;

      playerHeadElem.innerHTML = "";
      playerHeadElem.appendChild(canvas);
    } else {
      welcomeElem.textContent = "Bienvenue !";
      playerHeadElem.innerHTML = "";
    }
  }

  async startGame() {
    let launch = new Launch();
    let configClient = await this.db.readData('configClient');
    let instance = await config.getInstanceList();
    let authenticator = await this.db.readData('accounts', configClient.account_selected);
    let options = instance.find(i => i.name == configClient.instance_select);

    let playInstanceBTN = document.querySelector(".play-instance");
    let infoStartingBOX = document.querySelector(".info-starting-game");
    let infoStarting = document.querySelector(".info-starting-game-text");
    let progressBar = document.querySelector(".progress-bar");

    if (!options) {
      const popupError = new popup();
      popupError.openPopup({
        title: "Erreur",
        content: "Aucune instance sélectionnée ou instance introuvable.",
        color: "red",
        options: true,
      });
      return;
    }

    let opt = {
      url: options.url,
      authenticator: authenticator,
      timeout: 10000,
      path: `${await appdata()}/${
        process.platform == "darwin"
          ? this.config.dataDirectory
          : `.${this.config.dataDirectory}`
      }`,
      instance: options.name,
      version: options.loadder.minecraft_version,
      detached:
        configClient.launcher_config.closeLauncher == "close-all" ? false : true,
      downloadFileMultiple: configClient.launcher_config.download_multi,
      intelEnabledMac: configClient.launcher_config.intelEnabledMac,

      loader: {
        type: options.loadder.loadder_type,
        build: options.loadder.loadder_version,
        enable: options.loadder.loadder_type == "none" ? false : true,
      },

      verify: options.verify,
      ignored: [...options.ignored],

      java: {
        path: configClient.java_config.java_path,
      },

      JVM_ARGS: options.jvm_args ? options.jvm_args : [],
      GAME_ARGS: options.game_args ? options.game_args : [],

      screen: {
        width: configClient.game_config.screen_size.width,
        height: configClient.game_config.screen_size.height,
      },

      memory: {
        min: `${configClient.java_config.java_memory.min * 1024}M`,
        max: `${configClient.java_config.java_memory.max * 1024}M`,
      },
    };

    launch.Launch(opt);

    playInstanceBTN.style.display = "none";
    infoStartingBOX.style.display = "block";
    progressBar.style.display = "";
    ipcRenderer.send("main-window-progress-load");

    launch.on("extract", (extract) => {
      ipcRenderer.send("main-window-progress-load");
    });

    launch.on("progress", (progress, size) => {
      infoStarting.innerHTML = `Téléchargement ${(
        (progress / size) *
        100
      ).toFixed(0)}%`;
      ipcRenderer.send("main-window-progress", { progress, size });
      progressBar.value = progress;
      progressBar.max = size;
    });

    launch.on("check", (progress, size) => {
      infoStarting.innerHTML = `Vérification ${(
        (progress / size) *
        100
      ).toFixed(0)}%`;
      ipcRenderer.send("main-window-progress", { progress, size });
      progressBar.value = progress;
      progressBar.max = size;
    });

    launch.on("estimated", (time) => {
      let hours = Math.floor(time / 3600);
      let minutes = Math.floor((time - hours * 3600) / 60);
      let seconds = Math.floor(time - hours * 3600 - minutes * 60);
    });

    launch.on("speed", (speed) => {
    });

    launch.on("patch", (patch) => {
      ipcRenderer.send("main-window-progress-load");
      infoStarting.innerHTML = `Patch en cours...`;
    });

    launch.on("data", (e) => {
      progressBar.style.display = "none";
      if (configClient.launcher_config.closeLauncher == "close-launcher") {
        ipcRenderer.send("main-window-hide");
      }
      new logger("Minecraft", "#36b030");
      ipcRenderer.send("main-window-progress-load");
      infoStarting.innerHTML = `Demarrage en cours...`;
    });

    launch.on("close", (code) => {
      if (configClient.launcher_config.closeLauncher == "close-launcher") {
        ipcRenderer.send("main-window-show");
      }
      ipcRenderer.send("main-window-progress-reset");
      infoStartingBOX.style.display = "none";
      playInstanceBTN.style.display = "flex";
      infoStarting.innerHTML = `Vérification`;
      new logger(pkg.name, "#7289da");
      console.log("Close");
    });

    launch.on("error", (err) => {
      let popupError = new popup();

      popupError.openPopup({
        title: "Erreur",
        content: err.error,
        color: "red",
        options: true,
      });

      if (configClient.launcher_config.closeLauncher == "close-launcher") {
        ipcRenderer.send("main-window-show");
      }
      ipcRenderer.send("main-window-progress-reset");
      infoStartingBOX.style.display = "none";
      playInstanceBTN.style.display = "flex";
      infoStarting.innerHTML = `Vérification`;
      new logger(pkg.name, "#7289da");
      console.log(err);
    });
  }

  getdate(e) {
    let date = new Date(e);
    let year = date.getFullYear();
    let month = date.getMonth() + 1;
    let day = date.getDate();
    let allMonth = [
      "janvier",
      "février",
      "mars",
      "avril",
      "mai",
      "juin",
      "juillet",
      "août",
      "septembre",
      "octobre",
      "novembre",
      "décembre",
    ];
    return { year: year, month: allMonth[month - 1], day: day };
  }
}
export default Home;
