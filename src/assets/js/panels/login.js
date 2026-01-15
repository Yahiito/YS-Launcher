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
            popupLogin.closePopup();
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

    const AUTH_URL = "https://lapepterie.com/Minecraft/auth.php";
    const REGISTER_URL = "https://lapepterie.com/Minecraft/register.php";

    const postJson = async (url, bodyObj, withCredentials = false) => {
      let response;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: {
            Accept: "application/json, text/plain, */*",
            "Content-Type": "application/json; charset=UTF-8",
          },
          body: JSON.stringify(bodyObj),
          credentials: withCredentials ? "include" : "same-origin",
        });
      } catch (err) {
        return {
          ok: false,
          message: `Impossible de contacter le serveur. (${err?.message || err})`,
        };
      }

      const rawText = await response.text();
      let json;
      try {
        json = JSON.parse(rawText);
      } catch {
        json = null;
      }

      if (!response.ok) {
        return {
          ok: false,
          message:
            json?.message || json?.error || rawText || `Erreur HTTP ${response.status}`,
        };
      }

      if (json) {
        const explicitError =
          json.error === true ||
          json.status === "error" ||
          json.success === false ||
          typeof json.error === "string";
        if (explicitError) {
          return {
            ok: false,
            message: json.message || json.error || json.reason || "Erreur inconnue.",
          };
        }
        return { ok: true, data: json };
      }

      return {
        ok: false,
        message: rawText || "Réponse serveur invalide.",
      };
    };

    const validateUsername = (username) => {
      if (!username || username.length < 3)
        return "Votre pseudo doit faire au moins 3 caractères.";
      if (username.match(/\s/g))
        return "Votre pseudo ne doit pas contenir d'espaces.";
      return null;
    };

    const validateEmail = (email) => {
      if (!email) return "Veuillez entrer un email valide.";
      if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))
        return "Veuillez entrer un email valide.";
      return null;
    };

    const toWebAuthenticator = (api, username, password) => {
      const name = api?.name || api?.username || username;
      const uuid = api?.uuid || api?.UUID || api?.id || api?.userId || null;
      const accessToken = api?.access_token || api?.accessToken || "offline-token";

      return {
        access_token: accessToken,
        client_token: uuid || accessToken || "offline-client",
        uuid: uuid,
        name: name,
        user_properties:
          typeof api?.user_properties === "string"
            ? api.user_properties
            : JSON.stringify(api?.user_properties ?? {}),
        meta: {
          online: false,
          type: "Mojang",
          provider: "web",
          expiresAt: api?.expiresAt ?? null,
        },
        web: {
          accountId: api?.ID ?? null,
          email: api?.email ?? null,
          skin: api?.skin ?? null,
        },
        // Utilisé pour la reconnexion auto côté launcher (si tu la gardes)
        username,
        password,
      };
    };

    const loginChoice = document.querySelector(".login-choice");
    const loginOffline = document.querySelector(".login-offline");
    const signupOffline = document.querySelector(".signup-offline");

    const btnLogin = document.querySelector("#btn-login");
    const btnSignup = document.querySelector("#btn-signup");

    const emailOffline = document.querySelector(".email-offline");
    const passwordOffline = document.querySelector(".password-offline");
    const connectOffline = document.querySelector(".connect-offline");
    const cancelOffline = document.querySelector(".cancel-offline");

    const usernameSignup = signupOffline?.querySelector(".username-signup");
    const emailSignup = signupOffline?.querySelector(".email-signup");
    const passwordSignup = signupOffline?.querySelector(".password-signup");
    const connectSignup = signupOffline?.querySelector(".connect-signup");
    const cancelSignup = signupOffline?.querySelector(".cancel-signup");

    const hideAll = () => {
      for (const elem of [loginChoice, loginOffline, signupOffline]) {
        if (elem) elem.style.display = "none";
      }
    };

    const showChoice = () => {
      hideAll();
      if (loginChoice) loginChoice.style.display = "block";
    };

    const showLogin = () => {
      hideAll();
      if (loginOffline) loginOffline.style.display = "block";
      if (cancelOffline) cancelOffline.style.display = "";
    };

    const showSignup = () => {
      hideAll();
      if (signupOffline) signupOffline.style.display = "block";
    };

    showChoice();
    btnLogin?.addEventListener("click", showLogin);
    btnSignup?.addEventListener("click", showSignup);
    cancelOffline?.addEventListener("click", showChoice);
    cancelSignup?.addEventListener("click", showChoice);

    connectOffline?.addEventListener("click", async () => {
      const username = emailOffline?.value?.trim();
      const password = passwordOffline?.value || "";

      const usernameError = validateUsername(username);
      if (usernameError) {
        popupLogin.openPopup({ title: "Erreur", content: usernameError, options: true });
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

      popupLogin.openPopup({
        title: "Connexion",
        content: "Vérification des identifiants...",
        color: "var(--color)",
      });

      const authRes = await postJson(AUTH_URL, { username, password }, true);
      if (!authRes.ok) {
        popupLogin.openPopup({ title: "Erreur", content: authRes.message, options: true });
        return;
      }

      const authenticator = toWebAuthenticator(authRes.data, username, password);
      if (!authenticator.name) {
        popupLogin.openPopup({
          title: "Erreur",
          content: "Réponse serveur invalide (username manquant).",
          options: true,
        });
        return;
      }

      await this.saveData(authenticator);
      popupLogin.closePopup();
    });

    connectSignup?.addEventListener("click", async () => {
      const username = usernameSignup?.value?.trim();
      const email = emailSignup?.value?.trim();
      const password = passwordSignup?.value || "";

      const usernameError = validateUsername(username);
      if (usernameError) {
        popupLogin.openPopup({ title: "Erreur", content: usernameError, options: true });
        return;
      }

      const emailError = validateEmail(email);
      if (emailError) {
        popupLogin.openPopup({ title: "Erreur", content: emailError, options: true });
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
        popupLogin.openPopup({
          title: "Inscription",
          content: "Création du compte...",
          color: "var(--color)",
        });

        const registerRes = await postJson(REGISTER_URL, { username, email, password }, false);
        if (!registerRes.ok) {
          popupLogin.openPopup({ title: "Erreur", content: registerRes.message, options: true });
          return;
        }

        popupLogin.openPopup({
          title: "Succès",
          content: "<span style='color:green;font-weight:bold;'>Inscription réussie.</span>",
          options: true,
        });

        showChoice();
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

    await this.db.updateData("configClient", configClient);
    await addAccount(account);
    await accountSelect(account);
    changePanel("home");
  }
}
export default Login;
