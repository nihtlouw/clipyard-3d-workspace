/**
 * Studio lighting + camera for the CLIPYARD isometric diorama.
 * The 9-to-5 sim clock now shows through the window light and lamp glow
 * instead of a full sky cycle — flat, bright, cheap.
 */
import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { AGENTS, VEHICLES } from "@/lib/hq-data";
import { dayFactors, isOnShift, useHqStore } from "@/lib/hq-store";

const WARM_DAY = new THREE.Color("#fff6e8");
const WARM_SET = new THREE.Color("#ffc490");
const COOL_NIGHT = new THREE.Color("#8fa2e8");

/**
 * Three lights total, no shadow maps (blob shadows carry contact).
 * Directional tint follows the clock: warm day → sunset → cool night.
 */
export function StudioLighting() {
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const lamp = useRef<THREE.PointLight>(null);

  useFrame(() => {
    const { hour } = useHqStore.getState();
    const { daylight, sunset } = dayFactors(hour);
    const night = 1 - daylight;

    if (sun.current) {
      const c = sun.current.color;
      c.copy(WARM_DAY);
      if (sunset > 0.02) c.lerp(WARM_SET, sunset * 0.85);
      if (night > 0.6) c.lerp(COOL_NIGHT, (night - 0.6) * 1.6);
      sun.current.intensity = 0.55 + daylight * 0.5;
    }
    if (hemi.current) {
      hemi.current.intensity = 0.72 + daylight * 0.42;
    }
    if (lamp.current) {
      // lounge floor lamp glows in the evening/night
      lamp.current.intensity = night > 0.35 ? 0.55 * (night - 0.35) * 2.2 : 0;
    }
  });

  return (
    <group>
      <ambientLight intensity={0.72} color="#f4f2fb" />
      <hemisphereLight ref={hemi} intensity={0.95} color="#eef0ff" groundColor="#e6e2f2" />
      <directionalLight ref={sun} position={[14, 18, 10]} intensity={1.0} />
      {/* window bounce */}
      <directionalLight position={[-6, 6, -12]} intensity={0.24} color="#dfe6ff" />
      <pointLight ref={lamp} position={[7.6, 3.4, 1.2]} intensity={0} color="#ffbe78" distance={9} decay={1.6} />
    </group>
  );
}

/* ---------------------------------- clock + camera ---------------------------------- */

/** Advances the sim clock each frame. */
export function ClockDriver() {
  useFrame((_, delta) => {
    useHqStore.getState().tick(Math.min(delta, 0.1));
  });
  return null;
}

const _target = new THREE.Vector3();
const _offset = new THREE.Vector3();

/** Smooth camera pans when the user selects an agent / diecast. */
export function CameraRig({ controls }: { controls: React.RefObject<any> }) {
  const focus = useRef({ token: -1, active: false });
  const cam = useThree((s) => s.camera);

  useFrame((_, delta) => {
    const c = controls.current;
    if (!c) return;
    const { selection, focusToken, autoOrbit } = useHqStore.getState();

    // gentle idle sway when auto-orbit is on (clamped by OrbitControls limits)
    if (autoOrbit && !focus.current.active && !selection && typeof c.setAzimuthalAngle === "function") {
      const t = performance.now() / 1000;
      c.setAzimuthalAngle(Math.PI / 4 + Math.sin(t * 0.22) * 0.3);
    }

    if (!selection) return;

    let tx = 0;
    let ty = 1.6;
    let tz = 0;
    if (selection.kind === "agent") {
      const a = AGENTS.find((x) => x.id === selection.id);
      if (!a) return;
      const on = isOnShift(useHqStore.getState().hour);
      tx = on ? a.desk[0] : a.lounge[0];
      ty = 1.7;
      tz = on ? a.desk[1] : a.lounge[1];
    } else {
      const v = VEHICLES.find((x) => x.id === selection.id);
      if (!v) return;
      tx = v.pos[0] + 0.4;
      ty = 1.7;
      tz = v.pos[1];
    }

    if (focus.current.token !== focusToken) {
      focus.current.token = focusToken;
      focus.current.active = true;
    }
    if (!focus.current.active) return;

    const d = Math.min(delta, 0.1);
    const k = 1 - Math.exp(-d * 3.2);
    _target.set(tx, ty, tz);
    // preserve the current view offset (orthographic: only the target matters)
    _offset.copy(cam.position).sub(c.target);
    c.target.lerp(_target, k);
    cam.position.copy(c.target).add(_offset);

    if (c.target.distanceTo(_target) < 0.04) focus.current.active = false;
  });
  return null;
}

const ISO_AZIMUTH = Math.PI / 4;

/** Orbit controls locked to pleasant isometric angles — composition always holds. */
export function CameraControls({ controls }: { controls: React.RefObject<any> }) {
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      enablePan={false}
      target={[0, 1.5, 0]}
      minZoom={20}
      maxZoom={64}
      minPolarAngle={0.92}
      maxPolarAngle={1.22}
      minAzimuthAngle={ISO_AZIMUTH - 0.42}
      maxAzimuthAngle={ISO_AZIMUTH + 0.42}
      autoRotate={false}
    />
  );
}

/** Keeps the whole diorama framed on any viewport (phones zoom out). */
export function ResponsiveZoom() {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const size = useThree((s) => s.size);
  const lastFit = useRef(0);

  const fit = Math.max(16, Math.min(36, (size.width / 19.5) * 1.15, (size.height / 17) * 1.05));

  useFrame(() => {
    // once the user zooms themselves, stop auto-refitting
    if (lastFit.current !== 0 && Math.abs(camera.zoom - lastFit.current) > 0.4) return;
    if (Math.abs(camera.zoom - fit) > 0.05) {
      camera.zoom = fit;
      camera.updateProjectionMatrix();
      lastFit.current = fit;
    }
  });
  return null;
}
