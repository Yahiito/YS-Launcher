/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */
const { AZauth, Mojang } = require("minecraft-java-core");
const { ipcRenderer } = require("electron");

import {
  popup,
  database,
  changePanel,
  accountSelect,
  addAccount,
  config,
  setStatus,
} from "../utils.js";

class Login {
  static id = "login";
  async init(config) {
    this.config = config;
    this.db = new database();

    if (typeof this.config.online == "boolean") {
      this.config.online ? this.getMicrosoft() : this.getCrack();
    } else if (typeof this.config.online == "string") {
      if (this.config.online.match(/^(http|https):\/\/[^ "]+$/)) {
        this.getAZauth();
      }
    }

    document.querySelector(".cancel-home").addEventListener("click", () => {
      document.querySelector(".cancel-home").style.display = "none";
      changePanel("settings");
    });
  }

  async getMicrosoft() {
    let popupLogin = new popup();
    let loginHome = document.querySelector(".login-home");
    let microsoftBtn = document.querySelector(".connect-home");
    loginHome.style.display = "block";

    microsoftBtn.addEventListener("click", () => {
      popupLogin.openPopup({
        title: "Connexion",
        content: "Veuillez patienter...",
        color: "var(--color)",
      });

      ipcRenderer
        .invoke("Microsoft-window", this.config.client_id)
        .then(async (account_connect) => {
          if (account_connect == "cancel" || !account_connect) {
            popupLogin.closePopup();
            return;
          } else {
            await this.saveData(account_connect);
            // Save the connection persistently
            await this.db.updateData('accounts', account_connect, account_connect.ID);
            popupLogin.closePopup();
            // Refresh the launcher after successful login
            ipcRenderer.send('reload-main-window');
          }
        })
        .catch((err) => {
          popupLogin.openPopup({
            title: "Erreur",
            content: err,
            options: true,
          });
        });
    });
  }

  async getCrack() {
    let popupLogin = new popup();

    // Affiche le choix entre connexion / inscription
    let loginChoice = document.querySelector(".login-choice");
    loginChoice.classList.add("login-choice");
    loginChoice.style.display = "block";

    // Formulaires existants ou à créer dynamiquement
    let loginOffline = document.querySelector(".login-offline");

    let signupOffline = document.querySelector(".signup-offline");
    if (!signupOffline) {
      signupOffline = document.createElement("div");
      signupOffline.classList.add("signup-offline");
      signupOffline.style.display = "none";
    }

    // Au départ cacher les 2 formulaires
    loginOffline.style.display = "none";
    signupOffline.style.display = "none";

    // Quand clic sur connexion
    loginChoice.querySelector("#btn-login").addEventListener("click", () => {
      loginChoice.style.display = "none";
      loginOffline.style.display = "block";
    });

    // Quand clic sur inscription
    loginChoice.querySelector("#btn-signup").addEventListener("click", () => {
      loginChoice.style.display = "none";
      signupOffline.style.display = "block";
    });

    // Annuler inscription
    signupOffline
      .querySelector(".cancel-signup")
      ?.addEventListener("click", () => {
        signupOffline.style.display = "none";
        loginChoice.style.display = "block";
      });

    // Annuler connexion
    let cancelOffline = document.querySelector(".cancel-offline");
    if (cancelOffline) {
      cancelOffline.style.display = "inline-block";
      cancelOffline.addEventListener("click", () => {
        loginOffline.style.display = "none";
        loginChoice.style.display = "block";
      });
    }

    // Connexion offline
    const emailOffline = document.querySelector(".email-offline");
    const passwordOffline = document.querySelector(".password-offline");
    const connectOffline = document.querySelector(".connect-offline");

    connectOffline.addEventListener("click", async () => {
      const username = emailOffline.value.trim();
      const password = passwordOffline.value;

      if (username.length < 3) {
        popupLogin.openPopup({
          title: "Erreur",
          content: "Votre pseudo doit faire au moins 3 caractères.",
          options: true,
        });
        return;
      }

      if (username.match(/ /g)) {
        popupLogin.openPopup({
          title: "Erreur",
          content: "Votre pseudo ne doit pas contenir d'espaces.",
          options: true,
        });
        return;
      }

      if (!password) {
        popupLogin.openPopup({
          title: "Erreur",
          content: "Veuillez entrer un mot de passe.",
          options: true,
        });
        return;
      }

      try {
        // Appel backend pour connexion
        const response = await fetch(
          "https://lapepterie.com/Minecraft/auth.php",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
            credentials: "include", // <== Important pour gérer les cookies de session
          }
        );

        const data = await response.json();

        if (!response.ok || data.error) {
          popupLogin.openPopup({
            title: "Erreur",
            content: data.error || "Connexion refusée.",
            options: true,
          });
          return;
        }

        // Ajout obligatoire de meta.type pour launcher.js
        if (!data.meta) data.meta = {};
        data.meta.type = "offline";

        // Ajoute le mot de passe saisi à l'objet data pour la reconnexion auto
        data.password = password;
        // Ajoute explicitement le champ username pour la cohérence locale
        data.username = username;
        await this.saveData(data);
        popupLogin.closePopup();
      } catch (err) {
        console.error(err);
        popupLogin.openPopup({
          title: "Erreur",
          content: "Erreur réseau ou serveur.",
          options: true,
        });
      }
    });

    // Inscription (exemple basique)
    const usernameSignup = signupOffline.querySelector(".username-signup");
    const emailSignup = signupOffline.querySelector(".email-signup");
    const passwordSignup = signupOffline.querySelector(".password-signup");
    const connectSignup = signupOffline.querySelector(".connect-signup");

    connectSignup?.addEventListener("click", async () => {
      const username = usernameSignup.value.trim();
      const email = emailSignup.value.trim();
      const password = passwordSignup.value;

      if (username.length < 3) {
        popupLogin.openPopup({
          title: "Erreur",
          content: "Votre pseudo doit faire au moins 3 caractères.",
          options: true,
        });
        return;
      }

      if (username.match(/ /g)) {
        popupLogin.openPopup({
          title: "Erreur",
          content: "Votre pseudo ne doit pas contenir d'espaces.",
          options: true,
        });
        return;
      }

      if (!email || !email.includes("@")) {
        popupLogin.openPopup({
          title: "Erreur",
          content: "Veuillez entrer un email valide.",
          options: true,
        });
        return;
      }

      if (!password) {
        popupLogin.openPopup({
          title: "Erreur",
          content: "Veuillez entrer un mot de passe.",
          options: true,
        });
        return;
      }

      try {
        // Appel backend inscription
        const response = await fetch(
          "https://lapepterie.com/Minecraft/register.php", // adapte l’URL
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, email, password }),
          }
        );

        const data = await response.json();

        if (!response.ok || data.error) {
          popupLogin.openPopup({
            title: "Erreur",
            content: data.error || "Inscription refusée.",
            options: true,
          });
          return;
        }

        popupLogin.openPopup({
          title: "Succès",
          content: "<span style='color:green;font-weight:bold;'>Inscription réussie.</span>",
          options: true,
        });

        signupOffline.style.display = "none";
        loginChoice.style.display = "block";
      } catch (err) {
        console.error(err);
        popupLogin.openPopup({
          title: "Erreur",
          content: "Erreur réseau ou serveur.",
          options: true,
        });
      }
    });
  }

  async getAZauth() {
    let AZauthClient = new AZauth(this.config.online);
    let PopupLogin = new popup();
    let loginAZauth = document.querySelector(".login-AZauth");
    let loginAZauthA2F = document.querySelector(".login-AZauth-A2F");

    let AZauthEmail = document.querySelector(".email-AZauth");
    let AZauthPassword = document.querySelector(".password-AZauth");
    let AZauthA2F = document.querySelector(".A2F-AZauth");
    let connectAZauthA2F = document.querySelector(".connect-AZauth-A2F");
    let AZauthConnectBTN = document.querySelector(".connect-AZauth");
    let AZauthCancelA2F = document.querySelector(".cancel-AZauth-A2F");

    loginAZauth.style.display = "block";

    AZauthConnectBTN.addEventListener("click", async () => {
      PopupLogin.openPopup({
        title: "Connexion en cours...",
        content: "Veuillez patienter...",
        color: "var(--color)",
      });

      if (AZauthEmail.value == "" || AZauthPassword.value == "") {
        PopupLogin.openPopup({
          title: "Erreur",
          content: "Veuillez remplir tous les champs.",
          options: true,
        });
        return;
      }

      let AZauthConnect = await AZauthClient.login(
        AZauthEmail.value,
        AZauthPassword.value
      );

      if (AZauthConnect.error) {
        PopupLogin.openPopup({
          title: "Erreur",
          content: AZauthConnect.message,
          options: true,
        });
        return;
      } else if (AZauthConnect.A2F) {
        loginAZauthA2F.style.display = "block";
        loginAZauth.style.display = "none";
        PopupLogin.closePopup();

        AZauthCancelA2F.addEventListener("click", () => {
          loginAZauthA2F.style.display = "none";
          loginAZauth.style.display = "block";
        });

        connectAZauthA2F.addEventListener("click", async () => {
          PopupLogin.openPopup({
            title: "Connexion en cours...",
            content: "Veuillez patienter...",
            color: "var(--color)",
          });

          if (AZauthA2F.value == "") {
            PopupLogin.openPopup({
              title: "Erreur",
              content: "Veuillez entrer le code A2F.",
              options: true,
            });
            return;
          }

          AZauthConnect = await AZauthClient.login(
            AZauthEmail.value,
            AZauthPassword.value,
            AZauthA2F.value
          );

          if (AZauthConnect.error) {
            PopupLogin.openPopup({
              title: "Erreur",
              content: AZauthConnect.message,
              options: true,
            });
            return;
          }

          await this.saveData(AZauthConnect);
          PopupLogin.closePopup();
        });
      } else if (!AZauthConnect.A2F) {
        await this.saveData(AZauthConnect);
        PopupLogin.closePopup();
      }
    });
  }

  async saveData(connectionData) {
    // Ajoute le mot de passe si fourni (pour reconnexion auto)
    if (connectionData.password) {
      connectionData.password = connectionData.password;
    }
    let configClient = await this.db.readData("configClient");

    // Un seul compte autorisé: on remplace l'ancien (vide la table avant d'ajouter)
    await this.db.clearTable("accounts");
    let account = await this.db.createData("accounts", connectionData);
    // Correction du nom de la clé pour la sélection d'instance
    let instanceSelect = configClient.instance_select || configClient.instance_selct;
    let instancesList = await config.getInstanceList();
    configClient.account_selected = account.ID;

    for (let instance of instancesList) {
      if (instance.whitelistActive) {
        let whitelist = instance.whitelist.find(
          (whitelist) => whitelist == account.name
        );
        if (whitelist !== account.name) {
          if (instance.name == instanceSelect) {
            let newInstanceSelect = instancesList.find(
              (i) => i.whitelistActive == false
            );
            // Correction du nom de la clé ici aussi
            configClient.instance_select = newInstanceSelect.name;
            delete configClient.instance_selct;
            await setStatus(newInstanceSelect.status);
          }
        }
      }
    }

    // Save the connection state persistently
    connectionData.lastOnline = new Date().toISOString();
    await this.db.updateData('accounts', connectionData, account.ID);

    await this.db.updateData("configClient", configClient);
    await addAccount(account);
    await accountSelect(account);
    changePanel("home");
  }
}
export default Login;
