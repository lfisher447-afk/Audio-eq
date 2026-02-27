"use client";

import { useState, useEffect } from "react";
import type { AudioStudio } from "../types";
const PRESET_STORAGE_KEY = "audiopilot_presets_v1";

interface Preset { id: string; name: string; data: Record<string, unknown>; createdAt: string; }

export default function PresetManager({ studio }: { studio: AudioStudio | null }) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const[isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try { const raw = localStorage.getItem(PRESET_STORAGE_KEY); if (raw) setPresets(JSON.parse(raw)); } catch {}
  }, [isOpen]);

  function persistPresets(next: Preset[]) {
    try { localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(next)); } catch {}
    setPresets(next);
  }

  async function handleSave() {
    if (!studio || !presetName.trim()) return;
    setSaveStatus("saving");
    const preset: Preset = { id: crypto.randomUUID(), name: presetName.trim(), data: studio.exportPreset(), createdAt: new Date().toISOString() };
    const next = [...presets, preset];
    persistPresets(next);

    try {
      const res = await fetch("/api/presets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(preset) });
      if (!res.ok) throw new Error("Server save failed");
      setSaveStatus("saved");
    } catch { setSaveStatus("saved"); }
    setPresetName(""); setTimeout(() => setSaveStatus("idle"), 2000);
  }

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="text-xs px-3 py-1.5 rounded border border-[#1e1e2e] text-[#64748b] hover:border-[#6366f1] hover:text-[#a5b4fc]">Presets</button>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#12121a] border border-[#1e1e2e] rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between mb-5"><h3 className="text-base font-semibold text-[#e2e8f0]">Preset Manager</h3> <button onClick={() => setIsOpen(false)} className="text-[#64748b]">✕</button></div>
            <div className="flex gap-2 mb-5">
              <input type="text" value={presetName} onChange={e => setPresetName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSave()} placeholder="Preset name..." className="flex-1 bg-[#0a0a0f] border border-[#1e1e2e] px-3 py-2 text-white" />
              <button onClick={handleSave} disabled={!presetName.trim() || saveStatus === "saving"} className="bg-[#6366f1] px-4 py-2 rounded text-white">{saveStatus === "saving" ? "Saving" : "Save"}</button>
            </div>
            <div className="space-y-2">
              {presets.map(p => (
                <div key={p.id} className="flex bg-[#0a0a0f] border border-[#1e1e2e] px-3 py-2 items-center">
                  <div className="flex-1 text-white">{p.name} <span className="text-[#475569] text-xs block">{new Date(p.createdAt).toLocaleDateString()}</span></div>
                  <button onClick={() => { studio?.importPreset(p.data); setIsOpen(false); }} className="text-xs border px-2 py-1 mx-2">Load</button>
                  <button onClick={() => persistPresets(presets.filter(x => x.id !== p.id))} className="text-red-400">✕</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
