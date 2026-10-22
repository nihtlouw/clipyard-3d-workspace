/**
 * The Boss (Fase 9) — the user's own avatar in the Ruang Manajer: a
 * gold-trimmed robot with a tiny crown and a red tie, seated in the
 * executive chair. He lives a small loop (typing → coffee sip → leaning
 * back to supervise), looks up toward the meeting-room door whenever an
 * agent waits for an OK, publishes his pose like the crew robots so the
 * POV camera can ride the throne, and opens the Manager Panel on click.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { MANAGER, ROOM } from "@/lib/hq-data";
import { robotPoses, type RobotPose } from "@/lib/hq-robots";
import { useHqStore } from "@/lib/hq-store";
import { createNameplate } from "@/lib/hq-textures";

const GOLD = "#d9a521";

type Phase = "kerja" | "ngopi" | "mengawasi";

function hoverCursor(e: ThreeEvent<PointerEvent>, on: boolean) {
  e.stopPropagation();
  document.body.style.cursor = on ? "pointer" : "auto";
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** mug parking spot on the desk vs. at the visor (root-group local space) */
const MUG_DESK = new THREE.Vector3(-0.4, 0.38, 0.41);
const MUG_MOUTH = new THREE.Vector3(-0.05, 0.92, 0.36);
const _mugPos = new THREE.Vector3();

export function BossAvatar() {
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null); // local -x: north side, holds the mug
  const rightArm = useRef<THREE.Group>(null);
  const mug = useRef<THREE.Group>(null);
  const gem = useRef<THREE.Mesh>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);
  const plateMat = useRef<THREE.SpriteMaterial>(null);
  const plateSprite = useRef<THREE.Sprite>(null);
  const [hover, setHover] = useState(false);

  const select = useHqStore((s) => s.select);
  const labels = useHqStore((s) => s.labels);
  const selected = useHqStore((s) => s.selection?.kind === "manager");

  const nameplate = useMemo(() => createNameplate("BOS", MANAGER.accent), []);
  const plateText = useRef("");

  const anim = useRef({
    phase: "kerja" as Phase,
    t: 0,
    dur: 7,
    nextIsCoffee: true,
    headYaw: 0,
    headPitch: 0.16,
    lean: 0,
    mugT: 0,
    armBase: -0.7,
  });

  // publish the throne's pose for the POV rig, same as the crew robots
  const pose = useMemo<RobotPose>(
    () => ({
      x: MANAGER.chair[0],
      y: ROOM.SEAT_Y,
      z: MANAGER.chair[1],
      yaw: MANAGER.chairYaw,
      pitch: 0,
      walking: false,
    }),
    [],
  );
  useEffect(() => {
    robotPoses.set("manager", pose);
    return () => {
      robotPoses.delete("manager");
    };
  }, [pose]);

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const d = Math.min(delta, 0.1);
    const t = state.clock.elapsedTime;
    const st = useHqStore.getState();
    const alert = st.approvals.length > 0;
    const hosted = st.povTarget === "manager";
    const A = anim.current;

    // ---- little life loop (frozen while the user rides the throne) ----
    if (!hosted && !alert) {
      A.t += d;
      if (A.t >= A.dur) {
        A.t = 0;
        if (A.phase === "kerja") {
          A.phase = A.nextIsCoffee ? "ngopi" : "mengawasi";
          A.nextIsCoffee = !A.nextIsCoffee;
          A.dur = A.phase === "ngopi" ? 4.2 : 6.5;
        } else {
          A.phase = "kerja";
          A.dur = 6 + Math.random() * 4;
        }
      }
    }

    // ---- targets per state ----
    let headYawT = 0;
    let headPitchT = 0.16;
    let mugTarget = 0;
    let typing = 1;
    let leanT = 0;
    let statusText = "mengawasi lantai";
    if (alert) {
      headYawT = 0.35; // toward the meeting-room door
      headPitchT = 0.0;
      typing = 0;
      statusText = "ada yang minta OK!";
    } else if (hosted) {
      headPitchT = 0.13; // steady gaze at the monitors: a stable throne view
      statusText = "mengawasi lantai";
    } else if (A.phase === "ngopi") {
      const p = A.t / A.dur;
      mugTarget = smoothstep(0, 0.28, p) * (1 - smoothstep(0.72, 1, p));
      headPitchT = -0.05;
      headYawT = 0.08;
      typing = 0;
      statusText = "ngopi dulu";
    } else if (A.phase === "mengawasi") {
      headYawT = Math.sin(t * 0.4) * 0.55;
      headPitchT = 0.02;
      leanT = -0.07;
      typing = 0;
      statusText = "santai mengawasi";
    } else {
      headYawT = Math.sin(t * 0.5) * 0.06;
    }

    // ---- damped actuals ----
    const k = 1 - Math.exp(-d * 5);
    A.headYaw += (headYawT - A.headYaw) * k;
    A.headPitch += (headPitchT - A.headPitch) * k;
    A.lean += (leanT - A.lean) * k;
    A.mugT += (mugTarget - A.mugT) * (1 - Math.exp(-d * 4));
    A.armBase += ((typing ? -0.7 : -0.38) - A.armBase) * k;

    if (body.current) {
      const s = 1 + Math.sin(t * 2.1) * 0.01;
      body.current.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));
      body.current.rotation.x = A.lean;
    }
    if (head.current) {
      head.current.rotation.y = A.headYaw;
      head.current.rotation.x =
        A.headPitch + (typing && !alert ? Math.sin(t * 4.2) * 0.02 : 0);
      head.current.rotation.z = Math.sin(t * 0.8) * 0.03;
    }
    if (eyes.current) {
      const blink = Math.sin(t * 0.9 + 2.3) > 0.985 ? 0.12 : 1;
      eyes.current.scale.y += (blink - eyes.current.scale.y) * 0.5;
    }
    const osc = typing ? Math.sin(t * 9) * 0.2 : Math.sin(t * 1.2) * 0.04;
    if (leftArm.current) leftArm.current.rotation.x = A.armBase + osc - A.mugT * 1.25;
    if (rightArm.current) rightArm.current.rotation.x = A.armBase - osc;

    // mug: desk ↔ visor with a little arc + sip tilt
    if (mug.current) {
      _mugPos.lerpVectors(MUG_DESK, MUG_MOUTH, A.mugT);
      _mugPos.y += Math.sin(A.mugT * Math.PI) * 0.06;
      mug.current.position.copy(_mugPos);
      mug.current.rotation.x = -0.45 * A.mugT;
    }

    // crown gem throbs while someone waits for the boss
    if (gem.current) {
      gem.current.scale.setScalar(alert ? 1 + (Math.sin(t * 6) * 0.5 + 0.5) * 0.55 : 1);
    }

    if (ringMat.current) {
      ringMat.current.opacity = selected ? 0.95 : hover ? 0.55 : 0.25;
      const c = alert ? "#f59e0b" : MANAGER.accent;
      if (ringMat.current.color.getHexString() !== c.slice(1)) ringMat.current.color.set(c);
    }

    // throne pose for the POV rig: effective look yaw/pitch from the head
    pose.yaw = MANAGER.chairYaw + A.headYaw;
    pose.pitch = -A.headPitch;

    if (plateMat.current && plateSprite.current) {
      plateSprite.current.visible = (labels || selected || hover) && !hosted;
      if (plateText.current !== statusText) {
        plateText.current = statusText;
        nameplate.redraw(statusText);
      }
      const cam = state.camera as THREE.OrthographicCamera;
      const w = st.povTarget ? 0.95 : Math.min(2.7, (2.5 * 36) / (cam.zoom || 36));
      plateSprite.current.scale.set(w, w * 0.233, 1);
    }
  });

  const accent = MANAGER.accent;

  return (
    <group
      ref={group}
      position={[MANAGER.chair[0], ROOM.SEAT_Y, MANAGER.chair[1]]}
      rotation-y={MANAGER.chairYaw}
      scale={1.05}
      onClick={(e) => {
        e.stopPropagation();
        select({ kind: "manager", id: "manager" });
      }}
      onPointerOver={(e) => {
        hoverCursor(e, true);
        setHover(true);
      }}
      onPointerOut={(e) => {
        hoverCursor(e, false);
        setHover(false);
      }}
    >
      {/* amber presence ring on the rug (root scale 1.05 → local y lands at 0.02) */}
      <mesh position={[0, -0.4, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.52, 0.62, 36]} />
        <meshBasicMaterial ref={ringMat} color={accent} transparent opacity={0.25} depthWrite={false} toneMapped={false} />
      </mesh>

      <group ref={body}>
        {/* feet + stubby legs */}
        {[-0.09, 0.09].map((x) => (
          <group key={x}>
            <mesh position={[x, 0.16, 0]}>
              <cylinderGeometry args={[0.055, 0.065, 0.22, 10]} />
              <meshStandardMaterial color="#c9ccd6" roughness={0.6} />
            </mesh>
            <mesh position={[x, 0.045, 0.04]} castShadow>
              <sphereGeometry args={[0.085, 10, 8]} />
              <meshStandardMaterial color="#2b2f3d" roughness={0.7} />
            </mesh>
          </group>
        ))}

        {/* glossy white body (same shell as the crew, gold trim) */}
        <mesh position={[0, 0.52, 0]} scale={[1, 1.02, 0.88]} castShadow>
          <capsuleGeometry args={[0.26, 0.22, 8, 18]} />
          <meshStandardMaterial color="#ffffff" roughness={0.38} />
        </mesh>
        <mesh position={[0, 0.52, 0.215]} rotation-x={0.12}>
          <boxGeometry args={[0.2, 0.24, 0.05]} />
          <meshStandardMaterial color="#232838" roughness={0.45} />
        </mesh>
        {/* the boss tie */}
        <mesh position={[0, 0.705, 0.24]} rotation-x={0.12}>
          <boxGeometry args={[0.06, 0.055, 0.03]} />
          <meshStandardMaterial color="#c23b2e" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.565, 0.25]} rotation-x={0.12}>
          <boxGeometry args={[0.075, 0.2, 0.02]} />
          <meshStandardMaterial color="#c23b2e" roughness={0.6} />
        </mesh>
        {/* gold neck ring */}
        <mesh position={[0, 0.79, 0]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.15, 0.042, 10, 22]} />
          <meshStandardMaterial color={GOLD} roughness={0.35} metalness={0.6} />
        </mesh>

        {/* head: white helmet + dark visor + glowing gold eyes + crown */}
        <group ref={head} position={[0, 1.0, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.27, 22, 18]} />
            <meshStandardMaterial color="#ffffff" roughness={0.3} />
          </mesh>
          <mesh position={[0, -0.01, 0.13]} scale={[0.95, 0.78, 0.62]}>
            <sphereGeometry args={[0.24, 20, 16]} />
            <meshStandardMaterial color="#141926" roughness={0.22} metalness={0.25} />
          </mesh>
          <group ref={eyes} position={[0, 0.03, 0.272]}>
            {[-0.075, 0.075].map((x) => (
              <mesh key={x} position={[x, 0, 0]}>
                <capsuleGeometry args={[0.021, 0.045, 4, 8]} />
                <meshBasicMaterial color={accent} toneMapped={false} />
              </mesh>
            ))}
          </group>
          <mesh position={[0, -0.085, 0.266]}>
            <boxGeometry args={[0.07, 0.016, 0.01]} />
            <meshBasicMaterial color={accent} toneMapped={false} transparent opacity={0.75} />
          </mesh>
          {/* gold ear caps */}
          {[-0.265, 0.265].map((x) => (
            <mesh key={x} position={[x, 0, 0]} rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[0.07, 0.07, 0.055, 12]} />
              <meshStandardMaterial color={GOLD} roughness={0.35} metalness={0.6} />
            </mesh>
          ))}
          {/* the crown, worn at a slight angle */}
          <group position={[0, 0.25, 0]} rotation-z={0.1} rotation-x={-0.06}>
            <mesh castShadow>
              <cylinderGeometry args={[0.155, 0.17, 0.09, 16]} />
              <meshStandardMaterial color={GOLD} roughness={0.3} metalness={0.65} />
            </mesh>
            {[0.785, 2.356, 3.927, 5.498].map((a) => (
              <mesh key={a} position={[Math.cos(a) * 0.135, 0.085, Math.sin(a) * 0.135]}>
                <coneGeometry args={[0.035, 0.09, 6]} />
                <meshStandardMaterial color={GOLD} roughness={0.3} metalness={0.65} />
              </mesh>
            ))}
            <mesh ref={gem} position={[0, 0.005, 0.162]}>
              <sphereGeometry args={[0.032, 10, 8]} />
              <meshBasicMaterial color="#ffd9a0" toneMapped={false} />
            </mesh>
          </group>
        </group>

        {/* arms */}
        <group ref={leftArm} position={[-0.28, 0.66, 0.02]}>
          <mesh position={[0, -0.11, 0.03]} rotation-x={-0.35} castShadow>
            <capsuleGeometry args={[0.065, 0.16, 5, 10]} />
            <meshStandardMaterial color="#ffffff" roughness={0.4} />
          </mesh>
          <mesh position={[0, -0.22, 0.09]}>
            <sphereGeometry args={[0.06, 10, 8]} />
            <meshStandardMaterial color="#2b2f3d" roughness={0.6} />
          </mesh>
        </group>
        <group ref={rightArm} position={[0.28, 0.66, 0.02]}>
          <mesh position={[0, -0.11, 0.03]} rotation-x={-0.35} castShadow>
            <capsuleGeometry args={[0.065, 0.16, 5, 10]} />
            <meshStandardMaterial color="#ffffff" roughness={0.4} />
          </mesh>
          <mesh position={[0, -0.22, 0.09]}>
            <sphereGeometry args={[0.06, 10, 8]} />
            <meshStandardMaterial color="#2b2f3d" roughness={0.6} />
          </mesh>
        </group>
      </group>

      {/* coffee mug: parked on the desk, lifted to the visor during "ngopi" */}
      <group ref={mug} position={MUG_DESK}>
        <mesh castShadow>
          <cylinderGeometry args={[0.05, 0.045, 0.1, 12]} />
          <meshStandardMaterial color="#e8dcc4" roughness={0.55} />
        </mesh>
        <mesh position={[0, 0.049, 0]} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[0.04, 12]} />
          <meshStandardMaterial color="#2e1a0f" roughness={0.35} />
        </mesh>
        <mesh position={[-0.058, 0, 0]}>
          <torusGeometry args={[0.03, 0.009, 6, 14]} />
          <meshStandardMaterial color="#e8dcc4" roughness={0.55} />
        </mesh>
      </group>

      <sprite ref={plateSprite} position={[0, 1.62, 0]} scale={[2.5, 0.58, 1]}>
        <spriteMaterial ref={plateMat} map={nameplate.tex} transparent depthWrite={false} />
      </sprite>

      {/* generous invisible hit area */}
      <mesh position={[0, 0.8, 0]} visible={false}>
        <cylinderGeometry args={[0.5, 0.5, 1.7, 10]} />
      </mesh>
    </group>
  );
}
