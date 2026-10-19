import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Download, FilePlus2, Search, Trash2 } from "lucide-react";
import { DashShell } from "@/components/dash/shell";
import {
  Field,
  Panel,
  btnGhost,
  btnPrimary,
  inputCls,
  relTime,
} from "@/components/dash/ui";
import {
  DOC_STATUS_LABELS,
  DOC_TYPE_LABELS,
  useDocsStore,
  type DocStatus,
  type DocType,
  type StudioDoc,
} from "@/lib/hq-documents";

export const Route = createFileRoute("/dokumen")({
  component: DokumenPage,
});

const STATUS_BADGE: Record<DocStatus, string> = {
  draft: "bg-white/10 text-hq-muted",
  review: "bg-amber-400/20 text-amber-300",
  siap: "bg-emerald-400/20 text-emerald-300",
};

function DocEditor({ doc }: { doc: StudioDoc }) {
  const updateDoc = useDocsStore((s) => s.updateDoc);
  const removeDoc = useDocsStore((s) => s.removeDoc);
  const [title, setTitle] = useState(doc.title);
  const [type, setType] = useState<DocType>(doc.type);
  const [status, setStatus] = useState<DocStatus>(doc.status);
  const [body, setBody] = useState(doc.body);
  const [tags, setTags] = useState(doc.tags.join(", "));
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = () => {
    updateDoc(doc.id, {
      title: title.trim().slice(0, 120) || "Dokumen tanpa judul",
      type,
      status,
      body: body.slice(0, 8000),
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 8),
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  };

  const download = () => {
    const blob = new Blob([`# ${title}\n\n${body}`], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 48) || "dokumen"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid gap-3">
      <Field label="Judul">
        <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Jenis">
          <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as DocType)}>
            {(Object.keys(DOC_TYPE_LABELS) as DocType[]).map((t) => (
              <option key={t} value={t}>{DOC_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as DocStatus)}>
            {(Object.keys(DOC_STATUS_LABELS) as DocStatus[]).map((t) => (
              <option key={t} value={t}>{DOC_STATUS_LABELS[t]}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Tag" hint="Pisahkan dengan koma.">
        <input className={inputCls} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="pipeline, harian" />
      </Field>
      <Field label="Isi dokumen" hint={`${body.length}/8000 karakter — teks biasa atau Markdown.`}>
        <textarea
          className={`${inputCls} min-h-[220px] resize-y font-mono text-[12.5px] leading-relaxed`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={8000}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={save} className={btnPrimary}>
          <Check className="h-3.5 w-3.5" /> {saved ? "Tersimpan!" : "Simpan"}
        </button>
        <button type="button" onClick={download} className={btnGhost}>
          <Download className="h-3.5 w-3.5" /> Unduh .md
        </button>
        {confirmDelete ? (
          <button
            type="button"
            onClick={() => removeDoc(doc.id)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-rose-500 px-3.5 py-2 text-[12px] font-bold text-white transition hover:bg-rose-400"
          >
            <Trash2 className="h-3.5 w-3.5" /> Yakin hapus?
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className={`${btnGhost} ml-auto text-rose-300 hover:bg-rose-400/10`}
          >
            <Trash2 className="h-3.5 w-3.5" /> Hapus
          </button>
        )}
      </div>
      <p className="text-[11px] text-hq-muted">Diubah {relTime(doc.updatedAt)} · tersimpan otomatis di browser ini saat tombol Simpan ditekan.</p>
    </div>
  );
}

function DokumenPage() {
  const docs = useDocsStore((s) => s.docs);
  const addDoc = useDocsStore((s) => s.addDoc);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | DocStatus>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return docs.filter((d) => {
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (q && !(d.title + " " + d.body + " " + d.tags.join(" ")).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [docs, query, statusFilter]);

  const selected = docs.find((d) => d.id === selectedId) ?? filtered[0] ?? docs[0] ?? null;

  const create = () => {
    const id = addDoc({ title: "Dokumen baru", type: "caption", status: "draft", body: "" });
    setSelectedId(id);
    setQuery("");
    setStatusFilter("all");
  };

  return (
    <DashShell
      title="Manajer Dokumen"
      subtitle="Draft caption, bank hook, SOP, dan laporan — satu lemari untuk semua tulisan studio."
    >
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <Panel
          title={`Dokumen (${docs.length})`}
          action={
            <button type="button" onClick={create} className={`${btnPrimary} px-2.5 py-1 text-[11px]`}>
              <FilePlus2 className="h-3 w-3" /> Baru
            </button>
          }
        >
          <div className="mb-3 grid gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-hq-muted" />
              <input className={`${inputCls} pl-8`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari judul, isi, tag…" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(["all", "draft", "review", "siap"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                    statusFilter === st ? "bg-sky-500 text-white" : "border border-white/12 bg-white/5 text-hq-muted hover:bg-white/10"
                  }`}
                >
                  {st === "all" ? "Semua" : DOC_STATUS_LABELS[st]}
                </button>
              ))}
            </div>
          </div>
          {filtered.length === 0 ? (
            <p className="text-[12.5px] text-hq-muted">Tidak ada dokumen yang cocok.</p>
          ) : (
            <ul className="grid max-h-[560px] gap-1.5 overflow-y-auto pr-1">
              {filtered.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(d.id)}
                    className={`w-full rounded-xl border p-2.5 text-left transition ${
                      selected?.id === d.id ? "border-sky-400/60 bg-sky-400/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold">{d.title}</span>
                      <span className={`shrink-0 rounded-full px-1.5 py-px text-[9.5px] font-extrabold ${STATUS_BADGE[d.status]}`}>
                        {DOC_STATUS_LABELS[d.status]}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-hq-muted">
                      {DOC_TYPE_LABELS[d.type]} · {relTime(d.updatedAt)}
                      {d.tags.length ? ` · ${d.tags.map((t) => `#${t}`).join(" ")}` : ""}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={selected ? "Editor" : "Editor kosong"}>
          {selected ? (
            <DocEditor key={selected.id} doc={selected} />
          ) : (
            <p className="text-[13px] text-hq-muted">Belum ada dokumen. Klik “Baru” untuk membuat yang pertama.</p>
          )}
        </Panel>
      </div>
    </DashShell>
  );
}
