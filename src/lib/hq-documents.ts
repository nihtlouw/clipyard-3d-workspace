/**
 * Document draft manager (Fase 6) — captions, hook lists, SOPs, playbook
 * notes… anything the studio writes down. Kept in its own Zustand store and
 * persisted to localStorage so the 3D scene store stays lean.
 */
import { create } from "zustand";
import { loadJSON, saveJSON } from "@/lib/hq-persist";

export type DocType = "caption" | "hook" | "sop" | "lainnya";
export type DocStatus = "draft" | "review" | "siap";

export interface StudioDoc {
  id: string;
  title: string;
  type: DocType;
  status: DocStatus;
  body: string;
  tags: string[];
  updatedAt: number;
}

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  caption: "Caption",
  hook: "Hook",
  sop: "SOP",
  lainnya: "Lainnya",
};

export const DOC_STATUS_LABELS: Record<DocStatus, string> = {
  draft: "Draft",
  review: "Minta review",
  siap: "Siap pakai",
};

const DOCS_KEY = "clipyard.docs.v1";
const MAX_DOCS = 120;

const SEED_DOCS: StudioDoc[] = [
  {
    id: "seed-sop-intake",
    title: "SOP Intake Episode Baru",
    type: "sop",
    status: "siap",
    body: "1. Upload video panjang ke folder intake.\n2. AKIRA membagi ke antrean klip per segmen.\n3. NOVA silence-trim → HOOK menulis 3 detik pertama.\n4. LEXA caption karaoke, PIXEL cover, BOLT render & publish.\n5. Semua publish wajib lewat Approval Inbox.",
    tags: ["pipeline", "harian"],
    updatedAt: Date.now() - 1000 * 60 * 60 * 26,
  },
  {
    id: "seed-hook-bank",
    title: "Bank Hook — Podcast EP210+",
    type: "hook",
    status: "draft",
    body: "• \"Dia resign di umur 40, lalu…\"\n• \"Nasihat finansial yang tidak diajarkan di sekolah\"\n• \"3 tanda kamu salah pilih partner bisnis\"\n• Catatan: hindari clickbait yang tidak dibayar di akhir klip.",
    tags: ["hook", "podcast"],
    updatedAt: Date.now() - 1000 * 60 * 60 * 5,
  },
  {
    id: "seed-caption-style",
    title: "Gaya Caption Karaoke v2",
    type: "caption",
    status: "review",
    body: "Maks 3 kata per baris, kata aktif diberi aksen warna channel.\nNama orang & brand selalu kapitalisasi benar.\nEmoji hanya di akhir kalimat penekanan, maksimal 1 per klip.",
    tags: ["caption", "style-guide"],
    updatedAt: Date.now() - 1000 * 60 * 60 * 2,
  },
];

function sanitizeDocs(raw: unknown): StudioDoc[] {
  if (!Array.isArray(raw)) return SEED_DOCS;
  const out: StudioDoc[] = [];
  for (const d of raw) {
    if (typeof d !== "object" || d === null) continue;
    const o = d as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.title !== "string") continue;
    out.push({
      id: o.id.slice(0, 64),
      title: o.title.slice(0, 120),
      type: o.type === "caption" || o.type === "hook" || o.type === "sop" ? o.type : "lainnya",
      status: o.status === "review" || o.status === "siap" ? o.status : "draft",
      body: typeof o.body === "string" ? o.body.slice(0, 8000) : "",
      tags: Array.isArray(o.tags)
        ? o.tags.filter((t): t is string => typeof t === "string").map((t) => t.slice(0, 24)).slice(0, 8)
        : [],
      updatedAt: typeof o.updatedAt === "number" ? o.updatedAt : Date.now(),
    });
  }
  return out.slice(0, MAX_DOCS);
}

interface DocsState {
  docs: StudioDoc[];
  addDoc: (partial?: Partial<Omit<StudioDoc, "id" | "updatedAt">>) => string;
  updateDoc: (id: string, patch: Partial<Omit<StudioDoc, "id" | "updatedAt">>) => void;
  removeDoc: (id: string) => void;
}

function persist(docs: StudioDoc[]) {
  saveJSON(DOCS_KEY, docs);
}

export const useDocsStore = create<DocsState>((set, get) => ({
  docs: sanitizeDocs(loadJSON<unknown>(DOCS_KEY, null)),
  addDoc: (partial) => {
    const id = `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const doc: StudioDoc = {
      id,
      title: partial?.title?.slice(0, 120) || "Dokumen tanpa judul",
      type: partial?.type ?? "caption",
      status: partial?.status ?? "draft",
      body: partial?.body?.slice(0, 8000) ?? "",
      tags: partial?.tags ?? [],
      updatedAt: Date.now(),
    };
    const docs = [doc, ...get().docs].slice(0, MAX_DOCS);
    persist(docs);
    set({ docs });
    return id;
  },
  updateDoc: (id, patch) => {
    const docs = get().docs.map((d) =>
      d.id === id ? { ...d, ...patch, id, updatedAt: Date.now() } : d,
    );
    persist(docs);
    set({ docs });
  },
  removeDoc: (id) => {
    const docs = get().docs.filter((d) => d.id !== id);
    persist(docs);
    set({ docs });
  },
}));
