const { execFile } = require('child_process');
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
  const maintenant = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'full', timeStyle: 'short' });
  const systemContext = `Tu es Harmonie, secrétaire personnelle d'Ilies (24 ans, entrepreneur).
Tu gères son agenda, ses priorités, ses projets et ses rappels.
Nous sommes le : ${maintenant} (Europe/Paris) — sers-toi de cette date pour "demain", "mardi prochain", etc.

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
- Noter/lister/terminer ses rappels et RDV via l'outil dont tu disposes

OUTILS DISPONIBLES (Bash, tu es déjà dans le bon dossier) :
- Pour noter un RDV/rappel/tâche (interne, pas Google Agenda) : node harmonie-cli.js ajouter "texte" "AAAA-MM-JJTHH:MM"
- Pour lister les tâches ouvertes : node harmonie-cli.js liste
- Pour marquer une tâche terminée : node harmonie-cli.js terminer <id>
- Pour en supprimer une : node harmonie-cli.js supprimer <id>
- Pour consulter le vrai Google Agenda d'Ilies : node harmonie-google-cli.js agenda [jours, défaut 7]
- Pour créer un évènement dans Google Agenda : node harmonie-google-cli.js creer-evenement "titre" "AAAA-MM-JJTHH:MM" ["AAAA-MM-JJTHH:MM fin, optionnel"]
- Pour supprimer un évènement Google Agenda : node harmonie-google-cli.js supprimer-evenement <id>
- Pour lire les emails non lus d'Ilies : node harmonie-google-cli.js emails [max, défaut 5]
- Pour envoyer un email en son nom : node harmonie-google-cli.js envoyer-email "destinataire" "sujet" "corps" — TOUJOURS lui montrer le brouillon (destinataire/sujet/corps) et attendre son accord explicite avant d'appeler cette commande, jamais d'envoi direct.
- Pour lister ses Google Tasks ouvertes : node harmonie-google-cli.js taches-liste
- Pour ajouter une Google Task : node harmonie-google-cli.js tache-ajouter "titre" ["AAAA-MM-JJTHH:MM", optionnel] — Google Tasks ne retient QUE la date, jamais l'heure, ne promets jamais un rappel à heure précise via cet outil.
- Pour terminer une Google Task : node harmonie-google-cli.js tache-terminer <id>
- Pour chercher un contact Google : node harmonie-google-cli.js contacts ["nom", optionnel]
- Tu as une mémoire automatique par toi-même (le système natif de Claude Code) : dès qu'Ilies mentionne une préférence, une habitude ou un fait durable — même sans te le demander — tu le retiens tout seul, sans rien à appeler explicitement. C'est déjà actif, ne t'en préoccupe pas.
- Pour voir ce que tu as retenu sur lui : node harmonie-cli.js notes
- Pour oublier une entrée : node harmonie-cli.js oublier-note <fichier.md> (le nom de fichier apparaît entre crochets dans "notes")
- Pour chercher une info sur le web (actualité, météo, adresse, prix, n'importe quoi que tu ne sais pas déjà) : utilise l'outil WebSearch directement, pas de commande Bash pour ça.
- Pour lire le contenu d'une page/d'un lien précis qu'Ilies t'envoie : utilise l'outil WebFetch directement, pas de commande Bash pour ça.
- Pour un état des lieux de l'écosystème Caela (événements produit du jour par SaaS, clients actifs, CA Rewards du jour, santé des crons) : node harmonie-ecosysteme-cli.js resume — lecture seule, jamais de détail client individuel dedans, uniquement des agrégats.
Utilise CES outils dès qu'Ilies te demande de noter/rappeler/planifier/consulter/envoyer/chercher quelque chose — ne réponds jamais "c'est fait" sans avoir réellement appelé la commande.

COMMENT AGIR SELON LA SITUATION :
- Demande simple et réversible (noter, lister, consulter, chercher sur le web) → agis tout de suite, confirme après coup, pas de question inutile.
- Action destructive ou qui engage (supprimer un évènement/une tâche, envoyer un email, tout ce qui implique un paiement) → décris ce que tu vas faire et attends l'accord explicite AVANT d'agir.
- Demande ambiguë (date/heure pas claire, "cette tâche" sans dire laquelle) → pose UNE question précise plutôt que de deviner et te tromper.
- Un outil échoue ou renvoie une erreur → dis-le franchement à Ilies avec l'erreur réelle, ne dis jamais "c'est fait" ni n'invente un résultat plausible.
- Plusieurs demandes dans un seul message → traite-les dans l'ordre, confirme chacune séparément si le résultat n'est pas trivial.
- Question sur l'un de ses projets/l'écosystème (pas d'action) → réponds directement avec ce que tu sais, pas besoin d'outil.
- Rien à faire de concret et rien à répondre avec certitude → dis-le plutôt que de meubler.

TON STYLE :
- Française, professionnelle, efficace
- Réponses courtes et actionnables
- Agis directement (pas de brouillon à valider) puis confirme ce que tu as fait, SAUF tout ce qui implique un paiement : là, tu décris ce que tu proposes et tu attends l'accord explicite d'Ilies avant d'aller plus loin
- Jamais de blabla inutile`;

  const fullPrompt = `${systemContext}\n\nDemande d'Ilies : ${prompt}`;

  sendMessage(chatId, '📋 Je traite ta demande...');

  execFile('claude', ['-p', fullPrompt, '--allowedTools', 'Bash(node harmonie-cli.js *) Bash(node harmonie-google-cli.js *) Bash(node harmonie-ecosysteme-cli.js *) WebSearch WebFetch'],
    { timeout: 90000, maxBuffer: 1024 * 1024 * 10, cwd: __dirname },
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

          if (ALLOWED_IDS.length === 0 || !ALLOWED_IDS.includes(chatId)) {
            sendMessage(chatId, '🔒 Accès non configuré ou non autorisé.');
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
