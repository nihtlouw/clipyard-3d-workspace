# Floor API — menghubungkan diorama ke n8n

Diorama membaca snapshot lantai produksi dari satu endpoint GET. Protocol-nya
sengaja super sederhana supaya n8n (atau DB apa pun) bisa menjadi produser
dalam hitungan menit.

```
GET {VITE_FLOOR_URL}  →  200 OK, application/json, body = FloorSnapshot
```

## Kontrak `FloorSnapshot`

```jsonc
{
  "ts": 1792238400000,          // epoch ms saat snapshot dibuat
  "source": "live",             // bebas dipakai; diorama menampilkan "LIVE"
  "jobs": [                     // job terbaru per agen (>= 1 job)
    {
      "jobId": "n8n_exec_10421",   // id stabil (mis. execution id n8n)
      "agentId": "akira",          // akira|nova|hook|lexa|pixel|bolt
      "title": "Routing EP214 → 4 clip queues",
      "status": "running",         // queued|running|done|failed
      "progress": 0.66,            // 0..1
      "updatedAt": 1792238394000   // epoch ms
    }
  ],
  "stats": {
    "clipsShipped": 1284,          // tampil di whiteboard + ticker
    "renderQueue": 2,
    "avgClipSec": 41,
    "channelsFed": 46
  }
}
```

Aturan toleransi parser (`sanitizeSnapshot` di `src/lib/hq-jobs.ts`):

- job dengan `agentId`/`status` di luar daftar **dibuang diam-diam**
- `progress` di-clamp ke 0..1, angka tidak valid → 0
- field stat missing → fallback aman (0 / 42)
- `jobs` kosong atau bukan array → snapshot diabaikan (diorama keep last state)

Referensi payload lengkap: `public/api/floor.example.json`
(boleh langsung dipakai untuk smoke test: `VITE_FLOOR_URL="/api/floor.example.json"`).

## Cara wiring n8n

### Pola A — n8n menulis status, API kecil yang menjawab GET (disarankan)

1. Setiap workflow agen diakhiri node **HTTP Request** / **Postgres** yang
   meng-upsert baris job ke satu tabel (mis. `floor_jobs`).
2. Endpoint GET (Fn/Vercel/Express, ±30 baris) membaca tabel → merakit
   `FloorSnapshot` → mengembalikan JSON di atas.
3. Set `VITE_FLOOR_URL=https://…/api/floor` saat build. Selesai — whiteboard,
   layar monitor, kartu crew, dan ticker otomatis menampilkan job nyata.

### Pola B — n8n langsung menjawab poll (tanpa DB, untuk demo cepat)

- Trigger: **Schedule** (setiap 1 menit) → baca sumber apa pun (Sheet, Notion,
  Data Tables) → node **Respond to Webhook** dengan body `FloorSnapshot`.
- Cocok untuk mock-live; interval poll diorama 2 detik tetap aman karena
  n8n menjawab data terakhir yang diketahui.

### Pola C — push webhook (opsional)

n8n bisa juga POST tiap perubahan job ke endpoint milikmu yang menyimpan
snapshot terakhir di memori/DB; GET tetap jadi konsumsi diorama. Kombinasikan
dengan Pola A.

## Catatan operasional

- **CORS**: endpoint harus mengizinkan origin domain diorama.
- **Auth**: gunakan token di query (?token=…) atau header; browser tidak boleh
  memegang kredensial n8n/LLM.
- **Cadence**: diorama poll 2 dtk (tab terlihat) / 10 dtk (tab hidden). Rate
  limit endpoint pun aman.
- **Failure semantics**: tandai job `failed` — hoodie akan mendapat ring merah,
  chip ERROR di roster, dan monitor merah di meja, lalu dibersihkan otomatis
  begitu job berikutnya masuk.

---

# Fase 2 — Floor API (sudah dibangun)

`server/floor-api.mjs` adalah produser nyata tanpa dependensi: state lantai
disimpan di memori, n8n mendorong perubahan, diorama menarik.

```bash
node server/floor-api.mjs          # 0.0.0.0:8787
CLIPYARD_FLOOR_TOKEN=kuat-aku node server/floor-api.mjs   # produksi
```

Vite sudah mem-proxy `/api` → `127.0.0.1:8787`, dan `.env.local` (gitignored)
berisi `VITE_FLOOR_URL=/api/floor` — jadi `npm run dev` langsung mode LIVE
selama Floor API berjalan. Badge di panel jam: `LIVE` (sehat) / `LIVE·STALE`
(tidak ada snapshot > 15 dtk, mis. API mati) / `SIM` (tanpa env).

## Endpoint

| Method | Path | Auth | Fungsi |
|---|---|---|---|
| GET | `/api/floor` | — | `FloorSnapshot` untuk diorama (poll 2 dtk / 10 dtk hidden) |
| GET | `/api/health` | — | `{ ok, jobs, ts }` |
| POST | `/api/n8n/job` | token | Upsert 1 job (partial ok: `jobId`+`agentId` wajib) |
| POST | `/api/n8n/stats` | token | Merge sebagian `{clipsShipped,renderQueue,avgClipSec,channelsFed}` |
| POST | `/api/n8n/reset` | token | Reseed state demo |
| POST | `/api/n8n/approvals` | token | Buka gerbang approval (human-in-the-loop), `callbackUrl` opsional |
| POST | `/api/approvals/:id/decision` | — (by design) | Keputusan manusia dari Approval Inbox diorama → callback ke n8n |

Auth: header `X-Clipyard-Token` (atau `?token=`). CORS terbuka (`*`) supaya
n8n cloud bisa mendorong; kunci token di produksi.

## Contoh cepat

```bash
# dorong status job (mis. dari node HTTP Request n8n)
curl -X POST http://localhost:8787/api/n8n/job \
  -H 'X-Clipyard-Token: clipyard-dev-token' -H 'Content-Type: application/json' \
  -d '{"jobId":"hook_EP302","agentId":"hook","title":"Drafting hooks · EP302","status":"running","progress":0.1}'

# selesai
curl -X POST http://localhost:8787/api/n8n/job \
  -H 'X-Clipyard-Token: clipyard-dev-token' -H 'Content-Type: application/json' \
  -d '{"jobId":"hook_EP302","status":"done","progress":1,"title":"Drafted 5 hooks · EP302"}'

# stats + verifikasi yang dilihat diorama
curl -X POST http://localhost:8787/api/n8n/stats \
  -H 'X-Clipyard-Token: clipyard-dev-token' -H 'Content-Type: application/json' \
  -d '{"renderQueue":9}'
curl http://localhost:8787/api/floor | head -c 400
```

## Template workflow n8n (stage HOOK)

`server/n8n/hook-stage.workflow.json` — impor ke n8n (Workflows → Import from
File). Isi: Webhook `POST /clipyard/hook` → tandai job RUNNING di Floor API →
LLM (isi kredensial kamu) → parse → tandai DONE. Sticky note di dalamnya
berisi langkah adaptasi (URL API, token, kredensial). Untuk uji cepat tanpa
LLM: hubungkan langsung `Job → RUNNING` ke `Job → DONE`.

## Node-by-node di editor n8n (pola umum)

1. **HTTP Request** (atau node apapun yang menghasilkan status) di akhir tiap
   tahap → `POST /api/n8n/job`, body JSON `{jobId, agentId, title, status,
   progress, updatedAt}`.
2. Mulai tahap → kirim ulang `jobId` yang sama dengan `status:"running"`.
3. Gagal → `status:"failed"` (hoodie dapat ring merah + chip ERROR, layar
   monitor merah; otomatis bersih saat job berikutnya masuk).
4. **HTTP Request** `POST /api/n8n/stats` saat BOLT mem-publish (naikkan
   `clipsShipped`, sesuaikan `renderQueue`).


---

# Fase 3 — Approval gate (human-in-the-loop di dalam diorama)

```bash
# n8n membuka gerbang (token)
curl -X POST http://localhost:8787/api/n8n/approvals \
  -H 'X-Clipyard-Token: clipyard-dev-token' -H 'Content-Type: application/json' \
  -d '{"id":"approval_nova_EP302","agentId":"nova","title":"Setujui hasil cut · EP302",
       "detail":"24 cut — lanjut?","jobId":"nova_EP302",
       "callbackUrl":"https://<n8n>/webhook/clipyard/..."}'

# manusia klik Setujui/Tolak di Approval Inbox diorama (atau curl):
curl -X POST http://localhost:8787/api/approvals/approval_nova_EP302/decision \
  -H 'Content-Type: application/json' -d '{"decision":"approved","note":"gas"}'
# → Floor API POST {approvalId, decision, note, jobId} ke callbackUrl (5 dtk timeout)
#   → node Wait n8n resume
```

Catatan:

- Snapshot `/api/floor` **tidak pernah** menyertakan `callbackUrl` (internal).
- Keputusan tercatat di log server (bounded 100 entri terakhir).
- Endpoint decision sengaja tanpa token supaya bisa dipanggil dari browser
  diorama (same-origin via proxy); dia hanya memengaruhi approval yang
  pending. Di lingkungan hostil, taruh di belakang auth tambahan.
- Job yang bergerak lagi (`status != queued`) otomatis membersihkan approval
  pending dengan `jobId` yang sama.
- Persistensi opsional: `CLIPYARD_STATE_FILE=/path/state.json` — jobs + stats
  + approval pending ditulis debounce 1,5 dtk dan dipulihkan saat boot.
- Demo end-to-end tanpa n8n: `bash server/demo-episode.sh` (berhenti di
  gerbang approval — klik Setujui di diorama).
