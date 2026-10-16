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
