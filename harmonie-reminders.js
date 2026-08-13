// Rappels des tâches notées via Harmonie — zéro IA, zéro coût, déterministe.
// Ne dépend jamais d'un appel Claude : un rappel raté parce que l'IA a un
// hoquet serait pire qu'un rappel simple et fiable.
const https = require('https');
const store = require('./store');

const BOT_TOKEN = process.env.HARMONIE_BOT_TOKEN;
const NOTIF_CHAT_ID = process.env.NOTIF_CHAT_ID;

function sendMessage(chatId, text) {
  const body = JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' });
  const req = https.request({
    hostname: 'api.telegram.org',
    path: `/bot${BOT_TOKEN}/sendMessage`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  });
  req.on('error', (e) => console.error('[harmonie-reminders] erreur envoi:', e.message));
  req.write(body);
  req.end();
}

setInterval(() => {
  const maintenant = new Date().toISOString();
  const aRappeler = store.tachesARappeler(maintenant);
  for (const t of aRappeler) {
    sendMessage(NOTIF_CHAT_ID, `⏰ *Rappel* — ${t.texte}`);
    store.marquerRappelEnvoye(t.id);
    console.log(`[${new Date().toISOString()}] rappel envoyé : [${t.id}] ${t.texte}`);
  }
}, 60 * 1000);

console.log(`⏰ Rappels Harmonie actifs — ${new Date().toISOString()}`);
