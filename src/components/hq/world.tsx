/**
 * CLIPYARD Studio — cozy isometric interior diorama.
 * Corner room (two walls), skyline window, rainbow bookshelf, live pipeline
 * whiteboard, six white desks with mascot agents, navy lounge, and a diecast
 * "CREW GARAGE" shelf carrying the old employee vehicles as miniatures.
 *
 * Static geometry is merged per material (a handful of draw calls total);
 * canvas textures are created once and redrawn on gated ticks only.
 */
import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { AGENTS, VEHICLES, type VehicleInfo } from "@/lib/hq-data";
import { dayFactors, useHqStore } from "@/lib/hq-store";
import {
  createBlobShadow,
  createDeskLabel,
  createFloorGrid,
  createGaragePlacard,
  createPoster,
  createRug,
  createScreen,
  createSkyline,
  createWhiteboard,
  seededRandom,
  type ScreenTex,
} from "@/lib/hq-textures";

/* ---------------------------------- palette ---------------------------------- */

const INK = "#232746";
const NAVY = "#3a4070";
const WALL = "#f4f5fe";
const WALL_LEFT = "#eef0fc";
const WHITE = "#ffffff";
const WOOD = "#d8a97a";
const TERRA = "#c9704d";
const CARDBOARD = "#d9b48c";
const GREEN1 = "#57ab72";
const GREEN2 = "#6fbf85";
const GLASS = "#1b2140";

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

/** merge a list of geometries (already positioned) into one */
function merge(list: THREE.BufferGeometry[]) {
  const merged = mergeGeometries(list, false);
  list.forEach((g) => g.dispose());
  if (!merged) throw new Error("merge failed");
  merged.computeBoundingSphere();
  return merged;
}

/* ---------------------------------- room dimensions ---------------------------------- */

const FLOOR_W = 18;
const FLOOR_D = 13;
const WALL_H = 6.4;

/* ---------------------------------- static room shell ---------------------------------- */

function useRoomGeometries() {
  return useMemo(() => {
    // white diorama tray (plinth + wall caps) — reference-style light base
    const tray = merge([
      boxAt(FLOOR_W + 1.4, 0.8, FLOOR_D + 1.4, 0, -0.41, 0),
      boxAt(FLOOR_W + 0.9, 0.34, 0.6, -0.2, WALL_H + 0.16, -6.7), // back cap
      boxAt(0.6, 0.34, FLOOR_D + 0.4, -9.2, WALL_H + 0.16, 0.1), // left cap
    ]);

    // walls (back wall has the window hole; left wall is a separate tint)
    const walls = merge([
      boxAt(3.6, WALL_H, 0.4, -7.2, WALL_H / 2, -6.7), // back left of window
      boxAt(9.6, WALL_H, 0.4, 4.2, WALL_H / 2, -6.7), // back right of window
      boxAt(4.8, 1.9, 0.4, -3.0, 0.95, -6.7), // under window
      boxAt(4.8, 1.1, 0.4, -3.0, 5.85, -6.7), // over window
    ]);
    const walls2 = merge([boxAt(0.4, WALL_H, FLOOR_D + 0.4, -9.2, WALL_H / 2, 0.1)]);

    // white: baseboards, window frame, sill, mullions
    const white = merge([
      boxAt(FLOOR_W, 0.28, 0.08, 0, 0.14, -6.46),
      boxAt(0.08, 0.28, FLOOR_D, -8.96, 0.14, 0),
      // window frame
      boxAt(5.1, 0.16, 0.24, -3.0, 1.9, -6.68),
      boxAt(5.1, 0.16, 0.24, -3.0, 5.3, -6.68),
      boxAt(0.16, 3.56, 0.24, -5.4, 3.6, -6.68),
      boxAt(0.16, 3.56, 0.24, -0.6, 3.6, -6.68),
      boxAt(0.08, 3.4, 0.12, -3.0, 3.6, -6.62),
      boxAt(4.8, 0.08, 0.12, -3.0, 3.6, -6.62),
      boxAt(5.2, 0.1, 0.34, -3.0, 1.82, -6.55), // sill
    ]);

    return { tray, walls, walls2, white };
  }, []);
}

/* ---------------------------------- desks (merged statics) ---------------------------------- */

const DESK_ROWS = [-2.9, 1.7];
const DESK_XS = [-4.9, 0, 4.9];

function useFurnitureGeometries() {
  return useMemo(() => {
    const white: THREE.BufferGeometry[] = [];
    const navy: THREE.BufferGeometry[] = [];
    const silver: THREE.BufferGeometry[] = [];
    const wood: THREE.BufferGeometry[] = [];
    const cardboard: THREE.BufferGeometry[] = [];
    const cream: THREE.BufferGeometry[] = [];

    // 6 desks: top + pedestal + keyboard
    for (const zx of [0, 1]) {
      for (const x of DESK_XS) {
        const z = DESK_ROWS[zx];
        white.push(
          boxAt(2.0, 0.12, 1.0, x, 1.14, z),
          boxAt(1.5, 1.02, 0.62, x, 0.57, z),
          boxAt(0.54, 0.05, 0.2, x, 1.225, z + 0.3),
        );
        // monitor: navy frame + stand, laptop-ish so mascots stay visible
        navy.push(
          boxAt(0.66, 0.44, 0.07, x, 1.34, z + 0.06),
          boxAt(0.08, 0.16, 0.08, x, 1.22, z + 0.06),
          boxAt(0.3, 0.05, 0.18, x, 1.2, z + 0.06),
        );
        // chair: navy seat + back, silver pole + base
        const ax = x;
        const az = z - 0.62;
        navy.push(
          boxAt(0.5, 0.09, 0.5, ax, 0.72, az),
          boxAt(0.5, 0.52, 0.09, ax, 1.0, az - 0.21),
        );
        silver.push(cylAt(0.035, 0.035, 0.42, 8, ax, 0.46, az), boxAt(0.38, 0.05, 0.38, ax, 0.22, az));
      }
    }

    // bookshelf on the left wall
    const bz = -3.2;
    wood.push(
      boxAt(0.6, 0.1, 3.3, -8.6, 4.42, bz),
      boxAt(0.6, 4.6, 0.09, -8.6, 2.3, bz - 1.62),
      boxAt(0.6, 4.6, 0.09, -8.6, 2.3, bz + 1.62),
      boxAt(0.56, 0.08, 3.16, -8.6, 1.72, bz),
      boxAt(0.56, 0.08, 3.16, -8.6, 2.98, bz),
      boxAt(0.56, 0.08, 3.16, -8.6, 4.24, bz),
      boxAt(0.56, 0.08, 3.16, -8.6, 0.5, bz),
      boxAt(0.5, 0.5, 0.5, -8.6, 0.25, bz), // bottom kick
    );

    // garage sideboard (diecast display)
    white.push(boxAt(0.8, 1.4, 4.4, -8.55, 0.7, 2.7));
    navy.push(boxAt(0.92, 0.09, 4.52, -8.55, 1.47, 2.7));

    // lounge: navy sofa facing the room (-x)
    const sx = 6.95;
    const sz = 3.2;
    navy.push(
      boxAt(0.95, 0.52, 3.4, sx, 0.5, sz),
      boxAt(0.9, 0.2, 1.5, sx - 0.04, 0.84, sz - 0.78),
      boxAt(0.9, 0.2, 1.5, sx - 0.04, 0.84, sz + 0.78),
      boxAt(0.3, 1.15, 3.4, sx + 0.42, 1.0, sz),
      boxAt(0.95, 0.66, 0.26, sx, 0.9, sz - 1.83),
      boxAt(0.95, 0.66, 0.26, sx, 0.9, sz + 1.83),
    );
    // sofa cushions (accent pillows)
    cream.push(boxAt(0.18, 0.42, 0.42, sx + 0.18, 1.12, sz - 0.9, 0.2));

    // speaker
    navy.push(boxAt(0.5, 1.05, 0.5, 7.85, 0.53, 5.7));
    // floor lamp
    silver.push(cylAt(0.03, 0.03, 2.1, 8, 7.8, 1.05, 0.9), cylAt(0.2, 0.24, 0.06, 12, 7.8, 0.05, 0.9));

    // coffee table
    white.push(cylAt(0.46, 0.46, 0.07, 20, 4.7, 0.68, 3.3), cylAt(0.07, 0.09, 0.64, 10, 4.7, 0.34, 3.3));

    // shipping boxes ("CLIPS") in the back-right corner
    cardboard.push(
      boxAt(0.72, 0.62, 0.72, 7.6, 0.31, -5.3, 0.12),
      boxAt(0.58, 0.5, 0.58, 7.5, 0.87, -5.25, -0.2),
      boxAt(0.46, 0.42, 0.46, 7.72, 1.33, -5.35, 0.35),
    );
    cream.push(
      boxAt(0.74, 0.08, 0.2, 7.6, 0.62, -5.3, 0.12),
      boxAt(0.2, 0.08, 0.74, 7.6, 0.62, -5.3, 0.12),
      boxAt(0.6, 0.07, 0.16, 7.5, 1.12, -5.25, -0.2),
    );

    // plant pots
    const pots = merge([
      cylAt(0.34, 0.26, 0.5, 12, 8.0, 0.25, -5.4),
      cylAt(0.26, 0.2, 0.4, 12, -7.9, 0.2, 5.75),
      cylAt(0.16, 0.13, 0.26, 10, -8.6, 4.62, -3.2),
    ]);

    // whiteboard frame + tray + markers
    navy.push(
      boxAt(4.84, 2.94, 0.1, 4.4, 3.52, -6.42),
      boxAt(4.3, 0.08, 0.26, 4.4, 2.0, -6.36),
      boxAt(0.22, 0.05, 0.08, 3.6, 2.06, -6.36),
      boxAt(0.22, 0.05, 0.08, 3.9, 2.06, -6.36),
    );
    // poster frames
    navy.push(boxAt(0.07, 2.2, 1.7, -8.95, 3.9, 0.9), boxAt(1.5, 1.9, 0.07, 0.9, 3.75, -6.42));

    return {
      white: merge(white),
      navy: merge(navy),
      silver: merge(silver),
      wood: merge(wood),
      cardboard: merge(cardboard),
      cream: merge(cream),
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
      wallLeft: lambert(WALL_LEFT),
      white: lambert(WHITE),
      navy: lambert(NAVY),
      silver: lambert("#b9bed4"),
      wood: lambert(WOOD),
      cardboard: lambert(CARDBOARD),
      cream: lambert("#efe6d4"),
      terra: lambert(TERRA),
      glass: new THREE.MeshBasicMaterial({ color: GLASS }),
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
      let z = -4.62;
      while (z < -1.85) {
        const t = 0.08 + rnd() * 0.06;
        const h = 0.44 + rnd() * 0.22;
        const m = new THREE.Matrix4();
        m.compose(
          new THREE.Vector3(-8.6, sy + 0.04 + h / 2, z + t / 2),
          new THREE.Quaternion(),
          new THREE.Vector3(1, h, t / 0.11),
        );
        mats.push(m);
        cols.push(new THREE.Color(BOOK_COLORS[Math.floor(rnd() * BOOK_COLORS.length)]));
        z += t + 0.015 + rnd() * 0.02;
      }
    }
    return {
      geo: new THREE.BoxGeometry(0.34, 1, 0.11),
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

/* ---------------------------------- plants (instanced foliage) ---------------------------------- */

function Foliage() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const { geo, mat, items } = useMemo(() => {
    const blobs: Array<{ p: [number, number, number]; s: number; c: string }> = [
      { p: [8.0, 0.95, -5.4], s: 0.5, c: GREEN1 },
      { p: [7.7, 1.32, -5.15], s: 0.38, c: GREEN2 },
      { p: [8.25, 1.25, -5.6], s: 0.34, c: GREEN1 },
      { p: [-7.9, 0.72, 5.75], s: 0.4, c: GREEN2 },
      { p: [-7.68, 0.62, 5.55], s: 0.3, c: GREEN1 },
      { p: [-8.6, 4.95, -3.2], s: 0.22, c: GREEN2 },
      { p: [-8.45, 4.88, -3.05], s: 0.16, c: GREEN1 },
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

/* ---------------------------------- blob shadows (instanced) ---------------------------------- */

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
    for (const zx of [0, 1]) for (const x of DESK_XS) list.push(shadow(x, DESK_ROWS[zx] + 0.15, 2.5, 1.9));
    list.push(
      shadow(6.85, 3.2, 2.0, 4.2), // sofa
      shadow(-8.45, 2.7, 1.8, 5.0), // sideboard
      shadow(-8.5, -3.2, 1.6, 3.8), // bookshelf
      shadow(8.0, -5.4, 1.5, 1.5), // plant big
      shadow(-7.9, 5.75, 1.2, 1.2), // plant med
      shadow(7.8, 0.9, 1.0, 1.0), // lamp
      shadow(7.85, 5.7, 1.1, 1.1), // speaker
      shadow(4.7, 3.3, 1.6, 1.6), // coffee table
      shadow(7.6, -5.3, 1.5, 1.5), // boxes
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

  const count = mats.length;
  return <instancedMesh ref={ref} args={[geo, mat, count]} renderOrder={1} />;
}

/* ---------------------------------- live surfaces: window, whiteboard, screens ---------------------------------- */

function LiveSurfaces() {
  const skyline = useMemo(() => createSkyline(), []);
  const whiteboard = useMemo(() => createWhiteboard(), []);
  const screens = useMemo(() => AGENTS.map((a) => createScreen(a)), []);
  const acc = useRef({ skyKey: -1, tScreen: 0, tWb: 10, screenIdx: 0 });

  useFrame((_, delta) => {
    const hour = useHqStore.getState().hour;
    const a = acc.current;
    a.tScreen += delta;
    a.tWb += delta;

    // skyline: redraw every 15 sim-minutes
    const key = Math.floor(hour * 4);
    if (key !== a.skyKey) {
      a.skyKey = key;
      const { daylight, sunset } = dayFactors(hour);
      skyline.redraw(daylight, sunset, hour);
    }

    // whiteboard: every ~2s
    if (a.tWb > 2) {
      a.tWb = 0;
      whiteboard.redraw(hour, performance.now() / 1000);
    }

    // one agent screen per half-second (round robin)
    if (a.tScreen > 0.5) {
      a.tScreen = 0;
      const on = hour >= 9 && hour < 17;
      screens[a.screenIdx].redraw(performance.now() / 1000, on);
      a.screenIdx = (a.screenIdx + 1) % screens.length;
    }
  });

  return (
    <group>
      {/* window skyline */}
      <mesh position={[-3.0, 3.6, -6.62]}>
        <planeGeometry args={[4.8, 3.4]} />
        <meshBasicMaterial map={skyline.tex} toneMapped={false} />
      </mesh>
      {/* whiteboard surface */}
      <mesh position={[4.4, 3.55, -6.36]}>
        <planeGeometry args={[4.52, 2.62]} />
        <meshBasicMaterial map={whiteboard.tex} toneMapped={false} />
      </mesh>
      {/* agent monitor screens */}
      {AGENTS.map((agent, i) => {
        const row = i < 3 ? 0 : 1;
        const x = DESK_XS[i % 3];
        const z = DESK_ROWS[row];
        return (
          <mesh key={agent.id} position={[x, 1.36, z + 0.098]}>
            <planeGeometry args={[0.56, 0.36]} />
            <meshBasicMaterial map={screens[i].tex} toneMapped={false} />
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
    <group position={[1.3, 5.55, -6.42]}>
      <mesh>
        <circleGeometry args={[0.3, 24]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0, 0, 0.01]}>
        <ringGeometry args={[0.26, 0.3, 24]} />
        <meshBasicMaterial color={INK} />
      </mesh>
      <group ref={hourHand} position={[0, 0, 0.02]}>
        <mesh position={[0, 0.09, 0]}>
          <boxGeometry args={[0.035, 0.18, 0.01]} />
          <meshBasicMaterial color={INK} />
        </mesh>
      </group>
      <group ref={minuteHand} position={[0, 0, 0.03]}>
        <mesh position={[0, 0.12, 0]}>
          <boxGeometry args={[0.025, 0.24, 0.01]} />
          <meshBasicMaterial color="#6d28d9" />
        </mesh>
      </group>
    </group>
  );
}

/* ---------------------------------- posters + rug + placard ---------------------------------- */

function WallDecor() {
  const posters = useMemo(() => [createPoster("play"), createPoster("hooks")], []);
  const rug = useMemo(() => createRug(), []);
  const placard = useMemo(() => createGaragePlacard(), []);
  return (
    <group>
      <mesh position={[-8.9, 3.9, 0.9]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[1.5, 2.0]} />
        <meshBasicMaterial map={posters[0]} toneMapped={false} />
      </mesh>
      <mesh position={[0.9, 3.75, -6.37]}>
        <planeGeometry args={[1.3, 1.7]} />
        <meshBasicMaterial map={posters[1]} toneMapped={false} />
      </mesh>
      {/* lounge rug */}
      <mesh position={[4.7, 0.02, 3.3]} rotation-x={-Math.PI / 2} renderOrder={1}>
        <circleGeometry args={[1.85, 40]} />
        <meshBasicMaterial map={rug} transparent opacity={0.95} depthWrite={false} />
      </mesh>
      {/* garage placard */}
      <mesh position={[-8.94, 2.55, 2.7]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[2.0, 0.56]} />
        <meshBasicMaterial map={placard} toneMapped={false} transparent />
      </mesh>
      {/* lamp shade (warm, unlit) */}
      <mesh position={[7.8, 2.32, 0.9]}>
        <cylinderGeometry args={[0.24, 0.38, 0.42, 14]} />
        <meshBasicMaterial color="#ffd9a4" />
      </mesh>
    </group>
  );
}

/* ---------------------------------- diecast garage (the old fleet as minis) ---------------------------------- */

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

function DiecastGarage() {
  const select = useHqStore((s) => s.select);
  const wheelRef = useRef<THREE.InstancedMesh>(null);
  const glassMat = useMemo(() => new THREE.MeshBasicMaterial({ color: GLASS }), []);
  const bodies = useMemo(
    () => VEHICLES.map((v) => ({ info: v, geo: vehicleBodyGeometry(v.kind) })),
    [],
  );
  const wheels = useMemo(() => {
    // one instanced mesh for every wheel of every vehicle
    const geo = wheelGeo();
    const mat = new THREE.MeshLambertMaterial({ color: "#20263f" });
    const mats: THREE.Matrix4[] = [];
    const dummy = new THREE.Object3D();
    const TOP_Y = 1.515;
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
        dummy.position.set(vx + o[0], TOP_Y + o[1], vz + o[2]);
        dummy.rotation.set(0, v.yaw, 0);
        dummy.updateMatrix();
        mats.push(dummy.matrix.clone());
      }
    }
    return { geo, mat, mats };
  }, []);

  const winGeos = useMemo(() => {
    const TOP_Y = 1.515;
    const list = VEHICLES.map((v) => {
      const g = vehicleWindows(v.kind);
      if (!g) return null;
      g.applyMatrix4(
        new THREE.Matrix4().compose(
          new THREE.Vector3(v.pos[0], TOP_Y, v.pos[1]),
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
        <group key={info.id} position={[info.pos[0], 1.515, info.pos[1]]} rotation-y={info.yaw}>
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
          {/* generous invisible tap target */}
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

/* ---------------------------------- world root ---------------------------------- */

export function World() {
  const { tray, walls, walls2, white } = useRoomGeometries();
  const furn = useFurnitureGeometries();
  const mats = useRoomMaterials();
  const floorTex = useMemo(() => createFloorGrid(), []);
  const blobTex = useMemo(() => createBlobShadow(), []);

  useLayoutEffect(() => {
    return () => {
      // dispose canvas textures on unmount
      [floorTex, blobTex].forEach((t) => t.dispose());
    };
  }, [floorTex, blobTex]);

  return (
    <group>
      {/* soft drop shadow under the diorama tray */}
      <mesh rotation-x={-Math.PI / 2} position={[0.6, -0.815, 0.6]} renderOrder={0}>
        <planeGeometry args={[FLOOR_W + 7.5, FLOOR_D + 7.5]} />
        <meshBasicMaterial map={blobTex} transparent opacity={0.65} depthWrite={false} />
      </mesh>

      {/* floor */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]}>
        <planeGeometry args={[FLOOR_W, FLOOR_D]} />
        <meshLambertMaterial map={floorTex} />
      </mesh>

      {/* shell */}
      <mesh geometry={tray} material={mats.tray} />
      <mesh geometry={walls} material={mats.wall} />
      <mesh geometry={walls2} material={mats.wallLeft} />
      <mesh geometry={white} material={mats.white} />
      <mesh geometry={furn.white} material={mats.white} />
      <mesh geometry={furn.navy} material={mats.navy} />
      <mesh geometry={furn.silver} material={mats.silver} />
      <mesh geometry={furn.wood} material={mats.wood} />
      <mesh geometry={furn.cardboard} material={mats.cardboard} />
      <mesh geometry={furn.cream} material={mats.cream} />
      <mesh geometry={furn.pots} material={mats.terra} />

      <BlobShadows tex={blobTex} />
      <Books />
      <Foliage />
      <Mugs />
      <DeskLabels />
      <LiveSurfaces />
      <WallClock />
      <WallDecor />
      <DiecastGarage />
    </group>
  );
}
