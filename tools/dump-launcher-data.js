const path = require('path');
const Store = require('electron-store');

function redact(value) {
  if (typeof value !== 'string') return value;
  if (value.length <= 8) return '***';
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function redactSensitive(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redactSensitive);

  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (['accessToken', 'refreshToken', 'token', 'password'].includes(k)) {
      out[k] = typeof v === 'string' ? redact(v) : '***';
      continue;
    }
    out[k] = redactSensitive(v);
  }
  return out;
}

try {
  const appData = process.env.APPDATA;
  if (!appData) throw new Error('APPDATA env var not set');

  // Must match production stable path forced in src/app.js
  const userDataPath = path.join(appData, 'YS-Launcher');
  const cwd = path.join(userDataPath, 'databases');

  const store = new Store({
    name: 'launcher-data',
    cwd,
    encryptionKey: 'selvania-launcher-key',
  });

  const data = redactSensitive(store.store);
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
} catch (err) {
  console.error(err && err.message ? err.message : err);
  process.exitCode = 1;
}
