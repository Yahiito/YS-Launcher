/*
  Dumps the electron-store "launcher-data" content (redacted) for debugging.
  Works with the encrypted store used by YS-Launcher.

  Usage:
    node tools/dump-launcher-data.js
*/

const path = require("path");
const os = require("os");

const Store = require("electron-store");

function defaultUserDataDir() {
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || "", "YS-Launcher");
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "YS-Launcher");
  }
  // linux
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), "YS-Launcher");
}

function redactAccount(account) {
  if (!account || typeof account !== "object") return account;
  const clone = { ...account };
  if (clone.password) clone.password = "<redacted>";
  if (clone.access_token) clone.access_token = "<redacted>";
  if (clone.refresh_token) clone.refresh_token = "<redacted>";
  if (clone.client_token) clone.client_token = "<redacted>";
  return clone;
}

function main() {
  const userData = defaultUserDataDir();
  const cwd = path.join(userData, "databases");
  const storeName = "launcher-data";

  const store = new Store({
    name: storeName,
    cwd,
    encryptionKey: "selvania-launcher-key",
  });

  const raw = store.store;

  const accounts = Array.isArray(raw.accounts) ? raw.accounts : [];
  const configClient = Array.isArray(raw.configClient) ? raw.configClient[0] : undefined;

  const out = {
    cwd,
    keys: Object.keys(raw).sort(),
    configClient,
    accountsCount: accounts.length,
    accountsPreview: accounts.slice(0, 3).map(redactAccount),
  };

  console.log(JSON.stringify(out, null, 2));
}

main();
