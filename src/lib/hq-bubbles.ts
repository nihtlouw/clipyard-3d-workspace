/**
 * Speech bubbles (Fase 10) — the crew (and the Boss) occasionally *say*
 * things: event lines when a job finishes/fails or someone asks for an
 * OK, plus low-key ambient chatter matched to what they're doing. A tiny
 * "director" watches the floor store and decides who speaks; the actual
 * rendering lives in components/hq/bubbles.tsx. Purely cosmetic — the
 * bubbles never influence the robots themselves.
 */
import { useEffect } from "react";
import { create } from "zustand";
import { AGENTS } from "@/lib/hq-data";
import { currentJobFor, type ClipJob } from "@/lib/hq-jobs";
import { agentActivity, type AgentActivityKind } from "@/lib/hq-profiles";
import type { PovId } from "@/lib/hq-robots";
import { useHqStore } from "@/lib/hq-store";

export type BubbleIcon =
  | "coffee"
  | "check"
  | "rocket"
  | "alert"
  | "moon"
  | "spark"
  | "clock"
  | "hand"
  | "wrench"
  | "party";
export type BubbleTone = "plain" | "sukses" | "error" | "warning";

export interface Bubble {
  key: number;
  speaker: PovId;
  text: string;
  icon: BubbleIcon;
  tone: BubbleTone;
  expiresAt: number;
}

type Line = { text: string; icon: BubbleIcon; tone: BubbleTone };

const MAX_BUBBLES = 3;
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const shortTitle = (t: string) => (t.length > 26 ? `${t.slice(0, 25)}…` : t);

interface BubbleState {
  bubbles: Bubble[];
  say: (speaker: PovId, text: string, icon: BubbleIcon, tone?: BubbleTone, ms?: number) => void;
  sweep: () => void;
}

export const useBubbleStore = create<BubbleState>((set) => ({
  bubbles: [],
  say: (speaker, text, icon, tone = "plain", ms = 4200) =>
    set((s) => {
      const now = Date.now();
      // one bubble per speaker (a new line replaces the old), cap the chatter
      const next = s.bubbles.filter((b) => b.speaker !== speaker && b.expiresAt > now);
      next.push({ key: now + Math.random(), speaker, text, icon, tone, expiresAt: now + ms });
      return { bubbles: next.slice(-MAX_BUBBLES) };
    }),
  sweep: () =>
    set((s) => {
      const now = Date.now();
      const next = s.bubbles.filter((b) => b.expiresAt > now);
      return next.length === s.bubbles.length ? s : { bubbles: next };
    }),
}));

/** ambient small-talk per real activity kind (matches agentActivity) */
function ambientLine(kind: AgentActivityKind, job: ClipJob | undefined): Line | null {
  switch (kind) {
    case "kerja": {
      const pct = job ? Math.round(job.progress * 100) : 0;
      return pick<Line>([
        { text: "Fokus dulu…", icon: "wrench", tone: "plain" },
        { text: "Gas terus!", icon: "spark", tone: "plain" },
        { text: "Dikit lagi kelar!", icon: "wrench", tone: "plain" },
        ...(job ? [{ text: `${shortTitle(job.title)} · ${pct}%`, icon: "clock", tone: "plain" } as Line] : []),
      ]);
    }
    case "antre":
      return pick<Line>([
        { text: "Antre dulu ya…", icon: "clock", tone: "plain" },
        { text: "Siap-siap…", icon: "clock", tone: "plain" },
        { text: "Nunggu giliran nih", icon: "clock", tone: "plain" },
      ]);
    case "minta-ok":
      return pick<Line>([
        { text: "Bos, minta OK!", icon: "hand", tone: "warning" },
        { text: "Menunggu keputusan Bos…", icon: "hand", tone: "warning" },
      ]);
    case "gagal":
      return pick<Line>([
        { text: "Aduh, error…", icon: "alert", tone: "error" },
        { text: "Tadi gagal, coba lagi deh", icon: "alert", tone: "error" },
      ]);
    case "nganggur":
      return pick<Line>([
        { text: "Ngopi dulu", icon: "coffee", tone: "plain" },
        { text: "Santai… belum ada tugas", icon: "coffee", tone: "plain" },
        { text: "Recharge bentar", icon: "spark", tone: "plain" },
        { text: "Ada tugas buatku?", icon: "spark", tone: "plain" },
      ]);
    case "dijeda":
      return pick<Line>([
        { text: "Istirahat dulu…", icon: "moon", tone: "plain" },
        { text: "Zzz…", icon: "moon", tone: "plain" },
      ]);
    default:
      return null; // nonaktif stays silent
  }
}

/** the Boss speaks too — rarer, and he notices waiting approvals */
function bossLine(waiting: number): Line {
  if (waiting > 0)
    return pick<Line>([
      { text: "Ada yang minta OK?", icon: "spark", tone: "warning" },
      { text: "Sebentar, saya cek dulu", icon: "clock", tone: "warning" },
    ]);
  return pick<Line>([
    { text: "Semua terkendali", icon: "check", tone: "plain" },
    { text: "Kerja bagus, tim!", icon: "spark", tone: "plain" },
    { text: "Kopi dulu", icon: "coffee", tone: "plain" },
    { text: "Lanjutkan!", icon: "rocket", tone: "plain" },
  ]);
}

/**
 * Mount once (in HqExperience): turns floor-store events into event
 * bubbles and sprinkles ambient lines every few seconds. At most two
 * ambient bubbles at a time; each speaker cools down between lines.
 */
export function useBubbleDirector() {
  useEffect(() => {
    const say = (speaker: PovId, line: Line, ms = 4200) =>
      useBubbleStore.getState().say(speaker, line.text, line.icon, line.tone, ms);

    const cooldown = new Map<PovId, number>();
    const cool = (speaker: PovId, ms: number) => cooldown.set(speaker, Date.now() + ms);

    const doneLine = (job: ClipJob): Line =>
      pick<Line>([
        { text: "Kelar!", icon: "party", tone: "sukses" },
        { text: "Berhasil terkirim!", icon: "check", tone: "sukses" },
        { text: `${shortTitle(job.title)} selesai!`, icon: "check", tone: "sukses" },
      ]);

    // ---- event lines from job / approval transitions ----
    const unsub = useHqStore.subscribe((s, prev) => {
      if (s.jobs !== prev.jobs) {
        const before = new Map(prev.jobs.map((j) => [j.jobId, j]));
        const nowIds = new Set(s.jobs.map((j) => j.jobId));
        for (const j of s.jobs) {
          const was = before.get(j.jobId)?.status;
          if (was === undefined || was === j.status) continue;
          if (j.status === "done") {
            say(j.agentId, doneLine(j), 4600);
            cool(j.agentId, 20000);
          } else if (j.status === "failed") {
            say(
              j.agentId,
              pick<Line>([
                { text: "Yah, gagal…", icon: "alert", tone: "error" },
                { text: "Error nih!", icon: "alert", tone: "error" },
              ]),
              4600,
            );
            cool(j.agentId, 20000);
          } else if (j.status === "running" && was === "queued") {
            say(
              j.agentId,
              pick<Line>([
                { text: "Siap, mulai!", icon: "rocket", tone: "plain" },
                { text: "Tugas baru, gas!", icon: "rocket", tone: "plain" },
              ]),
              3800,
            );
            cool(j.agentId, 16000);
          }
        }
        // some producers drop finished jobs instead of flagging them done:
        // a running job that vanishes near-complete still counts as a win
        for (const [, pj] of before) {
          if (!nowIds.has(pj.jobId) && pj.status === "running" && pj.progress >= 0.8) {
            say(pj.agentId, doneLine(pj), 4600);
            cool(pj.agentId, 20000);
          }
        }
      }
      if (s.approvals !== prev.approvals) {
        const beforeIds = new Set(prev.approvals.map((a) => a.id));
        for (const a of s.approvals) {
          if (!beforeIds.has(a.id)) {
            say(a.agentId, { text: "Bos, minta OK!", icon: "hand", tone: "warning" }, 5000);
            cool(a.agentId, 24000);
            // the boss reacts a beat later (his head turns too — Fase 9)
            window.setTimeout(
              () => say("manager", { text: "Ada yang minta OK?", icon: "spark", tone: "warning" }, 4200),
              900,
            );
            cool("manager", 30000);
          }
        }
        const nowIds = new Set(s.approvals.map((a) => a.id));
        for (const a of prev.approvals) {
          if (!nowIds.has(a.id)) {
            say(a.agentId, { text: "Siap, lanjut!", icon: "check", tone: "sukses" }, 3600);
            cool(a.agentId, 18000);
          }
        }
      }
    });

    // ---- ambient chatter ----
    const tick = window.setInterval(() => {
      useBubbleStore.getState().sweep();
      if (useBubbleStore.getState().bubbles.length >= 2) return;
      if (Math.random() > 0.45) return;
      const now = Date.now();
      const s = useHqStore.getState();
      const speaking = new Set(useBubbleStore.getState().bubbles.map((b) => b.speaker));
      const speakers: PovId[] = [...AGENTS.map((a) => a.id), "manager"];
      for (let i = speakers.length - 1; i > 0; i--) {
        const k = Math.floor(Math.random() * (i + 1));
        [speakers[i], speakers[k]] = [speakers[k], speakers[i]];
      }
      for (const sp of speakers) {
        if (speaking.has(sp) || (cooldown.get(sp) ?? 0) > now) continue;
        if (sp === "manager") {
          say("manager", bossLine(s.approvals.length));
          cool("manager", 40000 + Math.random() * 20000);
          return;
        }
        const profile = s.profiles[sp];
        if (!profile) continue;
        const job = currentJobFor(sp, s.jobs);
        const act = agentActivity(profile, job, s.approvals.some((a) => a.agentId === sp), s.hour);
        const line = ambientLine(act.kind, job);
        if (!line) continue;
        say(sp, line);
        cool(sp, 24000 + Math.random() * 16000);
        return;
      }
    }, 2000);

    // a friendly hello so the feature is visible right away
    const welcome = window.setTimeout(() => {
      const s = useHqStore.getState();
      const runner = AGENTS.map((a) => a.id).find(
        (id) => currentJobFor(id, s.jobs)?.status === "running",
      );
      if (runner) {
        say(runner, { text: "Semangat kerja!", icon: "rocket", tone: "plain" });
      } else {
        say("manager", { text: "Selamat datang di Bay 7!", icon: "spark", tone: "plain" });
      }
    }, 2600);

    return () => {
      unsub();
      window.clearInterval(tick);
      window.clearTimeout(welcome);
    };
  }, []);
}
