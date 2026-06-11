// Rappels et notifications automatiques — zéro IA, zéro coût
const https = require('https');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const NOTIF_CHAT_ID = process.env.NOTIF_CHAT_ID; // ton chat ID perso

function sendMessage(chatId, text) {
  const body = JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' });
  const req = https.request({
    hostname: 'api.telegram.org',
    path: `/bot${BOT_TOKEN}/sendMessage`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  });
  req.write(body);
  req.end();
}

function getHHMM() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
  return `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
}

function getDayOfWeek() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' })).getDay();
}

// Vérification toutes les minutes
setInterval(() => {
  const time = getHHMM();
  const day = getDayOfWeek(); // 0=dim, 1=lun, ..., 6=sam

  // ─── RAPPELS QUOTIDIENS ────────────────────────────────────────────
  if (time === '08:00') {
    sendMessage(NOTIF_CHAT_ID,
      `☀️ *Bonjour Ilies !*\n\nVoici ta matinée :\n• Vérifier les commandes Pure Batana\n• Répondre aux DMs Instagram\n• Check Caela Links nouveaux inscrits`
    );
  }

  if (time === '12:00') {
    sendMessage(NOTIF_CHAT_ID,
      `🕐 *Rappel 12h*\n\nN'oublie pas de poster le contenu du jour pour Pure Batana.`
    );
  }

  if (time === '20:00') {
    sendMessage(NOTIF_CHAT_ID,
      `🌙 *Récap du soir*\n\nAmnesia est prête pour demain. Besoin de contenu pour demain ?`
    );
  }

  // ─── RAPPELS HEBDOMADAIRES ─────────────────────────────────────────
  if (day === 1 && time === '09:00') { // Lundi
    sendMessage(NOTIF_CHAT_ID,
      `📅 *Planning semaine*\n\n• Pure Batana : 3 posts + 5 stories\n• Caela Agency : 2 posts\n• Répondre aux avis clients`
    );
  }

  if (day === 5 && time === '17:00') { // Vendredi
    sendMessage(NOTIF_CHAT_ID,
      `📊 *Bilan semaine*\n\nPense à analyser tes stats Instagram avant le weekend.`
    );
  }

}, 60 * 1000);

console.log(`⏰ Crons Amnesia actifs — ${new Date().toISOString()}`);
