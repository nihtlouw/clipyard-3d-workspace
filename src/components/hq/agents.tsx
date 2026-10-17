/**
 * CLIPYARD crew — round hoodie mascots with live status nameplates.
 * Movement states: desk (on shift) → meeting room (daily 13:00 standup) →
 * rest room / lounge (off shift, or "recharging" after a failed job).
 */
import { useMemo, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { AGENTS, type AgentInfo } from "@/lib/hq-data";
import { createNameplate } from "@/lib/hq-textures";
import { currentJobFor } from "@/lib/hq-jobs";
import { isMeeting, isOnShift, useHqStore } from "@/lib/hq-store";

function hoverCursor(e: ThreeEvent<PointerEvent>, on: boolean) {
  e.stopPropagation();
  document.body.style.cursor = on ? "pointer" : "auto";
}

/** Standup seats around the meeting table (index → seat). */
const MEETING_SEATS: Array<{ pos: [number, number]; yaw: number }> = [
  { pos: [8.0, 4.72], yaw: 0 },
  { pos: [9.35, 4.72], yaw: 0 },
  { pos: [10.7, 4.72], yaw: 0 },
  { pos: [8.0, 6.48], yaw: Math.PI },
  { pos: [9.35, 6.48], yaw: Math.PI },
  { pos: [10.7, 6.48], yaw: Math.PI },
];

function Hoodie({ info, index }: { info: AgentInfo; index: number }) {
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const face = useRef<THREE.Mesh>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const ring = useRef<THREE.MeshBasicMaterial>(null);
  const plateMat = useRef<THREE.SpriteMaterial>(null);
  const plateSprite = useRef<THREE.Sprite>(null);
  const [hover, setHover] = useState(false);

  const select = useHqStore((s) => s.select);
  const labels = useHqStore((s) => s.labels);
  const selected = useHqStore((s) => s.selection?.kind === "agent" && s.selection.id === info.id);

  const faceTex = useMemo(() => getFaceTexture(), []);
  const nameplate = useMemo(() => createNameplate(info.name, info.color), [info]);
  const phase = useMemo(() => index * 1.73, [index]);
  const target = useRef(new THREE.Vector3(info.desk[0], 0, info.desk[1]));
  const targetYaw = useRef(info.deskYaw);
  const walking = useRef(false);
  const plateText = useRef("");
  const prevState = useRef("");

  // seat height in the meeting room (chairs) vs floor cushions vs sofa
  const loungeY = index >= 4 ? 0.42 : 0;
  const seatPos = MEETING_SEATS[index];

  useFrame((state, delta) => {
    const d = Math.min(delta, 0.1);
    const st = useHqStore.getState();
    const hour = st.hour;
    const on = isOnShift(hour);
    const meeting = on && isMeeting(hour);
    const t = state.clock.elapsedTime;
    const job = currentJobFor(info.id, st.jobs);
    const failed = job?.status === "failed";
    const waitingOk = st.approvals.some((ap) => ap.agentId === info.id);

    // ---- pick target + status text ----
    let px: number;
    let py: number;
    let pz: number;
    let yaw: number;
    let statusText: string;
    if (meeting) {
      px = seatPos.pos[0];
      pz = seatPos.pos[1];
      py = 0.28;
      yaw = seatPos.yaw;
      statusText = "standup";
    } else if (on) {
      px = info.desk[0];
      py = 0;
      pz = info.desk[1];
      yaw = info.deskYaw;
      statusText = failed ? "error!" : waitingOk ? "minta OK" : job?.status === "queued" ? "nunggu tugas" : info.verb;
    } else {
      px = info.lounge[0];
      py = loungeY;
      pz = info.lounge[1];
      yaw = info.loungeYaw;
      statusText = failed ? "ngisi token…" : "rehat";
    }

    const g = group.current;
    if (!g) return;

    const before = g.position.clone();
    target.current.set(px, py, pz);
    g.position.lerp(target.current, 1 - Math.exp(-d * 1.7));
    walking.current = before.distanceTo(g.position) > 0.004;

    const cur = g.rotation.y;
    const diff = ((yaw - cur + Math.PI) % (Math.PI * 2)) - Math.PI;
    g.rotation.y = cur + diff * (1 - Math.exp(-d * 2.4));

    const bob = Math.sin(t * 1.8 + phase) * 0.02;
    const hop = walking.current ? Math.abs(Math.sin(t * 9 + phase)) * 0.13 : 0;
    const waddle = walking.current ? Math.sin(t * 9 + phase) * 0.09 : 0;
    g.position.y = py + bob + hop;
    g.rotation.z = waddle;

    if (body.current) {
      const s = 1 + Math.sin(t * 2.1 + phase) * 0.012 + (walking.current ? Math.sin(t * 18) * 0.02 : 0);
      body.current.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));
    }
    if (head.current) {
      const look = hover || selected ? Math.sin(t * 2.4) * 0.14 : 0;
      head.current.rotation.z = Math.sin(t * 0.8 + phase) * 0.05 + look * 0.4;
      head.current.rotation.y =
        (hover || selected ? Math.sin(t * 1.6) * 0.1 : 0) + (walking.current ? Math.sin(t * 9) * 0.06 : 0);
    }
    if (face.current) {
      const blink = Math.sin(t * 0.9 + phase * 2.3) > 0.985 ? 0.12 : 1;
      face.current.scale.y += (blink - face.current.scale.y) * 0.5;
    }
    const typing = on && !walking.current && !meeting ? Math.sin(t * 8.5 + phase) * 0.22 : Math.sin(t * 1.2 + phase) * 0.06;
    if (leftArm.current) leftArm.current.rotation.x = -0.85 + typing;
    if (rightArm.current) rightArm.current.rotation.x = -0.85 - typing;

    if (ring.current) {
      ring.current.opacity = (selected ? 0.9 : hover ? 0.5 : 0.18) * (on ? 1 : 0.55);
      const ringColor = failed ? "#e11d48" : waitingOk ? "#f59e0b" : info.color;
      if (ring.current.color.getHexString() !== ringColor.slice(1)) ring.current.color.set(ringColor);
    }

    if (plateMat.current && plateSprite.current) {
      plateSprite.current.visible = labels || selected || hover;
      if (plateText.current !== statusText) {
        plateText.current = statusText;
        nameplate.redraw(statusText);
      }
      const cam = state.camera as THREE.OrthographicCamera;
      const w = (2.6 * 30) / (cam.zoom || 30);
      plateSprite.current.scale.set(w, w * 0.233, 1);
    }
    void prevState;
  });

  const suit = info.color;

  return (
    <group
      ref={group}
      position={[info.desk[0], 0, info.desk[1]]}
      rotation-y={info.deskYaw}
      onClick={(e) => {
        e.stopPropagation();
        select({ kind: "agent", id: info.id });
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
      <mesh position={[0, 0.015, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.42, 0.52, 32]} />
        <meshBasicMaterial ref={ring} color={suit} transparent opacity={0.2} depthWrite={false} />
      </mesh>

      <group ref={body} position={[0, 1.08, 0]}>
        <mesh scale={[1, 0.95, 0.9]}>
          <capsuleGeometry args={[0.34, 0.3, 6, 14]} />
          <meshLambertMaterial color={suit} />
        </mesh>
        <mesh position={[0, -0.12, 0.26]} rotation-x={0.35}>
          <boxGeometry args={[0.26, 0.13, 0.08]} />
          <meshLambertMaterial color="#ffffff" />
        </mesh>
        {[-0.07, 0.07].map((x) => (
          <mesh key={x} position={[x, 0.16, 0.3]}>
            <cylinderGeometry args={[0.012, 0.012, 0.1, 6]} />
            <meshLambertMaterial color="#ffffff" />
          </mesh>
        ))}

        <group ref={head} position={[0, 0.52, -0.02]}>
          <mesh>
            <sphereGeometry args={[0.28, 18, 14]} />
            <meshLambertMaterial color={suit} />
          </mesh>
          <mesh position={[0, 0.06, -0.05]} rotation-x={-0.55}>
            <torusGeometry args={[0.22, 0.09, 10, 20]} />
            <meshLambertMaterial color={suit} />
          </mesh>
          <mesh ref={face} position={[0, 0, 0.235]}>
            <circleGeometry args={[0.165, 20]} />
            <meshBasicMaterial map={faceTex} toneMapped={false} />
          </mesh>
        </group>

        <group ref={leftArm} position={[-0.3, 0.05, 0.12]}>
          <mesh position={[0, -0.12, 0.05]} rotation-x={-0.4}>
            <capsuleGeometry args={[0.085, 0.2, 5, 10]} />
            <meshLambertMaterial color={suit} />
          </mesh>
          <mesh position={[0, -0.24, 0.13]}>
            <sphereGeometry args={[0.075, 10, 8]} />
            <meshLambertMaterial color="#ffffff" />
          </mesh>
        </group>
        <group ref={rightArm} position={[0.3, 0.05, 0.12]}>
          <mesh position={[0, -0.12, 0.05]} rotation-x={-0.4}>
            <capsuleGeometry args={[0.085, 0.2, 5, 10]} />
            <meshLambertMaterial color={suit} />
          </mesh>
          <mesh position={[0, -0.24, 0.13]}>
            <sphereGeometry args={[0.075, 10, 8]} />
            <meshLambertMaterial color="#ffffff" />
          </mesh>
        </group>

        {[-0.12, 0.12].map((x) => (
          <mesh key={x} position={[x, -0.62, 0.14]}>
            <sphereGeometry args={[0.085, 10, 8]} />
            <meshLambertMaterial color="#ffffff" />
          </mesh>
        ))}
      </group>

      <sprite ref={plateSprite} position={[0, 2.18, 0]} scale={[2.6, 0.6, 1]}>
        <spriteMaterial ref={plateMat} map={nameplate.tex} transparent depthWrite={false} />
      </sprite>
    </group>
  );
}

/** Shared sleepy-cute face: oval eyes + sparkles + blush + smile. */
let faceTexture: THREE.Texture | null = null;
function getFaceTexture() {
  if (faceTexture) return faceTexture;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#1a1e3a";
  ctx.beginPath();
  ctx.arc(64, 64, 62, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  for (const ex of [42, 86]) {
    ctx.beginPath();
    ctx.ellipse(ex, 58, 9, 13, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#8fd0ff";
  for (const ex of [45, 89]) {
    ctx.beginPath();
    ctx.arc(ex, 54, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255,130,150,0.75)";
  for (const ex of [28, 100]) {
    ctx.beginPath();
    ctx.ellipse(ex, 76, 8, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(64, 72, 12, 0.25 * Math.PI, 0.75 * Math.PI);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  faceTexture = tex;
  return tex;
}

export function Agents() {
  return (
    <group>
      {AGENTS.map((a, i) => (
        <Hoodie key={a.id} info={a} index={i} />
      ))}
    </group>
  );
}
