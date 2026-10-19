import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  FlaskConical,
  PlugZap,
  Save,
  Send,
  XCircle,
} from "lucide-react";
import { DashShell } from "@/components/dash/shell";
import { Field, Panel, btnGhost, btnPrimary, fmtClock, inputCls, relTime } from "@/components/dash/ui";
import { AGENTS, type AgentId } from "@/lib/hq-data";
import {
  testConnection,
  type ConnectionTestResult,
  type ConnectorConfig,
} from "@/lib/hq-connector";
import { applyConnectorConfig, submitJobToFloor } from "@/lib/hq-floor";
import { useHqStore } from "@/lib/hq-store";

export const Route = createFileRoute("/konektor")({
  component: KonektorPage,
});

function KonektorPage() {
  const saved = useHqStore((s) => s.connector);
  const setConnector = useHqStore((s) => s.setConnector);
  const floorSource = useHqStore((s) => s.floorSource);
  const floorUpdatedAt = useHqStore((s) => s.floorUpdatedAt);
  const profiles = useHqStore((s) => s.profiles);
  const pushEvent = useHqStore((s) => s.pushEvent);

  const [cfg, setCfg] = useState<ConnectorConfig>(saved);
  const [showToken, setShowToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<ConnectionTestResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [jobAgent, setJobAgent] = useState<AgentId>("hook");
  const [jobTitle, setJobTitle] = useState("Tulis hook untuk klip terbaru");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; message: string } | null>(null);

  const runTest = async () => {
    setTesting(true);
    setTest(null);
    const r = await testConnection(cfg);
    setTest(r);
    setTesting(false);
  };

  const saveAndApply = () => {
    const clean: ConnectorConfig = {
      mode: cfg.mode,
      floorUrl: cfg.floorUrl.trim() || "/api/floor",
      token: cfg.token.trim(),
      pollSec: Math.min(30, Math.max(1, Math.round(cfg.pollSec) || 2)),
    };
    setCfg(clean);
    setConnector(clean);
    applyConnectorConfig(clean);
    pushEvent(
      clean.mode === "live"
        ? `Konektor pipeline asli diaktifkan → ${clean.floorUrl}`
        : "Konektor kembali ke simulator (SIM)",
      { kind: "system" },
    );
    setNotice(
      clean.mode === "live"
        ? "Tersimpan & diterapkan. Studio sekarang membaca snapshot dari endpoint ini — kembali ke Studio 3D untuk melihat lantai bergerak dari data asli."
        : "Tersimpan & diterapkan. Studio berjalan dengan simulator bawaan.",
    );
  };

  const sendTestJob = async () => {
    setSending(true);
    setSendResult(null);
    const r = await submitJobToFloor(saved, jobAgent, jobTitle);
    setSendResult(r);
    setSending(false);
  };

  return (
    <DashShell
      title="Konektor Pipeline"
      subtitle="Hubungkan studio ke pipeline asli (Floor API yang diberi makan n8n) — tanpa menyentuh file .env."
    >
      {/* status */}
      <Panel title="Status sekarang">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px]">
          <span>
            Sumber lantai:{" "}
            <b className={floorSource === "live" ? "text-emerald-300" : "text-hq-muted"}>
              {floorSource === "live" ? "LIVE — pipeline asli" : "SIM — simulator bawaan"}
            </b>
          </span>
          <span className="text-hq-muted">
            Snapshot terakhir:{" "}
            {floorUpdatedAt ? `${fmtClock(floorUpdatedAt)} (${relTime(floorUpdatedAt)})` : "belum ada"}
          </span>
          <span className="text-hq-muted">
            Endpoint tersimpan: <code className="text-hq-text">{saved.floorUrl}</code> · polling {saved.pollSec} dtk
          </span>
        </div>
      </Panel>

      {/* config form */}
      <Panel title="Konfigurasi koneksi">
        <div className="grid gap-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                {
                  mode: "sim" as const,
                  title: "SIM — Simulator bawaan",
                  desc: "Data demo bergerak sendiri. Cocok untuk mencoba studio tanpa server apa pun.",
                },
                {
                  mode: "live" as const,
                  title: "LIVE — Pipeline asli",
                  desc: "Studio membaca FloorSnapshot dari endpoint di bawah (biasanya Floor API + n8n).",
                },
              ]
            ).map((opt) => (
              <button
                key={opt.mode}
                type="button"
                onClick={() => setCfg((c) => ({ ...c, mode: opt.mode }))}
                className={`rounded-2xl border p-3.5 text-left transition ${
                  cfg.mode === opt.mode
                    ? "border-sky-400/70 bg-sky-400/10"
                    : "border-white/12 bg-white/5 hover:bg-white/8"
                }`}
              >
                <div className="text-[13px] font-extrabold">{opt.title}</div>
                <div className="mt-1 text-[12px] leading-snug text-hq-muted">{opt.desc}</div>
              </button>
            ))}
          </div>

          <Field
            label="URL endpoint snapshot (FloorSnapshot)"
            hint={'Relatif "/api/floor" bekerja lewat proxy Vite ke Floor API lokal (port 8787). Untuk server lain isi URL lengkap, mis. http://localhost:8787/api/floor — pastikan CORS diizinkan.'}
          >
            <input
              className={inputCls}
              value={cfg.floorUrl}
              onChange={(e) => setCfg((c) => ({ ...c, floorUrl: e.target.value }))}
              placeholder="/api/floor"
              inputMode="url"
              disabled={cfg.mode === "sim"}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
            <Field
              label="Token Floor API (X-Clipyard-Token)"
              hint="Dipakai saat mengirim job uji dari panel ini. Disimpan hanya di browser ini. Default pengembangan: clipyard-dev-token."
            >
              <div className="relative">
                <input
                  className={`${inputCls} pr-10`}
                  value={cfg.token}
                  onChange={(e) => setCfg((c) => ({ ...c, token: e.target.value }))}
                  type={showToken ? "text" : "password"}
                  placeholder="clipyard-dev-token"
                  disabled={cfg.mode === "sim"}
                />
                <button
                  type="button"
                  onClick={() => setShowToken((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-hq-muted hover:text-hq-text"
                  aria-label={showToken ? "Sembunyikan token" : "Tampilkan token"}
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
            <Field label="Polling (detik)" hint="Tab tidak aktif otomatis melambat ke 10 detik.">
              <input
                className={inputCls}
                type="number"
                min={1}
                max={30}
                value={cfg.pollSec}
                onChange={(e) => setCfg((c) => ({ ...c, pollSec: Number(e.target.value) }))}
                disabled={cfg.mode === "sim"}
              />
            </Field>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={runTest} disabled={testing} className={btnGhost}>
              <FlaskConical className="h-3.5 w-3.5" /> {testing ? "Menguji…" : "Tes koneksi"}
            </button>
            <button type="button" onClick={saveAndApply} className={btnPrimary}>
              <Save className="h-3.5 w-3.5" /> Simpan & terapkan
            </button>
          </div>

          {test && (
            <div
              className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[12.5px] leading-snug ${
                test.ok
                  ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                  : "border-rose-400/40 bg-rose-400/10 text-rose-200"
              }`}
            >
              {test.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
              <span>{test.message}</span>
            </div>
          )}
          {notice && (
            <div className="rounded-xl border border-sky-400/40 bg-sky-400/10 px-3 py-2.5 text-[12.5px] leading-snug text-sky-200">
              {notice}
            </div>
          )}
        </div>
      </Panel>

      {/* test job */}
      <Panel
        title="Kirim job uji ke lantai"
        action={<PlugZap className="h-4 w-4 text-hq-muted" />}
      >
        <p className="mb-3 text-[12.5px] leading-snug text-hq-muted">
          Memakai konfigurasi <b>yang sudah tersimpan</b>. Mode SIM: job masuk antrean simulator. Mode
          LIVE: terkirim sebagai <code>POST /api/n8n/job</code> — persis seperti yang dilakukan n8n —
          lalu muncul di robot agen tersebut pada polling berikutnya.
        </p>
        <div className="grid gap-3 sm:grid-cols-[200px_1fr_auto]">
          <Field label="Agen">
            <select className={inputCls} value={jobAgent} onChange={(e) => setJobAgent(e.target.value as AgentId)}>
              {AGENTS.map((a) => (
                <option key={a.id} value={a.id}>
                  {profiles[a.id].name} — {profiles[a.id].role}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Judul tugas">
            <input className={inputCls} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} maxLength={80} />
          </Field>
          <div className="flex items-end">
            <button type="button" onClick={sendTestJob} disabled={sending} className={btnPrimary}>
              <Send className="h-3.5 w-3.5" /> {sending ? "Mengirim…" : "Kirim job uji"}
            </button>
          </div>
        </div>
        {sendResult && (
          <div
            className={`mt-3 rounded-xl border px-3 py-2.5 text-[12.5px] ${
              sendResult.ok
                ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                : "border-rose-400/40 bg-rose-400/10 text-rose-200"
            }`}
          >
            {sendResult.message}
          </div>
        )}
      </Panel>

      {/* guide */}
      <Panel title="Panduan menyambungkan pipeline asli (n8n)">
        <ol className="grid gap-2.5 text-[13px] leading-relaxed text-hq-text/90">
          <li>
            <b>1. Jalankan Floor API</b> (server kecil yang sudah ada di repo ini):{" "}
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-[12px]">PORT=8787 FLOOR_TOKEN=clipyard-dev-token node server/floor-api.mjs</code>
          </li>
          <li>
            <b>2. Dari n8n</b>, setiap workflow mengirim perkembangan job ke{" "}
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-[12px]">POST /api/n8n/job</code> dengan header{" "}
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-[12px]">X-Clipyard-Token: &lt;token&gt;</code> dan body:
            <pre className="mt-2 overflow-x-auto rounded-xl bg-black/40 p-3 text-[11.5px] leading-relaxed text-emerald-200">{`{
  "jobId": "render_ep220_c3",
  "agentId": "bolt",
  "title": "Render & ship 4 clips · EP220",
  "status": "running",        // queued | running | done | failed
  "progress": 0.65            // 0..1
}`}</pre>
          </li>
          <li>
            <b>3. Update statistik & approval</b> lewat{" "}
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-[12px]">POST /api/n8n/stats</code> dan{" "}
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-[12px]">POST /api/n8n/approvals</code>.
            Keputusan OK/Tolak dari studio diteruskan balik ke workflow lewat env{" "}
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-[12px]">ON_DECISION_WEBHOOK</code> di Floor API.
          </li>
          <li>
            <b>4. Di panel ini</b>: pilih mode <b>LIVE</b>, URL <code className="rounded bg-white/10 px-1.5 py-0.5 text-[12px]">/api/floor</code>,
            isi token yang sama, klik <b>Tes koneksi</b>, lalu <b>Simpan & terapkan</b>. Badge di studio
            berubah menjadi hijau <b>LIVE</b> dan robot bergerak mengikuti data pipeline asli.
          </li>
          <li className="text-hq-muted">
            Coba cepat dari terminal:{" "}
            <code className="break-all rounded bg-white/10 px-1.5 py-0.5 text-[11px] text-hq-text">
              curl -X POST localhost:8787/api/n8n/job -H "X-Clipyard-Token: clipyard-dev-token" -H "Content-Type: application/json" -d
              '&#123;"jobId":"t1","agentId":"hook","title":"Hook EP220","status":"running","progress":0.4&#125;'
            </code>
          </li>
        </ol>
      </Panel>
    </DashShell>
  );
}
