#!/usr/bin/env node
// CLI que Harmonie (Claude Code, via --allowedTools "Bash(node harmonie-cli.js *)") invoque
// pour gérer les tâches/RDV persistés. Sortie texte simple, faite pour être lue par un LLM.
const store = require('./store');
const notes = require('./notes');

const [, , cmd, ...args] = process.argv;

function echeanceValide(s) {
  if (!s) return true;
  return !isNaN(new Date(s).getTime());
}

// Harmonie reçoit des heures "21h40" en heure de Paris, mais le store et les
// rappels comparent en UTC. Sans conversion explicite, un rappel d'été part
// 2h en retard (1h en hiver) — silencieusement, la tâche a l'air bien créée.
function versUTC(echeance) {
  if (!echeance) return null;
  const aUnDecalage = /Z$|[+-]\d{2}:?\d{2}$/.test(echeance);
  if (aUnDecalage) return new Date(echeance).toISOString();

  const approx = new Date(echeance + 'Z');
  const partiesOffset = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris', timeZoneName: 'shortOffset',
  }).formatToParts(approx);
  const nomOffset = partiesOffset.find(p => p.type === 'timeZoneName').value; // ex: "GMT+2"
  const heuresOffset = parseInt(nomOffset.replace('GMT', ''), 10) || 0;
  return new Date(approx.getTime() - heuresOffset * 3600000).toISOString();
}

switch (cmd) {
  case 'ajouter': {
    const [texte, echeance] = args;
    if (!texte) { console.log('Erreur : texte manquant. Usage: ajouter "texte" ["2026-08-15T14:00"]'); process.exit(1); }
    if (!echeanceValide(echeance)) { console.log(`Erreur : échéance invalide "${echeance}", utiliser un format ISO (AAAA-MM-JJTHH:MM).`); process.exit(1); }
    const t = store.ajouter(texte, versUTC(echeance));
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
  case 'noter': {
    const [texte] = args;
    if (!texte) { console.log('Erreur : texte manquant. Usage: noter "texte"'); process.exit(1); }
    const n = notes.ajouter(texte);
    console.log(`Noté [${n.id}] "${n.texte}"`);
    break;
  }
  case 'notes': {
    const l = notes.lister();
    if (l.length === 0) { console.log('Aucune note.'); break; }
    console.log(l.map(n => `[${n.id}] ${n.texte}`).join('\n'));
    break;
  }
  case 'oublier-note': {
    const [id] = args;
    console.log(notes.oublier(id) ? `Oubliée : ${id}` : `Aucune note avec l'id ${id}`);
    break;
  }
  default:
    console.log('Commandes : ajouter "texte" ["AAAA-MM-JJTHH:MM"] | liste | terminer <id> | supprimer <id> | noter "texte" | notes | oublier-note <id>');
    process.exit(1);
}
