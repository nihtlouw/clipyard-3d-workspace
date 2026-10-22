import type { AgentId } from "@/lib/hq-data";

/**
 * Live robot transforms, mutated in place by agents.tsx every frame.
 * Kept outside React/Zustand so per-frame readers (POV camera rig,
 * selection focus) never trigger renders.
 */
export interface RobotPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  walking: boolean;
}

export const robotPoses = new Map<AgentId, RobotPose>();
