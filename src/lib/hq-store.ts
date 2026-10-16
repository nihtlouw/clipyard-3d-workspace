import { create } from "zustand";
import { STATS } from "@/lib/hq-data";
import type { ClipJob, FloorSnapshot, FloorStats } from "@/lib/hq-jobs";

export type SelectableKind = "agent" | "vehicle";

export interface Selection {
  kind: SelectableKind;
  id: string;
}

interface HqState {
  /** simulated clock, hours 0–24 */
  hour: number;
  playing: boolean;
  speed: number;
  labels: boolean;
  autoOrbit: boolean;
  selection: Selection | null;
  /** increments to request a camera focus (agents/vehicles + resets) */
  focusToken: number;
  /** latest floor jobs + stats from the active FloorSource (mock or live) */
  jobs: ClipJob[];
  stats: FloorStats;
  /** "sim" = built-in simulator, "live" = VITE_FLOOR_URL producer (e.g. n8n) */
  floorSource: "sim" | "live";
  /** epoch ms of the last accepted snapshot */
  floorUpdatedAt: number;
  applyFloorSnapshot: (s: FloorSnapshot) => void;
  setHour: (h: number) => void;
  togglePlay: () => void;
  setSpeed: (s: number) => void;
  setLabels: (v: boolean) => void;
  setAutoOrbit: (v: boolean) => void;
  select: (s: Selection | null) => void;
  requestFocus: () => void;
  tick: (deltaSec: number) => void;
}

export const useHqStore = create<HqState>((set, get) => ({
  hour: 10.5,
  playing: true,
  speed: 0.2,
  labels: true,
  autoOrbit: false,
  selection: null,
  focusToken: 0,
  jobs: [],
  stats: { ...STATS },
  floorSource: "sim",
  floorUpdatedAt: 0,
  applyFloorSnapshot: (s) =>
    set({
      jobs: s.jobs,
      stats: s.stats,
      floorSource: s.source,
      floorUpdatedAt: s.ts,
    }),
  setHour: (h) => set({ hour: ((h % 24) + 24) % 24 }),
  togglePlay: () => set({ playing: !get().playing }),
  setSpeed: (s) => set({ speed: s }),
  setLabels: (v) => set({ labels: v }),
  setAutoOrbit: (v) => set({ autoOrbit: v }),
  select: (s) => set({ selection: s, focusToken: get().focusToken + 1 }),
  requestFocus: () => set({ focusToken: get().focusToken + 1 }),
  tick: (deltaSec) => {
    const { playing, speed, hour } = get();
    if (!playing) return;
    const next = (hour + deltaSec * speed) % 24;
    set({ hour: next });
  },
}));

/** Shift helpers (Mon–Fri 09:00–17:00). */
export function isOnShift(hour: number) {
  return hour >= 9 && hour < 17;
}

export function formatHour(hour: number) {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour - Math.floor(hour)) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Sun/sky state for a simulated hour (0–24). */
export function dayFactors(hour: number) {
  const theta = ((hour - 6) / 12) * Math.PI;
  const sunY = Math.sin(theta);
  const daylight = Math.min(1, Math.max(0, sunY * 1.55));
  const night = 1 - daylight;
  const sunset = Math.min(1, Math.max(0, 1 - Math.abs(sunY) * 2.4));
  return { theta, sunY, daylight, night, sunset };
}
