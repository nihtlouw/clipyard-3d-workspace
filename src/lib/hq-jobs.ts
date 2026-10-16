/**
 * CLIPYARD floor — job data contract.
 *
 * This is the agreement between the outside world (n8n, a DB-backed API,
 * or the built-in mock simulator) and the diorama. Whatever produces the
 * data must emit a `FloorSnapshot` shaped exactly like this over HTTP JSON.
 *
 *   GET {VITE_FLOOR_URL}  →  FloorSnapshot
 *
 * The diorama polls that URL every ~2s (10s when the tab is hidden) when
 * VITE_FLOOR_URL is set; otherwise a mock simulator drives the same store.
 */
import type { AgentId } from "@/lib/hq-data";

export type JobStatus = "queued" | "running" | "done" | "failed";

/** One unit of real (or simulated) clip-factory work for one agent. */
export interface ClipJob {
  /** stable id, e.g. "job_20261017_0042" or an n8n execution id */
  jobId: string;
  /** which hoodie owns it — maps 1:1 to the diorama mascots */
  agentId: AgentId;
  /** short human label shown on cards / whiteboard, e.g. "EP214 → 4 clips" */
  title: string;
  status: JobStatus;
  /** 0..1 (0 for queued) */
  progress: number;
  /** epoch ms of the last update */
  updatedAt: number;
}

export interface FloorStats {
  clipsShipped: number;
  renderQueue: number;
  avgClipSec: number;
  channelsFed: number;
}

/** The full payload the diorama understands. */
export interface FloorSnapshot {
  /** epoch ms when the producer built this snapshot */
  ts: number;
  /** who produced it: the built-in simulator or a live pipeline */
  source: "sim" | "live";
  /** latest job per agent (a few jobs back is fine — see currentJobFor) */
  jobs: ClipJob[];
  stats: FloorStats;
}

const AGENT_IDS: AgentId[] = ["akira", "nova", "hook", "lexa", "pixel", "bolt"];
const STATUSES: JobStatus[] = ["queued", "running", "done", "failed"];

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Defensive parsing for real-world payloads. Accepts anything, returns a
 * clean snapshot or null when the shape is unusable — the diorama never
 * crashes on a bad producer.
 */
export function sanitizeSnapshot(raw: unknown, source: "sim" | "live"): FloorSnapshot | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.jobs)) return null;

  const jobs: ClipJob[] = [];
  for (const item of obj.jobs) {
    if (typeof item !== "object" || item === null) continue;
    const j = item as Record<string, unknown>;
    const agentId = j.agentId as AgentId;
    const status = j.status as JobStatus;
    if (!AGENT_IDS.includes(agentId) || !STATUSES.includes(status)) continue;
    jobs.push({
      jobId: typeof j.jobId === "string" && j.jobId ? j.jobId : `job_${jobs.length}`,
      agentId,
      title: typeof j.title === "string" && j.title ? j.title.slice(0, 80) : "Working…",
      status,
      progress: clamp01(typeof j.progress === "number" && Number.isFinite(j.progress) ? j.progress : 0),
      updatedAt: typeof j.updatedAt === "number" && Number.isFinite(j.updatedAt) ? j.updatedAt : Date.now(),
    });
  }
  if (jobs.length === 0) return null;

  const num = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;

  return {
    ts: num(obj.ts, Date.now()),
    source,
    jobs,
    stats: {
      clipsShipped: Math.max(0, Math.floor(num((obj.stats as FloorStats | undefined)?.clipsShipped, 0))),
      renderQueue: Math.max(0, Math.floor(num((obj.stats as FloorStats | undefined)?.renderQueue, 0))),
      avgClipSec: Math.max(1, num((obj.stats as FloorStats | undefined)?.avgClipSec, 42)),
      channelsFed: Math.max(0, Math.floor(num((obj.stats as FloorStats | undefined)?.channelsFed, 0))),
    },
  };
}

/**
 * The job a given agent should show right now: the running one, else the
 * next queued one, else the most recent failure, else the last finish.
 */
export function currentJobFor(agentId: AgentId, jobs: ClipJob[]): ClipJob | undefined {
  const mine = jobs.filter((j) => j.agentId === agentId);
  const byNewest = (a: ClipJob, b: ClipJob) => b.updatedAt - a.updatedAt;
  return (
    mine.find((j) => j.status === "running") ??
    mine.find((j) => j.status === "queued") ??
    mine.filter((j) => j.status === "failed").sort(byNewest)[0] ??
    mine.filter((j) => j.status === "done").sort(byNewest)[0]
  );
}
