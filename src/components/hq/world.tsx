/**
 * CLIPYARD HQ — glass diorama (redesign v3, following the reference render).
 *
 * Compact cutaway box on a dark slab: west window wall + north TV wall only,
 * black-framed glass rooms along the east side (meeting north, rest south),
 * 3 paired desk pods + 1 spare hot-desk pod in the open area, warm wood
 * floor, tripod lamp in the apex. MeshStandardMaterial + one shadow-casting
 * key light (see sky.tsx) for the reference's soft cinematic depth.
 *
 * Static geometry is merged per material; canvas textures (skyline, screens,
 * whiteboard, TV) redraw on gated ticks only.
 */
import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  AGENTS,
  CREDENZA,
  MANAGER,
  MEETING_SEATS,
  MEETING_TABLE,
  PODS,
  POD_SEAT_DZ,
  ROOM,
  SPARE_POD,
  VEHICLES,
  type AgentInfo,
  type VehicleInfo,
} from "@/lib/hq-data";
import { currentJobFor } from "@/lib/hq-jobs";
import { effectiveDayFactors, isOnShift, useHqStore } from "@/lib/hq-store";
import {
  createBlobShadow,
  createDarkSign,
  createDeskLabel,
  createFloorWood,
  createGlowSprite,
  createManagerScreen,
  createMeetingScreen,
  createRug,
  createScreen,
  createSkyline,
  createVendingFront,
  createWhiteboard,
} from "@/lib/hq-textures";

/* ---------------------------------- palette ---------------------------------- */

const INK = "#232746";

/* ---------------------------------- geometry helpers ---------------------------------- */

function boxAt(w: number, h: number, d: number, x: number, y: number, z: number, ry = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return g;
}

function cylAt(
  rt: number, rb: number, h: number, seg: number,
  x: number, y: number, z: number, rx = 0, rz = 0,
) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  if (rx) g.rotateX(rx);
  if (rz) g.rotateZ(rz);
  g.translate(x, y, z);
  return g;
}

/** Box expressed in a local frame (origin cx/cz, yaw), local +z = facing dir. */
function boxLocal(
  cx: number, cz: number, yaw: number,
  lx: number, y: number, lz: number,
  w: number, h: number, d: number,
) {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const wx = cx + lx * cos + lz * sin;
  const wz = cz - lx * sin + lz * cos;
  return boxAt(w, h, d, wx, y, wz, yaw);
}

/** World position of a local-frame point (for JSX props like screens/labels). */
function localPoint(cx: number, cz: number, yaw: number, lx: number, lz: number): [number, number] {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return [cx + lx * cos + lz * sin, cz - lx * sin + lz * cos];
}

function merge(list: THREE.BufferGeometry[]) {
  if (list.length === 0) return new THREE.BoxGeometry(0.001, 0.001, 0.001);
  const merged = mergeGeometries(list, false);
  list.forEach((g) => g.dispose());
  if (!merged) throw new Error("merge failed");
  merged.computeBoundingSphere();
  return merged;
}

type Buckets = Record<string, THREE.BufferGeometry[]>;
function newBuckets(keys: string[]): Buckets {
  const b: Buckets = {};
  keys.forEach((k) => (b[k] = []));
  return b;
}

/* ---------------------------------- workstation builder ---------------------------------- */

interface SeatSpec {
  pos: [number, number];
  yaw: number;
}

/** One desk + monitor + chair in front of a seat. Desk center is seat + facing·0.78. */
function buildWorkstation(b: Buckets, seat: SeatSpec) {
  const [x, z] = seat.pos;
  const yaw = seat.yaw;
  const L = (lx: number, y: number, lz: number, w: number, h: number, d: number) =>
    boxLocal(x, z, yaw, lx, y, lz, w, h, d);

  // desk: light-wood top, grey drawer pedestal (left), panel leg (right), spine
  b.wood.push(L(0, 0.74, 0.78, 1.7, 0.07, 0.8));
  b.pedestal.push(L(-0.52, 0.36, 0.78, 0.52, 0.7, 0.68));
  b.black.push(L(-0.52, 0.52, 0.43, 0.3, 0.03, 0.02)); // drawer handle slit
  b.pedestal.push(L(0.8, 0.36, 0.78, 0.06, 0.7, 0.7));
  b.black.push(L(0, 0.52, 1.16, 1.62, 0.44, 0.04)); // modesty/spine panel

  // monitor near the spine, facing the seat
  b.black.push(L(0, 0.79, 1.0, 0.36, 0.03, 0.24)); // foot
  b.black.push(L(0, 0.9, 1.05, 0.07, 0.22, 0.07)); // stand
  b.black.push(L(0, 1.09, 1.07, 0.8, 0.5, 0.045)); // body (screen plane is separate)

  // keyboard + paper stack
  b.dark.push(L(0, 0.785, 0.56, 0.5, 0.025, 0.18));
  b.white.push(L(0.58, 0.785, 0.8, 0.3, 0.02, 0.4));

  // office chair at the seat: cushion, back, pole, 5-star
  b.chair.push(L(0, 0.47, 0, 0.52, 0.08, 0.5));
  const back = new THREE.BoxGeometry(0.5, 0.56, 0.07);
  back.rotateX(-0.1);
  back.rotateY(yaw);
  const [bx, bz] = localPoint(x, z, yaw, 0, -0.27);
  back.translate(bx, 0.84, bz);
  b.chair.push(back);
  b.black.push(cylAt(0.03, 0.03, 0.4, 8, x, 0.24, z));
  for (let k = 0; k < 5; k++) {
    const a = yaw + (k / 5) * Math.PI * 2 + 0.4;
    b.black.push(boxAt(0.3, 0.03, 0.05, x + Math.sin(a) * 0.15, 0.05, z + Math.cos(a) * 0.15, -a));
  }
}

/** Simple meeting chair at a seat. */
function buildMeetingChair(b: Buckets, seat: SeatSpec) {
  const [x, z] = seat.pos;
  const yaw = seat.yaw;
  b.chair.push(boxLocal(x, z, yaw, 0, 0.47, 0, 0.48, 0.07, 0.46));
  b.chair.push(boxLocal(x, z, yaw, 0, 0.78, -0.24, 0.48, 0.5, 0.06));
  b.black.push(cylAt(0.03, 0.03, 0.42, 8, x, 0.23, z));
  b.black.push(cylAt(0.26, 0.28, 0.03, 14, x, 0.03, z));
}

/* ---------------------------------- glass walls ---------------------------------- */

const GLASS_H = 3.02;

/**
 * One axis-aligned glass wall from (x0,z0) to (x1,z1) with black frames.
 * `doors` = center positions (in the wall's free axis) of 1.05-wide openings.
 */
function buildGlassWall(
  b: Buckets,
  x0: number, z0: number, x1: number, z1: number,
  doors: number[] = [],
) {
  const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  const a0 = alongX ? x0 : z0;
  const a1 = alongX ? x1 : z1;
  const fixed = alongX ? z0 : x0;
  const lo = Math.min(a0, a1);
  const hi = Math.max(a0, a1);
  const len = hi - lo;
  const at = (a: number): [number, number] => (alongX ? [a, fixed] : [fixed, a]);
  const span = (aMid: number, w: number, h: number, y: number, thick: number) => {
    const [px, pz] = at(aMid);
    return alongX ? boxAt(w, h, thick, px, y, pz) : boxAt(thick, h, w, px, y, pz);
  };

  // rails
  b.frame.push(span(lo + len / 2, len, 0.12, GLASS_H - 0.02, 0.09));
  b.frame.push(span(lo + len / 2, len, 0.1, 0.05, 0.09));

  // posts every ≤1.6, plus door jambs
  const posts = new Set<number>([lo, hi]);
  const n = Math.max(1, Math.round(len / 1.6));
  for (let i = 1; i < n; i++) posts.add(lo + (len / n) * i);
  for (const d of doors) {
    posts.add(d - ROOM.DOOR_W / 2);
    posts.add(d + ROOM.DOOR_W / 2);
  }
  const sorted = [...posts].sort((p, q) => p - q);
  for (const p of sorted) b.frame.push(span(p, 0.09, GLASS_H, GLASS_H / 2, 0.09));

  // panes between posts; door spans only get a header pane + handle + slider panel
  for (let i = 0; i < sorted.length - 1; i++) {
    const p0 = sorted[i];
    const p1 = sorted[i + 1];
    const mid = (p0 + p1) / 2;
    const w = p1 - p0 - 0.09;
    if (w <= 0.02) continue;
    const isDoor = doors.some((d) => Math.abs(mid - d) < ROOM.DOOR_W / 2 + 0.01);
    if (isDoor) {
      b.glass.push(span(mid, w, 0.52, 2.68, 0.04)); // header above the opening
      const [hx, hz] = at(mid + ROOM.DOOR_W / 2 - 0.14);
      b.frame.push(cylAt(0.028, 0.028, 0.85, 8, hx, 1.25, hz)); // handle
    } else {
      b.glass.push(span(mid, w, GLASS_H - 0.24, GLASS_H / 2, 0.04));
    }
  }
}

/* ---------------------------------- shell + furniture geometry ---------------------------------- */

function useRoomGeometries() {
  return useMemo(() => {
    const b = newBuckets([
      "wall", "slab", "frame", "glass", "wood", "woodDark", "pedestal", "black",
      "dark", "chair", "white", "sofa", "sofaLight", "cream", "terra", "sage", "potW",
    ]);

    /* ---- slab (dark diorama base, like the reference floating box) ---- */
    b.slab.push(boxAt(ROOM.W + 0.9, 0.55, ROOM.D + 0.9, ROOM.CX, -0.28, 0));

    /* ---- north wall (solid, cream) ---- */
    b.wall.push(boxAt(ROOM.W + 0.7, ROOM.H, 0.35, ROOM.CX, ROOM.H / 2, -ROOM.D / 2 - 0.17));
    b.wall.push(boxAt(ROOM.W + 0.7, 0.14, 0.52, ROOM.CX, ROOM.H + 0.05, -ROOM.D / 2 - 0.17)); // cornice
    b.white.push(boxAt(ROOM.W, 0.18, 0.05, ROOM.CX, 0.09, -ROOM.D / 2 + 0.03)); // baseboard

    /* ---- west wall with 3 window openings ---- */
    const WIN = [-3.9, -0.7, 2.5]; // centers (z), each 2.4 wide, sill .95 → top 2.65
    const wx = ROOM.X_MIN - 0.17;
    b.wall.push(boxAt(0.35, 0.95, ROOM.D + 0.7, wx, 0.475, 0)); // below sills
    b.wall.push(boxAt(0.35, ROOM.H - 2.65, ROOM.D + 0.7, wx, (ROOM.H + 2.65) / 2, 0)); // above
    b.wall.push(boxAt(0.52, 0.14, ROOM.D + 0.7, wx, ROOM.H + 0.05, 0)); // cornice
    const pillars: Array<[number, number]> = [[-6.35, -5.1], [-2.7, -1.9], [0.5, 1.3], [3.7, 6.35]];
    for (const [z0, z1] of pillars) {
      b.wall.push(boxAt(0.35, 1.7, z1 - z0, wx, 1.8, (z0 + z1) / 2));
    }
    b.white.push(boxAt(0.05, 0.18, ROOM.D, wx + 0.2, 0.09, 0));
    // window frames + mullions + sills (dark, like the reference)
    for (const cz of WIN) {
      b.frame.push(
        boxAt(0.1, 0.09, 2.5, wx, 0.98, cz),
        boxAt(0.1, 0.09, 2.5, wx, 2.62, cz),
        boxAt(0.1, 1.7, 0.09, wx, 1.8, cz - 1.2),
        boxAt(0.1, 1.7, 0.09, wx, 1.8, cz + 1.2),
        boxAt(0.06, 1.7, 0.05, wx, 1.8, cz),
        boxAt(0.06, 0.05, 2.4, wx, 1.8, cz),
      );
      b.white.push(boxAt(0.34, 0.06, 2.56, wx + 0.22, 0.97, cz)); // sill ledge
    }

    /* ---- glass rooms (west line + partition + east wing + south) ---- */
    buildGlassWall(b, ROOM.GLASS_X, -6, ROOM.GLASS_X, 6, [ROOM.MEETING_DOOR_Z, ROOM.LOUNGE_DOOR_Z]);
    buildGlassWall(b, ROOM.GLASS_X, ROOM.PARTITION_Z, ROOM.X_MAX, ROOM.PARTITION_Z);
    // Fase 8: manager office west wall (north segment only — the rest room
    // flows east into the pantry corner where this line stays open)
    buildGlassWall(b, ROOM.BOSS_X, -6, ROOM.BOSS_X, ROOM.PARTITION_Z, [ROOM.BOSS_DOOR_Z]);
    buildGlassWall(b, ROOM.X_MAX, -6, ROOM.X_MAX, 6);
    buildGlassWall(b, ROOM.GLASS_X, 6, ROOM.X_MAX, 6);

    /* ---- 6 agent workstations + spare hot-desk pod ---- */
    for (const a of AGENTS) buildWorkstation(b, { pos: a.desk, yaw: a.deskYaw });
    buildWorkstation(b, { pos: [SPARE_POD[0], SPARE_POD[1] - POD_SEAT_DZ], yaw: 0 });
    buildWorkstation(b, { pos: [SPARE_POD[0], SPARE_POD[1] + POD_SEAT_DZ], yaw: Math.PI });

    /* ---- meeting room ---- */
    const mt = MEETING_TABLE;
    b.wood.push(boxAt(3.4, 0.08, 1.5, mt.x, 0.74, mt.z));
    b.black.push(boxAt(0.18, 0.7, 1.2, mt.x - 1.4, 0.35, mt.z), boxAt(0.18, 0.7, 1.2, mt.x + 1.4, 0.35, mt.z));
    for (const s of MEETING_SEATS) buildMeetingChair(b, s);
    b.white.push(cylAt(0.15, 0.15, 0.05, 14, mt.x, 0.8, mt.z)); // speakerphone
    // 3 laptops on the table
    for (const [lx, ry] of [[mt.x - 1.0, 0.15], [mt.x + 0.2, -0.1], [mt.x + 1.1, Math.PI + 0.2]] as const) {
      b.pedestal.push(boxAt(0.36, 0.02, 0.26, lx, 0.79, mt.z + (ry > 1 ? 0.3 : -0.3), ry));
      b.black.push(boxAt(0.36, 0.24, 0.02, lx, 0.9, mt.z + (ry > 1 ? 0.42 : -0.42), ry));
    }
    // low bench under the TV + TV frame
    b.pedestal.push(boxAt(3.0, 0.42, 0.45, mt.x, 0.21, -5.62));
    b.black.push(boxAt(3.25, 1.9, 0.1, mt.x, 2.02, -5.9));

    /* ---- rest room (glass lounge) ---- */
    // sofa along the east glass, facing west
    b.sofa.push(boxAt(0.95, 0.5, 2.35, 7.28, 0.4, 2.9));
    b.sofa.push(boxAt(0.26, 0.85, 2.35, 7.66, 0.78, 2.9));
    b.sofa.push(boxAt(0.95, 0.62, 0.26, 7.28, 0.66, 1.66), boxAt(0.95, 0.62, 0.26, 7.28, 0.66, 4.14));
    b.sofaLight.push(boxAt(0.78, 0.16, 0.98, 7.2, 0.66, 2.35), boxAt(0.78, 0.16, 0.98, 7.2, 0.66, 3.45));
    b.cream.push(boxAt(0.16, 0.36, 0.36, 7.45, 0.85, 2.0, 0.2), boxAt(0.16, 0.36, 0.36, 7.45, 0.85, 3.85, -0.15));
    // coffee table
    b.wood.push(boxAt(0.95, 0.05, 0.55, 6.15, 0.34, 2.9));
    b.black.push(boxAt(0.06, 0.32, 0.45, 5.85, 0.16, 2.9), boxAt(0.06, 0.32, 0.45, 6.45, 0.16, 2.9));
    // floor cushions (LEXA / PIXEL spots)
    b.sage.push(cylAt(0.44, 0.48, 0.14, 16, 5.2, 0.07, 2.2));
    b.terra.push(cylAt(0.44, 0.48, 0.14, 16, 5.2, 0.07, 3.5));
    // lounge floor lamp pole (shade is a separate emissive mesh)
    b.black.push(cylAt(0.03, 0.03, 1.45, 8, 7.5, 0.72, 1.05), cylAt(0.16, 0.19, 0.04, 12, 7.5, 0.03, 1.05));

    /* ---- Fase 8: Ruang Manajer (east wing, north) ---- */
    {
      const [dx, dz] = MANAGER.desk;
      // executive desk: dark-wood top spanning z, twin pedestals, modesty panel
      b.woodDark.push(boxAt(0.95, 0.07, 2.3, dx, 0.76, dz));
      b.pedestal.push(boxAt(0.8, 0.72, 0.5, dx, 0.36, dz - 1.0), boxAt(0.8, 0.72, 0.5, dx, 0.36, dz + 1.0));
      b.black.push(boxAt(0.04, 0.4, 2.2, dx - 0.45, 0.5, dz));
      // desk props: paper sheet + mug
      b.white.push(boxAt(0.3, 0.02, 0.42, dx - 0.15, 0.805, dz + 0.75, 0.2));
      b.cream.push(cylAt(0.05, 0.045, 0.1, 10, dx - 0.2, 0.85, dz - 0.75));
      // high-back executive chair (seat frame faces -x, toward the guests/team)
      const [cx, cz] = MANAGER.chair;
      const cy = MANAGER.chairYaw;
      const CL = (lx: number, y: number, lz: number, w: number, h: number, d: number) =>
        boxLocal(cx, cz, cy, lx, y, lz, w, h, d);
      b.chair.push(CL(0, 0.48, 0, 0.56, 0.09, 0.54));
      b.chair.push(CL(0, 0.85, -0.28, 0.54, 0.62, 0.08));
      b.chair.push(CL(0, 1.28, -0.3, 0.34, 0.22, 0.07)); // headrest
      b.black.push(CL(-0.32, 0.66, 0.02, 0.07, 0.05, 0.4), CL(0.32, 0.66, 0.02, 0.07, 0.05, 0.4));
      b.black.push(cylAt(0.035, 0.035, 0.42, 8, cx, 0.24, cz));
      for (let k = 0; k < 5; k++) {
        const a = cy + (k / 5) * Math.PI * 2 + 0.4;
        b.black.push(boxAt(0.32, 0.03, 0.05, cx + Math.sin(a) * 0.16, 0.05, cz + Math.cos(a) * 0.16, -a));
      }
      // two guest chairs facing the desk
      buildMeetingChair(b, { pos: [dx - 1.0, dz - 0.7], yaw: Math.PI / 2 });
      buildMeetingChair(b, { pos: [dx - 1.0, dz + 0.7], yaw: Math.PI / 2 });
      // credenza under the north wall + books + trophy
      b.white.push(boxAt(2.6, 0.58, 0.5, 10.6, 0.29, -5.68));
      b.wood.push(boxAt(2.7, 0.05, 0.56, 10.6, 0.61, -5.68));
      const bookH = [0.3, 0.36, 0.28, 0.34, 0.3, 0.38];
      const bookBuckets = [b.sage, b.terra, b.cream, b.sage, b.cream, b.terra];
      bookH.forEach((h, i) => bookBuckets[i].push(boxAt(0.09, h, 0.24, 9.62 + i * 0.115, 0.64 + h / 2, -5.68)));
      b.terra.push(cylAt(0.09, 0.14, 0.3, 10, 11.5, 0.79, -5.68));
      b.cream.push(cylAt(0.05, 0.05, 0.08, 8, 11.5, 0.98, -5.68));
      // bookshelf against the west glass
      b.woodDark.push(boxAt(0.32, 2.0, 0.05, 8.32, 1.0, -5.35), boxAt(0.32, 2.0, 0.05, 8.32, 1.0, -3.75));
      b.black.push(boxAt(0.04, 2.0, 1.65, 8.18, 1.0, -4.55));
      for (const sy of [0.25, 0.85, 1.45, 1.98]) {
        b.woodDark.push(boxAt(0.32, 0.05, 1.65, 8.32, sy, -4.55));
      }
      [0.25, 0.85, 1.45].forEach((sy, row) => {
        for (let i = 0; i < 5; i++) {
          const bk = [b.sage, b.terra, b.cream][(i + row) % 3];
          bk.push(boxAt(0.2, 0.3, 0.09, 8.32, sy + 0.18, -5.12 + i * 0.29, i === 4 ? 0.18 : 0));
        }
      });
      // two-seat sofa along the south glass + coffee table
      b.sofa.push(boxAt(1.9, 0.5, 0.9, 10.3, 0.4, -1.05));
      b.sofa.push(boxAt(1.9, 0.85, 0.24, 10.3, 0.78, -0.68));
      b.sofa.push(boxAt(0.24, 0.62, 0.9, 9.28, 0.66, -1.05), boxAt(0.24, 0.62, 0.9, 11.32, 0.66, -1.05));
      b.sofaLight.push(boxAt(0.85, 0.16, 0.75, 9.85, 0.66, -1.1), boxAt(0.85, 0.16, 0.75, 10.75, 0.66, -1.1));
      b.wood.push(boxAt(1.1, 0.05, 0.55, 10.3, 0.34, -1.95));
      b.black.push(boxAt(0.06, 0.32, 0.45, 9.85, 0.16, -1.95), boxAt(0.06, 0.32, 0.45, 10.75, 0.16, -1.95));
      // floor lamp pole in the NE corner (shade/light live in NightLights)
      b.black.push(cylAt(0.03, 0.03, 1.45, 8, 12.8, 0.72, -5.35), cylAt(0.16, 0.19, 0.04, 12, 12.8, 0.03, -5.35));
    }

    /* ---- Fase 8: pantry corner (rest room flows east) ---- */
    {
      // counter along the east glass + kettle/cups/microwave/fruit bowl
      b.white.push(boxAt(0.6, 0.9, 2.4, 12.82, 0.45, 4.5));
      b.wood.push(boxAt(0.72, 0.05, 2.52, 12.82, 0.93, 4.5));
      b.black.push(cylAt(0.09, 0.11, 0.22, 10, 12.82, 1.06, 3.85));
      b.cream.push(cylAt(0.045, 0.04, 0.09, 8, 12.7, 1.0, 4.32), cylAt(0.045, 0.04, 0.09, 8, 12.92, 1.0, 4.48));
      b.black.push(boxAt(0.5, 0.32, 0.62, 12.82, 1.11, 5.25));
      b.terra.push(cylAt(0.16, 0.1, 0.09, 12, 12.82, 1.0, 4.78));
      // vending machine body (glowing front is a separate textured plane)
      b.black.push(boxAt(0.72, 1.9, 1.05, 12.78, 0.95, 1.6));
      // high table + two stools
      b.wood.push(cylAt(0.48, 0.48, 0.05, 18, 10.7, 1.03, 4.7));
      b.black.push(cylAt(0.04, 0.04, 1.0, 8, 10.7, 0.5, 4.7), cylAt(0.3, 0.32, 0.04, 14, 10.7, 0.02, 4.7));
      b.chair.push(cylAt(0.21, 0.21, 0.06, 12, 10.1, 0.64, 4.2), cylAt(0.21, 0.21, 0.06, 12, 11.3, 0.64, 5.2));
      b.black.push(cylAt(0.03, 0.03, 0.62, 8, 10.1, 0.31, 4.2), cylAt(0.03, 0.03, 0.62, 8, 11.3, 0.31, 5.2));
    }

    /* ---- whiteboard on the north wall (open area) ---- */
    b.black.push(boxAt(3.45, 1.95, 0.08, -1.7, 1.98, -5.92));

    /* ---- west credenza (mini CREW GARAGE) ---- */
    b.white.push(boxAt(0.55, 0.58, 3.6, CREDENZA.x, 0.31, CREDENZA.z));
    b.wood.push(boxAt(0.64, 0.05, 3.72, CREDENZA.x, CREDENZA.topY, CREDENZA.z));
    b.black.push(boxAt(0.03, 0.04, 0.5, CREDENZA.x + 0.29, 0.45, CREDENZA.z - 0.9), boxAt(0.03, 0.04, 0.5, CREDENZA.x + 0.29, 0.45, CREDENZA.z + 0.9));

    /* ---- apex tripod lamp legs (NW corner — signature of the reference) ---- */
    const lampX = -7.25;
    const lampZ = -5.25;
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + 0.5;
      const leg = new THREE.CylinderGeometry(0.024, 0.024, 1.58, 6);
      leg.translate(0, -0.79, 0); // pivot at the top hub
      leg.rotateX(0.21); // splay outward (toward local +z)
      leg.rotateY(a);
      leg.translate(lampX, 1.56, lampZ);
      b.woodDark.push(leg);
    }
    b.woodDark.push(cylAt(0.05, 0.05, 0.1, 8, lampX, 1.54, lampZ));
    // small table lamp stem on the meeting bench
    b.black.push(cylAt(0.02, 0.02, 0.34, 6, 6.7, 0.6, -5.62), cylAt(0.09, 0.1, 0.03, 10, 6.7, 0.44, -5.62));

    /* ---- plant pots + trunks (foliage blobs are instanced separately) ---- */
    const plantAt = (x: number, z: number, r: number, h: number, white: boolean) => {
      (white ? b.potW : b.terra).push(cylAt(r, r * 0.78, h, 12, x, h / 2, z));
      b.woodDark.push(cylAt(0.03, 0.04, 0.35, 6, x, h + 0.15, z));
    };
    plantAt(-7.3, -4.15, 0.3, 0.42, false);
    plantAt(1.3, -5.35, 0.28, 0.4, true);
    plantAt(-7.35, 5.4, 0.28, 0.4, false);
    plantAt(1.3, 5.4, 0.26, 0.38, true);
    plantAt(7.45, -5.35, 0.28, 0.4, true); // meeting corner
    plantAt(7.45, 5.4, 0.3, 0.42, false); // rest corner
    plantAt(-1.9, -1.6, 0.24, 0.34, false); // between pods
    plantAt(12.75, -0.95, 0.3, 0.42, true); // manager office SE corner
    plantAt(8.6, -0.85, 0.26, 0.38, false); // manager office, by the door
    plantAt(12.7, 0.1, 0.28, 0.4, true); // pantry corner by the vending machine
    // tiny sill pots
    b.terra.push(cylAt(0.11, 0.09, 0.16, 10, -7.95, 1.08, -3.9));
    b.potW.push(cylAt(0.11, 0.09, 0.16, 10, -7.95, 1.08, 2.5));

    const out: Record<string, THREE.BufferGeometry> = {};
    for (const k of Object.keys(b)) out[k] = merge(b[k]);
    return { geos: out, windows: WIN, lampPos: [lampX, lampZ] as const };
  }, []);
}

/* ---------------------------------- materials ---------------------------------- */

function useRoomMaterials() {
  return useMemo(() => {
    const std = (color: string, roughness = 0.9, metalness = 0) =>
      new THREE.MeshStandardMaterial({ color, roughness, metalness });
    return {
      wall: std("#f2e9d8", 0.96),
      slab: std("#171c31", 0.92),
      frame: std("#15171f", 0.5, 0.35),
      glass: new THREE.MeshStandardMaterial({
        color: "#d7e2f0", transparent: true, opacity: 0.18, roughness: 0.08, metalness: 0.1, depthWrite: false,
      }),
      wood: std("#d9b98c", 0.72),
      woodDark: std("#8a6a44", 0.8),
      pedestal: std("#9aa0ae", 0.55, 0.25),
      black: std("#1b1e28", 0.5, 0.3),
      dark: std("#2b2f3d", 0.8),
      chair: std("#575f70", 0.9),
      white: std("#f4f2ec", 0.85),
      sofa: std("#4a5478", 0.96),
      sofaLight: std("#5c6892", 0.96),
      cream: std("#e8dcc4", 0.95),
      terra: std("#b06a48", 0.9),
      sage: std("#7d9474", 0.95),
      potW: std("#e9e6df", 0.85),
    } as const;
  }, []);
}

type RoomMats = ReturnType<typeof useRoomMaterials>;

/* ---------------------------------- live surfaces ---------------------------------- */

interface LiveTex {
  skyline: ReturnType<typeof createSkyline>;
  whiteboard: ReturnType<typeof createWhiteboard>;
  meetingScreen: ReturnType<typeof createMeetingScreen>;
  managerScreen: ReturnType<typeof createManagerScreen>;
  screens: ReturnType<typeof createScreen>[];
}

function useLiveUpdates(live: LiveTex) {
  const acc = useRef({ skyKey: -1, tScreen: 0, tWb: 10, screenIdx: 0, tTv: 0 });
  useFrame((_, delta) => {
    const st = useHqStore.getState();
    const hour = st.hour;
    const { daylight, sunset } = effectiveDayFactors(hour, st.mode);
    const a = acc.current;
    a.tScreen += delta;
    a.tWb += delta;
    a.tTv += delta;

    const key = Math.floor(hour * 4) * 10 + (st.mode === "night" ? 1 : st.mode === "day" ? 2 : 0);
    if (key !== a.skyKey) {
      a.skyKey = key;
      live.skyline.redraw(daylight, sunset, hour);
    }
    if (a.tWb > 2) {
      a.tWb = 0;
      const rows = AGENTS.map((agent) => {
        const job = currentJobFor(agent.id, st.jobs);
        return {
          name: agent.name,
          color: agent.color,
          p: job && job.status !== "queued" ? job.progress : agent.progress,
          failed: job?.status === "failed",
        };
      });
      live.whiteboard.redraw(hour, performance.now() / 1000, rows, {
        clipsShipped: st.stats.clipsShipped,
        renderQueue: st.stats.renderQueue,
        avgClipSec: st.stats.avgClipSec,
      });
    }
    if (a.tTv > 2) {
      a.tTv = 0;
      // wall screen: office-hours state in demo mode, "work exists" in real mode
      const workday = st.demoShift
        ? isOnShift(hour)
        : st.jobs.some((j) => j.status === "running" || j.status === "queued");
      live.meetingScreen.redraw(hour, workday);
      live.managerScreen.redraw(
        hour,
        {
          clipsShipped: st.stats.clipsShipped,
          renderQueue: st.stats.renderQueue,
          tokensOut: st.stats.tokensOut ?? 0,
        },
        st.approvals.length,
      );
    }
    if (a.tScreen > 0.5) {
      a.tScreen = 0;
      const agent = AGENTS[a.screenIdx];
      const job = currentJobFor(agent.id, st.jobs);
      const on = st.demoShift ? isOnShift(hour) : !!job;
      live.screens[a.screenIdx].redraw(
        performance.now() / 1000,
        on,
        job ? { status: job.status, progress: job.progress } : undefined,
      );
      a.screenIdx = (a.screenIdx + 1) % live.screens.length;
    }
  });
}

/** Desk monitor screens + name labels + colored mugs, transformed per workstation. */
function DeskProps({ live }: { live: LiveTex }) {
  const labels = useHqStore((s) => s.labels);
  const labelTex = useMemo(() => AGENTS.map((a) => createDeskLabel(a.name, a.color)), []);
  const mugRef = useRef<THREE.InstancedMesh>(null);
  const mug = useMemo(
    () => ({ geo: new THREE.CylinderGeometry(0.05, 0.045, 0.1, 10), mat: new THREE.MeshStandardMaterial({ roughness: 0.6 }) }),
    [],
  );
  useLayoutEffect(() => {
    const inst = mugRef.current;
    if (!inst) return;
    const dummy = new THREE.Object3D();
    AGENTS.forEach((a, i) => {
      const [mx, mz] = localPoint(a.desk[0], a.desk[1], a.deskYaw, 0.66, 0.62);
      dummy.position.set(mx, 0.83, mz);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      inst.setColorAt(i, new THREE.Color(a.color));
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  }, []);

  return (
    <group>
      {AGENTS.map((a, i) => {
        const [sx, sz] = localPoint(a.desk[0], a.desk[1], a.deskYaw, 0, 1.04);
        const [lx, lz] = localPoint(a.desk[0], a.desk[1], a.deskYaw, -0.52, 0.42);
        return (
          <group key={a.id}>
            {/* screen faces the seated agent (backs to camera on the far row, like the reference) */}
            <mesh position={[sx, 1.09, sz]} rotation-y={a.deskYaw + Math.PI}>
              <planeGeometry args={[0.72, 0.42]} />
              <meshBasicMaterial map={live.screens[i].tex} toneMapped={false} />
            </mesh>
            <mesh position={[lx, 0.42, lz]} rotation-y={a.deskYaw + Math.PI} visible={labels}>
              <planeGeometry args={[0.46, 0.115]} />
              <meshBasicMaterial map={labelTex[i]} toneMapped={false} transparent />
            </mesh>
          </group>
        );
      })}
      {/* spare pod: dark idle monitors */}
      {[0, Math.PI].map((yaw, i) => {
        const seat: [number, number] = [SPARE_POD[0], SPARE_POD[1] + (yaw === 0 ? -POD_SEAT_DZ : POD_SEAT_DZ)];
        const [sx, sz] = localPoint(seat[0], seat[1], yaw, 0, 1.04);
        return (
          <mesh key={i} position={[sx, 1.09, sz]} rotation-y={yaw + Math.PI}>
            <planeGeometry args={[0.72, 0.42]} />
            <meshBasicMaterial color="#131a2e" toneMapped={false} />
          </mesh>
        );
      })}
      <instancedMesh ref={mugRef} args={[mug.geo, mug.mat, AGENTS.length]} castShadow />
    </group>
  );
}

/* ---------------------------------- manager desk (clickable PC) ---------------------------------- */

/**
 * The boss's dual monitors (Fase 8) — live command-deck screens by day,
 * amber "N menunggu OK" banner when agents need the manager. The whole
 * desk area is the click target that opens the Manager Panel.
 */
function ManagerDesk({ live }: { live: LiveTex }) {
  const select = useHqStore((s) => s.select);
  const selected = useHqStore((s) => s.selection?.kind === "manager");
  const [dx, dz] = MANAGER.desk;

  const pick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    select({ kind: "manager", id: "manager" });
  };
  const hover = (e: ThreeEvent<PointerEvent>, on: boolean) => {
    e.stopPropagation();
    document.body.style.cursor = on ? "pointer" : "auto";
  };

  return (
    <group onClick={pick} onPointerOver={(e) => hover(e, true)} onPointerOut={(e) => hover(e, false)}>
      {selected && (
        <mesh position={[dx + 0.3, 0.02, dz]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[1.4, 1.56, 44]} />
          <meshBasicMaterial color="#f5b45e" transparent opacity={0.85} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      {/* dual monitors, angled in toward the executive chair */}
      {(
        [
          [-0.44, 0.26],
          [0.44, -0.26],
        ] as const
      ).map(([zo, ry], i) => (
        <group key={i} position={[dx + 0.28, 0, dz + zo]} rotation-y={Math.PI / 2 + ry}>
          <mesh position={[0, 0.81, 0]} castShadow>
            <boxGeometry args={[0.36, 0.03, 0.24]} />
            <meshStandardMaterial color="#1b1e28" roughness={0.5} metalness={0.3} />
          </mesh>
          <mesh position={[0, 0.93, -0.02]}>
            <boxGeometry args={[0.07, 0.24, 0.07]} />
            <meshStandardMaterial color="#1b1e28" roughness={0.5} metalness={0.3} />
          </mesh>
          <mesh position={[0, 1.13, 0]} castShadow>
            <boxGeometry args={[0.86, 0.54, 0.05]} />
            <meshStandardMaterial color="#1b1e28" roughness={0.5} metalness={0.3} />
          </mesh>
          <mesh position={[0, 1.13, 0.028]}>
            <planeGeometry args={[0.78, 0.46]} />
            <meshBasicMaterial map={live.managerScreen.tex} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {/* keyboard + mouse on the manager's side */}
      <mesh position={[dx + 0.58, 0.81, dz]} castShadow>
        <boxGeometry args={[0.2, 0.025, 0.54]} />
        <meshStandardMaterial color="#2b2f3d" roughness={0.8} />
      </mesh>
      <mesh position={[dx + 0.58, 0.815, dz + 0.48]} scale={[1, 0.55, 1.35]}>
        <sphereGeometry args={[0.045, 10, 8]} />
        <meshStandardMaterial color="#2b2f3d" roughness={0.7} />
      </mesh>
      {/* generous invisible hit-box over desk + monitors */}
      <mesh position={[dx + 0.25, 0.85, dz]} visible={false}>
        <boxGeometry args={[1.8, 1.7, 2.7]} />
      </mesh>
    </group>
  );
}

/* ---------------------------------- foliage ---------------------------------- */

const PLANTS: Array<{ p: [number, number, number]; s: number; c: string }> = [
  { p: [-7.3, 0.95, -4.15], s: 0.42, c: "#527f4c" },
  { p: [-7.55, 1.25, -3.95], s: 0.3, c: "#63975c" },
  { p: [1.3, 0.9, -5.35], s: 0.38, c: "#63975c" },
  { p: [-7.35, 0.88, 5.4], s: 0.36, c: "#527f4c" },
  { p: [1.3, 0.82, 5.4], s: 0.34, c: "#63975c" },
  { p: [7.45, 0.9, -5.35], s: 0.38, c: "#63975c" },
  { p: [7.2, 1.18, -5.15], s: 0.26, c: "#527f4c" },
  { p: [7.45, 0.95, 5.4], s: 0.4, c: "#527f4c" },
  { p: [-1.9, 0.72, -1.6], s: 0.3, c: "#63975c" },
  { p: [12.75, 0.95, -0.95], s: 0.4, c: "#63975c" },
  { p: [8.6, 0.85, -0.85], s: 0.34, c: "#527f4c" },
  { p: [12.7, 0.9, 0.1], s: 0.36, c: "#63975c" },
  { p: [-7.95, 1.28, -3.9], s: 0.15, c: "#63975c" },
  { p: [-7.95, 1.28, 2.5], s: 0.15, c: "#527f4c" },
];

function Foliage() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const { geo, mat } = useMemo(
    () => ({ geo: new THREE.IcosahedronGeometry(1, 1), mat: new THREE.MeshStandardMaterial({ roughness: 0.95 }) }),
    [],
  );
  useLayoutEffect(() => {
    const inst = ref.current;
    if (!inst) return;
    PLANTS.forEach((b, i) => {
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(...b.p),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(i * 0.9, i * 1.7, 0)),
        new THREE.Vector3(b.s * 0.8, b.s * 0.74, b.s * 0.8),
      );
      inst.setMatrixAt(i, m);
      inst.setColorAt(i, new THREE.Color(b.c));
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  }, []);
  return <instancedMesh ref={ref} args={[geo, mat, PLANTS.length]} castShadow />;
}

/* ---------------------------------- beanbags + rug ---------------------------------- */

function LoungeSoft() {
  const rug = useMemo(() => createRug(), []);
  return (
    <group>
      <mesh position={[6.05, 0.015, 3.15]} rotation-x={-Math.PI / 2} renderOrder={1} receiveShadow>
        <circleGeometry args={[1.95, 36]} />
        <meshStandardMaterial map={rug} transparent opacity={0.92} roughness={1} depthWrite={false} />
      </mesh>
      <mesh position={[5.6, 0.27, 4.9]} scale={[1, 0.55, 1]} castShadow receiveShadow>
        <sphereGeometry args={[0.54, 16, 12]} />
        <meshStandardMaterial color="#7d9474" roughness={0.95} />
      </mesh>
      {/* BOLT's beanbag moved east into the Fase 8 extension */}
      <mesh position={[8.6, 0.27, 5.5]} scale={[1, 0.55, 1]} castShadow receiveShadow>
        <sphereGeometry args={[0.54, 16, 12]} />
        <meshStandardMaterial color="#b96f4e" roughness={0.95} />
      </mesh>
      {/* spare beanbag by the pantry high table */}
      <mesh position={[11.3, 0.27, 2.6]} scale={[1, 0.55, 1]} castShadow receiveShadow>
        <sphereGeometry args={[0.54, 16, 12]} />
        <meshStandardMaterial color="#bfa05a" roughness={0.95} />
      </mesh>
      {/* extension rug + manager office rug */}
      <mesh position={[10.5, 0.015, 4.35]} rotation-x={-Math.PI / 2} renderOrder={1} receiveShadow>
        <circleGeometry args={[1.7, 36]} />
        <meshStandardMaterial map={rug} transparent opacity={0.92} roughness={1} depthWrite={false} />
      </mesh>
      <mesh position={[11.45, 0.015, -3.2]} rotation-x={-Math.PI / 2} renderOrder={1} receiveShadow>
        <circleGeometry args={[1.9, 36]} />
        <meshStandardMaterial map={rug} transparent opacity={0.92} roughness={1} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* ---------------------------------- wall clock ---------------------------------- */

function WallClock() {
  const hourHand = useRef<THREE.Group>(null);
  const minuteHand = useRef<THREE.Group>(null);
  useFrame(() => {
    const { hour } = useHqStore.getState();
    if (hourHand.current) hourHand.current.rotation.z = -(hour % 12) * (Math.PI / 6);
    if (minuteHand.current) minuteHand.current.rotation.z = -(hour % 1) * Math.PI * 2;
  });
  return (
    <group position={[0.85, 2.62, -ROOM.D / 2 + 0.04]}>
      <mesh>
        <circleGeometry args={[0.3, 24]} />
        <meshBasicMaterial color="#f6f3ea" />
      </mesh>
      <mesh position={[0, 0, 0.01]}>
        <ringGeometry args={[0.25, 0.3, 24]} />
        <meshBasicMaterial color="#1b1e28" />
      </mesh>
      <group ref={hourHand} position={[0, 0, 0.02]}>
        <mesh position={[0, 0.08, 0]}>
          <boxGeometry args={[0.032, 0.17, 0.01]} />
          <meshBasicMaterial color={INK} />
        </mesh>
      </group>
      <group ref={minuteHand} position={[0, 0, 0.03]}>
        <mesh position={[0, 0.11, 0]}>
          <boxGeometry args={[0.022, 0.22, 0.01]} />
          <meshBasicMaterial color="#d97706" />
        </mesh>
      </group>
    </group>
  );
}

/* ---------------------------------- lamps + night glow ---------------------------------- */

/** Emissive shades, glow halos, floor pools and the warm point lights. */
function NightLights({ lampPos }: { lampPos: readonly [number, number] }) {
  const shadeMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffd9a4" }), []);
  const glowTex = useMemo(() => createGlowSprite(), []);
  const poolMat = useMemo(
    () => new THREE.MeshBasicMaterial({
      map: glowTex, color: "#ffb45e", transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
    [glowTex],
  );
  const bulbMat = useMemo(
    () => new THREE.SpriteMaterial({
      map: glowTex, color: "#ffdfae", transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
    [glowTex],
  );
  const apex = useRef<THREE.PointLight>(null);
  const meeting = useRef<THREE.PointLight>(null);
  const lounge = useRef<THREE.PointLight>(null);
  const open = useRef<THREE.PointLight>(null);
  const boss = useRef<THREE.PointLight>(null);
  const dayShade = useMemo(() => new THREE.Color("#e9e1cd"), []);
  const nightShade = useMemo(() => new THREE.Color("#ffcf96"), []);

  useFrame(() => {
    const st = useHqStore.getState();
    const { night } = effectiveDayFactors(st.hour, st.mode);
    const warm = 0.12 + night * 0.88; // lamps stay faintly on by day, full glow at night
    if (apex.current) apex.current.intensity = 11 * warm;
    if (meeting.current) meeting.current.intensity = 9 * warm;
    if (lounge.current) lounge.current.intensity = 8 * warm;
    if (open.current) open.current.intensity = 8.5 * (night * 0.9);
    if (boss.current) boss.current.intensity = 8 * warm;
    poolMat.opacity = 0.2 * night;
    bulbMat.opacity = 0.6 * warm;
    shadeMat.color.copy(dayShade).lerp(nightShade, warm);
  });

  return (
    <group>
      {/* apex tripod shade + meeting bench lamp + lounge lamp shades */}
      <mesh position={[lampPos[0], 1.68, lampPos[1]]} material={shadeMat}>
        <cylinderGeometry args={[0.17, 0.27, 0.32, 16, 1, true]} />
      </mesh>
      <mesh position={[6.7, 0.86, -5.62]} material={shadeMat}>
        <cylinderGeometry args={[0.1, 0.16, 0.2, 12, 1, true]} />
      </mesh>
      <mesh position={[7.5, 1.58, 1.05]} material={shadeMat}>
        <cylinderGeometry args={[0.15, 0.23, 0.28, 14, 1, true]} />
      </mesh>
      <mesh position={[12.8, 1.58, -5.35]} material={shadeMat}>
        <cylinderGeometry args={[0.15, 0.23, 0.28, 14, 1, true]} />
      </mesh>

      <pointLight ref={apex} position={[lampPos[0] + 0.15, 1.75, lampPos[1] + 0.15]} color="#ffb45e" distance={11} decay={1.9} />
      <pointLight ref={meeting} position={[5.2, 2.4, -3.6]} color="#ffc98a" distance={10} decay={1.9} />
      <pointLight ref={lounge} position={[7.2, 1.7, 1.3]} color="#ffb45e" distance={9} decay={1.9} />
      <pointLight ref={open} position={[-3.2, 2.7, 0.2]} color="#ffd2a0" distance={13} decay={1.9} />
      <pointLight ref={boss} position={[12.3, 1.8, -4.7]} color="#ffb45e" distance={9} decay={1.9} />

      {/* halos */}
      <sprite position={[lampPos[0], 1.68, lampPos[1]]} material={bulbMat} scale={[1.5, 1.5, 1]} renderOrder={4} />
      <sprite position={[6.7, 0.86, -5.62]} material={bulbMat} scale={[0.8, 0.8, 1]} renderOrder={4} />
      <sprite position={[7.5, 1.58, 1.05]} material={bulbMat} scale={[1.2, 1.2, 1]} renderOrder={4} />
      <sprite position={[12.8, 1.58, -5.35]} material={bulbMat} scale={[1.2, 1.2, 1]} renderOrder={4} />

      {/* warm pools on the floor */}
      {([
        [lampPos[0] + 0.3, lampPos[1] + 0.3, 3.4],
        [5.2, -3.6, 4.6],
        [7.1, 1.5, 3.6],
        [-3.2, 0.2, 6.2],
        [11.6, -3.4, 5.2],
      ] as const).map(([x, z, s], i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[x, 0.03, z]} material={poolMat} renderOrder={2}>
          <planeGeometry args={[s, s]} />
        </mesh>
      ))}
    </group>
  );
}

/* ---------------------------------- the cat 🐈 ---------------------------------- */

function OfficeCat() {
  const group = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const waypoints = useMemo(
    () => [[-2.3, -1.3], [0.7, -0.5], [1.1, 1.3], [-0.5, 0.7], [-2.7, 0.5], [-3.4, -2.2]]
      .map(([x, z]) => new THREE.Vector3(x, 0.14, z)),
    [],
  );
  const anim = useRef({ i: 0, wait: 0 });
  useFrame((rs, delta) => {
    const g = group.current;
    if (!g) return;
    const s = anim.current;
    const t = rs.clock.elapsedTime;
    if (tail.current) tail.current.rotation.y = Math.sin(t * 2.2) * 0.35;
    if (s.wait > 0) {
      s.wait -= delta;
      g.position.y = 0.14 + Math.abs(Math.sin(t * 3)) * 0.015;
      return;
    }
    const target = waypoints[s.i];
    const dir = target.clone().sub(g.position);
    const dist = dir.length();
    if (dist < 0.15) {
      s.i = (s.i + 1) % waypoints.length;
      s.wait = 1.4 + Math.random() * 2.4;
      return;
    }
    dir.normalize();
    g.position.addScaledVector(dir, Math.min(dist, delta * 0.8));
    g.position.y = 0.14 + Math.abs(Math.sin(t * 10)) * 0.04;
    const ty = Math.atan2(dir.x, dir.z);
    const diff = ((ty - g.rotation.y + Math.PI) % (Math.PI * 2)) - Math.PI;
    g.rotation.y += diff * (1 - Math.exp(-delta * 6));
  });
  return (
    <group ref={group} position={[-2.3, 0.14, -1.3]}>
      <mesh rotation-x={Math.PI / 2} castShadow>
        <capsuleGeometry args={[0.12, 0.3, 6, 10]} />
        <meshStandardMaterial color="#dd9a54" roughness={0.95} />
      </mesh>
      <group position={[0, 0.12, 0.24]}>
        <mesh castShadow>
          <sphereGeometry args={[0.12, 12, 10]} />
          <meshStandardMaterial color="#dd9a54" roughness={0.95} />
        </mesh>
        {[-0.055, 0.055].map((x) => (
          <mesh key={x} position={[x, 0.11, 0]}>
            <coneGeometry args={[0.042, 0.085, 6]} />
            <meshStandardMaterial color="#c0813f" roughness={0.95} />
          </mesh>
        ))}
        {[-0.045, 0.045].map((x) => (
          <mesh key={x} position={[x, 0.02, 0.105]}>
            <sphereGeometry args={[0.018, 8, 6]} />
            <meshBasicMaterial color="#1b1e28" />
          </mesh>
        ))}
      </group>
      <group ref={tail} position={[0, 0.07, -0.24]}>
        <mesh rotation-x={-0.7} position={[0, 0.08, -0.05]}>
          <capsuleGeometry args={[0.028, 0.2, 4, 8]} />
          <meshStandardMaterial color="#c0813f" roughness={0.95} />
        </mesh>
      </group>
    </group>
  );
}

/* ---------------------------------- diecast garage (credenza) ---------------------------------- */

function wheelGeo() {
  const g = new THREE.CylinderGeometry(0.07, 0.07, 0.05, 10);
  g.rotateZ(Math.PI / 2);
  return g;
}

function vehicleBodyGeometry(kind: VehicleInfo["kind"]): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  switch (kind) {
    case "sedan":
      parts.push(boxAt(0.26, 0.12, 0.52, 0, 0.13, 0), boxAt(0.22, 0.11, 0.27, 0, 0.24, -0.02));
      break;
    case "van":
      parts.push(boxAt(0.27, 0.21, 0.5, 0, 0.17, 0), boxAt(0.23, 0.1, 0.06, 0, 0.2, 0.24));
      break;
    case "hatch":
      parts.push(boxAt(0.26, 0.12, 0.4, 0, 0.13, 0), boxAt(0.23, 0.11, 0.24, 0, 0.24, -0.05));
      break;
    case "pickup":
      parts.push(boxAt(0.26, 0.11, 0.5, 0, 0.12, 0), boxAt(0.24, 0.11, 0.17, 0, 0.23, 0.13), boxAt(0.22, 0.07, 0.03, 0, 0.2, -0.23));
      break;
    case "scooter":
      parts.push(
        boxAt(0.09, 0.05, 0.32, 0, 0.1, 0), boxAt(0.04, 0.3, 0.04, 0, 0.24, 0.13),
        boxAt(0.18, 0.03, 0.03, 0, 0.39, 0.15), boxAt(0.11, 0.06, 0.17, 0, 0.22, -0.05),
      );
      break;
  }
  return merge(parts);
}

const DIECAST_Y = CREDENZA.topY + 0.025;

function DiecastGarage() {
  const select = useHqStore((s) => s.select);
  const wheelRef = useRef<THREE.InstancedMesh>(null);
  const bodies = useMemo(() => VEHICLES.map((v) => ({ info: v, geo: vehicleBodyGeometry(v.kind) })), []);
  const wheels = useMemo(() => {
    const geo = wheelGeo();
    const mat = new THREE.MeshStandardMaterial({ color: "#20263f", roughness: 0.7 });
    const mats: THREE.Matrix4[] = [];
    const dummy = new THREE.Object3D();
    for (const v of VEHICLES) {
      const off: Array<[number, number, number]> = v.kind === "scooter"
        ? [[0, 0.06, 0.14], [0, 0.06, -0.14]]
        : [[0.135, 0.07, 0.16], [-0.135, 0.07, 0.16], [0.135, 0.07, -0.16], [-0.135, 0.07, -0.16]];
      dummy.rotation.set(0, v.yaw, 0);
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(v.pos[0], DIECAST_Y, v.pos[1]),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, v.yaw, 0)),
        new THREE.Vector3(1, 1, 1),
      );
      for (const o of off) {
        dummy.position.set(o[0], o[1], o[2]);
        dummy.updateMatrix();
        mats.push(new THREE.Matrix4().multiplyMatrices(m, dummy.matrix));
      }
    }
    return { geo, mat, mats };
  }, []);

  useLayoutEffect(() => {
    const inst = wheelRef.current;
    if (!inst) return;
    wheels.mats.forEach((mm, i) => inst.setMatrixAt(i, mm));
    inst.instanceMatrix.needsUpdate = true;
  }, [wheels]);

  const hover = (e: ThreeEvent<PointerEvent>, on: boolean) => {
    e.stopPropagation();
    document.body.style.cursor = on ? "pointer" : "auto";
  };

  return (
    <group>
      {bodies.map(({ info, geo }) => (
        <group key={info.id} position={[info.pos[0], DIECAST_Y, info.pos[1]]} rotation-y={info.yaw}>
          <mesh
            geometry={geo}
            castShadow
            onClick={(e) => { e.stopPropagation(); select({ kind: "vehicle", id: info.id }); }}
            onPointerOver={(e) => hover(e, true)}
            onPointerOut={(e) => hover(e, false)}
          >
            <meshStandardMaterial color={info.color} roughness={0.35} metalness={0.35} />
          </mesh>
          {/* generous invisible hit-box */}
          <mesh
            position={[0, 0.16, 0]}
            visible={false}
            onClick={(e) => { e.stopPropagation(); select({ kind: "vehicle", id: info.id }); }}
            onPointerOver={(e) => hover(e, true)}
            onPointerOut={(e) => hover(e, false)}
          >
            <boxGeometry args={[0.55, 0.5, 0.75]} />
          </mesh>
        </group>
      ))}
      <instancedMesh ref={wheelRef} args={[wheels.geo, wheels.mat, wheels.mats.length]} />
    </group>
  );
}

/* ---------------------------------- blob contact shadows ---------------------------------- */

function ContactShadows({ tex }: { tex: THREE.Texture }) {
  const spots: Array<[number, number, number, number]> = [
    ...PODS.map(([x, z]) => [x, z, 2.6, 3.4] as [number, number, number, number]),
    [SPARE_POD[0], SPARE_POD[1], 2.6, 3.4],
    [MEETING_TABLE.x, MEETING_TABLE.z, 4.6, 3.2],
    [7.3, 2.9, 1.8, 3.2],
    [CREDENZA.x + 0.3, CREDENZA.z, 1.4, 4.2],
    [5.0, -5.6, 3.4, 1.1],
    [11.5, -3.2, 2.4, 3.2], // manager desk
    [10.3, -1.05, 2.6, 1.8], // manager sofa
    [12.82, 4.5, 1.3, 3.0], // pantry counter
    [10.7, 4.7, 1.7, 1.7], // pantry high table
  ];
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.85, depthWrite: false }),
    [tex],
  );
  return (
    <group>
      {spots.map(([x, z, w, d], i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[x, 0.012, z]} material={mat} renderOrder={1}>
          <planeGeometry args={[w, d]} />
        </mesh>
      ))}
    </group>
  );
}

/* ---------------------------------- wall decor (signs) ---------------------------------- */

function WallSigns() {
  const logo = useMemo(() => createDarkSign("CLIPYARD", "#f59e0b", 420, 96), []);
  const garage = useMemo(() => createDarkSign("CREW GARAGE", "#22d3ee", 420, 96), []);
  const manager = useMemo(() => createDarkSign("RUANG MANAJER", "#f5b45e", 560, 110), []);
  return (
    <group>
      <mesh position={[-5.7, 2.6, -ROOM.D / 2 + 0.04]}>
        <planeGeometry args={[2.3, 0.53]} />
        <meshBasicMaterial map={logo} toneMapped={false} transparent />
      </mesh>
      <mesh position={[ROOM.X_MIN + 0.04, 1.32, CREDENZA.z]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[1.7, 0.39]} />
        <meshBasicMaterial map={garage} toneMapped={false} transparent />
      </mesh>
      <mesh position={[11.2, 2.62, -ROOM.D / 2 + 0.04]}>
        <planeGeometry args={[2.55, 0.5]} />
        <meshBasicMaterial map={manager} toneMapped={false} transparent />
      </mesh>
    </group>
  );
}

/* ---------------------------------- world root ---------------------------------- */

const BUCKET_ORDER: Array<keyof RoomMats> = [
  "wall", "slab", "wood", "woodDark", "pedestal", "black", "dark", "chair",
  "white", "sofa", "sofaLight", "cream", "terra", "sage", "potW", "frame",
];

export function World() {
  const { geos, windows, lampPos } = useRoomGeometries();
  const mats = useRoomMaterials();
  const floorTex = useMemo(() => {
    const t = createFloorWood();
    t.repeat.set(ROOM.W / 3.2, ROOM.D / 3.53); // keep plank scale on the bigger floor
    return t;
  }, []);
  const blobTex = useMemo(() => createBlobShadow(), []);
  const vendingTex = useMemo(() => createVendingFront(), []);
  const live = useMemo<LiveTex>(
    () => ({
      skyline: createSkyline(),
      whiteboard: createWhiteboard(),
      meetingScreen: createMeetingScreen(),
      managerScreen: createManagerScreen(),
      screens: AGENTS.map((a) => createScreen(a)),
    }),
    [],
  );
  useLiveUpdates(live);

  return (
    <group>
      {/* soft ground shadow under the floating diorama */}
      <mesh rotation-x={-Math.PI / 2} position={[ROOM.CX + 0.6, -0.62, 0.6]}>
        <planeGeometry args={[ROOM.W + 7, ROOM.D + 7]} />
        <meshBasicMaterial map={blobTex} transparent opacity={0.65} depthWrite={false} />
      </mesh>

      {/* warm oak floor */}
      <mesh rotation-x={-Math.PI / 2} position={[ROOM.CX, 0, 0]} receiveShadow>
        <planeGeometry args={[ROOM.W, ROOM.D]} />
        <meshStandardMaterial map={floorTex} roughness={0.78} />
      </mesh>

      {/* merged static geometry */}
      {BUCKET_ORDER.map((k) => (
        <mesh key={k} geometry={geos[k]} material={mats[k]} castShadow={k !== "wall" && k !== "slab"} receiveShadow />
      ))}
      <mesh geometry={geos.glass} material={mats.glass} renderOrder={3} />

      {/* west window skyline views */}
      {windows.map((cz) => (
        <mesh key={cz} position={[ROOM.X_MIN - 0.42, 1.8, cz]} rotation-y={Math.PI / 2}>
          <planeGeometry args={[2.4, 1.7]} />
          <meshBasicMaterial map={live.skyline.tex} toneMapped={false} />
        </mesh>
      ))}

      {/* north whiteboard (live pipeline) */}
      <mesh position={[-1.7, 1.98, -ROOM.D / 2 + 0.13]}>
        <planeGeometry args={[3.25, 1.78]} />
        <meshBasicMaterial map={live.whiteboard.tex} toneMapped={false} color="#c9ccd8" />
      </mesh>

      {/* meeting TV */}
      <mesh position={[MEETING_TABLE.x, 2.02, -ROOM.D / 2 + 0.16]}>
        <planeGeometry args={[3.05, 1.72]} />
        <meshBasicMaterial map={live.meetingScreen.tex} toneMapped={false} />
      </mesh>

      <DeskProps live={live} />
      <ManagerDesk live={live} />

      {/* pantry vending machine front (glowing snack rows) */}
      <mesh position={[12.41, 0.98, 1.6]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[0.95, 1.7]} />
        <meshBasicMaterial map={vendingTex} toneMapped={false} />
      </mesh>

      <Foliage />
      <LoungeSoft />
      <WallClock />
      <WallSigns />
      <ContactShadows tex={blobTex} />
      <NightLights lampPos={lampPos} />
      <OfficeCat />
      <DiecastGarage />
    </group>
  );
}
