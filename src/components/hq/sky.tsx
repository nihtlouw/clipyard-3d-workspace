/**
 * Lighting + camera for the CLIPYARD glass diorama (redesign v3).
 *
 * Reference look: the diorama floats on a dark-navy void, lit warm from
 * inside at night (lamps in world.tsx) with a soft key casting real shadows.
 * By day the same key becomes window daylight. The camera is a locked-ish
 * isometric: generous zoom, pitch clamp, azimuth clamped to the open
 * south-east corner so the 2 solid walls never block the view (no fading
 * walls needed anymore).
 */
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { AGENTS, MANAGER, MEETING_SEATS, VEHICLES } from "@/lib/hq-data";
import { robotPoses } from "@/lib/hq-robots";
import { effectiveDayFactors, isMeeting, isOnShift, useHqStore } from "@/lib/hq-store";

const KEY_DAY = new THREE.Color("#fff1dc");
const KEY_SET = new THREE.Color("#ffb27a");
const KEY_NIGHT = new THREE.Color("#7e94d8");
const HEMI_DAY = new THREE.Color("#e6ecff");
const HEMI_NIGHT = new THREE.Color("#45538c");
const _c = new THREE.Color();

export function StudioLighting() {
  const key = useRef<THREE.DirectionalLight>(null);
  const rim = useRef<THREE.DirectionalLight>(null);
  const fill = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const amb = useRef<THREE.AmbientLight>(null);
  const gl = useThree((s) => s.gl);

  useFrame(() => {
    const st = useHqStore.getState();
    const { daylight, sunset, night } = effectiveDayFactors(st.hour, st.mode);

    if (key.current) {
      _c.copy(KEY_DAY).lerp(KEY_NIGHT, night);
      if (sunset > 0.05 && night < 0.7) _c.lerp(KEY_SET, sunset * 0.6);
      key.current.color.copy(_c);
      // strong window sun by day, faint blue moonlight at night (lamps do the rest)
      key.current.intensity = 0.35 + daylight * 2.4;
    }
    if (rim.current) rim.current.intensity = 0.12 + daylight * 0.35;
    // camera-side fill so the white robots read glossy-white like the reference render
    if (fill.current) fill.current.intensity = 0.22 + night * 0.38 + daylight * 0.15;
    if (hemi.current) {
      hemi.current.color.copy(_c.copy(HEMI_DAY).lerp(HEMI_NIGHT, night));
      hemi.current.intensity = 0.3 + daylight * 0.5;
    }
    if (amb.current) amb.current.intensity = 0.18 + daylight * 0.28;
    gl.toneMappingExposure = 1.0 + night * 0.05;
  });

  return (
    <group>
      <ambientLight ref={amb} intensity={0.3} color="#cfd8f5" />
      <hemisphereLight ref={hemi} intensity={0.5} color="#e6ecff" groundColor="#7a6a52" />
      {/* key: through the west windows, high south-west → long soft shadows */}
      <directionalLight
        ref={key}
        position={[-11, 15, 7]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={18}
        shadow-camera-bottom={-18}
        shadow-camera-near={2}
        shadow-camera-far={55}
        shadow-bias={-0.0003}
        shadow-normalBias={0.03}
      />
      {/* cool rim from the north-east so glass frames read against the dark */}
      <directionalLight ref={rim} position={[9, 8, -11]} intensity={0.3} color="#b9c8f5" />
      {/* warm fill from the camera corner (no shadows — just lifts the subjects) */}
      <directionalLight ref={fill} position={[13, 9, 13]} intensity={0.5} color="#ffe7c4" />
    </group>
  );
}

/* ---------------------------------- clock driver ---------------------------------- */

let lastShift: boolean | null = null;
let lastMeeting: boolean | null = null;

/**
 * Syncs the store clock to real local time once a second; logs shift/stand-up
 * boundaries into the feed (demo mode only — at real 09:00/13:00/17:00).
 */
export function ClockDriver() {
  useEffect(() => {
    const step = () => {
      const store = useHqStore.getState();
      store.syncClock();
      if (!store.demoShift) {
        // real work mode: no office-hours narration; reset so re-enabling
        // demo later doesn't fire a stale boundary event
        lastShift = null;
        lastMeeting = null;
        return;
      }
      const hour = useHqStore.getState().hour;
      const on = isOnShift(hour);
      if (lastShift === null) lastShift = on;
      else if (on !== lastShift) {
        lastShift = on;
        store.pushEvent(on ? "Shift dimulai — semua ke desk" : "Shift selesai — ke ruang rehat kaca", {
          color: on ? "#047857" : "#6d28d9",
          kind: "system",
        });
      }
      const mtg = isMeeting(hour);
      if (lastMeeting === null) lastMeeting = mtg;
      else if (mtg !== lastMeeting) {
        lastMeeting = mtg;
        store.pushEvent(mtg ? "Standup harian dimulai (meeting room kaca)" : "Standup selesai — kembali ke desk", {
          color: "#0ea5e9",
          kind: "system",
        });
      }
    };
    step();
    const id = window.setInterval(step, 1000);
    return () => window.clearInterval(id);
  }, []);
  return null;
}

/* ---------------------------------- camera ---------------------------------- */

export const START = {
  pos: [18.9, 14, 16.5] as [number, number, number],
  target: [2.4, 0.7, 0] as [number, number, number],
  zoom: 34,
};

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
      c.reset();
    }

    if (st.autoOrbit && !focus.current.active) {
      sway.current += delta * 0.12;
      const a = Math.PI / 4 + Math.sin(sway.current) * 0.16;
      const off = _offset.copy(cam.position).sub(c.target);
      const r = Math.hypot(off.x, off.z);
      cam.position.x = c.target.x + Math.sin(a) * r;
      cam.position.z = c.target.z + Math.cos(a) * r;
    }

    const sel = st.selection;
    if (!sel) return;
    let tx = 0, ty = 1.2, tz = 0;
    if (sel.kind === "agent") {
      const idx = AGENTS.findIndex((x) => x.id === sel.id);
      if (idx < 0) return;
      const a = AGENTS[idx];
      // Fase 8: focus the robot's actual live position when available
      const pose = robotPoses.get(a.id);
      if (pose) {
        tx = pose.x; tz = pose.z;
      } else if (isOnShift(st.hour) && isMeeting(st.hour)) {
        tx = MEETING_SEATS[idx].pos[0]; tz = MEETING_SEATS[idx].pos[1];
      } else if (isOnShift(st.hour)) {
        tx = a.desk[0]; tz = a.desk[1];
      } else {
        tx = a.lounge[0]; tz = a.lounge[1];
      }
      ty = 1.1;
    } else if (sel.kind === "manager") {
      tx = MANAGER.focus[0]; ty = 1.1; tz = MANAGER.focus[1];
    } else {
      const v = VEHICLES.find((x) => x.id === sel.id);
      if (!v) return;
      tx = v.pos[0]; ty = 0.8; tz = v.pos[1];
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

/** Orbit: azimuth locked to the open SE corner (±~38°), pitch + zoom clamped. */
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
      minZoom={11}
      maxZoom={90}
      minAzimuthAngle={0.12}
      maxAzimuthAngle={1.45}
      minPolarAngle={0.62}
      maxPolarAngle={1.18}
    />
  );
}

/** Keeps the whole diorama framed on any viewport (phones zoom out). */
export function ResponsiveZoom() {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const size = useThree((s) => s.size);
  const lastFit = useRef(0);
  const lastReset = useRef(-1);

  const fit = Math.max(12, Math.min(52, size.width / 33.5, size.height / 21.8));

  useFrame(() => {
    // "Sudut awal" restores the saved camera (mount-time zoom) via controls.reset();
    // re-apply the responsive fit zoom so reset == the intended starting framing.
    const resetToken = useHqStore.getState().resetViewToken;
    if (resetToken !== lastReset.current) {
      lastReset.current = resetToken;
      camera.zoom = fit;
      camera.updateProjectionMatrix();
      lastFit.current = fit;
      return;
    }
    if (lastFit.current !== 0 && Math.abs(camera.zoom - lastFit.current) > 0.5) return;
    if (Math.abs(camera.zoom - fit) > 0.05) {
      camera.zoom = fit;
      camera.updateProjectionMatrix();
      lastFit.current = fit;
    }
  });
  return null;
}

/* ---------------------------------- robot POV (Fase 8) ---------------------------------- */

const _povPos = new THREE.Vector3();
const _povLook = new THREE.Vector3();

/**
 * First-person camera riding the selected robot's head. The perspective
 * camera (mounted by experience.tsx while povAgent is set) tracks the
 * robot's live pose — walking bob included — and a pointer drag adds a
 * neck-limited look-around offset on top of the robot's own facing.
 */
export function PovRig() {
  const povAgent = useHqStore((s) => s.povAgent);
  const gl = useThree((s) => s.gl);
  const look = useRef({ yaw: 0, pitch: 0, dragging: false, lx: 0, ly: 0 });
  const smooth = useRef<{ pos: THREE.Vector3 | null; yaw: number }>({ pos: null, yaw: 0 });
  const visor = useRef<THREE.PointLight>(null);

  // fresh eyes on every robot switch
  useEffect(() => {
    look.current.yaw = 0;
    look.current.pitch = 0;
    smooth.current.pos = null;
  }, [povAgent]);

  useEffect(() => {
    const el = gl.domElement;
    const L = look.current;
    const down = (e: PointerEvent) => {
      L.dragging = true;
      L.lx = e.clientX;
      L.ly = e.clientY;
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!L.dragging) return;
      const dx = e.clientX - L.lx;
      const dy = e.clientY - L.ly;
      L.lx = e.clientX;
      L.ly = e.clientY;
      // +yaw turns left in this scene's convention, so dragging right subtracts
      L.yaw = THREE.MathUtils.clamp(L.yaw - dx * 0.0045, -2.4, 2.4);
      L.pitch = THREE.MathUtils.clamp(L.pitch - dy * 0.0045, -0.95, 0.95);
    };
    const up = () => {
      L.dragging = false;
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, [gl]);

  useFrame((state, delta) => {
    if (!povAgent) return;
    const pose = robotPoses.get(povAgent);
    if (!pose) return;
    const cam = state.camera;
    const d = Math.min(delta, 0.1);
    const S = smooth.current;

    // eye point: head center pushed just in front of the visor
    const fx = Math.sin(pose.yaw);
    const fz = Math.cos(pose.yaw);
    _povPos.set(pose.x + fx * 0.3, pose.y + 1.02, pose.z + fz * 0.3);
    if (!S.pos) {
      S.pos = _povPos.clone();
      S.yaw = pose.yaw;
    } else {
      S.pos.lerp(_povPos, 1 - Math.exp(-d * 11));
      const dyaw = ((pose.yaw - S.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      S.yaw += dyaw * (1 - Math.exp(-d * 9));
    }
    cam.position.copy(S.pos);

    const yaw = S.yaw + look.current.yaw;
    const pitch = look.current.pitch;
    const cp = Math.cos(pitch);
    _povLook.set(
      S.pos.x + Math.sin(yaw) * cp,
      S.pos.y + Math.sin(pitch),
      S.pos.z + Math.cos(yaw) * cp,
    );
    cam.lookAt(_povLook);
    // soft "visor light" so the robot's desk/screen stay readable at dusk
    if (visor.current) visor.current.position.set(S.pos.x, S.pos.y + 0.15, S.pos.z);
  });
  return <pointLight ref={visor} intensity={1.5} distance={5.5} decay={1.8} color="#dfe8ff" />;
}
