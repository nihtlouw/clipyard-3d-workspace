#!/usr/bin/env bash
# =============================================================================
# CLIPYARD demo — satu episode penuh lewat Floor API murni (tanpa n8n/LLM).
# Membuktikan loop end-to-end: routing → cut → APPROVAL (kamu, lewat Approval
# Inbox di diorama) → caption → ship → stats naik.
#
# Pakai:  bash server/demo-episode.sh
# Env:    FLOOR_API   (default http://localhost:8787; atau via vite: :8080)
#         TOKEN       (default clipyard-dev-token)
# Butuh:  curl + python3 (untuk parsing JSON)
# =============================================================================
set -euo pipefail

FLOOR_API="${FLOOR_API:-http://localhost:8787}"
TOKEN="${TOKEN:-clipyard-dev-token}"
EP="${EP:-$((RANDOM % 400 + 500))}"
AUTH=(-H "X-Clipyard-Token: $TOKEN" -H "Content-Type: application/json")

say()  { printf "\n\033[1;36m▶ %s\033[0m\n" "$1"; }
push_job() {
  curl -sS -X POST "$FLOOR_API/api/n8n/job" "${AUTH[@]}" -d "$1" > /dev/null
  echo "   pushed: $1"
}
wait_approval() {
  local id="$1"
  echo "   ⏳ menunggu keputusan manusia…"
  echo "   👉 BUKA DIORAMA (port 8080, /hq) — panel APPROVAL INBOX → klik Setujui/Tolak"
  for _ in $(seq 1 120); do
    local open
    open=$(curl -sS "$FLOOR_API/api/floor" | python3 -c "
import json,sys
d = json.load(sys.stdin)
print(sum(1 for a in d.get('approvals') or [] if a['id'] == '$id'))
")
    if [ "$open" = "0" ]; then echo "   ✔ keputusan diterima, pipeline lanjut"; return 0; fi
    sleep 2
  done
  echo "   ⚠ timeout 4 menit — keluar."; exit 1
}

say "Episode EP$EP — mulai (Floor API: $FLOOR_API)"

say "1/6 AKIRA · routing"
push_job "{\"jobId\":\"akira_EP$EP\",\"agentId\":\"akira\",\"title\":\"Routing EP$EP → 4 clip queues\",\"status\":\"running\",\"progress\":0.2}"
sleep 2; push_job "{\"jobId\":\"akira_EP$EP\",\"status\":\"done\",\"progress\":1,\"title\":\"Routed EP$EP → 4 clip queues\"}"

say "2/6 NOVA · silence-trim"
push_job "{\"jobId\":\"nova_EP$EP\",\"agentId\":\"nova\",\"title\":\"Silence-trim EP$EP · 24 cuts\",\"status\":\"running\",\"progress\":0.15}"
sleep 3; push_job "{\"jobId\":\"nova_EP$EP\",\"status\":\"running\",\"progress\":0.7,\"title\":\"Silence-trim EP$EP · 62% segmen\"}"

say "3/6 NOVA · buka GERBANG APPROVAL"
APR_ID="approval_nova_EP$EP"
curl -sS -X POST "$FLOOR_API/api/n8n/approvals" "${AUTH[@]}" \
  -d "{\"id\":\"$APR_ID\",\"agentId\":\"nova\",\"title\":\"Setujui hasil cut · EP$EP\",\"detail\":\"24 cut, durasi 3×42 dtk — lanjut ke caption & render?\",\"jobId\":\"nova_EP$EP\"}" > /dev/null
echo "   approval dibuka: $APR_ID"
wait_approval "$APR_ID"
push_job "{\"jobId\":\"nova_EP$EP\",\"status\":\"done\",\"progress\":1,\"title\":\"Approved — cut final EP$EP\"}"

say "4/6 LEXA · karaoke caption"
push_job "{\"jobId\":\"lexa_EP$EP\",\"agentId\":\"lexa\",\"title\":\"Karaoke captions ID/EN · EP$EP\",\"status\":\"running\",\"progress\":0.3}"
sleep 3; push_job "{\"jobId\":\"lexa_EP$EP\",\"status\":\"done\",\"progress\":1,\"title\":\"Captions burned · EP$EP (ID/EN)\"}"

say "5/6 BOLT · render + publish"
push_job "{\"jobId\":\"bolt_EP$EP\",\"agentId\":\"bolt\",\"title\":\"Render & ship 4 clips · EP$EP\",\"status\":\"running\",\"progress\":0.25}"
sleep 3; push_job "{\"jobId\":\"bolt_EP$EP\",\"status\":\"running\",\"progress\":0.8,\"title\":\"Uploading 4/4 clips · EP$EP\"}"
sleep 2; push_job "{\"jobId\":\"bolt_EP$EP\",\"status\":\"done\",\"progress\":1,\"title\":\"Shipped 4 clips · EP$EP\"}"

say "6/6 stats naik (ticker & whiteboard diorama ikut bergerak)"
CUR=$(curl -sS "$FLOOR_API/api/floor" | python3 -c "import json,sys; print(json.load(sys.stdin)['stats']['clipsShipped'])")
curl -sS -X POST "$FLOOR_API/api/n8n/stats" "${AUTH[@]}" \
  -d "{\"clipsShipped\": $((CUR + 4)), \"renderQueue\": 0}" > /dev/null
echo "   clipsShipped: $CUR → $((CUR + 4))"

say "SELESAI — snapshot terakhir:"
curl -sS "$FLOOR_API/api/floor" | python3 -c "
import json,sys
d = json.load(sys.stdin)
for j in d['jobs'][:6]:
    print(f\"   {j['agentId']:>6}  {j['status']:<8} {round(j['progress']*100):>3}%  {j['title']}\")
print('   approvals pending:', len(d.get('approvals') or []))
print('   stats:', d['stats'])
"
echo ""
