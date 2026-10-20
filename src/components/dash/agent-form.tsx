import { useState } from "react";
import { Check, Plus, RotateCcw, X } from "lucide-react";
import { AGENT_COLOR_SWATCHES, fmtHourLabel, type AgentProfile, type WorkMode } from "@/lib/hq-profiles";
import { Field, btnGhost, btnPrimary, inputCls } from "@/components/dash/ui";

/**
 * Edit form for one agent's identity & responsibilities. Fully controlled by
 * its own copy of the profile; calls onSave with the cleaned patch. Changes
 * land in the store → robot nameplate, HUD cards and accent colors update.
 */
export function AgentForm({
  profile,
  onSave,
  onCancel,
  onReset,
}: {
  profile: AgentProfile;
  onSave: (patch: Partial<AgentProfile>) => void;
  onCancel: () => void;
  onReset?: () => void;
}) {
  const [name, setName] = useState(profile.name);
  const [role, setRole] = useState(profile.role);
  const [tagline, setTagline] = useState(profile.tagline);
  const [color, setColor] = useState(profile.color);
  const [resp, setResp] = useState<string[]>(profile.responsibilities);
  const [model, setModel] = useState(profile.model);
  const [tools, setTools] = useState(profile.tools);
  const [webhookUrl, setWebhookUrl] = useState(profile.webhookUrl);
  const [enabled, setEnabled] = useState(profile.enabled);
  const [autoApprove, setAutoApprove] = useState(profile.autoApprove);
  const [workMode, setWorkMode] = useState<WorkMode>(profile.workMode);
  const [scheduleStart, setScheduleStart] = useState(profile.scheduleStart);
  const [scheduleEnd, setScheduleEnd] = useState(profile.scheduleEnd);

  const submit = () => {
    onSave({
      name: name.trim().toUpperCase().slice(0, 24) || profile.name,
      role: role.trim().slice(0, 60) || profile.role,
      tagline: tagline.trim().slice(0, 200),
      color,
      responsibilities: resp.map((r) => r.trim()).filter(Boolean).slice(0, 8),
      model: model.trim().slice(0, 80),
      tools: tools.trim().slice(0, 120),
      webhookUrl: webhookUrl.trim().slice(0, 300),
      enabled,
      autoApprove,
      workMode,
      scheduleStart,
      scheduleEnd,
    });
  };

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nama agen">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="mis. AKIRA" />
        </Field>
        <Field label="Jabatan / peran">
          <input className={inputCls} value={role} onChange={(e) => setRole(e.target.value)} maxLength={60} placeholder="mis. Editor Klip" />
        </Field>
      </div>

      <Field label="Deskripsi singkat" hint="Satu kalimat gaya kerja agen — tampil di panel detail.">
        <textarea className={`${inputCls} min-h-[52px] resize-y`} value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={200} />
      </Field>

      <Field label="Warna aksen robot">
        <div className="flex flex-wrap items-center gap-1.5">
          {AGENT_COLOR_SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`h-6 w-6 rounded-full border-2 transition ${color === c ? "scale-110 border-white" : "border-transparent"}`}
              style={{ backgroundColor: c }}
              aria-label={`Warna ${c}`}
            />
          ))}
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-7 w-9 cursor-pointer rounded-lg border border-white/15 bg-transparent"
            title="Warna kustom"
          />
        </div>
      </Field>

      <Field label="Tanggung jawab" hint="Satu bullet per baris — ini jobdesc resmi sang agen.">
        <div className="grid gap-1.5">
          {resp.map((r, i) => (
            <div key={i} className="flex gap-1.5">
              <input
                className={inputCls}
                value={r}
                onChange={(e) => setResp((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
                maxLength={140}
                placeholder={`Tanggung jawab ${i + 1}`}
              />
              <button
                type="button"
                onClick={() => setResp((prev) => prev.filter((_, j) => j !== i))}
                className="shrink-0 rounded-xl border border-white/12 bg-white/5 px-2 text-hq-muted transition hover:bg-white/10 hover:text-rose-300"
                aria-label="Hapus baris"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {resp.length < 8 && (
            <button
              type="button"
              onClick={() => setResp((prev) => [...prev, ""])}
              className="inline-flex w-fit items-center gap-1 rounded-lg border border-dashed border-white/20 px-2 py-1 text-[11px] font-bold text-hq-muted transition hover:text-hq-text"
            >
              <Plus className="h-3 w-3" /> Tambah tanggung jawab
            </button>
          )}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Model / engine">
          <input className={inputCls} value={model} onChange={(e) => setModel(e.target.value)} maxLength={80} placeholder="mis. Whisper + LLM" />
        </Field>
        <Field label="Tools">
          <input className={inputCls} value={tools} onChange={(e) => setTools(e.target.value)} maxLength={120} placeholder="mis. ffmpeg, n8n" />
        </Field>
      </div>

      <Field label="Webhook agen (opsional)" hint="URL webhook n8n khusus agen ini — tombol “Picu webhook” di panel kerja akan mengirim POST ke sini. Kosongkan bila tidak dipakai.">
        <input className={inputCls} value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://n8n…/webhook/akira" inputMode="url" />
      </Field>

      <Field
        label="Mode kerja"
        hint={
          workMode === "always"
            ? "Agen bekerja kapan pun ada tugas — AI tidak butuh jam kantor. Mode Demo 9–5 di panel jam hanya mengatur animasinya."
            : "Di luar jendela ini agen beristirahat (tampil “Di luar jadwal”). Mengikuti jam nyata (waktu lokal browser)."
        }
      >
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { id: "always" as WorkMode, title: "Selalu aktif (24/7)", desc: "Kerja kapan pun ada tugas" },
              { id: "schedule" as WorkMode, title: "Ikuti jadwal", desc: "Hanya pada jam tertentu" },
            ]
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setWorkMode(opt.id)}
              className={`rounded-xl border p-2.5 text-left transition ${
                workMode === opt.id
                  ? "border-sky-400/70 bg-sky-400/10"
                  : "border-white/12 bg-white/5 hover:bg-white/8"
              }`}
            >
              <div className="text-[12px] font-extrabold">{opt.title}</div>
              <div className="mt-0.5 text-[10.5px] leading-snug text-hq-muted">{opt.desc}</div>
            </button>
          ))}
        </div>
      </Field>

      {workMode === "schedule" && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mulai kerja">
            <select className={inputCls} value={scheduleStart} onChange={(e) => setScheduleStart(Number(e.target.value))}>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>{fmtHourLabel(h)}</option>
              ))}
            </select>
          </Field>
          <Field label="Selesai kerja">
            <select className={inputCls} value={scheduleEnd} onChange={(e) => setScheduleEnd(Number(e.target.value))}>
              {Array.from({ length: 25 }, (_, h) => (
                <option key={h} value={h}>{fmtHourLabel(h)}</option>
              ))}
            </select>
          </Field>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-white/12 bg-white/5 px-3 py-2">
          <span className="text-[12px] font-bold">Agen aktif</span>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4 accent-sky-500" />
        </label>
        <label className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-white/12 bg-white/5 px-3 py-2" title="Penanda preferensi: approval agen ini boleh auto-OK di sisi pipeline.">
          <span className="text-[12px] font-bold">Auto-approve</span>
          <input type="checkbox" checked={autoApprove} onChange={(e) => setAutoApprove(e.target.checked)} className="h-4 w-4 accent-sky-500" />
        </label>
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <button type="button" onClick={submit} className={btnPrimary}>
          <Check className="h-3.5 w-3.5" /> Simpan konfigurasi
        </button>
        <button type="button" onClick={onCancel} className={btnGhost}>
          Batal
        </button>
        {onReset && (
          <button type="button" onClick={onReset} className={`${btnGhost} ml-auto text-hq-muted`}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset ke default
          </button>
        )}
      </div>
    </div>
  );
}
