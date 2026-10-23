/**
 * POV overlay (Fase 8/9) — the only HUD while riding a head: a subtle
 * visor frame + reticle, the host's identity/status, and prev/next/exit
 * controls. Hosts are the six crew robots plus, since Fase 9, the boss
 * in his manager chair. Esc or ←/→ work from the keyboard.
 */
import { useEffect } from "react";
import { ChevronLeft, ChevronRight, Crown, X } from "lucide-react";
import { AGENTS, MANAGER } from "@/lib/hq-data";
import { currentJobFor } from "@/lib/hq-jobs";
import { agentActivity } from "@/lib/hq-profiles";
import type { PovId } from "@/lib/hq-robots";
import { useHqStore } from "@/lib/hq-store";

const ORDER: PovId[] = [...AGENTS.map((a) => a.id), "manager"];

export function PovOverlay() {
  const povTarget = useHqStore((s) => s.povTarget);
  const setPovTarget = useHqStore((s) => s.setPovTarget);
  const profiles = useHqStore((s) => s.profiles);
  const jobs = useHqStore((s) => s.jobs);
  const approvals = useHqStore((s) => s.approvals);
  const hour = useHqStore((s) => s.hour);
  const demoShift = useHqStore((s) => s.demoShift);

  const isBoss = povTarget === "manager";
  const idx = povTarget ? ORDER.indexOf(povTarget) : -1;
  const agent = !isBoss && idx >= 0 ? AGENTS[idx] : undefined;
  const profile = agent ? profiles[agent.id] : undefined;
  const job = agent ? currentJobFor(agent.id, jobs) : undefined;
  const act =
    agent && profile
      ? agentActivity(profile, job, approvals.some((ap) => ap.agentId === agent.id), hour)
      : null;

  const cycle = (dir: 1 | -1) => {
    if (idx < 0) return;
    setPovTarget(ORDER[(idx + dir + ORDER.length) % ORDER.length]);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "Escape") setPovTarget(null);
      else if (e.key === "ArrowRight") cycle(1);
      else if (e.key === "ArrowLeft") cycle(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (idx < 0 || (!isBoss && (!agent || !profile))) return null;

  const name = isBoss ? "BOS" : profile!.name;
  const color = isBoss ? MANAGER.accent : profile!.color;
  const status = isBoss
    ? approvals.length > 0
      ? `${approvals.length} menunggu OK darimu`
      : "Mengawasi Bay 7 dari kursi bos"
    : demoShift
      ? job
        ? `${job.status === "running" ? "Kerja" : job.status === "queued" ? "Antre" : "Error"} · ${job.title}`
        : "Ikut koreografi kantor"
      : act
        ? `${act.label}${job && (act.kind === "kerja" || act.kind === "gagal") ? ` · ${job.title}` : ""}`
        : "";

  const bracket = "pointer-events-none absolute h-7 w-7 border-white/25";

  return (
    <div className="pointer-events-none fixed inset-0 z-50 select-none">
      {/* visor frame */}
      <div className={`${bracket} left-4 top-4 border-l-2 border-t-2 rounded-tl-xl`} />
      <div className={`${bracket} right-4 top-4 border-r-2 border-t-2 rounded-tr-xl`} />
      <div className={`${bracket} bottom-4 left-4 border-b-2 border-l-2 rounded-bl-xl`} />
      <div className={`${bracket} bottom-4 right-4 border-b-2 border-r-2 rounded-br-xl`} />
      {/* center reticle */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="h-9 w-9 rounded-full border border-white/25" />
        <div
          className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>

      {/* top-left identity chip */}
      <div className="absolute left-4 top-4 ml-8 mt-1 flex items-center gap-2 rounded-full border border-white/12 bg-[#11162a]/70 py-1.5 pl-2.5 pr-3 backdrop-blur-xl">
        <span className="relative flex h-2 w-2">
          <span className="absolute h-full w-full animate-ping rounded-full opacity-60" style={{ backgroundColor: color }} />
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        </span>
        <span className="text-[10px] font-bold tracking-[0.14em] text-hq-muted">POV</span>
        <span className="text-[12px] font-extrabold text-hq-text">{name}</span>
        <span className="hidden max-w-[260px] truncate text-[10px] font-semibold text-hq-muted sm:inline">{status}</span>
      </div>

      {/* bottom-left readout: robot job progress, or the boss's waiting approvals */}
      {!isBoss && job && job.status === "running" && (
        <div className="absolute bottom-20 left-6 w-44 rounded-xl border border-white/10 bg-[#11162a]/60 p-2.5 backdrop-blur-xl">
          <p className="truncate text-[10px] font-bold text-hq-text">{job.title}</p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/12">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${Math.round(job.progress * 100)}%`, backgroundColor: color }}
            />
          </div>
          <p className="mt-1 text-[9px] font-bold text-hq-muted">{Math.round(job.progress * 100)}%</p>
        </div>
      )}
      {isBoss && approvals.length > 0 && (
        <div className="absolute bottom-20 left-6 w-56 rounded-xl border border-[#fbbf24]/30 bg-[#11162a]/70 p-2.5 backdrop-blur-xl">
          <p className="text-[9px] font-bold tracking-[0.12em] text-[#fbbf24]">
            ⚠ {approvals.length} MENUNGGU OK DARIMU
          </p>
          <p className="mt-1 truncate text-[10px] font-bold text-hq-text">{approvals[0].title}</p>
          <p className="mt-1 text-[9px] font-semibold leading-snug text-hq-muted">
            Esc untuk keluar, lalu klik PC bos untuk memutuskan.
          </p>
        </div>
      )}

      {/* bottom control bar */}
      <div className="pointer-events-auto absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/12 bg-[#11162a]/80 p-1.5 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.6)] backdrop-blur-xl">
        <button
          onClick={() => cycle(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-hq-muted transition hover:bg-white/10 hover:text-hq-text"
          aria-label="Sudut sebelumnya"
          title="Sudut sebelumnya (←)"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-extrabold text-white"
          style={{ backgroundColor: color }}
        >
          {isBoss ? <Crown className="h-4 w-4 text-[#20160a]" /> : name.slice(0, 1)}
        </span>
        <div className="min-w-[86px] px-1 leading-tight">
          <p className="text-[12px] font-extrabold text-hq-text">{name}</p>
          <p className="text-[9px] font-semibold text-hq-muted">
            {idx + 1} / {ORDER.length} · {isBoss ? "kursi bos" : "robot"}
          </p>
        </div>
        <button
          onClick={() => cycle(1)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-hq-muted transition hover:bg-white/10 hover:text-hq-text"
          aria-label="Sudut berikutnya"
          title="Sudut berikutnya (→)"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <span className="mx-0.5 h-5 w-px bg-white/12" />
        <button
          onClick={() => setPovTarget(null)}
          className="inline-flex items-center gap-1 rounded-full bg-[#f5b45e] px-3 py-2 text-[11px] font-bold text-[#20160a] transition hover:scale-[1.04]"
        >
          <X className="h-3.5 w-3.5" /> Keluar POV
        </button>
      </div>

      <p className="absolute bottom-[4.4rem] left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold text-white/55">
        Seret untuk menengok · ←/→ ganti sudut · Esc keluar
      </p>
    </div>
  );
}
