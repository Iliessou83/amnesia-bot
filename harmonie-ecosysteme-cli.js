#!/usr/bin/env node
// Donne à Harmonie une vue lecture seule sur l'écosystème Caela (Nexus,
// Rewards, événements produit, santé des crons) — via UNE fonction Postgres
// dédiée (nexus_ecosystem_summary), pas d'accès direct aux tables. La
// fonction exige un secret (ECOSYSTEME_SECRET) même si elle est techniquement
// appelable avec la clé anon publique : sans le secret, elle refuse
// ("non autorisé"), donc la exposer publiquement dans les autres sites ne
// donne accès à rien. Zéro dépendance npm, même philosophie que le reste.
const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const ECOSYSTEME_SECRET = process.env.ECOSYSTEME_SECRET;

function appelerRPC(fonction, args) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(args);
    const url = new URL(SUPABASE_URL);
    const req = https.request({
      hostname: url.hostname,
      path: `/rest/v1/rpc/${fonction}`,
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function resume() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !ECOSYSTEME_SECRET) {
    console.log('Erreur : SUPABASE_URL, SUPABASE_ANON_KEY ou ECOSYSTEME_SECRET absent de l\'environnement.');
    process.exit(1);
  }
  const r = await appelerRPC('nexus_ecosystem_summary', { p_secret: ECOSYSTEME_SECRET });
  if (r.code) { console.log('Erreur : ' + (r.message || JSON.stringify(r))); return; }

  const lignes = [
    `Événements produit aujourd'hui : ${r.evenements_aujourdhui_total} au total`,
    ...Object.entries(r.evenements_aujourdhui_par_produit || {}).map(([p, n]) => `  - ${p} : ${n}`),
    `Clients actifs (core_accounts) : ${r.clients_actifs}`,
    `Rewards — CA aujourd'hui : ${r.rewards_ca_aujourdhui}€ (${r.rewards_transactions_aujourdhui} transactions)`,
  ];
  const enRetard = r.crons_en_retard || [];
  if (enRetard.length) {
    lignes.push(`⚠️ Crons en retard/jamais vus (${enRetard.length}) :`);
    enRetard.forEach(c => lignes.push(`  - ${c.projet}${c.chemin} — dernière exécution : ${c.derniere_execution || 'jamais'}`));
  } else {
    lignes.push('Crons : tous à jour.');
  }
  console.log(lignes.join('\n'));
}

const [, , cmd] = process.argv;

(async () => {
  try {
    switch (cmd) {
      case 'resume': await resume(); break;
      default:
        console.log('Commande : resume');
        process.exit(1);
    }
  } catch (e) {
    console.log('Erreur : ' + e.message);
    process.exit(1);
  }
})();
