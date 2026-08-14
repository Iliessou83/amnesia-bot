// Pointe vers la VRAIE mémoire de Harmonie : celle de Claude Code lui-même,
// par dossier de projet (~/.claude/projects/<cwd-slug>/memory/). Testé en
// vrai le 2026-08-14 : même en lui demandant explicitement "note que...",
// le modèle écrit systématiquement dans SA mémoire native plutôt que
// d'appeler un outil "noter" séparé — un store JSON custom (notes.json)
// restait donc toujours vide pendant que la vraie mémoire, elle, se
// remplissait. Plutôt que de lutter contre ce comportement, ce module lit
// la mémoire réelle : une seule source de vérité, celle qui marche.
const fs = require('fs');
const path = require('path');
const os = require('os');

const SLUG = process.cwd().replace(/\//g, '-');
const MEMORY_DIR = path.join(os.homedir(), '.claude', 'projects', SLUG, 'memory');
const INDEX_FILE = path.join(MEMORY_DIR, 'MEMORY.md');

function lister() {
  if (!fs.existsSync(INDEX_FILE)) return [];
  return fs.readFileSync(INDEX_FILE, 'utf8')
    .split('\n')
    .filter(l => l.trim().startsWith('- ['))
    .map(l => {
      const m = l.match(/\[(.+?)\]\((.+?)\)\s*—?\s*(.*)/);
      if (!m) return null;
      return { titre: m[1], fichier: m[2], resume: m[3] || '' };
    })
    .filter(Boolean);
}

// Retire l'entrée de l'index ET supprime le fichier .md correspondant.
function oublier(fichier) {
  if (!fs.existsSync(INDEX_FILE)) return false;
  const lignes = fs.readFileSync(INDEX_FILE, 'utf8').split('\n');
  const restantes = lignes.filter(l => !l.includes(`(${fichier})`));
  if (restantes.length === lignes.length) return false;
  fs.writeFileSync(INDEX_FILE, restantes.join('\n'));
  const cheminFichier = path.join(MEMORY_DIR, fichier);
  if (fs.existsSync(cheminFichier)) fs.unlinkSync(cheminFichier);
  return true;
}

module.exports = { lister, oublier };
