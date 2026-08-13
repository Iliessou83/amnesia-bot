const { execFile } = require('child_process');
const https = require('https');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_IDS = (process.env.ALLOWED_CHAT_IDS || '').split(',').map(s => s.trim()).filter(Boolean);

let offset = 0;

// ─── Envoyer un message Telegram ───────────────────────────────────────────
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

// ─── Appeler Claude Code (abonnement) ──────────────────────────────────────
function askClaude(prompt, chatId) {
  const systemContext = `Tu es Amnesia, community manager experte de l'écosystème Caela d'Ilies.
Tu connais tous les projets : Pure Batana (cosmétique capillaire), Caela Agency (agence SMMIA),
Caela Links, Dévoile, Ninour, ADON.IA.

CHARTE PURE BATANA : Palette (#18381E vert foncé, #B2DBAF vert d'eau, #CFA66C doré, #F4F1E7 blanc cassé).
Typos : Montserrat Bold (titres CAPS), Raleway (descriptions), Poppins Bold (CTA).
Hiérarchie : Titre → Produit → Bénéfices → CTA → Logo centré bas.
Bénéfices : Anti-casse, Hydrate, Boucles définies, Brillance miroir, Réparation immédiate.

Réponds toujours en français, sois directe et opérationnelle.`;

  const fullPrompt = `${systemContext}\n\nDemande : ${prompt}`;

  sendMessage(chatId, '⏳ Je réfléchis...');

  execFile('claude', ['-p', fullPrompt],
    { timeout: 60000, maxBuffer: 1024 * 1024 * 10 },
    (err, stdout, stderr) => {
      if (err) {
        sendMessage(chatId, `❌ Erreur Claude : ${err.message}`);
        return;
      }
      const response = stdout.trim() || 'Pas de réponse.';
      // Découper si > 4000 chars (limite Telegram)
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

// ─── Polling Telegram ───────────────────────────────────────────────────────
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

          // Vérification accès — fail-closed : une liste vide refuse tout le monde, pas l'inverse
          if (ALLOWED_IDS.length === 0 || !ALLOWED_IDS.includes(chatId)) {
            sendMessage(chatId, '🔒 Accès non configuré ou non autorisé.');
            continue;
          }

          console.log(`[${new Date().toISOString()}] Message de ${chatId}: ${text}`);

          // Commandes système
          if (text === '/start') {
            sendMessage(chatId, `👋 *Amnesia* est en ligne.\n\nJe suis ta community manager IA. Dis-moi ce que tu veux créer pour Pure Batana, Caela Agency ou n'importe quel projet.\n\n_Exemples :_\n• Génère une caption Instagram pour Pure Batana\n• Écris 5 hashtags pour l'huile Batana\n• Crée un script Reel 30 secondes`);
            continue;
          }

          if (text === '/status') {
            sendMessage(chatId, `✅ Bot actif\n🕐 ${new Date().toLocaleString('fr-FR')}`);
            continue;
          }

          // Appel Claude
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

console.log(`🤖 Amnesia Bot démarré — ${new Date().toISOString()}`);
getUpdates();
