/**
 * CLIPYARD Floor API — the real producer endpoint (Phase 2).
 *
 * Zero-dependency Node server that owns the floor state and answers the
 * exact FloorSnapshot contract the diorama consumes (src/lib/hq-jobs.ts).
 * n8n workflows push job/status updates here over HTTP; the diorama polls.
 *
 *   GET  /api/floor          → FloorSnapshot (what the diorama polls)
 *   GET  /api/health         → { ok, jobs, ts }
 *   POST /api/n8n/job        → upsert one job          (token required)
 *   POST /api/n8n/stats      → merge floor stats        (token required)
 *   POST /api/n8n/reset      → reseed demo state        (token required)
 *
 * Auth: header `X-Clipyard-Token: …` (or ?token=…), must equal
 * process.env.CLIPYARD_FLOOR_TOKEN (default "clipyard-dev-token" — change
 * it anywhere public).
 *
 * Run: node server/floor-api.mjs   (0.0.0.0:8787)
 * Dev wiring: vite proxies /api → 127.0.0.1:8787, and the app runs with
 * VITE_FLOOR_URL=/api/floor (see .env.example / server/README.md).
 */
import { createServer } from "node:http";

const PORT = Number(process.env.PORT ?? 8787);
const HOST = "0.0.0.0";
const TOKEN = process.env.CLIPYARD_FLOOR_TOKEN ?? "clipyard-dev-token";
const MAX_JOBS = 200;
const BODY_LIMIT = 64 * 1024;

const AGENT_IDS = new Set(["akira", "nova", "hook", "lexa", "pixel", "bolt"]);
const STATUSES = new Set(["queued", "running", "done", "failed"]);

/** @type {Map<string, {jobId:string;agentId:string;title:string;status:string;progress:number;updatedAt:number}>} */
const jobs = new Map();
const stats = { clipsShipped: 1284, renderQueue: 3, avgClipSec: 42, channelsFed: 46 };

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
}
seed();

function snapshot() {
  const list = [...jobs.values()].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 24);
  return { ts: Date.now(), source: "live", jobs: list, stats: { ...stats } };
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
      return send(res, 200, { ok: true, jobs: jobs.size, ts: Date.now() });
    }

    // everything below mutates state → token required
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

    if (req.method === "POST" && path === "/api/n8n/stats") {
      const body = await readBody(req);
      for (const key of ["clipsShipped", "renderQueue", "avgClipSec", "channelsFed"]) {
        if (Number.isFinite(body?.[key])) stats[key] = Math.max(0, Math.round(body[key]));
      }
      console.log(`[floor-api] stats → ${JSON.stringify(stats)}`);
      return send(res, 200, { ok: true, stats });
    }

    if (req.method === "POST" && path === "/api/n8n/reset") {
      jobs.clear();
      seed();
      console.log("[floor-api] state reseeded");
      return send(res, 200, { ok: true, jobs: jobs.size });
    }

    return send(res, 404, { error: "not found" });
  } catch (err) {
    return send(res, 400, { error: err instanceof Error ? err.message : "bad request" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[floor-api] listening on http://${HOST}:${PORT}`);
  console.log(`[floor-api] token: ${TOKEN === "clipyard-dev-token" ? "clipyard-dev-token (dev default — override with CLIPYARD_FLOOR_TOKEN)" : "(custom)"}`);
});
