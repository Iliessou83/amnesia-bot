#!/usr/bin/env node
// Pont HTTP entre n8n et les scripts Harmonie. Le nœud "Execute Command" de
// n8n n'est pas reconnu sur cette instance (fichier présent dans le paquet,
// mais rejeté par le registre de types au moment d'activer un workflow —
// "Unrecognized node type: n8n-nodes-base.executeCommand", vérifié en direct
// via l'API n8n, pas une limite du MCP). Le nœud HTTP Request, lui, marche.
// Ce petit serveur comble l'écart : n8n l'appelle en HTTP, il lance le
// script Node correspondant en local.
//
// ⚠️ N'écoute QUE sur 127.0.0.1 — jamais 0.0.0.0. n8n tourne sur la même
// machine (localhost:5678), donc pas besoin d'exposer ce port sur internet.
// L'exposer permettrait à n'importe qui de déclencher claude -p (coût,
// spam Telegram) sans authentification.
const http = require('http');
const { execFile } = require('child_process');
const path = require('path');

const PORT = 5680;
const SCRIPTS = {
  '/brief/matin': ['harmonie-brief.js', 'matin'],
  '/brief/soir': ['harmonie-brief.js', 'soir'],
  '/watch/emails': ['harmonie-watch.js'],
};

const server = http.createServer((req, res) => {
  const handler = SCRIPTS[req.url];
  if (!handler) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'route inconnue' }));
    return;
  }

  // Réponse immédiate : claude -p peut prendre 60-120s, on ne fait pas
  // attendre n8n (et son éventuel timeout) pour un aller simple.
  res.writeHead(202, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, lance: handler.join(' ') }));

  const [script, arg] = handler;
  const argv = arg ? [script, arg] : [script];
  execFile('node', argv, { cwd: __dirname, timeout: 150000 }, (err, stdout, stderr) => {
    const horodatage = new Date().toISOString();
    if (err) {
      console.error(`[harmonie-bridge] ${horodatage} erreur ${argv.join(' ')} :`, err.message, stderr);
      return;
    }
    console.log(`[harmonie-bridge] ${horodatage} ${argv.join(' ')} terminé :`, stdout.trim());
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[harmonie-bridge] en écoute sur 127.0.0.1:${PORT} — ${new Date().toISOString()}`);
});
