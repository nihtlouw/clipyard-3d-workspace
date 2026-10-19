import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Eraser, Search, X } from "lucide-react";
import { DashShell } from "@/components/dash/shell";
import {
  AgentDot,
  Panel,
  ProgressBar,
  StatTile,
  StatusBadge,
  btnGhost,
  fmtClock,
  inputCls,
  relTime,
} from "@/components/dash/ui";
import { AGENTS } from "@/lib/hq-data";
import { decideApproval } from "@/lib/hq-actions";
import type { FeedEvent } from "@/lib/hq-store";
import { useHqStore } from "@/lib/hq-store";

export const Route = createFileRoute("/aktivitas")({
  component: AktivitasPage,
});

const KIND_LABELS: Record<FeedEvent["kind"], string> = {
  job: "Job",
  ok: "Approval",
  system: "Sistem",
};

function AktivitasPage() {
  const feed = useHqStore((s) => s.feed);
  const jobs = useHqStore((s) => s.jobs);
  const approvals = useHqStore((s) => s.approvals);
  const outputs = useHqStore((s) => s.outputs);
  const actions = useHqStore((s) => s.actions);
  const profiles = useHqStore((s) => s.profiles);
  const clearFeed = useHqStore((s) => s.clearFeed);

  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | FeedEvent["kind"]>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return feed.filter((e) => {
      if (kindFilter !== "all" && e.kind !== kindFilter) return false;
      if (q && !e.text.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [feed, query, kindFilter]);

  const running = jobs.filter((j) => j.status === "running").length;
  const queued = jobs.filter((j) => j.status === "queued").length;
  const failed = jobs.filter((j) => j.status === "failed").length;

  const decide = async (id: string, decision: "approved" | "rejected") => {
    const a = approvals.find((x) => x.id === id);
    if (!a) return;
    setBusy(id);
    setError(null);
    const r = await decideApproval(a, decision);
    if (!r.ok) setError(r.message ?? "Gagal mengirim keputusan.");
    setBusy(null);
  };

  const agentName = (id: string) => profiles[id as keyof typeof profiles]?.name ?? id.toUpperCase();

  return (
    <DashShell
      title="Pemantauan Aktivitas"
      subtitle="Semua kejadian di lantai produksi — job berjalan, approval yang menunggu, dan log aktivitas lengkap."
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Job berlangsung" value={running} sub={`${queued} antre · ${failed} gagal`} />
        <StatTile label="Menunggu OK darimu" value={approvals.length} sub={approvals.length ? "putuskan di panel di bawah" : "tidak ada yang menunggu"} color={approvals.length ? "#fbbf24" : undefined} />
        <StatTile label="Hasil selesai" value={outputs.length} sub="terarsip di browser ini — detail di Statistik" />
        <StatTile label="Aksi tercatat" value={actions.toLocaleString("id-ID")} sub="total event sejak studio dibuka" />
      </div>

      {approvals.length > 0 && (
        <Panel title={`Approval menunggu keputusan (${approvals.length})`}>
          {error && <div className="mb-2 text-[12px] font-semibold text-rose-300">{error}</div>}
          <div className="grid gap-2">
            {approvals.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-400/30 bg-amber-400/[0.06] p-3">
                <AgentDot color={profiles[a.agentId]?.color ?? "#fbbf24"} size={10} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold">{a.title}</div>
                  <div className="text-[12px] text-hq-muted">
                    {agentName(a.agentId)} · diminta {relTime(a.requestedAt)}
                    {a.detail ? ` — ${a.detail}` : ""}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    disabled={busy === a.id}
                    onClick={() => decide(a.id, "approved")}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-[12px] font-bold text-white transition hover:bg-emerald-400 disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" /> OK
                  </button>
                  <button
                    type="button"
                    disabled={busy === a.id}
                    onClick={() => decide(a.id, "rejected")}
                    className="inline-flex items-center gap-1 rounded-lg bg-rose-500/80 px-3 py-1.5 text-[12px] font-bold text-white transition hover:bg-rose-400 disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" /> Tolak
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel title="Job di lantai saat ini">
        {jobs.length === 0 ? (
          <p className="text-[13px] text-hq-muted">Belum ada snapshot job. Buka Studio 3D sebentar atau cek konektor.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.14em] text-hq-muted">
                  <th className="pb-2 pr-3 font-bold">Agen</th>
                  <th className="pb-2 pr-3 font-bold">Tugas</th>
                  <th className="pb-2 pr-3 font-bold">Status</th>
                  <th className="w-[160px] pb-2 pr-3 font-bold">Progres</th>
                  <th className="pb-2 font-bold">Update</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.jobId} className="border-b border-white/5">
                    <td className="py-2 pr-3">
                      <span className="inline-flex items-center gap-1.5 font-bold">
                        <AgentDot color={profiles[j.agentId]?.color ?? "#7a81a6"} />
                        {agentName(j.agentId)}
                      </span>
                    </td>
                    <td className="py-2 pr-3">{j.title}</td>
                    <td className="py-2 pr-3"><StatusBadge status={j.status} /></td>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <ProgressBar value={j.progress} color={profiles[j.agentId]?.color} />
                        <span className="w-9 text-right text-hq-muted">{Math.round(j.progress * 100)}%</span>
                      </div>
                    </td>
                    <td className="py-2 text-hq-muted">{relTime(j.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title={`Log aktivitas (${filtered.length})`}
        action={
          <button type="button" onClick={clearFeed} className={`${btnGhost} px-2.5 py-1 text-[11px]`}>
            <Eraser className="h-3 w-3" /> Bersihkan
          </button>
        }
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-hq-muted" />
            <input
              className={`${inputCls} pl-8`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari di log… (mis. EP214, cover, publish)"
            />
          </div>
          {(["all", "job", "ok", "system"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKindFilter(k)}
              className={`rounded-full px-3 py-1.5 text-[11.5px] font-bold transition ${
                kindFilter === k ? "bg-sky-500 text-white" : "border border-white/12 bg-white/5 text-hq-muted hover:bg-white/10"
              }`}
            >
              {k === "all" ? "Semua" : KIND_LABELS[k]}
            </button>
          ))}
        </div>
        {filtered.length === 0 ? (
          <p className="text-[13px] text-hq-muted">Tidak ada event yang cocok dengan filter.</p>
        ) : (
          <ul className="grid max-h-[520px] gap-1 overflow-y-auto pr-1">
            {filtered.map((e) => (
              <li key={e.id} className="flex items-baseline gap-2.5 rounded-lg px-2 py-1.5 text-[12.5px] hover:bg-white/[0.04]">
                <span className="w-[52px] shrink-0 font-mono text-[11px] text-hq-muted">{fmtClock(e.ts)}</span>
                <span
                  className={`shrink-0 rounded-full px-1.5 py-px text-[9.5px] font-extrabold uppercase tracking-wide ${
                    e.kind === "ok" ? "bg-amber-400/20 text-amber-300" : e.kind === "system" ? "bg-violet-400/20 text-violet-300" : "bg-sky-400/20 text-sky-300"
                  }`}
                >
                  {KIND_LABELS[e.kind]}
                </span>
                {e.color && <AgentDot color={e.color} size={7} />}
                <span className="min-w-0 flex-1">{e.text}</span>
                <span className="shrink-0 text-[11px] text-hq-muted">{relTime(e.ts)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[11px] text-hq-muted">
          Log menampung {feed.length} event terakhir (maks 300) selama tab ini terbuka. Agen:{" "}
          {AGENTS.map((a) => profiles[a.id].name).join(" · ")}.
        </p>
      </Panel>
    </DashShell>
  );
}
