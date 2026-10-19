import type { ReactNode } from "react";
import type { JobStatus } from "@/lib/hq-jobs";

/** Shared dark-glass building blocks for the Fase 6 dashboard pages. */

export function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-white/10 bg-[#171a2e]/80 p-4 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.8)] ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && (
            <h2 className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-hq-muted">
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatTile({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#171a2e]/80 p-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-hq-muted">{label}</div>
      <div className="mt-1.5 text-2xl font-extrabold leading-none" style={color ? { color } : undefined}>
        {value}
      </div>
      {sub && <div className="mt-1.5 text-[11px] leading-snug text-hq-muted">{sub}</div>}
    </div>
  );
}

const STATUS_META: Record<JobStatus, { label: string; className: string }> = {
  queued: { label: "antre", className: "bg-white/10 text-hq-muted" },
  running: { label: "berlangsung", className: "bg-sky-400/20 text-sky-300" },
  done: { label: "selesai", className: "bg-emerald-400/20 text-emerald-300" },
  failed: { label: "gagal", className: "bg-rose-400/20 text-rose-300" },
};

export function StatusBadge({ status }: { status: JobStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${m.className}`}>
      {status === "running" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-300" />}
      {m.label}
    </span>
  );
}

export function ProgressBar({ value, color, height = 6 }: { value: number; color?: string; height?: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className="w-full overflow-hidden rounded-full bg-white/10" style={{ height }}>
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${pct}%`, backgroundColor: color ?? "#38bdf8" }}
      />
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.12em] text-hq-muted">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] leading-snug text-hq-muted">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-[13px] text-hq-text outline-none transition placeholder:text-hq-muted/60 focus:border-sky-400/60 focus:bg-white/8";

export const btnPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-sky-500 px-3.5 py-2 text-[12px] font-bold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50";

export const btnGhost =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/12 bg-white/5 px-3.5 py-2 text-[12px] font-bold text-hq-text transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50";

export function AgentDot({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <span
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, backgroundColor: color, boxShadow: `0 0 8px ${color}66` }}
    />
  );
}

/** "3 mnt lalu" style relative time (Indonesian, mirrors the HUD feed). */
export function relTime(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 5) return "baru aja";
  if (s < 60) return `${s} dtk lalu`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.floor(h / 24)} hari lalu`;
}

export function fmtClock(ts: number): string {
  return new Date(ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}
