import type { AgentId } from "@/lib/hq-data";

/** Who the first-person camera can ride: any crew robot, or the boss (Fase 9). */
export type PovId = AgentId | "manager";

/**
 * Live character transforms, mutated in place every frame (agents.tsx for
 * the crew, boss.tsx for the manager avatar). Kept outside React/Zustand so
 * per-frame readers (POV camera rig, selection focus) never trigger renders.
 */
export interface RobotPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  /** look pitch in radians (positive = up) — 0 for crew robots; the seated
      boss publishes his slow head nod so the throne view breathes */
  pitch: number;
  walking: boolean;
}

export const robotPoses = new Map<PovId, RobotPose>();
