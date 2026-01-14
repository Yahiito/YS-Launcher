/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */
const { AZauth, Mojang } = require('minecraft-java-core');
const { ipcRenderer } = require('electron');
const nodeFetch = require('node-fetch');

import { popup, database, changePanel, accountSelect, addAccount, config, setStatus } from '../utils.js';

class Login {
    static id = "login";
    async init(config) {
        this.config = config;
        this.db = new database();

        if (typeof this.config.online == 'boolean') {
            this.config.online ? this.getMicrosoft() : this.getCrack()
        } else if (typeof this.config.online == 'string') {
            if (this.config.online.match(/^(http|https):\/\/[^ "]+$/)) {
                this.getAZauth();
            }
        }
        
        document.querySelector('.cancel-home').addEventListener('click', () => {
            document.querySelector('.cancel-home').style.display = 'none'
            changePanel('settings')
        })
    }

    async getMicrosoft() {
        console.log('Initializing Microsoft login...');
        let popupLogin = new popup();
        let loginHome = document.querySelector('.login-home');
        let microsoftBtn = document.querySelector('.connect-home');
        loginHome.style.display = 'block';

        microsoftBtn.addEventListener("click", () => {
            popupLogin.openPopup({
                title: 'Connexion',
                content: 'Veuillez patienter...',
                color: 'var(--color)'
            });

            ipcRenderer.invoke('Microsoft-window', this.config.client_id).then(async account_connect => {
                if (account_connect == 'cancel' || !account_connect) {
                    popupLogin.closePopup();
                    return;
                } else {
                    await this.saveData(account_connect)
                    popupLogin.closePopup();
                }

            }).catch(err => {
                popupLogin.openPopup({
                    title: 'Erreur',
                    content: err,
                    options: true
                });
            });
        })
    }

    async getCrack() {
        console.log('Initializing offline login...');
        let popupLogin = new popup();

        const AUTH_URL = 'https://lapepterie.com/Minecraft/auth.php';
        const REGISTER_URL = 'https://lapepterie.com/Minecraft/register.php';

        const postPhp = async (url, bodyObj) => {
            let res;
            const doRequest = async (mode) => {
                const headers = {
                    'Accept': 'application/json, text/plain, */*'
                };
                let body;

                if (mode === 'json') {
                    headers['Content-Type'] = 'application/json; charset=UTF-8';
                    body = JSON.stringify(bodyObj);
                } else {
                    headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
                    body = new URLSearchParams(bodyObj).toString();
                }

                let response;
                try {
                    response = await nodeFetch(url, { method: 'POST', headers, body });
                } catch (err) {
                    return { ok: false, message: `Impossible de contacter le serveur. (${err?.message || err})` };
                }

                const rawText = await response.text();
                let json;
                try { json = JSON.parse(rawText); } catch { json = null; }

                if (!response.ok) {
                    return { ok: false, message: (json?.message || json?.error || rawText || `Erreur HTTP ${response.status}`), _raw: rawText, _json: json };
                }

                if (json) {
                    const explicitError = json.error === true || json.status === 'error' || json.success === false || typeof json.error === 'string';
                    if (explicitError) {
                        return { ok: false, message: json.message || json.error || json.reason || 'Erreur inconnue.', _raw: rawText, _json: json };
                    }
                    return { ok: true, data: json, _raw: rawText, _json: json };
                }

                const normalized = String(rawText || '').trim().toLowerCase();
                if (normalized === 'ok' || normalized === 'success' || normalized === '1') return { ok: true, data: rawText, _raw: rawText };
                return { ok: false, message: rawText || 'Réponse serveur invalide.', _raw: rawText };
            }

            // Tes scripts PHP lisent php://input en JSON -> on tente JSON d'abord.
            const first = await doRequest('json');
            if (first.ok) return first;

            // Fallback (si un jour le backend bascule sur $_POST)
            const fallback = await doRequest('form');
            return fallback.ok ? fallback : first;

        }

        const buildAuthBody = (username, password) => ({ username, password });
        const buildRegisterBody = (username, email, password) => ({ username, email, password });

        const toWebAuthenticator = (api) => {
            const name = api?.name || api?.username;
            const uuid = api?.uuid;
            const accessToken = api?.access_token || api?.accessToken || api?.access_token;

            return {
                access_token: accessToken || 'offline-token',
                client_token: uuid || accessToken || 'offline-client',
                uuid: uuid,
                name: name,
                user_properties: typeof api?.user_properties === 'string'
                    ? api.user_properties
                    : JSON.stringify(api?.user_properties ?? {}),
                meta: {
                    online: false,
                    type: 'Mojang',
                    provider: 'web',
                    expiresAt: api?.expiresAt ?? null,
                },
                web: {
                    accountId: api?.ID ?? null,
                    email: api?.email ?? null,
                    skin: api?.skin ?? null,
                },
            };
        }

        let loginChoice = document.querySelector('.login-choice');
        let loginOffline = document.querySelector('.login-offline');
        let signupOffline = document.querySelector('.signup-offline');

        let btnLogin = document.querySelector('#btn-login');
        let btnSignup = document.querySelector('#btn-signup');

        let emailOffline = document.querySelector('.email-offline');
        let passwordOffline = document.querySelector('.password-offline');
        let connectOffline = document.querySelector('.connect-offline');
        let cancelOffline = document.querySelector('.cancel-offline');

        let usernameSignup = document.querySelector('.username-signup');
        let emailSignup = document.querySelector('.email-signup');
        let passwordSignup = document.querySelector('.password-signup');
        let connectSignup = document.querySelector('.connect-signup');
        let cancelSignup = document.querySelector('.cancel-signup');

        const hideAll = () => {
            for (const elem of [loginChoice, loginOffline, signupOffline]) {
                if (elem) elem.style.display = 'none';
            }
        }

        const showChoice = () => {
            hideAll();
            if (loginChoice) loginChoice.style.display = 'block';
        }

        const showLogin = () => {
            hideAll();
            if (loginOffline) loginOffline.style.display = 'block';
            if (cancelOffline) cancelOffline.style.display = '';
        }

        const showSignup = () => {
            hideAll();
            if (signupOffline) signupOffline.style.display = 'block';
        }

        showChoice();

        btnLogin?.addEventListener('click', showLogin);
        btnSignup?.addEventListener('click', showSignup);
        cancelOffline?.addEventListener('click', showChoice);
        cancelSignup?.addEventListener('click', showChoice);

        connectSignup?.addEventListener('click', async () => {
            const username = usernameSignup?.value?.trim();
            const email = emailSignup?.value?.trim();
            const password = passwordSignup?.value || '';

            if (!username || username.length < 3) {
                popupLogin.openPopup({ title: 'Erreur', content: 'Votre pseudo doit faire au moins 3 caractères.', options: true });
                return;
            }

            if (username.match(/\s/g)) {
                popupLogin.openPopup({ title: 'Erreur', content: 'Votre pseudo ne doit pas contenir d\'espaces.', options: true });
                return;
            }

            if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
                popupLogin.openPopup({ title: 'Erreur', content: 'Veuillez entrer une adresse email valide.', options: true });
                return;
            }

            if (!password || password.length < 4) {
                popupLogin.openPopup({ title: 'Erreur', content: 'Votre mot de passe doit faire au moins 4 caractères.', options: true });
                return;
            }

            popupLogin.openPopup({ title: 'Inscription', content: 'Création du compte...', color: 'var(--color)' });
            const registerRes = await postPhp(REGISTER_URL, buildRegisterBody(username, email, password));
            if (!registerRes.ok) {
                popupLogin.openPopup({ title: 'Erreur', content: registerRes.message, options: true });
                return;
            }

            popupLogin.openPopup({ title: 'Connexion', content: 'Connexion en cours...', color: 'var(--color)' });
            const authRes = await postPhp(AUTH_URL, buildAuthBody(username, password));
            if (!authRes.ok) {
                popupLogin.openPopup({
                    title: 'Inscription OK',
                    content: `Compte créé. ${authRes.message ? `\nConnexion impossible: ${authRes.message}` : ''}`,
                    options: true
                });
                showLogin();
                if (emailOffline) emailOffline.value = username;
                if (passwordOffline) passwordOffline.value = '';
                return;
            }

            const authenticator = toWebAuthenticator(authRes.data);
            if (!authenticator.uuid || !authenticator.name) {
                popupLogin.openPopup({ title: 'Erreur', content: "Réponse serveur invalide (uuid/username manquants).", options: true });
                return;
            }

            await this.saveData(authenticator);
            popupLogin.closePopup();
        });

        connectOffline.addEventListener('click', async () => {
            const username = emailOffline?.value?.trim();
            const password = passwordOffline?.value || '';

            if (!username || username.length < 3) {
                popupLogin.openPopup({
                    title: 'Erreur',
                    content: 'Votre pseudo doit faire au moins 3 caractères.',
                    options: true
                });
                return;
            }

            if (username.match(/\s/g)) {
                popupLogin.openPopup({
                    title: 'Erreur',
                    content: 'Votre pseudo ne doit pas contenir d\'espaces.',
                    options: true
                });
                return;
            }

            if (!password) {
                popupLogin.openPopup({
                    title: 'Erreur',
                    content: 'Veuillez entrer votre mot de passe.',
                    options: true
                });
                return;
            }

            popupLogin.openPopup({
                title: 'Connexion',
                content: 'Vérification des identifiants...',
                color: 'var(--color)'
            });

            const authRes = await postPhp(AUTH_URL, buildAuthBody(username, password));
            if (!authRes.ok) {
                popupLogin.openPopup({
                    title: 'Erreur',
                    content: authRes.message,
                    options: true
                });
                return;
            }

            const authenticator = toWebAuthenticator(authRes.data);
            if (!authenticator.uuid || !authenticator.name) {
                popupLogin.openPopup({ title: 'Erreur', content: "Réponse serveur invalide (uuid/username manquants).", options: true });
                return;
            }

            await this.saveData(authenticator)
            popupLogin.closePopup();
        });
    }

    async getAZauth() {
        console.log('Initializing AZauth login...');
        let AZauthClient = new AZauth(this.config.online);
        let PopupLogin = new popup();
        let loginAZauth = document.querySelector('.login-AZauth');
        let loginAZauthA2F = document.querySelector('.login-AZauth-A2F');

        let AZauthEmail = document.querySelector('.email-AZauth');
        let AZauthPassword = document.querySelector('.password-AZauth');
        let AZauthA2F = document.querySelector('.A2F-AZauth');
        let connectAZauthA2F = document.querySelector('.connect-AZauth-A2F');
        let AZauthConnectBTN = document.querySelector('.connect-AZauth');
        let AZauthCancelA2F = document.querySelector('.cancel-AZauth-A2F');

        loginAZauth.style.display = 'block';

        AZauthConnectBTN.addEventListener('click', async () => {
            PopupLogin.openPopup({
                title: 'Connexion en cours...',
                content: 'Veuillez patienter...',
                color: 'var(--color)'
            });

            if (AZauthEmail.value == '' || AZauthPassword.value == '') {
                PopupLogin.openPopup({
                    title: 'Erreur',
                    content: 'Veuillez remplir tous les champs.',
                    options: true
                });
                return;
            }

            let AZauthConnect = await AZauthClient.login(AZauthEmail.value, AZauthPassword.value);

            if (AZauthConnect.error) {
                PopupLogin.openPopup({
                    title: 'Erreur',
                    content: AZauthConnect.message,
                    options: true
                });
                return;
            } else if (AZauthConnect.A2F) {
                loginAZauthA2F.style.display = 'block';
                loginAZauth.style.display = 'none';
                PopupLogin.closePopup();

                AZauthCancelA2F.addEventListener('click', () => {
                    loginAZauthA2F.style.display = 'none';
                    loginAZauth.style.display = 'block';
                });

                connectAZauthA2F.addEventListener('click', async () => {
                    PopupLogin.openPopup({
                        title: 'Connexion en cours...',
                        content: 'Veuillez patienter...',
                        color: 'var(--color)'
                    });

                    if (AZauthA2F.value == '') {
                        PopupLogin.openPopup({
                            title: 'Erreur',
                            content: 'Veuillez entrer le code A2F.',
                            options: true
                        });
                        return;
                    }

                    AZauthConnect = await AZauthClient.login(AZauthEmail.value, AZauthPassword.value, AZauthA2F.value);

                    if (AZauthConnect.error) {
                        PopupLogin.openPopup({
                            title: 'Erreur',
                            content: AZauthConnect.message,
                            options: true
                        });
                        return;
                    }

                    await this.saveData(AZauthConnect)
                    PopupLogin.closePopup();
                });
            } else if (!AZauthConnect.A2F) {
                await this.saveData(AZauthConnect)
                PopupLogin.closePopup();
            }
        });
    }

    async saveData(connectionData) {
        let configClient = await this.db.readData('configClient');
        let account = await this.db.createData('accounts', connectionData)
        let instanceSelect = configClient.instance_select
        let instancesList = await config.getInstanceList()
        configClient.account_selected = account.ID;

        for (let instance of instancesList) {
            if (instance.whitelistActive) {
                let whitelist = instance.whitelist.find(whitelist => whitelist == account.name)
                if (whitelist !== account.name) {
                    if (instance.name == instanceSelect) {
                        let newInstanceSelect = instancesList.find(i => i.whitelistActive == false)
                        configClient.instance_select = newInstanceSelect.name
                        await setStatus(newInstanceSelect.status)
                    }
                }
            }
        }

        await this.db.updateData('configClient', configClient);
        await addAccount(account);
        await accountSelect(account);
        changePanel('home');
    }
}
export default Login;