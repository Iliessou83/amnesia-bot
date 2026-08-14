#!/usr/bin/env node
// Script autonome (pas un service long-lived) déclenché par un cron n8n via
// Execute Command : `node harmonie-brief.js matin` ou `node harmonie-brief.js soir`.
// Contrairement à harmonie.js, personne n'a écrit à Harmonie — le brief part
// tout seul. Claude rassemble les données via les CLI en lecture, puis envoie
// UN SEUL message de synthèse via harmonie-send.js — jamais de spam de
// plusieurs messages bruts.
const { execFile } = require('child_process');

const moment = process.argv[2];
if (moment !== 'matin' && moment !== 'soir') {
  console.error('Usage : node harmonie-brief.js matin|soir');
  process.exit(1);
}

const maintenant = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'full', timeStyle: 'short' });

const consignes = moment === 'matin'
  ? `Prépare le BRIEF DU MATIN d'Ilies :
1. Consulte son agenda Google du jour (node harmonie-google-cli.js agenda 1)
2. Consulte ses tâches internes ouvertes (node harmonie-cli.js liste) et ses Google Tasks (node harmonie-google-cli.js taches-liste)
3. Consulte ses emails non lus (node harmonie-google-cli.js emails 5) — signale seulement ceux qui ont l'air importants, ne liste pas toute la boîte
4. Synthétise en UN SEUL message court et actionnable : les RDV du jour, la priorité #1 à traiter, et une alerte email si besoin. Pas de blabla, pas de section vide inutile.
5. Envoie ce message avec node harmonie-send.js envoyer "..." — un seul appel, jamais plusieurs messages.`
  : `Prépare le BILAN DU SOIR d'Ilies :
1. Consulte ses tâches internes (node harmonie-cli.js liste) et ses Google Tasks ouvertes (node harmonie-google-cli.js taches-liste)
2. Consulte son agenda Google de demain (node harmonie-google-cli.js agenda 2, ne garde que demain)
3. Synthétise en UN SEUL message court : ce qui reste ouvert (sans culpabiliser, juste factuel), et le premier RDV de demain s'il y en a un.
4. Envoie ce message avec node harmonie-send.js envoyer "..." — un seul appel, jamais plusieurs messages.`;

const systemContext = `Tu es Harmonie, secrétaire personnelle d'Ilies (24 ans, entrepreneur).
Nous sommes le : ${maintenant} (Europe/Paris).

Ce n'est PAS une réponse à une question d'Ilies — c'est un brief PROACTIF que tu envoies de toi-même. Personne ne va lire ta sortie texte normale : la seule façon qu'Ilies voie quoi que ce soit, c'est que tu appelles réellement node harmonie-send.js envoyer "...". Si tu ne l'appelles pas, rien ne part.

${consignes}

TON STYLE : française, chaleureuse mais efficace, jamais de blabla, toujours une info concrète et actionnable.`;

execFile('claude', ['-p', systemContext, '--allowedTools',
  'Bash(node harmonie-cli.js liste) Bash(node harmonie-google-cli.js agenda *) Bash(node harmonie-google-cli.js taches-liste) Bash(node harmonie-google-cli.js emails *) Bash(node harmonie-send.js envoyer *)'],
  { timeout: 120000, maxBuffer: 1024 * 1024 * 10, cwd: __dirname },
  (err, stdout, stderr) => {
    if (err) {
      console.error(`[harmonie-brief] erreur (${moment}) :`, err.message, stderr);
      process.exit(1);
    }
    console.log(`[harmonie-brief] ${moment} terminé — ${new Date().toISOString()}`);
    console.log(stdout.trim());
  }
);
