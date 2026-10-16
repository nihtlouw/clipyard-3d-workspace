/**
 * CLIPYARD crew — round hoodie mascots (reference-style soft characters).
 * They sit at their desks on shift (typing, blinking, bobbing) and hop over
 * to the sofa / rug lounge corner after 17:00.
 */
import { useMemo, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { AGENTS, type AgentInfo } from "@/lib/hq-data";
import { createNameplate } from "@/lib/hq-textures";
import { isOnShift, useHqStore } from "@/lib/hq-store";

function hoverCursor(e: ThreeEvent<PointerEvent>, on: boolean) {
  e.stopPropagation();
  document.body.style.cursor = on ? "pointer" : "auto";
}

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
  const plateState = useRef(false);
  const [hover, setHover] = useState(false);

  const select = useHqStore((s) => s.select);
  const labels = useHqStore((s) => s.labels);
  const selected = useHqStore((s) => s.selection?.kind === "agent" && s.selection.id === info.id);
  const faceTex = useMemo(() => getFaceTexture(), []);

  const phase = useMemo(() => index * 1.73, [index]);
  const nameplate = useMemo(() => createNameplate(info.name, info.role, info.color), [info]);
  const target = useRef(new THREE.Vector3(info.desk[0], 0, info.desk[1]));
  const targetYaw = useRef(info.deskYaw);
  const walking = useRef(false);

  // sofa spots get a little lift so mascots sit on the cushions
  const loungeY = index < 3 ? 0.34 : 0;

  useFrame((state, delta) => {
    const d = Math.min(delta, 0.1);
    const { hour } = useHqStore.getState();
    const on = isOnShift(hour);
    const t = state.clock.elapsedTime;

    target.current.set(on ? info.desk[0] : info.lounge[0], on ? 0 : loungeY, on ? info.desk[1] : info.lounge[1]);
    targetYaw.current = on ? info.deskYaw : info.loungeYaw;

    const g = group.current;
    if (!g) return;

    const before = g.position.clone();
    g.position.lerp(target.current, 1 - Math.exp(-d * 1.7));
    const moved = before.distanceTo(g.position);
    walking.current = moved > 0.004;

    // smooth yaw via shortest angle
    const cur = g.rotation.y;
    const diff = ((targetYaw.current - cur + Math.PI) % (Math.PI * 2)) - Math.PI;
    g.rotation.y = cur + diff * (1 - Math.exp(-d * 2.4));

    // bob while sitting; hop while walking
    const bob = Math.sin(t * 1.8 + phase) * 0.02;
    const hop = walking.current ? Math.abs(Math.sin(t * 9 + phase)) * 0.13 : 0;
    const waddle = walking.current ? Math.sin(t * 9 + phase) * 0.09 : 0;
    g.position.y = target.current.y + bob + hop;
    g.rotation.z = waddle;

    if (body.current) {
      // squash & stretch: breathing idle, squashed landing after hops
      const s = 1 + Math.sin(t * 2.1 + phase) * 0.012 + (walking.current ? Math.sin(t * 18) * 0.02 : 0);
      body.current.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));
    }

    if (head.current) {
      const look = hover || selected ? Math.sin(t * 2.4) * 0.14 : 0;
      head.current.rotation.z = Math.sin(t * 0.8 + phase) * 0.05 + look * 0.4;
      head.current.rotation.y = (hover || selected ? Math.sin(t * 1.6) * 0.1 : 0) + (walking.current ? Math.sin(t * 9) * 0.06 : 0);
    }

    // blink (squish the face briefly)
    if (face.current) {
      const blink = Math.sin(t * 0.9 + phase * 2.3) > 0.985 ? 0.12 : 1;
      face.current.scale.y += (blink - face.current.scale.y) * 0.5;
    }

    // typing arms on shift
    const typing = on && !walking.current ? Math.sin(t * 8.5 + phase) * 0.22 : Math.sin(t * 1.2 + phase) * 0.06;
    if (leftArm.current) leftArm.current.rotation.x = -0.85 + typing;
    if (rightArm.current) rightArm.current.rotation.x = -0.85 - typing;

    if (ring.current) {
      ring.current.opacity = (selected ? 0.9 : hover ? 0.5 : 0.18) * (on ? 1 : 0.5);
    }

    if (plateMat.current && plateSprite.current) {
      const show = labels || selected || hover;
      plateSprite.current.visible = show;
      const active = selected || hover;
      if (plateState.current !== active) {
        plateState.current = active;
        nameplate.redraw(active);
      }
      // constant screen size under orthographic zoom
      const cam = state.camera as THREE.OrthographicCamera;
      const w = (2.35 * 34) / (cam.zoom || 34);
      plateSprite.current.scale.set(w, w * 0.325, 1);
    }
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
      {/* status ring on the floor / seat */}
      <mesh position={[0, 0.015, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.42, 0.52, 32]} />
        <meshBasicMaterial ref={ring} color={suit} transparent opacity={0.2} depthWrite={false} />
      </mesh>

      <group ref={body} position={[0, 1.08, 0]}>
        {/* hoodie torso */}
        <mesh scale={[1, 0.95, 0.9]}>
          <capsuleGeometry args={[0.34, 0.3, 6, 14]} />
          <meshLambertMaterial color={suit} />
        </mesh>
        {/* hoodie pocket */}
        <mesh position={[0, -0.12, 0.26]} rotation-x={0.35}>
          <boxGeometry args={[0.26, 0.13, 0.08]} />
          <meshLambertMaterial color="#ffffff" />
        </mesh>
        {/* drawstrings */}
        {[-0.07, 0.07].map((x) => (
          <mesh key={x} position={[x, 0.16, 0.3]}>
            <cylinderGeometry args={[0.012, 0.012, 0.1, 6]} />
            <meshLambertMaterial color="#ffffff" />
          </mesh>
        ))}

        {/* head + hood */}
        <group ref={head} position={[0, 0.52, -0.02]}>
          <mesh>
            <sphereGeometry args={[0.28, 18, 14]} />
            <meshLambertMaterial color={suit} />
          </mesh>
          {/* hood rim behind the face */}
          <mesh position={[0, 0.06, -0.05]} rotation-x={-0.55}>
            <torusGeometry args={[0.22, 0.09, 10, 20]} />
            <meshLambertMaterial color={suit} />
          </mesh>
          {/* face screen with drawn eyes + blush */}
          <mesh ref={face} position={[0, 0.0, 0.235]}>
            <circleGeometry args={[0.165, 20]} />
            <meshBasicMaterial map={faceTex} toneMapped={false} />
          </mesh>
        </group>

        {/* stubby arms */}
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

        {/* little feet peeking under the desk (sitting pose) */}
        {[-0.12, 0.12].map((x) => (
          <mesh key={x} position={[x, -0.62, 0.14]}>
            <sphereGeometry args={[0.085, 10, 8]} />
            <meshLambertMaterial color="#ffffff" />
          </mesh>
        ))}
      </group>

      <sprite ref={plateSprite} position={[0, 2.15, 0]} scale={[2.35, 0.76, 1]}>
        <spriteMaterial ref={plateMat} map={nameplate.tex} transparent depthWrite={false} />
      </sprite>
    </group>
  );
}

/** Shared sleepy-cute face: two oval eyes + blush dots + tiny smile. */
let faceTexture: THREE.Texture | null = null;
function getFaceTexture() {
  if (faceTexture) return faceTexture;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 128, 128);
  // face plate
  ctx.fillStyle = "#1a1e3a";
  ctx.beginPath();
  ctx.arc(64, 64, 62, 0, Math.PI * 2);
  ctx.fill();
  // eyes
  ctx.fillStyle = "#ffffff";
  for (const ex of [42, 86]) {
    ctx.beginPath();
    ctx.ellipse(ex, 58, 9, 13, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // eye sparkles
  ctx.fillStyle = "#8fd0ff";
  for (const ex of [45, 89]) {
    ctx.beginPath();
    ctx.arc(ex, 54, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // blush
  ctx.fillStyle = "rgba(255,130,150,0.75)";
  for (const ex of [28, 100]) {
    ctx.beginPath();
    ctx.ellipse(ex, 76, 8, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // smile
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
