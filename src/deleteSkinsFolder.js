// Ce module supprime le dossier %appdata%/.YS-Launcher/assets/skins au lancement du launcher
const fs = require('fs-extra');
const path = require('path');

function deleteSkinsFolder() {
    const appData = process.env.APPDATA;
    if (!appData) return;
    const skinsPath = path.join(appData, '.YS-Launcher', 'assets', 'skins');
    fs.remove(skinsPath, err => {
        if (err) {
            console.error('Erreur lors de la suppression du dossier skins:', err);
        } else {
            console.log('Dossier skins supprimé:', skinsPath);
        }
    });
}

module.exports = deleteSkinsFolder;
