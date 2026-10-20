import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bot,
  Car,
  Check,
  ChevronDown,
  ChevronLeft,
  Clock3,
  Crosshair,
  Eye,
  EyeOff,
  Inbox,
  LayoutGrid,
  MapPin,
  Maximize,
  Minimize,
  Moon,
  RotateCcw,
  Sun,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { AgentWorkPanel } from "@/components/dash/agent-panel";
import { DASH_NAV } from "@/components/dash/shell";
import { decideApproval } from "@/lib/hq-actions";
import { agentActivity } from "@/lib/hq-profiles";
import { AGENTS, COMPANY, VEHICLES, type VehicleInfo } from "@/lib/hq-data";
import { currentJobFor } from "@/lib/hq-jobs";
import { formatShort, isMeeting, isOnShift, timeAgo, tzLabel, useHqStore, type ViewMode } from "@/lib/hq-store";
import { useAmbience } from "@/lib/hq-ambience";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<VehicleInfo["kind"], string> = {
  sedan: "Sedan",
  van: "Panel van",
  hatch: "Hatchback",
  pickup: "Pickup",
  scooter: "Scooter",
};

export function HqHud() {
  const hudHidden = useHqStore((s) => s.hudHidden);
  const setHudHidden = useHqStore((s) => s.setHudHidden);

  // H toggles a clean, panel-free diorama view (nice for screenshots/OBS)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "h" || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      setHudHidden(!useHqStore.getState().hudHidden);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setHudHidden]);

  if (hudHidden) {
    return (
      <div className="pointer-events-none fixed inset-0 z-50 select-none">
        <button
          onClick={() => setHudHidden(false)}
          className="pointer-events-auto absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-[#11162a]/70 px-3.5 py-2 text-[11px] font-bold text-white/85 opacity-40 shadow-sm backdrop-blur-xl transition hover:opacity-100"
          title="Tekan H untuk menampilkan UI"
        >
          <Eye className="h-3.5 w-3.5" /> Tampilkan UI
        </button>
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-50 select-none">
      {/* Responsive wrapper that adapts to viewport */}
      <div className="absolute inset-0 overflow-hidden">
        <TopBar />
        <ViewControls />
        <ActivityFeed />
        <RightRail />
        <AgentCards />
        <DetailCard />
      </div>
      {/* Flexible overlay hint */}
      <div className="pointer-events-none absolute bottom-[6.75rem] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#11162a]/55 px-3.5 py-1 text-[9.5px] font-semibold text-white/65 backdrop-blur-md lg:hidden">
        Seret untuk memutar · cubit untuk zoom · ketuk robot
      </div>
    </div>
  );
}

/* ---------------------------------- shared bits ---------------------------------- */

function Chip({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold tracking-[0.1em]"
      style={{ backgroundColor: `${color}1f`, color }}
    >
      {children}
    </span>
  );
}

/** Feed health badge: SIM / LIVE / LIVE·STALE. */
function FloorBadge() {
  const source = useHqStore((s) => s.floorSource);
  const updatedAt = useHqStore((s) => s.floorUpdatedAt);
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    if (source !== "live") return;
    const id = window.setInterval(force, 1000);
    return () => window.clearInterval(id);
  }, [source]);

  if (source !== "live")
    return (
      <Link to="/konektor" title="Buka panel konektor pipeline">
        <Chip color="#a78bfa">SIM</Chip>
      </Link>
    );
  const stale = updatedAt > 0 && Date.now() - updatedAt > 15_000;
  return (
    <Link to="/konektor" title="Buka panel konektor pipeline">
      <Chip color={stale ? "#fbbf24" : "#34d399"}>{stale ? "LIVE·STALE" : "LIVE"}</Chip>
    </Link>
  );
}

/** "Kelola" dropdown (Fase 6): the management dashboard pages. */
function DashMenu() {
  const [open, setOpen] = useState(false);
  const pending = useHqStore((s) => s.approvals.length);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/8 px-3 py-2 text-[11px] font-bold text-[#eef1ff] shadow-sm backdrop-blur-xl transition hover:bg-white/15 sm:px-3.5 sm:text-xs"
      >
        <LayoutGrid className="h-3.5 w-3.5" /> Kelola
        {pending > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[9px] font-extrabold text-[#20160a]">
            {pending}
          </span>
        )}
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-2xl border border-white/12 bg-[#141a30]/97 p-1.5 shadow-[0_24px_50px_-20px_rgba(0,0,0,0.7)] backdrop-blur-2xl">
            {DASH_NAV.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[12px] font-bold text-[#eef1ff] transition hover:bg-white/10"
                >
                  <Icon className="h-4 w-4 text-sky-300" />
                  {item.label}
                  {item.to === "/aktivitas" && pending > 0 && (
                    <span className="ml-auto rounded-full bg-amber-400/20 px-1.5 py-px text-[9.5px] font-extrabold text-amber-300">
                      {pending} OK?
                    </span>
                  )}
                </Link>
              );
            })}
            <div className="border-t border-white/8 px-3 py-2 text-[10px] leading-snug text-[#98a1c4]">
              Dasbor manajemen: aktivitas, statistik, laporan, dokumen, agen & konektor pipeline.
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------------------------- top bar + stats ---------------------------------- */

function TopBar() {
  return (
    <div className="pointer-events-none absolute left-2 top-2 sm:left-3 sm:top-3 flex w-auto items-start gap-2">
      <div className="pointer-events-auto flex max-w-[calc(100vw-1rem)] items-center gap-2 rounded-2xl border border-white/10 bg-[#11162a]/88 px-3 py-2 shadow-[0_18px_40px_-20px_rgba(35,39,70,0.35)] backdrop-blur-2xl transition hover:border-white/20 hover:bg-[#1a2140]/95 sm:px-3.5 sm:py-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#2e3192] via-[#4f46ba] to-[#7c3aed] shadow-[0_6px_14px_-4px_rgba(46,49,146,0.5)] sm:h-10 sm:w-10 sm:rounded-2xl">
          <Zap className="h-4 w-4 text-white sm:h-5 sm:w-5" strokeWidth={2.6} />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13px] font-extrabold tracking-tight text-[#eef1ff] sm:text-[15px]">Kantor CLIPYARD HQ</span>
            <FloorBadge />
          </div>
          <p className="truncate text-[9px] font-semibold text-[#98a1c4] sm:text-[10.5px]">AWAN7 Studio · Bay 7</p>
        </div>
      </div>
      <div className="pointer-events-auto flex items-center gap-2">
        <SoundPill />
        <DashMenu />
        <a
          href="/"
          className="hidden items-center gap-1 rounded-full border border-white/12 bg-white/8 px-2.5 py-2 text-[10px] font-semibold text-[#eef1ff] shadow-sm backdrop-blur-xl transition hover:bg-white/15 hover:shadow-md sm:inline-flex sm:px-3.5 sm:text-xs md:gap-1.5"
        >
          <ChevronLeft className="h-3 w-3" /> Company
        </a>
      </div>
    </div>
  );
}

function SoundPill() {
  const [on, toggle] = useAmbience();
  return (
    <button
      onClick={toggle}
      aria-pressed={on}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-bold shadow-sm backdrop-blur-xl transition-all",
        on
          ? "border-transparent bg-[#f5b45e] text-[#20160a]"
          : "border-hq-line bg-hq-panel text-hq-muted hover:text-hq-text",
      )}
    >
      {on ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
      Suara
    </button>
  );
}

/* ---------------------------------- stats grid (top right) ---------------------------------- */

function StatTile({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-hq-line bg-hq-panel px-2.5 py-1.5 shadow-sm backdrop-blur-xl">
      <p className="text-[8.5px] font-bold tracking-[0.12em] text-hq-muted">{label}</p>
      <p className={cn("text-[14px] font-extrabold leading-tight text-hq-text")} style={accent ? { color: accent } : undefined}>
        {value}
      </p>
    </div>
  );
}

function StatsBar() {
  const stats = useHqStore((s) => s.stats);
  const hour = useHqStore((s) => s.hour);
  const jobs = useHqStore((s) => s.jobs);
  const approvals = useHqStore((s) => s.approvals);
  const profiles = useHqStore((s) => s.profiles);
  const demoShift = useHqStore((s) => s.demoShift);

  const tokensOut = stats.tokensOut ?? stats.clipsShipped * 137;
  // "Active" follows the same truth as the robots: demo = on shift,
  // real mode = actually working/queued/waiting on the owner right now.
  const activeCount = demoShift
    ? AGENTS.filter(() => isOnShift(hour)).length
    : AGENTS.filter((a) => {
        const act = agentActivity(
          profiles[a.id],
          currentJobFor(a.id, jobs),
          approvals.some((ap) => ap.agentId === a.id),
          hour,
        );
        return act.kind === "kerja" || act.kind === "antre" || act.kind === "minta-ok";
      }).length;

  return (
    <div className="pointer-events-auto absolute right-2 top-[4.5rem] hidden grid-cols-2 gap-1.5 min-[640px]:grid sm:right-3 sm:top-[4.6rem] md:top-14 lg:top-[4.4rem]">
      <StatTile label="KLIP TERKIRIM" value={formatShort(stats.clipsShipped)} accent="#0ea5e9" />
      <StatTile label="ANTREAN RENDER" value={formatShort(stats.renderQueue)} />
      <StatTile label="TOKEN KELUAR" value={formatShort(tokensOut)} />
      <StatTile label="AGEN AKTIF" value={`${activeCount}/6`} />
    </div>
  );
}

/* ---------------------------------- view controls (top center) ---------------------------------- */

function ViewControls() {
  const mode = useHqStore((s) => s.mode);
  const setMode = useHqStore((s) => s.setMode);
  const labels = useHqStore((s) => s.labels);
  const setLabels = useHqStore((s) => s.setLabels);
  const autoOrbit = useHqStore((s) => s.autoOrbit);
  const setAutoOrbit = useHqStore((s) => s.setAutoOrbit);
  const requestResetView = useHqStore((s) => s.requestResetView);
  const setHudHidden = useHqStore((s) => s.setHudHidden);
  const [full, setFull] = useState(false);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => {});
  };
  useEffect(() => {
    const onFs = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "f" && !e.metaKey && !e.ctrlKey) toggleFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const modes: Array<{ id: ViewMode; label: string; icon: React.ReactNode }> = [
    { id: "auto", label: "Otomatis", icon: <Clock3 className="h-3 w-3" /> },
    { id: "day", label: "Terang", icon: <Sun className="h-3 w-3" /> },
    { id: "night", label: "Gelap", icon: <Moon className="h-3 w-3" /> },
  ];

  const toggleCls = (active: boolean) =>
    cn(
      "inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[10.5px] font-bold transition-colors",
      active ? "bg-[#f5b45e] text-[#20160a]" : "text-hq-muted hover:bg-white/[0.07] hover:text-hq-text",
    );
  const iconBtnCls =
    "inline-flex h-7 w-7 items-center justify-center rounded-full text-hq-muted transition-colors hover:bg-white/[0.07] hover:text-hq-text";

  return (
    <>
      <StatsBar />
      <div className="pointer-events-auto absolute left-1/2 top-[3.5rem] flex max-w-[calc(100vw-1rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-0.5 rounded-[1.35rem] border border-hq-line bg-hq-panel p-1 shadow-sm backdrop-blur-xl sm:top-3 sm:rounded-full md:top-[3.2rem]">
        {modes.map((m) => (
          <button key={m.id} onClick={() => setMode(m.id)} className={toggleCls(mode === m.id)} title={`Pencahayaan ${m.label.toLowerCase()}`} aria-label={`Pencahayaan ${m.label.toLowerCase()}`}>
            {m.icon}
            <span className="hidden min-[430px]:inline">{m.label}</span>
          </button>
        ))}
        <span className="mx-1 hidden h-4 w-px bg-white/12 sm:block" />
        <button onClick={() => setLabels(!labels)} className={toggleCls(labels)} aria-pressed={labels} title="Nama agen di atas robot">
          Label
        </button>
        <button onClick={() => setAutoOrbit(!autoOrbit)} className={toggleCls(autoOrbit)} aria-pressed={autoOrbit} title="Kamera bergoyang pelan otomatis">
          Auto-sway
        </button>
        <span className="mx-1 hidden h-4 w-px bg-white/12 sm:block" />
        <button onClick={requestResetView} className={iconBtnCls} title="Sudut awal" aria-label="Sudut awal">
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        <button onClick={toggleFullscreen} className={cn(iconBtnCls, "hidden md:inline-flex")} title="Layar penuh (F)" aria-label="Layar penuh">
          {full ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
        </button>
        <button onClick={() => setHudHidden(true)} className={iconBtnCls} title="Sembunyikan semua panel (H)" aria-label="Sembunyikan UI">
          <EyeOff className="h-3.5 w-3.5" />
        </button>
      </div>
    </>
  );
}

/* ---------------------------------- activity feed (left) ---------------------------------- */

function ActivityFeed() {
  const feed = useHqStore((s) => s.feed);
  const profiles = useHqStore((s) => s.profiles);
  const [filter, setFilter] = useState<string | null>(null);
  const [, force] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    const id = window.setInterval(force, 30_000);
    return () => window.clearInterval(id);
  }, [force]);

  const shown = feed.filter((e) => !filter || e.color === filter).slice(0, 12);

  return (
    <div className="pointer-events-auto absolute left-2 top-[10rem] hidden w-[220px] rounded-2xl border border-white/10 bg-[#11162a]/88 p-3 shadow-[0_18px_40px_-20px_rgba(35,39,70,0.35)] backdrop-blur-2xl lg:left-3 lg:top-[12.5rem] lg:block lg:w-[248px]">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold tracking-[0.14em] text-hq-muted">AKTIVITAS LANGSUNG</p>
        <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" /> live
        </span>
      </div>
      <div className="hq-no-scrollbar -mx-1 mt-2 flex flex-nowrap gap-1 overflow-x-auto px-1 pb-0.5">
        <button
          onClick={() => setFilter(null)}
          className={cn(
            "shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold transition-colors",
            filter === null ? "border-transparent bg-[#f5b45e] text-[#20160a]" : "border-hq-line text-hq-muted hover:text-hq-text",
          )}
        >
          Semua
        </button>
        {AGENTS.map((a) => {
          const p = profiles[a.id];
          const active = filter === p.color;
          return (
            <button
              key={a.id}
              onClick={() => setFilter(active ? null : p.color)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold transition-colors",
                active ? "border-transparent" : "border-hq-line text-hq-muted hover:text-hq-text",
              )}
              style={active ? { backgroundColor: p.color, color: "#fff" } : undefined}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: active ? "#fff" : p.color }} />
              {p.name}
            </button>
          );
        })}
      </div>
      <div className="hq-scroll mt-2 max-h-[32vh] space-y-2 overflow-y-auto pr-2 sm:max-h-[36vh]">
        {shown.map((e) => (
          <div key={e.id} className="flex items-start gap-1.5">
            <span
              className="mt-1 h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: e.color ?? "#7a81a6", boxShadow: `0 0 6px ${e.color ?? "#7a81a6"}55` }}
            />
            <p className="min-w-0 flex-1 text-[10.5px] font-semibold leading-snug text-hq-text">
              {e.kind === "system" ? <Zap className="mr-0.5 inline h-3 w-3 text-hq-violet" /> : null}
              {e.text}
            </p>
            <span className="shrink-0 pl-1 text-[9px] font-semibold whitespace-nowrap text-hq-muted">{timeAgo(e.ts)}</span>
          </div>
        ))}
        {shown.length === 0 && <p className="py-2 text-[10.5px] font-medium text-hq-muted">Belum ada aktivitas untuk filter ini.</p>}
      </div>
    </div>
  );
}

/* ---------------------------------- right rail (clock → approvals → backlog) ---------------------------------- */

/**
 * One stacked column on the right edge so the clock, approval inbox and
 * backlog can never overlap each other (they used to be independently
 * positioned and collided whenever approvals piled up).
 */
function RightRail() {
  return (
    <div className="hq-scroll pointer-events-auto absolute right-2 top-[9.8rem] hidden max-h-[calc(100dvh-17.5rem)] w-[220px] flex-col gap-2 overflow-y-auto pb-1 pr-0.5 md:right-3 md:flex md:w-[236px] lg:top-[10.6rem]">
      <ClockPanel />
      <ApprovalInbox />
    </div>
  );
}

/* ---------------------------------- real-time clock (compact, right) ---------------------------------- */

function ClockPanel() {
  const hour = useHqStore((s) => s.hour);
  const nowTs = useHqStore((s) => s.nowTs);
  const demoShift = useHqStore((s) => s.demoShift);
  const setDemoShift = useHqStore((s) => s.setDemoShift);
  const on = isOnShift(hour);
  const d = new Date(nowTs);
  const pad = (n: number) => String(n).padStart(2, "0");
  const hms = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const dateLabel = d.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const period =
    hour >= 4 && hour < 11
      ? "PAGI"
      : hour >= 11 && hour < 15
        ? "SIANG"
        : hour >= 15 && hour < 18.5
          ? "SORE"
          : "MALAM";

  return (
    <div className="rounded-2xl border border-white/10 bg-[#11162a]/88 p-3 shadow-[0_18px_40px_-20px_rgba(35,39,70,0.35)] backdrop-blur-2xl">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[0.14em] text-hq-muted">
          <Clock3 className="h-3.5 w-3.5" /> WAKTU NYATA
        </span>
        {demoShift && <Chip color={on ? "#34d399" : "#a78bfa"}>{on ? "ON SHIFT" : "OFF SHIFT"}</Chip>}
      </div>
      <div className="mt-0.5 flex items-baseline gap-2">
        <span className="font-mono text-[26px] font-extrabold leading-none tracking-tight text-hq-text">
          {hms}
        </span>
        <span className="text-[10px] font-semibold text-hq-muted">{tzLabel(d)}</span>
      </div>
      <p className="mt-1 text-[10px] font-medium text-hq-muted">{dateLabel}</p>
      {/* posisi dalam sehari: pita amber = jendela shift demo 09–17, titik = sekarang */}
      <div
        className="relative mt-2 h-1.5 rounded-full bg-white/10"
        role="img"
        aria-label={`Posisi waktu dalam sehari: ${hms}`}
      >
        {demoShift && (
          <div
            className="absolute inset-y-0 rounded-full bg-[#f5b45e]/35"
            style={{ left: "37.5%", width: "33.333%" }}
          />
        )}
        <div
          className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f5b45e] shadow ring-2 ring-[#11162a]"
          style={{ left: `${(hour / 24) * 100}%` }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[9px] font-bold tracking-[0.1em] text-hq-muted">
        <span>{period}</span>
        <span>{demoShift ? "SHIFT 09:00 — 17:00" : "MODE 24/7"}</span>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-white/8 pt-2.5">
        <div className="min-w-0">
          <p className="text-[10.5px] font-bold leading-tight text-hq-text">Mode Demo 9–5</p>
          <p className="mt-0.5 text-[9px] leading-snug text-hq-muted">
            {demoShift
              ? "Robot ikut jam kantor dari waktu nyata (demo) — kerja tetap 24/7"
              : "Robot mengikuti status kerja nyata tiap agen"}
          </p>
        </div>
        <button
          onClick={() => setDemoShift(!demoShift)}
          aria-pressed={demoShift}
          aria-label="Mode Demo 9–5"
          title={demoShift ? "Matikan untuk mode kerja sebenarnya" : "Nyalakan koreografi kantor 9–5"}
          className={cn(
            "relative h-5.5 w-10 shrink-0 rounded-full transition-colors",
            demoShift ? "bg-[#f5b45e]" : "bg-white/15",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white shadow transition-all",
              demoShift ? "left-[1.35rem]" : "left-0.5",
            )}
          />
        </button>
      </div>
    </div>
  );
}
/* ---------------------------------- approval inbox ---------------------------------- */

const AMBER = "#fbbf24";

function ApprovalInbox() {
  const approvals = useHqStore((s) => s.approvals);
  const profiles = useHqStore((s) => s.profiles);
  const select = useHqStore((s) => s.select);
  const requestFocus = useHqStore((s) => s.requestFocus);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (approvals.length === 0) return null;

  const decide = async (a: (typeof approvals)[number], decision: "approved" | "rejected") => {
    setBusy(a.id);
    setError(null);
    const r = await decideApproval(a, decision);
    if (r.ok) {
      // fly the camera to the robot whose work was just decided on
      select({ kind: "agent", id: a.agentId });
      requestFocus();
    } else {
      setError(r.message ?? "gagal mengirim keputusan");
    }
    setBusy(null);
  };

  return (
    <div className="rounded-2xl border border-amber-300/35 bg-[#11162a]/92 p-3 shadow-[0_18px_40px_-20px_rgba(180,83,9,0.45)] ring-1 ring-amber-300/10 backdrop-blur-2xl">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[0.14em]" style={{ color: AMBER }}>
          <Inbox className="h-3.5 w-3.5" /> MENUNGGU OK DARIMU
        </span>
        <span
          className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-extrabold text-[#20160a]"
          style={{ backgroundColor: AMBER }}
        >
          {approvals.length}
        </span>
      </div>
      <div className="hq-scroll mt-2.5 max-h-[min(252px,calc(100dvh-29rem))] min-h-[108px] space-y-2 overflow-y-auto pr-1.5">
        {approvals.map((a) => {
          const agent = profiles[a.agentId];
          const isBusy = busy === a.id;
          return (
            <div key={a.id} className="rounded-xl border border-white/10 bg-white/[0.05] p-2.5">
              <div className="flex items-center gap-2">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-extrabold text-white"
                  style={{ backgroundColor: agent?.color }}
                >
                  {agent?.name.slice(0, 2) ?? "?"}
                </span>
                <span className="min-w-0 flex-1 truncate text-[10px] font-extrabold tracking-wide text-hq-text">
                  {agent?.name ?? a.agentId.toUpperCase()}
                </span>
                <span className="shrink-0 text-[9px] font-semibold text-hq-muted">
                  {timeAgo(a.requestedAt)}
                </span>
              </div>
              <p className="mt-1.5 line-clamp-2 text-[11.5px] font-bold leading-snug text-hq-text">{a.title}</p>
              {a.detail && (
                <p className="mt-0.5 line-clamp-2 text-[10px] font-medium leading-snug text-hq-muted">{a.detail}</p>
              )}
              <div className="mt-2 flex items-center gap-1.5">
                <button
                  disabled={isBusy}
                  onClick={() => decide(a, "approved")}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 py-1.5 text-[10.5px] font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" /> Setujui
                </button>
                <button
                  disabled={isBusy}
                  onClick={() => decide(a, "rejected")}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-rose-400/40 bg-rose-500/10 py-1.5 text-[10.5px] font-bold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" /> Tolak
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {error && <p className="mt-1.5 text-[10px] font-semibold text-rose-300">{error}</p>}
      <p className="mt-2 text-[9.5px] font-medium leading-snug text-hq-muted">
        Keputusanmu langsung menjalankan langkah berikutnya.
      </p>
    </div>
  );
}

/* ---------------------------------- agent cards (bottom) ---------------------------------- */

function AgentCards() {
  const jobs = useHqStore((s) => s.jobs);
  const approvals = useHqStore((s) => s.approvals);
  const profiles = useHqStore((s) => s.profiles);
  const hour = useHqStore((s) => s.hour);
  const demoShift = useHqStore((s) => s.demoShift);
  const select = useHqStore((s) => s.select);
  const on = isOnShift(hour);
  const meeting = isMeeting(hour);

  return (
    <div className="hq-no-scrollbar pointer-events-auto absolute bottom-2 left-1/2 flex w-[calc(100%-1rem)] max-w-[1200px] -translate-x-1/2 gap-1 overflow-x-auto pb-1 sm:gap-1.5 md:bottom-3 lg:bottom-4">
      {AGENTS.map((a) => {
        const p = profiles[a.id];
        const job = currentJobFor(a.id, jobs);
        const waiting = approvals.some((ap) => ap.agentId === a.id);
        const failed = job?.status === "failed";
        const act = agentActivity(p, job, waiting, hour);
        // Demo mode keeps the office-theater chips; real mode shows the
        // agent's true activity. Either way a live job is never hidden.
        const status = demoShift
          ? waiting
            ? { label: "WAITING OK", color: "#fbbf24" }
            : failed
              ? { label: "ERROR", color: "#e11d48" }
              : meeting
                ? { label: "RAPAT", color: "#0ea5e9" }
                : on
                  ? { label: "KERJA", color: "#34d399" }
                  : { label: "REHAT", color: "#a78bfa" }
          : { label: act.label.toUpperCase(), color: act.color };
        const hasLiveJob = job?.status === "running" || job?.status === "queued";
        // In real mode a paused/off agent doesn't get to claim its queued job
        const paused = !demoShift && (act.kind === "dijeda" || act.kind === "nonaktif");
        const task = paused
          ? act.reason
          : failed
            ? `${job?.title ?? "Job gagal"} — pengisian ulang`
            : hasLiveJob
              ? job.title
              : demoShift
                ? meeting
                  ? "Standup harian di meeting room"
                  : on
                    ? a.task
                    : "Rehat di ruang rehat"
                : act.reason;
        const pct = !paused && job && job.status !== "done" ? Math.round(job.progress * 100) : null;
        return (
          <button
            key={a.id}
            onClick={() => select({ kind: "agent", id: a.id })}
            className="min-w-[140px] shrink-0 flex-1 rounded-2xl border border-white/10 bg-[#11162a]/88 p-2 text-left shadow-[0_10px_24px_-12px_rgba(35,39,70,0.4)] backdrop-blur-xl transition hover:scale-[1.02] hover:shadow-[0_14px_30px_-12px_rgba(35,39,70,0.5)] sm:min-w-[168px] sm:p-2.5"
          >
            <div className="flex items-center gap-1.5">
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-extrabold text-white sm:h-6 sm:w-6 sm:text-[10px]"
                style={{ backgroundColor: p.color }}
              >
                {p.name[0] ?? "?"}
              </span>
              <span className="min-w-0 flex-1 truncate text-[10px] font-extrabold text-[#eef1ff] sm:text-[11.5px]">{p.name}</span>
              <span
                className="shrink-0 rounded-full px-1.5 py-0.5 text-[7px] font-bold tracking-[0.08em] sm:text-[8px]"
                style={{ backgroundColor: `${status.color}1c`, color: status.color }}
              >
                {status.label}
              </span>
            </div>
            <p className="mt-0.5 truncate text-[8px] font-medium leading-tight text-[#98a1c4] sm:mt-1 sm:text-[9.5px]">
              {p.role}
            </p>
            <p className="mt-0.5 truncate text-[9px] font-bold leading-snug text-[#eef1ff] sm:mt-0.5 sm:text-[10.5px]">
              {task}
            </p>
            <div className="mt-1.5 flex items-center gap-1.5">
              <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: pct !== null ? `${pct}%` : "0%",
                    backgroundColor: failed ? "#e11d48" : p.color,
                  }}
                />
              </div>
              <span className="shrink-0 text-[8.5px] font-bold text-[#98a1c4]">
                {pct !== null ? `${pct}%` : act.kind === "nonaktif" ? "off" : demoShift && !on ? "off" : "—"}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------- detail card (focus) ---------------------------------- */

function DetailCard() {
  const selection = useHqStore((s) => s.selection);
  const select = useHqStore((s) => s.select);
  const requestFocus = useHqStore((s) => s.requestFocus);
  const profiles = useHqStore((s) => s.profiles);

  useEffect(() => {
    if (!selection) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") select(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection, select]);

  if (!selection) return null;

  const agent = selection.kind === "agent" ? AGENTS.find((a) => a.id === selection.id) : undefined;
  const vehicle = selection.kind === "vehicle" ? VEHICLES.find((v) => v.id === selection.id) : undefined;
  if (!agent && !vehicle) return null;

  // Agent → the full Fase 6 work panel (jobs, results, tasks, config).
  if (agent) {
    return (
      <div className="hq-scroll pointer-events-auto absolute bottom-[7.5rem] left-2 max-h-[calc(100vh-11rem)] w-[min(92vw,372px)] overflow-y-auto rounded-2xl border border-white/10 bg-[#11162a]/94 p-3.5 shadow-[0_18px_40px_-20px_rgba(35,39,70,0.45)] backdrop-blur-2xl sm:left-3 lg:bottom-[9rem]">
        <AgentWorkPanel agentId={agent.id} onClose={() => select(null)} />
      </div>
    );
  }

  return (
    <div className="pointer-events-auto absolute bottom-[7.5rem] left-2 w-[200px] rounded-2xl border border-white/10 bg-[#11162a]/88 p-3 shadow-[0_18px_40px_-20px_rgba(35,39,70,0.45)] backdrop-blur-2xl sm:left-3 sm:w-[228px] sm:p-3.5 lg:bottom-[9rem] lg:w-[248px]">
      <div className="flex items-start justify-between">
        {vehicle &&
          (() => {
            const owner = profiles[vehicle.owner];
            return (
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${vehicle.color}26` }}>
                  <Car className="h-4.5 w-4.5" style={{ color: vehicle.color }} />
                </span>
                <div>
                  <p className="text-[13.5px] font-extrabold leading-tight text-hq-text">{vehicle.name}</p>
                  <p className="text-[10px] font-semibold text-hq-muted">
                    diecast · {owner?.name ?? vehicle.owner}
                  </p>
                </div>
              </div>
            );
          })()}
        <button
          onClick={() => select(null)}
          className="rounded-lg p-1 text-hq-muted transition-colors hover:bg-hq-line/60 hover:text-hq-text"
          aria-label="Tutup detail"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {vehicle && (
        <>
          <div className="mt-2.5 grid grid-cols-2 gap-1.5">
            <div className="rounded-xl bg-hq-line/40 px-2.5 py-2">
              <p className="text-[8.5px] font-bold tracking-[0.12em] text-hq-muted">TIPE</p>
              <p className="text-[12px] font-extrabold leading-tight text-hq-text">{KIND_LABEL[vehicle.kind]}</p>
            </div>
            <div className="rounded-xl bg-hq-line/40 px-2.5 py-2">
              <p className="text-[8.5px] font-bold tracking-[0.12em] text-hq-muted">PLAT</p>
              <p className="text-[12px] font-extrabold leading-tight text-hq-text">{vehicle.plate}</p>
            </div>
          </div>
          <p className="mt-2.5 flex items-center gap-1.5 text-[10.5px] font-semibold text-hq-muted">
            <MapPin className="h-3.5 w-3.5" /> Credenza CREW GARAGE · dinding jendela
          </p>
        </>
      )}

      <button
        onClick={requestFocus}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#f5b45e] py-2 text-[11px] font-bold text-[#20160a] transition-transform hover:scale-[1.02]"
      >
        <Crosshair className="h-3.5 w-3.5" /> Fokus kamera
      </button>
    </div>
  );
}
