// Mémorise quels emails ont déjà été présentés à la veille automatique, pour
// ne jamais réévaluer/réalerter deux fois le même message. Même patron que
// store.js/notes.js.
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'emails-vus.json');
const MAX_GARDES = 500; // borne la taille, un id Gmail ne ressert jamais

function lire() {
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    console.error('[emails-vus] fichier corrompu, repli sur liste vide:', e.message);
    return [];
  }
}

function dejaVu(id) {
  return lire().includes(id);
}

function marquerVus(ids) {
  if (!ids.length) return;
  const vus = lire();
  const fusion = [...vus, ...ids.filter(id => !vus.includes(id))];
  const bornee = fusion.slice(-MAX_GARDES);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(bornee, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

module.exports = { dejaVu, marquerVus };
