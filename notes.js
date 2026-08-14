// Stockage JSON minimal pour les notes/faits persistants de Harmonie — même
// patron que store.js. Contrairement aux tâches, une note n'a pas d'échéance :
// c'est un fait à retenir durablement (préférence, information récurrente).
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'notes.json');

function lire() {
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    console.error('[notes] notes.json corrompu, repli sur liste vide:', e.message);
    return [];
  }
}

function ecrire(notes) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(notes, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

function ajouter(texte) {
  const notes = lire();
  const note = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    texte,
    creeLe: new Date().toISOString(),
  };
  notes.push(note);
  ecrire(notes);
  return note;
}

function lister() {
  return lire().sort((a, b) => a.creeLe.localeCompare(b.creeLe));
}

function oublier(id) {
  const notes = lire();
  const idx = notes.findIndex(n => n.id === id);
  if (idx === -1) return false;
  notes.splice(idx, 1);
  ecrire(notes);
  return true;
}

module.exports = { ajouter, lister, oublier };
