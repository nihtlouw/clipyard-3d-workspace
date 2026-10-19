import { create } from "zustand";
import { STATS } from "@/lib/hq-data";
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

interface HqState {
  /** simulated clock, hours 0–24 */
  hour: number;
  playing: boolean;
  speed: number;
  labels: boolean;
  autoOrbit: boolean;
  /** hide every HUD panel for a clean, reference-style diorama view (key H) */
  hudHidden: boolean;
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

export const useHqStore = create<HqState>((set, get) => ({
  hour: 10.5,
  playing: true,
  speed: 0.2,
  labels: true,
  autoOrbit: false,
  hudHidden: false,
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
  applyFloorSnapshot: (s) => {
    const st = get();
    const resolved = st.resolvedApprovals;
    // diff jobs → activity feed events
    const prev = new Map(st.jobs.map((j) => [j.jobId, j] as const));
    for (const j of s.jobs) {
      const before = prev.get(j.jobId);
      if (!before) {
        if (j.status === "queued" || j.status === "running") {
          st.pushEvent(`${j.title}`, { color: agentColor(j.agentId), kind: "job" });
        }
      } else if (before.status !== j.status) {
        if (j.status === "running") st.pushEvent(`${j.title} — mulai`, { color: agentColor(j.agentId), kind: "job" });
        if (j.status === "done") st.pushEvent(`${j.title} ✔ selesai`, { color: agentColor(j.agentId), kind: "job" });
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
    set({
      jobs: s.jobs,
      stats: s.stats,
      floorSource: s.source,
      floorUpdatedAt: s.ts,
      approvals: (s.approvals ?? []).filter((a) => !resolved[a.id]),
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
      return { feed: [ev, ...state.feed].slice(0, 40), actions: state.actions + 1 };
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
  },
}));

const AGENT_COLORS: Record<string, string> = {
  akira: "#22d3ee",
  nova: "#a78bfa",
  hook: "#fbbf24",
  lexa: "#34d399",
  pixel: "#f472b6",
  bolt: "#fb923c",
};
function agentColor(id: string) {
  return AGENT_COLORS[id] ?? "#7a81a6";
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

