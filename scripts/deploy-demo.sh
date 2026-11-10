#!/bin/bash
# WBMC — izvietošana uz Cloudflare (workers.dev demo adrese)
# Palaid macOS Terminālī:
#   bash ~/Desktop/"EDDIE WEBS"/CLIENTS/"WOLVES BROTHERHOOD MC"/website/scripts/deploy-demo.sh
#
# Secība: rīki → pieslēgšanās → datubāze → REZERVES KOPIJA → būve → izvietošana → migrācijas → pārbaude.
# Datubāzes tabulas izveido/papildina pats Worker (worker/src/migrations, tikai papildinošas izmaiņas).
set -e
cd "$(dirname "$0")/.."
echo "▶ WBMC — izvietošana"
command -v node >/dev/null || { echo "✖ Vajag Node.js (https://nodejs.org) — instalē un palaid vēlreiz."; exit 1; }

echo "▶ 1/7 Instalē rīkus…"
npm install --no-audit --no-fund --silent

echo "▶ 2/7 Cloudflare pieslēgšanās…"
npx wrangler whoami 2>/dev/null | grep -q "associated with" || npx wrangler login

echo "▶ 3/7 Datubāze (D1)…"
node scripts/setup-d1.mjs

echo "▶ 4/7 Rezerves kopija…"
mkdir -p backups
TS=$(date +%Y%m%d-%H%M%S)
BK="backups/wolves-$TS.sql"
TABLES=$(npx wrangler d1 execute wolves --remote --json --command "SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'sqlite_%'" 2>/dev/null | grep -oE '"n": *[0-9]+' | grep -oE '[0-9]+' || echo 0)
BACKUP_OK=0
if [ "${TABLES:-0}" -gt 0 ]; then
  if npx wrangler d1 export wolves --remote --output "$BK" >/dev/null 2>&1 && [ -s "$BK" ]; then
    BACKUP_OK=1; echo "  ✔ $BK ($(du -h "$BK" | cut -f1))"
  else
    echo "  ✖ Rezerves kopiju izveidot neizdevās."
    read -r -p "  Turpināt bez rezerves kopijas? (j/N) " ans
    [ "$ans" = "j" ] || [ "$ans" = "J" ] || { echo "Pārtraukts."; exit 1; }
  fi
else
  echo "  Datubāze vēl tukša — kopija nav vajadzīga."
fi

echo "▶ 5/7 Būvē lapu (8 valodas)…"
node scripts/build.mjs

echo "▶ 6/7 Izvieto…"
node scripts/demo-config.mjs
npx wrangler deploy --config wrangler.demo.json | tee .deploy.log
URL=$(grep -oE 'https://[a-z0-9.-]+\.workers\.dev' .deploy.log | head -1)

echo "▶ 7/7 Migrācijas un pārbaude…"
if [ -n "$URL" ]; then
  OK=0
  for i in 1 2 3 4 5; do
    if curl -fsS "$URL/api/health" >/dev/null 2>&1; then OK=1; break; fi
    sleep 3
  done
  [ $OK = 1 ] && echo "  ✔ API atbild, datubāze atjaunināta" || echo "  ✖ API neatbild — pārbaudi: npx wrangler tail --config wrangler.demo.json"
  if [ $BACKUP_OK = 1 ]; then
    npx wrangler d1 execute wolves --remote --command "INSERT INTO settings (key, value, updated) VALUES ('last_backup', '{\"at\":$(date +%s)000,\"file\":\"$(basename "$BK")\"}', $(date +%s)000) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated = excluded.updated" >/dev/null 2>&1 || true
  fi
fi
echo ""
echo "✔ Gatavs: $URL"
echo "  Rezerves kopijas: $(pwd)/backups (glabā drošā vietā; satur biedru datus)"
[ -n "$URL" ] && open "$URL" 2>/dev/null || true
