/**
 * CLIPYARD crew — white robots with agent-color accents (reference redesign).
 * Glossy white shell, dark visor with glowing eyes, colored ear caps / neck
 * ring / antenna ball / chest light so each agent stays identifiable from
 * every angle. Movement states: desk pods (on shift) → glass meeting room
 * (13:00 standup) → glass rest room (off shift). Routes go through the real
 * glass doors via a small waypoint queue.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { AGENTS, MEETING_SEATS, ROOM, type AgentInfo } from "@/lib/hq-data";
import { agentActivity } from "@/lib/hq-profiles";
import { createNameplate } from "@/lib/hq-textures";
import { currentJobFor } from "@/lib/hq-jobs";
import { robotPoses, type RobotPose } from "@/lib/hq-robots";
import { isMeeting, isOnShift, useHqStore } from "@/lib/hq-store";

function hoverCursor(e: ThreeEvent<PointerEvent>, on: boolean) {
  e.stopPropagation();
  document.body.style.cursor = on ? "pointer" : "auto";
}

/* ---------------------------------- glass-door routing ---------------------------------- */

type Zone = "open" | "meeting" | "lounge";

function zoneOf(x: number, z: number): Zone {
  if (x < ROOM.GLASS_X - 0.05) return "open";
  return z < ROOM.PARTITION_Z ? "meeting" : "lounge";
}

function doorZ(zone: Zone) {
  return zone === "meeting" ? ROOM.MEETING_DOOR_Z : ROOM.LOUNGE_DOOR_Z;
}

/** Waypoints from (x,z) to the target, detouring through the glass doors. */
function buildRoute(x: number, z: number, tx: number, tz: number): Array<[number, number]> {
  const from = zoneOf(x, z);
  const to = zoneOf(tx, tz);
  if (from === to) return [[tx, tz]];
  const steps: Array<[number, number]> = [];
  if (from !== "open") {
    steps.push([ROOM.GLASS_X + 0.85, doorZ(from)], [ROOM.GLASS_X - 0.85, doorZ(from)]);
  }
  if (to !== "open") {
    steps.push([ROOM.GLASS_X - 0.85, doorZ(to)], [ROOM.GLASS_X + 0.85, doorZ(to)]);
  }
  steps.push([tx, tz]);
  return steps;
}

/* ---------------------------------- one robot ---------------------------------- */

function Robot({ info, index }: { info: AgentInfo; index: number }) {
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const ringMesh = useRef<THREE.Mesh>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);
  const plateMat = useRef<THREE.SpriteMaterial>(null);
  const plateSprite = useRef<THREE.Sprite>(null);
  const [hover, setHover] = useState(false);

  const select = useHqStore((s) => s.select);
  const labels = useHqStore((s) => s.labels);
  const selected = useHqStore((s) => s.selection?.kind === "agent" && s.selection.id === info.id);
  // Fase 6: the robot's visible identity follows the editable profile
  const profile = useHqStore((s) => s.profiles[info.id]);

  const nameplate = useMemo(
    () => createNameplate(info.name, info.color),
    // created once per robot; identity updates go through setIdentity below
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [info.id],
  );
  useEffect(() => {
    if (profile) nameplate.setIdentity(profile.name, profile.color);
  }, [nameplate, profile]);
  const phase = useMemo(() => index * 1.73, [index]);
  const speed = useMemo(() => 1.5 + ((index * 53) % 9) / 14, [index]); // per-agent pace → the pack spreads out
  const route = useRef<Array<[number, number]>>([]);
  const routeKey = useRef("");
  const baseY = useRef(ROOM.SEAT_Y);
  const plateText = useRef("");

  const seatPos = MEETING_SEATS[index];

  // Fase 8: publish the live transform for the POV camera + focus rig
  const pose = useMemo<RobotPose>(
    () => ({ x: info.desk[0], y: ROOM.SEAT_Y, z: info.desk[1], yaw: info.deskYaw, walking: false }),
    [info],
  );
  useEffect(() => {
    robotPoses.set(info.id, pose);
    return () => {
      robotPoses.delete(info.id);
    };
  }, [info.id, pose]);

  useFrame((state, delta) => {
    const d = Math.min(delta, 0.1);
    const st = useHqStore.getState();
    const hour = st.hour;
    const t = state.clock.elapsedTime;
    const job = currentJobFor(info.id, st.jobs);
    const failed = job?.status === "failed";
    const waitingOk = st.approvals.some((ap) => ap.agentId === info.id);
    // Fase 7: demo choreography follows the office clock; otherwise the
    // robot's placement mirrors its real work state (desk = working,
    // meeting room = waiting for the owner, lounge = idle/paused/off).
    const demo = st.demoShift;
    const act = profile ? agentActivity(profile, job, waitingOk, hour) : null;
    const on = demo
      ? isOnShift(hour)
      : act !== null && (act.kind === "kerja" || act.kind === "antre" || act.kind === "minta-ok" || act.kind === "gagal");
    const meeting = demo ? on && isMeeting(hour) : act?.kind === "minta-ok";

    // ---- destination + status text ----
    let px: number, py: number, pz: number, yaw: number, statusText: string, key: string;
    if (meeting) {
      px = seatPos.pos[0]; pz = seatPos.pos[1]; py = ROOM.SEAT_Y; yaw = seatPos.yaw;
      statusText = demo ? "standup" : "minta OK"; key = "meeting";
    } else if (on) {
      px = info.desk[0]; pz = info.desk[1]; py = ROOM.SEAT_Y; yaw = info.deskYaw;
      statusText = failed ? "error!" : waitingOk ? "minta OK" : job?.status === "queued" ? "nunggu tugas" : info.verb;
      key = "desk";
    } else {
      px = info.lounge[0]; pz = info.lounge[1]; py = info.loungeY; yaw = info.loungeYaw;
      statusText = demo
        ? failed ? "ngisi token…" : "rehat"
        : act?.kind === "nonaktif" ? "off"
          : act?.kind === "dijeda" ? "di luar jadwal"
            : failed ? "ngisi token…" : "santai";
      key = "lounge";
    }

    const g = group.current;
    if (!g) return;

    // rebuild the route only when the destination state flips
    if (routeKey.current !== key) {
      routeKey.current = key;
      route.current = buildRoute(g.position.x, g.position.z, px, pz);
    }

    // walk the waypoint queue
    const wp = route.current[0];
    const distFinal = Math.hypot(px - g.position.x, pz - g.position.z);
    let walking = false;
    let faceYaw = yaw;
    if (wp) {
      const distWp = Math.hypot(wp[0] - g.position.x, wp[1] - g.position.z);
      if (distWp < 0.32) {
        route.current.shift();
      } else {
        walking = true;
        faceYaw = Math.atan2(wp[0] - g.position.x, wp[1] - g.position.z);
        const k = 1 - Math.exp(-d * 1.15 * speed);
        g.position.x += (wp[0] - g.position.x) * k;
        g.position.z += (wp[1] - g.position.z) * k;
      }
    }
    const arrived = !wp && distFinal < 0.05;
    if (!walking && distFinal >= 0.05 && route.current.length === 0) {
      // drifted off (e.g. first frame) — settle straight to the spot
      const k = 1 - Math.exp(-d * 2.2 * speed);
      g.position.x += (px - g.position.x) * k;
      g.position.z += (pz - g.position.z) * k;
      walking = distFinal > 0.3;
      if (walking) faceYaw = Math.atan2(px - g.position.x, pz - g.position.z);
    }

    const cur = g.rotation.y;
    const diff = ((faceYaw - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    g.rotation.y = cur + diff * (1 - Math.exp(-d * 3.2));

    // seat height only once arrived; walk on the floor otherwise
    const goalY = arrived || (!walking && route.current.length === 0) ? py : 0;
    baseY.current += (goalY - baseY.current) * (1 - Math.exp(-d * 5));
    const bob = Math.sin(t * 1.8 + phase) * 0.015;
    const hop = walking ? Math.abs(Math.sin(t * 10 + phase)) * 0.09 : 0;
    g.position.y = baseY.current + bob + hop;
    g.rotation.z = walking ? Math.sin(t * 10 + phase) * 0.07 : 0;
    if (ringMesh.current) ringMesh.current.position.y = 0.02 - g.position.y; // keep the ring on the floor

    pose.x = g.position.x;
    pose.y = g.position.y;
    pose.z = g.position.z;
    pose.yaw = g.rotation.y;
    pose.walking = walking;

    if (body.current) {
      const s = 1 + Math.sin(t * 2.1 + phase) * 0.01 + (walking ? Math.sin(t * 20) * 0.015 : 0);
      body.current.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));
    }
    if (head.current) {
      head.current.rotation.z = Math.sin(t * 0.8 + phase) * 0.05 + (hover || selected ? Math.sin(t * 2.4) * 0.06 : 0);
      head.current.rotation.y = (hover || selected ? Math.sin(t * 1.6) * 0.12 : 0) + (walking ? Math.sin(t * 10) * 0.05 : 0);
      // little nod while typing
      head.current.rotation.x = on && !walking && !meeting ? 0.16 + Math.sin(t * 4.2 + phase) * 0.03 : 0.02;
    }
    if (eyes.current) {
      const blink = Math.sin(t * 0.9 + phase * 2.3) > 0.985 ? 0.12 : 1;
      eyes.current.scale.y += (blink - eyes.current.scale.y) * 0.5;
    }
    const typing = on && !walking && !meeting ? Math.sin(t * 9 + phase) * 0.2 : Math.sin(t * 1.2 + phase) * 0.05;
    const swing = walking ? Math.sin(t * 10 + phase) * 0.4 : 0;
    if (leftArm.current) leftArm.current.rotation.x = -0.7 + typing + swing;
    if (rightArm.current) rightArm.current.rotation.x = -0.7 - typing - swing;

    if (ringMat.current) {
      ringMat.current.opacity = (selected ? 0.95 : hover ? 0.55 : 0.22) * (on ? 1 : 0.6);
      const c = failed ? "#fb3b5c" : waitingOk ? "#f59e0b" : (profile?.color ?? info.color);
      if (ringMat.current.color.getHexString() !== c.slice(1)) ringMat.current.color.set(c);
    }

    if (plateMat.current && plateSprite.current) {
      // never show our own nameplate while the camera rides this robot's head
      plateSprite.current.visible = (labels || selected || hover) && st.povAgent !== info.id;
      if (plateText.current !== statusText) {
        plateText.current = statusText;
        nameplate.redraw(statusText);
      }
      const cam = state.camera as THREE.OrthographicCamera;
      // POV uses a perspective camera: keep plates modest so they don't
      // swallow the frame when the host robot walks past a colleague
      const w = st.povAgent ? 0.95 : Math.min(2.7, (2.5 * 36) / (cam.zoom || 36));
      plateSprite.current.scale.set(w, w * 0.233, 1);
    }
  });

  const accent = profile?.color ?? info.color;

  return (
    <group
      ref={group}
      position={[info.desk[0], ROOM.SEAT_Y, info.desk[1]]}
      rotation-y={info.deskYaw}
      onClick={(e) => { e.stopPropagation(); select({ kind: "agent", id: info.id }); }}
      onPointerOver={(e) => { hoverCursor(e, true); setHover(true); }}
      onPointerOut={(e) => { hoverCursor(e, false); setHover(false); }}
    >
      <mesh ref={ringMesh} position={[0, 0.02 - ROOM.SEAT_Y, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.36, 0.45, 32]} />
        <meshBasicMaterial ref={ringMat} color={accent} transparent opacity={0.22} depthWrite={false} toneMapped={false} />
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

        {/* glossy white body */}
        <mesh position={[0, 0.52, 0]} scale={[1, 1.02, 0.88]} castShadow>
          <capsuleGeometry args={[0.26, 0.22, 8, 18]} />
          <meshStandardMaterial color="#ffffff" roughness={0.38} />
        </mesh>
        {/* chest panel + glowing core in the agent color */}
        <mesh position={[0, 0.52, 0.215]} rotation-x={0.12}>
          <boxGeometry args={[0.2, 0.24, 0.05]} />
          <meshStandardMaterial color="#232838" roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.56, 0.245]}>
          <circleGeometry args={[0.045, 14]} />
          <meshBasicMaterial color={accent} toneMapped={false} />
        </mesh>
        {/* neck ring (identifies the agent from behind) */}
        <mesh position={[0, 0.79, 0]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.15, 0.042, 10, 22]} />
          <meshStandardMaterial color={accent} roughness={0.55} />
        </mesh>

        {/* head: white helmet + dark visor + glowing eyes */}
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
          {/* ear caps + antenna */}
          {[-0.265, 0.265].map((x) => (
            <mesh key={x} position={[x, 0, 0]} rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[0.07, 0.07, 0.055, 12]} />
              <meshStandardMaterial color={accent} roughness={0.5} />
            </mesh>
          ))}
          <mesh position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.014, 0.014, 0.12, 6]} />
            <meshStandardMaterial color="#9aa0ae" roughness={0.4} metalness={0.5} />
          </mesh>
          <mesh position={[0, 0.39, 0]}>
            <sphereGeometry args={[0.042, 10, 8]} />
            <meshBasicMaterial color={accent} toneMapped={false} />
          </mesh>
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

      <sprite ref={plateSprite} position={[0, 1.62, 0]} scale={[2.5, 0.58, 1]}>
        <spriteMaterial ref={plateMat} map={nameplate.tex} transparent depthWrite={false} />
      </sprite>

      {/* generous invisible hit area (robots are small + partly behind chairs) */}
      <mesh
        position={[0, 0.75, 0]}
        visible={false}
        onClick={(e) => { e.stopPropagation(); select({ kind: "agent", id: info.id }); }}
        onPointerOver={(e) => { hoverCursor(e, true); setHover(true); }}
        onPointerOut={(e) => { hoverCursor(e, false); setHover(false); }}
      >
        <cylinderGeometry args={[0.48, 0.48, 1.6, 10]} />
      </mesh>
    </group>
  );
}

export function Agents() {
  return (
    <group>
      {AGENTS.map((a, i) => (
        <Robot key={a.id} info={a} index={i} />
      ))}
    </group>
  );
}
