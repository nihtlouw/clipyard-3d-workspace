import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { AdaptiveDpr, OrthographicCamera, PerformanceMonitor, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { initFloorFeed } from "@/lib/hq-floor";
import { useHqStore } from "@/lib/hq-store";
import { Agents } from "./agents";
import { BossAvatar } from "./boss";
import { HqHud } from "./hud";
import { CameraControls, CameraRig, ClockDriver, PovRig, START, StudioLighting, ResponsiveZoom } from "./sky";
import { World } from "./world";

function Scene() {
  const controls = useRef<any>(null);
  const povTarget = useHqStore((s) => s.povTarget);
  return (
    <>
      <StudioLighting />
      <ClockDriver />
      <World />
      <Agents />
      <BossAvatar />
      {/* Fase 8: isometric diorama cam ⇄ first-person robot cam */}
      <OrthographicCamera makeDefault={!povTarget} position={START.pos} zoom={START.zoom} near={1} far={160} />
      <PerspectiveCamera makeDefault={!!povTarget} fov={62} near={0.05} far={140} position={[0, 1.4, 0]} />
      {!povTarget ? (
        <>
          <CameraControls controls={controls} />
          <CameraRig controls={controls} />
          <ResponsiveZoom />
        </>
      ) : (
        <PovRig />
      )}
    </>
  );
}

export function HqExperience() {
  const [mounted, setMounted] = useState(false);
  const [degraded, setDegraded] = useState(false);
  const [, setReady] = useState(false);
  const select = useHqStore((s) => s.select);

  // WebGL + canvas textures need the browser
  useEffect(() => setMounted(true), []);

  // Floor feed is an app-wide singleton (see __root.tsx) — this is a no-op
  // safety net. Source follows the saved connector config (SIM or LIVE).
  useEffect(() => {
    initFloorFeed();
  }, []);

  // Dev-only handle for scripted visual QA (set sim hour, toggle mode, …)
  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __hq?: unknown }).__hq = useHqStore;
  }, []);

  return (
    <div className="hq-stage fixed inset-0 overflow-hidden">
      {/* warm halo behind the diorama + vignette (reference: dark void, glowing box) */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_62%_52%_at_50%_44%,rgba(255,180,94,0.13),transparent_62%),radial-gradient(ellipse_120%_100%_at_50%_50%,transparent_55%,rgba(2,4,12,0.55)_100%)]" />
      {mounted && (
        <Canvas
          orthographic
          shadows="soft"
          dpr={degraded ? 1 : [1, 1.75]}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.12,
          }}
          camera={{ position: START.pos, zoom: START.zoom, near: 1, far: 160 }}
          onPointerMissed={() => select(null)}
          onCreated={() => setReady(true)}
        >
          <PerformanceMonitor
            onDecline={() => setDegraded(true)}
            onIncline={() => setDegraded(false)}
          />
          <AdaptiveDpr pixelated={false} />
          <Scene />
        </Canvas>
      )}
      <HqHud />
    </div>
  );
}
