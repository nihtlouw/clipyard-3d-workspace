# 🎬 Tutorial: dari diorama ke pipeline nyata (n8n)

Panduan lengkap menghubungkan CLIPYARD ke n8n. Kontrak data & Floor API sudah
berjalan (lihat `server/README.md`); dokumen ini urutan langkah manusianya.

> **Kondisi template:** semua workflow JSON di folder ini **siap impor tanpa
> kredensial** — node yang butuh key ditandai jelas ("ISI KREDENSIAL") dan
> bisa dilewati dulu untuk menguji alur status. Saklar kredensial ada di
> bagian [Menunggu inputmu](#-menunggu-inputmu--tunda-dulu) di bawah.

---

## 0) Persiapan sekali jalan

**1. Jalankan Floor API & diorama**

```bash
node server/floor-api.mjs        # :8787 — produser state
npm run dev                      # :8080 — diorama (.env.local: VITE_FLOOR_URL=/api/floor)
bash server/demo-episode.sh      # uji loop penuh TANPA n8n (termasuk approval!)
```

Demo script akan **berhenti di gerbang approval** — buka diorama di
`/hq`, panel **APPROVAL INBOX** muncul kanan-bawah, klik **Setujui** → script
lanjut sendiri sampai BOLT ship + stats naik. Kalau ini jalan, seluruh
infrastruktur kamu sehat.

**2. Akses dari n8n**

- n8n self-host satu mesin → langsung `http://127.0.0.1:8787`.
- n8n Cloud / mesin lain → ekspos API: `cloudflared tunnel --url http://localhost:8787`
  (atau ngrok / deploy `floor-api.mjs` ke VPS — file-nya zero-dependency).
- Produksi: `CLIPYARD_FLOOR_TOKEN="token-kuat" node server/floor-api.mjs`,
  dan (opsional) `CLIPYARD_STATE_FILE=/var/lib/clipyard/state.json` agar state
  selamat dari restart.

**3. Impor template**

n8n → Workflows → **Import from File**, masukkan semua file di `server/n8n/`:

| File | Fungsi | Kredensial? |
|---|---|---|
| `akira-intake.workflow.json` | Episode baru → 6 job `queued` → trigger HOOK | ❌ |
| `hook-stage.workflow.json` | Webhook → RUNNING → **LLM** → parse → DONE | ⏸ isi LLM |
| `approval-gate.workflow.json` | NOVA: proses → gerbang approval → resume via keputusan diorama | ❌ |
| `bolt-ship.workflow.json` | Render API → upload YouTube → DONE → stats | ⏸ isi render+OAuth |
| `error-handler.workflow.json` | Semua workflow gagal → auto `failed` (lampu merah diorama) | ❌ |

**Ganti di semua workflow:** `http://127.0.0.1:8787` → URL API-mu, dan
`clipyard-dev-token` → `CLIPYARD_FLOOR_TOKEN`-mu.

---

## 1) HOOK + LLM asli

1. Impor `hook-stage.workflow.json` → node **`LLM: write hooks`** → Credential
   → **New → Header Auth**: `Authorization: Bearer sk-…` (OpenAI) — atau ganti
   URL ke Anthropic / Groq / OpenRouter (tabel di `server/README.md`).
2. Node LLM → Settings → **Retry on Fail** 3× (2000 ms); **on Error** → HTTP
   Request `POST /api/n8n/job` dengan `status:"failed"` (lihat template note).
3. Toggle **Active** → webhook: `POST https://<n8n>/webhook/clipyard/hook`:

```bash
curl -X POST https://<n8n>/webhook/clipyard/hook -H 'Content-Type: application/json' \
  -d '{"episodeId":302,"title":"Cara daftar UMKM online","transcript":"…"}'
```

4. Dalam ±2 dtk kartu HOOK di diorama menampilkan job RUNNING → DONE asli.
   Biaya hemat: transcript dipotong 3 rbu karakter, `gpt-4o-mini`, max_tokens eksplisit.

---

## 2) Stage berat — NOVA / LEXA / BOLT

Video **tidak bisa dirender di dalam n8n** → n8n = orchestrator, media =
worker. Pola yang dipakai template:

- **NOVA** (`approval-gate.workflow.json`): ganti node `Render` dengan
  Execute Command (self-host + ffmpeg: `silencedetect` → cut per segmen;
  update `progress` per batch via **Split In Batches**) atau render API.
- **LEXA**: Whisper (OpenAI `whisper-1` / Groq `whisper-large-v3-turbo`)
  → Code node: segmen → SRT karaoke → burn-in ffmpeg
  (`subtitles=captions.srt:force_style=…`) atau fitur caption render API.
- **BOLT** (`bolt-ship.workflow.json`): submit render → `Wait` 20 dtk →
  cek status (loop) → **YouTube node** (OAuth2) / HTTP TikTok → DONE →
  `POST /api/n8n/stats` (ticker naik live 🎉).

Pilihan render API: **Creatomate** / **Shotstack** / **JSON2Video** — semuanya
pattern sama: submit → `render_id` → poll status. (⏸ butuh API key — tunda.)

---

## 3) Approval human-in-the-loop (dijalankan DI DALAM diorama)

Cara kerjanya sudah terbangun end-to-end:

```
workflow n8n ──POST /api/n8n/approvals──▶ Floor API ──approvals[]──▶ DIORAMA
   ▲ (pause di node Wait)                                      [Setujui/Tolak]
   └────────POST {decision} ke callbackUrl ◀──POST /api/approvals/{id}/decision
```

1. Impor `approval-gate.workflow.json`.
2. Node **`Wait for decision`** → klik → tab **Webhook** → salin *Production
   URL* (ini Resume URL).
3. Tempel URL itu ke field `callbackUrl` di node **`Open approval gate`**.
4. Aktifkan. Saat pipeline sampai gerbang: diorama menampilkan panel amber
   **APPROVAL INBOX** (ada badge counter, chip agen jadi **WAITING OK**, ring
   amber di lantai 3D). Klik **Setujui/Tolak** → Floor API POST ke callback →
   node Wait resume → cabang `Approved?` lanjut / rework. Reject → job `failed`
   (ring merah), dan merahnya hilang otomatis saat job berikutnya jalan.

Tanpa diorama pun bisa: `curl -X POST .../api/approvals/{id}/decision -d '{"decision":"approved"}'`.

---

## 4) Intake AKIRA + pengaman global

- `akira-intake.workflow.json`: satu episode masuk → 6 job `queued` (sofa
  antrian di diorama = antrian nyata) → trigger webhook HOOK.
- `error-handler.workflow.json`: set sebagai **Settings → Error Workflow** di
  setiap workflow stage — workflow mana pun yang crash otomatis menyalakan
  lampu merah di diorama dengan judul errornya.

---

## ✅ Checklist go-live

- [ ] `CLIPYARD_FLOOR_TOKEN` kuat + Floor API ter-ekspos HTTPS
- [ ] Error workflow terpasang di semua stage
- [ ] Retry: LLM 3×, HTTP Floor API 3× (idempotent — upsert by jobId)
- [ ] `CLIPYARD_STATE_FILE` diaktifkan (state selamat restart)
- [ ] Monitor: `GET /api/health` + badge `LIVE·STALE` di diorama sebagai alarm

## ⏸ Menunggu inputmu (tunda dulu — infrastruktur sudah berdiri)

| Saklar | Dipakai di | Catatan |
|---|---|---|
| API key LLM | node `LLM: write hooks` | OpenAI / Groq / OpenRouter — Header Auth |
| Render API key | `bolt-ship` (Creatomate/Shotstack/JSON2Video) | submit→poll pattern |
| YouTube OAuth2 | node `YouTube upload` | n8n OAuth; atau TikTok/IG HTTP |
| Telegram/Slack bot (opsional) | notifikasi approval keluar-diorama | inbox diorama sudah cukup tanpa ini |
| Token produksi + URL publik | semua workflow | ganti `clipyard-dev-token` |

Semua yang lain — kontrak, API, inbox approval, template, demo — **sudah
jalan dan teruji tanpa satu pun kredensial**.
