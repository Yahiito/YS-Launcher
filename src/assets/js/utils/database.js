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

            const cwd = path.join(userDataPath, dev ? '..' : 'databases');
            try {
                if (!fs.existsSync(cwd)) fs.mkdirSync(cwd, { recursive: true });
            } catch (_) {
                // If directory creation fails, electron-store will throw later; keep behavior consistent.
            }

            const storeName = 'launcher-data';

            // In production we encrypt. If an older version wrote an unencrypted JSON,
            // electron-store/conf will fail to decrypt and can appear as if the DB was wiped.
            // We try to migrate legacy unencrypted data once.
            if (!dev) {
                try {
                    const encryptedStore = new Store({
                        name: storeName,
                        cwd,
                        encryptionKey: 'selvania-launcher-key',
                    });
                    // Force load now to catch decrypt/parse errors early.
                    void encryptedStore.store;
                    this.store = encryptedStore;
                } catch (err) {
                    try {
                        const legacyStore = new Store({ name: storeName, cwd });
                        const legacyData = legacyStore.store;

                        const encryptedStore = new Store({
                            name: storeName,
                            cwd,
                            encryptionKey: 'selvania-launcher-key',
                        });

                        if (legacyData && typeof legacyData === 'object' && Object.keys(legacyData).length > 0) {
                            for (const [key, value] of Object.entries(legacyData)) {
                                encryptedStore.set(key, value);
                            }
                        }

                        this.store = encryptedStore;
                    } catch (_) {
                        // Last resort: start fresh encrypted store
                        this.store = new Store({
                            name: storeName,
                            cwd,
                            encryptionKey: 'selvania-launcher-key',
                        });
                    }
                }
            } else {
                this.store = new Store({ name: storeName, cwd });
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