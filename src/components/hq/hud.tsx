import { useEffect, useRef, type CSSProperties } from "react";
import {
  Bot,
  Car,
  ChevronLeft,
  Clock3,
  Film,
  Gauge,
  MapPin,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Users,
  X,
  Zap,
} from "lucide-react";
import { AGENTS, COMPANY, STATS, VEHICLES, type VehicleInfo } from "@/lib/hq-data";
import { formatHour, isOnShift, useHqStore } from "@/lib/hq-store";
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
    <div className="pointer-events-none absolute inset-0 z-10 select-none">
      <TopBar />
      <ClockPanel />
      <CrewPanel />
      <DetailCard />
      <TickerBar />
    </div>
  );
}

/* ---------------------------------- top bar ---------------------------------- */

function TopBar() {
  return (
    <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 md:p-5">
      <div className="pointer-events-auto flex items-center gap-3 rounded-hq-lg border border-hq-line bg-hq-panel px-3.5 py-2.5 backdrop-blur-xl md:px-4">
        <BrandMark />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-extrabold tracking-[0.14em] text-hq-text md:text-lg">{COMPANY.name}</h1>
            <span className="rounded-full border border-hq-cyan/40 bg-hq-cyan/10 px-2 py-0.5 text-[10px] font-bold tracking-[0.12em] text-hq-cyan">
              BAY 7
            </span>
          </div>
          <p className="hidden text-[11px] font-medium text-hq-muted sm:block md:text-xs">
            {COMPANY.tagline} · {COMPANY.address}
          </p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        <a
          href="/"
          className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-hq-line bg-hq-panel px-3.5 py-2 text-xs font-semibold text-hq-muted backdrop-blur-xl transition-colors hover:border-hq-cyan/50 hover:text-hq-text"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Company site</span>
          <span className="sm:hidden">Site</span>
        </a>
        <div className="hidden items-center gap-1.5 rounded-full border border-hq-line bg-hq-panel px-3 py-1.5 text-[10px] font-semibold tracking-[0.1em] text-hq-muted backdrop-blur-xl md:inline-flex">
          <Film className="h-3 w-3 text-hq-cyan" />
          AUTO-CLIP · HOOK · CAPTION · COVER · SHIP
        </div>
      </div>
    </div>
  );
}

function BrandMark() {
  return (
    <div className="relative grid h-10 w-10 place-items-center rounded-hq-md bg-gradient-to-br from-hq-cyan to-hq-violet shadow-[0_0_22px_-4px_var(--color-hq-cyan)]">
      <Zap className="h-5 w-5 text-hq-bg" fill="currentColor" />
    </div>
  );
}

/* ---------------------------------- clock ---------------------------------- */

function ClockPanel() {
  const hour = useHqStore((s) => s.hour);
  const playing = useHqStore((s) => s.playing);
  const speed = useHqStore((s) => s.speed);
  const setHour = useHqStore((s) => s.setHour);
  const togglePlay = useHqStore((s) => s.togglePlay);
  const setSpeed = useHqStore((s) => s.setSpeed);
  const on = isOnShift(hour);

  const workProgress = on ? (hour - COMPANY.shiftStart) / (COMPANY.shiftEnd - COMPANY.shiftStart) : hour < COMPANY.shiftStart ? 0 : 1;

  return (
    <div className="pointer-events-auto absolute top-[84px] right-2 w-[196px] rounded-hq-lg border border-hq-line bg-hq-panel p-3 backdrop-blur-xl md:top-28 md:right-5 md:w-[268px] md:p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.12em] whitespace-nowrap text-hq-muted md:text-xs">
          <Clock3 className="h-3.5 w-3.5 text-hq-cyan" />
          SIM CLOCK
        </div>
        <div
          className={cn(
            "flex items-center gap-1.5 rounded-full px-2 py-1 text-[9px] font-extrabold tracking-[0.08em] whitespace-nowrap md:px-2.5 md:text-[10px]",
            on ? "bg-hq-green/15 text-hq-green" : "bg-hq-amber/15 text-hq-amber",
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", on ? "animate-pulse-soft bg-hq-green" : "bg-hq-amber")} />
          {on ? "ON SHIFT" : "OFF SHIFT"}
        </div>
      </div>

      <div className="mt-1.5 flex items-end justify-between">
        <div className="font-display text-[34px] leading-none font-black tracking-tight text-hq-text tabular-nums md:text-[48px]">
          {formatHour(hour)}
        </div>
        <div className="hidden pb-1 text-right text-[10px] leading-tight font-semibold text-hq-muted md:block">
          {COMPANY.shift}
          <br />
          warehouse floor
        </div>
      </div>

      {/* workday progress */}
      <div className="mt-2.5">
        <div className="flex justify-between text-[9px] font-bold tracking-[0.12em] text-hq-muted">
          <span>09:00</span>
          <span className="hidden md:inline">{on ? "SHIFT PROGRESS" : "NEXT SHIFT 09:00"}</span>
          <span>17:00</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className={cn("h-full rounded-full transition-[width] duration-300", on ? "bg-gradient-to-r from-hq-cyan to-hq-green" : "bg-white/25")}
            style={{ width: `${Math.round(workProgress * 100)}%` }}
          />
        </div>
      </div>

      {/* time scrubber */}
      <input
        type="range"
        min={0}
        max={24}
        step={0.05}
        value={hour}
        onChange={(e) => setHour(Number(e.target.value))}
        aria-label="Time of day"
        className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-hq-cyan"
      />

      <div className="mt-2.5 flex items-center gap-1.5">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? "Pause time" : "Play time"}
          className="grid h-9 w-9 place-items-center rounded-hq-md bg-hq-cyan text-hq-bg transition-transform hover:scale-105 active:scale-95"
        >
          {playing ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="h-4 w-4" fill="currentColor" />}
        </button>
        {[0.08, 0.2, 0.6].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSpeed(s)}
            className={cn(
              "h-9 flex-1 rounded-hq-md border text-[11px] font-bold transition-colors",
              speed === s
                ? "border-hq-cyan/60 bg-hq-cyan/15 text-hq-cyan"
                : "border-hq-line bg-white/5 text-hq-muted hover:border-hq-cyan/40 hover:text-hq-text",
            )}
          >
            {s === 0.08 ? "0.5×" : s === 0.2 ? "1×" : "3×"}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setHour(10.5)}
          aria-label="Jump to morning"
          className="grid h-9 w-9 place-items-center rounded-hq-md border border-hq-line bg-white/5 text-hq-muted transition-colors hover:border-hq-cyan/40 hover:text-hq-text"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------- crew roster ---------------------------------- */

function CrewPanel() {
  const select = useHqStore((s) => s.select);
  const selection = useHqStore((s) => s.selection);
  const on = useHqStore((s) => isOnShift(s.hour));

  return (
    <div className="pointer-events-auto absolute inset-x-2 bottom-[86px] rounded-hq-lg border border-hq-line bg-hq-panel p-2.5 backdrop-blur-xl md:inset-x-auto md:bottom-24 md:left-5 md:w-[262px] md:p-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.12em] text-hq-muted">
          <Users className="h-3.5 w-3.5 text-hq-cyan" />
          THE CREW
        </div>
        <span className="text-[10px] font-bold tracking-[0.1em] text-hq-muted">6 AI AGENTS</span>
      </div>
      <ul className="mt-2 flex gap-1.5 overflow-x-auto pb-1 md:block md:space-y-1 md:overflow-visible md:pb-0">
        {AGENTS.map((a) => {
          const active = selection?.kind === "agent" && selection.id === a.id;
          return (
            <li key={a.id} className="min-w-[112px] md:min-w-0">
              <button
                type="button"
                onClick={() => select({ kind: "agent", id: a.id })}
                style={
                  {
                    "--agent": a.color,
                    ...(active ? { backgroundColor: `${a.color}22`, borderColor: a.color } : {}),
                  } as CSSProperties
                }
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-hq-md border px-2.5 py-2 text-left transition-colors",
                  active ? "border-transparent" : "border-transparent hover:border-hq-line hover:bg-white/5",
                )}
              >
                <span
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-black text-hq-bg"
                  style={{ background: a.color, boxShadow: `0 0 12px -2px ${a.color}` }}
                >
                  {a.name[0]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-extrabold tracking-[0.08em] text-hq-text">{a.name}</span>
                  <span className="hidden truncate text-[10px] font-medium text-hq-muted md:block">{a.role}</span>
                </span>
                <span
                  className={cn(
                    "hidden shrink-0 rounded-full px-1.5 py-0.5 text-[8.5px] font-black tracking-[0.08em] md:block",
                    on ? "bg-hq-green/15 text-hq-green" : "bg-white/10 text-hq-muted",
                  )}
                >
                  {on ? "WORKING" : "IDLE"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------------------------------- detail card ---------------------------------- */

function DetailCard() {
  const selection = useHqStore((s) => s.selection);
  const select = useHqStore((s) => s.select);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selection && ref.current) {
      ref.current.animate(
        [
          { opacity: 0, transform: "translateY(10px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        { duration: 260, easing: "cubic-bezier(.2,.7,.2,1)" },
      );
    }
  }, [selection]);

  if (!selection) {
    return (
      <div className="pointer-events-auto absolute inset-x-2 bottom-[86px] hidden max-h-[42vh] overflow-y-auto rounded-hq-lg border border-hq-line bg-hq-panel/80 p-4 backdrop-blur-xl lg:block lg:inset-x-auto lg:right-5 lg:top-[350px] lg:bottom-28 lg:max-h-none lg:w-[268px]">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.12em] text-hq-muted">
          <Sparkles className="h-3.5 w-3.5 text-hq-cyan" />
          EXPLORE THE FLOOR
        </div>
        <p className="mt-2 text-xs leading-relaxed text-hq-muted">
          Drag to orbit the warehouse, scroll to zoom, and click any agent or vehicle to inspect it. Scrub the clock to
          watch the 9-to-5 shift play out — the crew walks off the floor at 17:00.
        </p>
        <div className="mt-3 space-y-1.5 text-[11px] font-semibold text-hq-muted">
          <p className="flex items-center gap-2">
            <Bot className="h-3.5 w-3.5 text-hq-cyan" /> 6 AI agents on the clip pipeline
          </p>
          <p className="flex items-center gap-2">
            <Car className="h-3.5 w-3.5 text-hq-cyan" /> 6 employee vehicles in the lot
          </p>
          <p className="flex items-center gap-2">
            <Gauge className="h-3.5 w-3.5 text-hq-cyan" /> {STATS.clipsShipped.toLocaleString()} clips shipped today
          </p>
        </div>
      </div>
    );
  }

  const agent = selection.kind === "agent" ? AGENTS.find((a) => a.id === selection.id) : undefined;
  const vehicle = selection.kind === "vehicle" ? VEHICLES.find((v) => v.id === selection.id) : undefined;
  const owner = vehicle ? AGENTS.find((a) => a.id === vehicle.owner) : undefined;

  return (
    <div
      ref={ref}
      style={{ ["--agent" as string]: agent?.color ?? owner?.color ?? "#22d3ee" }}
      className="pointer-events-auto absolute inset-x-2 bottom-[86px] max-h-[46vh] overflow-y-auto rounded-hq-lg border border-hq-line bg-hq-panel backdrop-blur-xl md:inset-x-auto md:right-5 md:top-[350px] md:bottom-28 md:max-h-[calc(100vh-470px)] md:w-[268px] lg:max-h-none"
    >
      <div className="h-1 w-full bg-[var(--agent)]" />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span
              className="grid h-11 w-11 place-items-center rounded-hq-md text-lg font-black text-hq-bg"
              style={{ background: "var(--agent)", boxShadow: "0 0 18px -4px var(--agent)" }}
            >
              {agent ? agent.name[0] : vehicle ? vehicle.plate.slice(-1) : "?"}
            </span>
            <div>
              <p className="text-sm font-extrabold tracking-[0.1em] text-hq-text">
                {agent ? agent.name : vehicle?.name}
              </p>
              <p className="text-[11px] font-semibold" style={{ color: "var(--agent)" }}>
                {agent ? agent.role : vehicle ? KIND_LABEL[vehicle.kind] : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => select(null)}
            aria-label="Close details"
            className="grid h-7 w-7 place-items-center rounded-full text-hq-muted transition-colors hover:bg-white/10 hover:text-hq-text"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-2.5 text-xs leading-relaxed text-hq-muted">
          {agent ? agent.tagline : `${owner?.name}'s daily ride — parked in the ${COMPANY.name} lot during the 9-to-5 shift.`}
        </p>

        {agent && (
          <>
            <div className="mt-3 rounded-hq-md border border-hq-line bg-white/5 p-2.5">
              <div className="flex items-center gap-1.5 text-[9.5px] font-black tracking-[0.12em] text-hq-muted">
                <Zap className="h-3 w-3 text-hq-cyan" />
                CURRENT TASK
              </div>
              <p className="mt-1 text-xs font-semibold text-hq-text">{agent.task}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-hq-cyan to-[var(--agent)]"
                  style={{ width: `${Math.round(agent.progress * 100)}%` }}
                />
              </div>
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <Stat label="CLIPS TODAY" value={agent.clipsToday.toLocaleString()} />
              <Stat label="STATION" value={agent.station} small />
            </div>
            <div className="mt-2 flex items-center gap-2 rounded-hq-md border border-hq-line bg-white/5 px-2.5 py-2">
              <Car className="h-3.5 w-3.5 text-hq-muted" />
              <p className="text-[10.5px] font-semibold text-hq-muted">
                Parked ride: <span className="text-hq-text">{agent.vehicle}</span>
              </p>
            </div>
          </>
        )}

        {vehicle && (
          <>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Stat label="PLATE" value={vehicle.plate} />
              <Stat label="OWNER" value={owner?.name ?? "—"} />
            </div>
            <div className="mt-2 flex items-center gap-2 rounded-hq-md border border-hq-line bg-white/5 px-2.5 py-2">
              <MapPin className="h-3.5 w-3.5 text-hq-muted" />
              <p className="text-[10.5px] font-semibold text-hq-muted">
                Lot bay · <span className="text-hq-text">{owner?.role}</span>
              </p>
            </div>
            {owner && (
              <button
                type="button"
                onClick={() => select({ kind: "agent", id: owner.id })}
                className="mt-2.5 w-full rounded-hq-md border border-hq-line bg-white/5 py-2 text-xs font-bold text-hq-text transition-colors hover:border-[var(--agent)] hover:bg-white/10"
              >
                View {owner.name} →
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="rounded-hq-md border border-hq-line bg-white/5 px-2.5 py-2">
      <p className="text-[9px] font-black tracking-[0.12em] text-hq-muted">{label}</p>
      <p className={cn("font-bold text-hq-text", small ? "text-[11px] leading-snug" : "text-base")}>{value}</p>
    </div>
  );
}

/* ---------------------------------- ticker + view toggles ---------------------------------- */

function TickerBar() {
  const labels = useHqStore((s) => s.labels);
  const autoOrbit = useHqStore((s) => s.autoOrbit);
  const setLabels = useHqStore((s) => s.setLabels);
  const setAutoOrbit = useHqStore((s) => s.setAutoOrbit);

  return (
    <div className="absolute inset-x-0 bottom-0">
      <div className="pointer-events-auto mx-auto flex max-w-fit items-center gap-2 px-3 pb-2 md:px-5">
        <Toggle on={labels} onClick={() => setLabels(!labels)} label="Labels" />
        <Toggle on={autoOrbit} onClick={() => setAutoOrbit(!autoOrbit)} label="Auto-orbit" />
        <div className="hidden items-center gap-1.5 rounded-full border border-hq-line bg-hq-panel px-3 py-2 text-[10px] font-semibold text-hq-muted backdrop-blur-xl sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-hq-cyan" />
          Drag to orbit · scroll to zoom · click agents & vehicles
        </div>
      </div>
      <div className="overflow-hidden border-t border-hq-line bg-hq-bg/85 py-1.5 backdrop-blur-xl">
        <div className="ticker-track flex w-max gap-10 text-[10.5px] font-bold tracking-[0.16em] text-hq-muted">
          {[0, 1].map((k) => (
            <div key={k} className="flex gap-10">
              <span>CLIPS SHIPPED TODAY · <b className="text-hq-green">{STATS.clipsShipped.toLocaleString()}</b></span>
              <span>RENDER QUEUE · <b className="text-hq-amber">{STATS.renderQueue}</b></span>
              <span>AVG CLIP TIME · <b className="text-hq-cyan">{STATS.avgClipSec}s</b></span>
              <span>CHANNELS FED · <b className="text-hq-violet">{STATS.channelsFed}</b></span>
              <span>SHIFT · <b className="text-hq-text">{COMPANY.shift}</b></span>
              <span>AUTOMATION · <b className="text-hq-pink">CLIP · HOOK · CAPTION · COVER · SHIP</b></span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "rounded-full border px-3.5 py-2 text-[10.5px] font-bold tracking-[0.08em] backdrop-blur-xl transition-colors",
        on
          ? "border-hq-cyan/60 bg-hq-cyan/15 text-hq-cyan"
          : "border-hq-line bg-hq-panel text-hq-muted hover:text-hq-text",
      )}
    >
      {label}
    </button>
  );
}
