// Ce module supprime le dossier <userData>/assets/skins au lancement du launcher
// (cache uniquement, ne touche pas la base de données).
const fs = require('fs-extra');
const path = require('path');

function deleteSkinsFolder(userDataPath) {
    if (!userDataPath) return;
    const skinsPath = path.join(userDataPath, 'assets', 'skins');
    fs.remove(skinsPath, err => {
        if (err) {
            console.error('Erreur lors de la suppression du dossier skins:', err);
        } else {
            console.log('Dossier skins supprimé:', skinsPath);
        }
    });
}

module.exports = deleteSkinsFolder;
