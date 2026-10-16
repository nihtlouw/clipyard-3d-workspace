import { useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import { AGENTS, VEHICLES } from "@/lib/hq-data";
import { dayFactors, useHqStore } from "@/lib/hq-store";

const C_DAY_TOP = new THREE.Color("#2b62d8");
const C_DAY_HORIZON = new THREE.Color("#bfe0ff");
const C_DAY_BOTTOM = new THREE.Color("#17233c");
const C_SET_TOP = new THREE.Color("#35418f");
const C_SET_HORIZON = new THREE.Color("#ff9a56");
const C_SET_BOTTOM = new THREE.Color("#2b1a2e");
const C_NIGHT_TOP = new THREE.Color("#04070f");
const C_NIGHT_HORIZON = new THREE.Color("#101c3a");
const C_NIGHT_BOTTOM = new THREE.Color("#060a14");

const SUN_DAY = new THREE.Color("#fff4e0");
const SUN_SET = new THREE.Color("#ff8a4c");
const SUN_MOON = new THREE.Color("#7f9fff");

/** Gradient sky dome + sun/moon + ambient lighting, driven by the sim clock. */
export function Sky() {
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const ambient = useRef<THREE.AmbientLight>(null);
  const [showStars, setShowStars] = useState(false);

  const skyMat = useMemo(() => {
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color() },
        horizonColor: { value: new THREE.Color() },
        bottomColor: { value: new THREE.Color() },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vDir;
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform vec3 bottomColor;
        void main() {
          float h = vDir.y;
          vec3 col = h > 0.0
            ? mix(horizonColor, topColor, pow(min(h * 1.35, 1.0), 0.72))
            : mix(horizonColor, bottomColor, pow(min(-h * 1.8, 1.0), 0.9));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
  }, []);

  useFrame(() => {
    const { hour } = useHqStore.getState();
    const { theta, sunY, daylight, night, sunset } = dayFactors(hour);

    // palette blend
    const top = skyMat.uniforms.topColor.value as THREE.Color;
    const hor = skyMat.uniforms.horizonColor.value as THREE.Color;
    const bot = skyMat.uniforms.bottomColor.value as THREE.Color;
    top.copy(C_NIGHT_TOP).lerp(C_DAY_TOP, daylight);
    hor.copy(C_NIGHT_HORIZON).lerp(C_DAY_HORIZON, daylight);
    bot.copy(C_NIGHT_BOTTOM).lerp(C_DAY_BOTTOM, daylight);
    top.lerp(C_SET_TOP, sunset * 0.55);
    hor.lerp(C_SET_HORIZON, sunset * 0.85);
    bot.lerp(C_SET_BOTTOM, sunset * 0.6);

    if (sun.current) {
      sun.current.position.set(Math.cos(theta) * 38, Math.max(sunY, -0.18) * 46, 16);
      const c = sun.current.color;
      c.copy(SUN_DAY);
      if (sunset > 0.02) c.lerp(SUN_SET, sunset * 0.9);
      if (sunY < 0) c.copy(SUN_MOON);
      sun.current.intensity = sunY > 0 ? 0.12 + daylight * 2.1 : 0.22;
    }
    if (hemi.current) {
      hemi.current.intensity = 0.35 + daylight * 1.0;
      (hemi.current.color as THREE.Color).copy(hor);
    }
    if (ambient.current) {
      ambient.current.intensity = 0.16 + daylight * 0.3;
      (ambient.current.color as THREE.Color).copy(bot).lerp(hor, 0.5);
    }

    const starsOn = night > 0.55;
    if (showStars !== starsOn) setShowStars(starsOn);
  });

  return (
    <group>
      <mesh material={skyMat} scale={120} frustumCulled={false}>
        <sphereGeometry args={[1, 32, 20]} />
      </mesh>
      {showStars && (
        <Stars radius={100} depth={30} count={1400} factor={3.2} saturation={0} fade speed={0.5} />
      )}
      <ambientLight ref={ambient} intensity={0.3} />
      <hemisphereLight ref={hemi} intensity={0.8} color="#cfe6ff" groundColor="#2a2e38" />
      <directionalLight
        ref={sun}
        castShadow
        intensity={1.6}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.00035}
        shadow-camera-left={-28}
        shadow-camera-right={28}
        shadow-camera-top={26}
        shadow-camera-bottom={-18}
        shadow-camera-near={2}
        shadow-camera-far={130}
      />
    </group>
  );
}

// (end of sky module)

/* ---------------------------------- clock + camera ---------------------------------- */

/** Advances the sim clock each frame. */
export function ClockDriver() {
  useFrame((_, delta) => {
    useHqStore.getState().tick(Math.min(delta, 0.1));
  });
  return null;
}

const _target = new THREE.Vector3();
const _desired = new THREE.Vector3();

/** Smooth camera flights when the user selects an agent / vehicle. */
export function CameraRig({ controls }: { controls: React.RefObject<any> }) {
  const focus = useRef({ active: false, t: 0 });
  const cam = useThree((s) => s.camera);

  useFrame((_, delta) => {
    const c = controls.current;
    if (!c) return;
    const { selection, focusToken } = useHqStore.getState();
    if (!selection) return;

    // pick target from data
    let tx = 0;
    let ty = 2;
    let tz = 0;
    if (selection.kind === "agent") {
      const a = AGENTS.find((x) => x.id === selection.id);
      if (!a) return;
      const on = useHqStore.getState().hour >= 9 && useHqStore.getState().hour < 17;
      tx = on ? a.desk[0] : a.lounge[0];
      ty = 1.6;
      tz = on ? a.desk[1] : a.lounge[1];
    } else {
      const v = VEHICLES.find((x) => x.id === selection.id);
      if (!v) return;
      tx = v.pos[0];
      ty = 1.2;
      tz = v.pos[1];
    }

    if (focus.current.t !== focusToken) {
      focus.current.t = focusToken;
      focus.current.active = true;
    }
    if (!focus.current.active) return;

    const d = Math.min(delta, 0.1);
    const k = 1 - Math.exp(-d * 2.6);
    _target.set(tx, ty, tz);
    c.target.lerp(_target, k);

    // keep the camera's current viewing direction, settle at a nice distance
    const dir = _desired.copy(cam.position).sub(_target).normalize();
    if (dir.lengthSq() < 0.001) dir.set(0.6, 0.42, 0.7).normalize();
    const dist = selection.kind === "agent" ? 7.5 : 9.5;
    _desired.copy(_target).addScaledVector(dir.setY(Math.max(dir.y, 0.28)).normalize(), dist);
    cam.position.lerp(_desired, k * 0.9);

    if (c.target.distanceTo(_target) < 0.05) focus.current.active = false;
  });
  return null;
}

/** Orbit controls with damping, auto-rotate + reset focus target. */
export function CameraControls({ controls }: { controls: React.RefObject<any> }) {
  const autoOrbit = useHqStore((s) => s.autoOrbit);
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.06}
      target={[0, 2.8, 3.5]}
      minDistance={6}
      maxDistance={58}
      maxPolarAngle={Math.PI * 0.49}
      autoRotate={autoOrbit}
      autoRotateSpeed={0.35}
    />
  );
}
