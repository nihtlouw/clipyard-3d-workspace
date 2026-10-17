import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { AdaptiveDpr, PerformanceMonitor } from "@react-three/drei";
import { attachFloorSource, createDefaultFloorSource } from "@/lib/hq-floor";
import { useHqStore } from "@/lib/hq-store";
import { Agents } from "./agents";
import { HqHud } from "./hud";
import { CameraControls, CameraRig, ClockDriver, StudioLighting, ResponsiveZoom } from "./sky";
import { World } from "./world";

function Scene() {
  const controls = useRef<any>(null);
  return (
    <>
      <StudioLighting />
      <ClockDriver />
      <World />
      <Agents />
      <CameraControls controls={controls} />
      <CameraRig controls={controls} />
      <ResponsiveZoom />
    </>
  );
}

export function HqExperience() {
  const [mounted, setMounted] = useState(false);
  const [degraded, setDegraded] = useState(false);
  const select = useHqStore((s) => s.select);

  // WebGL + canvas textures need the browser
  useEffect(() => setMounted(true), []);

  // Floor feed: mock simulator by default, live polling when VITE_FLOOR_URL is set
  useEffect(() => attachFloorSource(createDefaultFloorSource()), []);

  return (
    <div className="hq-stage fixed inset-0 overflow-hidden">
      {mounted && (
        <Canvas
          orthographic
          dpr={degraded ? 1 : [1, 1.75]}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          camera={{ position: [21, 18, 21], zoom: 30, near: 1, far: 160 }}
          onPointerMissed={() => select(null)}
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
