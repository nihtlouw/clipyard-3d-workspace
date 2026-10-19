/** Small pure helpers shared by the store and components (no zustand import). */

/** Shift helpers (Mon–Fri 09:00–17:00 — the diorama runs it every day). */
export function isOnShift(hour: number) {
  return hour >= 9 && hour < 17;
}

export function formatHour(hour: number) {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour - Math.floor(hour)) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Sun/sky state for a simulated hour (0–24). */
export function dayFactors(hour: number) {
  const theta = ((hour - 6) / 12) * Math.PI;
  const sunY = Math.sin(theta);
  const daylight = Math.min(1, Math.max(0, sunY * 1.55));
  const night = 1 - daylight;
  const sunset = Math.min(1, Math.max(0, 1 - Math.abs(sunY) * 2.4));
  return { theta, sunY, daylight, night, sunset };
}

/** Compact Indonesian number format: 77.8rb / 3.1jt. */
export function formatShort(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}jt`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}rb`;
  return String(Math.round(n));
}

/** Relative "x mnt lalu" for feed timestamps. */
export function timeAgo(ts: number, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return "baru";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} mnt`;
  return `${Math.round(m / 60)} jam`;
}
