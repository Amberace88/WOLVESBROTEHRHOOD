#!/bin/bash
# Pārstartē lokālo testa serveri: bash scripts/restart-dev.sh <nosaukums> <ports>
NAME=${1:-main}; PORT=${2:-8787}
for p in $(ps -eo pid,args | grep -E " scripts/dev.sh $NAME |\.dev/$NAME/wrangler.json" | grep -v grep | awk '{print $1}'); do kill $p 2>/dev/null; done
for p in $(ps -eo pid,args | grep workerd | grep -v grep | awk '{print $1}'); do ps -o args= -p $p | grep -q "entry=localhost:$PORT" && kill $p; done
sleep 1
cd "$(dirname "$0")/.." && (nohup bash scripts/dev.sh "$NAME" "$PORT" > /tmp/claude-0/dev-$NAME.log 2>&1 &)
for i in $(seq 1 40); do curl -s -m 2 "localhost:$PORT/api/health" >/dev/null && { echo "up :$PORT"; exit 0; }; sleep 2; done; echo "NOT UP"; tail -20 /tmp/claude-0/dev-$NAME.log; exit 1
