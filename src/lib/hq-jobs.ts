/**
 * CLIPYARD floor — job data contract (v1.1).
 *
 * This is the agreement between the outside world (n8n, a DB-backed API,
 * or the built-in mock simulator) and the diorama. Whatever produces the
 * data must emit a `FloorSnapshot` shaped exactly like this over HTTP JSON.
 *
 *   GET {VITE_FLOOR_URL}  →  FloorSnapshot
 *
 * v1.1 adds optional human-in-the-loop `approvals[]`: producers (n8n via the
 * Floor API, or the mock) can pause a stage and ask a human to decide. The
 * diorama renders an Approval Inbox — Setujui/Tolak buttons post the decision
 * straight back to the Floor API, which (optionally) callbacks into the
 * waiting n8n workflow.
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

/** A stage paused until a human approves/rejects (human-in-the-loop gate). */
export interface ApprovalRequest {
  /** stable id — deciding the same id twice is a no-op */
  id: string;
  agentId: AgentId;
  /** what is being asked, e.g. "Approve cover A/B/C · EP302" */
  title: string;
  /** optional context for the reviewer */
  detail?: string;
  /** related job — cleared automatically when that job moves again */
  jobId?: string;
  requestedAt: number;
}

export type ApprovalDecision = "approved" | "rejected";

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
  /** optional pending approvals (v1.1) */
  approvals?: ApprovalRequest[];
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

  // optional approvals (v1.1) — tolerated when absent or malformed
  const approvals: ApprovalRequest[] = [];
  if (Array.isArray(obj.approvals)) {
    for (const item of obj.approvals) {
      if (typeof item !== "object" || item === null) continue;
      const a = item as Record<string, unknown>;
      const agentId = a.agentId as AgentId;
      if (typeof a.id !== "string" || !a.id || !AGENT_IDS.includes(agentId)) continue;
      approvals.push({
        id: a.id,
        agentId,
        title: typeof a.title === "string" && a.title ? a.title.slice(0, 90) : "Perlu persetujuan",
        detail: typeof a.detail === "string" ? a.detail.slice(0, 160) : undefined,
        jobId: typeof a.jobId === "string" ? a.jobId : undefined,
        requestedAt:
          typeof a.requestedAt === "number" && Number.isFinite(a.requestedAt) ? a.requestedAt : Date.now(),
      });
    }
  }

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
    approvals: approvals.length ? approvals : undefined,
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
