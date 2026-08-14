#!/usr/bin/env node
// CLI dédié à l'envoi PROACTIF (brief du matin, bilan du soir, alerte email —
// tout ce qui part sans qu'Ilies ait écrit à Harmonie). Séparé de harmonie.js
// (qui répond à ses messages) pour que --allowedTools reste précis : un
// script déclenché par n8n n'a besoin QUE du droit d'envoyer, pas de lire/
// écrire ses tâches ou son agenda directement.
const https = require('https');

const BOT_TOKEN = process.env.HARMONIE_BOT_TOKEN;
const NOTIF_CHAT_ID = process.env.NOTIF_CHAT_ID;

function envoyer(texte) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ chat_id: NOTIF_CHAT_ID, text: texte, parse_mode: 'Markdown' });
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${BOT_TOKEN}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const json = JSON.parse(data);
        if (!json.ok) return reject(new Error(json.description || 'échec envoi Telegram'));
        resolve(json);
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const [, , cmd, texte] = process.argv;

(async () => {
  if (cmd !== 'envoyer' || !texte) {
    console.log('Commande : envoyer "texte"');
    process.exit(1);
  }
  if (!BOT_TOKEN || !NOTIF_CHAT_ID) {
    console.log('Erreur : HARMONIE_BOT_TOKEN ou NOTIF_CHAT_ID absent de l\'environnement.');
    process.exit(1);
  }
  try {
    await envoyer(texte);
    console.log('Envoyé.');
  } catch (e) {
    console.log('Erreur envoi : ' + e.message);
    process.exit(1);
  }
})();
