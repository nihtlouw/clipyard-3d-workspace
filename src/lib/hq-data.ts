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
}

export const COMPANY = {
  name: "CLIPYARD",
  tagline: "Autonomous Clip Factory",
  blurb:
    "Six AI agents turn long-form video into scroll-stopping clips — cutting, hooking, captioning, covering and shipping 24/7 from a converted warehouse floor.",
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
    station: "Ops deck · center pod",
    vehicle: "Midnight-blue sedan",
    desk: [0, -3.5],
    deskYaw: 0,
    lounge: [-6.2, 2.4],
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
    station: "Edit pod · bay 2",
    vehicle: "Teal render van",
    desk: [-4.6, -3.5],
    deskYaw: 0,
    lounge: [-8.2, 2.9],
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
    station: "Copy pod · bay 3",
    vehicle: "Sunrise-yellow hatch",
    desk: [4.6, -3.5],
    deskYaw: 0,
    lounge: [-10, 3.6],
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
    station: "Sub pod · bay 4",
    vehicle: "Mint city scooter",
    desk: [-4.6, 2.6],
    deskYaw: Math.PI,
    lounge: [-10.6, 5.3],
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
    station: "Art pod · bay 5",
    vehicle: "Magenta sport hatch",
    desk: [0, 2.6],
    deskYaw: Math.PI,
    lounge: [-8.6, 5.6],
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
    station: "Render wall · bay 6",
    vehicle: "Orange work pickup",
    desk: [4.6, 2.6],
    deskYaw: Math.PI,
    lounge: [-6.6, 5.0],
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
    pos: [-10.5, 14.5],
    yaw: Math.PI,
  },
  {
    id: "sedan-akira",
    owner: "akira",
    kind: "sedan",
    color: "#1e3a8a",
    name: "Ops Sedan",
    plate: "CLIP·001",
    pos: [-5.2, 14.5],
    yaw: Math.PI,
  },
  {
    id: "hatch-hook",
    owner: "hook",
    kind: "hatch",
    color: "#f59e0b",
    name: "Hook Hatch",
    plate: "CLIP·007",
    pos: [0.1, 14.5],
    yaw: Math.PI,
  },
  {
    id: "hatch-pixel",
    owner: "pixel",
    kind: "hatch",
    color: "#db2777",
    name: "Cover Cruiser",
    plate: "CLIP·012",
    pos: [5.4, 14.5],
    yaw: Math.PI,
  },
  {
    id: "pickup-bolt",
    owner: "bolt",
    kind: "pickup",
    color: "#ea580c",
    name: "Ship Truck",
    plate: "CLIP·077",
    pos: [10.7, 14.5],
    yaw: Math.PI,
  },
  {
    id: "scooter-lexa",
    owner: "lexa",
    kind: "scooter",
    color: "#10b981",
    name: "Sub Scooter",
    plate: "CLIP·009",
    pos: [15.2, 13.2],
    yaw: Math.PI * 0.7,
  },
];

/** Aggregated floor stats for the ticker. */
export const STATS = {
  clipsShipped: 1284,
  renderQueue: 37,
  avgClipSec: 42,
  channelsFed: 46,
} as const;
