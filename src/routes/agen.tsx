import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Bot, Crosshair, Pencil, RotateCcw } from "lucide-react";
import { AgentForm } from "@/components/dash/agent-form";
import { DashShell } from "@/components/dash/shell";
import { AgentDot, Panel, ProgressBar, StatusBadge, btnGhost } from "@/components/dash/ui";
import { AGENTS, type AgentId } from "@/lib/hq-data";
import { currentJobFor } from "@/lib/hq-jobs";
import { fmtHourLabel } from "@/lib/hq-profiles";
import { useHqStore } from "@/lib/hq-store";

export const Route = createFileRoute("/agen")({
  component: AgenPage,
});

function AgenPage() {
  const profiles = useHqStore((s) => s.profiles);
  const updateProfile = useHqStore((s) => s.updateProfile);
  const resetProfiles = useHqStore((s) => s.resetProfiles);
  const jobs = useHqStore((s) => s.jobs);
  const outputs = useHqStore((s) => s.outputs);
  const select = useHqStore((s) => s.select);
  const pushEvent = useHqStore((s) => s.pushEvent);
  const [editing, setEditing] = useState<AgentId | null>(null);

  return (
    <DashShell
      title="Agen Studio"
      subtitle="Identitas, peran, dan tanggung jawab tiap agen AI. Perubahan langsung tercermin di robot (nama & warna aksen) dan semua panel."
    >
      <Panel
        action={
          <button
            type="button"
            className={btnGhost}
            onClick={() => {
              resetProfiles();
              setEditing(null);
              pushEvent("Semua profil agen direset ke default", { kind: "system" });
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset semua profil
          </button>
        }
        title="Tim lantai produksi"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {AGENTS.map((a) => {
            const p = profiles[a.id];
            const job = currentJobFor(a.id, jobs);
            const doneCount = outputs.filter((o) => o.agentId === a.id).length;
            const isEditing = editing === a.id;
            return (
              <div
                key={a.id}
                className={`rounded-2xl border bg-white/[0.03] p-4 transition ${isEditing ? "md:col-span-2 xl:col-span-3" : ""} ${p.enabled ? "border-white/10" : "border-white/10 opacity-60"}`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-[13px] font-extrabold text-white"
                    style={{ backgroundColor: p.color }}
                  >
                    {p.name.slice(0, 2)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[15px] font-extrabold tracking-wide">{p.name}</span>
                      {!p.enabled && (
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-hq-muted">nonaktif</span>
                      )}
                      {job && <StatusBadge status={job.status} />}
                    </div>
                    <div className="text-[12px] font-bold text-sky-300">{p.role}</div>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Link
                      to="/hq"
                      onClick={() => select({ kind: "agent", id: a.id })}
                      className="rounded-lg border border-white/12 bg-white/5 px-2 py-1.5 text-[11px] font-bold transition hover:bg-white/10"
                      title="Fokus kamera ke robot ini di Studio 3D"
                    >
                      <Crosshair className="h-3.5 w-3.5" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => setEditing(isEditing ? null : a.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/12 bg-white/5 px-2.5 py-1.5 text-[11px] font-bold transition hover:bg-white/10"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Konfig
                    </button>
                  </div>
                </div>

                <p className="mt-2 text-[12px] leading-snug text-hq-muted">{p.tagline}</p>

                <ul className="mt-2.5 grid gap-1">
                  {p.responsibilities.slice(0, 3).map((r, i) => (
                    <li key={i} className="flex gap-1.5 text-[12px] leading-snug">
                      <AgentDot color={p.color} size={6} />
                      <span className="-mt-0.5">{r}</span>
                    </li>
                  ))}
                  {p.responsibilities.length > 3 && (
                    <li className="text-[11px] text-hq-muted">+{p.responsibilities.length - 3} tanggung jawab lain</li>
                  )}
                </ul>

                <div className="mt-3 border-t border-white/8 pt-2.5">
                  {job ? (
                    <>
                      <div className="flex items-center justify-between gap-2 text-[12px]">
                        <span className="truncate font-semibold">{job.title}</span>
                        <span className="shrink-0 text-hq-muted">{Math.round(job.progress * 100)}%</span>
                      </div>
                      <div className="mt-1.5">
                        <ProgressBar value={job.progress} color={p.color} />
                      </div>
                    </>
                  ) : (
                    <div className="text-[12px] text-hq-muted">Tidak ada job aktif saat ini.</div>
                  )}
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-hq-muted">
                    <span>
                      Selesai tercatat: <b className="text-hq-text">{doneCount}</b>
                    </span>
                    <span className="truncate">
                      <Bot className="mr-1 inline h-3 w-3" />
                      {p.model || "—"}
                    </span>
                    <span>
                      Mode:{" "}
                      <b className="text-hq-text">
                        {!p.enabled
                          ? "mati"
                          : p.workMode === "schedule"
                            ? `${fmtHourLabel(p.scheduleStart)}–${fmtHourLabel(p.scheduleEnd)}`
                            : "24/7"}
                      </b>
                    </span>
                    {p.autoApprove && <span className="text-emerald-300">auto-approve</span>}
                  </div>
                </div>

                {isEditing && (
                  <div className="mt-4 border-t border-white/10 pt-4">
                    <AgentForm
                      key={a.id}
                      profile={p}
                      onCancel={() => setEditing(null)}
                      onSave={(patch) => {
                        updateProfile(a.id, patch);
                        setEditing(null);
                        pushEvent(`Profil ${patch.name ?? p.name} diperbarui`, { kind: "system", color: patch.color ?? p.color });
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Panel>
    </DashShell>
  );
}
