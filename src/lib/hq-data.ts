/**
 * CLIPYARD — Autonomous Clip Factory · glass diorama HQ
 * Static content + the shared floor-plan constants for the 3D workspace.
 *
 * Redesign v3 ("referensi"): compact cutaway diorama, 2 solid walls only
 * (west windows + north TV wall), black-framed glass rooms on the east side,
 * 3 paired desk pods in the open area, white robots with agent-color accents.
 *
 * Floor plan (world units, room x∈[-8,8], z∈[-6,6], camera from south-east):
 *   ┌─ north wall (TV + whiteboard) ──────────────────┐
 *   │ windows │  open pods        │ MEETING (glass)   │
 *   │ (west)  │  P1 P4  P2        ├─ partition ───────┤
 *   │ credenza│       P3          │ REHAT  (glass)    │
 *   └────────── open cut (south) ───┴── glass ────────┘
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
  /** chair position at the desk pod (x, z) — the desk sits in front (facing dir) */
  desk: [number, number];
  /** facing yaw at the desk (radians; 0 = +z/south) */
  deskYaw: number;
  /** world position in the glass rest room while off-shift (x, z) */
  lounge: [number, number];
  /** base height of the lounge spot (sofa/beanbag seat vs floor cushion) */
  loungeY: number;
  /** facing yaw in the lounge */
  loungeYaw: number;
  /** short activity verb for the live nameplate (on shift) */
  verb: string;
}

/** Shared floor-plan constants (world.tsx + agents.tsx + sky.tsx all read these). */
export const ROOM = {
  W: 16,
  D: 12,
  H: 3.3,
  /** x of the glass line separating open area from the glass rooms */
  GLASS_X: 2.0,
  /** z of the glass partition between meeting (north) and rest (south) rooms */
  PARTITION_Z: -0.4,
  MEETING_DOOR_Z: -3.3,
  LOUNGE_DOOR_Z: 2.4,
  DOOR_W: 1.05,
  /** agent base height while seated on a desk/meeting chair */
  SEAT_Y: 0.44,
} as const;

/** Desk pods: [centerX, centerZ]. Each pod = 2 desks back-to-back (agents face ±z). */
export const PODS: Array<[number, number]> = [
  [-4.9, -3.6], // P1 window row back
  [-4.9, 0.4], //  P2 window row front
  [-0.7, 3.0], //  P3 front-center
];
/** Extra empty hot-desk pod (fills the room like the reference, monitors idle). */
export const SPARE_POD: [number, number] = [-0.7, -3.6];
/** agent chair offset from the pod center along z */
export const POD_SEAT_DZ = 1.18;

export const MEETING_TABLE = { x: 5.0, z: -3.3 } as const;
/** Standup seats around the meeting table (index → seat), north row then south row. */
export const MEETING_SEATS: Array<{ pos: [number, number]; yaw: number }> = [
  { pos: [3.85, -4.42], yaw: 0 },
  { pos: [5.0, -4.42], yaw: 0 },
  { pos: [6.15, -4.42], yaw: 0 },
  { pos: [3.85, -2.18], yaw: Math.PI },
  { pos: [5.0, -2.18], yaw: Math.PI },
  { pos: [6.15, -2.18], yaw: Math.PI },
];

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
    station: "Pod 1 · sisi selatan",
    vehicle: "Midnight-blue sedan",
    desk: [-4.9, -2.42],
    deskYaw: Math.PI,
    lounge: [7.05, 2.35],
    loungeY: 0.46,
    verb: "ng-routing",
    loungeYaw: -Math.PI / 2,
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
    station: "Pod 1 · sisi jendela",
    vehicle: "Teal render van",
    desk: [-4.9, -4.78],
    deskYaw: 0,
    lounge: [7.05, 3.45],
    loungeY: 0.46,
    verb: "ngedit",
    loungeYaw: -Math.PI / 2,
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
    station: "Pod 3 · depan",
    vehicle: "Sunrise-yellow hatch",
    desk: [-0.7, 1.82],
    deskYaw: 0,
    lounge: [5.6, 4.9],
    loungeY: 0.26,
    verb: "cari hook",
    loungeYaw: -2.0,
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
    station: "Pod 2 · sisi jendela",
    vehicle: "Mint city scooter",
    desk: [-4.9, -0.78],
    deskYaw: 0,
    lounge: [5.2, 2.2],
    loungeY: 0.06,
    verb: "nyusun caption",
    loungeYaw: Math.PI / 2,
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
    station: "Pod 2 · sisi selatan",
    vehicle: "Magenta sport hatch",
    desk: [-4.9, 1.58],
    deskYaw: Math.PI,
    lounge: [5.2, 3.5],
    loungeY: 0.06,
    verb: "desain cover",
    loungeYaw: Math.PI / 2,
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
    station: "Pod 3 · sisi selatan",
    vehicle: "Orange work pickup",
    desk: [-0.7, 4.18],
    deskYaw: Math.PI,
    lounge: [4.5, 5.0],
    loungeY: 0.26,
    verb: "rendering",
    loungeYaw: 2.6,
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
  /** world position (x, z) + yaw — on the west-wall credenza ("CREW GARAGE" mini) */
  pos: [number, number];
  yaw: number;
}

/** Credenza top the diecasts sit on (west wall, under the windows). */
export const CREDENZA = { x: -7.58, z: 3.55, topY: 0.62 } as const;

export const VEHICLES: VehicleInfo[] = [
  {
    id: "van-nova",
    owner: "nova",
    kind: "van",
    color: "#0ea5a4",
    name: "The Render Van",
    plate: "CLIP·024",
    pos: [-7.58, 2.2],
    yaw: 0,
  },
  {
    id: "sedan-akira",
    owner: "akira",
    kind: "sedan",
    color: "#1e3a8a",
    name: "Ops Sedan",
    plate: "CLIP·001",
    pos: [-7.58, 2.82],
    yaw: 0,
  },
  {
    id: "hatch-hook",
    owner: "hook",
    kind: "hatch",
    color: "#f59e0b",
    name: "Hook Hatch",
    plate: "CLIP·007",
    pos: [-7.58, 3.42],
    yaw: 0,
  },
  {
    id: "hatch-pixel",
    owner: "pixel",
    kind: "hatch",
    color: "#db2777",
    name: "Cover Cruiser",
    plate: "CLIP·012",
    pos: [-7.58, 4.02],
    yaw: 0,
  },
  {
    id: "pickup-bolt",
    owner: "bolt",
    kind: "pickup",
    color: "#ea580c",
    name: "Ship Truck",
    plate: "CLIP·077",
    pos: [-7.58, 4.62],
    yaw: 0,
  },
  {
    id: "scooter-lexa",
    owner: "lexa",
    kind: "scooter",
    color: "#10b981",
    name: "Sub Scooter",
    plate: "CLIP·009",
    pos: [-7.58, 5.18],
    yaw: 0.35,
  },
];

/** Aggregated floor stats for the ticker. */
export const STATS = {
  clipsShipped: 1284,
  renderQueue: 37,
  avgClipSec: 42,
  channelsFed: 46,
} as const;
