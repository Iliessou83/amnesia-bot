// Stockage JSON minimal pour les tâches/RDV de Harmonie — zéro dépendance npm
// (le VPS déploie par curl de fichiers .js bruts, pas de npm install).
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'taches.json');

function lire() {
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    console.error('[store] taches.json corrompu, repli sur liste vide:', e.message);
    return [];
  }
}

function ecrire(taches) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(taches, null, 2));
  fs.renameSync(tmp, DATA_FILE); // écriture atomique, pas de fichier à moitié écrit si crash
}

function ajouter(texte, echeanceISO) {
  const taches = lire();
  const tache = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    texte,
    echeance: echeanceISO || null,
    statut: 'ouverte',
    creeLe: new Date().toISOString(),
    rappelEnvoye: false,
  };
  taches.push(tache);
  ecrire(taches);
  return tache;
}

function lister({ inclureTerminees = false } = {}) {
  return lire()
    .filter(t => inclureTerminees || t.statut === 'ouverte')
    .sort((a, b) => (a.echeance || '9999').localeCompare(b.echeance || '9999'));
}

function terminer(id) {
  const taches = lire();
  const t = taches.find(t => t.id === id);
  if (!t) return null;
  t.statut = 'terminee';
  t.termineeLe = new Date().toISOString();
  ecrire(taches);
  return t;
}

function supprimer(id) {
  const taches = lire();
  const idx = taches.findIndex(t => t.id === id);
  if (idx === -1) return false;
  taches.splice(idx, 1);
  ecrire(taches);
  return true;
}

function marquerRappelEnvoye(id) {
  const taches = lire();
  const t = taches.find(t => t.id === id);
  if (!t) return;
  t.rappelEnvoye = true;
  ecrire(taches);
}

function tachesARappeler(maintenantISO) {
  // échéance passée ou égale à la minute courante, pas encore rappelée, pas terminée
  return lire().filter(t =>
    t.statut === 'ouverte' &&
    !t.rappelEnvoye &&
    t.echeance &&
    t.echeance <= maintenantISO
  );
}

module.exports = { ajouter, lister, terminer, supprimer, marquerRappelEnvoye, tachesARappeler };
