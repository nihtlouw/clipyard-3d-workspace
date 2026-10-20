/**
 * CLIPYARD Studio — procedural canvas textures.
 * Everything is drawn on <canvas>; no external image assets.
 * Textures are created once (useMemo upstream) and redrawn in place
 * on gated ticks so we never allocate per frame.
 */
import * as THREE from "three";
import { AGENTS, type AgentInfo } from "@/lib/hq-data";
import type { JobStatus } from "@/lib/hq-jobs";
import { realHourNow } from "@/lib/hq-store-helpers";

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

/** Big window view: city skyline whose sky follows the real clock. */
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
    // sky gradient — deep navy at night (reference windows read near-black blue)
    const top = mixColor([13, 19, 46], [126, 176, 235], daylight);
    if (sunset > 0) blendInto(top, [244, 154, 104], sunset * 0.75);
    const bottom = mixColor([34, 44, 86], [214, 232, 248], daylight);
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
    realHourNow(),
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

/** Wall posters for the studio walls. */
export function createPoster(kind: "play" | "hooks" | "chart" | "team") {
  const canvas = makeCanvas(192, 256);
  const ctx = ctx2d(canvas);
  if (kind === "chart") {
    ctx.fillStyle = "#fdfdff";
    ctx.fillRect(0, 0, 192, 256);
    const bars = [42, 74, 58, 96, 120];
    bars.forEach((h, i) => {
      ctx.fillStyle = ["#22d3ee", "#a78bfa", "#fbbf24", "#34d399", "#f472b6"][i];
      roundRect(ctx, 26 + i * 30, 190 - h, 22, h, 5);
    });
    ctx.strokeStyle = "#047857";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(30, 150);
    ctx.lineTo(160, 52);
    ctx.stroke();
    ctx.fillStyle = "#047857";
    ctx.beginPath();
    ctx.moveTo(160, 52);
    ctx.lineTo(136, 48);
    ctx.lineTo(152, 72);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#232746";
    ctx.font = "800 22px system-ui, sans-serif";
    ctx.fillText("CTR +62%", 30, 232);
    return toTexture(canvas);
  }
  if (kind === "team") {
    ctx.fillStyle = "#2e3192";
    ctx.fillRect(0, 0, 192, 256);
    const cols = ["#22d3ee", "#fbbf24", "#f472b6", "#34d399", "#a78bfa", "#fb923c"];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        ctx.fillStyle = cols[(r * 4 + c) % cols.length];
        ctx.beginPath();
        ctx.arc(44 + c * 34, 74 + r * 40, 11, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 24px system-ui, sans-serif";
    ctx.fillText("6 AGENTS", 42, 216);
    return toTexture(canvas);
  }
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

/** Round lounge rug: striped medallion with dashed rim. */
export function createRug() {
  const canvas = makeCanvas(256, 256);
  const ctx = ctx2d(canvas);
  const rings = ["#f2dfd6", "#e9cfc2", "#f2dfd6", "#e3c2b2", "#f2dfd6"];
  rings.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(128, 128, 128 - i * 24, 0, Math.PI * 2);
    ctx.fill();
  });
  // radial dashes on the middle band
  ctx.strokeStyle = "#c9a08e";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  for (let a = 0; a < 24; a++) {
    const ang = (a / 24) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(128 + Math.cos(ang) * 62, 128 + Math.sin(ang) * 62);
    ctx.lineTo(128 + Math.cos(ang) * 76, 128 + Math.sin(ang) * 76);
    ctx.stroke();
  }
  // center dot
  ctx.fillStyle = "#cf7350";
  ctx.beginPath();
  ctx.arc(128, 128, 14, 0, Math.PI * 2);
  ctx.fill();
  return toTexture(canvas);
}

/** Warm light-oak plank floor (procedural grain, staggered joints). */
export function createFloorWood() {
  const canvas = makeCanvas(256, 256);
  const ctx = ctx2d(canvas);
  const rows = 6;
  const rh = 256 / rows;
  const tones = ["#e7d7ba", "#e1d0ae", "#e9dcc3", "#ddc9a4", "#e4d3b6", "#e6dabe"];
  const rnd = seededRandom(88);
  for (let r = 0; r < rows; r++) {
    ctx.fillStyle = tones[r % tones.length];
    ctx.fillRect(0, r * rh, 256, rh);
    // grain streaks
    for (let g = 0; g < 7; g++) {
      ctx.strokeStyle = rnd() > 0.5 ? "rgba(160,125,80,0.16)" : "rgba(255,246,225,0.22)";
      ctx.lineWidth = 1 + rnd() * 1.4;
      const y = r * rh + 4 + rnd() * (rh - 8);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(80, y + (rnd() - 0.5) * 5, 170, y + (rnd() - 0.5) * 5, 256, y);
      ctx.stroke();
    }
    // plank seam + staggered end joints
    ctx.fillStyle = "rgba(120,90,55,0.28)";
    ctx.fillRect(0, r * rh, 256, 2);
    const joint = Math.floor(rnd() * 200) + 28;
    ctx.fillRect(joint, r * rh, 2, rh);
  }
  const tex = toTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 3.4);
  return tex;
}

/** Soft radial blob shadow. */
/** soft radial glow sprite (night light pools / bulbs) */
export function createGlowSprite() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.4, "rgba(255,255,255,0.45)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

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

/* ---------------------------------- nameplate (hover sprite) ---------------------------------- */

/**
 * Floating nameplate, reference-style: colored pill with the agent name and
 * a live status ("AKIRA · ng-routing" / "PIXEL · minta OK" / "NOVA · rehat").
 */
export function createNameplate(name: string, color: string) {
  const canvas = makeCanvas(360, 84);
  const ctx = ctx2d(canvas);
  const tex = toTexture(canvas);
  let lastText = "";
  let curName = name;
  let curColor = color;
  const redraw = (status: string, force = false) => {
    const next = status.slice(0, 26);
    if (!force && next === lastText) return;
    lastText = next;
    ctx.clearRect(0, 0, 360, 84);
    // dark glass pill (matches the night diorama + dark HUD)
    ctx.fillStyle = "rgba(13,17,34,0.92)";
    const text = `${curName}  ·  ${next}`;
    ctx.font = "800 30px system-ui, sans-serif";
    const w = ctx.measureText(text).width + 74;
    roundRect(ctx, (360 - w) / 2, 12, w, 60, 30);
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 2;
    roundRectStroke(ctx, (360 - w) / 2, 12, w, 60, 30);
    // agent-color dot + initial
    ctx.fillStyle = curColor;
    ctx.beginPath();
    ctx.arc((360 - w) / 2 + 26, 42, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0d1120";
    ctx.font = "800 20px system-ui, sans-serif";
    ctx.fillText(curName[0] ?? "?", (360 - w) / 2 + 20, 49);
    // label
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 30px system-ui, sans-serif";
    ctx.fillText(text, (360 - w) / 2 + 50, 53);
    tex.needsUpdate = true;
  };
  /** Fase 6: profile edits (name/color) repaint the plate without a rebuild. */
  const setIdentity = (nextName: string, nextColor: string) => {
    if (nextName === curName && nextColor === curColor) return;
    curName = nextName;
    curColor = nextColor;
    redraw(lastText, true);
  };
  redraw("");
  return { tex, redraw, setIdentity };
}

/* ---------------------------------- signs, screens & props ---------------------------------- */

/** Wall sign: white plate, navy bold text, accent dot. */
export function createSign(text: string, accent: string, w = 256, h = 72) {
  const canvas = makeCanvas(w, h);
  const ctx = ctx2d(canvas);
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, 0, 0, w, h, 16);
  ctx.strokeStyle = "rgba(35,39,70,0.14)";
  ctx.lineWidth = 3;
  roundRectStroke(ctx, 0, 0, w, h, 16);
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(28, h / 2, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#232746";
  ctx.font = "800 28px system-ui, sans-serif";
  ctx.fillText(text, 50, h / 2 + 10);
  return toTexture(canvas);
}

/** Dark wall sign: navy plate, white bold text, glowing accent dot. */
export function createDarkSign(text: string, accent: string, w = 384, h = 96) {
  const canvas = makeCanvas(w, h);
  const ctx = ctx2d(canvas);
  ctx.fillStyle = "#232746";
  roundRect(ctx, 0, 0, w, h, 20);
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(38, h / 2, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 40px system-ui, sans-serif";
  ctx.fillText(text, 66, h / 2 + 14);
  return toTexture(canvas);
}

/** Meeting-room TV: CLIPYARD branding + big live sim time + workday progress. */
export function createMeetingScreen() {
  const canvas = makeCanvas(512, 288);
  const ctx = ctx2d(canvas);
  const tex = toTexture(canvas);
  const redraw = (hour: number, onShift: boolean) => {
    ctx.fillStyle = "#141834";
    ctx.fillRect(0, 0, 512, 288);
    ctx.fillStyle = "#22d3ee";
    ctx.font = "800 26px system-ui, sans-serif";
    ctx.fillText("CLIPYARD", 28, 46);
    ctx.fillStyle = "#8a90b8";
    ctx.font = "700 16px system-ui, sans-serif";
    ctx.fillText("STANDUP · BAY 7", 170, 46);
    // big time
    const hh = String(Math.floor(hour) % 24).padStart(2, "0");
    const mm = String(Math.floor((hour - Math.floor(hour)) * 60)).padStart(2, "0");
    ctx.fillStyle = "#f4f6ff";
    ctx.font = "800 108px ui-monospace, monospace";
    ctx.fillText(`${hh}.${mm}`, 28, 176);
    // shift progress bar
    const p = Math.min(1, Math.max(0, (hour - 9) / 8));
    ctx.fillStyle = "#252a4d";
    roundRect(ctx, 28, 216, 456, 16, 8);
    ctx.fillStyle = onShift ? "#34d399" : "#a78bfa";
    roundRect(ctx, 28, 216, 456 * p, 16, 8);
    ctx.fillStyle = "#8a90b8";
    ctx.font = "700 15px system-ui, sans-serif";
    ctx.fillText(onShift ? "WORKDAY IN PROGRESS" : "OFF SHIFT — SEE YOU AT 09:00", 28, 262);
    tex.needsUpdate = true;
  };
  redraw(realHourNow(), true);
  return { tex, redraw };
}

/** Vending machine front: glowing snack/coffee rows. */
export function createVendingFront() {
  const canvas = makeCanvas(192, 320);
  const ctx = ctx2d(canvas);
  ctx.fillStyle = "#1c2140";
  roundRect(ctx, 0, 0, 192, 320, 12);
  ctx.fillStyle = "#232a52";
  roundRect(ctx, 14, 16, 120, 226, 8);
  const rnd = seededRandom(4242);
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 3; c++) {
      const colors = ["#fbbf24", "#f472b6", "#34d399", "#22d3ee", "#f97316"];
      ctx.fillStyle = colors[Math.floor(rnd() * colors.length)];
      roundRect(ctx, 24 + c * 38, 28 + r * 42, 28, 30, 5);
    }
  }
  ctx.fillStyle = "#0e1229";
  roundRect(ctx, 142, 16, 36, 120, 8);
  ctx.fillStyle = "#f4f6ff";
  ctx.font = "800 17px system-ui, sans-serif";
  ctx.save();
  ctx.translate(166, 240);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("KOPI 24/7", 0, 0);
  ctx.restore();
  ctx.fillStyle = "#8a90b8";
  roundRect(ctx, 24, 262, 154, 22, 6);
  return toTexture(canvas);
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
