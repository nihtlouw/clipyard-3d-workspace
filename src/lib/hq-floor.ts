/**
 * CLIPYARD floor feed — pluggable producers behind one tiny interface.
 *
 *  - createMockSource(): a self-contained simulator with realistic job
 *    lifecycles (queue → running → done, occasional failures). Default when
 *    VITE_FLOOR_URL is not set, so the diorama stays alive with zero backend.
 *  - createHttpSource(url): polls a real endpoint that answers FloorSnapshot
 *    JSON (n8n / DB-backed API / a static file). Same shape, same store.
 *
 * Neither touches React: they just emit snapshots; `attachFloorSource`
 * forwards them into the zustand store.
 */
import type { AgentId } from "@/lib/hq-data";
import { STATS } from "@/lib/hq-data";
import {
  sanitizeSnapshot,
  type ApprovalRequest,
  type ClipJob,
  type FloorSnapshot,
  type FloorStats,
} from "@/lib/hq-jobs";
import { useHqStore } from "@/lib/hq-store";

export interface FloorSource {
  readonly kind: "sim" | "live";
  start(onSnapshot: (s: FloorSnapshot) => void): void;
  stop(): void;
}

/** Forwards a source into the store. Returns the disposer. */
export function attachFloorSource(source: FloorSource) {
  source.start((snapshot) => useHqStore.getState().applyFloorSnapshot(snapshot));
  return () => source.stop();
}

/** Picks the HTTP source when VITE_FLOOR_URL is configured, else the mock. */
export function createDefaultFloorSource(): FloorSource {
  const url = import.meta.env.VITE_FLOOR_URL as string | undefined;
  return url && url.trim() ? createHttpSource(url.trim()) : createMockSource();
}

/* ---------------------------------- mock simulator ---------------------------------- */

interface MockJobSpec {
  title: (ep: number) => string;
  clips: (rnd: () => number) => number;
}

const MOCK_SPECS: Record<AgentId, MockJobSpec> = {
  akira: {
    title: (ep) => `Routing EP${ep} → ${2 + Math.floor(Math.random() * 5)} clip queues`,
    clips: () => 0,
  },
  nova: {
    title: (ep) => `Silence-trim EP${ep} · ${18 + Math.floor(Math.random() * 40)} cuts`,
    clips: () => 0,
  },
  hook: {
    title: (ep) => `Drafting ${120 + Math.floor(Math.random() * 80)} hooks · EP${ep}`,
    clips: () => 0,
  },
  lexa: {
    title: (ep) => `Karaoke captions ID/EN · EP${ep}`,
    clips: () => 0,
  },
  pixel: {
    title: (ep) => `A/B testing ${6 + Math.floor(Math.random() * 10)} covers · EP${ep}`,
    clips: () => 0,
  },
  bolt: {
    title: (ep) => `Render & ship ${3 + Math.floor(Math.random() * 6)} clips · EP${ep}`,
    clips: (rnd) => 3 + Math.floor(rnd() * 6),
  },
};

interface MockAgentState {
  agentId: AgentId;
  job: ClipJob;
  phase: "queue" | "run";
  queueFor: number;
  runFor: number;
  elapsed: number;
  cooldownFor: number;
  episode: number;
  clips: number;
}

function spawnJob(agentId: AgentId, episode: number): MockAgentState {
  const rnd = Math.random;
  const spec = MOCK_SPECS[agentId];
  return {
    agentId,
    episode,
    phase: "queue",
    queueFor: 1.5 + rnd() * 3.5,
    runFor: 14 + rnd() * 26,
    elapsed: 0,
    cooldownFor: 0,
    clips: spec.clips(rnd),
    job: {
      jobId: `sim_${agentId}_${episode}`,
      agentId,
      title: spec.title(episode),
      status: "queued",
      progress: 0,
      updatedAt: Date.now(),
    },
  };
}

const INITIAL_EPISODE = 210 + Math.floor(Math.random() * 6);

function createMockSource(): FloorSource {
  const agents: MockAgentState[] = ["akira", "nova", "hook", "lexa", "pixel", "bolt"].map(
    (id, i) => {
      const s = spawnJob(id as AgentId, INITIAL_EPISODE - (i % 2));
      // stagger: some already running at boot so the floor looks alive
      if (i < 3) {
        s.phase = "run";
        s.elapsed = s.runFor * (0.2 + Math.random() * 0.5);
      }
      return s;
    },
  );

  const stats: FloorStats = {
    clipsShipped: STATS.clipsShipped,
    renderQueue: STATS.renderQueue,
    avgClipSec: STATS.avgClipSec,
    channelsFed: STATS.channelsFed,
  };

  const approvals: ApprovalRequest[] = [];
  const APPROVAL_TTL_MS = 90_000;

  function maybeSpawnApproval(a: MockAgentState, now: number) {
    // demo the human-in-the-loop inbox occasionally, even without n8n
    if ((a.agentId === "pixel" || a.agentId === "bolt") && Math.random() > 0.45) {
      const id = `sim-approval-${a.agentId}-${a.episode}`;
      if (!approvals.some((x) => x.id === id)) {
        approvals.push({
          id,
          agentId: a.agentId,
          title:
            a.agentId === "pixel"
              ? `Pilih cover final · EP${a.episode} (3 kandidat)`
              : `Setujui publish ${a.clips} clips · EP${a.episode}`,
          detail:
            a.agentId === "pixel"
              ? "Thumbnail sudah di-A/B test — pilih varian dengan CTR terbaik."
              : "Render selesai. Setujui untuk publish ke channel.",
          jobId: a.job.jobId,
          requestedAt: now,
        });
      }
    }
  }

  let timer: number | null = null;
  let stopped = true;
  let last = 0;

  function tick() {
    const now = Date.now();
    const dt = Math.min(3, (now - last) / 1000);
    last = now;
    let dirty = false;

    for (const a of agents) {
      a.elapsed += dt;
      const prevStatus = a.job.status;

      if (a.phase === "queue") {
        a.job.progress = 0;
        if (a.elapsed >= a.queueFor) {
          a.phase = "run";
          a.elapsed = 0;
          a.job.status = "running";
        }
      } else if (a.phase === "run") {
        if (a.job.status === "running") {
          const p = a.elapsed / a.runFor;
          if (p >= 1) {
            a.job.status = "done";
            a.job.progress = 1;
            if (a.agentId !== "bolt") stats.clipsShipped += a.clips;
            stats.renderQueue = Math.max(0, stats.renderQueue - (a.agentId === "bolt" ? 1 : 0));
            if (a.agentId === "akira" && Math.random() > 0.75) stats.channelsFed += 1;
            stats.avgClipSec = Math.round(38 + Math.random() * 10);
            maybeSpawnApproval(a, now);
          } else {
            // occasional mid-run failure (simulates render/LLM hiccups)
            if (Math.random() < 0.0016 && p > 0.25) {
              a.job.status = "failed";
            } else {
              a.job.progress = Math.min(0.98, p * (0.92 + Math.sin(now / 900 + a.elapsed) * 0.05));
              a.job.progress = Math.max(0.02, a.job.progress);
            }
          }
        } else if (a.job.status === "done" || a.job.status === "failed") {
          if (a.elapsed >= (a.job.status === "failed" ? 9 : 5)) {
            const next = spawnJob(a.agentId, a.episode + 1 + Math.floor(Math.random() * 2));
            if (a.agentId === "bolt") stats.renderQueue += 1;
            Object.assign(a, next);
          }
        }
      }

      if (a.job.status !== prevStatus || a.job.status === "running") {
        a.job.updatedAt = now;
        dirty = true;
      }
    }

    // drop approvals that waited too long (simulates a reviewer cleaning up)
    for (let i = approvals.length - 1; i >= 0; i--) {
      if (now - approvals[i].requestedAt > APPROVAL_TTL_MS) approvals.splice(i, 1);
    }

    if (dirty || approvals.length) {
      onSnapshot?.({
        ts: now,
        source: "sim",
        jobs: agents.map((a) => ({ ...a.job })),
        stats: { ...stats },
        approvals: approvals.map((a) => ({ ...a })),
      });
    }
  }

  let onSnapshot: ((s: FloorSnapshot) => void) | null = null;

  return {
    kind: "sim",
    start(emit) {
      onSnapshot = emit;
      if (!stopped) return;
      stopped = false;
      last = Date.now();
      timer = window.setInterval(tick, 1200);
      tick();
    },
    stop() {
      stopped = true;
      if (timer !== null) window.clearInterval(timer);
      timer = null;
      onSnapshot = null;
    },
  };
}

/* ---------------------------------- live HTTP source ---------------------------------- */

function createHttpSource(url: string): FloorSource {
  let timer: number | null = null;
  let stopped = true;
  let inFlight = false;

  async function poll(emit: (s: FloorSnapshot) => void) {
    if (inFlight || stopped) return;
    inFlight = true;
    try {
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: unknown = await res.json();
      const snapshot = sanitizeSnapshot(json, "live");
      if (snapshot) emit(snapshot);
      else console.warn("[hq-floor] ignored malformed snapshot from", url);
    } catch (err) {
      console.warn("[hq-floor] poll failed:", err instanceof Error ? err.message : err);
    } finally {
      inFlight = false;
    }
  }

  return {
    kind: "live",
    start(emit) {
      stopped = false;
      const loop = () => {
        if (stopped) return;
        void poll(emit);
        const hidden = typeof document !== "undefined" && document.hidden;
        timer = window.setTimeout(loop, hidden ? 10_000 : 2_000);
      };
      loop();
    },
    stop() {
      stopped = true;
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
    },
  };
}
