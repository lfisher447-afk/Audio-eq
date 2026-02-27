"use client";

import { useCallback } from "react";
import type { BandState } from "../types";

export default function BandControls({ bands, masterGain, isLowPower, onBandGainChange, onMasterGainChange, onToggleLowPower }: any) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold tracking-widest uppercase text-[#64748b]">Frequency Bands</h2>
        <button onClick={onToggleLowPower} className={`text-xs px-3 py-1 rounded-full border transition-colors ${isLowPower ? "border-amber-500 text-amber-400 bg-amber-950/40" : "border-[#1e1e2e] text-[#64748b] hover:border-[#6366f1] hover:text-[#a5b4fc]"}`}>
          {isLowPower ? "⚡ Low Power ON" : "⚡ Low Power"}
        </button>
      </div>
      <div className="grid grid-cols-7 gap-2 md:gap-3">
        {bands.map((band: BandState) => <BandSlider key={band.id} band={band} onChange={(bId, val) => onBandGainChange(bId, parseFloat(val))} />)}
      </div>
      <div className="pt-4 border-t border-[#1e1e2e]">
        <div className="flex items-center gap-4">
          <label className="text-xs text-[#64748b] whitespace-nowrap min-w-[80px]">Master Vol</label>
          <input type="range" min="0" max="2" step="0.01" value={masterGain} onChange={(e) => onMasterGainChange(parseFloat(e.target.value))} className="flex-1 accent-[#6366f1]" style={{ background: `linear-gradient(to right, #6366f1 ${(masterGain / 2) * 100}%, #1e1e2e ${(masterGain / 2) * 100}%)` }} />
          <span className="text-xs font-mono text-[#a5b4fc] w-12 text-right">{(masterGain * 100).toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
}

function BandSlider({ band, onChange }: { band: BandState, onChange: (id: string, val: string) => void }) {
  const sliderStyle: React.CSSProperties = { writingMode: "vertical-lr", direction: "rtl", width: 24, height: 120, background: `linear-gradient(to top, ${band.color}44, ${band.color}cc)`, borderRadius: 4, outline: "none", border: `1px solid ${band.color}44`, accentColor: band.color, cursor: "pointer" };
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs font-mono font-semibold" style={{ color: band.color }}>{band.gainDb >= 0 ? "+" : ""}{band.gainDb.toFixed(0)}dB</span>
      <div className="relative flex flex-col items-center" style={{ height: 120 }}>
        <input type="range" min="-40" max="40" step="1" value={band.gainDb} onChange={(e) => onChange(band.id, e.target.value)} className="appearance-none" style={sliderStyle} />
        <div className="absolute pointer-events-none" style={{ bottom: `${(0 + 40) / 80 * 120}px`, left: 0, right: 0, height: 1, background: "#334155" }} />
      </div>
      <div className="text-center">
        <div className="text-xs font-mono" style={{ color: band.color }}>{band.frequency >= 1000 ? `${(band.frequency / 1000).toFixed(0)}k` : `${band.frequency}`}</div>
        <div className="text-[9px] text-[#475569] leading-tight">{band.name}</div>
      </div>
    </div>
  );
}
