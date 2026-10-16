import { useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import {
  asphaltTexture,
  concreteTexture,
  corrugatedTexture,
  opsBoardTexture,
  redrawOpsBoard,
  redrawScreen,
  screenTexture,
  signTexture,
  woodTexture,
} from "@/lib/hq-textures";
import { AGENTS, VEHICLES, type VehicleInfo } from "@/lib/hq-data";
import { dayFactors, isOnShift, useHqStore } from "@/lib/hq-store";

function hoverCursor(e: ThreeEvent<PointerEvent>, on: boolean) {
  e.stopPropagation();
  document.body.style.cursor = on ? "pointer" : "auto";
}

/* ---------------------------------- ground & parking ---------------------------------- */

function Ground() {
  const asphalt = useMemo(() => asphaltTexture([42, 42]), []);
  const concrete = useMemo(() => concreteTexture([8, 2], "#9aa3b0"), []);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[160, 160]} />
        <meshStandardMaterial map={asphalt} roughness={0.95} color="#5b626e" />
      </mesh>
      {/* concrete apron in front of the roller bays */}
      <mesh position={[0, 0.02, 9.8]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[26.4, 3.4]} />
        <meshStandardMaterial map={concrete} roughness={0.9} color="#b9c1cc" />
      </mesh>
      {/* parking bay lines */}
      {[-13.15, -7.85, -2.55, 2.75, 8.05, 13.35].map((x) => (
        <mesh key={x} position={[x, 0.035, 14.6]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[0.16, 5.6]} />
          <meshStandardMaterial color="#dfe6ef" roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 0.035, 11.9]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[26.8, 0.16]} />
        <meshStandardMaterial color="#dfe6ef" roughness={0.6} />
      </mesh>
      {/* scooter pad */}
      <mesh position={[15.6, 0.035, 13.4]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[3.4, 3.4]} />
        <meshStandardMaterial map={concrete} roughness={0.9} color="#aeb7c4" />
      </mesh>
    </group>
  );
}

/* ---------------------------------- warehouse shell ---------------------------------- */

const EAVE = 9;
const RIDGE = 11.6;
const HX = 13;
const HZ = 8.2;
const ROOF_ANGLE = Math.atan2(RIDGE - EAVE, HZ + 0.6);

function Warehouse() {
  const metal = useMemo(() => corrugatedTexture("#8f99a9", "#68727f", [7, 2]), []);
  const metalDark = useMemo(() => corrugatedTexture("#5c6674", "#434c58", [4, 2]), []);
  const concrete = useMemo(() => concreteTexture([9, 6], "#b3bbc7"), []);
  const roofMat = useMemo(() => corrugatedTexture("#3a4250", "#2b323e", [8, 3]), []);
  const sign = useMemo(() => signTexture("CLIPYARD", "#22d3ee", { sub: "AUTONOMOUS CLIP FACTORY" }), []);
  const signMat = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(() => {
    const { night } = dayFactors(useHqStore.getState().hour);
    if (signMat.current) signMat.current.emissiveIntensity = 1.05 + night * 1.5;
  });

  return (
    <group>
      {/* slab */}
      <mesh position={[0, 0.12, 0]} receiveShadow>
        <boxGeometry args={[HX * 2 + 1, 0.24, HZ * 2 + 1]} />
        <meshStandardMaterial map={concrete} roughness={0.85} color="#c3cad4" />
      </mesh>
      {/* interior floor */}
      <mesh position={[0, 0.25, 0]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[HX * 2 - 0.6, HZ * 2 - 0.6]} />
        <meshStandardMaterial map={useMemo(() => concreteTexture([13, 9], "#aab3c0"), [])} roughness={0.8} />
      </mesh>

      {/* back / side walls */}
      <mesh position={[0, EAVE / 2 + 0.25, -HZ]} castShadow receiveShadow>
        <boxGeometry args={[HX * 2, EAVE, 0.45]} />
        <meshStandardMaterial map={metal} roughness={0.75} metalness={0.25} />
      </mesh>
      <mesh position={[-HX, EAVE / 2 + 0.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.45, EAVE, HZ * 2]} />
        <meshStandardMaterial map={metal} roughness={0.75} metalness={0.25} />
      </mesh>
      <mesh position={[HX, EAVE / 2 + 0.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.45, EAVE, HZ * 2]} />
        <meshStandardMaterial map={metal} roughness={0.75} metalness={0.25} />
      </mesh>

      {/* front wall — mostly open bays, solid wings + columns */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 10.4, EAVE / 2 + 0.25, HZ]} castShadow receiveShadow>
          <boxGeometry args={[5.2, EAVE, 0.45]} />
          <meshStandardMaterial map={metal} roughness={0.75} metalness={0.25} />
        </mesh>
      ))}
      {[-12.6, -7.6, -5.6, 5.6, 7.6, 12.6].map((x) => (
        <mesh key={x} position={[x, EAVE / 2 + 0.25, HZ]} castShadow>
          <boxGeometry args={[0.5, EAVE, 0.55]} />
          <meshStandardMaterial map={metalDark} roughness={0.7} metalness={0.3} />
        </mesh>
      ))}
      {/* lintel above the open bays */}
      <mesh position={[0, EAVE - 0.45 + 0.25, HZ]} castShadow>
        <boxGeometry args={[12.2, 0.9, 0.55]} />
        <meshStandardMaterial map={metalDark} roughness={0.7} metalness={0.3} />
      </mesh>

      {/* rolled-up slat door over center bay */}
      <group position={[0, 0, 0]}>
        <mesh position={[0, EAVE - 1.6 + 0.25, HZ + 0.15]} castShadow>
          <boxGeometry args={[11.4, 1.1, 0.32]} />
          <meshStandardMaterial color="#c8ced8" roughness={0.55} metalness={0.55} />
        </mesh>
        {[-5.85, 5.85].map((x) => (
          <mesh key={x} position={[x, (EAVE - 3.1) / 2 + 0.25, HZ + 0.15]} castShadow>
            <boxGeometry args={[0.22, EAVE - 3.1, 0.28]} />
            <meshStandardMaterial color="#9aa3b0" roughness={0.5} metalness={0.6} />
          </mesh>
        ))}
      </group>

      {/* half-closed second door on the right wing */}
      <mesh position={[10.4, 3.6 + 0.25, HZ - 0.35]} castShadow>
        <boxGeometry args={[3.6, 6.4, 0.18]} />
        <meshStandardMaterial color="#b3bac6" roughness={0.6} metalness={0.5} />
      </mesh>

      {/* gable roof — two slopes, ridge along X */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[0, (EAVE + RIDGE) / 2 + 0.25, (s * (HZ + 0.6)) / 2]}
          rotation-x={s * ROOF_ANGLE}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[HX * 2 + 1.6, 0.28, Math.hypot(HZ + 0.6, RIDGE - EAVE)]} />
          <meshStandardMaterial map={roofMat} roughness={0.85} metalness={0.2} color="#4a5462" />
        </mesh>
      ))}
      {/* skylight strips */}
      {[-1, 1].map((s) =>
        [-6.5, 0, 6.5].map((x) => (
          <mesh
            key={`${s}-${x}`}
            position={[x, (EAVE + RIDGE) / 2 + 0.55, s * 3.6]}
            rotation-x={s * ROOF_ANGLE}
          >
            <boxGeometry args={[3.4, 0.1, 1.7]} />
            <meshStandardMaterial
              color="#9fd8ef"
              emissive="#7fc8ea"
              emissiveIntensity={0.35}
              transparent
              opacity={0.85}
              roughness={0.2}
            />
          </mesh>
        )),
      )}

      {/* interior trusses */}
      {[-9, -3, 3, 9].map((x) => (
        <group key={x}>
          <mesh position={[x, EAVE + 0.15, 0]} castShadow>
            <boxGeometry args={[0.3, 0.35, HZ * 2]} />
            <meshStandardMaterial color="#39424f" roughness={0.6} metalness={0.5} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[x, (EAVE + RIDGE) / 2, s * (HZ / 2)]} rotation-x={s * ROOF_ANGLE} castShadow>
              <boxGeometry args={[0.22, 0.3, Math.hypot(HZ, RIDGE - EAVE) * 0.98]} />
              <meshStandardMaterial color="#39424f" roughness={0.6} metalness={0.5} />
            </mesh>
          ))}
        </group>
      ))}
      {/* ridge beam */}
      <mesh position={[0, RIDGE - 0.15, 0]}>
        <boxGeometry args={[HX * 2, 0.35, 0.35]} />
        <meshStandardMaterial color="#39424f" roughness={0.6} metalness={0.5} />
      </mesh>

      {/* facade neon sign */}
      <mesh position={[0, 6.95, HZ + 0.95]}>
        <planeGeometry args={[10.8, 3.38]} />
        <meshStandardMaterial ref={signMat} map={sign} emissiveMap={sign} emissive="#ffffff" emissiveIntensity={1.1} roughness={0.5} />
      </mesh>
      <mesh position={[0, 6.95, HZ + 0.82]}>
        <boxGeometry args={[11.3, 3.8, 0.18]} />
        <meshStandardMaterial color="#101623" roughness={0.6} />
      </mesh>

      {/* rooftop kit */}
      {[-7, 7].map((x) => (
        <group key={x} position={[x, 0, -1.2]}>
          <mesh position={[0, 11.05, 0]} castShadow>
            <boxGeometry args={[2.2, 0.9, 1.6]} />
            <meshStandardMaterial color="#8b95a3" roughness={0.55} metalness={0.5} />
          </mesh>
          <mesh position={[0, 11.55, 0]} rotation-x={-Math.PI / 2}>
            <cylinderGeometry args={[0.55, 0.55, 0.12, 16]} />
            <meshStandardMaterial color="#525c6b" roughness={0.5} metalness={0.6} />
          </mesh>
        </group>
      ))}
      <group position={[11.5, 0, -5.5]}>
        <mesh position={[0, 11.9, 0]}>
          <cylinderGeometry args={[0.06, 0.1, 3.2, 8]} />
          <meshStandardMaterial color="#6b7482" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[0, 13.55, 0]}>
          <sphereGeometry args={[0.16, 12, 10]} />
          <meshStandardMaterial color="#ff4d4d" emissive="#ff2222" emissiveIntensity={1.6} />
        </mesh>
      </group>
    </group>
  );
}

/* ---------------------------------- interior props ---------------------------------- */

function Monitor({
  position,
  rotationY,
  accent,
  variant,
}: {
  position: [number, number, number];
  rotationY: number;
  accent: string;
  variant: number;
}) {
  const tex = useMemo(() => screenTexture(variant, accent, 0), [variant, accent]);
  const screenMat = useRef<THREE.MeshStandardMaterial>(null);
  const acc = useRef(0);

  useFrame((_, delta) => {
    const { hour, playing } = useHqStore.getState();
    const on = isOnShift(hour);
    acc.current += delta;
    if (acc.current > 0.28) {
      acc.current = 0;
      redrawScreen(tex, variant, accent, performance.now() / 1000);
    }
    if (screenMat.current) {
      screenMat.current.emissiveIntensity = on ? (playing ? 1.15 : 1.05) : 0.18;
    }
  });

  return (
    <group position={position} rotation-y={rotationY}>
      {/* stand */}
      <mesh position={[0, 0.18, 0]} castShadow>
        <boxGeometry args={[0.34, 0.05, 0.22]} />
        <meshStandardMaterial color="#232a36" roughness={0.5} metalness={0.5} />
      </mesh>
      <mesh position={[0, 0.38, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 0.38, 10]} />
        <meshStandardMaterial color="#232a36" roughness={0.5} metalness={0.5} />
      </mesh>
      {/* panel */}
      <group position={[0, 0.86, 0]} rotation-x={-0.16}>
        <mesh castShadow>
          <boxGeometry args={[1.14, 0.68, 0.05]} />
          <meshStandardMaterial color="#171c26" roughness={0.45} />
        </mesh>
        <mesh position={[0, 0, 0.032]}>
          <planeGeometry args={[1.04, 0.58]} />
          <meshStandardMaterial ref={screenMat} map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={1.1} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

function Chair({ position, rotationY }: { position: [number, number, number]; rotationY: number }) {
  return (
    <group position={position} rotation-y={rotationY}>
      <mesh position={[0, 0.62, 0]} castShadow>
        <boxGeometry args={[0.52, 0.09, 0.5]} />
        <meshStandardMaterial color="#2c3442" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.95, -0.24]} rotation-x={0.18} castShadow>
        <boxGeometry args={[0.5, 0.56, 0.08]} />
        <meshStandardMaterial color="#2c3442" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.32, 0]} castShadow>
        <cylinderGeometry args={[0.045, 0.045, 0.58, 10]} />
        <meshStandardMaterial color="#1d232e" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.07, 12]} />
        <meshStandardMaterial color="#1d232e" metalness={0.5} roughness={0.5} />
      </mesh>
    </group>
  );
}

function Pod({ x, z, faceDir, accent, variant }: { x: number; z: number; faceDir: 1 | -1; accent: string; variant: number }) {
  const wood = useMemo(() => woodTexture([1.6, 0.8]), []);
  return (
    <group position={[x, 0, z]}>
      {/* desk */}
      <mesh position={[0, 1.0, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.3, 0.09, 1.45]} />
        <meshStandardMaterial map={wood} color="#b08a62" roughness={0.65} />
      </mesh>
      {[-1.5, 1.5].map((lx) =>
        [-0.6, 0.6].map((lz) => (
          <mesh key={`${lx}${lz}`} position={[lx, 0.5, lz]} castShadow>
            <boxGeometry args={[0.09, 1.0, 0.09]} />
            <meshStandardMaterial color="#2a313d" roughness={0.5} metalness={0.5} />
          </mesh>
        )),
      )}
      {/* under-desk accent LED */}
      <mesh position={[0, 0.93, faceDir * 0.74]}>
        <boxGeometry args={[3.1, 0.045, 0.045]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.2} toneMapped={false} />
      </mesh>
      {/* dual monitors */}
      <Monitor position={[-0.62, 1.05, 0]} rotationY={faceDir === 1 ? -0.28 : Math.PI + 0.28} accent={accent} variant={variant} />
      <Monitor position={[0.62, 1.05, 0]} rotationY={faceDir === 1 ? 0.28 : Math.PI - 0.28} accent={accent} variant={variant + 1} />
      {/* keyboard + mouse + mug */}
      <mesh position={[0, 1.07, faceDir * 0.34]} rotation-x={-0.08} castShadow>
        <boxGeometry args={[0.86, 0.035, 0.3]} />
        <meshStandardMaterial color="#252c38" roughness={0.55} />
      </mesh>
      <mesh position={[0.66, 1.075, faceDir * 0.36]} castShadow>
        <sphereGeometry args={[0.07, 10, 8]} />
        <meshStandardMaterial color="#303849" roughness={0.45} />
      </mesh>
      <mesh position={[-1.15, 1.14, faceDir * 0.32]} castShadow>
        <cylinderGeometry args={[0.075, 0.065, 0.16, 12]} />
        <meshStandardMaterial color="#e8ecf3" roughness={0.4} />
      </mesh>
      {/* small plant */}
      <group position={[1.35, 1.05, faceDir * 0.3]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.11, 0.09, 0.17, 10]} />
          <meshStandardMaterial color="#c96f4a" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.2, 0]} castShadow>
          <sphereGeometry args={[0.16, 8, 6]} />
          <meshStandardMaterial color="#2f9e63" roughness={0.8} flatShading />
        </mesh>
      </group>
      <Chair position={[0, 0, -faceDir * 1.15]} rotationY={faceDir === 1 ? Math.PI : 0} />
    </group>
  );
}

function ServerRack({ position, rotationY }: { position: [number, number, number]; rotationY: number }) {
  const leds = useRef<THREE.Group>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!leds.current) return;
    leds.current.children.forEach((child, i) => {
      const m = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = 0.5 + Math.abs(Math.sin(t * (1.2 + i * 0.23) + i)) * 1.8;
    });
  });
  return (
    <group position={position} rotation-y={rotationY}>
      {[0, 1.35].map((ox) => (
        <group key={ox} position={[ox, 0, 0]}>
          <mesh position={[0, 1.25, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.15, 2.5, 1.15]} />
            <meshStandardMaterial color="#12161f" roughness={0.5} metalness={0.55} />
          </mesh>
          <group ref={ox === 0 ? leds : undefined}>
            {[0.6, 1.0, 1.4, 1.8].map((y, i) => (
              <mesh key={y} position={[0.59, y, 0.32]}>
                <boxGeometry args={[0.03, 0.12, 0.34]} />
                <meshStandardMaterial
                  color={i % 2 ? "#34d399" : "#22d3ee"}
                  emissive={i % 2 ? "#34d399" : "#22d3ee"}
                  emissiveIntensity={1.2}
                  toneMapped={false}
                />
              </mesh>
            ))}
          </group>
          <mesh position={[0, 2.28, 0.3]}>
            <boxGeometry args={[0.9, 0.03, 0.5]} />
            <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={0.8} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Lounge() {
  return (
    <group position={[-9.2, 0, 4.1]}>
      {/* couch facing +X */}
      <group rotation-y={Math.PI / 2}>
        <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.5, 0.34, 1.0]} />
          <meshStandardMaterial color="#2c3442" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.85, -0.42]} castShadow>
          <boxGeometry args={[2.5, 0.62, 0.22]} />
          <meshStandardMaterial color="#2c3442" roughness={0.8} />
        </mesh>
        {[-1.32, 1.32].map((x) => (
          <mesh key={x} position={[x, 0.62, 0]} castShadow>
            <boxGeometry args={[0.22, 0.75, 1.0]} />
            <meshStandardMaterial color="#252c38" roughness={0.8} />
          </mesh>
        ))}
        {[-0.62, 0.62].map((x) => (
          <mesh key={x} position={[x, 0.68, 0.1]} castShadow>
            <boxGeometry args={[1.05, 0.18, 0.7]} />
            <meshStandardMaterial color="#3d4759" roughness={0.85} />
          </mesh>
        ))}
      </group>
      {/* coffee table */}
      <mesh position={[1.35, 0.36, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.1, 0.1, 0.7]} />
        <meshStandardMaterial map={useMemo(() => woodTexture([1, 1]), [])} color="#9a7350" roughness={0.6} />
      </mesh>
      <mesh position={[1.35, 0.18, 0]} castShadow>
        <boxGeometry args={[0.9, 0.32, 0.55]} />
        <meshStandardMaterial color="#222933" roughness={0.6} />
      </mesh>
      <mesh position={[1.35, 0.47, 0.12]} castShadow>
        <cylinderGeometry args={[0.06, 0.05, 0.13, 10]} />
        <meshStandardMaterial color="#e85d4a" roughness={0.4} />
      </mesh>
      {/* mini fridge */}
      <group position={[-0.2, 0, -2.0]}>
        <mesh position={[0, 0.85, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.8, 1.7, 0.72]} />
          <meshStandardMaterial color="#39424f" roughness={0.5} metalness={0.5} />
        </mesh>
        <mesh position={[0.28, 1.05, 0.37]}>
          <boxGeometry args={[0.05, 0.5, 0.04]} />
          <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={1.1} toneMapped={false} />
        </mesh>
      </group>
      {/* tall plant */}
      <group position={[0.6, 0, 1.9]}>
        <mesh position={[0, 0.3, 0]} castShadow>
          <cylinderGeometry args={[0.28, 0.22, 0.6, 12]} />
          <meshStandardMaterial color="#c96f4a" roughness={0.7} />
        </mesh>
        <mesh position={[0, 1.15, 0]} castShadow>
          <cylinderGeometry args={[0.045, 0.055, 1.2, 8]} />
          <meshStandardMaterial color="#2f7a4e" roughness={0.8} />
        </mesh>
        {[
          [0, 1.85, 0, 0.5],
          [0.32, 1.55, 0.18, 0.36],
          [-0.3, 1.62, -0.14, 0.34],
        ].map(([x, y, z, r], i) => (
          <mesh key={i} position={[x, y, z]} castShadow>
            <sphereGeometry args={[r, 8, 6]} />
            <meshStandardMaterial color="#2f9e63" roughness={0.85} flatShading />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Pendant({ position }: { position: [number, number, number] }) {
  const light = useRef<THREE.PointLight>(null);
  const bulb = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    const { night } = dayFactors(useHqStore.getState().hour);
    if (light.current) light.current.intensity = 6 + night * 16;
    if (bulb.current) bulb.current.emissiveIntensity = 1 + night * 1.6;
  });
  return (
    <group position={position}>
      <mesh position={[0, 8.75, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 1.1, 6]} />
        <meshStandardMaterial color="#2c3442" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 8.12, 0]}>
        <cylinderGeometry args={[0.42, 0.18, 0.3, 14]} />
        <meshStandardMaterial color="#232b38" metalness={0.55} roughness={0.45} />
      </mesh>
      <mesh position={[0, 7.98, 0]} rotation-x={Math.PI}>
        <circleGeometry args={[0.36, 16]} />
        <meshStandardMaterial ref={bulb} color="#ffe9c4" emissive="#ffd9a0" emissiveIntensity={1.2} toneMapped={false} />
      </mesh>
      <pointLight ref={light} position={[0, 7.7, 0]} color="#ffd9a8" distance={17} decay={2} intensity={8} />
    </group>
  );
}

function InteriorProps() {
  const neon = useRef<THREE.MeshStandardMaterial>(null);
  const boardTex = useMemo(() => opsBoardTexture(0), []);
  const boardMat = useRef<THREE.MeshStandardMaterial>(null);
  const acc = useRef(0);

  useFrame((_, delta) => {
    const { hour } = useHqStore.getState();
    const { night } = dayFactors(hour);
    if (neon.current) neon.current.emissiveIntensity = 0.9 + night * 1.6;
    acc.current += delta;
    if (acc.current > 0.5) {
      acc.current = 0;
      redrawOpsBoard(boardTex, performance.now() / 1000);
    }
    if (boardMat.current) boardMat.current.emissiveIntensity = 1.0 + night * 0.6;
  });

  return (
    <group>
      {/* hanging pendant fixtures */}
      {[
        [-4.6, -1.2],
        [4.6, -1.2],
        [-4.6, 2.2],
        [4.6, 2.2],
        [0, 0.5],
      ].map(([x, z]) => (
        <Pendant key={`${x}-${z}`} position={[x, 0, z]} />
      ))}

      {/* wall-mounted screens */}
      <group position={[-12.68, 4.5, -1.4]} rotation-y={Math.PI / 2}>
        <mesh>
          <boxGeometry args={[3.6, 2.1, 0.12]} />
          <meshStandardMaterial color="#12161f" roughness={0.5} />
        </mesh>
        <WallScreen variant={2} accent="#a78bfa" />
      </group>
      <group position={[12.68, 4.5, -1.4]} rotation-y={-Math.PI / 2}>
        <mesh>
          <boxGeometry args={[3.6, 2.1, 0.12]} />
          <meshStandardMaterial color="#12161f" roughness={0.5} />
        </mesh>
        <WallScreen variant={1} accent="#fbbf24" />
      </group>

      {/* ops board on the back wall */}
      <group position={[0, 5.35, -7.85]}>
        <mesh>
          <boxGeometry args={[7.6, 3.9, 0.14]} />
          <meshStandardMaterial color="#0b1220" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0, 0.08]}>
          <planeGeometry args={[7.3, 3.6]} />
          <meshStandardMaterial ref={boardMat} map={boardTex} emissiveMap={boardTex} emissive="#ffffff" emissiveIntensity={1.05} toneMapped={false} />
        </mesh>
      </group>

      {/* ceiling neon strips */}
      {[-5.5, -1.8, 1.8, 5.5].map((z, i) => (
        <mesh key={z} position={[0, 8.85, z]}>
          <boxGeometry args={[21, 0.12, 0.38]} />
          <meshStandardMaterial
            ref={i === 0 ? neon : undefined}
            color={i % 2 ? "#7df9ff" : "#22d3ee"}
            emissive={i % 2 ? "#7df9ff" : "#22d3ee"}
            emissiveIntensity={1.0}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* floor walkway dashes */}
      {Array.from({ length: 13 }, (_, i) => (
        <mesh key={i} position={[2.3, 0.27, 7.4 - i * 1.15]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[0.22, 0.62]} />
          <meshStandardMaterial color="#e8b84a" emissive="#e8b84a" emissiveIntensity={0.12} roughness={0.7} />
        </mesh>
      ))}
      {/* rack safety box */}
      {[
        [10.1, -7.0, 3.6, 0.14],
        [10.1, -3.4, 3.6, 0.14],
        [8.35, -5.2, 0.14, 3.6],
        [13.4, -5.2, 0.14, 3.6],
      ].map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, 0.28, z]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[w, d]} />
          <meshStandardMaterial color="#e8b84a" emissive="#e8b84a" emissiveIntensity={0.12} roughness={0.7} />
        </mesh>
      ))}

      <ServerRack position={[10.2, 0.25, -6.6]} rotationY={Math.PI} />
      <Lounge />

      {/* pods — face-to-face benches */}
      {AGENTS.map((a) => {
        const faceDir: 1 | -1 = a.deskYaw === 0 ? -1 : 1;
        const deskZ = a.desk[1] + (faceDir === -1 ? 1.2 : -1.2);
        return (
          <Pod
            key={a.id}
            x={a.desk[0]}
            z={deskZ}
            faceDir={faceDir}
            accent={a.color}
            variant={AGENTS.indexOf(a) * 2}
          />
        );
      })}
    </group>
  );
}

function WallScreen({ variant, accent }: { variant: number; accent: string }) {
  const tex = useMemo(() => screenTexture(variant, accent, 0), [variant, accent]);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const acc = useRef(0);
  useFrame((_, delta) => {
    acc.current += delta;
    if (acc.current > 0.35) {
      acc.current = 0;
      redrawScreen(tex, variant, accent, performance.now() / 1000);
    }
    if (mat.current) {
      const { hour } = useHqStore.getState();
      mat.current.emissiveIntensity = isOnShift(hour) ? 1.1 : 0.22;
    }
  });
  return (
    <mesh position={[0, 0, 0.08]}>
      <planeGeometry args={[3.35, 1.85]} />
      <meshStandardMaterial ref={mat} map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={1.1} toneMapped={false} />
    </mesh>
  );
}

/* ---------------------------------- vehicles ---------------------------------- */

function Wheel({ position }: { position: [number, number, number] }) {
  return (
    <group position={position} rotation-z={Math.PI / 2}>
      <mesh castShadow>
        <cylinderGeometry args={[0.36, 0.36, 0.24, 18]} />
        <meshStandardMaterial color="#15181e" roughness={0.85} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[0.2, 0.2, 0.26, 12]} />
        <meshStandardMaterial color="#aab3c0" metalness={0.75} roughness={0.35} />
      </mesh>
    </group>
  );
}

function VehicleBody({ kind, color }: { kind: VehicleInfo["kind"]; color: string }) {
  const paint = (c: string) => (
    <meshStandardMaterial color={c} metalness={0.65} roughness={0.32} />
  );
  const glass = <meshStandardMaterial color="#0e1522" metalness={0.4} roughness={0.18} />;

  if (kind === "scooter") {
    return (
      <group>
        <mesh position={[0, 0.42, 0]} rotation-x={0.12} castShadow>
          <boxGeometry args={[0.28, 0.3, 1.5]} />
          {paint(color)}
        </mesh>
        <mesh position={[0, 0.62, -0.18]} castShadow>
          <boxGeometry args={[0.32, 0.14, 0.62]} />
          <meshStandardMaterial color="#1c212b" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.85, 0.55]} rotation-x={-0.35} castShadow>
          <boxGeometry args={[0.16, 0.55, 0.16]} />
          {paint(color)}
        </mesh>
        <mesh position={[0, 1.12, 0.62]} rotation-x={-0.35}>
          <boxGeometry args={[0.72, 0.07, 0.07]} />
          <meshStandardMaterial color="#20262f" metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh position={[0, 1.0, 0.78]}>
          <sphereGeometry args={[0.12, 10, 8]} />
          <meshStandardMaterial color="#fff6d8" emissive="#ffe9a8" emissiveIntensity={0.9} />
        </mesh>
        <Wheel position={[-0.02, 0.32, 0.78]} />
        <Wheel position={[-0.02, 0.32, -0.72]} />
      </group>
    );
  }

  if (kind === "van") {
    return (
      <group>
        <mesh position={[0, 1.05, -0.15]} castShadow receiveShadow>
          <boxGeometry args={[1.92, 1.5, 4.5]} />
          {paint(color)}
        </mesh>
        <mesh position={[0, 1.62, 1.86]} rotation-x={0.42} castShadow>
          <boxGeometry args={[1.82, 0.95, 0.22]} />
          {glass}
        </mesh>
        <mesh position={[0, 1.35, 2.28]} castShadow>
          <boxGeometry args={[1.86, 0.7, 0.42]} />
          {paint(color)}
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.94, 1.55, 0.4]} castShadow>
            <boxGeometry args={[0.06, 0.62, 1.1]} />
            {glass}
          </mesh>
        ))}
        <mesh position={[0, 1.2, 2.52]}>
          <boxGeometry args={[1.5, 0.18, 0.1]} />
          <meshStandardMaterial color="#fff3d0" emissive="#ffe9a8" emissiveIntensity={0.85} />
        </mesh>
        <mesh position={[0, 1.25, -2.42]}>
          <boxGeometry args={[1.55, 0.22, 0.1]} />
          <meshStandardMaterial color="#ff5a4d" emissive="#ff3b2f" emissiveIntensity={0.85} />
        </mesh>
        {[-0.88, 0.88].map((x) =>
          [1.42, -1.55].map((z) => <Wheel key={`${x}${z}`} position={[x, 0.4, z]} />),
        )}
        <mesh position={[0, 1.95, -0.4]}>
          <boxGeometry args={[1.2, 0.16, 1.6]} />
          <meshStandardMaterial color="#243040" roughness={0.6} metalness={0.3} />
        </mesh>
      </group>
    );
  }

  if (kind === "pickup") {
    return (
      <group>
        <mesh position={[0, 0.82, -0.1]} castShadow receiveShadow>
          <boxGeometry args={[1.9, 0.62, 4.7]} />
          {paint(color)}
        </mesh>
        <mesh position={[0, 1.42, -1.15]} castShadow>
          <boxGeometry args={[1.82, 0.95, 1.9]} />
          {paint(color)}
        </mesh>
        <mesh position={[0, 1.58, -0.12]} rotation-x={0.28}>
          <boxGeometry args={[1.74, 0.82, 0.16]} />
          {glass}
        </mesh>
        <mesh position={[0, 1.08, 1.62]} castShadow>
          <boxGeometry args={[1.82, 0.5, 1.35]} />
          {paint(color)}
        </mesh>
        <mesh position={[0, 1.28, 1.62]} castShadow>
          <boxGeometry args={[1.7, 0.12, 1.25]} />
          <meshStandardMaterial color="#20262f" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.95, 2.34]}>
          <boxGeometry args={[1.5, 0.18, 0.1]} />
          <meshStandardMaterial color="#fff3d0" emissive="#ffe9a8" emissiveIntensity={0.85} />
        </mesh>
        <mesh position={[0, 1.05, -2.38]}>
          <boxGeometry args={[1.55, 0.2, 0.1]} />
          <meshStandardMaterial color="#ff5a4d" emissive="#ff3b2f" emissiveIntensity={0.85} />
        </mesh>
        {[-0.92, 0.92].map((x) =>
          [1.55, -1.55].map((z) => <Wheel key={`${x}${z}`} position={[x, 0.42, z]} />),
        )}
      </group>
    );
  }

  // sedan + hatch share the base, hatch is shorter with a steeper tail
  const hatch = kind === "hatch";
  const len = hatch ? 3.9 : 4.5;
  return (
    <group>
      <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.86, 0.56, len]} />
        {paint(color)}
      </mesh>
      <mesh position={[0, 1.22, hatch ? -0.15 : -0.25]} castShadow>
        <boxGeometry args={[1.7, 0.62, hatch ? 2.3 : 2.5]} />
        {paint(color)}
      </mesh>
      <mesh position={[0, 1.32, hatch ? 0.62 : 0.72]} rotation-x={0.62}>
        <boxGeometry args={[1.62, 0.78, 0.14]} />
        {glass}
      </mesh>
      <mesh position={[0, 1.36, hatch ? -1.02 : -1.12]} rotation-x={hatch ? -0.95 : -0.72}>
        <boxGeometry args={[1.62, 0.8, 0.14]} />
        {glass}
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.86, 1.28, -0.2]} castShadow>
          <boxGeometry args={[0.05, 0.5, 1.35]} />
          {glass}
        </mesh>
      ))}
      <mesh position={[0, 0.88, len / 2 - 0.02]}>
        <boxGeometry args={[1.55, 0.16, 0.1]} />
        <meshStandardMaterial color="#fff3d0" emissive="#ffe9a8" emissiveIntensity={0.85} />
      </mesh>
      <mesh position={[0, 0.95, -len / 2 + 0.02]}>
        <boxGeometry args={[1.6, 0.18, 0.1]} />
        <meshStandardMaterial color="#ff5a4d" emissive="#ff3b2f" emissiveIntensity={0.85} />
      </mesh>
      <mesh position={[0, 0.62, len / 2 + 0.015]}>
        <boxGeometry args={[0.62, 0.18, 0.03]} />
        <meshStandardMaterial color="#e9edf3" roughness={0.5} />
      </mesh>
      {[-0.9, 0.9].map((x) =>
        [len / 2 - 1.05, -len / 2 + 1.05].map((z) => <Wheel key={`${x}${z}`} position={[x, 0.38, z]} />),
      )}
    </group>
  );
}

function Vehicle({ info }: { info: VehicleInfo }) {
  const group = useRef<THREE.Group>(null);
  const select = useHqStore((s) => s.select);
  const selected = useHqStore((s) => s.selection?.kind === "vehicle" && s.selection.id === info.id);

  return (
    <group
      ref={group}
      position={[info.pos[0], 0.25, info.pos[1]]}
      rotation-y={info.yaw}
      onClick={(e) => {
        e.stopPropagation();
        select({ kind: "vehicle", id: info.id });
      }}
      onPointerOver={(e) => hoverCursor(e, true)}
      onPointerOut={(e) => hoverCursor(e, false)}
    >
      <VehicleBody kind={info.kind} color={info.color} />
      {/* selection glow under vehicle */}
      <mesh position={[0, 0.02, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[2.15, 2.35, 32]} />
        <meshBasicMaterial
          color={selected ? "#22d3ee" : "#ffffff"}
          transparent
          opacity={selected ? 0.85 : 0.0}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/* ---------------------------------- exterior props ---------------------------------- */

function StreetLamp({ position }: { position: [number, number, number] }) {
  const light = useRef<THREE.PointLight>(null);
  const head = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    const { night } = dayFactors(useHqStore.getState().hour);
    if (light.current) light.current.intensity = night * 26;
    if (head.current) head.current.emissiveIntensity = 0.3 + night * 2.2;
  });
  return (
    <group position={position}>
      <mesh position={[0, 2.8, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.13, 5.6, 10]} />
        <meshStandardMaterial color="#2c3442" metalness={0.6} roughness={0.45} />
      </mesh>
      <mesh position={[0.75, 5.55, 0]} rotation-z={-Math.PI / 12} castShadow>
        <boxGeometry args={[1.6, 0.12, 0.12]} />
        <meshStandardMaterial color="#2c3442" metalness={0.6} roughness={0.45} />
      </mesh>
      <mesh position={[1.5, 5.38, 0]}>
        <boxGeometry args={[0.55, 0.16, 0.32]} />
        <meshStandardMaterial ref={head} color="#ffe9a8" emissive="#ffdf8e" emissiveIntensity={0.4} toneMapped={false} />
      </mesh>
      <pointLight ref={light} position={[1.5, 5.2, 0]} color="#ffd98c" distance={22} decay={2} intensity={0} />
    </group>
  );
}

function Tree({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 1.1, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.26, 2.2, 8]} />
        <meshStandardMaterial color="#6b4a30" roughness={0.9} />
      </mesh>
      {[
        [0, 2.8, 0, 1.25],
        [0.75, 2.35, 0.4, 0.9],
        [-0.7, 2.4, -0.35, 0.85],
        [0.15, 3.5, -0.3, 0.8],
      ].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} castShadow>
          <icosahedronGeometry args={[r, 1]} />
          <meshStandardMaterial color={i % 2 ? "#2f8f57" : "#3aa765"} roughness={0.85} flatShading />
        </mesh>
      ))}
    </group>
  );
}

function ExteriorProps() {
  return (
    <group>
      {/* bollards */}
      {[-7.2, -6.3, 6.3, 7.2].map((x) => (
        <mesh key={x} position={[x, 0.55, 9.1]} castShadow>
          <cylinderGeometry args={[0.12, 0.12, 1.1, 10]} />
          <meshStandardMaterial color="#e8b84a" roughness={0.55} />
        </mesh>
      ))}
      {/* fence along the lot front */}
      {Array.from({ length: 8 }, (_, i) => -18 + i * 5.6).map((x) => (
        <mesh key={x} position={[x, 1.05, 23.6]} castShadow>
          <boxGeometry args={[0.16, 2.1, 0.16]} />
          <meshStandardMaterial color="#39424f" metalness={0.55} roughness={0.5} />
        </mesh>
      ))}
      {[0.75, 1.55].map((y) => (
        <mesh key={y} position={[1.6, y, 23.6]} castShadow>
          <boxGeometry args={[42, 0.09, 0.09]} />
          <meshStandardMaterial color="#4a5462" metalness={0.55} roughness={0.5} />
        </mesh>
      ))}
      {/* dumpster */}
      <group position={[-16.5, 0, -2.5]} rotation-y={0.35}>
        <mesh position={[0, 0.85, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.6, 1.5, 1.6]} />
          <meshStandardMaterial color="#2f7a4e" roughness={0.7} metalness={0.35} />
        </mesh>
        <mesh position={[0, 1.68, 0]} rotation-x={-0.18} castShadow>
          <boxGeometry args={[2.7, 0.14, 1.7]} />
          <meshStandardMaterial color="#25623e" roughness={0.7} metalness={0.35} />
        </mesh>
      </group>
      {/* pallets */}
      {[-1.3, 0, 1.3].map((dx, i) => (
        <mesh key={i} position={[16.4 + dx, 0.32 + i * 0.02, -2.2]} castShadow receiveShadow>
          <boxGeometry args={[1.15, 0.16, 1.15]} />
          <meshStandardMaterial color="#a3825c" roughness={0.85} />
        </mesh>
      ))}
      <Tree position={[-19.5, 0, 8]} scale={1.15} />
      <Tree position={[23, 0, 9]} />
      <Tree position={[-18, 0, 21]} />
      <Tree position={[23.5, 0, 21]} scale={1.1} />
      <StreetLamp position={[-14, 0, 21.5]} />
      <StreetLamp position={[16.5, 0, 21.5]} />
      <StreetLamp position={[19.5, 0, 8.5]} />
    </group>
  );
}

/* ---------------------------------- assembled world ---------------------------------- */

export function World() {
  return (
    <group>
      <Ground />
      <Warehouse />
      <InteriorProps />
      <ExteriorProps />
      {VEHICLES.map((v) => (
        <Vehicle key={v.id} info={v} />
      ))}
    </group>
  );
}
