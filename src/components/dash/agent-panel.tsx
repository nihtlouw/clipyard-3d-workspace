import { useState } from "react";
import {
  Check,
  Crosshair,
  Globe,
  ListChecks,
  Send,
  Settings2,
  Trophy,
  X,
} from "lucide-react";
import { AgentForm } from "@/components/dash/agent-form";
import {
  ProgressBar,
  StatusBadge,
  fmtClock,
  relTime,
} from "@/components/dash/ui";
import { decideApproval } from "@/lib/hq-actions";
import type { AgentId } from "@/lib/hq-data";
import { submitJobToFloor } from "@/lib/hq-floor";
import { useHqStore } from "@/lib/hq-store";

/**
 * The agent work panel (Fase 6) — opens when a robot (or its card) is clicked.
 * "Kerja" tab: live job, pending approvals, completed results, assign a task,
 * trigger the agent's webhook. "Konfig" tab: full identity/responsibility
 * editor. Styled to sit inside the dark HUD (bottom-left).
 */
export function AgentWorkPanel({
  agentId,
  onClose,
}: {
  agentId: AgentId;
  onClose: () => void;
}) {
  const profile = useHqStore((s) => s.profiles[agentId]);
  const jobs = useHqStore((s) => s.jobs);
  const outputs = useHqStore((s) => s.outputs);
  const approvals = useHqStore((s) => s.approvals);
  const connector = useHqStore((s) => s.connector);
  const floorSource = useHqStore((s) => s.floorSource);
  const updateProfile = useHqStore((s) => s.updateProfile);
  const requestFocus = useHqStore((s) => s.requestFocus);
  const pushEvent = useHqStore((s) => s.pushEvent);

  const [tab, setTab] = useState<"kerja" | "konfig">("kerja");
  const [taskTitle, setTaskTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; message: string } | null>(null);
  const [deciding, setDeciding] = useState<string | null>(null);

  if (!profile) return null;

  const myJobs = jobs.filter((j) => j.agentId === agentId);
  const current =
    myJobs.find((j) => j.status === "running") ??
    myJobs.find((j) => j.status === "queued") ??
    myJobs[0];
  const myApprovals = approvals.filter((a) => a.agentId === agentId);
  const myOutputs = outputs.filter((o) => o.agentId === agentId).slice(0, 8);

  const assign = async () => {
    const title = taskTitle.trim();
    if (!title) return;
    setBusy(true);
    setNote(null);
    const r = await submitJobToFloor(connector, agentId, title);
    setNote(r);
    if (r.ok) setTaskTitle("");
    setBusy(false);
  };

  const fireWebhook = async () => {
    if (!profile.webhookUrl) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(profile.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "manual_trigger", agentId, agentName: profile.name, ts: Date.now() }),
      });
      setNote({
        ok: res.ok,
        message: res.ok
          ? `Webhook ${profile.name} terpanggil (HTTP ${res.status}).`
          : `Webhook menjawab HTTP ${res.status}.`,
      });
      if (res.ok) pushEvent(`Webhook ${profile.name} dipicu manual`, { kind: "system", color: profile.color });
    } catch (err) {
      setNote({
        ok: false,
        message: `Gagal memanggil webhook: ${err instanceof Error ? err.message : String(err)} (seringnya CORS — aktifkan “Respond to webhook/CORS” di n8n).`,
      });
    }
    setBusy(false);
  };

  const decide = async (id: string, decision: "approved" | "rejected") => {
    const a = approvals.find((x) => x.id === id);
    if (!a) return;
    setDeciding(id);
    const r = await decideApproval(a, decision);
    if (!r.ok) setNote({ ok: false, message: r.message ?? "Gagal mengirim keputusan." });
    setDeciding(null);
  };

  return (
    <div className="w-full">
      {/* header */}
      <div className="flex items-start gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-[14px] font-extrabold text-white"
          style={{ backgroundColor: profile.color }}
        >
          {profile.name.slice(0, 2)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[16px] font-extrabold tracking-wide text-hq-text">{profile.name}</span>
            {!profile.enabled && (
              <span className="rounded-full bg-white/10 px-2 py-px text-[9.5px] font-extrabold text-hq-muted">NONAKTIF</span>
            )}
            {current && <StatusBadge status={current.status} />}
          </div>
          <div className="text-[12px] font-bold text-sky-300">{profile.role}</div>
          <p className="mt-0.5 text-[11.5px] leading-snug text-hq-muted">{profile.tagline}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-full border border-white/12 bg-white/5 p-1.5 text-hq-muted transition hover:bg-white/10 hover:text-hq-text"
          aria-label="Tutup panel"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* tabs */}
      <div className="mt-3 flex gap-1.5">
        {(
          [
            { id: "kerja" as const, label: "Panel kerja", icon: ListChecks },
            { id: "konfig" as const, label: "Konfigurasi", icon: Settings2 },
          ]
        ).map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-bold transition ${
                tab === t.id ? "bg-sky-500 text-white" : "border border-white/12 bg-white/5 text-hq-muted hover:bg-white/10 hover:text-hq-text"
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={requestFocus}
          className="ml-auto inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/5 px-2.5 py-1.5 text-[11px] font-bold text-hq-muted transition hover:bg-white/10 hover:text-hq-text"
          title="Arahkan kamera ke robot ini"
        >
          <Crosshair className="h-3.5 w-3.5" /> Fokus
        </button>
      </div>

      {tab === "konfig" ? (
        <div className="mt-3 border-t border-white/10 pt-3">
          <AgentForm
            key={agentId}
            profile={profile}
            onCancel={() => setTab("kerja")}
            onSave={(patch) => {
              updateProfile(agentId, patch);
              setTab("kerja");
              pushEvent(`Profil ${patch.name ?? profile.name} diperbarui`, {
                kind: "system",
                color: patch.color ?? profile.color,
              });
              setNote({ ok: true, message: "Konfigurasi tersimpan — nama & warna robot sudah berubah." });
            }}
          />
        </div>
      ) : (
        <div className="mt-3 grid gap-3">
          {/* current job */}
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
            <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-hq-muted">
              Sedang dikerjakan
            </div>
            {current ? (
              <>
                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <span className="min-w-0 flex-1 text-[13px] font-bold leading-snug text-hq-text">{current.title}</span>
                  <span className="shrink-0 text-[11px] font-bold text-hq-muted">
                    {Math.round(current.progress * 100)}%
                  </span>
                </div>
                <div className="mt-1.5">
                  <ProgressBar value={current.progress} color={profile.color} />
                </div>
                <div className="mt-1 text-[11px] text-hq-muted">
                  Update {relTime(current.updatedAt)} · {current.jobId}
                </div>
                {myJobs.length > 1 && (
                  <ul className="mt-2 grid gap-1 border-t border-white/8 pt-2">
                    {myJobs.filter((j) => j.jobId !== current.jobId).map((j) => (
                      <li key={j.jobId} className="flex items-center gap-2 text-[11.5px] text-hq-muted">
                        <StatusBadge status={j.status} />
                        <span className="min-w-0 flex-1 truncate">{j.title}</span>
                        <span>{Math.round(j.progress * 100)}%</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="mt-1 text-[12px] text-hq-muted">
                Tidak ada job aktif — beri tugas lewat form di bawah.
              </p>
            )}
          </div>

          {/* approvals */}
          {myApprovals.length > 0 && (
            <div className="rounded-xl border border-amber-400/30 bg-amber-400/[0.06] p-2.5">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-amber-300">
                Minta persetujuanmu
              </div>
              <div className="mt-1.5 grid gap-2">
                {myApprovals.map((a) => (
                  <div key={a.id} className="rounded-lg bg-black/20 p-2">
                    <div className="text-[12px] font-bold leading-snug text-hq-text">{a.title}</div>
                    {a.detail && <div className="mt-0.5 text-[11px] leading-snug text-hq-muted">{a.detail}</div>}
                    <div className="mt-1.5 flex gap-1.5">
                      <button
                        type="button"
                        disabled={deciding === a.id}
                        onClick={() => decide(a.id, "approved")}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-emerald-400 disabled:opacity-50"
                      >
                        <Check className="h-3 w-3" /> OK
                      </button>
                      <button
                        type="button"
                        disabled={deciding === a.id}
                        onClick={() => decide(a.id, "rejected")}
                        className="inline-flex items-center gap-1 rounded-lg bg-rose-500/80 px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-rose-400 disabled:opacity-50"
                      >
                        <X className="h-3 w-3" /> Tolak
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* completed results */}
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-hq-muted">
              <Trophy className="h-3 w-3" /> Hasil kerja selesai ({myOutputs.length})
            </div>
            {myOutputs.length === 0 ? (
              <p className="mt-1 text-[12px] leading-snug text-hq-muted">
                Belum ada hasil tercatat untuk agen ini — pekerjaan yang selesai akan muncul di sini.
              </p>
            ) : (
              <ul className="mt-1.5 grid gap-1">
                {myOutputs.map((o) => (
                  <li key={o.jobId + o.finishedAt} className="flex items-baseline gap-2 text-[12px]">
                    <span className="shrink-0 font-mono text-[10.5px] text-hq-muted">{fmtClock(o.finishedAt)}</span>
                    <span className="min-w-0 flex-1 truncate text-hq-text/90">{o.title}</span>
                    <span className="shrink-0 text-[10.5px] text-emerald-300">✔</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* responsibilities */}
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-hq-muted">
              Tanggung jawab
            </div>
            <ul className="mt-1 grid gap-0.5">
              {profile.responsibilities.slice(0, 4).map((r, i) => (
                <li key={i} className="text-[12px] leading-snug text-hq-text/85">• {r}</li>
              ))}
            </ul>
            <div className="mt-1 text-[11px] text-hq-muted">
              {profile.model} · {profile.tools}
            </div>
          </div>

          {/* assign task */}
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
            <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-hq-muted">
              Beri tugas baru {floorSource === "live" ? "· ke pipeline asli" : "· ke simulator"}
            </div>
            <div className="mt-2 flex gap-1.5">
              <input
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void assign()}
                placeholder={`mis. Kerjakan untuk ${profile.name}…`}
                maxLength={80}
                className="min-w-0 flex-1 rounded-lg border border-white/12 bg-white/5 px-2.5 py-1.5 text-[12px] text-hq-text outline-none placeholder:text-hq-muted/60 focus:border-sky-400/60"
              />
              <button
                type="button"
                onClick={() => void assign()}
                disabled={busy || !taskTitle.trim()}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-sky-500 px-3 py-1.5 text-[11.5px] font-bold text-white transition hover:bg-sky-400 disabled:opacity-50"
              >
                <Send className="h-3 w-3" /> Kirim
              </button>
            </div>
            {profile.webhookUrl && (
              <button
                type="button"
                onClick={() => void fireWebhook()}
                disabled={busy}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/5 px-2.5 py-1.5 text-[11px] font-bold text-hq-text transition hover:bg-white/10 disabled:opacity-50"
                title={profile.webhookUrl}
              >
                <Globe className="h-3 w-3" /> Picu webhook agen
              </button>
            )}
          </div>

          {note && (
            <div
              className={`rounded-xl border px-3 py-2 text-[11.5px] leading-snug ${
                note.ok
                  ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                  : "border-rose-400/40 bg-rose-400/10 text-rose-200"
              }`}
            >
              {note.message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
