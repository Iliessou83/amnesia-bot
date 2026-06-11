const { exec } = require('child_process');
const https = require('https');

const BOT_TOKEN = process.env.HARMONIE_BOT_TOKEN;
const ALLOWED_IDS = (process.env.ALLOWED_CHAT_IDS || '').split(',').map(s => s.trim()).filter(Boolean);

let offset = 0;

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

function askClaude(prompt, chatId) {
  const systemContext = `Tu es Harmonie, secrétaire personnelle d'Ilies (24 ans, entrepreneur).
Tu gères son agenda, ses priorités, ses projets et ses rappels.

SES PROJETS :
- ADON.IA : réseau de closeurs B2B, Sales-as-a-Service
- Caela Agency : agence SMMIA, services 360°
- Pure Batana : cosmétique capillaire naturelle
- Caela Links : page de liens SaaS (Next.js/Supabase)
- Dévoile : bien-être somatique luxe
- Ninour : e-commerce spirituel

TON RÔLE :
- Organiser ses journées et semaines
- Prioriser les tâches par impact
- Suivre les deadlines et relancer si besoin
- Préparer des récaps clairs et actionnables
- Gérer les rappels et les suivis

TON STYLE :
- Française, professionnelle, efficace
- Réponses courtes et actionnables
- Toujours donner une prochaine action concrète
- Jamais de blabla inutile`;

  const fullPrompt = `${systemContext}\n\nDemande d'Ilies : ${prompt}`;

  sendMessage(chatId, '📋 Je traite ta demande...');

  exec(`claude -p "${fullPrompt.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`,
    { timeout: 60000, maxBuffer: 1024 * 1024 * 10 },
    (err, stdout, stderr) => {
      if (err) {
        sendMessage(chatId, `❌ Erreur : ${err.message}`);
        return;
      }
      const response = stdout.trim() || 'Pas de réponse.';
      if (response.length > 4000) {
        for (let i = 0; i < response.length; i += 4000) {
          sendMessage(chatId, response.slice(i, i + 4000));
        }
      } else {
        sendMessage(chatId, response);
      }
    }
  );
}

function getUpdates() {
  const req = https.request({
    hostname: 'api.telegram.org',
    path: `/bot${BOT_TOKEN}/getUpdates?offset=${offset}&timeout=30`,
    method: 'GET'
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        if (!json.ok) return setTimeout(getUpdates, 3000);

        for (const update of json.result) {
          offset = update.update_id + 1;
          const msg = update.message;
          if (!msg || !msg.text) continue;

          const chatId = String(msg.chat.id);
          const text = msg.text.trim();

          if (ALLOWED_IDS.length > 0 && !ALLOWED_IDS.includes(chatId)) {
            sendMessage(chatId, '🔒 Accès non autorisé.');
            continue;
          }

          console.log(`[${new Date().toISOString()}] Harmonie — ${chatId}: ${text}`);

          if (text === '/start') {
            sendMessage(chatId, `👋 *Harmonie* est en ligne.\n\nJe suis ta secrétaire personnelle. Je gère ton agenda, tes priorités et tes projets.\n\n_Exemples :_\n• Quelles sont mes priorités du jour ?\n• Résume ce que je dois faire cette semaine\n• Rappelle-moi de contacter X demain\n• Quel est l'état d'avancement de Caela Links ?`);
            continue;
          }

          if (text === '/status') {
            sendMessage(chatId, `✅ Harmonie active\n🕐 ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}`);
            continue;
          }

          askClaude(text, chatId);
        }
      } catch (e) {
        console.error('Erreur parsing:', e.message);
      }
      getUpdates();
    });
  });

  req.on('error', (e) => {
    console.error('Erreur réseau:', e.message);
    setTimeout(getUpdates, 5000);
  });

  req.end();
}

console.log(`🗓 Harmonie Bot démarré — ${new Date().toISOString()}`);
getUpdates();
