/**
 * CLIPYARD Floor API — the real producer endpoint (Phase 2 + Phase 3).
 *
 * Zero-dependency Node server that owns the floor state and answers the
 * exact FloorSnapshot contract the diorama consumes (src/lib/hq-jobs.ts).
 * n8n workflows push job/status/approval updates here; the diorama polls.
 * Humans decide approvals inside the diorama's Approval Inbox; decisions
 * are optionally POSTed back to the workflow's callbackUrl (resume a
 * paused `Wait` node in n8n — no polling on the n8n side).
 *
 *   GET  /api/floor                    → FloorSnapshot (what the diorama polls)
 *   GET  /api/health                   → { ok, jobs, approvals, ts }
 *   POST /api/n8n/job                  → upsert one job          (token)
 *   POST /api/n8n/stats                → merge floor stats       (token)
 *   POST /api/n8n/approvals            → open an approval gate   (token)
 *   POST /api/approvals/:id/decision   → human decision (from the diorama UI;
 *                                        unauthenticated by design — only
 *                                        affects pending approvals; front it
 *                                        with auth in hostile environments)
 *   POST /api/n8n/reset                → reseed demo state       (token)
 *
 * Auth: header `X-Clipyard-Token: …` (or ?token=…), must equal
 * process.env.CLIPYARD_FLOOR_TOKEN (default "clipyard-dev-token" — change
 * it anywhere public).
 *
 * Persistence: set CLIPYARD_STATE_FILE=/path/state.json to survive restarts
 * (jobs + stats + pending approvals, debounced writes).
 *
 * Run: node server/floor-api.mjs   (0.0.0.0:8787)
 */
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname as dirOf } from "node:path";

const PORT = Number(process.env.PORT ?? 8787);
const HOST = "0.0.0.0";
const TOKEN = process.env.CLIPYARD_FLOOR_TOKEN ?? "clipyard-dev-token";
const STATE_FILE = process.env.CLIPYARD_STATE_FILE ?? "";
const MAX_JOBS = 200;
const BODY_LIMIT = 64 * 1024;
const CALLBACK_TIMEOUT_MS = 5000;

const AGENT_IDS = new Set(["akira", "nova", "hook", "lexa", "pixel", "bolt"]);
const STATUSES = new Set(["queued", "running", "done", "failed"]);

/** @type {Map<string, {jobId:string;agentId:string;title:string;status:string;progress:number;updatedAt:number}>} */
const jobs = new Map();
const stats = { clipsShipped: 1284, renderQueue: 3, avgClipSec: 42, channelsFed: 46 };
/** @type {Map<string, {id:string;agentId:string;title:string;detail?:string;jobId?:string;requestedAt:number;callbackUrl?:string}>} */
const approvals = new Map();
/** recent decisions (audit trail, bounded) */
const decisionLog = [];

let stateDirty = false;
function markDirty() {
  if (!STATE_FILE) return;
  stateDirty = true;
}
setInterval(() => {
  if (!STATE_FILE || !stateDirty) return;
  stateDirty = false;
  try {
    mkdirSync(dirOf(STATE_FILE) || ".", { recursive: true });
    writeFileSync(
      STATE_FILE,
      JSON.stringify({
        jobs: [...jobs.values()],
        stats,
        approvals: [...approvals.values()],
      }),
    );
  } catch (err) {
    console.warn("[floor-api] state save failed:", err.message);
  }
}, 1500).unref?.();

function loadState() {
  if (!STATE_FILE) {
    seed();
    return;
  }
  try {
    const raw = JSON.parse(readFileSync(STATE_FILE, "utf8"));
    if (Array.isArray(raw.jobs)) {
      for (const j of raw.jobs) if (j && typeof j.jobId === "string") jobs.set(j.jobId, j);
    }
    if (raw.stats && typeof raw.stats === "object") Object.assign(stats, raw.stats);
    if (Array.isArray(raw.approvals)) {
      for (const a of raw.approvals) if (a && typeof a.id === "string") approvals.set(a.id, a);
    }
    console.log(
      `[floor-api] state restored from ${STATE_FILE} (${jobs.size} jobs, ${approvals.size} approvals)`,
    );
  } catch {
    console.log("[floor-api] no prior state file — starting fresh");
  }
  if (jobs.size === 0) seed();
}

function upsertJob(input) {
  const prev = jobs.get(input.jobId) ?? {};
  const job = {
    jobId: String(input.jobId),
    agentId: input.agentId,
    title:
      typeof input.title === "string" && input.title.trim()
        ? input.title.trim().slice(0, 80)
        : (prev.title ?? "Working…"),
    status: STATUSES.has(input.status) ? input.status : (prev.status ?? "queued"),
    progress: Number.isFinite(input.progress)
      ? Math.min(1, Math.max(0, input.progress))
      : (prev.progress ?? 0),
    updatedAt: Date.now(),
  };
  jobs.set(job.jobId, job);
  // keep memory bounded: drop the oldest beyond MAX_JOBS
  if (jobs.size > MAX_JOBS) {
    const oldest = [...jobs.values()].sort((a, b) => a.updatedAt - b.updatedAt)[0];
    if (oldest) jobs.delete(oldest.jobId);
  }
  // a job moving again means its pending approval is handled upstream —
  // keep the inbox clean (the workflow resumed after the decision)
  for (const [id, a] of approvals) {
    if (a.jobId && a.jobId === job.jobId && job.status !== "queued") approvals.delete(id);
  }
  markDirty();
  return job;
}

function seed() {
  const t = Date.now();
  [
    ["n8n_seed_1", "akira", "Routing EP301 → 4 clip queues", "running", 0.42],
    ["n8n_seed_2", "nova", "Silence-trim EP300 · 26 cuts", "running", 0.71],
    ["n8n_seed_3", "hook", "Drafting 140 hooks · EP300", "queued", 0],
    ["n8n_seed_4", "lexa", "Karaoke captions ID/EN · EP299", "running", 0.88],
    ["n8n_seed_5", "pixel", "A/B testing 8 covers · EP299", "done", 1],
    ["n8n_seed_6", "bolt", "Render & ship 5 clips · EP298", "running", 0.35],
  ].forEach(([jobId, agentId, title, status, progress], i) =>
    jobs.set(jobId, { jobId, agentId, title, status, progress, updatedAt: t - i * 1000 }),
  );
  markDirty();
}

function snapshot() {
  const list = [...jobs.values()].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 24);
  const pending = [...approvals.values()]
    .sort((a, b) => a.requestedAt - b.requestedAt)
    .map(({ callbackUrl, ...pub }) => pub); // never leak callback URLs to clients
  return { ts: Date.now(), source: "live", jobs: list, stats: { ...stats }, approvals: pending };
}

function send(res, code, body) {
  const json = JSON.stringify(body);
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(json);
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Clipyard-Token");
  res.setHeader("Access-Control-Max-Age", "600");
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > BODY_LIMIT) {
        reject(new Error("payload too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function authed(req, url) {
  const token = req.headers["x-clipyard-token"] ?? url.searchParams.get("token");
  return typeof token === "string" && token === TOKEN;
}

/** Fire-and-forget decision callback into the waiting n8n workflow. */
async function fireCallback(approval, decision, note) {
  if (!approval.callbackUrl) return "none";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CALLBACK_TIMEOUT_MS);
  try {
    const res = await fetch(approval.callbackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        approvalId: approval.id,
        decision,
        note: note ?? null,
        jobId: approval.jobId ?? null,
        agentId: approval.agentId,
        decidedAt: Date.now(),
      }),
      signal: controller.signal,
    });
    console.log(
      `[floor-api] callback ${approval.id} → ${res.status} (${approval.callbackUrl.slice(0, 60)})`,
    );
    return res.ok ? "sent" : "sent-with-http-error";
  } catch (err) {
    console.warn("[floor-api] callback failed:", err.message);
    return "failed";
  } finally {
    clearTimeout(timer);
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    const path = url.pathname.replace(/\/+$/, "") || "/";
    if (req.method === "GET" && path === "/api/floor") {
      return send(res, 200, snapshot());
    }
    if (req.method === "GET" && path === "/api/health") {
      return send(res, 200, { ok: true, jobs: jobs.size, approvals: approvals.size, ts: Date.now() });
    }

    // human decision from the diorama's Approval Inbox (no token by design)
    let dm = path.match(/^\/api\/approvals\/([^/]+)\/decision$/);
    if (req.method === "POST" && dm) {
      const id = decodeURIComponent(dm[1]);
      const approval = approvals.get(id);
      if (!approval) return send(res, 404, { error: "approval not found or already decided" });
      const body = await readBody(req);
      const decision = body?.decision;
      if (decision !== "approved" && decision !== "rejected") {
        return send(res, 400, { error: 'decision must be "approved" or "rejected"' });
      }
      const note = typeof body?.note === "string" ? body.note.slice(0, 300) : undefined;
      approvals.delete(id);
      decisionLog.unshift({ ...approval, decision, note, decidedAt: Date.now() });
      if (decisionLog.length > 100) decisionLog.pop();
      console.log(`[floor-api] approval ${id} → ${decision}${note ? ` (${note})` : ""}`);
      const callback = await fireCallback(approval, decision, note);
      markDirty();
      return send(res, 200, { ok: true, decision, callback });
    }

    // everything below mutates producer state → token required
    if (!authed(req, url)) {
      return send(res, 401, { error: "unauthorized: send X-Clipyard-Token (see server/README.md)" });
    }

    if (req.method === "POST" && path === "/api/n8n/job") {
      const body = await readBody(req);
      if (typeof body?.jobId !== "string" || !body.jobId || !AGENT_IDS.has(body?.agentId)) {
        return send(res, 400, {
          error: `jobId (string) and agentId (one of ${[...AGENT_IDS].join("|")}) are required`,
        });
      }
      const job = upsertJob(body);
      console.log(
        `[floor-api] job ${job.jobId} [${job.agentId}] → ${job.status} ${Math.round(job.progress * 100)}%`,
      );
      return send(res, 200, { ok: true, jobs: jobs.size });
    }

    if (req.method === "POST" && path === "/api/n8n/approvals") {
      const body = await readBody(req);
      if (!AGENT_IDS.has(body?.agentId)) {
        return send(res, 400, {
          error: `agentId (one of ${[...AGENT_IDS].join("|")}) is required`,
        });
      }
      const id =
        typeof body.id === "string" && body.id.trim()
          ? body.id.trim()
          : `apr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      const callbackUrl =
        typeof body.callbackUrl === "string" && /^https?:\/\//.test(body.callbackUrl)
          ? body.callbackUrl
          : undefined;
      const approval = {
        id,
        agentId: body.agentId,
        title:
          typeof body.title === "string" && body.title.trim()
            ? body.title.trim().slice(0, 90)
            : "Perlu persetujuan",
        detail: typeof body.detail === "string" ? body.detail.slice(0, 160) : undefined,
        jobId: typeof body.jobId === "string" ? body.jobId : undefined,
        requestedAt: Date.now(),
        callbackUrl,
      };
      approvals.set(id, approval);
      console.log(`[floor-api] approval opened ${id} [${approval.agentId}] ${approval.title}`);
      markDirty();
      return send(res, 200, { ok: true, id });
    }

    if (req.method === "POST" && path === "/api/n8n/stats") {
      const body = await readBody(req);
      for (const key of ["clipsShipped", "renderQueue", "avgClipSec", "channelsFed"]) {
        if (Number.isFinite(body?.[key])) stats[key] = Math.max(0, Math.round(body[key]));
      }
      console.log(`[floor-api] stats → ${JSON.stringify(stats)}`);
      markDirty();
      return send(res, 200, { ok: true, stats });
    }

    if (req.method === "POST" && path === "/api/n8n/reset") {
      jobs.clear();
      approvals.clear();
      seed();
      console.log("[floor-api] state reseeded");
      markDirty();
      return send(res, 200, { ok: true, jobs: jobs.size });
    }

    return send(res, 404, { error: "not found" });
  } catch (err) {
    return send(res, 400, { error: err instanceof Error ? err.message : "bad request" });
  }
});

loadState();
server.listen(PORT, HOST, () => {
  console.log(`[floor-api] listening on http://${HOST}:${PORT}`);
  console.log(
    `[floor-api] token: ${TOKEN === "clipyard-dev-token" ? "clipyard-dev-token (dev default — override with CLIPYARD_FLOOR_TOKEN)" : "(custom)"}`,
  );
  if (STATE_FILE) console.log(`[floor-api] persisting state to ${STATE_FILE}`);
});
