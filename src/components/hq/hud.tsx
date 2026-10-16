import { useEffect, useRef, type CSSProperties } from "react";
import {
  Bot,
  Car,
  ChevronLeft,
  Clock3,
  Crosshair,
  Film,
  MapPin,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Users,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { AGENTS, COMPANY, VEHICLES, type VehicleInfo } from "@/lib/hq-data";
import { currentJobFor } from "@/lib/hq-jobs";
import { formatHour, isOnShift, useHqStore } from "@/lib/hq-store";
import { useAmbience } from "@/lib/hq-ambience";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<VehicleInfo["kind"], string> = {
  sedan: "Sedan",
  van: "Panel van",
  hatch: "Hatchback",
  pickup: "Work pickup",
  scooter: "City scooter",
};

export function HqHud() {
  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none">
      <TopBar />
      <ClockPanel />
      <CrewPanel />
      <DetailCard />
      <ViewToggles />
      <TickerBar />
    </div>
  );
}

/* ---------------------------------- shared bits ---------------------------------- */

function BrandMark() {
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2e3192] via-[#4f46ba] to-[#7c3aed] shadow-[0_8px_18px_-6px_rgba(46,49,146,0.6)]">
      <Zap className="h-5 w-5 text-white" strokeWidth={2.6} />
    </span>
  );
}

function Chip({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[9.5px] font-bold tracking-[0.12em]"
      style={{ backgroundColor: `${color}1f`, color }}
    >
      {children}
    </span>
  );
}

/* ---------------------------------- top bar ---------------------------------- */

function TopBar() {
  return (
    <div className="pointer-events-none absolute left-3 top-3 flex items-start justify-between gap-2 pr-3 sm:left-5 sm:top-5">
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-hq-line bg-hq-panel px-3.5 py-2.5 shadow-[0_18px_40px_-20px_rgba(35,39,70,0.45)] backdrop-blur-xl">
        <BrandMark />
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-extrabold tracking-tight text-hq-text">CLIPYARD</span>
            <span className="rounded-full bg-hq-text px-1.5 py-0.5 text-[9px] font-bold tracking-[0.14em] text-white">
              BAY 7
            </span>
          </div>
          <p className="text-[10.5px] font-semibold text-hq-muted">
            Autonomous Clip Factory · Studio Floor
          </p>
        </div>
      </div>

      <div className="pointer-events-auto flex items-center gap-2">
        <SoundPill />
        <a
          href="/"
          className="hidden items-center gap-1.5 rounded-full border border-hq-line bg-hq-panel px-3.5 py-2 text-xs font-semibold text-hq-muted shadow-sm backdrop-blur-xl transition-colors hover:border-hq-violet/50 hover:text-hq-text sm:inline-flex"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Company site
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
          ? "border-transparent bg-hq-text text-white shadow-[0_10px_22px_-10px_rgba(35,39,70,0.7)]"
          : "border-hq-line bg-hq-panel text-hq-muted hover:text-hq-text",
      )}
    >
      {on ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
      {on ? "Suara · on" : "Suara"}
    </button>
  );
}

/* ---------------------------------- sim clock ---------------------------------- */

function ClockPanel() {
  const hour = useHqStore((s) => s.hour);
  const playing = useHqStore((s) => s.playing);
  const speed = useHqStore((s) => s.speed);
  const floorSource = useHqStore((s) => s.floorSource);
  const setHour = useHqStore((s) => s.setHour);
  const togglePlay = useHqStore((s) => s.togglePlay);
  const setSpeed = useHqStore((s) => s.setSpeed);
  const on = isOnShift(hour);
  const shiftP = Math.min(1, Math.max(0, (hour - 9) / 8));

  return (
    <div className="pointer-events-auto absolute right-3 top-[4.4rem] w-[210px] rounded-2xl border border-hq-line bg-hq-panel p-3.5 shadow-[0_18px_40px_-20px_rgba(35,39,70,0.45)] backdrop-blur-xl sm:right-5 sm:top-[5.2rem] sm:w-[228px]">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[0.14em] text-hq-muted">
          <Clock3 className="h-3.5 w-3.5" /> SIM CLOCK
        </span>
        <span className="flex items-center gap-1">
          <Chip color={floorSource === "live" ? "#047857" : "#6d28d9"}>
            {floorSource === "live" ? "LIVE" : "SIM"}
          </Chip>
          <Chip color={on ? "#047857" : "#6d28d9"}>{on ? "ON SHIFT" : "OFF SHIFT"}</Chip>
        </span>
      </div>
      <div className="mt-1 font-mono text-[30px] font-extrabold leading-none tracking-tight text-hq-text">
        {formatHour(hour)}
      </div>
      <p className="mt-1 text-[10.5px] font-semibold text-hq-muted">
        {COMPANY.shift} · studio floor
      </p>

      <div className="mt-2 flex items-center justify-between text-[9px] font-bold tracking-[0.12em] text-hq-muted">
        <span>09:00</span>
        <span>SHIFT PROGRESS</span>
        <span>17:00</span>
      </div>
      <input
        type="range"
        min={0}
        max={24}
        step={0.05}
        value={hour}
        onChange={(e) => setHour(Number(e.target.value))}
        aria-label="Scrub sim clock"
        className="hq-range mt-1 w-full"
        style={{ "--hq-range-p": `${shiftP * 100}%` } as CSSProperties}
      />

      <div className="mt-2.5 flex items-center gap-1.5">
        <button
          onClick={togglePlay}
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-hq-text text-white transition-transform hover:scale-105"
          aria-label={playing ? "Pause sim clock" : "Play sim clock"}
        >
          {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </button>
        {[0.5, 1, 3].map((s) => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            className={cn(
              "h-8 rounded-xl px-2 text-[11px] font-bold transition-colors",
              speed === s
                ? "bg-hq-text text-white"
                : "bg-hq-line/60 text-hq-muted hover:text-hq-text",
            )}
          >
            {s}×
          </button>
        ))}
        <button
          onClick={() => setHour(9)}
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-xl bg-hq-line/60 text-hq-muted transition-colors hover:text-hq-text"
          aria-label="Reset clock to 09:00"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------- crew roster ---------------------------------- */

function CrewPanel() {
  const hour = useHqStore((s) => s.hour);
  const selection = useHqStore((s) => s.selection);
  const select = useHqStore((s) => s.select);
  const jobs = useHqStore((s) => s.jobs);
  const on = isOnShift(hour);

  return (
    <div className="pointer-events-auto absolute bottom-[4.4rem] left-3 w-[228px] rounded-2xl border border-hq-line bg-hq-panel p-3.5 shadow-[0_18px_40px_-20px_rgba(35,39,70,0.45)] backdrop-blur-xl sm:bottom-[4.6rem] sm:left-5 sm:w-[248px]">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[0.14em] text-hq-muted">
          <Users className="h-3.5 w-3.5" /> THE CREW
        </span>
        <span className="text-[9.5px] font-bold tracking-[0.12em] text-hq-muted">6 HOODIES</span>
      </div>
      <div className="mt-2 space-y-1">
        {AGENTS.map((a) => {
          const active = selection?.kind === "agent" && selection.id === a.id;
          const failed = currentJobFor(a.id, jobs)?.status === "failed";
          return (
            <button
              key={a.id}
              onClick={() => select({ kind: "agent", id: a.id })}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors",
                active ? "bg-hq-line/70" : "hover:bg-hq-line/40",
              )}
            >
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white"
                style={{ backgroundColor: a.color }}
              >
                {a.name[0]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-extrabold leading-tight text-hq-text">
                  {a.name}
                </span>
                <span className="block truncate text-[10px] font-semibold leading-tight text-hq-muted">
                  {a.role}
                </span>
              </span>
              <span
                className="shrink-0 rounded-full px-1.5 py-0.5 text-[8.5px] font-bold tracking-[0.1em]"
                style={{
                  backgroundColor: failed ? "#e11d481c" : on ? "#0478571c" : "#6d28d91c",
                  color: failed ? "#e11d48" : on ? "#047857" : "#6d28d9",
                }}
              >
                {failed ? "ERROR" : on ? "WORKING" : "LOUNGE"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------- detail card ---------------------------------- */

function DetailCard() {
  const selection = useHqStore((s) => s.selection);
  const select = useHqStore((s) => s.select);
  const requestFocus = useHqStore((s) => s.requestFocus);
  const hour = useHqStore((s) => s.hour);
  const jobs = useHqStore((s) => s.jobs);

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

  const on = isOnShift(hour);

  return (
    <div className="pointer-events-auto absolute right-3 top-[19.5rem] w-[210px] rounded-2xl border border-hq-line bg-hq-panel p-3.5 shadow-[0_18px_40px_-20px_rgba(35,39,70,0.45)] backdrop-blur-xl sm:right-5 sm:w-[228px]">
      <div className="flex items-start justify-between">
        {agent ? (
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-extrabold text-white"
              style={{ backgroundColor: agent.color }}
            >
              {agent.name[0]}
            </span>
            <div>
              <p className="text-[13.5px] font-extrabold leading-tight text-hq-text">{agent.name}</p>
              <p className="text-[10px] font-semibold text-hq-muted">{agent.role}</p>
            </div>
          </div>
        ) : vehicle ? (
          (() => {
            const owner = AGENTS.find((a) => a.id === vehicle.owner);
            return (
              <div className="flex items-center gap-2.5">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${vehicle.color}26` }}
                >
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
          })()
        ) : null}
        <button
          onClick={() => select(null)}
          className="rounded-lg p-1 text-hq-muted transition-colors hover:bg-hq-line/60 hover:text-hq-text"
          aria-label="Close details"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {agent && (
        (() => {
          const job = currentJobFor(agent.id, jobs);
          const taskTitle = job?.title ?? agent.task;
          const taskP = job && job.status !== "queued" ? job.progress : agent.progress;
          const failed = job?.status === "failed";
          const queued = job?.status === "queued";
          return (
            <>
          <p className="mt-2.5 text-[11px] font-medium leading-snug text-hq-muted">{agent.tagline}</p>
          <div className="mt-2.5 rounded-xl bg-hq-line/40 p-2.5">
            <div className="flex items-center justify-between text-[9.5px] font-bold tracking-[0.1em] text-hq-muted">
              <span>CURRENT TASK</span>
              <Chip color={failed ? "#e11d48" : agent.color}>
                {failed ? "FAILED" : queued ? "QUEUED" : on ? "LIVE" : "QUEUED"}
              </Chip>
            </div>
            <p className="mt-1 text-[11px] font-bold leading-snug text-hq-text">{taskTitle}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
              <div
                className="h-full rounded-full transition-[width] duration-700"
                style={{
                  width: `${Math.round(taskP * 100)}%`,
                  backgroundColor: failed ? "#e11d48" : agent.color,
                }}
              />
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <Stat small label="CLIPS TODAY" value={agent.clipsToday.toLocaleString()} />
            <Stat small label="STATION" value="Studio desk" />
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-[10.5px] font-semibold text-hq-muted">
            <Car className="h-3.5 w-3.5" /> {agent.vehicle} — on the garage shelf
          </p>
            </>
          );
        })()
      )}

      {vehicle && (
        <>
          <div className="mt-2.5 grid grid-cols-2 gap-1.5">
            <Stat small label="TYPE" value={KIND_LABEL[vehicle.kind]} />
            <Stat small label="PLATE" value={vehicle.plate} />
          </div>
          <p className="mt-2.5 flex items-center gap-1.5 text-[10.5px] font-semibold text-hq-muted">
            <MapPin className="h-3.5 w-3.5" /> CREW GARAGE shelf · lobby wall
          </p>
        </>
      )}

      <button
        onClick={requestFocus}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-hq-text py-2 text-[11px] font-bold text-white transition-transform hover:scale-[1.02]"
      >
        <Crosshair className="h-3.5 w-3.5" /> Focus camera
      </button>
    </div>
  );
}

function Stat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="rounded-xl bg-hq-line/40 px-2.5 py-2">
      <p className="text-[8.5px] font-bold tracking-[0.12em] text-hq-muted">{label}</p>
      <p className={cn("font-extrabold leading-tight text-hq-text", small ? "text-[12px]" : "text-[15px]")}>
        {value}
      </p>
    </div>
  );
}

/* ---------------------------------- view toggles + hint ---------------------------------- */

function ViewToggles() {
  const labels = useHqStore((s) => s.labels);
  const autoOrbit = useHqStore((s) => s.autoOrbit);
  const setLabels = useHqStore((s) => s.setLabels);
  const setAutoOrbit = useHqStore((s) => s.setAutoOrbit);

  return (
    <div className="pointer-events-auto absolute bottom-[3.4rem] left-1/2 flex -translate-x-1/2 items-center gap-2 sm:bottom-5">
      <Toggle on={labels} onClick={() => setLabels(!labels)} label="Labels" />
      <Toggle on={autoOrbit} onClick={() => setAutoOrbit(!autoOrbit)} label="Auto-sway" />
      <span className="hidden items-center gap-1.5 rounded-full border border-hq-line bg-hq-panel px-3 py-1.5 text-[10px] font-semibold text-hq-muted shadow-sm backdrop-blur-xl md:inline-flex">
        <Sparkles className="h-3 w-3 text-hq-violet" />
        Drag to orbit · scroll to zoom · click mascots & diecasts
      </span>
    </div>
  );
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-[10.5px] font-bold shadow-sm backdrop-blur-xl transition-colors",
        on
          ? "border-transparent bg-hq-text text-white"
          : "border-hq-line bg-hq-panel text-hq-muted hover:text-hq-text",
      )}
    >
      {label}
    </button>
  );
}

/* ---------------------------------- ticker ---------------------------------- */

function TickerBar() {
  const stats = useHqStore((s) => s.stats);
  return (
    <div className="absolute bottom-0 left-0 right-0 overflow-hidden border-t border-white/10 bg-hq-text/95 py-1.5 backdrop-blur">
      <div className="ticker-track flex w-max gap-10 whitespace-nowrap text-[10px] font-bold tracking-[0.16em] text-white/70">
        {[0, 1].map((k) => (
          <div key={k} className="flex gap-10">
            <span>
              CLIPS SHIPPED TODAY · <b className="text-[#6ee7b7]">{stats.clipsShipped.toLocaleString()}</b>
            </span>
            <span>
              RENDER QUEUE · <b className="text-[#fbbf24]">{stats.renderQueue}</b>
            </span>
            <span>
              AVG CLIP · <b className="text-[#67e8f9]">{stats.avgClipSec}s</b>
            </span>
            <span>
              CHANNELS FED · <b className="text-[#c4b5fd]">{stats.channelsFed}</b>
            </span>
            <span>
              SHIFT · <b className="text-white">{COMPANY.shift}</b>
            </span>
            <span>
              AUTOMATION · <b className="text-[#f9a8d4]">CLIP · HOOK · CAPTION · COVER · SHIP</b>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Bot className="h-3 w-3 text-[#67e8f9]" /> 6 AI AGENTS · 1 STUDIO
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Film className="h-3 w-3 text-[#f9a8d4]" /> BAY 7 · THE FOUNDRY DISTRICT
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
