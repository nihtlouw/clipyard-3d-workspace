/**
 * CLIPYARD HQ — open-plan isometric office (reference-style big diorama).
 *
 * Zones: 6 white desks · lounge + resident cat · RUANG REHAT (rest room:
 * sofa, cushions, vending) · POJOK KOPI kitchen · MEETING ROOM (glass walls,
 * big table, live TV) · BOSS room (glass, exec desk, trophies) · CREW GARAGE
 * diecast shelf · RENDER NEST racks · rainbow bookshelf · live whiteboard.
 *
 * Four walls with smart fade: walls between the camera and the room hide
 * automatically, so the camera can orbit a full 360°. Static geometry is
 * merged per material; canvas textures redraw on gated ticks only.
 */
import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { AGENTS, VEHICLES, type VehicleInfo } from "@/lib/hq-data";
import { currentJobFor } from "@/lib/hq-jobs";
import { effectiveDayFactors, isMeeting, isOnShift, useHqStore } from "@/lib/hq-store";
import {
  createBlobShadow,
  createDeskLabel,
  createFloorGrid,
  createMeetingScreen,
  createPoster,
  createRug,
  createScreen,
  createSign,
  createSkyline,
  createVendingFront,
  createWhiteboard,
  seededRandom,
} from "@/lib/hq-textures";

/* ---------------------------------- palette ---------------------------------- */

const INK = "#232746";
const NAVY = "#3a4070";
const WALL = "#f4f5fe";
const WHITE = "#ffffff";
const WOOD = "#d8a97a";
const WOOD_DARK = "#7c6248";
const TERRA = "#c9704d";
const CARDBOARD = "#d9b48c";
const GREEN1 = "#57ab72";
const GREEN2 = "#6fbf85";
const GLASS = "#9fb4d8";
const CREAM = "#efe6d4";

/* ---------------------------------- geometry helpers ---------------------------------- */

function boxAt(w: number, h: number, d: number, x: number, y: number, z: number, ry = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return g;
}

function cylAt(rt: number, rb: number, h: number, seg: number, x: number, y: number, z: number) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  g.translate(x, y, z);
  return g;
}

function merge(list: THREE.BufferGeometry[]) {
  const merged = mergeGeometries(list, false);
  list.forEach((g) => g.dispose());
  if (!merged) throw new Error("merge failed");
  merged.computeBoundingSphere();
  return merged;
}

/* ---------------------------------- room dimensions ---------------------------------- */

const FLOOR_W = 28;
const FLOOR_D = 19;
const WALL_H = 5.6;
const DESK_ROWS = [-4.2, 0.6];
const DESK_XS = [-7.5, -2.5, 2.5];

/* ---------------------------------- room shell (4 fading walls) ---------------------------------- */

function useShellGeometries() {
  return useMemo(() => {
    const tray = merge([
      boxAt(FLOOR_W + 1.6, 0.8, FLOOR_D + 1.6, 0, -0.41, 0),
      boxAt(FLOOR_W + 1.0, 0.32, 0.62, 0, WALL_H + 0.14, -FLOOR_D / 2 - 0.5),
      boxAt(FLOOR_W + 1.0, 0.32, 0.62, 0, WALL_H + 0.14, FLOOR_D / 2 + 0.5),
      boxAt(0.62, 0.32, FLOOR_D + 1.0, -FLOOR_W / 2 - 0.5, WALL_H + 0.14, 0),
      boxAt(0.62, 0.32, FLOOR_D + 1.0, FLOOR_W / 2 + 0.5, WALL_H + 0.14, 0),
    ]);

    const WALL_X = FLOOR_W / 2 + 0.2; // 14.2
    const WALL_Z = FLOOR_D / 2 + 0.2; // 9.7

    // north wall: strips below/above the window band + pillars between panels
    const wallN = merge([
      boxAt(FLOOR_W, 1.1, 0.4, 0, 0.55, -WALL_Z),
      boxAt(FLOOR_W, 0.7, 0.4, 0, 5.25, -WALL_Z),
      ...[-13.5, -9, -4.5, 0, 4.5, 9.5].map((x) => boxAt(0.3, 3.8, 0.4, x, 3.0, -WALL_Z)),
      boxAt(0.3, 3.8, 0.4, 13.9, 3.0, -WALL_Z), // east corner pillar
    ]);
    // boss-room section keeps a window too (x 6.5..12.5)
    const wallN2 = merge([
      boxAt(1.6, 3.8, 0.4, 5.7, 3.0, -WALL_Z),
      boxAt(1.6, 3.8, 0.4, 13.1, 3.0, -WALL_Z),
    ]);

    // east wall: window band z -2..2
    const wallE = merge([
      boxAt(0.4, WALL_H, FLOOR_D, WALL_X, WALL_H / 2, 0),
      boxAt(0.4, 3.8, 0.3, WALL_X, 3.0, 0),
    ]);

    const wallW = merge([boxAt(0.4, WALL_H, FLOOR_D, -WALL_X, WALL_H / 2, 0)]);
    const wallS = merge([boxAt(FLOOR_W, WALL_H, 0.4, 0, WALL_H / 2, WALL_Z)]);

    // white trims: baseboards + window frames (north band + boss band + east band)
    const frame = (cx: number, cz: number, w: number, ry = 0) => {
      const parts = [
        boxAt(w + 0.3, 0.14, 0.24, cx, 1.02, cz, ry),
        boxAt(w + 0.3, 0.14, 0.24, cx, 4.98, cz, ry),
      ];
      const ends = ry === 0 ? [cx - w / 2, cx + w / 2] : [cz - w / 2, cz + w / 2];
      parts.push(
        ...(ry === 0
          ? ends.map((x) => boxAt(0.14, 4.1, 0.24, x, 3.0, cz))
          : ends.map((z) => boxAt(0.14, 4.1, 0.24, cx, 3.0, z))),
        ry === 0
          ? boxAt(w, 0.1, 0.12, cx, 3.0, cz)
          : boxAt(0.1, w, 0.12, cx, 3.0, cz),
      );
      return parts;
    };
    const white = merge([
      boxAt(FLOOR_W, 0.24, 0.08, 0, 0.12, -WALL_Z + 0.24),
      boxAt(0.08, 0.24, FLOOR_D, -WALL_X + 0.24, 0.12, 0),
      boxAt(0.08, 0.24, FLOOR_D, WALL_X - 0.24, 0.12, 0),
      boxAt(FLOOR_W, 0.24, 0.08, 0, 0.12, WALL_Z - 0.24),
      ...frame(-5.625, -WALL_Z + 0.02, 17.4),
      ...frame(9.3, -WALL_Z + 0.02, 6.0),
      ...frame(WALL_X - 0.02, 0, 4.0, Math.PI / 2),
    ]);

    // meeting room glass + frames
    const glass = merge([
      boxAt(8.1, 4.9, 0.06, 9.35, 2.5, 2.0), // front (south) pane
      boxAt(0.06, 4.9, 6.9, 5.1, 2.5, 5.6), // west pane
    ]);
    const glassFrame = merge([
      boxAt(8.5, 0.18, 0.2, 9.35, 5.02, 2.0),
      boxAt(8.5, 0.3, 0.2, 9.35, 0.06, 2.0),
      ...[5.15, 9.35, 13.55].map((x) => boxAt(0.18, 5.1, 0.2, x, 2.55, 2.0)),
      boxAt(0.2, 0.18, 7.3, 5.1, 5.02, 5.6),
      boxAt(0.2, 0.3, 7.3, 5.1, 0.06, 5.6),
      ...[2.15, 5.6, 9.05].map((z) => boxAt(0.2, 5.1, 0.18, 5.1, 2.55, z)),
    ]);
    // boss room glass + frames
    const glass2 = merge([
      boxAt(8.1, 4.9, 0.06, 9.35, 2.5, -3.0),
      boxAt(0.06, 4.9, 6.0, 5.1, 2.5, -6.1),
    ]);
    const glassFrame2 = merge([
      boxAt(8.5, 0.18, 0.2, 9.35, 5.02, -3.0),
      boxAt(8.5, 0.3, 0.2, 9.35, 0.06, -3.0),
      ...[5.15, 9.35, 13.55].map((x) => boxAt(0.18, 5.1, 0.2, x, 2.55, -3.0)),
      boxAt(0.2, 0.18, 6.3, 5.1, 5.02, -6.1),
      boxAt(0.2, 0.3, 6.3, 5.1, 0.06, -6.1),
      ...[-3.2, -6.1, -9.0].map((z) => boxAt(0.2, 5.1, 0.18, 5.1, 2.55, z)),
    ]);

    return { tray, wallN, wallN2, wallE, wallW, wallS, white, glass, glassFrame, glass2, glassFrame2 };
  }, []);
}

/* ---------------------------------- furniture (merged statics) ---------------------------------- */

function useFurnitureGeometries() {
  return useMemo(() => {
    const white: THREE.BufferGeometry[] = [];
    const navy: THREE.BufferGeometry[] = [];
    const silver: THREE.BufferGeometry[] = [];
    const wood: THREE.BufferGeometry[] = [];
    const woodDark: THREE.BufferGeometry[] = [];
    const cardboard: THREE.BufferGeometry[] = [];
    const cream: THREE.BufferGeometry[] = [];
    const gold: THREE.BufferGeometry[] = [];

    // ---- 6 desks (top + pedestal + keyboard), monitors, chairs ----
    for (const z of DESK_ROWS) {
      for (const x of DESK_XS) {
        white.push(
          boxAt(2.0, 0.12, 1.0, x, 1.14, z),
          boxAt(1.5, 1.02, 0.62, x, 0.57, z),
          boxAt(0.54, 0.05, 0.2, x, 1.225, z + 0.3),
        );
        navy.push(
          boxAt(0.66, 0.44, 0.07, x, 1.34, z + 0.06),
          boxAt(0.08, 0.16, 0.08, x, 1.22, z + 0.06),
          boxAt(0.3, 0.05, 0.18, x, 1.2, z + 0.06),
        );
        const az = z - 0.62;
        navy.push(boxAt(0.5, 0.09, 0.5, x, 0.72, az), boxAt(0.5, 0.52, 0.09, x, 1.0, az - 0.21));
        silver.push(cylAt(0.035, 0.035, 0.42, 8, x, 0.46, az), boxAt(0.38, 0.05, 0.38, x, 0.22, az));
      }
    }

    // ---- meeting room: big table + 8 chairs + wall TV frame ----
    const mtx = 9.35;
    const mtz = 5.6;
    woodDark.push(
      boxAt(3.8, 0.14, 1.5, mtx, 1.16, mtz),
      boxAt(0.24, 1.1, 1.2, mtx - 1.5, 0.55, mtz),
      boxAt(0.24, 1.1, 1.2, mtx + 1.5, 0.55, mtz),
    );
    for (const [cx, cz, yaw] of [
      [mtx - 1.35, mtz - 0.95, 0], [mtx, mtz - 0.95, 0], [mtx + 1.35, mtz - 0.95, 0],
      [mtx - 0.675, mtz - 0.95, 0], [mtx - 1.35, mtz + 0.95, Math.PI], [mtx, mtz + 0.95, Math.PI],
      [mtx + 1.35, mtz + 0.95, Math.PI], [mtx + 0.675, mtz + 0.95, Math.PI],
    ] as const) {
      navy.push(
        boxAt(0.5, 0.09, 0.5, cx, 0.72, cz),
        boxAt(0.5, 0.5, 0.09, cx, 0.98, cz + (yaw === 0 ? -0.21 : 0.21)),
      );
      silver.push(cylAt(0.035, 0.035, 0.42, 8, cx, 0.46, cz));
    }
    navy.push(boxAt(4.7, 2.9, 0.14, mtx, 3.3, FLOOR_D / 2 + 0.1)); // TV frame

    // ---- boss room: exec desk + chair + guests + trophy shelf ----
    woodDark.push(
      boxAt(0.9, 0.14, 2.6, 11.3, 1.2, -6.1),
      boxAt(0.7, 1.14, 0.3, 11.45, 0.57, -6.1),
      boxAt(2.0, 0.1, 0.6, 12.6, 3.0, -8.85), // trophy shelf
      boxAt(2.0, 0.1, 0.6, 12.6, 4.0, -8.85),
      boxAt(0.08, 1.1, 0.6, 11.6, 3.5, -8.85),
      boxAt(0.08, 1.1, 0.6, 13.6, 3.5, -8.85),
    );
    // trophies
    gold.push(
      cylAt(0.09, 0.13, 0.3, 10, 12.1, 3.2, -8.85),
      cylAt(0.09, 0.13, 0.3, 10, 12.6, 4.2, -8.85),
      boxAt(0.34, 0.26, 0.34, 13.1, 3.23, -8.85),
    );
    navy.push(
      boxAt(0.62, 0.7, 0.62, 12.35, 1.3, -6.1), // exec chair
      boxAt(0.62, 0.62, 0.09, 12.35, 1.85, -5.75),
      boxAt(0.52, 0.5, 0.52, 9.9, 0.62, -6.7), // guests
      boxAt(0.52, 0.5, 0.52, 9.9, 0.62, -5.5),
    );
    silver.push(cylAt(0.05, 0.05, 0.5, 8, 12.35, 0.8, -6.1));

    // ---- rest room: sofa + cushions + coffee table ----
    const sx = -9.0;
    const sz = 8.85;
    navy.push(
      boxAt(2.8, 0.52, 0.95, sx, 0.5, sz),
      boxAt(2.8, 0.75, 0.25, sx, 0.95, sz + 0.36),
      boxAt(0.28, 0.6, 0.95, sx - 1.4, 0.72, sz),
      boxAt(0.28, 0.6, 0.95, sx + 1.4, 0.72, sz),
    );
    cream.push(boxAt(0.5, 0.4, 0.4, sx - 0.9, 0.95, sz + 0.1, 0.3));
    white.push(cylAt(0.5, 0.5, 0.08, 18, sx, 0.68, sz - 1.5), cylAt(0.06, 0.08, 0.62, 10, sx, 0.31, sz - 1.5));

    // ---- vending machine (west wall of rest room) ----
    navy.push(boxAt(0.85, 2.0, 1.15, -13.55, 1.0, 4.6));

    // ---- kitchen: counter + coffee machine + kettle ----
    white.push(boxAt(0.9, 0.95, 3.4, -13.7, 0.48, -0.2));
    wood.push(boxAt(1.0, 0.07, 3.55, -13.68, 0.99, -0.2));
    navy.push(boxAt(0.5, 0.6, 0.45, -13.7, 1.32, -0.95));
    cream.push(cylAt(0.14, 0.17, 0.3, 12, -13.66, 1.17, 0.35));

    // ---- render nest: 2 racks ----
    navy.push(
      boxAt(0.8, 2.3, 1.15, -13.55, 1.15, -7.4),
      boxAt(0.8, 2.3, 1.15, -13.55, 1.15, -8.7),
    );

    // ---- bookshelf (west wall, rotated) ----
    const bz = -5.2;
    wood.push(
      boxAt(0.6, 0.1, 3.3, -13.75, 4.42, bz),
      boxAt(0.6, 4.6, 0.09, -13.75, 2.3, bz - 1.62),
      boxAt(0.6, 4.6, 0.09, -13.75, 2.3, bz + 1.62),
      boxAt(0.56, 0.08, 3.16, -13.75, 1.72, bz),
      boxAt(0.56, 0.08, 3.16, -13.75, 2.98, bz),
      boxAt(0.56, 0.08, 3.16, -13.75, 4.24, bz),
      boxAt(0.56, 0.08, 3.16, -13.75, 0.5, bz),
      boxAt(0.5, 0.5, 0.5, -13.75, 0.25, bz),
    );

    // ---- lounge: sofa + 2 beanbags + coffee table ----
    navy.push(
      boxAt(2.3, 0.5, 0.9, 0.2, 0.48, 6.95),
      boxAt(2.3, 0.7, 0.24, 0.2, 0.9, 7.33),
      boxAt(0.26, 0.55, 0.9, -1.0, 0.68, 6.95),
      boxAt(0.26, 0.55, 0.9, 1.4, 0.68, 6.95),
    );
    white.push(cylAt(0.46, 0.46, 0.07, 20, 0.2, 0.66, 5.75), cylAt(0.07, 0.09, 0.6, 10, 0.2, 0.3, 5.75));
    // floor lamp
    silver.push(cylAt(0.03, 0.03, 2.1, 8, 3.5, 1.05, 7.7), cylAt(0.2, 0.24, 0.06, 12, 3.5, 0.05, 7.7));

    // ---- garage sideboard (south wall) ----
    white.push(boxAt(4.9, 1.4, 0.85, 8.35, 0.7, 9.2));
    navy.push(boxAt(5.05, 0.09, 0.95, 8.35, 1.47, 9.2));

    // ---- shipping boxes (near bolt) ----
    cardboard.push(
      boxAt(0.72, 0.62, 0.72, 4.6, 0.31, -8.2, 0.12),
      boxAt(0.58, 0.5, 0.58, 4.5, 0.87, -8.15, -0.2),
      boxAt(0.46, 0.42, 0.46, 4.72, 1.33, -8.25, 0.35),
    );
    cream.push(
      boxAt(0.74, 0.08, 0.2, 4.6, 0.62, -8.2, 0.12),
      boxAt(0.2, 0.08, 0.74, 4.6, 0.62, -8.2, 0.12),
    );

    // plant pots
    const pots = merge([
      cylAt(0.34, 0.26, 0.5, 12, -4.8, 0.25, -9.0),
      cylAt(0.3, 0.23, 0.45, 12, 13.1, 0.23, -8.6),
      cylAt(0.3, 0.23, 0.45, 12, 12.9, 0.23, 8.7),
      cylAt(0.26, 0.2, 0.4, 12, -13.2, 0.2, 8.8),
      cylAt(0.16, 0.13, 0.26, 10, -13.75, 4.62, -5.2),
    ]);

    // whiteboard frame (east wall) + wall clock rim handled separately
    navy.push(boxAt(0.12, 2.94, 4.84, FLOOR_W / 2 - 0.08, 3.52, 0.0));

    return {
      white: merge(white),
      navy: merge(navy),
      silver: merge(silver),
      wood: merge(wood),
      woodDark: merge(woodDark),
      cardboard: merge(cardboard),
      cream: merge(cream),
      gold: merge(gold),
      pots,
    };
  }, []);
}

/* ---------------------------------- materials ---------------------------------- */

function useRoomMaterials() {
  return useMemo(() => {
    const lambert = (color: string) => new THREE.MeshLambertMaterial({ color });
    return {
      tray: lambert("#fbfbff"),
      wall: lambert(WALL),
      white: lambert(WHITE),
      navy: lambert(NAVY),
      silver: lambert("#b9bed4"),
      wood: lambert(WOOD),
      woodDark: lambert(WOOD_DARK),
      cardboard: lambert(CARDBOARD),
      cream: lambert(CREAM),
      terra: lambert(TERRA),
      gold: lambert("#e6b84c"),
      carpetMeeting: lambert("#dfe4f2"),
      carpetBoss: lambert("#e4def2"),
      beanTerra: lambert(TERRA),
      beanGreen: lambert("#5b8f6e"),
      glass: new THREE.MeshBasicMaterial({
        color: GLASS,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
      }),
    };
  }, []);
}

/* ---------------------------------- books (instanced rainbow) ---------------------------------- */

const BOOK_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#10b981", "#06b6d4",
  "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#14b8a6",
  "#eab308", "#22c55e",
];

function Books() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const { geo, mat, matrices, colors } = useMemo(() => {
    const rnd = seededRandom(20261016);
    const mats: THREE.Matrix4[] = [];
    const cols: THREE.Color[] = [];
    const shelves = [0.54, 1.76, 3.02];
    for (const sy of shelves) {
      let z = -6.6;
      while (z < -3.85) {
        const t = 0.08 + rnd() * 0.06;
        const h = 0.44 + rnd() * 0.22;
        const m = new THREE.Matrix4();
        m.compose(
          new THREE.Vector3(-13.75, sy + 0.04 + h / 2, z + t / 2),
          new THREE.Quaternion(),
          new THREE.Vector3(0.11 / 0.11 * (0.11 / 0.11), h, 1 * 0.11) .multiply(new THREE.Vector3(3.4, 1, t / 0.11)),
        );
        mats.push(m);
        cols.push(new THREE.Color(BOOK_COLORS[Math.floor(rnd() * BOOK_COLORS.length)]));
        z += t + 0.015 + rnd() * 0.02;
      }
    }
    return {
      geo: new THREE.BoxGeometry(0.11, 1, 0.11),
      mat: new THREE.MeshLambertMaterial({ color: "#ffffff" }),
      matrices: mats,
      colors: cols,
    };
  }, []);

  useLayoutEffect(() => {
    const inst = ref.current;
    if (!inst) return;
    matrices.forEach((m, i) => inst.setMatrixAt(i, m));
    colors.forEach((c, i) => inst.setColorAt(i, c));
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  }, [matrices, colors]);

  return <instancedMesh ref={ref} args={[geo, mat, matrices.length]} />;
}

/* ---------------------------------- plants + LEDs ---------------------------------- */

function Foliage() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const { geo, mat, items } = useMemo(() => {
    const blobs: Array<{ p: [number, number, number]; s: number; c: string }> = [
      { p: [-4.8, 0.95, -9.0], s: 0.5, c: GREEN1 },
      { p: [-5.1, 1.32, -8.75], s: 0.38, c: GREEN2 },
      { p: [13.1, 0.9, -8.6], s: 0.42, c: GREEN2 },
      { p: [12.9, 0.85, 8.7], s: 0.4, c: GREEN1 },
      { p: [-13.2, 0.75, 8.8], s: 0.38, c: GREEN2 },
      { p: [-13.75, 4.95, -5.2], s: 0.22, c: GREEN2 },
      { p: [-13.6, 4.88, -5.05], s: 0.16, c: GREEN1 },
    ];
    return {
      geo: new THREE.IcosahedronGeometry(1, 1),
      mat: new THREE.MeshLambertMaterial({ color: "#ffffff" }),
      items: blobs.map((b, i) => ({
        m: new THREE.Matrix4().compose(
          new THREE.Vector3(...b.p),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(i * 0.9, i * 1.7, 0)),
          new THREE.Vector3(b.s, b.s * 0.9, b.s),
        ),
        c: new THREE.Color(b.c),
      })),
    };
  }, []);

  useLayoutEffect(() => {
    const inst = ref.current;
    if (!inst) return;
    items.forEach((it, i) => {
      inst.setMatrixAt(i, it.m);
      inst.setColorAt(i, it.c);
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  }, [items]);

  return <instancedMesh ref={ref} args={[geo, mat, items.length]} />;
}

/** Blinking LEDs on the render racks. */
function RackLeds() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const { geo, mat, count } = useMemo(() => {
    const geo = new THREE.BoxGeometry(0.07, 0.05, 0.07);
    const mat = new THREE.MeshBasicMaterial({ color: "#ffffff" });
    return { geo, mat, count: 16 };
  }, []);
  useLayoutEffect(() => {
    const inst = ref.current;
    if (!inst) return;
    const dummy = new THREE.Object3D();
    let i = 0;
    for (const rz of [-7.4, -8.7]) {
      for (let row = 0; row < 8; row++) {
        dummy.position.set(-13.12, 0.35 + row * 0.24, rz + (i % 2 === 0 ? -0.2 : 0.2));
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
        i++;
      }
    }
    inst.instanceMatrix.needsUpdate = true;
  }, [count]);
  const acc = useRef(0);
  const on = useRef(false);
  useFrame((_, delta) => {
    acc.current += delta;
    if (acc.current < 0.35) return;
    acc.current = 0;
    on.current = !on.current;
    const inst = ref.current;
    if (!inst?.instanceColor) return;
    for (let i = 0; i < count; i++) {
      const lit = (i + (on.current ? 0 : 1)) % 2 === 0;
      inst.setColorAt(i, new THREE.Color(lit ? "#34d399" : "#232746"));
    }
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geo, mat, count]} />;
}

/* ---------------------------------- blob shadows ---------------------------------- */

function BlobShadows({ tex }: { tex: THREE.Texture }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const { geo, mat, mats } = useMemo(() => {
    const shadow = (x: number, z: number, w: number, d: number) => {
      const m = new THREE.Matrix4();
      m.compose(
        new THREE.Vector3(x, 0.012, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)),
        new THREE.Vector3(w, d, 1),
      );
      return m;
    };
    const list: THREE.Matrix4[] = [];
    for (const z of DESK_ROWS) for (const x of DESK_XS) list.push(shadow(x, z + 0.15, 2.5, 1.9));
    list.push(
      shadow(9.35, 5.6, 5.4, 3.4), // meeting table
      shadow(11.3, -6.1, 2.6, 3.2), // boss desk
      shadow(-9.0, 8.85, 3.4, 1.6), // rest sofa
      shadow(-13.55, 4.6, 1.6, 1.6), // vending
      shadow(-13.7, -0.2, 1.6, 3.8), // kitchen counter
      shadow(-13.55, -8.05, 1.6, 3.0), // render racks
      shadow(-13.75, -5.2, 1.6, 3.8), // bookshelf
      shadow(0.2, 6.5, 3.0, 2.4), // lounge sofa
      shadow(8.35, 9.2, 5.4, 1.6), // garage
      shadow(-4.8, -9.0, 1.4, 1.4),
      shadow(13.1, -8.6, 1.3, 1.3),
      shadow(12.9, 8.7, 1.3, 1.3),
      shadow(-13.2, 8.8, 1.2, 1.2),
    );
    return {
      geo: new THREE.PlaneGeometry(1, 1),
      mat: new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
      mats: list,
    };
  }, [tex]);

  useLayoutEffect(() => {
    const inst = ref.current;
    if (!inst) return;
    mats.forEach((m, i) => inst.setMatrixAt(i, m));
    inst.instanceMatrix.needsUpdate = true;
  }, [mats]);

  return <instancedMesh ref={ref} args={[geo, mat, mats.length]} renderOrder={1} />;
}

/* ---------------------------------- live surfaces ---------------------------------- */

interface LiveTex {
  skyline: ReturnType<typeof createSkyline>;
  whiteboard: ReturnType<typeof createWhiteboard>;
  meetingScreen: ReturnType<typeof createMeetingScreen>;
  screens: ReturnType<typeof createScreen>[];
}

/** Drives all canvas-texture redraws on gated ticks (never per frame). */
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
      live.meetingScreen.redraw(hour, isOnShift(hour));
    }
    if (a.tScreen > 0.5) {
      a.tScreen = 0;
      const on = isOnShift(hour);
      const agent = AGENTS[a.screenIdx];
      const job = currentJobFor(agent.id, st.jobs);
      live.screens[a.screenIdx].redraw(
        performance.now() / 1000,
        on,
        job ? { status: job.status, progress: job.progress } : undefined,
      );
      a.screenIdx = (a.screenIdx + 1) % live.screens.length;
    }
  });
}

const WIN_W = 4.25;
const WIN_H = 3.8;
const NORTH_PANELS = [-11.35, -6.85, -2.35, 2.15];

/** Window panels on the north wall (hidden together with it). */
function NorthWindows({ live }: { live: LiveTex }) {
  return (
    <group>
      {NORTH_PANELS.map((x) => (
        <mesh key={x} position={[x, 3.0, -FLOOR_D / 2 - 0.18]}>
          <planeGeometry args={[WIN_W, WIN_H]} />
          <meshBasicMaterial map={live.skyline.tex} toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[9.3, 3.0, -FLOOR_D / 2 - 0.18]}>
        <planeGeometry args={[5.6, WIN_H]} />
        <meshBasicMaterial map={live.skyline.tex} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Live whiteboard on the east wall. */
function EastWhiteboard({ live }: { live: LiveTex }) {
  return (
    <mesh position={[FLOOR_W / 2 - 0.16, 3.55, 0]} rotation-y={-Math.PI / 2}>
      <planeGeometry args={[4.52, 2.62]} />
      <meshBasicMaterial map={live.whiteboard.tex} toneMapped={false} />
    </mesh>
  );
}

/** Meeting-room TV on the south wall (inside the glass room). */
function MeetingTV({ live }: { live: LiveTex }) {
  return (
    <group>
      <mesh position={[9.35, 3.35, FLOOR_D / 2 - 0.04]} rotation-y={Math.PI}>
        <planeGeometry args={[4.3, 2.42]} />
        <meshBasicMaterial map={live.meetingScreen.tex} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Desk monitor screens (always visible — they sit on the desks). */
function DeskScreens({ live }: { live: LiveTex }) {
  return (
    <group>
      {AGENTS.map((agent, i) => {
        const row = i < 3 ? 0 : 1;
        const x = DESK_XS[i % 3];
        const z = DESK_ROWS[row];
        return (
          <mesh key={agent.id} position={[x, 1.36, z + 0.098]}>
            <planeGeometry args={[0.56, 0.36]} />
            <meshBasicMaterial map={live.screens[i].tex} toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
}

/* ---------------------------------- desk labels + mugs ---------------------------------- */

function DeskLabels() {
  const labels = useHqStore((s) => s.labels);
  const textures = useMemo(() => AGENTS.map((a) => createDeskLabel(a.name, a.color)), []);
  return (
    <group>
      {AGENTS.map((agent, i) => {
        const row = i < 3 ? 0 : 1;
        const x = DESK_XS[i % 3];
        const z = DESK_ROWS[row];
        return (
          <mesh key={agent.id} position={[x, 1.14, z + 0.505]} visible={labels}>
            <planeGeometry args={[0.56, 0.14]} />
            <meshBasicMaterial map={textures[i]} toneMapped={false} transparent />
          </mesh>
        );
      })}
    </group>
  );
}

function Mugs() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const { geo, mat } = useMemo(
    () => ({ geo: new THREE.CylinderGeometry(0.05, 0.045, 0.1, 10), mat: new THREE.MeshLambertMaterial({ color: "#ffffff" }) }),
    [],
  );
  useLayoutEffect(() => {
    const inst = ref.current;
    if (!inst) return;
    const dummy = new THREE.Object3D();
    AGENTS.forEach((a, i) => {
      const row = i < 3 ? 0 : 1;
      dummy.position.set(DESK_XS[i % 3] + 0.72, 1.27, DESK_ROWS[row] + 0.18);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      inst.setColorAt(i, new THREE.Color(a.color));
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  }, []);
  return <instancedMesh ref={ref} args={[geo, mat, AGENTS.length]} />;
}

/* ---------------------------------- wall clock (sim time) ---------------------------------- */

function WallClock() {
  const hourHand = useRef<THREE.Group>(null);
  const minuteHand = useRef<THREE.Group>(null);
  useFrame(() => {
    const { hour } = useHqStore.getState();
    if (hourHand.current) hourHand.current.rotation.z = -(hour % 12) * (Math.PI / 6);
    if (minuteHand.current) minuteHand.current.rotation.z = -(hour % 1) * Math.PI * 2;
  });
  return (
    <group position={[-9.5, 5.0, -FLOOR_D / 2 - 0.02]}>
      <mesh>
        <circleGeometry args={[0.34, 24]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0, 0, 0.01]}>
        <ringGeometry args={[0.29, 0.34, 24]} />
        <meshBasicMaterial color={INK} />
      </mesh>
      <group ref={hourHand} position={[0, 0, 0.02]}>
        <mesh position={[0, 0.1, 0]}>
          <boxGeometry args={[0.035, 0.2, 0.01]} />
          <meshBasicMaterial color={INK} />
        </mesh>
      </group>
      <group ref={minuteHand} position={[0, 0, 0.03]}>
        <mesh position={[0, 0.13, 0]}>
          <boxGeometry args={[0.025, 0.26, 0.01]} />
          <meshBasicMaterial color="#6d28d9" />
        </mesh>
      </group>
    </group>
  );
}

/* ---------------------------------- signs, posters, rugs, vending ---------------------------------- */

function Decor() {
  const rug = useMemo(() => createRug(), []);
  const vending = useMemo(() => createVendingFront(), []);
  return (
    <group>
      {/* vending front (on the machine, not the wall) */}
      <mesh position={[-13.1, 1.05, 4.6]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[1.0, 1.75]} />
        <meshBasicMaterial map={vending} toneMapped={false} />
      </mesh>
      {/* rugs */}
      <mesh position={[0.1, 0.02, 6.2]} rotation-x={-Math.PI / 2} renderOrder={1}>
        <circleGeometry args={[2.3, 40]} />
        <meshBasicMaterial map={rug} transparent opacity={0.95} depthWrite={false} />
      </mesh>
      <mesh position={[-9.0, 0.02, 7.3]} rotation-x={-Math.PI / 2} renderOrder={1}>
        <circleGeometry args={[1.8, 36]} />
        <meshBasicMaterial map={rug} transparent opacity={0.9} depthWrite={false} />
      </mesh>
      <mesh position={[9.35, 0.03, 5.6]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[8.0, 6.8]} />
        <meshBasicMaterial color="#e3e8f4" transparent opacity={0.85} depthWrite={false} />
      </mesh>
      <mesh position={[9.35, 0.03, -6.1]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[8.0, 5.6]} />
        <meshBasicMaterial color="#e9e2f4" transparent opacity={0.85} depthWrite={false} />
      </mesh>
      {/* lamp shade */}
      <mesh position={[3.5, 2.32, 7.7]}>
        <cylinderGeometry args={[0.24, 0.38, 0.42, 14]} />
        <meshBasicMaterial color="#ffd9a4" />
      </mesh>
      {/* beanbags */}
      <mesh position={[2.6, 0.3, 6.4]} scale={[1, 0.55, 1]}>
        <sphereGeometry args={[0.55, 14, 10]} />
        <meshLambertMaterial color={TERRA} />
      </mesh>
      <mesh position={[-2.5, 0.3, 6.6]} scale={[1, 0.55, 1]}>
        <sphereGeometry args={[0.55, 14, 10]} />
        <meshLambertMaterial color="#5b8f6e" />
      </mesh>
      {/* rest-room floor cushions */}
      {(
        [
          [-11.5, 7.2], [-10.3, 6.5], [-7.7, 6.5], [-6.5, 7.2],
        ] as const
      ).map(([x, z], i) => (
        <mesh key={i} position={[x, 0.07, z]}>
          <cylinderGeometry args={[0.42, 0.46, 0.13, 16]} />
          <meshLambertMaterial color={i % 2 === 0 ? "#f0d9cf" : "#d9e6dd"} />
        </mesh>
      ))}
    </group>
  );
}

/** Wall-attached decor for the west wall (signs/posters fade with it). */
function WestWallDecor() {
  const signs = useMemo(() => ({ kopi: createSign("POJOK KOPI", "#f59e0b") }), []);
  const posters = useMemo(() => [createPoster("hooks")], []);
  return (
    <group>
      <mesh position={[-FLOOR_W / 2 - 0.22, 4.1, -0.2]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[2.1, 0.6]} />
        <meshBasicMaterial map={signs.kopi} toneMapped={false} transparent />
      </mesh>
      <mesh position={[-FLOOR_W / 2 - 0.22, 4.1, 3.1]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[1.4, 1.85]} />
        <meshBasicMaterial map={posters[0]} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Wall-attached decor for the south wall. */
function SouthWallDecor() {
  const signs = useMemo(
    () => ({
      rehat: createSign("RUANG REHAT", "#10b981"),
      garage: createSign("CREW GARAGE", "#232746", 300, 72),
      meeting: createSign("MEETING ROOM", "#0ea5e9", 300, 72),
      boss: createSign("BOSS · KAMU", "#7c3aed", 300, 72),
    }),
    [],
  );
  const posters = useMemo(() => [createPoster("play")], []);
  return (
    <group>
      <mesh position={[-9.3, 4.5, FLOOR_D / 2 - 0.04]} rotation-y={Math.PI}>
        <planeGeometry args={[2.3, 0.65]} />
        <meshBasicMaterial map={signs.rehat} toneMapped={false} transparent />
      </mesh>
      <mesh position={[3.4, 3.7, FLOOR_D / 2 - 0.04]} rotation-y={Math.PI}>
        <planeGeometry args={[1.4, 1.85]} />
        <meshBasicMaterial map={posters[0]} toneMapped={false} />
      </mesh>
      <mesh position={[8.35, 4.2, FLOOR_D / 2 - 0.04]} rotation-y={Math.PI}>
        <planeGeometry args={[2.4, 0.58]} />
        <meshBasicMaterial map={signs.garage} toneMapped={false} transparent />
      </mesh>
      {/* glass-room door signs sit ON the glass partitions (always visible) */}
      <mesh position={[9.35, 4.55, 2.12]}>
        <planeGeometry args={[2.3, 0.56]} />
        <meshBasicMaterial map={signs.meeting} toneMapped={false} transparent />
      </mesh>
      <mesh position={[9.35, 4.55, -2.88]}>
        <planeGeometry args={[2.3, 0.56]} />
        <meshBasicMaterial map={signs.boss} toneMapped={false} transparent />
      </mesh>
    </group>
  );
}

/* ---------------------------------- the cat 🐈 ---------------------------------- */

function OfficeCat() {
  const group = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const waypoints = useMemo(
    () =>
      [
        [-3.2, 3.4],
        [1.6, 4.3],
        [4.2, 2.4],
        [2.0, 1.2],
        [-2.2, 2.0],
      ].map(([x, z]) => new THREE.Vector3(x, 0.14, z)),
    [],
  );
  const anim = useRef({ i: 0, wait: 0 });
  useFrame((rs, delta) => {
    const g = group.current;
    if (!g) return;
    const s = anim.current;
    const t = rs.clock.elapsedTime;
    if (s.wait > 0) {
      s.wait -= delta;
      g.position.y = 0.14 + Math.abs(Math.sin(t * 3)) * 0.02;
      if (tail.current) tail.current.rotation.y = Math.sin(t * 6) * 0.5;
      return;
    }
    const target = waypoints[s.i];
    const dir = target.clone().sub(g.position);
    const dist = dir.length();
    if (dist < 0.15) {
      s.i = (s.i + 1) % waypoints.length;
      s.wait = 1.2 + Math.random() * 2;
      return;
    }
    dir.normalize();
    g.position.addScaledVector(dir, Math.min(dist, delta * 0.85));
    g.position.y = 0.14 + Math.abs(Math.sin(t * 10)) * 0.05;
    const targetYaw = Math.atan2(dir.x, dir.z);
    const diff = ((targetYaw - g.rotation.y + Math.PI) % (Math.PI * 2)) - Math.PI;
    g.rotation.y += diff * (1 - Math.exp(-delta * 6));
    if (tail.current) tail.current.rotation.y = Math.sin(t * 8) * 0.35;
  });
  return (
    <group ref={group} position={[-3.2, 0.14, 3.4]}>
      {/* body */}
      <mesh rotation-z={Math.PI / 2}>
        <capsuleGeometry args={[0.13, 0.34, 6, 10]} />
        <meshLambertMaterial color="#e2a75e" />
      </mesh>
      {/* head */}
      <group position={[0, 0.13, 0.26]}>
        <mesh>
          <sphereGeometry args={[0.13, 12, 10]} />
          <meshLambertMaterial color="#e2a75e" />
        </mesh>
        {[-0.06, 0.06].map((x) => (
          <mesh key={x} position={[x, 0.12, 0]}>
            <coneGeometry args={[0.045, 0.09, 6]} />
            <meshLambertMaterial color="#c98a4b" />
          </mesh>
        ))}
        {/* eyes + nose */}
        {[-0.05, 0.05].map((x) => (
          <mesh key={x} position={[x, 0.02, 0.11]}>
            <sphereGeometry args={[0.02, 8, 6]} />
            <meshBasicMaterial color="#232746" />
          </mesh>
        ))}
      </group>
      {/* tail */}
      <group ref={tail} position={[0, 0.06, -0.26]}>
        <mesh rotation-x={0.9} position={[0, 0.06, -0.08]}>
          <capsuleGeometry args={[0.032, 0.26, 4, 8]} />
          <meshLambertMaterial color="#c98a4b" />
        </mesh>
      </group>
    </group>
  );
}

/* ---------------------------------- diecast garage (the fleet as minis) ---------------------------------- */

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
      parts.push(
        boxAt(0.26, 0.11, 0.5, 0, 0.12, 0),
        boxAt(0.24, 0.11, 0.17, 0, 0.23, 0.13),
        boxAt(0.22, 0.07, 0.03, 0, 0.2, -0.23),
      );
      break;
    case "scooter":
      parts.push(
        boxAt(0.09, 0.05, 0.32, 0, 0.1, 0),
        boxAt(0.04, 0.3, 0.04, 0, 0.24, 0.13),
        boxAt(0.18, 0.03, 0.03, 0, 0.39, 0.15),
        boxAt(0.11, 0.06, 0.17, 0, 0.22, -0.05),
      );
      break;
  }
  return merge(parts);
}

function vehicleWindows(kind: VehicleInfo["kind"]): THREE.BufferGeometry | null {
  switch (kind) {
    case "sedan":
      return merge([boxAt(0.235, 0.07, 0.2, 0, 0.25, -0.02)]);
    case "van":
      return merge([boxAt(0.28, 0.08, 0.12, 0, 0.24, 0.1)]);
    case "hatch":
      return merge([boxAt(0.235, 0.07, 0.18, 0, 0.25, -0.05)]);
    case "pickup":
      return merge([boxAt(0.245, 0.07, 0.1, 0, 0.24, 0.13)]);
    case "scooter":
      return null;
  }
}

const DIECAST_TOP_Y = 1.515;

function DiecastGarage() {
  const select = useHqStore((s) => s.select);
  const wheelRef = useRef<THREE.InstancedMesh>(null);
  const glassMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#1b2140" }), []);
  const bodies = useMemo(
    () => VEHICLES.map((v) => ({ info: v, geo: vehicleBodyGeometry(v.kind) })),
    [],
  );
  const wheels = useMemo(() => {
    const geo = wheelGeo();
    const mat = new THREE.MeshLambertMaterial({ color: "#20263f" });
    const mats: THREE.Matrix4[] = [];
    const dummy = new THREE.Object3D();
    for (const v of VEHICLES) {
      const [vx, vz] = v.pos;
      const off: Array<[number, number, number]> =
        v.kind === "scooter"
          ? [
              [0, 0.06, 0.14],
              [0, 0.06, -0.14],
            ]
          : [
              [0.135, 0.07, 0.16],
              [-0.135, 0.07, 0.16],
              [0.135, 0.07, -0.16],
              [-0.135, 0.07, -0.16],
            ];
      for (const o of off) {
        dummy.position.set(vx + o[0], DIECAST_TOP_Y + o[1], vz + o[2]);
        dummy.rotation.set(0, v.yaw, 0);
        dummy.updateMatrix();
        mats.push(dummy.matrix.clone());
      }
    }
    return { geo, mat, mats };
  }, []);

  const winGeos = useMemo(() => {
    const list = VEHICLES.map((v) => {
      const g = vehicleWindows(v.kind);
      if (!g) return null;
      g.applyMatrix4(
        new THREE.Matrix4().compose(
          new THREE.Vector3(v.pos[0], DIECAST_TOP_Y, v.pos[1]),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, v.yaw, 0)),
          new THREE.Vector3(1, 1, 1),
        ),
      );
      return g;
    }).filter(Boolean) as THREE.BufferGeometry[];
    return merge(list);
  }, []);

  useLayoutEffect(() => {
    const inst = wheelRef.current;
    if (!inst) return;
    wheels.mats.forEach((m, i) => inst.setMatrixAt(i, m));
    inst.instanceMatrix.needsUpdate = true;
  }, [wheels]);

  const hover = (e: ThreeEvent<PointerEvent>, on: boolean) => {
    e.stopPropagation();
    document.body.style.cursor = on ? "pointer" : "auto";
  };

  return (
    <group>
      {bodies.map(({ info, geo }) => (
        <group key={info.id} position={[info.pos[0], DIECAST_TOP_Y, info.pos[1]]} rotation-y={info.yaw}>
          <mesh
            geometry={geo}
            onClick={(e) => {
              e.stopPropagation();
              select({ kind: "vehicle", id: info.id });
            }}
            onPointerOver={(e) => hover(e, true)}
            onPointerOut={(e) => hover(e, false)}
          >
            <meshLambertMaterial color={info.color} />
          </mesh>
          <mesh
            position={[0, 0.16, 0]}
            visible={false}
            onClick={(e) => {
              e.stopPropagation();
              select({ kind: "vehicle", id: info.id });
            }}
            onPointerOver={(e) => hover(e, true)}
            onPointerOut={(e) => hover(e, false)}
          >
            <boxGeometry args={[0.55, 0.5, 0.75]} />
          </mesh>
        </group>
      ))}
      <instancedMesh ref={wheelRef} args={[wheels.geo, wheels.mat, wheels.mats.length]} />
      <mesh geometry={winGeos} material={glassMat} />
    </group>
  );
}

/* ---------------------------------- fading walls wrapper ---------------------------------- */

function FadingWall({
  side,
  children,
}: {
  side: "n" | "s" | "w" | "e";
  children: React.ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ camera }) => {
    const g = ref.current;
    if (!g) return;
    const behind =
      side === "n" ? camera.position.z < -4
      : side === "s" ? camera.position.z > 4
      : side === "w" ? camera.position.x < -6
      : camera.position.x > 6;
    if (g.visible === behind) g.visible = !behind;
  });
  return <group ref={ref}>{children}</group>;
}

/* ---------------------------------- world root ---------------------------------- */

export function World() {
  const shell = useShellGeometries();
  const furn = useFurnitureGeometries();
  const mats = useRoomMaterials();
  const floorTex = useMemo(() => createFloorGrid(), []);
  const blobTex = useMemo(() => createBlobShadow(), []);
  const live = useMemo<LiveTex>(
    () => ({
      skyline: createSkyline(),
      whiteboard: createWhiteboard(),
      meetingScreen: createMeetingScreen(),
      screens: AGENTS.map((a) => createScreen(a)),
    }),
    [],
  );
  useLiveUpdates(live);

  useLayoutEffect(() => {
    return () => {
      [floorTex, blobTex].forEach((t) => t.dispose());
    };
  }, [floorTex, blobTex]);

  return (
    <group>
      {/* soft drop shadow under the tray */}
      <mesh rotation-x={-Math.PI / 2} position={[0.8, -0.815, 0.8]} renderOrder={0}>
        <planeGeometry args={[FLOOR_W + 9, FLOOR_D + 9]} />
        <meshBasicMaterial map={blobTex} transparent opacity={0.6} depthWrite={false} />
      </mesh>

      {/* floor */}
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[FLOOR_W, FLOOR_D]} />
        <meshLambertMaterial map={floorTex} />
      </mesh>

      {/* tray + glass rooms (always visible) */}
      <mesh geometry={shell.tray} material={mats.tray} />
      <mesh geometry={shell.glass} material={mats.glass} renderOrder={3} />
      <mesh geometry={shell.glassFrame} material={mats.navy} />
      <mesh geometry={shell.glass2} material={mats.glass} renderOrder={3} />
      <mesh geometry={shell.glassFrame2} material={mats.navy} />
      <mesh geometry={boxAt(8.0, 0.04, 6.8, 9.35, 0.02, 5.6)} material={mats.carpetMeeting} />
      <mesh geometry={boxAt(8.0, 0.04, 5.6, 9.35, 0.02, -6.1)} material={mats.carpetBoss} />

      {/* fading walls + their attached windows/decor */}
      <FadingWall side="n">
        <mesh geometry={shell.wallN} material={mats.wall} />
        <mesh geometry={shell.wallN2} material={mats.wall} />
        <NorthWindows live={live} />
        <WallClock />
      </FadingWall>
      <FadingWall side="e">
        <mesh geometry={shell.wallE} material={mats.wall} />
        <EastWhiteboard live={live} />
      </FadingWall>
      <FadingWall side="w">
        <mesh geometry={shell.wallW} material={mats.wall} />
        <WestWallDecor />
      </FadingWall>
      <FadingWall side="s">
        <mesh geometry={shell.wallS} material={mats.wall} />
        <SouthWallDecor />
        <MeetingTV live={live} />
      </FadingWall>

      {/* trims + furniture */}
      <mesh geometry={shell.white} material={mats.white} />
      <mesh geometry={furn.white} material={mats.white} />
      <mesh geometry={furn.navy} material={mats.navy} />
      <mesh geometry={furn.silver} material={mats.silver} />
      <mesh geometry={furn.wood} material={mats.wood} />
      <mesh geometry={furn.woodDark} material={mats.woodDark} />
      <mesh geometry={furn.cardboard} material={mats.cardboard} />
      <mesh geometry={furn.cream} material={mats.cream} />
      <mesh geometry={furn.gold} material={mats.gold} />
      <mesh geometry={furn.pots} material={mats.terra} />

      <BlobShadows tex={blobTex} />
      <Books />
      <Foliage />
      <RackLeds />
      <Mugs />
      <DeskLabels />
      <DeskScreens live={live} />
      <Decor />
      <OfficeCat />
      <DiecastGarage />
    </group>
  );
}

export { WALL_H };
