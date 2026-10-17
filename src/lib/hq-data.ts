/**
 * CLIPYARD — Autonomous Clip Factory · Warehouse HQ
 * Static content for the interactive 3D workspace model.
 */

export type AgentId = "akira" | "nova" | "hook" | "lexa" | "pixel" | "bolt";

export interface AgentInfo {
  id: AgentId;
  name: string;
  role: string;
  tagline: string;
  color: string;
  task: string;
  progress: number;
  clipsToday: number;
  station: string;
  vehicle: string;
  /** world position at the desk (x, z) */
  desk: [number, number];
  /** facing yaw at the desk (radians) */
  deskYaw: number;
  /** world position in the lounge while off-shift (x, z) */
  lounge: [number, number];
  /** base height of the lounge spot (sofa/beanbag seat vs floor) */
  loungeY: number;
  /** facing yaw in the lounge */
  loungeYaw: number;
  /** short activity verb for the live nameplate (on shift) */
  verb: string;
}

/** Backlog ideas shown in the HUD right panel (fun static copy). */
export const IDEAS = [
  "Template laporan otomatis per klien",
  "A/B hook baru untuk klip pendek",
  "Rapikan dokumentasi server render",
] as const;

export const COMPANY = {
  name: "CLIPYARD",
  tagline: "Autonomous Clip Factory",
  blurb:
    "Six AI agents turn long-form video into scroll-stopping clips — cutting, hooking, captioning, covering and shipping on a 9-to-5 shift from the Bay 7 studio floor.",
  address: "Bay 7 · The Foundry District",
  shift: "Mon–Fri · 09:00–17:00",
  shiftStart: 9,
  shiftEnd: 17,
} as const;

export const AGENTS: AgentInfo[] = [
  {
    id: "akira",
    name: "AKIRA",
    role: "Pipeline Orchestrator",
    tagline: "Routes every long-form into the clip queue and keeps the bays humming.",
    color: "#22d3ee",
    task: "Routing 128 long-forms into clip queues",
    progress: 0.72,
    clipsToday: 214,
    station: "Desk A2 · window row",
    vehicle: "Midnight-blue sedan",
    desk: [-2.5, -4.2],
    deskYaw: 0,
    lounge: [-0.6, 6.95],
    loungeY: 0.62,
    verb: "ng-routing",
    loungeYaw: Math.PI,
  },
  {
    id: "nova",
    name: "NOVA",
    role: "Auto-Editor",
    tagline: "Silence-trimmer and jump-cut surgeon. Frame-perfect, zero drama.",
    color: "#a78bfa",
    task: "Silence-trimming episode 214 · 42 clips",
    progress: 0.58,
    clipsToday: 389,
    station: "Desk A1 · window row",
    vehicle: "Teal render van",
    desk: [-7.5, -4.2],
    deskYaw: 0,
    lounge: [1.0, 6.95],
    loungeY: 0.62,
    verb: "ngedit",
    loungeYaw: Math.PI,
  },
  {
    id: "hook",
    name: "HOOK",
    role: "Hook & Title Smith",
    tagline: "Writes the first 3 seconds that decide if anyone keeps watching.",
    color: "#fbbf24",
    task: "Generating 500 thumbnail hooks for review",
    progress: 0.41,
    clipsToday: 512,
    station: "Desk A3 · window row",
    vehicle: "Sunrise-yellow hatch",
    desk: [2.5, -4.2],
    deskYaw: 0,
    lounge: [2.6, 6.4],
    loungeY: 0.42,
    verb: "cari hook",
    loungeYaw: -0.5,
  },
  {
    id: "lexa",
    name: "LEXA",
    role: "Caption Engine",
    tagline: "Karaoke captions, bilingual subs, and perfect emoji beats.",
    color: "#34d399",
    task: "Burning karaoke captions · ID/EN",
    progress: 0.86,
    clipsToday: 447,
    station: "Desk B1 · front row",
    vehicle: "Mint city scooter",
    desk: [-7.5, 0.6],
    deskYaw: 0,
    lounge: [4.2, 2.4],
    loungeY: 0,
    verb: "nyusun caption",
    loungeYaw: 1.9,
  },
  {
    id: "pixel",
    name: "PIXEL",
    role: "Thumbnail & Cover Artist",
    tagline: "A/B tests covers until the click-through curve bends upward.",
    color: "#f472b6",
    task: "A/B testing 12 cover variants",
    progress: 0.64,
    clipsToday: 178,
    station: "Desk B2 · front row",
    vehicle: "Magenta sport hatch",
    desk: [-2.5, 0.6],
    deskYaw: 0,
    lounge: [4.3, 4.35],
    loungeY: 0,
    verb: "desain cover",
    loungeYaw: 1.1,
  },
  {
    id: "bolt",
    name: "BOLT",
    role: "Render & Ship Bot",
    tagline: "Encodes, schedules and publishes while the others sleep.",
    color: "#fb923c",
    task: "Render queue: 37 clips · ETA 12m",
    progress: 0.33,
    clipsToday: 231,
    station: "Desk B3 · front row",
    vehicle: "Orange work pickup",
    desk: [2.5, 0.6],
    deskYaw: 0,
    lounge: [-2.5, 6.6],
    loungeY: 0.42,
    verb: "rendering",
    loungeYaw: -2.3,
  },
];

export type VehicleKind = "sedan" | "van" | "hatch" | "pickup" | "scooter";

export interface VehicleInfo {
  id: string;
  owner: AgentId;
  kind: VehicleKind;
  color: string;
  name: string;
  plate: string;
  /** world position (x, z) + yaw */
  pos: [number, number];
  yaw: number;
}

export const VEHICLES: VehicleInfo[] = [
  {
    id: "van-nova",
    owner: "nova",
    kind: "van",
    color: "#0ea5a4",
    name: "The Render Van",
    plate: "CLIP·024",
    pos: [7.2, 9.1],
    yaw: Math.PI / 2,
  },
  {
    id: "sedan-akira",
    owner: "akira",
    kind: "sedan",
    color: "#1e3a8a",
    name: "Ops Sedan",
    plate: "CLIP·001",
    pos: [6.4, 9.1],
    yaw: Math.PI / 2,
  },
  {
    id: "hatch-hook",
    owner: "hook",
    kind: "hatch",
    color: "#f59e0b",
    name: "Hook Hatch",
    plate: "CLIP·007",
    pos: [8.0, 9.1],
    yaw: Math.PI / 2,
  },
  {
    id: "hatch-pixel",
    owner: "pixel",
    kind: "hatch",
    color: "#db2777",
    name: "Cover Cruiser",
    plate: "CLIP·012",
    pos: [8.8, 9.1],
    yaw: Math.PI / 2,
  },
  {
    id: "pickup-bolt",
    owner: "bolt",
    kind: "pickup",
    color: "#ea580c",
    name: "Ship Truck",
    plate: "CLIP·077",
    pos: [9.6, 9.1],
    yaw: Math.PI / 2,
  },
  {
    id: "scooter-lexa",
    owner: "lexa",
    kind: "scooter",
    color: "#10b981",
    name: "Sub Scooter",
    plate: "CLIP·009",
    pos: [10.35, 9.25],
    yaw: Math.PI / 2 + 0.4,
  },
];

/** Aggregated floor stats for the ticker. */
export const STATS = {
  clipsShipped: 1284,
  renderQueue: 37,
  avgClipSec: 42,
  channelsFed: 46,
} as const;
