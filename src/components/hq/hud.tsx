import { useEffect, useMemo, useReducer, useRef, useState, type CSSProperties } from "react";
import {
  Bot,
  Car,
  Check,
  ChevronLeft,
  Clock3,
  Crosshair,
  Inbox,
  MapPin,
  Maximize,
  Minimize,
  Moon,
  Pause,
  Play,
  RotateCcw,
  Sun,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { AGENTS, COMPANY, IDEAS, VEHICLES, type VehicleInfo } from "@/lib/hq-data";
import { currentJobFor } from "@/lib/hq-jobs";
import { formatHour, formatShort, isMeeting, isOnShift, timeAgo, useHqStore, type ViewMode } from "@/lib/hq-store";
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
  return (
    <div className="pointer-events-none fixed inset-0 z-50 select-none">
      {/* Responsive wrapper that adapts to viewport */}
      <div className="absolute inset-0 overflow-hidden">
        <TopBar />
        <ViewControls />
        <ActivityFeed />
        <ClockPanel />
        <BacklogPanel />
        <ApprovalInbox />
        <AgentCards />
        <DetailCard />
      </div>
      {/* Flexible overlay hint */}
      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-4 py-1 text-[10px] font-medium text-white/80 backdrop-blur-md lg:hidden">
        Seret • Putar • Zoom • Klik agen
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

  if (source !== "live") return <Chip color="#a78bfa">SIM</Chip>;
  const stale = updatedAt > 0 && Date.now() - updatedAt > 15_000;
  return <Chip color={stale ? "#fbbf24" : "#34d399"}>{stale ? "LIVE·STALE" : "LIVE"}</Chip>;
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
          <p className="truncate text-[9px] font-semibold text-[#98a1c4] sm:text-[10.5px]">AWAN7 Studio · 6 agen aktif</p>
        </div>
      </div>
      <div className="pointer-events-auto flex items-center gap-2">
        <SoundPill />
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
  const jobs = useHqStore((s) => s.jobs);
  const hour = useHqStore((s) => s.hour);
  const [, force] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    const id = window.setInterval(force, 1000);
    return () => window.clearInterval(id);
  }, [force]);

  const running = jobs.filter((j) => j.status === "running").length;
  const tokensOut = stats.tokensOut ?? stats.clipsShipped * 137;
  const wib = new Date().toLocaleTimeString("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const meeting = isMeeting(hour);

  return (
    <div className="pointer-events-auto absolute right-2 top-[4.5rem] hidden grid-cols-2 gap-1.5 min-[640px]:grid sm:right-3 sm:top-[4.6rem] sm:grid-cols-3 md:top-14 lg:top-[4.4rem]">
      <StatTile label="JAM WIB" value={wib} />
      <StatTile label="TOKEN KELUAR" value={formatShort(tokensOut)} />
      <StatTile label="TOKEN DIPROSES" value={running ? formatShort(running * 1400) : "0"} accent={running ? "#0ea5e9" : undefined} />
      <StatTile label="RAPAT BERIKUTNYA" value={meeting ? "SEKARANG" : "13.00"} accent={meeting ? "#34d399" : undefined} />
      <StatTile label="AKSI" value={formatShort(useHqStore((s) => s.actions))} />
      <StatTile label="SESI AKTIF" value={`${AGENTS.filter(() => isOnShift(hour)).length}/6`} />
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

  return (
    <>
      <StatsBar />
      <div className="pointer-events-auto absolute left-1/2 top-[3.5rem] flex -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 sm:top-3 md:top-[3.2rem]">
        <div className="flex items-center rounded-full border border-hq-line bg-hq-panel p-1 shadow-sm backdrop-blur-xl">
          {modes.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-bold transition-colors",
                mode === m.id ? "bg-[#f5b45e] text-[#20160a]" : "text-hq-muted hover:text-hq-text",
              )}
            >
              {m.icon}
              {m.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setLabels(!labels)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-[10.5px] font-bold shadow-sm backdrop-blur-xl transition-colors",
            labels ? "border-transparent bg-[#f5b45e] text-[#20160a]" : "border-hq-line bg-hq-panel text-hq-muted hover:text-hq-text",
          )}
        >
          Label
        </button>
        <button
          onClick={() => setAutoOrbit(!autoOrbit)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-[10.5px] font-bold shadow-sm backdrop-blur-xl transition-colors",
            autoOrbit ? "border-transparent bg-[#f5b45e] text-[#20160a]" : "border-hq-line bg-hq-panel text-hq-muted hover:text-hq-text",
          )}
        >
          Auto-sway
        </button>
        <button
          onClick={requestResetView}
          className="inline-flex items-center gap-1 rounded-full border border-hq-line bg-hq-panel px-3 py-1.5 text-[10.5px] font-bold text-hq-muted shadow-sm backdrop-blur-xl transition-colors hover:text-hq-text"
        >
          <RotateCcw className="h-3 w-3" /> Sudut awal
        </button>
        <button
          onClick={toggleFullscreen}
          className="hidden items-center gap-1 rounded-full border border-hq-line bg-hq-panel px-3 py-1.5 text-[10.5px] font-bold text-hq-muted shadow-sm backdrop-blur-xl transition-colors hover:text-hq-text md:inline-flex"
        >
          {full ? <Minimize className="h-3 w-3" /> : <Maximize className="h-3 w-3" />} Layar penuh
        </button>
      </div>
      <p className="pointer-events-none absolute bottom-[7rem] left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-full bg-white/10 px-3 py-1 text-[9.5px] font-semibold text-[#eef1ff]/70 shadow-sm backdrop-blur-md lg:block">
        seret • geser sudut • scroll/pinch zoom • klik robot • F layar penuh
      </p>
    </>
  );
}

/* ---------------------------------- activity feed (left) ---------------------------------- */

function ActivityFeed() {
  const feed = useHqStore((s) => s.feed);
  const [filter, setFilter] = useState<string | null>(null);
  const [, force] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    const id = window.setInterval(force, 30_000);
    return () => window.clearInterval(id);
  }, [force]);

  const shown = feed.filter((e) => !filter || e.color === filter).slice(0, 9);

  return (
    <div className="pointer-events-auto absolute left-2 top-[10rem] hidden w-[220px] rounded-2xl border border-white/10 bg-[#11162a]/88 p-3 shadow-[0_18px_40px_-20px_rgba(35,39,70,0.35)] backdrop-blur-2xl lg:left-3 lg:top-[12.5rem] lg:block lg:w-[248px]">
      <p className="text-[10px] font-bold tracking-[0.14em] text-[#98a1c4]">AKTIVITAS LANGSUNG</p>
      <div className="mt-1.5 flex flex-wrap gap-1">
        <button
          onClick={() => setFilter(null)}
          className={cn(
            "rounded-full border px-2 py-0.5 text-[9px] font-bold transition-colors",
            filter === null ? "border-transparent bg-[#f5b45e] text-[#20160a]" : "border-hq-line text-hq-muted hover:text-hq-text",
          )}
        >
          Semua
        </button>
        {AGENTS.map((a) => (
          <button
            key={a.id}
            onClick={() => setFilter(filter === a.color ? null : a.color)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold transition-colors",
              filter === a.color ? "border-transparent" : "border-hq-line text-hq-muted hover:text-hq-text",
            )}
            style={filter === a.color ? { backgroundColor: a.color, color: "#fff" } : undefined}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: filter === a.color ? "#fff" : a.color }} />
            {a.name}
          </button>
        ))}
      </div>
      <div className="mt-2 max-h-[32vh] space-y-1.5 overflow-y-auto pr-1 sm:max-h-[38vh]">
        {shown.map((e) => (
          <div key={e.id} className="flex items-start gap-1.5">
            <span
              className="mt-1 h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: e.color ?? "#7a81a6" }}
            />
            <p className="min-w-0 flex-1 text-[10.5px] font-semibold leading-snug text-hq-text">
              {e.kind === "system" ? <Zap className="mr-0.5 inline h-3 w-3 text-hq-violet" /> : null}
              {e.text}
            </p>
            <span className="shrink-0 text-[9px] font-semibold text-hq-muted">{timeAgo(e.ts)}</span>
          </div>
        ))}
        {shown.length === 0 && <p className="py-2 text-[10.5px] font-medium text-hq-muted">Belum ada aktivitas.</p>}
      </div>
    </div>
  );
}

/* ---------------------------------- sim clock (compact, right) ---------------------------------- */

function ClockPanel() {
  const hour = useHqStore((s) => s.hour);
  const playing = useHqStore((s) => s.playing);
  const speed = useHqStore((s) => s.speed);
  const setHour = useHqStore((s) => s.setHour);
  const togglePlay = useHqStore((s) => s.togglePlay);
  const setSpeed = useHqStore((s) => s.setSpeed);
  const on = isOnShift(hour);
  const shiftP = Math.min(1, Math.max(0, (hour - 9) / 8));

  return (
    <div className="pointer-events-auto absolute right-2 top-[20rem] hidden w-[220px] rounded-2xl border border-white/10 bg-[#11162a]/88 p-3 shadow-[0_18px_40px_-20px_rgba(35,39,70,0.35)] backdrop-blur-2xl md:right-3 md:block md:w-[236px] lg:top-[21.6rem]">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[0.14em] text-hq-muted">
          <Clock3 className="h-3.5 w-3.5" /> JAM SIM
        </span>
        <Chip color={on ? "#34d399" : "#a78bfa"}>{on ? "ON SHIFT" : "OFF SHIFT"}</Chip>
      </div>
      <div className="mt-0.5 flex items-baseline gap-2">
        <span className="font-mono text-[26px] font-extrabold leading-none tracking-tight text-hq-text">
          {formatHour(hour)}
        </span>
        <span className="text-[10px] font-semibold text-hq-muted">{COMPANY.shift}</span>
      </div>
      <input
        type="range"
        min={0}
        max={24}
        step={0.05}
        value={hour}
        onChange={(e) => setHour(Number(e.target.value))}
        aria-label="Scrub jam sim"
        className="hq-range mt-2 w-full"
        style={{ "--hq-range-p": `${shiftP * 100}%` } as CSSProperties}
      />
      <div className="mt-2 flex items-center gap-1.5">
        <button
          onClick={togglePlay}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f5b45e] text-[#20160a] transition-transform hover:scale-105"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
        </button>
        {[0.5, 1, 3].map((s) => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            className={cn(
              "h-7 rounded-lg px-2 text-[10.5px] font-bold transition-colors",
              speed === s ? "bg-[#f5b45e] text-[#20160a]" : "bg-hq-line/60 text-hq-muted hover:text-hq-text",
            )}
          >
            {s}×
          </button>
        ))}
        <span className="ml-auto text-[9px] font-bold tracking-[0.1em] text-hq-muted">09:00 — 17:00</span>
      </div>
    </div>
  );
}

/* ---------------------------------- approval inbox ---------------------------------- */

const AMBER = "#fbbf24";

function ApprovalInbox() {
  const approvals = useHqStore((s) => s.approvals);
  const resolve = useHqStore((s) => s.resolveApproval);
  const select = useHqStore((s) => s.select);
  const requestFocus = useHqStore((s) => s.requestFocus);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (approvals.length === 0) return null;

  const decide = async (a: (typeof approvals)[number], decision: "approved" | "rejected") => {
    setBusy(a.id);
    setError(null);
    const finish = () => {
      resolve(a.id, decision, a.title);
      select({ kind: "agent", id: a.agentId });
      requestFocus();
    };
    if (useHqStore.getState().floorSource === "sim") {
      finish();
      setBusy(null);
      return;
    }
    try {
      const res = await fetch(`/api/approvals/${encodeURIComponent(a.id)}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (res.status === 404) {
        finish();
        return;
      }
      if (!res.ok) throw new Error(`decision failed (${res.status})`);
      finish();
    } catch (err) {
      setError(err instanceof Error ? err.message : "gagal mengirim keputusan");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="pointer-events-auto absolute bottom-[8.5rem] right-2 hidden max-h-[46vh] w-[220px] overflow-y-auto rounded-2xl border border-[#f0d9a0]/40 bg-[#241b0e]/94 p-3 shadow-[0_18px_40px_-20px_rgba(180,83,9,0.5)] backdrop-blur-2xl md:right-3 md:block md:w-[236px]">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[0.14em]" style={{ color: AMBER }}>
          <Inbox className="h-3.5 w-3.5" /> APPROVAL INBOX
        </span>
        <span
          className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-extrabold text-[#20160a]"
          style={{ backgroundColor: AMBER }}
        >
          {approvals.length}
        </span>
      </div>
      <div className="mt-2 space-y-2">
        {approvals.map((a) => {
          const agent = AGENTS.find((x) => x.id === a.agentId);
          const isBusy = busy === a.id;
          return (
            <div key={a.id} className="rounded-xl border border-[#f0d9a0] bg-white/8 p-2.5">
              <div className="flex items-center gap-2">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold text-white"
                  style={{ backgroundColor: agent?.color }}
                >
                  {agent?.name[0]}
                </span>
                <p className="min-w-0 flex-1 truncate text-[11.5px] font-extrabold text-hq-text">{a.title}</p>
              </div>
              {a.detail && <p className="mt-1 text-[10px] font-medium leading-snug text-hq-muted">{a.detail}</p>}
              <div className="mt-2 flex items-center gap-1.5">
                <button
                  disabled={isBusy}
                  onClick={() => decide(a, "approved")}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#047857] py-1.5 text-[10.5px] font-bold text-white transition-transform hover:scale-[1.03] disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" /> Setujui
                </button>
                <button
                  disabled={isBusy}
                  onClick={() => decide(a, "rejected")}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#e11d48] py-1.5 text-[10.5px] font-bold text-white transition-transform hover:scale-[1.03] disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" /> Tolak
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {error && <p className="mt-1.5 text-[10px] font-semibold text-[#fb7185]">{error}</p>}
      <p className="mt-1 text-[9px] font-medium leading-snug text-hq-muted">
        Dibuka pipeline (n8n) via Floor API — keputusan langsung melanjutkan workflow.
      </p>
    </div>
  );
}

/* ---------------------------------- backlog (right) ---------------------------------- */

function BacklogPanel() {
  const jobs = useHqStore((s) => s.jobs);
  const approvals = useHqStore((s) => s.approvals);

  const deadline = useMemo(
    () =>
      jobs
        .filter((j) => j.status === "running" || j.status === "queued")
        .sort((a, b) => a.updatedAt - b.updatedAt)
        .slice(0, 4),
    [jobs],
  );
  const count = deadline.length + approvals.length + IDEAS.length;
  const agentOf = (id: string) => AGENTS.find((a) => a.id === id);

  return (
    <div className="pointer-events-auto absolute right-2 top-[32rem] hidden w-[220px] rounded-2xl border border-white/10 bg-[#11162a]/88 p-3 shadow-[0_18px_40px_-20px_rgba(35,39,70,0.35)] backdrop-blur-2xl md:right-3 md:block md:w-[236px] lg:top-[30rem]">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold tracking-[0.14em] text-hq-muted">BACKLOG</p>
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-hq-line/70 px-1.5 text-[10px] font-extrabold text-hq-text">
          {count}
        </span>
      </div>

      <p className="mt-2 text-[9px] font-bold tracking-[0.12em] text-[#fbbf24]">Deadline dekat · {deadline.length}</p>
      <div className="mt-1 space-y-1">
        {deadline.map((j) => {
          const a = agentOf(j.agentId);
          return (
            <div key={j.jobId} className="flex items-start gap-1.5">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: a?.color }} />
              <p className="min-w-0 flex-1 truncate text-[10.5px] font-semibold leading-snug text-hq-text">{j.title}</p>
              <span className="shrink-0 text-[9px] font-bold text-hq-muted">{j.status === "running" ? `${Math.round(j.progress * 100)}%` : " queued"}</span>
            </div>
          );
        })}
        {deadline.length === 0 && <p className="text-[10px] font-medium text-hq-muted">✓ Kosong — lantai bersih</p>}
      </div>

      <p className="mt-2.5 text-[9px] font-bold tracking-[0.12em] text-[#0ea5e9]">Nunggu owner · {approvals.length}</p>
      <div className="mt-1 space-y-1">
        {approvals.map((a) => (
          <p key={a.id} className="truncate text-[10.5px] font-semibold leading-snug text-hq-text">
            🔔 {a.title}
          </p>
        ))}
        {approvals.length === 0 && <p className="text-[10px] font-medium text-hq-muted">✓ Tidak ada</p>}
      </div>

      <p className="mt-2.5 text-[9px] font-bold tracking-[0.12em] text-hq-muted">Ide / nanti · {IDEAS.length}</p>
      <div className="mt-1 space-y-1">
        {IDEAS.map((idea) => (
          <p key={idea} className="truncate text-[10.5px] font-medium leading-snug text-hq-muted">
            ☁︎ {idea}
          </p>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------- agent cards (bottom) ---------------------------------- */

function AgentCards() {
  const jobs = useHqStore((s) => s.jobs);
  const approvals = useHqStore((s) => s.approvals);
  const feed = useHqStore((s) => s.feed);
  const hour = useHqStore((s) => s.hour);
  const select = useHqStore((s) => s.select);
  const on = isOnShift(hour);
  const meeting = isMeeting(hour);

  return (
    <div className="pointer-events-auto absolute bottom-2 left-1/2 flex w-[calc(100%-1rem)] max-w-[1200px] -translate-x-1/2 gap-1 overflow-x-auto pb-1 sm:gap-1.5 md:bottom-3 lg:bottom-4">
      {AGENTS.map((a) => {
        const job = currentJobFor(a.id, jobs);
        const waiting = approvals.some((ap) => ap.agentId === a.id);
        const failed = job?.status === "failed";
        const status = waiting
          ? { label: "WAITING OK", color: "#fbbf24" }
          : failed
            ? { label: "ERROR", color: "#e11d48" }
            : meeting
              ? { label: "RAPAT", color: "#0ea5e9" }
              : on
                ? { label: "KERJA", color: "#34d399" }
                : { label: "REHAT", color: "#a78bfa" };
        const task = failed
          ? `${job?.title ?? "Job gagal"} — pengisian ulang`
          : meeting
            ? "Standup harian di meeting room"
            : (job?.status === "running" || job?.status === "queued") && on
              ? job.title
              : on
                ? a.task
                : "Rehat di ruang rehat";
        const agentActions = feed.filter((e) => e.color === a.color).length;
        const tokens = a.clipsToday * 137 + Math.round((job?.progress ?? 0) * 1200);
        const ctx = 28_000 + Math.round(a.progress * 62_000);
        return (
          <button
            key={a.id}
            onClick={() => select({ kind: "agent", id: a.id })}
            className="min-w-[140px] shrink-0 flex-1 rounded-2xl border border-white/10 bg-[#11162a]/88 p-2 text-left shadow-[0_10px_24px_-12px_rgba(35,39,70,0.4)] backdrop-blur-xl transition hover:scale-[1.02] hover:shadow-[0_14px_30px_-12px_rgba(35,39,70,0.5)] sm:min-w-[168px] sm:p-2.5"
          >
            <div className="flex items-center gap-1.5">
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-extrabold text-white sm:h-6 sm:w-6 sm:text-[10px]"
                style={{ backgroundColor: a.color }}
              >
                {a.name[0]}
              </span>
              <span className="min-w-0 flex-1 truncate text-[10px] font-extrabold text-[#eef1ff] sm:text-[11.5px]">{a.name}</span>
              <span
                className="shrink-0 rounded-full px-1.5 py-0.5 text-[7px] font-bold tracking-[0.08em] sm:text-[8px]"
                style={{ backgroundColor: `${status.color}1c`, color: status.color }}
              >
                {status.label}
              </span>
            </div>
            <p className="mt-0.5 truncate text-[8px] font-medium leading-tight text-[#98a1c4] sm:mt-1 sm:text-[9.5px]">
              {a.role} · {a.name === "AKIRA" ? "Tim inti" : "Klip"}
            </p>
            <p className="mt-0.5 truncate text-[9px] font-bold leading-snug text-[#eef1ff] sm:mt-0.5 sm:text-[10.5px]">
              {status.label === "KERJA" ? "▶ " : "▸ "}
              {task}
            </p>
            <p className="mt-0.5 font-mono text-[7px] font-semibold text-[#98a1c4] sm:mt-1 sm:text-[8.5px]">
              {agentActions} aksi · {formatShort(tokens)} tok · {formatShort(ctx)} ctx
            </p>
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
    <div className="pointer-events-auto absolute bottom-[7.5rem] left-2 w-[200px] rounded-2xl border border-white/10 bg-[#11162a]/88 p-3 shadow-[0_18px_40px_-20px_rgba(35,39,70,0.45)] backdrop-blur-2xl sm:left-3 sm:w-[228px] sm:p-3.5 lg:bottom-[9rem] lg:w-[248px]">
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
          })()
        ) : null}
        <button
          onClick={() => select(null)}
          className="rounded-lg p-1 text-hq-muted transition-colors hover:bg-hq-line/60 hover:text-hq-text"
          aria-label="Tutup detail"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {agent &&
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
                  <span>TUGAS SAAT INI</span>
                  <Chip color={failed ? "#e11d48" : agent.color}>
                    {failed ? "FAILED" : queued ? "QUEUED" : on ? "LIVE" : "QUEUED"}
                  </Chip>
                </div>
                <p className="mt-1 text-[11px] font-bold leading-snug text-hq-text">{taskTitle}</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/12">
                  <div
                    className="h-full rounded-full transition-[width] duration-700"
                    style={{ width: `${Math.round(taskP * 100)}%`, backgroundColor: failed ? "#e11d48" : agent.color }}
                  />
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <div className="rounded-xl bg-hq-line/40 px-2.5 py-2">
                  <p className="text-[8.5px] font-bold tracking-[0.12em] text-hq-muted">KLIP HARI INI</p>
                  <p className="text-[12px] font-extrabold leading-tight text-hq-text">{agent.clipsToday.toLocaleString()}</p>
                </div>
                <div className="rounded-xl bg-hq-line/40 px-2.5 py-2">
                  <p className="text-[8.5px] font-bold tracking-[0.12em] text-hq-muted">STASIUN</p>
                  <p className="text-[12px] font-extrabold leading-tight text-hq-text">{agent.station}</p>
                </div>
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-[10.5px] font-semibold text-hq-muted">
                <Car className="h-3.5 w-3.5" /> {agent.vehicle} — rak CREW GARAGE
              </p>
            </>
          );
        })()}

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
