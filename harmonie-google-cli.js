#!/usr/bin/env node
// CLI Google (Agenda/Gmail/Tasks) que Harmonie (Claude Code, via --allowedTools
// "Bash(node harmonie-google-cli.js *)") invoque. Zéro dépendance npm — appels
// REST directs, même philosophie que harmonie-cli.js/store.js.
const https = require('https');
const fs = require('fs');
const path = require('path');

const CREDS_PATH = path.join(__dirname, 'google-client-secret.json');
const TOKEN_PATH = path.join(__dirname, 'data', 'google-token.json');

function requeteJSON({ hostname, path: p, method = 'GET', headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path: p, method, headers }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, json: data ? JSON.parse(data) : {} }); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// Rafraîchit systématiquement l'access_token à chaque appel : ce CLI tourne
// une fois par commande (pas un process long-lived), donc pas d'intérêt à
// gérer un cache d'expiration — juste une source d'erreurs de plus.
async function accessTokenFrais() {
  const creds = JSON.parse(fs.readFileSync(CREDS_PATH)).installed;
  const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
  const body = new URLSearchParams({
    client_id: creds.client_id,
    client_secret: creds.client_secret,
    refresh_token: token.refresh_token,
    grant_type: 'refresh_token',
  }).toString();
  const { json } = await requeteJSON({
    hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
    body,
  });
  if (!json.access_token) throw new Error('Impossible de rafraîchir le token Google : ' + JSON.stringify(json));
  return json.access_token;
}

function formatDate(iso) {
  return new Date(iso).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Même bug que harmonie-cli.js (entrée 109 pannes-silencieuses) : une heure
// "21h40" donnée par l'utilisateur doit être interprétée en Europe/Paris, pas
// en UTC brut, avant d'être envoyée à l'API Google.
function versUTC(naive) {
  const aUnDecalage = /Z$|[+-]\d{2}:?\d{2}$/.test(naive);
  if (aUnDecalage) return new Date(naive).toISOString();
  const approx = new Date(naive + 'Z');
  const nomOffset = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', timeZoneName: 'shortOffset' })
    .formatToParts(approx).find(p => p.type === 'timeZoneName').value;
  const heuresOffset = parseInt(nomOffset.replace('GMT', ''), 10) || 0;
  return new Date(approx.getTime() - heuresOffset * 3600000).toISOString();
}

async function agenda(jours = 7) {
  const token = await accessTokenFrais();
  const now = new Date();
  const end = new Date(now.getTime() + jours * 86400000);
  const { json } = await requeteJSON({
    hostname: 'www.googleapis.com',
    path: `/calendar/v3/calendars/primary/events?maxResults=15&singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(now.toISOString())}&timeMax=${encodeURIComponent(end.toISOString())}`,
    headers: { Authorization: 'Bearer ' + token },
  });
  if (json.error) { console.log('Erreur Google Agenda : ' + json.error.message); return; }
  const events = json.items || [];
  if (!events.length) { console.log(`Aucun évènement dans les ${jours} prochains jours.`); return; }
  console.log(events.map(e => `[${e.id}] ${e.start.dateTime ? formatDate(e.start.dateTime) : e.start.date} — ${e.summary}`).join('\n'));
}

async function creerEvenement(titre, debutNaif, finNaif) {
  const token = await accessTokenFrais();
  const debut = versUTC(debutNaif);
  const fin = finNaif ? versUTC(finNaif) : new Date(new Date(debut).getTime() + 3600000).toISOString();
  const body = JSON.stringify({
    summary: titre,
    start: { dateTime: debut, timeZone: 'Europe/Paris' },
    end: { dateTime: fin, timeZone: 'Europe/Paris' },
  });
  const { json } = await requeteJSON({
    hostname: 'www.googleapis.com', path: '/calendar/v3/calendars/primary/events', method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    body,
  });
  if (json.error) { console.log('Erreur création évènement : ' + json.error.message); return; }
  console.log(`Créé [${json.id}] "${json.summary}" — ${formatDate(json.start.dateTime)}`);
}

async function supprimerEvenement(id) {
  const token = await accessTokenFrais();
  const { status } = await requeteJSON({
    hostname: 'www.googleapis.com', path: `/calendar/v3/calendars/primary/events/${id}`, method: 'DELETE',
    headers: { Authorization: 'Bearer ' + token },
  });
  console.log(status === 204 ? `Supprimé : ${id}` : `Erreur suppression (code ${status})`);
}

async function emails(max = 5) {
  const token = await accessTokenFrais();
  const { json: liste } = await requeteJSON({
    hostname: 'www.googleapis.com', path: `/gmail/v1/users/me/messages?maxResults=${max}&q=is:unread`,
    headers: { Authorization: 'Bearer ' + token },
  });
  if (liste.error) { console.log('Erreur Gmail : ' + liste.error.message); return; }
  const msgs = liste.messages || [];
  if (!msgs.length) { console.log('Aucun email non lu.'); return; }
  const details = await Promise.all(msgs.map(async (m) => {
    const { json } = await requeteJSON({
      hostname: 'www.googleapis.com',
      path: `/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
      headers: { Authorization: 'Bearer ' + token },
    });
    const headers = json.payload?.headers || [];
    const get = (n) => headers.find(h => h.name === n)?.value || '';
    return `[${m.id}] ${get('From').split('<')[0].trim()} — ${get('Subject')}`;
  }));
  console.log(details.join('\n'));
}

async function envoyerEmail(destinataire, sujet, corps) {
  const token = await accessTokenFrais();
  const message = [
    `To: ${destinataire}`,
    `Subject: =?UTF-8?B?${Buffer.from(sujet, 'utf8').toString('base64')}?=`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    corps,
  ].join('\n');
  const raw = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const body = JSON.stringify({ raw });
  const { json } = await requeteJSON({
    hostname: 'www.googleapis.com', path: '/gmail/v1/users/me/messages/send', method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    body,
  });
  if (json.error) { console.log('Erreur envoi email : ' + json.error.message); return; }
  console.log(`Envoyé [${json.id}] à ${destinataire}`);
}

async function tachesListe() {
  const token = await accessTokenFrais();
  const { json } = await requeteJSON({
    hostname: 'tasks.googleapis.com', path: '/tasks/v1/lists/@default/tasks?showCompleted=false',
    headers: { Authorization: 'Bearer ' + token },
  });
  if (json.error) { console.log('Erreur Google Tasks : ' + json.error.message); return; }
  const items = json.items || [];
  if (!items.length) { console.log('Aucune tâche Google Tasks ouverte.'); return; }
  const formatJour = (iso) => new Date(iso).toLocaleDateString('fr-FR', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
  console.log(items.map(t => `[${t.id}] ${t.title}${t.due ? ' — échéance ' + formatJour(t.due) : ''}`).join('\n'));
}

// L'API Google Tasks accepte un `due` en RFC3339 mais IGNORE silencieusement
// l'heure : elle stocke toujours minuit UTC, sans erreur ni avertissement.
// Inutile de faire croire à une heure précise — on n'envoie que la date.
async function tacheAjouter(titre, echeanceNaif) {
  const token = await accessTokenFrais();
  const body = JSON.stringify({
    title: titre,
    due: echeanceNaif ? echeanceNaif.slice(0, 10) + 'T00:00:00.000Z' : undefined,
  });
  const { json } = await requeteJSON({
    hostname: 'tasks.googleapis.com', path: '/tasks/v1/lists/@default/tasks', method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    body,
  });
  if (json.error) { console.log('Erreur création tâche : ' + json.error.message); return; }
  console.log(`Créée [${json.id}] "${json.title}"`);
}

async function tacheTerminer(id) {
  const token = await accessTokenFrais();
  const body = JSON.stringify({ status: 'completed' });
  const { json } = await requeteJSON({
    hostname: 'tasks.googleapis.com', path: `/tasks/v1/lists/@default/tasks/${id}`, method: 'PATCH',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    body,
  });
  if (json.error) { console.log('Erreur : ' + json.error.message); return; }
  console.log(`Terminée : ${id}`);
}

// People API searchContacts a besoin d'un cache "chauffé" côté Google, pas fiable
// juste après consentement. On liste les connexions et on filtre nous-mêmes.
async function contacts(recherche) {
  const token = await accessTokenFrais();
  const { json } = await requeteJSON({
    hostname: 'people.googleapis.com',
    path: '/v1/people/me/connections?pageSize=200&personFields=names,emailAddresses,phoneNumbers',
    headers: { Authorization: 'Bearer ' + token },
  });
  if (json.error) { console.log('Erreur Contacts : ' + json.error.message); return; }
  const gens = json.connections || [];
  const aiguille = (recherche || '').toLowerCase();
  const filtres = gens.filter(p => {
    if (!aiguille) return true;
    const nom = (p.names?.[0]?.displayName || '').toLowerCase();
    return nom.includes(aiguille);
  });
  if (!filtres.length) { console.log('Aucun contact trouvé.'); return; }
  console.log(filtres.map(p => {
    const nom = p.names?.[0]?.displayName || '(sans nom)';
    const email = p.emailAddresses?.[0]?.value || '';
    const tel = p.phoneNumbers?.[0]?.value || '';
    return `${nom}${email ? ' — ' + email : ''}${tel ? ' — ' + tel : ''}`;
  }).join('\n'));
}

const [, , cmd, ...args] = process.argv;

(async () => {
  try {
    switch (cmd) {
      case 'agenda': await agenda(args[0] ? parseInt(args[0], 10) : 7); break;
      case 'creer-evenement': await creerEvenement(args[0], args[1], args[2]); break;
      case 'supprimer-evenement': await supprimerEvenement(args[0]); break;
      case 'emails': await emails(args[0] ? parseInt(args[0], 10) : 5); break;
      case 'envoyer-email': await envoyerEmail(args[0], args[1], args[2]); break;
      case 'taches-liste': await tachesListe(); break;
      case 'tache-ajouter': await tacheAjouter(args[0], args[1]); break;
      case 'tache-terminer': await tacheTerminer(args[0]); break;
      case 'contacts': await contacts(args[0]); break;
      default:
        console.log('Commandes : agenda [jours] | creer-evenement "titre" "AAAA-MM-JJTHH:MM" ["fin"] | supprimer-evenement <id> | emails [max] | envoyer-email "destinataire" "sujet" "corps" | taches-liste | tache-ajouter "titre" ["AAAA-MM-JJTHH:MM"] | tache-terminer <id> | contacts ["nom"]');
        process.exit(1);
    }
  } catch (e) {
    console.log('Erreur : ' + e.message);
    process.exit(1);
  }
})();
