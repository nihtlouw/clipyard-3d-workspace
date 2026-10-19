/**
 * Pipeline connector configuration (Fase 6).
 *
 * Lets a non-technical user point the studio at a real producer (the bundled
 * Floor API in server/floor-api.mjs, usually fed by n8n) from the UI instead
 * of editing .env files. Config persists in localStorage; VITE_FLOOR_URL is
 * still honoured as the initial default for deployed builds.
 *
 * NOTE: the token is stored in this browser only and sent as
 * `X-Clipyard-Token` when pushing test jobs — fine for a local/trusted
 * setup, not a secrets vault for a public deployment.
 */
import { sanitizeSnapshot } from "@/lib/hq-jobs";
import { loadJSON, saveJSON } from "@/lib/hq-persist";

export interface ConnectorConfig {
  mode: "sim" | "live";
  /** GET endpoint that answers a FloorSnapshot (relative "/api/floor" works via the Vite proxy) */
  floorUrl: string;
  /** X-Clipyard-Token for POSTs to the Floor API */
  token: string;
  /** live polling interval in seconds (tab-hidden still relaxes to 10s) */
  pollSec: number;
}

export const CONNECTOR_KEY = "clipyard.connector.v1";

export function defaultConnector(): ConnectorConfig {
  const envUrl = (import.meta.env.VITE_FLOOR_URL as string | undefined)?.trim();
  return {
    mode: envUrl ? "live" : "sim",
    floorUrl: envUrl || "/api/floor",
    token: "clipyard-dev-token",
    pollSec: 2,
  };
}

function sanitizeConnector(raw: unknown): ConnectorConfig {
  const base = defaultConnector();
  if (typeof raw !== "object" || raw === null) return base;
  const o = raw as Record<string, unknown>;
  return {
    mode: o.mode === "live" ? "live" : "sim",
    floorUrl: typeof o.floorUrl === "string" && o.floorUrl.trim() ? o.floorUrl.trim().slice(0, 300) : base.floorUrl,
    token: typeof o.token === "string" ? o.token.slice(0, 120) : base.token,
    pollSec: Math.min(30, Math.max(1, typeof o.pollSec === "number" && Number.isFinite(o.pollSec) ? o.pollSec : base.pollSec)),
  };
}

export function loadConnector(): ConnectorConfig {
  return sanitizeConnector(loadJSON<unknown>(CONNECTOR_KEY, null));
}

export function saveConnector(cfg: ConnectorConfig): void {
  saveJSON(CONNECTOR_KEY, cfg);
}

/**
 * Derives a sibling Floor-API path from the configured floor URL:
 *   "/api/floor"                    → "/api/n8n/job"
 *   "http://host:8787/api/floor"    → "http://host:8787/api/n8n/job"
 */
export function floorApiPath(cfg: ConnectorConfig, path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  try {
    const u = new URL(cfg.floorUrl);
    return `${u.origin}/api${clean}`;
  } catch {
    return `/api${clean}`;
  }
}

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
  jobs?: number;
  approvals?: number;
  ts?: number;
}

/** One GET against the configured endpoint, validated with the real contract parser. */
export async function testConnection(cfg: ConnectorConfig): Promise<ConnectionTestResult> {
  if (cfg.mode === "sim") {
    return { ok: true, message: "Mode SIM aktif — simulator bawaan berjalan, tidak perlu endpoint." };
  }
  try {
    const res = await fetch(cfg.floorUrl, { headers: { accept: "application/json" } });
    if (!res.ok) return { ok: false, message: `Endpoint menjawab HTTP ${res.status}. Cek URL & server-nya.` };
    const json: unknown = await res.json();
    const snap = sanitizeSnapshot(json, "live");
    if (!snap) {
      return { ok: false, message: "Terhubung, tapi respons bukan FloorSnapshot yang valid (cek format JSON jobs[])." };
    }
    return {
      ok: true,
      message: `Terhubung ✓ — ${snap.jobs.length} job, ${snap.approvals?.length ?? 0} approval pending.`,
      jobs: snap.jobs.length,
      approvals: snap.approvals?.length ?? 0,
      ts: snap.ts,
    };
  } catch (err) {
    return {
      ok: false,
      message: `Gagal menghubungi endpoint: ${err instanceof Error ? err.message : String(err)}. Pastikan Floor API jalan (node server/floor-api.mjs).`,
    };
  }
}
