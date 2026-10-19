import type { ComponentType, ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Bot,
  FileText,
  Files,
  PlugZap,
} from "lucide-react";
import { useHqStore } from "@/lib/hq-store";

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

export const DASH_NAV: NavItem[] = [
  { to: "/aktivitas", label: "Aktivitas", icon: Activity },
  { to: "/statistik", label: "Statistik", icon: BarChart3 },
  { to: "/laporan", label: "Laporan", icon: FileText },
  { to: "/dokumen", label: "Dokumen", icon: Files },
  { to: "/agen", label: "Agen", icon: Bot },
  { to: "/konektor", label: "Konektor", icon: PlugZap },
];

/**
 * Page chrome for the management dashboard: header with a way back to the 3D
 * floor, live source indicator, and nav. The floor feed keeps running behind
 * these pages (initialized at app root), so numbers stay live everywhere.
 */
export function DashShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const floorSource = useHqStore((s) => s.floorSource);
  const floorUpdatedAt = useHqStore((s) => s.floorUpdatedAt);
  const pending = useHqStore((s) => s.approvals.length);

  return (
    <div className="min-h-screen bg-hq-bg text-hq-text">
      <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-5 sm:py-6">
        <header className="flex flex-wrap items-center gap-3">
          <Link
            to="/hq"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-[12px] font-bold transition hover:bg-white/10"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Studio 3D
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold leading-tight sm:text-2xl">{title}</h1>
            {subtitle && <p className="text-[12px] text-hq-muted">{subtitle}</p>}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {pending > 0 && (
              <span className="rounded-full bg-amber-400/20 px-2.5 py-1 text-[11px] font-bold text-amber-300">
                {pending} approval menunggu
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold tracking-wide ${
                floorSource === "live" ? "bg-emerald-400/20 text-emerald-300" : "bg-white/10 text-hq-muted"
              }`}
              title={
                floorUpdatedAt
                  ? `Snapshot terakhir ${new Date(floorUpdatedAt).toLocaleTimeString("id-ID")}`
                  : "Belum ada snapshot"
              }
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  floorSource === "live" ? "bg-emerald-300" : "bg-hq-muted"
                } ${floorSource === "live" ? "animate-pulse" : ""}`}
              />
              {floorSource === "live" ? "LIVE · pipeline asli" : "SIM · simulator"}
            </span>
          </div>
        </header>

        <nav className="mt-4 flex gap-1.5 overflow-x-auto pb-1">
          {DASH_NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold transition ${
                  active
                    ? "bg-sky-500 text-white"
                    : "border border-white/12 bg-white/5 text-hq-muted hover:bg-white/10 hover:text-hq-text"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <main className="mt-4 grid gap-4">{children}</main>
      </div>
    </div>
  );
}
