/**
 * Speech bubble rendering (Fase 10) — a small comic bubble (drei Html)
 * floating above the speaker's head, following the live pose registry
 * every frame so it tracks walking robots too. Border/icon take the
 * speaker's color; the bubble hides while its speaker hosts the POV.
 */
import { useRef } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  CheckCircle2,
  Clock3,
  Coffee,
  Hand,
  Moon,
  PartyPopper,
  Rocket,
  Sparkles,
  TriangleAlert,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { AGENTS, MANAGER } from "@/lib/hq-data";
import { robotPoses } from "@/lib/hq-robots";
import { useHqStore } from "@/lib/hq-store";
import { useBubbleStore, type Bubble, type BubbleIcon, type BubbleTone } from "@/lib/hq-bubbles";

const ICONS: Record<BubbleIcon, LucideIcon> = {
  coffee: Coffee,
  check: CheckCircle2,
  rocket: Rocket,
  alert: TriangleAlert,
  moon: Moon,
  spark: Sparkles,
  clock: Clock3,
  hand: Hand,
  wrench: Wrench,
  party: PartyPopper,
};

const TONE: Record<BubbleTone, { bg: string; fg: string }> = {
  plain: { bg: "#ffffff", fg: "#1e293b" },
  sukses: { bg: "#ecfdf5", fg: "#065f46" },
  error: { bg: "#fff1f2", fg: "#9f1239" },
  warning: { bg: "#fffbeb", fg: "#92400e" },
};

function BubbleView({ bubble, color }: { bubble: Bubble; color: string }) {
  const group = useRef<THREE.Group>(null);
  const Icon = ICONS[bubble.icon];
  const tone = TONE[bubble.tone];
  const offY = bubble.speaker === "manager" ? 2.12 : 2.04;

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const pose = robotPoses.get(bubble.speaker);
    const host = useHqStore.getState().povTarget === bubble.speaker;
    g.visible = !!pose && !host;
    if (pose) g.position.set(pose.x, pose.y + offY, pose.z);
  });

  // start at the head (not the world origin) before the first frame runs
  const p0 = robotPoses.get(bubble.speaker);

  return (
    <group ref={group} position={p0 ? [p0.x, p0.y + offY, p0.z] : [0, -10, 0]}>
      <Html center zIndexRange={[15, 0]} wrapperClass="hq-bubble-wrap" style={{ pointerEvents: "none" }}>
        <div
          className="hq-bubble relative flex items-center gap-1.5 whitespace-nowrap rounded-2xl border-2 px-2.5 py-1.5 text-[11px] font-bold shadow-[0_8px_20px_-8px_rgba(0,0,0,0.55)]"
          style={{ backgroundColor: tone.bg, color: tone.fg, borderColor: color }}
        >
          <Icon className="h-3.5 w-3.5 shrink-0" style={{ color }} />
          <span>{bubble.text}</span>
          <span
            className="absolute -bottom-[6px] left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-b-2 border-r-2"
            style={{ backgroundColor: tone.bg, borderColor: color }}
          />
        </div>
      </Html>
    </group>
  );
}

export function SpeechBubbles() {
  const bubbles = useBubbleStore((s) => s.bubbles);
  const profiles = useHqStore((s) => s.profiles);
  return (
    <>
      {bubbles.map((b) => (
        <BubbleView
          key={b.key}
          bubble={b}
          color={
            b.speaker === "manager"
              ? MANAGER.accent
              : (profiles[b.speaker]?.color ??
                AGENTS.find((a) => a.id === b.speaker)?.color ??
                "#94a3b8")
          }
        />
      ))}
    </>
  );
}
