/**
 * CLIPYARD Studio — procedural canvas textures.
 * Everything is drawn on <canvas>; no external image assets.
 * Textures are created once (useMemo upstream) and redrawn in place
 * on gated ticks so we never allocate per frame.
 */
import * as THREE from "three";
import { AGENTS, type AgentInfo } from "@/lib/hq-data";
import type { JobStatus } from "@/lib/hq-jobs";

function makeCanvas(w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

function toTexture(canvas: HTMLCanvasElement) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function ctx2d(canvas: HTMLCanvasElement) {
  return canvas.getContext("2d") as CanvasRenderingContext2D;
}

/** Deterministic PRNG so props look the same every session. */
export function seededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* ---------------------------------- skyline window ---------------------------------- */

export interface SkylineTex {
  tex: THREE.CanvasTexture;
  redraw: (daylight: number, sunset: number, hour: number) => void;
}

const SKY_W = 384;
const SKY_H = 272;

interface Tower {
  x: number;
  w: number;
  h: number;
  hue: number;
  windows: Array<[number, number]>;
}

const TOWERS: Tower[] = (() => {
  const rnd = seededRandom(20260716);
  const towers: Tower[] = [];
  let x = 6;
  while (x < SKY_W - 14) {
    const w = 22 + rnd() * 40;
    const h = 60 + rnd() * 130;
    const windows: Array<[number, number]> = [];
    const cols = Math.floor(w / 12);
    const rows = Math.floor(h / 16);
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (rnd() > 0.62) windows.push([c, r]);
      }
    }
    towers.push({ x, w, h, hue: 228 + rnd() * 16, windows });
    x += w + 4 + rnd() * 14;
  }
  return towers;
})();

/** Big window view: city skyline whose sky follows the sim clock. */
export function createSkyline(): SkylineTex {
  const canvas = makeCanvas(SKY_W, SKY_H);
  const ctx = ctx2d(canvas);
  const tex = toTexture(canvas);

  const clouds = Array.from({ length: 5 }, (_, i) => ({
    x: (i * 97 + 40) % SKY_W,
    y: 34 + ((i * 53) % 60),
    s: 0.7 + ((i * 0.23) % 0.8),
  }));

  function redraw(daylight: number, sunset: number, hour: number) {
    const night = 1 - daylight;
    // sky gradient
    const top = mixColor([58, 74, 158], [126, 176, 235], daylight);
    if (sunset > 0) blendInto(top, [244, 154, 104], sunset * 0.75);
    const bottom = mixColor([196, 204, 236], [214, 232, 248], daylight);
    if (sunset > 0) blendInto(bottom, [255, 186, 130], sunset * 0.8);

    const grad = ctx.createLinearGradient(0, 0, 0, SKY_H);
    grad.addColorStop(0, rgb(top));
    grad.addColorStop(1, rgb(bottom));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SKY_W, SKY_H);

    // stars at night
    if (night > 0.45) {
      const rnd = seededRandom(77);
      ctx.fillStyle = `rgba(255,255,255,${(night - 0.45) * 1.4})`;
      for (let i = 0; i < 42; i++) {
        const sx = rnd() * SKY_W;
        const sy = rnd() * SKY_H * 0.55;
        ctx.fillRect(sx, sy, 1.6, 1.6);
      }
    }

    // sun / moon on an arc
    const theta = ((hour - 6) / 12) * Math.PI;
    const cx = 40 + ((hour - 6) / 12) * (SKY_W - 80);
    const cy = 150 - Math.sin(theta) * 110;
    if (Math.sin(theta) > -0.08) {
      ctx.fillStyle = sunset > 0.4 ? "#ffcf8a" : "#ffe9b0";
      ctx.beginPath();
      ctx.arc(cx, cy, 17, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = sunset > 0.4 ? "rgba(255,190,120,0.35)" : "rgba(255,235,180,0.3)";
      ctx.beginPath();
      ctx.arc(cx, cy, 26, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const mx = 40 + (((hour + 12 - 6) % 24) / 12) * (SKY_W - 80);
      const my = 150 - Math.sin((((hour + 12 - 6) % 24) / 12) * Math.PI) * 110;
      ctx.fillStyle = "#eef2ff";
      ctx.beginPath();
      ctx.arc(mx, my, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgb(top);
      ctx.beginPath();
      ctx.arc(mx + 6, my - 4, 10, 0, Math.PI * 2);
      ctx.fill();
    }

    // clouds (day only, fade out)
    if (daylight > 0.15) {
      ctx.fillStyle = `rgba(255,255,255,${0.75 * daylight})`;
      for (const c of clouds) {
        puff(ctx, c.x, c.y, 26 * c.s);
      }
    }

    // towers
    for (const t of TOWERS) {
      const shade = mixColor([66, 74, 122], [156, 164, 210], daylight * 0.9);
      ctx.fillStyle = rgb(shade);
      ctx.fillRect(t.x, SKY_H - t.h, t.w, t.h);
      // rooftop
      ctx.fillRect(t.x + t.w * 0.3, SKY_H - t.h - 8, 5, 8);
      // windows
      const lit = night > 0.3;
      for (const [c, r] of t.windows) {
        if (lit) {
          ctx.fillStyle = "rgba(255,214,130,0.9)";
        } else {
          ctx.fillStyle = `rgba(226,233,250,${0.25 + daylight * 0.25})`;
        }
        ctx.fillRect(t.x + 5 + c * 12, SKY_H - t.h + 7 + r * 16, 6, 8);
      }
    }
    tex.needsUpdate = true;
  }

  redraw(1, 0, 12);
  return { tex, redraw };
}

function puff(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
  ctx.arc(x + r * 0.55, y + r * 0.12, r * 0.42, 0, Math.PI * 2);
  ctx.arc(x - r * 0.55, y + r * 0.15, r * 0.38, 0, Math.PI * 2);
  ctx.arc(x + r * 0.1, y - r * 0.28, r * 0.44, 0, Math.PI * 2);
  ctx.fill();
}

function mixColor(a: [number, number, number], b: [number, number, number], t: number) {
  const k = Math.min(1, Math.max(0, t));
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k] as [
    number,
    number,
    number,
  ];
}

function blendInto(base: [number, number, number], tint: [number, number, number], t: number) {
  const k = Math.min(1, Math.max(0, t));
  base[0] += (tint[0] - base[0]) * k;
  base[1] += (tint[1] - base[1]) * k;
  base[2] += (tint[2] - base[2]) * k;
}

function rgb(c: [number, number, number]) {
  return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
}

/* ---------------------------------- agent monitor screen ---------------------------------- */

export interface ScreenTex {
  tex: THREE.CanvasTexture;
  redraw: (t: number, onShift: boolean, job?: { status: JobStatus; progress: number }) => void;
}

const SCREEN_W = 256;
const SCREEN_H = 152;

/** Cute editor screen per agent: header, progress, clip timeline blocks. */
export function createScreen(info: AgentInfo): ScreenTex {
  const canvas = makeCanvas(SCREEN_W, SCREEN_H);
  const ctx = ctx2d(canvas);
  const tex = toTexture(canvas);
  const rnd = seededRandom(info.name.charCodeAt(0) * 131 + 7);

  const blocks = Array.from({ length: 14 }, () => ({
    w: 14 + rnd() * 42,
    gap: 4 + rnd() * 10,
    tone: rnd(),
  }));

  function redraw(t: number, onShift: boolean, job?: { status: JobStatus; progress: number }) {
    // background
    ctx.fillStyle = "#161a33";
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

    // header
    ctx.fillStyle = info.color;
    roundRect(ctx, 0, 0, SCREEN_W, 30, { tl: 10, tr: 10, bl: 0, br: 0 });
    ctx.fillStyle = "#10132a";
    ctx.font = "800 17px system-ui, sans-serif";
    ctx.fillText(info.name, 12, 21);
    ctx.font = "600 11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(16,19,42,0.75)";
    ctx.fillText(info.role.toUpperCase(), 78, 20);

    // progress — live job when available, static persona otherwise
    const failed = job?.status === "failed";
    const queued = job?.status === "queued";
    const base = job && (job.status === "running" || failed) ? job.progress : info.progress;
    const p = onShift && !failed
      ? queued
        ? 0
        : Math.min(0.995, base + Math.sin(t * 0.12) * 0.03)
      : Math.max(0.02, base - 0.08);
    ctx.fillStyle = "#252a4d";
    roundRect(ctx, 12, 42, SCREEN_W - 24, 14, 7);
    ctx.fillStyle = failed ? "#e11d48" : info.color;
    roundRect(ctx, 12, 42, (SCREEN_W - 24) * p, 14, 7);
    ctx.fillStyle = failed ? "#fda4af" : "#aab2dd";
    ctx.font = "700 11px system-ui, sans-serif";
    ctx.fillText(failed ? "FAILED" : queued ? "QUEUED" : `${Math.round(p * 100)}%`, SCREEN_W - 44, 74);

    // timeline blocks
    let x = 12;
    let y = 88;
    for (const b of blocks) {
      if (x + b.w > SCREEN_W - 12) {
        x = 12;
        y += 18;
        if (y > SCREEN_H - 16) break;
      }
      ctx.fillStyle =
        b.tone > 0.72 ? info.color : b.tone > 0.4 ? "rgba(255,255,255,0.22)" : "#262c55";
      roundRect(ctx, x, y, b.w, 11, 4);
      x += b.w + b.gap;
    }

    // caret blink
    if (onShift && Math.sin(t * 4) > 0) {
      ctx.fillStyle = info.color;
      ctx.fillRect(SCREEN_W - 20, SCREEN_H - 18, 8, 12);
    }

    // off-shift overlay
    if (!onShift) {
      ctx.fillStyle = "rgba(16,19,42,0.55)";
      ctx.fillRect(0, 30, SCREEN_W, SCREEN_H - 30);
      ctx.fillStyle = "#aab2dd";
      ctx.font = "800 14px system-ui, sans-serif";
      ctx.fillText("OFF SHIFT · Zzz", 74, SCREEN_H / 2 + 16);
    } else if (failed) {
      ctx.fillStyle = "rgba(225,29,72,0.16)";
      ctx.fillRect(0, 30, SCREEN_W, SCREEN_H - 30);
      ctx.fillStyle = "#fda4af";
      ctx.font = "800 13px system-ui, sans-serif";
      ctx.fillText("JOB FAILED · RETRY SOON", 46, SCREEN_H / 2 + 30);
    }
    tex.needsUpdate = true;
  }

  redraw(0, true);
  return { tex, redraw };
}

/* ---------------------------------- whiteboard ---------------------------------- */

export interface WhiteboardRow {
  name: string;
  color: string;
  p: number;
  failed: boolean;
}

export interface WhiteboardTex {
  tex: THREE.CanvasTexture;
  redraw: (
    hour: number,
    t: number,
    rows: WhiteboardRow[],
    stats: { clipsShipped: number; renderQueue: number; avgClipSec: number },
  ) => void;
}

const WB_W = 512;
const WB_H = 304;

/** Live pipeline whiteboard: per-agent progress + floor totals. */
export function createWhiteboard(): WhiteboardTex {
  const canvas = makeCanvas(WB_W, WB_H);
  const ctx = ctx2d(canvas);
  const tex = toTexture(canvas);

  function redraw(
    hour: number,
    t: number,
    rows: WhiteboardRow[],
    stats: { clipsShipped: number; renderQueue: number; avgClipSec: number },
  ) {
    ctx.fillStyle = "#fdfdff";
    ctx.fillRect(0, 0, WB_W, WB_H);

    // title
    ctx.fillStyle = "#232746";
    ctx.font = "800 26px system-ui, sans-serif";
    ctx.fillText("CLIPYARD PIPELINE", 20, 40);
    ctx.font = "700 13px system-ui, sans-serif";
    ctx.fillStyle = "#8a90b8";
    ctx.fillText("LIVE · BAY 7 STUDIO FLOOR", 20, 62);

    // rows — fed from live job data (mock or n8n) with static fallback
    rows.forEach((row, i) => {
      const y = 92 + i * 32;
      ctx.fillStyle = row.color;
      ctx.beginPath();
      ctx.arc(28, y - 6, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#232746";
      ctx.font = "800 15px system-ui, sans-serif";
      ctx.fillText(row.name, 44, y);
      // bar
      const w = 240;
      const x = 120;
      ctx.fillStyle = "#edeffa";
      roundRect(ctx, x, y - 14, w, 15, 7);
      const wob = Math.sin(t * 0.35 + i * 1.7) * 0.02;
      const p = Math.min(0.99, Math.max(0.05, row.p + wob));
      ctx.fillStyle = row.failed ? "#e11d48" : row.color;
      roundRect(ctx, x, y - 14, w * p, 15, 7);
      ctx.fillStyle = row.failed ? "#e11d48" : "#8a90b8";
      ctx.font = "700 12px system-ui, sans-serif";
      ctx.fillText(row.failed ? "FAILED" : `${Math.round(p * 100)}%`, x + w + 12, y - 2);
    });

    // footer stats — live
    ctx.fillStyle = "#232746";
    ctx.font = "800 16px system-ui, sans-serif";
    ctx.fillText(`SHIPPED TODAY ${stats.clipsShipped.toLocaleString("en-US")}`, 20, WB_H - 18);
    ctx.fillStyle = "#8a90b8";
    ctx.fillText(`QUEUE ${stats.renderQueue}`, 300, WB_H - 18);
    ctx.fillText(`AVG ${stats.avgClipSec}s`, 420, WB_H - 18);
    tex.needsUpdate = true;
  }

  redraw(
    10.5,
    0,
    AGENTS.map((a) => ({ name: a.name, color: a.color, p: a.progress, failed: false })),
    { clipsShipped: 0, renderQueue: 0, avgClipSec: 42 },
  );
  return { tex, redraw };
}

/* ---------------------------------- small labels & posters ---------------------------------- */

/** Desk-front name tag (white, navy text, color dot). */
export function createDeskLabel(name: string, color: string) {
  const canvas = makeCanvas(256, 64);
  const ctx = ctx2d(canvas);
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, 0, 0, 256, 64, 14);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(30, 32, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#232746";
  ctx.font = "800 26px system-ui, sans-serif";
  ctx.fillText(name, 52, 41);
  return toTexture(canvas);
}

/** Wall poster pair for the studio walls. */
export function createPoster(kind: "play" | "hooks") {
  const canvas = makeCanvas(192, 256);
  const ctx = ctx2d(canvas);
  if (kind === "play") {
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, "#2e3192");
    g.addColorStop(1, "#6d28d9");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 192, 256);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(70, 78);
    ctx.lineTo(138, 118);
    ctx.lineTo(70, 158);
    ctx.closePath();
    ctx.fill();
    ctx.font = "800 26px system-ui, sans-serif";
    ctx.fillText("CLIP IT.", 48, 208);
  } else {
    ctx.fillStyle = "#fdfdff";
    ctx.fillRect(0, 0, 192, 256);
    const bars = ["#22d3ee", "#fbbf24", "#f472b6", "#34d399", "#a78bfa"];
    bars.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(24, 30 + i * 30, 120 - i * 12, 16);
    });
    ctx.fillStyle = "#232746";
    ctx.font = "800 24px system-ui, sans-serif";
    ctx.fillText("HOOK · 3s", 24, 216);
  }
  return toTexture(canvas);
}

/** Round lounge rug: soft rings. */
export function createRug() {
  const canvas = makeCanvas(256, 256);
  const ctx = ctx2d(canvas);
  const rings = ["#f6e3dd", "#f0d4cb", "#f6e3dd", "#ebc9bf", "#f6e3dd"];
  rings.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(128, 128, 128 - i * 26, 0, Math.PI * 2);
    ctx.fill();
  });
  return toTexture(canvas);
}

/** Subtle floor grid (near-white with lavender lines). */
export function createFloorGrid() {
  const canvas = makeCanvas(256, 256);
  const ctx = ctx2d(canvas);
  ctx.fillStyle = "#f4f5fc";
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = "#e4e7f5";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, 256, 256);
  ctx.beginPath();
  ctx.moveTo(128, 0);
  ctx.lineTo(128, 256);
  ctx.moveTo(0, 128);
  ctx.lineTo(256, 128);
  ctx.strokeStyle = "#eceef9";
  ctx.stroke();
  const tex = toTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(9, 6.5);
  return tex;
}

/** Soft radial blob shadow. */
export function createBlobShadow() {
  const canvas = makeCanvas(128, 128);
  const ctx = ctx2d(canvas);
  const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
  g.addColorStop(0, "rgba(35,39,70,0.32)");
  g.addColorStop(1, "rgba(35,39,70,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return toTexture(canvas);
}

/** "CREW GARAGE" placard for the diecast shelf. */
export function createGaragePlacard() {
  const canvas = makeCanvas(256, 72);
  const ctx = ctx2d(canvas);
  ctx.fillStyle = "#232746";
  roundRect(ctx, 0, 0, 256, 72, 16);
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 30px system-ui, sans-serif";
  ctx.fillText("CREW GARAGE", 22, 46);
  ctx.fillStyle = "#fbbf24";
  ctx.beginPath();
  ctx.arc(228, 36, 9, 0, Math.PI * 2);
  ctx.fill();
  return toTexture(canvas);
}

/* ---------------------------------- nameplate (hover sprite) ---------------------------------- */

/** Light-theme floating nameplate shown on hover / select / labels toggle. */
export function createNameplate(name: string, role: string, color: string) {
  const canvas = makeCanvas(320, 104);
  const ctx = ctx2d(canvas);
  redrawNameplateCanvas(ctx, name, role, color, false);
  const tex = toTexture(canvas);
  const redraw = (active: boolean) => {
    redrawNameplateCanvas(ctx, name, role, color, active);
    tex.needsUpdate = true;
  };
  return { tex, redraw };
}

function redrawNameplateCanvas(
  ctx: CanvasRenderingContext2D,
  name: string,
  role: string,
  color: string,
  active: boolean,
) {
  ctx.clearRect(0, 0, 320, 104);
  ctx.fillStyle = active ? "rgba(255,255,255,0.97)" : "rgba(255,255,255,0.88)";
  roundRect(ctx, 6, 8, 308, 88, 22);
  ctx.strokeStyle = active ? color : "rgba(35,39,70,0.16)";
  ctx.lineWidth = active ? 6 : 3;
  roundRectStroke(ctx, 6, 8, 308, 88, 22);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(46, 52, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 20px system-ui, sans-serif";
  ctx.fillText(name[0], 40, 59);
  ctx.fillStyle = "#232746";
  ctx.font = "800 26px system-ui, sans-serif";
  ctx.fillText(name, 78, 50);
  ctx.fillStyle = "#8a90b8";
  ctx.font = "600 16px system-ui, sans-serif";
  ctx.fillText(role.toUpperCase(), 78, 76);
}

/* ---------------------------------- shared path helpers ---------------------------------- */

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number | { tl: number; tr: number; bl: number; br: number },
) {
  const rad =
    typeof r === "number"
      ? { tl: r, tr: r, bl: r, br: r }
      : { tl: r.tl, tr: r.tr, bl: r.bl, br: r.br };
  ctx.beginPath();
  ctx.moveTo(x + rad.tl, y);
  ctx.lineTo(x + w - rad.tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad.tr);
  ctx.lineTo(x + w, y + h - rad.br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad.br, y + h);
  ctx.lineTo(x + rad.bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad.bl);
  ctx.lineTo(x, y + rad.tl);
  ctx.quadraticCurveTo(x, y, x + rad.tl, y);
  ctx.closePath();
  ctx.fill();
}

export function roundRectStroke(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.stroke();
}
