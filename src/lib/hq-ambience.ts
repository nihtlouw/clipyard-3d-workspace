/**
 * CLIPYARD Studio ambience — fully synthesized with WebAudio (no audio files).
 * Soft studio hum + keyboard chatter while the crew is on shift + rare notify pings.
 * Started from a user gesture (the HUD "Suara" pill) so autoplay policies are happy.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { isOnShift, useHqStore } from "@/lib/hq-store";

interface Ambience {
  start: () => Promise<void>;
  stop: () => void;
}

function createAmbience(): Ambience {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let keyTimer: number | null = null;
  let pingTimer: number | null = null;
  let stopped = true;

  function noiseBuffer(seconds: number, brown: boolean) {
    const ac = ctx!;
    const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * seconds), ac.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      if (brown) {
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.2;
      } else {
        data[i] = white;
      }
    }
    return buf;
  }

  function keyClick() {
    if (!ctx || !master) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(0.03 + Math.random() * 0.02, false);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1700 + Math.random() * 1900;
    bp.Q.value = 1.1;
    const g = ctx.createGain();
    const peak = 0.028 + Math.random() * 0.05;
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.05);
    src.connect(bp).connect(g).connect(master);
    src.start(t);
    src.stop(t + 0.07);
  }

  function ping() {
    if (!ctx || !master) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(620, t);
    osc.frequency.exponentialRampToValueAtTime(930, t + 0.16);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.022, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + 0.55);
  }

  function scheduleLoop() {
    // keyboard chatter only while the crew is on shift
    keyTimer = window.setInterval(() => {
      if (!ctx) return;
      const { hour } = useHqStore.getState();
      if (isOnShift(hour) && Math.random() > 0.25) keyClick();
    }, 95);
    const pingLoop = () => {
      pingTimer = window.setInterval(() => {
        if (!ctx) return;
        const { hour } = useHqStore.getState();
        if (isOnShift(hour)) ping();
      }, 9000);
    };
    pingLoop();
  }

  return {
    async start() {
      if (!stopped) return;
      stopped = false;
      const AC = window.AudioContext ?? (window as any).webkitAudioContext;
      ctx = new AC();
      await ctx.resume();
      master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 1.2);
      master.connect(ctx.destination);

      // room tone: filtered brown noise
      const hum = ctx.createBufferSource();
      hum.buffer = noiseBuffer(2.5, true);
      hum.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 170;
      const humGain = ctx.createGain();
      humGain.gain.value = 0.16;
      hum.connect(lp).connect(humGain).connect(master);
      hum.start();

      // faint electrical hum
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = 61;
      const oscGain = ctx.createGain();
      oscGain.gain.value = 0.012;
      osc.connect(oscGain).connect(master);
      osc.start();

      scheduleLoop();
    },
    stop() {
      stopped = true;
      if (keyTimer !== null) window.clearInterval(keyTimer);
      if (pingTimer !== null) window.clearInterval(pingTimer);
      keyTimer = null;
      pingTimer = null;
      if (ctx && master) {
        const t = ctx.currentTime;
        master.gain.cancelScheduledValues(t);
        master.gain.setValueAtTime(master.gain.value, t);
        master.gain.linearRampToValueAtTime(0.0001, t + 0.4);
        const ac = ctx;
        window.setTimeout(() => {
          ac.close().catch(() => {});
        }, 600);
      }
      ctx = null;
      master = null;
    },
  };
}

/** React hook for the HUD pill: [soundOn, toggleSound]. */
export function useAmbience() {
  const ambience = useRef<Ambience | null>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    ambience.current = createAmbience();
    return () => {
      ambience.current?.stop();
      ambience.current = null;
    };
  }, []);

  const toggle = useCallback(() => {
    const a = ambience.current;
    if (!a) return;
    setOn((prev) => {
      if (prev) {
        a.stop();
        return false;
      }
      a.start().catch(() => {});
      return true;
    });
  }, []);

  return [on, toggle] as const;
}
