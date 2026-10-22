import { create } from "zustand";
import { STATS, type AgentId } from "@/lib/hq-data";
import {
  loadConnector,
  saveConnector,
  type ConnectorConfig,
} from "@/lib/hq-connector";
import { loadJSON, saveJSON } from "@/lib/hq-persist";
import { saveAutoDailyReport } from "@/lib/hq-report";
import {
  defaultProfiles,
  loadProfiles,
  saveProfiles,
  type AgentProfile,
} from "@/lib/hq-profiles";
import {
  dayFactors,
  isOnShift,
  realHourNow,
} from "@/lib/hq-store-helpers";
import type {
  ApprovalDecision,
  ApprovalRequest,
  ClipJob,
  FloorSnapshot,
  FloorStats,
} from "@/lib/hq-jobs";
import type { PovId } from "@/lib/hq-robots";

export type SelectableKind = "agent" | "vehicle" | "manager";
export type ViewMode = "auto" | "day" | "night";

export {
  isOnShift,
  formatHour,
  formatShort,
  timeAgo,
  dayFactors,
  realHourNow,
  tzLabel,
} from "@/lib/hq-store-helpers";
import { isOnShift as _isOnShift } from "@/lib/hq-store-helpers";
void _isOnShift;

export interface Selection {
  kind: SelectableKind;
  id: string;
}

export interface FeedEvent {
  id: number;
  ts: number;
  /** agent color dot when related to one hoodie */
  color?: string;
  kind: "job" | "ok" | "system";
  text: string;
}

/** A finished piece of work, archived so history survives the live snapshot. */
export interface WorkOutput {
  jobId: string;
  agentId: AgentId;
  title: string;
  finishedAt: number;
}

const OUTPUTS_KEY = "clipyard.outputs.v1";
const SETTINGS_KEY = "clipyard.settings.v1";
const MAX_OUTPUTS = 60;

interface Settings {
  demoShift: boolean;
  mode: ViewMode;
}

function loadSettings(): Settings {
  // defaults: office choreography on (the signature demo look), lighting
  // follows the real clock
  const settings: Settings = { demoShift: true, mode: "auto" };
  const raw = loadJSON<unknown>(SETTINGS_KEY, null);
  if (typeof raw === "object" && raw !== null) {
    const r = raw as { demoShift?: unknown; mode?: unknown };
    if ("demoShift" in r) settings.demoShift = r.demoShift !== false;
    if (r.mode === "auto" || r.mode === "day" || r.mode === "night") settings.mode = r.mode;
  }
  return settings;
}

const INITIAL_SETTINGS = loadSettings();

function loadOutputs(): WorkOutput[] {
  const raw = loadJSON<unknown>(OUTPUTS_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (o): o is WorkOutput =>
        typeof o === "object" &&
        o !== null &&
        typeof (o as WorkOutput).jobId === "string" &&
        typeof (o as WorkOutput).agentId === "string" &&
        typeof (o as WorkOutput).title === "string" &&
        typeof (o as WorkOutput).finishedAt === "number",
    )
    .slice(0, MAX_OUTPUTS);
}

interface HqState {
  /** real local clock (browser time), fractional hours 0–24 */
  hour: number;
  /** epoch ms of the last clock sync — drives the seconds/date display */
  nowTs: number;
  labels: boolean;
  autoOrbit: boolean;
  /** hide every HUD panel for a clean, reference-style diorama view (key H) */
  hudHidden: boolean;
  /**
   * 9–5 office choreography (Fase 7). ON = robots follow real office hours
   * (desks 09–17, standup 13:00, lounge after) purely as theater. OFF =
   * robot placement mirrors each agent's real work state (see agentActivity).
   * Jobs/data run 24/7 either way. Persisted.
   */
  demoShift: boolean;
  setDemoShift: (v: boolean) => void;
  /** lighting override: follow the real clock, force day, or force night */
  mode: ViewMode;
  selection: Selection | null;
  /** Fase 8/9: first-person camera rides this head — a robot, or the boss
      in his chair (null = isometric) */
  povTarget: PovId | null;
  setPovTarget: (id: PovId | null) => void;
  /** increments to request a camera focus (agents/vehicles + resets) */
  focusToken: number;
  /** increments to ask the camera to return to its starting corner */
  resetViewToken: number;
  /** live activity feed (newest first, bounded) */
  feed: FeedEvent[];
  /** total actions logged today (feed length counter for the stats bar) */
  actions: number;
  /** latest floor jobs + stats from the active FloorSource (mock or live) */
  jobs: ClipJob[];
  stats: FloorStats;
  /** pending human-in-the-loop approvals (filtered by local decisions) */
  approvals: ApprovalRequest[];
  /** decisions already sent from this browser — keeps decided ids out even
      if a stale poll still carries them */
  resolvedApprovals: Record<string, ApprovalDecision>;
  /** "sim" = built-in simulator, "live" = VITE_FLOOR_URL producer (e.g. n8n) */
  floorSource: "sim" | "live";
  /** epoch ms of the last accepted snapshot */
  floorUpdatedAt: number;
  /** configurable agent identities (Fase 6, persisted to localStorage) */
  profiles: Record<AgentId, AgentProfile>;
  /** real-pipeline connector settings (Fase 6, persisted to localStorage) */
  connector: ConnectorConfig;
  /** archived finished jobs, newest first (Fase 6, persisted) */
  outputs: WorkOutput[];
  updateProfile: (id: AgentId, patch: Partial<AgentProfile>) => void;
  resetProfiles: () => void;
  setConnector: (cfg: ConnectorConfig) => void;
  clearOutputs: () => void;
  clearFeed: () => void;
  applyFloorSnapshot: (s: FloorSnapshot) => void;
  /** local bookkeeping after posting a decision to the Floor API */
  resolveApproval: (id: string, decision: ApprovalDecision, label?: string) => void;
  /** append an activity-feed event (bounded, dedupes by exact text+minute) */
  pushEvent: (text: string, opts?: { color?: string; kind?: FeedEvent["kind"] }) => void;
  setLabels: (v: boolean) => void;
  setAutoOrbit: (v: boolean) => void;
  setHudHidden: (v: boolean) => void;
  setMode: (m: ViewMode) => void;
  select: (s: Selection | null) => void;
  requestFocus: () => void;
  requestResetView: () => void;
  /** sync `hour`/`nowTs` to the real browser clock (called ~1×/s) */
  syncClock: () => void;
}

let feedId = 1;
let lastAutoReportAt = 0;

export const useHqStore = create<HqState>((set, get) => ({
  hour: realHourNow(),
  nowTs: Date.now(),
  labels: true,
  autoOrbit: false,
  hudHidden: false,
  demoShift: INITIAL_SETTINGS.demoShift,
  setDemoShift: (v) => {
    saveJSON(SETTINGS_KEY, { demoShift: v, mode: get().mode });
    set({ demoShift: v });
    get().pushEvent(
      v
        ? "Mode Demo 9–5 menyala — robot mengikuti jam kantor"
        : "Mode Demo 9–5 mati — robot mengikuti status kerja nyata",
      { kind: "system" },
    );
  },
  // lighting follows the real clock by default; Terang/Gelap remain manual
  // overrides and the choice is persisted
  mode: INITIAL_SETTINGS.mode,
  selection: null,
  povTarget: null,
  setPovTarget: (id) => {
    const was = get().povTarget;
    set({ povTarget: id, selection: id ? null : get().selection });
    if (id && !was) {
      get().pushEvent(
        id === "manager"
          ? "POV aktif — duduk di kursi manajer"
          : `POV aktif — melihat dari mata ${get().profiles[id]?.name ?? id.toUpperCase()}`,
        { kind: "system" },
      );
    }
  },
  focusToken: 0,
  resetViewToken: 0,
  feed: [
    { id: feedId++, ts: Date.now(), kind: "system", color: "#6d28d9", text: "Studio online — Bay 7 siap produksi" },
  ],
  actions: 1,
  jobs: [],
  stats: { ...STATS, tokensOut: (STATS as FloorStats).tokensOut ?? 0 },
  approvals: [],
  resolvedApprovals: {},
  floorSource: "sim",
  floorUpdatedAt: 0,
  profiles: loadProfiles(),
  connector: loadConnector(),
  outputs: loadOutputs(),
  updateProfile: (id, patch) => {
    const next = { ...get().profiles, [id]: { ...get().profiles[id], ...patch, id } };
    saveProfiles(next);
    set({ profiles: next });
  },
  resetProfiles: () => {
    const fresh = defaultProfiles();
    saveProfiles(fresh);
    set({ profiles: fresh });
  },
  setConnector: (cfg) => {
    saveConnector(cfg);
    set({ connector: cfg });
  },
  clearOutputs: () => {
    saveJSON(OUTPUTS_KEY, []);
    set({ outputs: [] });
  },
  clearFeed: () => set({ feed: [] }),
  applyFloorSnapshot: (s) => {
    const st = get();
    const resolved = st.resolvedApprovals;
    // diff jobs → activity feed events + finished-work archive
    const prev = new Map(st.jobs.map((j) => [j.jobId, j] as const));
    const finished: WorkOutput[] = [];
    for (const j of s.jobs) {
      const before = prev.get(j.jobId);
      if (!before) {
        if (j.status === "queued" || j.status === "running") {
          st.pushEvent(`${j.title}`, { color: agentColor(j.agentId), kind: "job" });
        }
      } else if (before.status !== j.status) {
        if (j.status === "running") st.pushEvent(`${j.title} — mulai`, { color: agentColor(j.agentId), kind: "job" });
        if (j.status === "done") {
          st.pushEvent(`${j.title} ✔ selesai`, { color: agentColor(j.agentId), kind: "job" });
          finished.push({ jobId: j.jobId, agentId: j.agentId, title: j.title, finishedAt: s.ts });
        }
        if (j.status === "failed") st.pushEvent(`${j.title} ✖ gagal — perlu cek`, { color: agentColor(j.agentId), kind: "job" });
      }
    }
    // newly opened approvals → feed
    const prevApr = new Set(st.approvals.map((a) => a.id));
    for (const a of s.approvals ?? []) {
      if (!prevApr.has(a.id) && !resolved[a.id]) {
        st.pushEvent(`Minta OK: ${a.title}`, { color: agentColor(a.agentId), kind: "ok" });
      }
    }
    const outputs = finished.length
      ? [...finished, ...st.outputs.filter((o) => !finished.some((f) => f.jobId === o.jobId))].slice(0, MAX_OUTPUTS)
      : st.outputs;
    if (finished.length) saveJSON(OUTPUTS_KEY, outputs);
    set({
      jobs: s.jobs,
      stats: s.stats,
      floorSource: s.source,
      floorUpdatedAt: s.ts,
      approvals: (s.approvals ?? []).filter((a) => !resolved[a.id]),
      outputs,
    });
  },
  resolveApproval: (id, decision, label) => {
    get().pushEvent(
      `${label ?? "Permintaan"} ${decision === "approved" ? "disetujui ✓" : "ditolak ✖"} (kamu)`,
      { color: decision === "approved" ? "#047857" : "#e11d48", kind: "ok" },
    );
    set((state) => ({
      resolvedApprovals: { ...state.resolvedApprovals, [id]: decision },
      approvals: state.approvals.filter((a) => a.id !== id),
    }));
  },
  pushEvent: (text, opts) =>
    set((state) => {
      const ev: FeedEvent = {
        id: feedId++,
        ts: Date.now(),
        kind: opts?.kind ?? "job",
        color: opts?.color,
        text,
      };
      return { feed: [ev, ...state.feed].slice(0, 300), actions: state.actions + 1 };
    }),
  setLabels: (v) => set({ labels: v }),
  setAutoOrbit: (v) => set({ autoOrbit: v }),
  setHudHidden: (v) => set({ hudHidden: v }),
  setMode: (m) => {
    saveJSON(SETTINGS_KEY, { demoShift: get().demoShift, mode: m });
    set({ mode: m });
  },
  select: (s) => set({ selection: s, focusToken: get().focusToken + 1 }),
  requestFocus: () => set({ focusToken: get().focusToken + 1 }),
  requestResetView: () => set({ resetViewToken: get().resetViewToken + 1 }),
  syncClock: () => {
    const { hour } = get();
    const now = new Date();
    const next = realHourNow(now);
    set({ hour: next, nowTs: now.getTime() });
    // The 13:00 "standup" produces something useful (Fase 7): a daily report
    // filed into Dokumen. With the real clock this fires when local time
    // actually crosses 13:00 while HQ is open; the throttle guards against
    // tab sleep/wake jumps re-firing it.
    if (hour < 13 && next >= 13 && next > hour) {
      const t = Date.now();
      if (t - lastAutoReportAt > 10 * 60_000) {
        lastAutoReportAt = t;
        saveAutoDailyReport(get());
        get().pushEvent("Laporan harian otomatis dibuat → tersimpan di Dokumen", { kind: "system" });
      }
    }
  },
}));

function agentColor(id: string) {
  // follows the user's profile color so the feed/3D accents stay in sync
  return useHqStore.getState().profiles[id as AgentId]?.color ?? "#7a81a6";
}

/* ---------------------------------- derived helpers ---------------------------------- */

/** Daily stand-up: the whole crew gathers in the meeting room. */
export function isMeeting(hour: number) {
  return hour >= 13 && hour < 13.5;
}

/**
 * Lighting/window factors after the HUD view-mode override
 * (Otomatis = follow the real clock, Terang = always day, Gelap = always night).
 */
export function effectiveDayFactors(hour: number, mode: ViewMode) {
  const f = dayFactors(hour);
  if (mode === "day") return { daylight: 1, sunset: 0, night: 0 };
  if (mode === "night") return { daylight: 0, sunset: 0, night: 1 };
  return { daylight: f.daylight, sunset: f.sunset, night: 1 - f.daylight };
}

