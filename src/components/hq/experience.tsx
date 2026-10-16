import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { useHqStore } from "@/lib/hq-store";
import { Agents } from "./agents";
import { HqHud } from "./hud";
import { CameraControls, CameraRig, ClockDriver, Sky } from "./sky";
import { World } from "./world";

function Scene() {
  const controls = useRef<any>(null);
  return (
    <>
      <Sky />
      <ClockDriver />
      <World />
      <Agents />
      <CameraControls controls={controls} />
      <CameraRig controls={controls} />
    </>
  );
}

export function HqExperience() {
  const [mounted, setMounted] = useState(false);
  const select = useHqStore((s) => s.select);

  // SSR-safe: WebGL + canvas textures need the browser
  useEffect(() => setMounted(true), []);

  return (
    <div className="fixed inset-0 overflow-hidden bg-hq-bg">
      {mounted && (
        <Canvas
          shadows
          dpr={[1, 2]}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          camera={{ position: [13.5, 10.5, 31], fov: 43, near: 0.1, far: 260 }}
          onPointerMissed={() => select(null)}
          onCreated={({ gl, scene }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.02;
            scene.fog = new THREE.Fog("#101c3a", 70, 190);
          }}
        >
          <Scene />
        </Canvas>
      )}
      <HqHud />
    </div>
  );
}
