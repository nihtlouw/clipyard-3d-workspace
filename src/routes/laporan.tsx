import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Copy, Download, FilePlus2 } from "lucide-react";
import { DashShell } from "@/components/dash/shell";
import { Panel, btnGhost, btnPrimary } from "@/components/dash/ui";
import { AGENTS } from "@/lib/hq-data";
import { useDocsStore } from "@/lib/hq-documents";
import { currentJobFor } from "@/lib/hq-jobs";
import { useHqStore } from "@/lib/hq-store";

export const Route = createFileRoute("/laporan")({
  component: LaporanPage,
});

function buildReport(): string {
  const s = useHqStore.getState();
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
    "| Agen | Peran | Tugas sekarang | Status | Progres | Selesai (arsip) |",
    "| --- | --- | --- | --- | ---: | ---: |",
  ];
  for (const a of AGENTS) {
    const p = s.profiles[a.id];
    const job = currentJobFor(a.id, s.jobs);
    const done = s.outputs.filter((o) => o.agentId === a.id).length;
    lines.push(
      `| ${p.name} | ${p.role} | ${job ? job.title : "—"} | ${job ? job.status : p.enabled ? "idle" : "nonaktif"} | ${job ? `${Math.round(job.progress * 100)}%` : "—"} | ${done} |`,
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
  lines.push("", "---", "_Dibuat otomatis oleh Clipyard Studio (Fase 6)._");
  return lines.join("\n");
}

function LaporanPage() {
  const navigate = useNavigate();
  const addDoc = useDocsStore((s) => s.addDoc);
  const floorUpdatedAt = useHqStore((s) => s.floorUpdatedAt);
  const feedLen = useHqStore((s) => s.feed.length);
  const outputsLen = useHqStore((s) => s.outputs.length);
  const [pin, setPin] = useState(0);
  const [copied, setCopied] = useState(false);

  // regenerate whenever the floor moves (cheap string build), unless pinned via pin counter changes only
  const report = useMemo(
    () => buildReport(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [floorUpdatedAt, feedLen, outputsLen, pin],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard unavailable (permission) — download path still works
    }
  };

  const download = () => {
    const blob = new Blob([report], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `laporan-studio-${new Date().toISOString().slice(0, 16).replace("T", "-").replace(":", "")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveAsDoc = () => {
    const id = addDoc({
      title: `Laporan Studio · ${new Date().toLocaleString("id-ID")}`,
      type: "lainnya",
      status: "draft",
      body: report,
      tags: ["laporan", "otomatis"],
    });
    void id;
    navigate({ to: "/dokumen" });
  };

  return (
    <DashShell
      title="Laporan"
      subtitle="Laporan Markdown otomatis dari kondisi studio saat ini — tinggal salin, unduh, atau simpan ke Dokumen."
    >
      <Panel
        title="Pratinjau laporan"
        action={
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setPin((v) => v + 1)} className={`${btnGhost} px-2.5 py-1 text-[11px]`}>
              Segarkan
            </button>
            <button type="button" onClick={copy} className={`${btnGhost} px-2.5 py-1 text-[11px]`}>
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Tersalin!" : "Salin"}
            </button>
            <button type="button" onClick={download} className={`${btnGhost} px-2.5 py-1 text-[11px]`}>
              <Download className="h-3 w-3" /> Unduh .md
            </button>
            <button type="button" onClick={saveAsDoc} className={`${btnPrimary} px-2.5 py-1 text-[11px]`}>
              <FilePlus2 className="h-3 w-3" /> Simpan ke Dokumen
            </button>
          </div>
        }
      >
        <pre className="max-h-[640px] overflow-auto whitespace-pre-wrap rounded-xl bg-black/40 p-4 font-mono text-[12px] leading-relaxed text-hq-text/90">
          {report}
        </pre>
        <p className="mt-3 text-[11.5px] text-hq-muted">
          Laporan diperbarui mengikuti snapshot lantai. Tempel ke Notion/Obsidian/WhatsApp, atau simpan ke
          manajer Dokumen untuk diedit sebelum dibagikan.
        </p>
      </Panel>
    </DashShell>
  );
}
