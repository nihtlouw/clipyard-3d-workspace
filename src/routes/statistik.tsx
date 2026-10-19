import { createFileRoute } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { DashShell } from "@/components/dash/shell";
import {
  AgentDot,
  Panel,
  ProgressBar,
  StatTile,
  StatusBadge,
  btnGhost,
  fmtClock,
  relTime,
} from "@/components/dash/ui";
import { AGENTS, type AgentId } from "@/lib/hq-data";
import { currentJobFor } from "@/lib/hq-jobs";
import { useHqStore } from "@/lib/hq-store";

export const Route = createFileRoute("/statistik")({
  component: StatistikPage,
});

function StatistikPage() {
  const stats = useHqStore((s) => s.stats);
  const jobs = useHqStore((s) => s.jobs);
  const feed = useHqStore((s) => s.feed);
  const outputs = useHqStore((s) => s.outputs);
  const profiles = useHqStore((s) => s.profiles);
  const clearOutputs = useHqStore((s) => s.clearOutputs);

  const perAgent = (id: AgentId) => {
    const done = outputs.filter((o) => o.agentId === id).length;
    const job = currentJobFor(id, jobs);
    return { done, job };
  };
  const maxDone = Math.max(1, ...AGENTS.map((a) => perAgent(a.id).done));
  const totalDone = outputs.length;

  const mix = {
    job: feed.filter((e) => e.kind === "job").length,
    ok: feed.filter((e) => e.kind === "ok").length,
    system: feed.filter((e) => e.kind === "system").length,
  };
  const mixTotal = Math.max(1, mix.job + mix.ok + mix.system);

  return (
    <DashShell
      title="Statistik Produksi"
      subtitle="Angka lantai dari snapshot pipeline + arsip hasil kerja yang dicatat studio di browser ini."
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label="Klip terkirim" value={stats.clipsShipped.toLocaleString("id-ID")} sub="akumulasi pipeline" />
        <StatTile label="Antrean render" value={stats.renderQueue} sub="job menunggu BOLT" />
        <StatTile label="Rata-rata klip" value={`${stats.avgClipSec} dtk`} sub="durasi hasil akhir" />
        <StatTile label="Channel terisi" value={stats.channelsFed} sub="tujuan publish aktif" />
        <StatTile label="Token keluar" value={(stats.tokensOut ?? 0).toLocaleString("id-ID")} sub="pemakaian LLM tercatat" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={`Hasil selesai per agen (${totalDone})`}>
          <div className="grid gap-3">
            {AGENTS.map((a) => {
              const p = profiles[a.id];
              const { done, job } = perAgent(a.id);
              return (
                <div key={a.id}>
                  <div className="flex items-center gap-2 text-[12.5px]">
                    <AgentDot color={p.color} />
                    <span className="font-extrabold tracking-wide">{p.name}</span>
                    <span className="truncate text-hq-muted">{p.role}</span>
                    <span className="ml-auto shrink-0 font-bold">{done} selesai</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <ProgressBar value={done / maxDone} color={p.color} height={8} />
                    {job && (
                      <span className="shrink-0">
                        <StatusBadge status={job.status} />
                      </span>
                    )}
                  </div>
                  {job && (
                    <div className="mt-1 truncate text-[11.5px] text-hq-muted">
                      Sedang: {job.title} · {Math.round(job.progress * 100)}%
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Komposisi aktivitas (sesi ini)">
          <div className="grid gap-3">
            {(
              [
                { label: "Event job", value: mix.job, color: "#38bdf8" },
                { label: "Approval (minta OK & keputusan)", value: mix.ok, color: "#fbbf24" },
                { label: "Sistem & panel", value: mix.system, color: "#a78bfa" },
              ] as const
            ).map((row) => (
              <div key={row.label}>
                <div className="flex items-center justify-between text-[12.5px]">
                  <span>{row.label}</span>
                  <b>{row.value}</b>
                </div>
                <div className="mt-1.5">
                  <ProgressBar value={row.value / mixTotal} color={row.color} height={8} />
                </div>
              </div>
            ))}
            <p className="text-[11.5px] leading-snug text-hq-muted">
              Dihitung dari log aktivitas yang tersimpan sesi ini (maks 300 event). Angka produksi di atas
              berasal langsung dari snapshot pipeline (SIM atau LIVE).
            </p>
          </div>
        </Panel>
      </div>

      <Panel
        title="Arsip hasil kerja terbaru"
        action={
          outputs.length > 0 ? (
            <button type="button" onClick={clearOutputs} className={`${btnGhost} px-2.5 py-1 text-[11px]`}>
              <Trash2 className="h-3 w-3" /> Kosongkan arsip
            </button>
          ) : undefined
        }
      >
        {outputs.length === 0 ? (
          <p className="text-[13px] leading-snug text-hq-muted">
            Belum ada hasil yang selesai tercatat. Biarkan studio berjalan — setiap job yang berstatus{" "}
            <b>selesai</b> akan masuk arsip ini (tersimpan di browser, maksimal 60 entri).
          </p>
        ) : (
          <ul className="grid gap-1">
            {outputs.slice(0, 25).map((o) => (
              <li key={o.jobId + o.finishedAt} className="flex items-baseline gap-2.5 rounded-lg px-2 py-1.5 text-[12.5px] hover:bg-white/[0.04]">
                <span className="w-[52px] shrink-0 font-mono text-[11px] text-hq-muted">{fmtClock(o.finishedAt)}</span>
                <AgentDot color={profiles[o.agentId]?.color ?? "#7a81a6"} size={7} />
                <span className="w-16 shrink-0 font-extrabold tracking-wide">{profiles[o.agentId]?.name ?? o.agentId.toUpperCase()}</span>
                <span className="min-w-0 flex-1 truncate">{o.title}</span>
                <span className="shrink-0 text-[11px] text-hq-muted">{relTime(o.finishedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </DashShell>
  );
}
