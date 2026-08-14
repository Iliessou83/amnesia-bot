#!/usr/bin/env node
// Veille email autonome, déclenchée par n8n toutes les 10 minutes via le
// pont HTTP. Ne coûte un appel Claude QUE s'il y a réellement de nouveaux
// emails (dédupliqués par emails-vus.js) — sinon sort immédiatement, zéro
// coût, zéro message. Jamais plus d'UN message Telegram par run, même si
// plusieurs emails urgents arrivent en même temps.
const { execFileSync, execFile } = require('child_process');

let nouveaux;
try {
  nouveaux = execFileSync('node', ['harmonie-google-cli.js', 'emails-nouveaux', '20'], { cwd: __dirname, encoding: 'utf8' }).trim();
} catch (e) {
  console.error('[harmonie-watch] erreur lecture emails :', e.message);
  process.exit(1);
}

if (!nouveaux || nouveaux === 'Aucun nouvel email.') {
  console.log('[harmonie-watch] rien de nouveau — ' + new Date().toISOString());
  process.exit(0);
}

const systemContext = `Tu es Harmonie, secrétaire personnelle d'Ilies. Voici les emails non lus qu'il n'a encore jamais vus passer par ta veille automatique :

${nouveaux}

Pour CHACUN, juge s'il est VRAIMENT urgent : deadline serrée, client mécontent ou qui bloque, problème technique en prod, paiement/facture avec échéance proche, RDV à confirmer ou annuler dans l'immédiat. PAS urgent : promotions, newsletters, notifications automatiques routine, spam, messages qui peuvent clairement attendre le prochain brief.

Si AU MOINS UN email est vraiment urgent : envoie UN SEUL message avec node harmonie-send.js envoyer "..." qui résume le ou les emails urgents et pourquoi ils le sont. Un seul appel, même si plusieurs emails sont urgents — regroupe-les dans le même message.

Si AUCUN n'est urgent : ne fais RIEN. N'appelle aucun outil, n'écris rien d'autre qu'une courte confirmation textuelle (que personne ne lira). Ne dérange jamais Ilies pour du non-urgent, c'est le brief matin/soir qui s'en charge.`;

execFile('claude', ['-p', systemContext, '--allowedTools', 'Bash(node harmonie-send.js envoyer *)'],
  { timeout: 90000, maxBuffer: 1024 * 1024 * 10, cwd: __dirname },
  (err, stdout, stderr) => {
    if (err) {
      console.error('[harmonie-watch] erreur :', err.message, stderr);
      process.exit(1);
    }
    console.log('[harmonie-watch] terminé — ' + new Date().toISOString());
    console.log(stdout.trim());
  }
);
