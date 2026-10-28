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


---

# 📍 Papan status integrasi

| Blok | Status |
|---|---|
| Kontrak `FloorSnapshot` v1.1 (+ approvals) | ✅ |
| Floor API (jobs/stats/approvals/callback/persist) | ✅ |
| Approval Inbox di dalam diorama (Setujui/Tolak) | ✅ |
| Simulator mock + mode LIVE + badge kesehatan | ✅ |
| Template n8n: intake AKIRA, HOOK, approval gate, BOLT, error handler | ✅ (import-ready, kredensial ditandai) |
| Demo loop end-to-end tanpa n8n (`server/demo-episode.sh`) | ✅ |
| Tutorial lengkap | ✅ `server/n8n/TUTORIAL.md` |

⏸ **Menunggu inputmu (opsional, infrastruktur sudah berdiri):** API key LLM
untuk node HOOK, render-API key untuk BOLT, OAuth YouTube untuk upload, token
Telegram/Slack bila mau notifikasi keluar diorama, dan `CLIPYARD_FLOOR_TOKEN`
produksi + URL publik Floor API. Semua ditandai "ISI KREDENSIAL" di template.


---

# Fase 4 — Open-plan HQ ala dashboard (referensi baru)

Diorama dirombak jadi kantor open-plan penuh mengikuti referensi
"Kantor Virtual HQ": ruangan 28×19 m 4 tembok dengan **smart fade** — tembok
yang menghadang kamera menghilang otomatis (putar 360° bebas), zona baru:

- **Meeting room** (kaca + meja besar + TV live dengan jam sim) — standup
  harian otomatis jam 13:00, seluruh crew pindah ke kursi rapat
- **Boss room** (kaca + meja eksekutif + rak trofi emas)
- **Ruang rehat** (sofa, bantal lantai, mesin vending KOPI 24/7) — tujuan
  crew di luar shift & saat "ngisi token" (job gagal)
- **Pojok kopi** (counter + mesin kopi + kettle), **Render nest** (2 rak
  server dengan LED berkedip), rak buku pelangi, **CREW GARAGE** pindah ke
  dinding selatan, dan **kucing kantor** yang jalan sendiri 🐈

HUD ala dashboard: **aktivitas langsung** (feed live + filter per agen),
**stats grid** (JAM WIB, token keluar/diproses, rapat berikutnya, aksi, sesi
aktif), **backlog panel** (deadline dekat / nunggu owner / ide), **6 agent
cards** bawah (status KERJA/RAPAT/REHAT/WAITING OK/ERROR + tugas + tok/ctx),
kontrol **Otomatis/Terang/Gelap** (override pencahayaan), Label, Auto-sway,
**Sudut awal** (reset kamera), **Layar penuh** (tombol / tombol F).

Kamera kini orbit penuh 360° (pitch & zoom tetap dikunci enak). Nameplate
agen bergaya pill referensi dengan status live: "AKIRA · ng-routing",
"PIXEL · minta OK", "NOVA · nunggu tugas", "BOLT · rehat".

Bukti visual: `screenshots/hq-office-*.png` (siang, malam, standup 13:00,
rotasi 360°).

---

# Fase 4b — Polish interior menyeluruh

Pass detailing + texture + palette di atas open-plan Fase 4:

- **Tekstur**: lantai diganti papan kayu oak prosedural (grain bezier + seam
  gelap + sambungan ujung stagger), rug lounge motif medallion radial, poster
  baru dinding barat (bar chart "CTR +62%" & grid tim AGENTS)
- **Two-tone wall**: band wainscot lembut (#e9e7f6) keliling ruangan — ikut
  smart fade per sisi dindingnya, baseboard putih, trim + frame jendela putih
  dengan sill ledge (tanaman duduk di ambang)
- **Detailing**: pintu kayu MASUK (dinding selatan), sign CLIPYARD navy
  (dinding utara), tirai panel sage/terracotta di jendela utara, kursi ergonomis
  proper (kaki 5-star silver + armrest, shell warna agen), desk divider warna
  agen, trofi emas + brankas steel di boss room, speakerphone ruang meeting,
  kettle + bar stool pojok kopi, kitchen counter wood-top, sofa & kursi cream
  ruang rehat, sideboard navy-top garage
- **Cahaya malam**: pool cahaya hangat + bohlam glow di bawah 5 lampu pendant
  dan 2 lampu berdiri — fade in otomatis mengikuti faktor malam sim
- **Movement**: kecepatan jalan per-agen (rombongan rapat menyebar, tak
  menggerombol di pintu), agen menghadap arah jalan saat bergerak lalu
  menoleh ke pose tujuan saat tiba, ayunan lengan sinkron langkah, kucing
  ekor 2-segmen + pose duduk bernapas

Palet dihangatkan: navy #3a4070 lebih lembut, aksen sage/terracotta/mustard,
krem, wainscot lembut. QA headless hijau (HUD + siang/malam/standup/360°).

### Perbaikan sinkron duduk (laporan user)

- Kursi rapat kini dihitung dari furnitur aslinya: posisi kursi (z 4.62/6.58)
  dan tinggi duduk SEAT_Y 0.68 — agen duduk pas di kursi, tidak lagi
  setengah tenggelam / menempel meja
- Dinding kaca meeting room mendapat **pintu sliding sungguhan** (bukaan
  x 8.55–10.15) + routing agen detour lewat pintu — tidak ada lagi agen
  menembus kaca saat berangkat standup
- Spot lounge dirombak: 2 agen di sofa lounge, 2 di beanbag (sage/terra),
  2 di bantal lantai — sebelumnya 5 spot jatuh DI DALAM meeting room dan
  agen "rehat" nyemplung tembok kaca; tinggi duduk per-spot (`loungeY`)



---

# Fase 5 — Redesign total "glass diorama" (mengikuti referensi)

Seluruh scene dirombak mengikuti render referensi (diorama kantor kaca di
atas latar navy gelap — lihat `preview-redesign.jpg`):

- **Diorama kompak 16×12, 2 dinding saja**: dinding barat berisi 3 jendela
  skyline malam, dinding utara berisi TV meeting + whiteboard pipeline +
  sign CLIPYARD + lampu tripod di sudut apex. Sisi selatan/timur terbuka
  (cutaway), lantai kayu oak hangat di atas slab navy gelap yang melayang.
- **Dua ruang kaca rangka hitam** di sisi timur: meeting room (utara, meja
  6 kursi + TV live) dan ruang rehat (selatan, sofa + beanbag + bantal
  lantai), lengkap dengan pintu geser sungguhan — robot ber-route lewat
  pintu via waypoint queue, tidak menembus kaca.
- **3 pod meja berpasangan** (back-to-back, 6 workstation) + 1 pod hot-desk
  kosong seperti referensi; monitor menghadap penggunanya (punggung monitor
  hitam ke kamera di baris jauh), pedestal abu, kursi abu ergonomis.
- **Robot putih menggantikan hoodie**: helm glossy + visor gelap bermata
  menyala warna agen, ear-cap/antena/ring leher/chest-light warna agen agar
  identitas tetap terbaca dari segala sudut. Diecast CREW GARAGE kini di
  credenza bawah jendela; kucing kantor tetap berkeliaran.
- **Lighting sinematik**: MeshStandardMaterial + ACES tone mapping, satu
  key light dengan soft shadow map, fill hangat dari arah kamera, dan 4
  point light lampu (apex/meeting/lounge/open) yang menyala mengikuti
  faktor malam. Default mode kini **Gelap** agar tampilan pertama = referensi
  (crew tetap on-shift jam 10:30; Terang/Otomatis tetap tersedia).
- **Kamera isometrik terkunci** (azimuth ±38° dari sudut SE, pitch & zoom
  ter-clamp) — tidak ada lagi dinding fading 360°.
- **HUD tema gelap** (panel kaca navy + aksen amber) agar menyatu dengan
  panggung; Approval Inbox dipindah ke kanan-bawah (sebelumnya bisa
  overflow keluar layar). Semua fitur data dipertahankan: FloorSnapshot
  SIM/LIVE n8n, approvals, standup 13:00, feed, ambience opsional.

Denah & konstanta lantai kini terpusat di `src/lib/hq-data.ts`
(`ROOM`, `PODS`, `MEETING_SEATS`, `CREDENZA`) dan dipakai bersama oleh
`world.tsx`, `agents.tsx`, dan `sky.tsx`.

Bukti visual: `screenshots/redesign-glass-*.png` (malam, siang, standup).

Polish 5b: tombol **Sembunyikan UI** (atau tombol `H`) menghilangkan semua
panel untuk tampilan diorama bersih ala referensi (bagus untuk screenshot /
layar tampil) — pill kecil "Tampilkan UI" mengembalikannya; tombol
**Sudut awal** kini juga memulihkan zoom fit responsif, dan tinggi duduk
sofa/bantal lantai di ruang rehat diselaraskan ke furniturnya.
Bukti: `screenshots/redesign-glass-clean*.png` (tanpa HUD, malam & siang —
juga dipakai landing page).

# Fase 6 — Panel konektor pipeline + dasbor kelola + panel kerja agen

Studio kini bisa dioperasikan penuh dari UI, tanpa menyentuh konfigurasi
berbasis berkas:

- **Panel Konektor** (`/konektor`): pilih mode **SIM** (simulator bawaan) atau
  **LIVE** (pipeline asli), isi URL endpoint FloorSnapshot, token
  `X-Clipyard-Token`, dan interval polling → **Tes koneksi** → **Simpan &
  terapkan** (hot-switch, tanpa reload). Ada juga pengirim *job uji* langsung
  ke agen mana pun (`POST /api/n8n/job`, sama seperti n8n) dan panduan
  menyambungkan n8n. `VITE_FLOOR_URL` tetap dihormati sebagai nilai awal.
- **Dasbor kelola** (menu **Kelola** di HUD Studio 3D): **Aktivitas**
  (`/aktivitas` — tabel job live, approval yang bisa di-OK/Tolak langsung,
  log lengkap dengan cari + filter), **Statistik** (`/statistik` — metrik
  pipeline, hasil per agen, arsip hasil kerja), **Laporan** (`/laporan` —
  Markdown otomatis: salin / unduh .md / simpan ke Dokumen), **Dokumen**
  (`/dokumen` — manajer draft caption/hook/SOP dengan status draft→review→
  siap, tag, pencarian), **Agen** (`/agen`), dan **Konektor**. Feed lantai
  berjalan app-wide (diinisiasi di root) sehingga semua halaman live.
- **Panel kerja agen**: klik robot (atau kartu agen) membuka panel dengan tab
  **Panel kerja** (job berjalan + progres, approval pending milik agen itu,
  daftar **hasil kerja selesai**, form **beri tugas baru** yang benar-benar
  masuk ke simulator/pipeline, tombol picu webhook agen) dan tab
  **Konfigurasi**.
- **Identitas agen bisa dikonfigurasi** (tab Konfigurasi / `/agen`): nama,
  jabatan, deskripsi, warna aksen, daftar **tanggung jawab**, model/engine,
  tools, webhook per-agen, status aktif, dan penanda auto-approve. Perubahan
  langsung tercermin di papan nama & aksen robot 3D, kartu HUD, dan semua
  halaman dasbor. Profil, pengaturan konektor, arsip hasil kerja, dan dokumen
  tersimpan di `localStorage` browser (`clipyard.*.v1`).

Bukti visual: `screenshots/fase6-*.png`.

Polish 6b (HUD lebih bersih & ramah): panel kanan (jam sim, approval inbox,
backlog) kini satu rel bertumpuk sehingga tidak pernah saling menimpa;
approval inbox selaras panel lain dengan judul utuh dan tombol lebih lembut;
backlog bisa dilipat; feed Aktivitas Langsung memakai chip satu baris dan
scrollbar tipis gelap (`.hq-scroll`) sehingga label waktu tidak terpotong;
kontrol tampilan atas digabung jadi satu cluster pill; kartu agen menampilkan
progress bar + persentase (menggantikan baris token); label waktu lebih
ramah ("5 mnt"). Bukti: `screenshots/polish-hud-*.png`.

# Fase 7 — Mode kerja agen (24/7 / jadwal / manual) + Mode Demo 9–5

Agen AI tidak lagi "berhenti" mengikuti jam kantor — pekerjaan (job,
progres, approval) memang selalu berjalan 24/7, dan kini tampilannya jujur
soal itu:

- **Mode kerja per agen** (tab Konfigurasi / `/agen`): **Selalu aktif (24/7)**
  — default; **Ikuti jadwal** — jendela jam bebas diatur (mengikuti jam sim,
  bisa melewati tengah malam); saklar **Agen aktif** tetap jadi on/off manual
  penuh. Status nyata agen dihitung satu sumber (`agentActivity` di
  `hq-profiles.ts`): Kerja / Antre / Menunggu OK / Error / Santai /
  Di luar jadwal / Nonaktif, lengkap dengan kalimat alasannya.
- **Saklar "Mode Demo 9–5"** di panel Jam Sim (tersimpan, default menyala):
  menyala = koreografi kantor seperti semula (desk 09–17, standup 13:00,
  ruang rehat setelahnya) murni sebagai demo; mati = **posisi robot adalah
  statusnya** — meja = bekerja, **ruang meeting = menunggu OK darimu**,
  **ruang istirahat = nganggur / di luar jadwal / nonaktif**. Kartu agen,
  tile "AGEN AKTIF", dan narasi feed mengikuti mode yang sama; job yang
  sedang jalan tidak pernah lagi disembunyikan label "REHAT".
- Momen standup 13:00 kini menghasilkan sesuatu: **laporan harian otomatis**
  dibuat dan tersimpan di Dokumen (tag `otomatis`) setiap jam sim melewati
  13:00, dengan throttle waktu-nyata. Pembuat laporan dipindah ke
  `src/lib/hq-report.ts` dan dipakai bersama halaman `/laporan` (kini juga
  memuat kolom Mode kerja).

Catatan: di mode LIVE studio bersifat monitor — penegakan jadwal yang
benar-benar menahan job tetap milik pipeline (n8n); studio menampilkan
status & niat konfigurasinya.

Bukti visual: `screenshots/fase7-*.png` (mode nyata jam 20:00 — agen 24/7
tetap di meja, yang terjadwal/nonaktif di ruang rehat, yang menunggu OK di
ruang meeting; demo standup tetap utuh).

Polish 7b (deduplikasi UI — satu fakta, satu rumah): panel **Backlog**
dihapus karena seluruh isinya dobel ("Deadline dekat" = kartu agen,
"Nunggu owner" = approval inbox tepat di atasnya, "Ide/nanti" = teks
statis); rel kanan kini hanya Jam Sim + Approval Inbox. Tile statistik HUD
6→4 (buang JAM WIB yang ganda dengan panel jam dan tile rapat; AKSI diganti
ANTREAN RENDER); subtitle TopBar tidak lagi mengulang hitungan agen aktif;
chip ON/OFF SHIFT disembunyikan di mode nyata; pill petunjuk melayang di
desktop dihapus (tooltip tombol sudah menjelaskan, versi HP tetap). Di
dasbor: tile "Klip terkirim/Antrean render" yang muncul di dua halaman kini
hanya di /statistik — /aktivitas memakai "Menunggu OK darimu" + "Hasil
selesai" — dan pill "N approval menunggu" di header menjadi tautan ke
/aktivitas. Approval kini punya satu kotak aksi (inbox); sisanya penanda:
chip kartu (status), papan nama/ruang meeting (ambient), badge Kelola
(penghitung), feed (riwayat). Bukti: `screenshots/dedup-*.png` + asersi
terprogram (BACKLOG=0, header inbox=1, JAM WIB=0).

Polish 7c (jam nyata): jam simulasi diganti **waktu lokal browser**. Store
kini disinkronkan `syncClock()` 1×/detik dari `Date` (dulu `tick` per-frame
dengan tombol speed 0.5×/1×/3× + slider scrub — semua kontrol sim dihapus).
Panel "JAM SIM" menjadi **WAKTU NYATA**: HH:MM:SS + label zona
(WIB/WITA/WIT/UTC±n), tanggal Indonesia, pita posisi dalam sehari (amber =
jendela shift demo 09–17, titik = sekarang), label PAGI/SIANG/SORE/MALAM.
Yang kini mengikuti jam sungguhan: langit pagi/Senja/malam, jadwal per-agen
(mode terjadwal), koreografi Demo 9–5, standup + laporan otomatis 13:00,
jam dinding ruang meeting, dan ambience (mode 24/7 tidak lagi senyap di
malam hari; layar dinding/desk di mode nyata mengikuti ada/tidaknya
pekerjaan, bukan jam kantor). Default pencahayaan diubah dari paksa "Gelap"
menjadi "Otomatis" (ikut jam nyata) dan pilihan pencahayaan kini tersimpan
di `clipyard.settings.v1`. Bukti: `screenshots/realtime-*.png` — terpotret
14:18 WIB (zona diemulasi Asia/Jakarta), drift jam store vs `Date` = 0.

Fase 8 (sayap timur + Ruang Manajer + POV robot): lantai diperluas ke
timur (x −8…8 → −8…13,2; konstanta `ROOM.X_MIN/X_MAX/CX/BOSS_X`). Utara
sayap baru = **Ruang Manajer** kaca (masuk dari ruang meeting): meja
eksekutif + kursi bos, monitor ganda live "command deck" (jam nyata,
statistik, banner amber "N menunggu OK"), sofa tamu, rak buku, credenza,
sign RUANG MANAJER. **Klik komputer manajer → Panel Manajer**: sapaan
mengikuti jam nyata, ringkasan studio, approval menunggu dengan tombol
OK/Tolak (data live yang sama dengan inbox), beri tugas cepat ke agen
mana pun, buat laporan sekarang, pintasan halaman Kelola, dan tombol POV
per robot. Selatan sayap baru = ruang istirahat mengalir ke **pantry**
(counter, vending "KOPI 24/7", meja tinggi; beanbag BOLT pindah ke sana).
**Mode POV**: kamera perspektif menempel di kepala robot (registry pose
per-frame di `hq-robots.ts`), ikut berjalan + bob langkah, seret untuk
menengok (batas leher ±137°), lampu visor lembut, overlay visor dengan
status + progress job, ‹ ›/panah untuk pindah robot, Esc keluar (kamera
isometrik pulih utuh). Masuk POV via tombol POV di ViewControls, ikon
mata di kartu agen, atau Panel Manajer. Fokus kamera seleksi agen kini
memakai posisi robot live. Bukti: `screenshots/fase8-*.png` (terpotret
18:24–18:47 WIB — Senja, demo off-shift).

Fase 9 (avatar BOS + POV kursi manajer): sang bos kini punya avatar
sendiri (`boss.tsx`) — robot kerang yang sama seperti kru, tapi tanpa
antena & core dada: diganti **mahkota emas** (band + 4 kerucut + permata
amber yang berdenyut saat ada yang menunggu) dan **dasi merah**. Ia duduk
di kursi eksekutif dan hidup dalam loop kecil: mengetik → ngopi (mug
diangkat dari meja ke visor) → bersandar mengawasi (kepala menyapu
ruangan). Saat ada approval menunggu, ia menoleh ke pintu ruang meeting
dan nameplate-nya berganti "ada yang minta OK!". POV diperluas ke takhta:
`PovId = AgentId | "manager"` (store `povAgent` → `povTarget`), tombol
"Duduk di kursi bos (POV)" di Panel Manajer, target ke-7 di overlay POV
dengan ikon mahkota + peringatan approval. `RobotPose` kini membawa
`pitch` agar pandangan mengikuti anggukan kepala; gestur bos dibekukan
lembut saat jadi host POV. Bukti: `screenshots/fase9-*.png` (terpotret
malam — mode 24/7, pekerjaan nyata yang sama).

Fase 10 (gelembung percakapan): para robot (dan sang BOS) kini sesekali
*berbicara* lewat gelembung kecil di atas kepala (`hq-bubbles.ts` +
`bubbles.tsx`; drei `Html` mengikuti registry pose per frame). Dua jenis
dialog — **peristiwa**: job selesai ("Kelar!"), gagal ("Error nih!"),
mulai ("Siap, mulai!"), minta OK ("Bos, minta OK!" — dijawab bos "Ada
yang minta OK?" sedetik kemudian), selesai diputuskan ("Siap, lanjut!");
dan **ambient** sesuai aktivitas nyata `agentActivity` (kerja: "Fokus
dulu…" atau judul job + %; santai: "Ngopi dulu"; antre; di luar jadwal:
"Zzz…"). Maksimal 2 gelembung ambient bersamaan (total 3), cooldown per
pembicara 24–40 dtk, ikon Lucide + border warna pembicara, nada
biasa/sukses/error/peringatan; gelembung milik host POV disembunyikan.
Murni kosmetik — tidak memengaruhi robot. Bukti:
`screenshots/fase10-*.png`.
