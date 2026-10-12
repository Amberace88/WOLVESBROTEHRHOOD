#!/bin/bash
# Wolves Brotherhood MC — demo izvietošana uz <nosaukums>.<tavs-subdomēns>.workers.dev
# Palaid macOS Terminālī:  bash ~/Desktop/"WOLVES BROTHERHOOD MC"/website/scripts/deploy-demo.sh
set -e
cd "$(dirname "$0")/.."
echo "▶ Wolves Brotherhood MC — demo izvietošana"
command -v node >/dev/null || { echo "✖ Vajag Node.js (https://nodejs.org) — instalē un palaid vēlreiz."; exit 1; }

echo "▶ 1/6 Instalē rīkus…"
npm install --no-audit --no-fund --silent

echo "▶ 2/6 Cloudflare pieslēgšanās…"
npx wrangler whoami 2>/dev/null | grep -q "associated with" || npx wrangler login

echo "▶ 3/6 Datubāze (D1)…"
node scripts/setup-d1.mjs

echo "▶ 4/6 Tabulas…"
npx wrangler d1 execute wolves --remote --file worker/schema.sql --yes >/dev/null

echo "▶ 5/6 Būvē lapu (8 valodas)…"
node scripts/build.mjs

echo "▶ 6/6 Izvieto…"
node scripts/demo-config.mjs
npx wrangler deploy --config wrangler.demo.json | tee .deploy.log
URL=$(grep -oE 'https://[a-z0-9.-]+\.workers\.dev' .deploy.log | head -1)
echo ""
echo "✔ Gatavs: $URL"
[ -n "$URL" ] && open "$URL" 2>/dev/null || true
