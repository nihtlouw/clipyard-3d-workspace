/**
 * Configurable agent identities (Fase 6).
 *
 * The static AGENTS in hq-data.ts own the floor plan (desk/lounge positions).
 * Everything a human should be able to tune — display name, role,
 * responsibilities, accent color, model/tooling notes, per-agent webhook —
 * lives here as a profile that the store holds and persists to localStorage.
 */
import { AGENTS, type AgentId, type AgentInfo } from "@/lib/hq-data";
import type { ClipJob } from "@/lib/hq-jobs";
import { loadJSON, saveJSON } from "@/lib/hq-persist";

/**
 * How an agent decides to work (Fase 7):
 *  - "always"   → 24/7 whenever a job exists (the sensible AI default)
 *  - "schedule" → only inside the configured hour window (real clock)
 * The `enabled` flag remains the manual master switch on top of this.
 */
export type WorkMode = "always" | "schedule";

export interface AgentProfile {
  id: AgentId;
  name: string;
  role: string;
  tagline: string;
  color: string;
  /** bullet list of responsibilities (tanggung jawab) */
  responsibilities: string[];
  /** free-text model/engine note, e.g. "LLM copywriting via n8n" */
  model: string;
  /** comma-separated tools note */
  tools: string;
  /** optional per-agent webhook (n8n) that can be triggered from the UI */
  webhookUrl: string;
  /** inactive agents are flagged in the UI (floor animation keeps running) */
  enabled: boolean;
  /** when true, the UI hints this agent's approvals may auto-pass upstream */
  autoApprove: boolean;
  /** 24/7 vs only inside the schedule window below (Fase 7) */
  workMode: WorkMode;
  /** schedule window on the real clock, whole hours 0–24 (start > end wraps midnight) */
  scheduleStart: number;
  scheduleEnd: number;
}

export const PROFILE_KEY = "clipyard.agents.v1";

const EXTRAS: Record<AgentId, Pick<AgentProfile, "responsibilities" | "model" | "tools">> = {
  akira: {
    responsibilities: [
      "Menerima video panjang & membaginya ke antrean klip",
      "Menentukan prioritas episode yang dikerjakan duluan",
      "Memantau seluruh pipeline dari intake sampai publish",
    ],
    model: "LLM router (intake n8n)",
    tools: "n8n Webhook, antrean Floor API",
  },
  nova: {
    responsibilities: [
      "Memotong jedahening (silence-trim) & jump-cut",
      "Menjaga ritme pacing tiap klip",
      "QC durasi & transisi dasar",
    ],
    model: "Editor otomatis (ffmpeg + Whisper)",
    tools: "ffmpeg, Whisper, scene-detect",
  },
  hook: {
    responsibilities: [
      "Menulis 3 detik pertama (hook) setiap klip",
      "Membuat judul & teks pembuka yang mengundang klik",
      "A/B test varian hook",
    ],
    model: "LLM copywriting",
    tools: "n8n LLM node, spreadsheet skor hook",
  },
  lexa: {
    responsibilities: [
      "Caption karaoke Indonesia/Inggris yang tersinkron",
      "Timing per kata & penekanan emoji seperlunya",
      "Cek ejaan sebelum render",
    ],
    model: "Whisper + LLM proofread",
    tools: "Whisper, subtitle burner",
  },
  pixel: {
    responsibilities: [
      "Desain cover/thumbnail tiap klip",
      "A/B test cover sampai CTR naik",
      "Menjaga konsistensi visual channel",
    ],
    model: "Image-gen + template cover",
    tools: "Image gen, Canva API",
  },
  bolt: {
    responsibilities: [
      "Render & encode klip final",
      "Menjadwalkan dan menerbitkan ke channel",
      "Lapor status publish ke lantai",
    ],
    model: "Render worker",
    tools: "Render API, YouTube API",
  },
};

export function defaultProfiles(): Record<AgentId, AgentProfile> {
  const out = {} as Record<AgentId, AgentProfile>;
  for (const a of AGENTS) {
    out[a.id] = {
      id: a.id,
      name: a.name,
      role: a.role,
      tagline: a.tagline,
      color: a.color,
      webhookUrl: "",
      enabled: true,
      autoApprove: false,
      workMode: "always",
      scheduleStart: 9,
      scheduleEnd: 17,
      ...EXTRAS[a.id],
    };
  }
  return out;
}

/** Defensive merge of a persisted blob over the defaults. */
function sanitizeProfiles(raw: unknown): Record<AgentId, AgentProfile> {
  const base = defaultProfiles();
  if (typeof raw !== "object" || raw === null) return base;
  const obj = raw as Record<string, unknown>;
  for (const a of AGENTS) {
    const saved = obj[a.id];
    if (typeof saved !== "object" || saved === null) continue;
    const s = saved as Record<string, unknown>;
    const cur = base[a.id];
    const str = (v: unknown, fallback: string, max = 160) =>
      typeof v === "string" && v.trim() ? v.trim().slice(0, max) : fallback;
    base[a.id] = {
      ...cur,
      name: str(s.name, cur.name, 24).toUpperCase(),
      role: str(s.role, cur.role, 60),
      tagline: str(s.tagline, cur.tagline, 200),
      color: /^#[0-9a-fA-F]{6}$/.test(String(s.color)) ? String(s.color) : cur.color,
      responsibilities: Array.isArray(s.responsibilities)
        ? s.responsibilities
            .filter((r): r is string => typeof r === "string" && r.trim().length > 0)
            .map((r) => r.trim().slice(0, 140))
            .slice(0, 8)
        : cur.responsibilities,
      model: str(s.model, cur.model, 80),
      tools: str(s.tools, cur.tools, 120),
      webhookUrl: typeof s.webhookUrl === "string" ? s.webhookUrl.trim().slice(0, 300) : "",
      enabled: s.enabled !== false,
      autoApprove: s.autoApprove === true,
      workMode: s.workMode === "schedule" ? "schedule" : "always",
      scheduleStart: clampHour(s.scheduleStart, cur.scheduleStart),
      scheduleEnd: clampHour(s.scheduleEnd, cur.scheduleEnd),
    };
  }
  return base;
}

export function loadProfiles(): Record<AgentId, AgentProfile> {
  return sanitizeProfiles(loadJSON<unknown>(PROFILE_KEY, null));
}

export function saveProfiles(p: Record<AgentId, AgentProfile>): void {
  saveJSON(PROFILE_KEY, p);
}

/** Merge a static AgentInfo with its (possibly edited) profile for display. */
export function withProfile(
  info: AgentInfo,
  profiles: Record<AgentId, AgentProfile>,
): AgentInfo & { profile: AgentProfile } {
  const p = profiles[info.id];
  if (!p) return { ...info, profile: defaultProfiles()[info.id] };
  return { ...info, name: p.name, role: p.role, tagline: p.tagline, color: p.color, profile: p };
}

export const AGENT_COLOR_SWATCHES = [
  "#22d3ee", "#a78bfa", "#fbbf24", "#34d399", "#f472b6", "#fb923c",
  "#60a5fa", "#f87171", "#a3e635", "#e879f9", "#94a3b8", "#facc15",
];

/* ------------------------------ work mode & live activity (Fase 7) ------------------------------ */

function clampHour(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v)
    ? Math.min(24, Math.max(0, Math.round(v)))
    : fallback;
}

export function fmtHourLabel(h: number): string {
  return `${String(Math.floor(((h % 24) + 24) % 24)).padStart(2, "0")}.00`;
}

/** True when `hour` (real clock) falls inside the agent's schedule window. */
export function isInSchedule(p: AgentProfile, hour: number): boolean {
  if (p.workMode !== "schedule") return true;
  const s = p.scheduleStart;
  const e = p.scheduleEnd;
  if (s === e) return true; // degenerate window = always
  return s < e ? hour >= s && hour < e : hour >= s || hour < e; // overnight wraps midnight
}

export type AgentActivityKind =
  | "kerja"
  | "antre"
  | "minta-ok"
  | "gagal"
  | "nganggur"
  | "dijeda"
  | "nonaktif";

export interface AgentActivity {
  kind: AgentActivityKind;
  /** short chip label, e.g. "Kerja" */
  label: string;
  /** one friendly sentence explaining the state */
  reason: string;
  /** chip/dot color */
  color: string;
}

/**
 * The agent's *real* current state — drives robot placement and status
 * labels whenever the 9–5 demo choreography is off. Priority: switched off
 * > outside schedule > waiting for the owner > failed > running > queued > idle.
 */
export function agentActivity(
  p: AgentProfile,
  job: ClipJob | undefined,
  hasApproval: boolean,
  hour: number,
): AgentActivity {
  if (!p.enabled) {
    return { kind: "nonaktif", label: "Nonaktif", reason: "Dimatikan manual dari konfigurasi agen.", color: "#64748b" };
  }
  if (!isInSchedule(p, hour)) {
    return {
      kind: "dijeda",
      label: "Di luar jadwal",
      reason: `Jadwal kerja ${fmtHourLabel(p.scheduleStart)}–${fmtHourLabel(p.scheduleEnd)} — di luar itu agen beristirahat.`,
      color: "#a78bfa",
    };
  }
  if (hasApproval) {
    return { kind: "minta-ok", label: "Menunggu OK", reason: "Pekerjaannya menunggu persetujuanmu.", color: "#fbbf24" };
  }
  if (job?.status === "failed") {
    return { kind: "gagal", label: "Error", reason: "Job terakhir gagal — menunggu tugas berikutnya.", color: "#fb7185" };
  }
  if (job?.status === "running") {
    return { kind: "kerja", label: "Kerja", reason: "Sedang mengerjakan tugas.", color: "#34d399" };
  }
  if (job?.status === "queued") {
    return { kind: "antre", label: "Antre", reason: "Tugas sudah masuk, menunggu giliran jalan.", color: "#94a3b8" };
  }
  return { kind: "nganggur", label: "Santai", reason: "Belum ada tugas saat ini.", color: "#38bdf8" };
}
