/**
 * Panel Manajer (Fase 8) — the "boss computer" panel. Opens when the PC on
 * the executive desk in the Ruang Manajer is clicked: a greeting by the
 * real clock, studio summary, pending approvals with decide buttons (the
 * same live data as the inbox — deciding here clears it there), a quick
 * assign form, boss shortcuts, and one-click robot POV.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Crown, Eye, FileText, Send, X } from "lucide-react";
import { decideApproval } from "@/lib/hq-actions";
import { AGENTS, type AgentId } from "@/lib/hq-data";
import { submitJobToFloor } from "@/lib/hq-floor";
import { currentJobFor, type ApprovalRequest } from "@/lib/hq-jobs";
import { agentActivity } from "@/lib/hq-profiles";
import { saveAutoDailyReport } from "@/lib/hq-report";
import { formatShort, isOnShift, tzLabel, useHqStore } from "@/lib/hq-store";
import { cn } from "@/lib/utils";

const AMBER = "#fbbf24";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3.5 text-[9.5px] font-bold tracking-[0.14em] text-hq-muted">{children}</p>
  );
}

export function ManagerPanel({ onClose }: { onClose: () => void }) {
  const profiles = useHqStore((s) => s.profiles);
  const jobs = useHqStore((s) => s.jobs);
  const approvals = useHqStore((s) => s.approvals);
  const stats = useHqStore((s) => s.stats);
  const hour = useHqStore((s) => s.hour);
  const nowTs = useHqStore((s) => s.nowTs);
  const demoShift = useHqStore((s) => s.demoShift);
  const connector = useHqStore((s) => s.connector);
  const floorSource = useHqStore((s) => s.floorSource);
  const setPovAgent = useHqStore((s) => s.setPovAgent);

  const enabledAgents = AGENTS.filter((a) => profiles[a.id]?.enabled !== false);
  const [assignAgent, setAssignAgent] = useState<AgentId>(enabledAgents[0]?.id ?? "akira");
  const [taskTitle, setTaskTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; message: string } | null>(null);
  const [deciding, setDeciding] = useState<string | null>(null);

  const d = new Date(nowTs);
  const period =
    hour >= 4 && hour < 11 ? "pagi" : hour >= 11 && hour < 15 ? "siang" : hour >= 15 && hour < 18.5 ? "sore" : "malam";
  const pad = (n: number) => String(n).padStart(2, "0");
  const clock = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

  const activeCount = demoShift
    ? AGENTS.filter(() => isOnShift(hour)).length
    : AGENTS.filter((a) => {
        const p = profiles[a.id];
        if (!p) return false;
        const act = agentActivity(
          p,
          currentJobFor(a.id, jobs),
          approvals.some((ap) => ap.agentId === a.id),
          hour,
        );
        return act.kind === "kerja" || act.kind === "antre" || act.kind === "minta-ok" || act.kind === "gagal";
      }).length;
  const runningCount = jobs.filter((j) => j.status === "running").length;

  const decide = async (a: ApprovalRequest, decision: "approved" | "rejected") => {
    setDeciding(a.id);
    const r = await decideApproval(a, decision);
    if (!r.ok) setNote({ ok: false, message: r.message ?? "Keputusan gagal terkirim." });
    setDeciding(null);
  };

  const assign = async () => {
    const title = taskTitle.trim();
    if (!title || busy) return;
    setBusy(true);
    setNote(null);
    const r = await submitJobToFloor(connector, assignAgent, title);
    setNote(r);
    if (r.ok) setTaskTitle("");
    setBusy(false);
  };

  const makeReport = () => {
    const title = saveAutoDailyReport(useHqStore.getState());
    useHqStore.getState().pushEvent("Laporan dibuat dari komputer manajer → Dokumen", { kind: "system" });
    setNote({ ok: true, message: `Tersimpan di Dokumen: “${title}”` });
  };

  const miniStat = (label: string, value: string, color?: string) => (
    <div className="rounded-xl bg-hq-line/40 px-2.5 py-2">
      <p className="text-[8.5px] font-bold tracking-[0.12em] text-hq-muted">{label}</p>
      <p className="text-[15px] font-extrabold leading-tight" style={{ color: color ?? "#eef1ff" }}>
        {value}
      </p>
    </div>
  );

  return (
    <div>
      {/* header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f5b45e]/20">
            <Crown className="h-4.5 w-4.5 text-[#f5b45e]" />
          </span>
          <div>
            <p className="text-[13.5px] font-extrabold leading-tight text-hq-text">Ruang Manajer</p>
            <p className="text-[10px] font-semibold text-hq-muted">Komputer bos · sayap timur Bay 7</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-hq-muted transition-colors hover:bg-hq-line/60 hover:text-hq-text"
          aria-label="Tutup panel manajer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <p className="mt-2.5 text-[12px] font-semibold leading-snug text-hq-text">
        Selamat {period}, Bos.{" "}
        <span className="font-medium text-hq-muted">
          {clock} {tzLabel(d)} · {demoShift ? "Mode Demo 9–5 (saklar di panel Waktu Nyata)" : "Mode nyata 24/7"}
        </span>
      </p>

      {/* summary */}
      <div className="mt-2 grid grid-cols-4 gap-1.5">
        {miniStat("AGEN AKTIF", `${activeCount}/6`)}
        {miniStat("JOB JALAN", String(runningCount))}
        {miniStat("MENUNGGU OK", String(approvals.length), approvals.length ? AMBER : undefined)}
        {miniStat("KLIP TERKIRIM", formatShort(stats.clipsShipped))}
      </div>

      {/* approvals — same live list as the inbox */}
      <SectionTitle>PERSETUJUAN MENUNGGU</SectionTitle>
      {approvals.length === 0 ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300">
          <Check className="h-3.5 w-3.5" /> Tidak ada yang menunggu — semua beres.
        </p>
      ) : (
        <div className="mt-1.5 space-y-1.5">
          {approvals.map((a) => {
            const p = profiles[a.agentId];
            return (
              <div key={a.id} className="rounded-xl border border-[#fbbf24]/25 bg-[#fbbf24]/[0.06] p-2.5">
                <p className="flex items-center gap-1.5 text-[9.5px] font-bold tracking-wide" style={{ color: p?.color ?? AMBER }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p?.color ?? AMBER }} />
                  {p?.name ?? a.agentId.toUpperCase()} MINTA OK
                </p>
                <p className="mt-1 line-clamp-2 text-[11px] font-bold leading-snug text-hq-text">{a.title}</p>
                {a.detail && (
                  <p className="mt-0.5 line-clamp-2 text-[10px] font-medium leading-snug text-hq-muted">{a.detail}</p>
                )}
                <div className="mt-2 flex gap-1.5">
                  <button
                    onClick={() => void decide(a, "approved")}
                    disabled={deciding === a.id}
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 py-1.5 text-[10.5px] font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                  >
                    <Check className="h-3 w-3" /> OK, lanjut
                  </button>
                  <button
                    onClick={() => void decide(a, "rejected")}
                    disabled={deciding === a.id}
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-rose-400/40 bg-rose-500/10 py-1.5 text-[10.5px] font-bold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
                  >
                    <X className="h-3 w-3" /> Tolak
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* quick assign */}
      <SectionTitle>BERI TUGAS CEPAT {floorSource === "live" ? "· PIPELINE ASLI" : "· SIMULATOR"}</SectionTitle>
      <div className="mt-1.5 flex gap-1.5">
        <select
          value={assignAgent}
          onChange={(e) => setAssignAgent(e.target.value as AgentId)}
          className="w-[92px] shrink-0 rounded-lg border border-white/10 bg-[#0d1120] px-2 py-2 text-[11px] font-bold text-hq-text outline-none"
          aria-label="Pilih agen"
        >
          {enabledAgents.map((a) => (
            <option key={a.id} value={a.id}>
              {profiles[a.id]?.name ?? a.name}
            </option>
          ))}
        </select>
        <input
          value={taskTitle}
          onChange={(e) => setTaskTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void assign()}
          placeholder="Judul tugas…"
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#0d1120] px-2.5 py-2 text-[11px] font-medium text-hq-text outline-none placeholder:text-hq-muted/70"
        />
        <button
          onClick={() => void assign()}
          disabled={busy || !taskTitle.trim()}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#f5b45e] px-2.5 py-2 text-[11px] font-bold text-[#20160a] transition hover:scale-[1.03] disabled:opacity-50"
        >
          <Send className="h-3 w-3" /> Tugas
        </button>
      </div>

      {/* robot POV */}
      <SectionTitle>LIHAT DARI MATA ROBOT (POV)</SectionTitle>
      <div className="mt-1.5 flex items-center gap-1.5">
        {AGENTS.map((a) => {
          const p = profiles[a.id];
          return (
            <button
              key={a.id}
              onClick={() => setPovAgent(a.id)}
              title={`POV ${p?.name ?? a.name}`}
              aria-label={`POV ${p?.name ?? a.name}`}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-extrabold text-white shadow transition hover:scale-110"
              style={{ backgroundColor: p?.color ?? a.color }}
            >
              {(p?.name ?? a.name).slice(0, 1)}
            </button>
          );
        })}
        <span className="ml-1 inline-flex items-center gap-1 text-[9.5px] font-semibold leading-tight text-hq-muted">
          <Eye className="h-3.5 w-3.5 shrink-0" /> seret untuk menengok
        </span>
      </div>

      {/* boss actions */}
      <div className="mt-3.5 flex flex-wrap gap-1.5">
        <button
          onClick={makeReport}
          className="inline-flex items-center gap-1.5 rounded-lg bg-hq-line/60 px-2.5 py-1.5 text-[10.5px] font-bold text-hq-text transition hover:bg-hq-line"
        >
          <FileText className="h-3.5 w-3.5" /> Buat laporan sekarang
        </button>
        {(
          [
            ["/agen", "Kelola Agen"],
            ["/aktivitas", "Aktivitas"],
            ["/statistik", "Statistik"],
          ] as const
        ).map(([to, label]) => (
          <Link
            key={to}
            to={to}
            className="inline-flex items-center rounded-lg bg-hq-line/60 px-2.5 py-1.5 text-[10.5px] font-bold text-hq-text transition hover:bg-hq-line"
          >
            {label}
          </Link>
        ))}
      </div>

      {note && (
        <p
          className={cn(
            "mt-2.5 rounded-lg px-2.5 py-2 text-[10.5px] font-semibold leading-snug",
            note.ok ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300",
          )}
        >
          {note.message}
        </p>
      )}
    </div>
  );
}
