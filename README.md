# CLIPYARD — 3D AI-Agent Workspace (`/hq`)

Interactive 3D diorama of the CLIPYARD "Autonomous Clip Factory": a warehouse HQ run by
6 AI agents (AKIRA, NOVA, HOOK, LEXA, PIXEL, BOLT) on a 9-to-5 shift, with their
vehicles parked outside. Built with Three.js / React Three Fiber, procedural textures
only (no external 3D assets).

## Provenance (port)

Ported 1:1 from `nihtlouw/bsm-company-profile` (repo history, commit `2e40227b`
"Add CLIPYARD — interactive 3D AI-agent warehouse workspace (/hq)", plus screenshot
refresh `b6a16cfb` and the Vite `allowedHosts` fix `94cf5c44`).

Carried over verbatim:

| Path | Isi |
| --- | --- |
| `src/components/hq/` | `agents.tsx`, `experience.tsx`, `hud.tsx`, `sky.tsx`, `world.tsx` |
| `src/lib/` | `hq-data.ts`, `hq-store.ts`, `hq-textures.ts` (+ `utils.ts` helper `cn`) |
| `src/routes/hq.tsx` | Route `/hq` (TanStack Router file route, `head` meta) |
| `src/styles.css` | Token `--color-hq-*`, keyframes `ticker-scroll`, `.ticker-track` |
| `vite.config.ts` | `allowedHosts: true` untuk preview proxy |
| `screenshots/hq-*.png` | Bukti visual QA dari repo lama |

New in this workspace (minimal host app — the old repo was a full TanStack Start
company site with ERP/auth/DB; CLIPYARD only needs a plain Vite + React SPA):

- `vite.config.ts` (Vite 8 SPA, alias `@/` → `src/`, router plugin, Tailwind v4)
- `src/main.tsx` + `src/routes/__root.tsx` + `src/routes/index.tsx` (`/` redirect → `/hq`)
- `public/favicon.svg`

Dependencies used by the 3D stack (same majors as the source repo): `three`,
`@react-three/fiber`, `@react-three/drei`, `@types/three`, plus `zustand`,
`lucide-react`, `clsx`/`tailwind-merge`, `@tanstack/react-router`.

## Run

```bash
npm install
npm run dev        # 0.0.0.0:8080 — buka /hq (atau /, otomatis redirect)
npm run build      # production build
npm run typecheck  # tsc --noEmit
```

Note: font *Plus Jakarta Sans* dimuat dari Google Fonts; tanpa akses internet font
fallback ke ui-sans-serif (layout tidak berubah).

## Screenshots

`screenshots/hq-*.png` — hasil QA visual di repo asal (desktop day/night, mobile,
nameplates, kartu agen & kendaraan). Screenshot smoke-test port ini tersimpan di
`screenshots/port-check-*.png`.

## Redesign — isometric studio diorama (v2)

Mengacu referensi "cozy isometric studio room": CLIPYARD kini berupa diorama
interior studio putih-lavender dengan:

- Ruangan sudut 2 dinding + tray putih & soft shadow, kamera isometrik terkunci (orbit ter-clamp)
- Jendela skyline kota yang mengikuti sim clock 9–5 (siang/senja/malam, matahari/bulan)
- Rak buku pelangi (instanced), whiteboard "CLIPYARD PIPELINE" live per-agen, jam dinding analog sim time
- 6 maskot hoodie (warna per-agen dari `hq-data.ts`): duduk + ngetik saat shift, hop ke sofa lounge setelah 17:00, blink + squash-and-stretch
- Lounge: sofa navy, karpet bulat, tanaman, speaker, lampu lantai (menyala malam hari)
- Fleet lama tampil sebagai **diecast "CREW GARAGE"** di sideboard — tetap clickable dengan kartu detail
- Tombol **"Suara"**: ambience studio disintesis WebAudio (room hum + ketikan keyboard + ping), default mati
- HUD light-theme (kartu putih, teks navy, chip warna agen) + ticker restyle

Optimalisasi kehalusan: geometri statis di-merge per material (~15 draw call untuk
seluruh statis + instancing untuk buku/daun/roda/mug/bayangan), MeshLambert flat
tanpa postprocessing & fog, tanpa shadow map (blob shadows), canvas texture
di-redraw round-robin (1 layar per 0.5 dtk, whiteboard 2 dtk, skyline per 15
menit sim), `PerformanceMonitor` + `AdaptiveDpr` menurunkan dpr otomatis saat
perangkat berat, kamera ortografis dengan fit-zoom responsif.

Bukti visual: `screenshots/studio-*.png`.

## Fase 1 — data-first (siap sambung n8n)

Diorama kini digerakkan data lewat kontrak `FloorSnapshot`
(`src/lib/hq-jobs.ts`): `jobs[]` per agen (queued/running/done/failed +
progress) dan `stats` lantai. Dua produser di balik interface yang sama
(`src/lib/hq-floor.ts`):

- **SIM (default)** — simulator mock bawaan dengan siklus job realistis
  (queue → running → done, kadang failed, BOLT menaikkan clipsShipped).
- **LIVE** — set `VITE_FLOOR_URL` (lihat `.env.example`) ke endpoint yang
  membalas `FloorSnapshot` JSON (mis. n8n + DB kecil); polling adaptif 2 dtk /
  10 dtk tab-hidden, parser defensif (`sanitizeSnapshot`).

Yang otomatis hidup dari data: whiteboard pipeline, layar monitor tiap hoodie,
task + progress di kartu detail, chip WORKING/LOUNGE/ERROR di roster, ring
agen berubah merah saat job gagal, ticker stats, badge SIM/LIVE di panel jam.
Dokumentasi wiring n8n: `server/README.md`; contoh payload statis:
`public/api/floor.example.json`.

## Fase 2 — Floor API + webhook n8n (loop live nyata)

- `server/floor-api.mjs`: API produser tanpa dependensi di `:8787` —
  `GET /api/floor` (kontrak snapshot), `POST /api/n8n/job` (upsert job dari
  n8n, token), `POST /api/n8n/stats`, `POST /api/n8n/reset`, CORS terbuka.
- Vite mem-proxy `/api` → Floor API; `.env.local` mengaktifkan mode LIVE
  (`VITE_FLOOR_URL=/api/floor`). Badge feed kini sadar kesehatan:
  `LIVE` / `LIVE·STALE` (>15 dtk tanpa snapshot) / `SIM`.
- `server/n8n/hook-stage.workflow.json`: template workflow n8n siap impor
  untuk stage HOOK (webhook → RUNNING → LLM → DONE), plus panduan
  node-by-node di `server/README.md`.

Uji loop end-to-end tanpa n8n: jalankan Floor API + `npm run dev`, lalu
`curl -X POST localhost:8080/api/n8n/job -H 'X-Clipyard-Token: clipyard-dev-token' \
 -d '{"jobId":"hook_EP302","agentId":"hook","status":"running","progress":0.1,...}'`
— dalam ±2 dtk kartu agen/whiteboard menampilkan job itu.
