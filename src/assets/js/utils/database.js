/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */
const Store = require('electron-store');
const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

let dev = process.env.NODE_ENV === 'dev';

class database {
    constructor() {
        this.store = null;
        this.initialized = false;
    }

    async initStore() {
        if (!this.initialized) {
            const userDataPath = await ipcRenderer.invoke('path-user-data');

            // Always store in a stable folder inside userData, so dev/prod behave the same.
            const cwd = path.join(userDataPath, 'databases');
            const storeName = 'launcher-data';
            const storePath = path.join(cwd, `${storeName}.json`);

            // If the app name/userData folder changed between builds (e.g. YS-Launcher vs ys-launcher),
            // the DB will look "deleted" because it's actually in a different Roaming folder.
            // When the target file doesn't exist yet, try to copy it from common legacy locations.
            if (!dev) {
                try {
                    if (!fs.existsSync(storePath)) {
                        const roaming = process.env.APPDATA;
                        if (roaming) {
                            const candidateUserDataFolders = [
                                'YS-Launcher',
                                'ys-launcher',
                                'Y&S Launcher',
                                '.YS-Launcher',
                            ];

                            const candidates = candidateUserDataFolders
                                .map((folder) => path.join(roaming, folder, 'databases', `${storeName}.json`))
                                .filter((p) => p.toLowerCase() !== storePath.toLowerCase());

                            const source = candidates.find((p) => {
                                try {
                                    return fs.existsSync(p) && fs.statSync(p).size > 0;
                                } catch {
                                    return false;
                                }
                            });

                            if (source) {
                                try {
                                    if (!fs.existsSync(cwd)) fs.mkdirSync(cwd, { recursive: true });
                                    fs.copyFileSync(source, storePath);
                                    console.log(`[DB] migrated store from ${source} -> ${storePath}`);
                                } catch (e) {
                                    console.warn('[DB] migration copy failed', e);
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.warn('[DB] migration check failed', e);
                }
            }

            // Ensure folder exists (both dev and prod)
            try {
                if (!fs.existsSync(cwd)) fs.mkdirSync(cwd, { recursive: true });
            } catch (_) {
                // If directory creation fails, electron-store will throw later; keep behavior consistent.
            }

            try {
                const existsBefore = fs.existsSync(storePath);
                const sizeBefore = existsBefore ? fs.statSync(storePath).size : 0;
                console.log(`[DB] userDataPath=${userDataPath}`);
                console.log(`[DB] cwd=${cwd}`);
                console.log(`[DB] storePath=${storePath}`);
                console.log(`[DB] existsBefore=${existsBefore} sizeBefore=${sizeBefore}`);
            } catch (e) {
                console.warn('[DB] preflight stat failed', e);
            }

            // Store init (always encrypted so behavior is consistent in dev/prod)
            const encryptionKey = 'selvania-launcher-key';

            // If the file is plaintext JSON (older builds), migrate it to encrypted store safely.
            try {
                if (fs.existsSync(storePath)) {
                    const firstByte = fs.readFileSync(storePath, { encoding: 'utf8', flag: 'r' }).trimStart()[0];
                    if (firstByte === '{') {
                        const legacyJson = JSON.parse(fs.readFileSync(storePath, 'utf8'));
                        const backupPath = path.join(cwd, `${storeName}.legacy.${Date.now()}.json`);
                        fs.copyFileSync(storePath, backupPath);

                        // Create encrypted store and copy keys
                        const encryptedStore = new Store({ name: storeName, cwd, encryptionKey });
                        for (const [key, value] of Object.entries(legacyJson || {})) {
                            encryptedStore.set(key, value);
                        }
                        this.store = encryptedStore;
                        console.log(`[DB] migrated plaintext store -> encrypted (backup: ${backupPath})`);
                    }
                }
            } catch (e) {
                console.warn('[DB] plaintext migration failed (will try encrypted open)', e);
            }

            if (!this.store) {
                // Open encrypted store. If it fails, backup the file before recreating.
                try {
                    const encryptedStore = new Store({ name: storeName, cwd, encryptionKey });
                    void encryptedStore.store;
                    this.store = encryptedStore;
                } catch (e) {
                    try {
                        if (fs.existsSync(storePath)) {
                            const brokenPath = path.join(cwd, `${storeName}.broken.${Date.now()}.json`);
                            fs.renameSync(storePath, brokenPath);
                            console.warn(`[DB] store unreadable, backed up to ${brokenPath}`);
                        }
                    } catch (backupErr) {
                        console.warn('[DB] failed to backup broken store', backupErr);
                    }

                    // Create a fresh encrypted store
                    const freshStore = new Store({ name: storeName, cwd, encryptionKey });
                    this.store = freshStore;
                }
            }

            // Force file creation once so the store exists immediately on disk.
            try {
                const existingBootstrap = this.store.get('__bootstrap');
                if (!existingBootstrap) this.store.set('__bootstrap', Date.now());
            } catch (_) {
                // Ignore bootstrap failures
            }

            try {
                const existsAfter = fs.existsSync(storePath);
                const sizeAfter = existsAfter ? fs.statSync(storePath).size : 0;
                console.log(`[DB] existsAfter=${existsAfter} sizeAfter=${sizeAfter}`);
            } catch (e) {
                console.warn('[DB] postflight stat failed', e);
            }

            this.initialized = true;
        }
        return this.store;
    }

    async createData(tableName, data) {
        await this.initStore();
        let tableData = this.store.get(tableName, []);

        // Générer un nouvel ID
        const maxId = tableData.length > 0
            ? Math.max(...tableData.map(item => item.ID || 0))
            : 0;
        const newId = maxId + 1;

        data.ID = newId;
        tableData.push(data);
        this.store.set(tableName, tableData);

        return data;
    }

    async readData(tableName, key = 1) {
        await this.initStore();
        let tableData = this.store.get(tableName, []);
        let data = tableData.find(item => item.ID === key);
        return data ? data : undefined;
    }

    async readAllData(tableName) {
        await this.initStore();
        return this.store.get(tableName, []);
    }

    async updateData(tableName, data, key = 1) {
        await this.initStore();
        let tableData = this.store.get(tableName, []);
        const index = tableData.findIndex(item => item.ID === key);

        if (index !== -1) {
            data.ID = key;
            tableData[index] = data;
            this.store.set(tableName, tableData);
        } else {
            // Si l'élément n'existe pas, on le crée
            data.ID = key;
            tableData.push(data);
            this.store.set(tableName, tableData);
        }
    }

    async deleteData(tableName, key = 1) {
        await this.initStore();
        let tableData = this.store.get(tableName, []);
        tableData = tableData.filter(item => item.ID !== key);
        this.store.set(tableName, tableData);
    }

    async clearTable(tableName) {
        await this.initStore();
        this.store.set(tableName, []);
    }
}

export default database;