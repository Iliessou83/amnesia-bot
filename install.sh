#!/bin/bash
# ════════════════════════════════════════════════════════
# AMNESIA BOT — Script d'installation VPS Oracle
# Usage : bash install.sh
# ════════════════════════════════════════════════════════

set -e

echo "🤖 Installation Amnesia Bot..."

# ─── 1. Récupérer les tokens ────────────────────────────
read -p "Token Telegram bot Amnesia : " TELEGRAM_TOKEN
read -p "Token Telegram bot Harmonie (peut être le même) : " HARMONIE_TOKEN
read -p "Ton Chat ID Telegram (pour les notifs) : " NOTIF_CHAT_ID
read -p "Chat IDs autorisés (séparés par virgule, JAMAIS vide) : " ALLOWED_IDS

if [ -z "$ALLOWED_IDS" ]; then
  echo "❌ ALLOWED_IDS ne peut pas être vide (l'allow-list est fail-closed : vide = personne n'est autorisé, y compris toi). Relance l'installation."
  exit 1
fi

# ─── 2. Créer le dossier ────────────────────────────────
mkdir -p ~/amnesia-bot
cd ~/amnesia-bot

# ─── 3. Télécharger les fichiers depuis GitHub ──────────
echo "📥 Téléchargement des fichiers..."
curl -sO https://raw.githubusercontent.com/Iliessou83/amnesia-bot/main/bot.js
curl -sO https://raw.githubusercontent.com/Iliessou83/amnesia-bot/main/crons.js
curl -sO https://raw.githubusercontent.com/Iliessou83/amnesia-bot/main/harmonie.js
curl -sO https://raw.githubusercontent.com/Iliessou83/amnesia-bot/main/harmonie-reminders.js
curl -sO https://raw.githubusercontent.com/Iliessou83/amnesia-bot/main/store.js
curl -sO https://raw.githubusercontent.com/Iliessou83/amnesia-bot/main/harmonie-cli.js
mkdir -p data

# ─── 4. Créer le fichier .env ───────────────────────────
cat > .env << EOF
TELEGRAM_BOT_TOKEN=${TELEGRAM_TOKEN}
HARMONIE_BOT_TOKEN=${HARMONIE_TOKEN}
NOTIF_CHAT_ID=${NOTIF_CHAT_ID}
ALLOWED_CHAT_IDS=${ALLOWED_IDS}
EOF
chmod 600 .env

echo "✅ .env créé"

# ─── 5. Installer Claude Code si absent ─────────────────
if ! command -v claude &> /dev/null; then
  echo "📦 Installation Claude Code..."
  npm install -g @anthropic-ai/claude-code
  echo "🔑 Connexion à ton compte Claude.ai..."
  claude auth login
else
  echo "✅ Claude Code déjà installé"
fi

# ─── 6. Service systemd — Bot principal ─────────────────
sudo tee /etc/systemd/system/amnesia-bot.service > /dev/null << EOF
[Unit]
Description=Amnesia Telegram Bot
After=network.target

[Service]
Type=simple
User=${USER}
WorkingDirectory=/home/${USER}/amnesia-bot
EnvironmentFile=/home/${USER}/amnesia-bot/.env
ExecStart=/usr/bin/node /home/${USER}/amnesia-bot/bot.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# ─── 7. Service systemd — Crons ─────────────────────────
sudo tee /etc/systemd/system/amnesia-crons.service > /dev/null << EOF
[Unit]
Description=Amnesia Crons & Rappels
After=network.target

[Service]
Type=simple
User=${USER}
WorkingDirectory=/home/${USER}/amnesia-bot
EnvironmentFile=/home/${USER}/amnesia-bot/.env
ExecStart=/usr/bin/node /home/${USER}/amnesia-bot/crons.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# ─── 7bis. Service systemd — Harmonie (secrétaire) ──────
sudo tee /etc/systemd/system/harmonie-bot.service > /dev/null << EOF
[Unit]
Description=Harmonie Telegram Bot (secrétaire personnelle)
After=network.target

[Service]
Type=simple
User=${USER}
WorkingDirectory=/home/${USER}/amnesia-bot
EnvironmentFile=/home/${USER}/amnesia-bot/.env
ExecStart=/usr/bin/node /home/${USER}/amnesia-bot/harmonie.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# ─── 7ter. Service systemd — Rappels Harmonie (zéro IA) ─
sudo tee /etc/systemd/system/harmonie-reminders.service > /dev/null << EOF
[Unit]
Description=Harmonie Reminders (rappels tâches/RDV, déterministe)
After=network.target

[Service]
Type=simple
User=${USER}
WorkingDirectory=/home/${USER}/amnesia-bot
EnvironmentFile=/home/${USER}/amnesia-bot/.env
ExecStart=/usr/bin/node /home/${USER}/amnesia-bot/harmonie-reminders.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# ─── 8. Démarrage ───────────────────────────────────────
sudo systemctl daemon-reload
sudo systemctl enable amnesia-bot amnesia-crons harmonie-bot harmonie-reminders
sudo systemctl start amnesia-bot amnesia-crons harmonie-bot harmonie-reminders

echo ""
echo "════════════════════════════════════════"
echo "✅ Amnesia Bot + Harmonie déployés avec succès !"
echo ""
echo "Commandes utiles :"
echo "  sudo systemctl status amnesia-bot harmonie-bot harmonie-reminders"
echo "  sudo journalctl -u harmonie-bot -f"
echo "════════════════════════════════════════"
