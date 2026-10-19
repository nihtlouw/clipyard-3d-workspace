/**
 * Markdown studio report builder — shared by the /laporan page and the
 * automatic daily report (Fase 7: generated when the sim clock crosses
 * 13:00, the old "standup" moment) which files itself into Dokumen.
 *
 * Takes a structural snapshot of the HQ store so this module never imports
 * the store itself (the store imports us for the auto-report trigger).
 */
import { AGENTS, type AgentId } from "@/lib/hq-data";
import { useDocsStore } from "@/lib/hq-documents";
import { currentJobFor, type ApprovalRequest, type ClipJob, type FloorStats } from "@/lib/hq-jobs";
import type { ConnectorConfig } from "@/lib/hq-connector";
import type { AgentProfile } from "@/lib/hq-profiles";

export interface ReportInput {
  floorSource: "sim" | "live";
  floorUpdatedAt: number;
  connector: ConnectorConfig;
  stats: FloorStats;
  jobs: ClipJob[];
  approvals: ApprovalRequest[];
  profiles: Record<AgentId, AgentProfile>;
  outputs: Array<{ agentId: AgentId }>;
  actions: number;
  feed: Array<{ ts: number; text: string }>;
}

export function buildReport(s: ReportInput): string {
  const now = new Date();
  const lines: string[] = [
    `# Laporan Studio — ${now.toLocaleString("id-ID")}`,
    "",
    `Sumber lantai: **${s.floorSource === "live" ? `LIVE (${s.connector.floorUrl})` : "SIM (simulator)"}** · snapshot terakhir: ${
      s.floorUpdatedAt ? new Date(s.floorUpdatedAt).toLocaleTimeString("id-ID") : "-"
    }`,
    "",
    "## Ringkasan produksi",
    "",
    `| Metrik | Nilai |`,
    `| --- | ---: |`,
    `| Klip terkirim | ${s.stats.clipsShipped} |`,
    `| Antrean render | ${s.stats.renderQueue} |`,
    `| Rata-rata durasi klip | ${s.stats.avgClipSec} dtk |`,
    `| Channel terisi | ${s.stats.channelsFed} |`,
    `| Token keluar | ${s.stats.tokensOut ?? 0} |`,
    `| Hasil selesai (arsip browser) | ${s.outputs.length} |`,
    `| Aksi tercatat (sesi ini) | ${s.actions} |`,
    "",
    "## Status agen",
    "",
    "| Agen | Peran | Mode kerja | Tugas sekarang | Status | Progres | Selesai (arsip) |",
    "| --- | --- | --- | --- | --- | ---: | ---: |",
  ];
  for (const a of AGENTS) {
    const p = s.profiles[a.id];
    const job = currentJobFor(a.id, s.jobs);
    const done = s.outputs.filter((o) => o.agentId === a.id).length;
    const mode = !p.enabled
      ? "nonaktif"
      : p.workMode === "schedule"
        ? `jadwal ${String(p.scheduleStart).padStart(2, "0")}.00–${String(p.scheduleEnd).padStart(2, "0")}.00`
        : "24/7";
    lines.push(
      `| ${p.name} | ${p.role} | ${mode} | ${job ? job.title : "—"} | ${job ? job.status : p.enabled ? "idle" : "nonaktif"} | ${job ? `${Math.round(job.progress * 100)}%` : "—"} | ${done} |`,
    );
  }
  lines.push("", "## Approval yang masih menunggu", "");
  if (s.approvals.length === 0) {
    lines.push("_Tidak ada — lantai bersih._");
  } else {
    for (const a of s.approvals) {
      lines.push(`- [${s.profiles[a.agentId]?.name ?? a.agentId.toUpperCase()}] ${a.title}${a.detail ? ` — ${a.detail}` : ""}`);
    }
  }
  lines.push("", "## Aktivitas terakhir (20)", "");
  for (const e of s.feed.slice(0, 20)) {
    lines.push(`- ${new Date(e.ts).toLocaleTimeString("id-ID")} · ${e.text}`);
  }
  lines.push("", "---", "_Dibuat otomatis oleh Clipyard Studio._");
  return lines.join("\n");
}

/** Files a fresh report into the Dokumen store. Returns the doc title. */
export function saveAutoDailyReport(s: ReportInput): string {
  const title = `Laporan harian otomatis · ${new Date().toLocaleString("id-ID")}`;
  useDocsStore.getState().addDoc({
    title,
    type: "lainnya",
    status: "draft",
    body: buildReport(s),
    tags: ["laporan", "otomatis"],
  });
  return title;
}
