/**
 * Studio lighting + camera for the CLIPYARD open-plan office diorama.
 * Lighting follows the sim clock (with Otomatis/Terang/Gelap override);
 * the camera orbits a full 360° — the room's walls fade themselves out of
 * the way (see world.tsx FadingWall).
 */
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { AGENTS, VEHICLES } from "@/lib/hq-data";
import {
  effectiveDayFactors,
  isMeeting,
  isOnShift,
  useHqStore,
} from "@/lib/hq-store";

const WARM_DAY = new THREE.Color("#fff6e8");
const WARM_SET = new THREE.Color("#ffc490");
const COOL_NIGHT = new THREE.Color("#8fa2e8");

export function StudioLighting() {
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const lamp = useRef<THREE.PointLight>(null);
  const lamp2 = useRef<THREE.PointLight>(null);

  useFrame(() => {
    const st = useHqStore.getState();
    const { daylight, night } = effectiveDayFactors(st.hour, st.mode);

    if (sun.current) {
      const c = sun.current.color;
      c.copy(WARM_DAY);
      if (night > 0.6) c.lerp(COOL_NIGHT, (night - 0.6) * 1.6);
      sun.current.intensity = 0.5 + daylight * 0.5;
    }
    if (hemi.current) {
      hemi.current.intensity = 0.74 + daylight * 0.4;
    }
    const lampGlow = night > 0.35 ? (night - 0.35) * 1.4 : 0;
    if (lamp.current) lamp.current.intensity = 0.5 * lampGlow;
    if (lamp2.current) lamp2.current.intensity = 0.35 * lampGlow;
  });

  return (
    <group>
      <ambientLight intensity={0.72} color="#f4f2fb" />
      <hemisphereLight ref={hemi} intensity={0.95} color="#eef0ff" groundColor="#e6e2f2" />
      <directionalLight ref={sun} position={[16, 20, 12]} intensity={1.0} />
      <directionalLight position={[-8, 7, -14]} intensity={0.22} color="#dfe6ff" />
      {/* lounge lamp + rest-room corner lamp (glow at night) */}
      <pointLight ref={lamp} position={[3.5, 3.2, 7.7]} intensity={0} color="#ffbe78" distance={10} decay={1.6} />
      <pointLight ref={lamp2} position={[-9.5, 3.2, 8.2]} intensity={0} color="#ffc890" distance={9} decay={1.7} />
    </group>
  );
}

/* ---------------------------------- clock + camera ---------------------------------- */

let lastShift: boolean | null = null;
let lastMeeting: boolean | null = null;

/** Advances the sim clock; logs shift/stand-up boundaries into the feed. */
export function ClockDriver() {
  useFrame((_state, delta) => {
    const store = useHqStore.getState();
    const prevHour = store.hour;
    store.tick(Math.min(delta, 0.1));
    const hour = useHqStore.getState().hour;
    // crossed into a new sim hour boundary checks (handles scrubbing too)
    const on = isOnShift(hour);
    if (lastShift === null) lastShift = on;
    else if (on !== lastShift) {
      lastShift = on;
      store.pushEvent(
        on ? "Shift dimulai — semua ke desk" : "Shift selesai — ruang rehat",
        { color: on ? "#047857" : "#6d28d9", kind: "system" },
      );
    }
    const mtg = isMeeting(hour);
    if (lastMeeting === null) lastMeeting = mtg;
    else if (mtg !== lastMeeting) {
      lastMeeting = mtg;
      store.pushEvent(mtg ? "Standup harian dimulai (meeting room)" : "Standup selesai — kembali ke desk", {
        color: "#0ea5e9",
        kind: "system",
      });
    }
    void prevHour;
  });
  return null;
}

const _target = new THREE.Vector3();
const _offset = new THREE.Vector3();

/** Camera focus on selection + view-reset requests + gentle auto-sway. */
export function CameraRig({ controls }: { controls: React.RefObject<any> }) {
  const focus = useRef({ token: -1, active: false });
  const reset = useRef(-1);
  const sway = useRef(0);
  const cam = useThree((s) => s.camera);

  useFrame((_, delta) => {
    const c = controls.current;
    if (!c) return;
    const st = useHqStore.getState();

    if (st.resetViewToken !== reset.current) {
      reset.current = st.resetViewToken;
      focus.current.active = false;
      c.reset(); // restores the state saved on mount
    }

    // gentle auto-sway (Otomatis toggle) — subtle azimuth drift
    if (st.autoOrbit && !focus.current.active) {
      sway.current += delta * 0.12;
      const a = Math.PI / 4 + Math.sin(sway.current) * 0.28;
      const off = _offset.copy(cam.position).sub(c.target);
      const r = Math.hypot(off.x, off.z);
      cam.position.x = c.target.x + Math.sin(a) * r;
      cam.position.z = c.target.z + Math.cos(a) * r;
    }

    const sel = st.selection;
    if (!sel) return;
    let tx = 0;
    let ty = 1.6;
    let tz = 0;
    if (sel.kind === "agent") {
      const a = AGENTS.find((x) => x.id === sel.id);
      if (!a) return;
      const on = isOnShift(st.hour);
      tx = on ? a.desk[0] : a.lounge[0];
      ty = 1.7;
      tz = on ? a.desk[1] : a.lounge[1];
    } else {
      const v = VEHICLES.find((x) => x.id === sel.id);
      if (!v) return;
      tx = v.pos[0];
      ty = 1.7;
      tz = v.pos[1];
    }

    if (focus.current.token !== st.focusToken) {
      focus.current.token = st.focusToken;
      focus.current.active = true;
    }
    if (!focus.current.active) return;

    const d = Math.min(delta, 0.1);
    const k = 1 - Math.exp(-d * 3.2);
    _target.set(tx, ty, tz);
    _offset.copy(cam.position).sub(c.target);
    c.target.lerp(_target, k);
    cam.position.copy(c.target).add(_offset);
    if (c.target.distanceTo(_target) < 0.05) focus.current.active = false;
  });
  return null;
}

const START = { pos: [21, 18, 21] as [number, number, number], target: [0, 1.1, 0.4] as [number, number, number], zoom: 30 };

/** Orbit controls: full 360° azimuth, clamped pitch/zoom. */
export function CameraControls({ controls }: { controls: React.RefObject<any> }) {
  const ref = useRef<any>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.saveState();
    controls.current = c;
  }, [controls]);
  return (
    <OrbitControls
      ref={ref}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      enablePan={false}
      target={START.target}
      minZoom={14}
      maxZoom={72}
      minPolarAngle={0.3}
      maxPolarAngle={1.24}
    />
  );
}

/** Keeps the whole office framed on any viewport (phones zoom out). */
export function ResponsiveZoom() {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const size = useThree((s) => s.size);
  const lastFit = useRef(0);

  const fit = Math.max(15, Math.min(40, (size.width / 27) * 1.2, (size.height / 20.5) * 1.1));

  useFrame(() => {
    if (lastFit.current !== 0 && Math.abs(camera.zoom - lastFit.current) > 0.5) return;
    if (Math.abs(camera.zoom - fit) > 0.05) {
      camera.zoom = fit;
      camera.updateProjectionMatrix();
      lastFit.current = fit;
    }
  });
  return null;
}

export { START };
