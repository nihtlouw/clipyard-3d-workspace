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
} from "@/lib/hq-store-helpers";
import type {
  ApprovalDecision,
  ApprovalRequest,
  ClipJob,
  FloorSnapshot,
  FloorStats,
} from "@/lib/hq-jobs";

export type SelectableKind = "agent" | "vehicle";
export type ViewMode = "auto" | "day" | "night";

export {
  isOnShift,
  formatHour,
  formatShort,
  timeAgo,
  dayFactors,
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

function loadDemoShift(): boolean {
  const raw = loadJSON<unknown>(SETTINGS_KEY, null);
  if (typeof raw === "object" && raw !== null && "demoShift" in raw) {
    return (raw as { demoShift?: unknown }).demoShift !== false;
  }
  return true; // default: office choreography on (it's the signature demo look)
}

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
  /** simulated clock, hours 0–24 */
  hour: number;
  playing: boolean;
  speed: number;
  labels: boolean;
  autoOrbit: boolean;
  /** hide every HUD panel for a clean, reference-style diorama view (key H) */
  hudHidden: boolean;
  /**
   * 9–5 office choreography (Fase 7). ON = robots follow the sim clock
   * (desks 09–17, standup 13:00, lounge after) purely as theater. OFF =
   * robot placement mirrors each agent's real work state (see agentActivity).
   * Jobs/data run 24/7 either way. Persisted.
   */
  demoShift: boolean;
  setDemoShift: (v: boolean) => void;
  /** lighting override: follow the sim clock, force day, or force night */
  mode: ViewMode;
  selection: Selection | null;
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
  setHour: (h: number) => void;
  togglePlay: () => void;
  setSpeed: (s: number) => void;
  setLabels: (v: boolean) => void;
  setAutoOrbit: (v: boolean) => void;
  setHudHidden: (v: boolean) => void;
  setMode: (m: ViewMode) => void;
  select: (s: Selection | null) => void;
  requestFocus: () => void;
  requestResetView: () => void;
  tick: (deltaSec: number) => void;
}

let feedId = 1;
let lastAutoReportAt = 0;

export const useHqStore = create<HqState>((set, get) => ({
  hour: 10.5,
  playing: true,
  speed: 0.2,
  labels: true,
  autoOrbit: false,
  hudHidden: false,
  demoShift: loadDemoShift(),
  setDemoShift: (v) => {
    saveJSON(SETTINGS_KEY, { demoShift: v });
    set({ demoShift: v });
    get().pushEvent(
      v
        ? "Mode Demo 9–5 menyala — robot mengikuti jam kantor"
        : "Mode Demo 9–5 mati — robot mengikuti status kerja nyata",
      { kind: "system" },
    );
  },
  // default to the reference look: warm night lighting while the crew is on shift
  mode: "night",
  selection: null,
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
  setHour: (h) => set({ hour: ((h % 24) + 24) % 24 }),
  togglePlay: () => set({ playing: !get().playing }),
  setSpeed: (s) => set({ speed: s }),
  setLabels: (v) => set({ labels: v }),
  setAutoOrbit: (v) => set({ autoOrbit: v }),
  setHudHidden: (v) => set({ hudHidden: v }),
  setMode: (m) => set({ mode: m }),
  select: (s) => set({ selection: s, focusToken: get().focusToken + 1 }),
  requestFocus: () => set({ focusToken: get().focusToken + 1 }),
  requestResetView: () => set({ resetViewToken: get().resetViewToken + 1 }),
  tick: (deltaSec) => {
    const { playing, speed, hour } = get();
    if (!playing) return;
    const next = (hour + deltaSec * speed) % 24;
    set({ hour: next });
    // The old 13:00 "standup" now produces something useful (Fase 7): a
    // daily report filed into Dokumen. Throttled in real time so cranking
    // the sim speed can't spam the document manager.
    if (hour < 13 && next >= 13 && next > hour) {
      const now = Date.now();
      if (now - lastAutoReportAt > 10 * 60_000) {
        lastAutoReportAt = now;
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
 * (Otomatis = follow sim clock, Terang = always day, Gelap = always night).
 */
export function effectiveDayFactors(hour: number, mode: ViewMode) {
  const f = dayFactors(hour);
  if (mode === "day") return { daylight: 1, sunset: 0, night: 0 };
  if (mode === "night") return { daylight: 0, sunset: 0, night: 1 };
  return { daylight: f.daylight, sunset: f.sunset, night: 1 - f.daylight };
}

