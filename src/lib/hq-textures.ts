import * as THREE from "three";

/**
 * Procedural canvas textures for the CLIPYARD warehouse —
 * no external assets, everything code-drawn.
 */

function makeCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext("2d") as CanvasRenderingContext2D };
}

function toTexture(c: HTMLCanvasElement, repeat: [number, number] = [1, 1]) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Corrugated warehouse metal siding. */
export function corrugatedTexture(base = "#8d97a8", dark = "#6b7484", repeat: [number, number] = [6, 2]) {
  const { c, ctx } = makeCanvas(256, 256);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  const rib = 16;
  for (let x = 0; x < 256; x += rib) {
    const g = ctx.createLinearGradient(x, 0, x + rib, 0);
    g.addColorStop(0, dark);
    g.addColorStop(0.35, base);
    g.addColorStop(0.7, "#c3cad6");
    g.addColorStop(1, dark);
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, rib, 256);
  }
  // grime + panel seams
  for (let i = 0; i < 220; i++) {
    ctx.fillStyle = `rgba(30,36,48,${0.03 + Math.random() * 0.07})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 20, 1 + Math.random() * 3);
  }
  ctx.fillStyle = "rgba(20,24,32,0.5)";
  for (let y = 0; y < 256; y += 64) ctx.fillRect(0, y, 256, 2);
  return toTexture(c, repeat);
}

/** Polished concrete floor with subtle stains. */
export function concreteTexture(repeat: [number, number] = [10, 8], tint = "#aeb6c2") {
  const { c, ctx } = makeCanvas(256, 256);
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    const v = 150 + Math.random() * 80;
    ctx.fillStyle = `rgba(${v},${v + 4},${v + 10},${0.05 + Math.random() * 0.12})`;
    const r = 1 + Math.random() * 14;
    ctx.beginPath();
    ctx.arc(Math.random() * 256, Math.random() * 256, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // expansion joints
  ctx.strokeStyle = "rgba(70,78,92,0.35)";
  ctx.lineWidth = 2;
  for (let i = 0; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo((i * 256) / 2, 0);
    ctx.lineTo((i * 256) / 2, 256);
    ctx.moveTo(0, (i * 256) / 2);
    ctx.lineTo(256, (i * 256) / 2);
    ctx.stroke();
  }
  return toTexture(c, repeat);
}

/** Outdoor asphalt. */
export function asphaltTexture(repeat: [number, number] = [14, 14]) {
  const { c, ctx } = makeCanvas(256, 256);
  ctx.fillStyle = "#3d424b";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1200; i++) {
    const v = 40 + Math.random() * 60;
    ctx.fillStyle = `rgba(${v},${v},${v + 6},${0.12 + Math.random() * 0.25})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 4, 1 + Math.random() * 4);
  }
  for (let i = 0; i < 24; i++) {
    ctx.fillStyle = `rgba(24,26,32,${0.08 + Math.random() * 0.1})`;
    ctx.beginPath();
    ctx.arc(Math.random() * 256, Math.random() * 256, 6 + Math.random() * 22, 0, Math.PI * 2);
    ctx.fill();
  }
  return toTexture(c, repeat);
}

/** Painted line strip (white / yellow) as a tiny texture so lines can be instanced cheaply. */
export function lineTexture(color = "#e8ecf2") {
  const { c, ctx } = makeCanvas(8, 8);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 8, 8);
  return toTexture(c);
}

/** Wood desk top. */
export function woodTexture(repeat: [number, number] = [2, 1]) {
  const { c, ctx } = makeCanvas(256, 256);
  ctx.fillStyle = "#8a6a48";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) {
    ctx.strokeStyle = `rgba(70,48,28,${0.12 + Math.random() * 0.2})`;
    ctx.lineWidth = 1 + Math.random() * 3;
    ctx.beginPath();
    const y = Math.random() * 256;
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(80, y + (Math.random() * 14 - 7), 170, y + (Math.random() * 14 - 7), 256, y + (Math.random() * 8 - 4));
    ctx.stroke();
  }
  return toTexture(c, repeat);
}

/* ---------------------------------- signs & screens ---------------------------------- */

/** Glowing neon-style sign (used for facade + interior walls). */
export function signTexture(
  text: string,
  glow: string,
  opts?: { sub?: string; bg?: string; font?: number },
) {
  const { c, ctx } = makeCanvas(1024, 320);
  ctx.fillStyle = opts?.bg ?? "#0b1220";
  ctx.fillRect(0, 0, 1024, 320);
  // subtle panel
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 6;
  ctx.strokeRect(14, 14, 996, 292);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `900 ${opts?.font ?? 170}px 'Arial Black', Arial, sans-serif`;
  ctx.shadowColor = glow;
  ctx.shadowBlur = 46;
  ctx.fillStyle = glow;
  ctx.fillText(text, 512, opts?.sub ? 138 : 160);
  ctx.shadowBlur = 18;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, 512, opts?.sub ? 138 : 160);
  if (opts?.sub) {
    ctx.shadowBlur = 24;
    ctx.font = "700 52px Arial, sans-serif";
    ctx.fillStyle = glow;
    ctx.fillText(opts.sub, 512, 236);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(235,240,255,0.9)";
    ctx.fillText(opts.sub, 512, 236);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Animated-style clip timeline UI. Create once, then `redrawScreen` to animate. */
export function screenTexture(variant: number, accent: string, t: number) {
  const { c, ctx } = makeCanvas(512, 288);
  drawScreenFrame(ctx, variant, accent, t);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Redraw an existing screen texture in place (cheap animated UI at ~4 fps). */
export function redrawScreen(tex: THREE.CanvasTexture, variant: number, accent: string, t: number) {
  const c = tex.image as HTMLCanvasElement;
  const ctx = c.getContext("2d");
  if (!ctx) return;
  drawScreenFrame(ctx, variant, accent, t);
  tex.needsUpdate = true;
}

function drawScreenFrame(ctx: CanvasRenderingContext2D, variant: number, accent: string, t: number) {
  ctx.fillStyle = "#0a0f1c";
  ctx.fillRect(0, 0, 512, 288);

  if (variant % 3 === 0) {
    // EDIT TIMELINE
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(16, 16, 480, 60);
    ctx.fillStyle = accent;
    for (let i = 0; i < 22; i++) {
      const w = 12 + ((i * 7 + variant * 13) % 26);
      const x = 22 + i * 21;
      const h = 10 + (Math.sin(t * 1.4 + i * 0.7 + variant) * 0.5 + 0.5) * 38;
      ctx.fillRect(x, 66 - h, w * 0.7, h);
    }
    const lanes = [110, 162, 214];
    lanes.forEach((y, li) => {
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fillRect(16, y - 22, 480, 40);
      for (let i = 0; i < 8; i++) {
        const seed = (i * 31 + li * 17 + variant * 7) % 40;
        const x = 22 + ((i * 58 + seed + Math.floor(t * 6) * 2) % 440);
        const w = 34 + (seed % 50);
        ctx.fillStyle = i % 3 === 0 ? accent : i % 3 === 1 ? "#3b4a6b" : "#1f2a44";
        ctx.globalAlpha = 0.85;
        ctx.fillRect(x, y - 16, w, 30);
        ctx.globalAlpha = 1;
      }
    });
  } else if (variant % 3 === 1) {
    // RENDER PIPELINE
    ctx.fillStyle = accent;
    ctx.font = "700 26px Arial, sans-serif";
    ctx.fillText("RENDER PIPELINE", 22, 44);
    for (let i = 0; i < 5; i++) {
      const y = 76 + i * 40;
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      ctx.fillRect(22, y, 468, 22);
      const p = (Math.sin(t * 0.9 + i * 1.1 + variant) * 0.5 + 0.5) * 0.85 + 0.12;
      const g = ctx.createLinearGradient(22, 0, 490, 0);
      g.addColorStop(0, accent);
      g.addColorStop(1, "#ffffff");
      ctx.fillStyle = g;
      ctx.fillRect(22, y, 468 * p, 22);
      ctx.fillStyle = "#0a0f1c";
      ctx.font = "700 14px Arial, sans-serif";
      ctx.fillText(`BATCH ${i + 1} · ${Math.round(p * 100)}%`, 32, y + 16);
    }
  } else {
    // ANALYTICS / WAVEFORM
    ctx.fillStyle = accent;
    ctx.font = "700 24px Arial, sans-serif";
    ctx.fillText("CLIP RETENTION", 22, 40);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 0; x <= 468; x += 6) {
      const y = 160 - Math.sin(x * 0.02 + t * 1.2 + variant) * 44 - Math.sin(x * 0.05 + t * 0.7) * 18;
      if (x === 0) ctx.moveTo(22 + x, y);
      else ctx.lineTo(22 + x, y);
    }
    ctx.stroke();
    for (let i = 0; i < 30; i++) {
      const h = 16 + (Math.sin(i * 0.9 + t * 2 + variant) * 0.5 + 0.5) * 70;
      ctx.fillStyle = i % 4 === 0 ? accent : "rgba(255,255,255,0.16)";
      ctx.fillRect(24 + i * 16, 252 - h, 10, h);
    }
  }
}

/** Big ops wall board. */
export function opsBoardTexture(t: number) {
  const { c, ctx } = makeCanvas(1024, 512);
  drawOpsBoard(ctx, t);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function redrawOpsBoard(tex: THREE.CanvasTexture, t: number) {
  const c = tex.image as HTMLCanvasElement;
  const ctx = c.getContext("2d");
  if (!ctx) return;
  drawOpsBoard(ctx, t);
  tex.needsUpdate = true;
}

function drawOpsBoard(ctx: CanvasRenderingContext2D, t: number) {
  ctx.fillStyle = "#070c17";
  ctx.fillRect(0, 0, 1024, 512);
  ctx.fillStyle = "#22d3ee";
  ctx.font = "900 54px 'Arial Black', Arial, sans-serif";
  ctx.fillText("CLIPYARD OPS", 40, 74);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "600 26px Arial, sans-serif";
  ctx.fillText("AUTONOMOUS CLIP FACTORY · BAY 7", 40, 112);

  const boxes: [string, string, string][] = [
    ["CLIPS SHIPPED", String(1284 + (Math.floor(t * 2) % 40)), "#34d399"],
    ["RENDER QUEUE", String(30 + (Math.floor(t) % 12)), "#fbbf24"],
    ["AVG CLIP TIME", `${(42 + Math.sin(t) * 3).toFixed(0)}s`, "#a78bfa"],
    ["CHANNELS FED", "46", "#f472b6"],
  ];
  boxes.forEach(([label, val, col], i) => {
    const x = 40 + (i % 2) * 490;
    const y = 160 + Math.floor(i / 2) * 160;
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(x, y, 450, 130);
    ctx.fillStyle = col;
    ctx.font = "700 26px Arial, sans-serif";
    ctx.fillText(label, x + 24, y + 44);
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 62px 'Arial Black', Arial, sans-serif";
    ctx.fillText(val, x + 24, y + 108);
  });

  for (let i = 0; i < 32; i++) {
    const h = 20 + (Math.sin(i * 0.6 + t * 1.5) * 0.5 + 0.5) * 26;
    ctx.fillStyle = i % 5 === 0 ? "#22d3ee" : "rgba(255,255,255,0.12)";
    ctx.fillRect(40 + i * 30, 492 - h, 18, h);
  }
}

/** Floating nameplate sprite for an agent (canvas-drawn pill). */
export function nameplateTexture(name: string, role: string, color: string, active: boolean) {
  const { c, ctx } = makeCanvas(512, 168);
  drawNameplate(ctx, name, role, color, active);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function redrawNameplate(tex: THREE.CanvasTexture, name: string, role: string, color: string, active: boolean) {
  const c = tex.image as HTMLCanvasElement;
  const ctx = c.getContext("2d");
  if (!ctx) return;
  drawNameplate(ctx, name, role, color, active);
  tex.needsUpdate = true;
}

function drawNameplate(ctx: CanvasRenderingContext2D, name: string, role: string, color: string, active: boolean) {
  const W = 512;
  const H = 168;
  ctx.clearRect(0, 0, W, H);
  const pad = active ? 10 : 14;
  const r = 58;
  ctx.beginPath();
  ctx.roundRect(pad, pad, W - pad * 2, H - pad * 2, r);
  ctx.fillStyle = active ? "rgba(10,16,28,0.94)" : "rgba(10,16,28,0.82)";
  ctx.fill();
  ctx.lineWidth = active ? 8 : 5;
  ctx.strokeStyle = color;
  if (active) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 26;
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
  // dot
  ctx.beginPath();
  ctx.arc(58, 62, 15, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  // name line
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 52px 'Arial Black', Arial, sans-serif";
  ctx.fillText(name, 92, 62);
  // role line — auto-shrink to fit
  let roleSize = 32;
  ctx.font = `600 ${roleSize}px Arial, sans-serif`;
  const roleW = ctx.measureText(role).width;
  const maxRoleW = W - 92 - 26;
  if (roleW > maxRoleW && roleW > 0) {
    roleSize = Math.max(20, Math.floor(roleSize * (maxRoleW / roleW)));
    ctx.font = `600 ${roleSize}px Arial, sans-serif`;
  }
  ctx.fillStyle = "rgba(226,232,240,0.8)";
  ctx.fillText(role, 92, 118);
}
