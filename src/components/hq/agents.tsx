import { useMemo, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { AGENTS, type AgentInfo } from "@/lib/hq-data";
import { nameplateTexture, redrawNameplate } from "@/lib/hq-textures";
import { isOnShift, useHqStore } from "@/lib/hq-store";

function hoverCursor(e: ThreeEvent<PointerEvent>, on: boolean) {
  e.stopPropagation();
  document.body.style.cursor = on ? "pointer" : "auto";
}

/**
 * Stylized AI-agent character: capsule body, glowing visor, antenna.
 * Stands at its desk on shift, drifts to the lounge off shift.
 */
function Agent({ info, index }: { info: AgentInfo; index: number }) {
  const group = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const ring = useRef<THREE.MeshBasicMaterial>(null);
  const visor = useRef<THREE.MeshStandardMaterial>(null);
  const plate = useRef<THREE.SpriteMaterial>(null);
  const plateSprite = useRef<THREE.Sprite>(null);
  const _tmp = useMemo(() => new THREE.Vector3(), []);
  const plateTex = useMemo(() => nameplateTexture(info.name, info.role, info.color, false), [info]);
  const plateState = useRef(false);
  const select = useHqStore((s) => s.select);
  const labels = useHqStore((s) => s.labels);
  const selected = useHqStore((s) => s.selection?.kind === "agent" && s.selection.id === info.id);
  const [hover, setHover] = useState(false);

  const phase = useMemo(() => index * 1.37, [index]);
  const target = useRef(new THREE.Vector3(info.desk[0], 0.25, info.desk[1]));
  const targetYaw = useRef(info.deskYaw);

  useFrame((state, delta) => {
    const d = Math.min(delta, 0.1);
    const { hour } = useHqStore.getState();
    const on = isOnShift(hour);
    const t = state.clock.elapsedTime;

    // drift between desk and lounge
    target.current.set(
      on ? info.desk[0] : info.lounge[0],
      0.25,
      on ? info.desk[1] : info.lounge[1],
    );
    targetYaw.current = on ? info.deskYaw : Math.PI * 0.6 + index * 0.35;

    if (group.current) {
      group.current.position.lerp(target.current, 1 - Math.exp(-d * 1.6));
      // smooth yaw via shortest angle
      const cur = group.current.rotation.y;
      const diff = ((targetYaw.current - cur + Math.PI) % (Math.PI * 2)) - Math.PI;
      group.current.rotation.y = cur + diff * (1 - Math.exp(-d * 2.2));

      const bob = Math.sin(t * 1.7 + phase) * 0.028;
      group.current.position.y = 0.25 + bob;

      const sway = Math.sin(t * 0.9 + phase) * 0.06;
      if (head.current) {
        head.current.rotation.y = sway + (hover || selected ? Math.sin(t * 2.2) * 0.12 : 0);
        head.current.rotation.z = Math.sin(t * 0.7 + phase) * 0.035;
      }

      // typing / idle arms
      const typing = on ? Math.sin(t * 7.5 + phase) * 0.28 : Math.sin(t * 1.1 + phase) * 0.08;
      if (leftArm.current) leftArm.current.rotation.x = -0.55 + typing;
      if (rightArm.current) rightArm.current.rotation.x = -0.55 - typing;

      if (ring.current) {
        ring.current.opacity = (selected ? 0.95 : hover ? 0.55 : 0.22) * (on ? 1 : 0.45);
      }
      if (visor.current) {
        visor.current.emissiveIntensity = (selected ? 2.4 : hover ? 1.8 : 1.15) * (on ? 1 : 0.35);
      }
      if (plate.current && plateSprite.current) {
        plate.current.opacity = labels || selected || hover ? 1 : 0;
        const active = selected || hover;
        if (plateState.current !== active) {
          plateState.current = active;
          redrawNameplate(plateTex, info.name, info.role, info.color, active);
        }
        // constant screen-size nameplate
        group.current.getWorldPosition(_tmp);
        const dist = state.camera.position.distanceTo(_tmp);
        const w = THREE.MathUtils.clamp(dist * 0.082, 0.3, 7.5);
        plateSprite.current.scale.set(w, w / 3.05, 1);
      }
    }
  });

  const suit = info.color;
  const dark = "#1c2430";

  return (
    <group
      ref={group}
      position={[info.desk[0], 0.25, info.desk[1]]}
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
      {/* status ring */}
      <mesh position={[0, 0.012, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.52, 0.62, 36]} />
        <meshBasicMaterial ref={ring} color={suit} transparent opacity={0.25} depthWrite={false} />
      </mesh>

      {/* legs */}
      {[-0.13, 0.13].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.32, 0]} castShadow>
            <capsuleGeometry args={[0.095, 0.32, 6, 10]} />
            <meshStandardMaterial color={dark} roughness={0.55} />
          </mesh>
          <mesh position={[x, 0.075, 0.05]} castShadow>
            <boxGeometry args={[0.17, 0.1, 0.3]} />
            <meshStandardMaterial color="#0f141d" roughness={0.5} />
          </mesh>
        </group>
      ))}

      {/* hips + torso */}
      <mesh position={[0, 0.72, 0]} castShadow>
        <capsuleGeometry args={[0.2, 0.14, 6, 12]} />
        <meshStandardMaterial color={dark} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.08, 0]} castShadow>
        <capsuleGeometry args={[0.235, 0.38, 8, 14]} />
        <meshStandardMaterial color={suit} roughness={0.42} />
      </mesh>
      {/* chest core */}
      <mesh position={[0, 1.12, 0.22]}>
        <boxGeometry args={[0.16, 0.22, 0.05]} />
        <meshStandardMaterial color="#e9f6ff" emissive={suit} emissiveIntensity={1.25} toneMapped={false} />
      </mesh>
      {/* collar */}
      <mesh position={[0, 1.42, 0]}>
        <cylinderGeometry args={[0.135, 0.16, 0.1, 12]} />
        <meshStandardMaterial color={dark} roughness={0.45} metalness={0.35} />
      </mesh>

      {/* arms */}
      <group ref={leftArm} position={[-0.3, 1.28, 0]}>
        <mesh position={[0, -0.19, 0]} castShadow>
          <capsuleGeometry args={[0.075, 0.3, 6, 10]} />
          <meshStandardMaterial color={suit} roughness={0.45} />
        </mesh>
        <mesh position={[0, -0.42, 0.06]}>
          <sphereGeometry args={[0.085, 10, 8]} />
          <meshStandardMaterial color="#cfd6e2" roughness={0.4} metalness={0.3} />
        </mesh>
      </group>
      <group ref={rightArm} position={[0.3, 1.28, 0]}>
        <mesh position={[0, -0.19, 0]} castShadow>
          <capsuleGeometry args={[0.075, 0.3, 6, 10]} />
          <meshStandardMaterial color={suit} roughness={0.45} />
        </mesh>
        <mesh position={[0, -0.42, 0.06]}>
          <sphereGeometry args={[0.085, 10, 8]} />
          <meshStandardMaterial color="#cfd6e2" roughness={0.4} metalness={0.3} />
        </mesh>
      </group>

      {/* head */}
      <group ref={head} position={[0, 1.62, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.185, 18, 14]} />
          <meshStandardMaterial color="#232b38" roughness={0.4} metalness={0.25} />
        </mesh>
        {/* visor band */}
        <mesh position={[0, 0.015, 0.055]}>
          <boxGeometry args={[0.3, 0.1, 0.22]} />
          <meshStandardMaterial ref={visor} color="#0c1420" emissive={suit} emissiveIntensity={1.15} toneMapped={false} />
        </mesh>
        {/* antenna */}
        <mesh position={[0, 0.24, -0.02]}>
          <cylinderGeometry args={[0.016, 0.016, 0.16, 6]} />
          <meshStandardMaterial color="#39424f" metalness={0.6} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.34, -0.02]}>
          <sphereGeometry args={[0.038, 10, 8]} />
          <meshStandardMaterial color={suit} emissive={suit} emissiveIntensity={1.8} toneMapped={false} />
        </mesh>
      </group>

      <sprite ref={plateSprite} position={[0, 2.42, 0]} scale={[2.35, 0.77, 1]}>
        <spriteMaterial ref={plate} map={plateTex} transparent depthWrite={false} opacity={1} />
      </sprite>
    </group>
  );
}

export function Agents() {
  return (
    <group>
      {AGENTS.map((a, i) => (
        <Agent key={a.id} info={a} index={i} />
      ))}
    </group>
  );
}
