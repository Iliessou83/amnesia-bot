#!/usr/bin/env node
// CLI que Harmonie (Claude Code, via --allowedTools "Bash(node harmonie-cli.js *)") invoque
// pour gérer les tâches/RDV persistés. Sortie texte simple, faite pour être lue par un LLM.
const store = require('./store');

const [, , cmd, ...args] = process.argv;

function echeanceValide(s) {
  if (!s) return true;
  return !isNaN(new Date(s).getTime());
}

switch (cmd) {
  case 'ajouter': {
    const [texte, echeance] = args;
    if (!texte) { console.log('Erreur : texte manquant. Usage: ajouter "texte" ["2026-08-15T14:00"]'); process.exit(1); }
    if (!echeanceValide(echeance)) { console.log(`Erreur : échéance invalide "${echeance}", utiliser un format ISO (AAAA-MM-JJTHH:MM).`); process.exit(1); }
    const t = store.ajouter(texte, echeance ? new Date(echeance).toISOString() : null);
    console.log(`Ajouté [${t.id}] "${t.texte}"${t.echeance ? ' — échéance ' + t.echeance : ''}`);
    break;
  }
  case 'liste': {
    const taches = store.lister();
    if (taches.length === 0) { console.log('Aucune tâche ouverte.'); break; }
    console.log(taches.map(t => `[${t.id}] ${t.texte}${t.echeance ? ' — ' + t.echeance : ''}`).join('\n'));
    break;
  }
  case 'terminer': {
    const [id] = args;
    const t = store.terminer(id);
    console.log(t ? `Terminée : [${t.id}] ${t.texte}` : `Aucune tâche avec l'id ${id}`);
    break;
  }
  case 'supprimer': {
    const [id] = args;
    console.log(store.supprimer(id) ? `Supprimée : ${id}` : `Aucune tâche avec l'id ${id}`);
    break;
  }
  default:
    console.log('Commandes : ajouter "texte" ["AAAA-MM-JJTHH:MM"] | liste | terminer <id> | supprimer <id>');
    process.exit(1);
}
