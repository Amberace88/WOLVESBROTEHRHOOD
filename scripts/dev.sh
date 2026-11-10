#!/bin/bash
# Lokāla testa vide: bash scripts/dev.sh <nosaukums> <ports>
# Būvē uz .dev/<nosaukums>/dist, palaiž wrangler dev ar atsevišķu lokālo D1/DO stāvokli.
set -e
cd "$(dirname "$0")/.."
NAME=${1:-main}; PORT=${2:-8787}; OUT=.dev/$NAME
mkdir -p "$OUT"
BUILD_OUT="$OUT/dist" node scripts/build.mjs >/dev/null
node -e '
const fs=require("fs");const src=fs.readFileSync("wrangler.jsonc","utf8").replace(/^\s*\/\/.*$/gm,"");const c=JSON.parse(src);
delete c.routes;delete c.$schema;c.workers_dev=true;c.main=require("path").resolve("worker/src/index.js");
c.assets.directory=require("path").resolve(process.argv[1]);c.vars={...(c.vars||{}),ADMIN_EMAIL:"admin@wbmc.test",...(process.env.MFA_KEY?{MFA_KEY:process.env.MFA_KEY}:{})};
fs.writeFileSync(process.argv[2],JSON.stringify(c,null,1));' "$OUT/dist" "$OUT/wrangler.json"
export WRANGLER_SEND_METRICS=false CI=1
exec npx wrangler dev --local --port "$PORT" --config "$OUT/wrangler.json" --persist-to "$OUT/state"
