"use client";

import { useEffect, useRef, useCallback } from "react";
import type P5Constructor from "p5";
import type { Peak } from "../types";

interface P5VisualizerProps {
  spectrumData: Float32Array | null;
  peaks: Peak[];
  isRunning: boolean;
  sampleRate: number;
  bandColors: Array<{ frequency: number; color: string }>;
}

export default function P5Visualizer({ spectrumData, peaks, isRunning, sampleRate, bandColors }: P5VisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const p5InstanceRef = useRef<P5Constructor | null>(null);
  const dataRef = useRef<{ spectrum: Float32Array | null; peaks: Peak[]; isRunning: boolean }>({ spectrum: null, peaks:[], isRunning: false });
  dataRef.current = { spectrum: spectrumData, peaks, isRunning };

  const initP5 = useCallback(async () => {
    if (!containerRef.current) return;
    const p5Module = await import("p5");
    const P5 = p5Module.default as unknown as new (sketch: (p: P5Constructor) => void) => P5Constructor;

    if (p5InstanceRef.current) p5InstanceRef.current.remove();

    const sketch = (p: P5Constructor) => {
      let gradientCache: CanvasGradient | null = null; let lastWidth = 0;
      function getGradient(ctx: CanvasRenderingContext2D, w: number): CanvasGradient {
        if (gradientCache && w === lastWidth) return gradientCache;
        lastWidth = w; const g = ctx.createLinearGradient(0, 0, w, 0); const bands = [...bandColors].sort((a, b) => a.frequency - b.frequency);
        const nyquist = sampleRate / 2;
        bands.forEach((band) => { const pos = Math.min(1, Math.max(0, band.frequency / nyquist)); g.addColorStop(pos, band.color + "cc"); });
        gradientCache = g; return g;
      }

      p.setup = function () {
        const cnv = p.createCanvas(containerRef.current!.clientWidth, containerRef.current!.clientHeight);
        cnv.parent(containerRef.current!);
        p.frameRate(60); p.colorMode(p.RGB); p.textFont("JetBrains Mono, monospace");
      };

      p.windowResized = function () {
        if (!containerRef.current) return;
        p.resizeCanvas(containerRef.current.clientWidth, containerRef.current.clientHeight);
        gradientCache = null;
      };

      p.draw = function () {
        const { spectrum, peaks: currentPeaks, isRunning: running } = dataRef.current;
        p.background(10, 10, 15);
        if (!running || !spectrum) {
            p.fill(30, 30, 50); p.noStroke(); p.textSize(14); p.textAlign(p.CENTER, p.CENTER);
            p.text("Click 'Start Microphone' to begin", p.width / 2, p.height / 2); return; 
        }

        const w = p.width, h = p.height, specH = Math.floor(h * 0.72), waveH = Math.floor(h * 0.22), padding = 8;
        // Draw Grid
        p.stroke(255, 255, 255, 18); p.strokeWeight(1);[-60, -40, -20, -10].forEach((db) => {
          const norm = (db + 140) / 140; const y = specH - norm * specH;
          p.line(0, y, w, y); p.noStroke(); p.fill(255, 255, 255, 40); p.textSize(9); p.textAlign(p.LEFT, p.CENTER);
          p.text(`${db}dB`, 4, y - 6); p.stroke(255, 255, 255, 18);
        });
        const nyquist = sampleRate / 2;[100, 500, 1000, 2000, 5000, 10000, 20000].forEach((freq) => {
          const x = (Math.log10(freq / 20) / Math.log10(nyquist / 20)) * w; if (x >= 0 && x <= w) p.line(x, 0, x, specH);
        }); p.noStroke();

        // Draw Spectrum
        const canvas = (p as unknown as { drawingContext: CanvasRenderingContext2D }).drawingContext;
        const gradient = getGradient(canvas, w);
        canvas.save(); canvas.beginPath();
        const n = spectrum.length;
        for (let i = 0; i < n; i++) {
          const x = (i / n) * w, y = specH - spectrum[i] * (specH - padding);
          if (i === 0) canvas.moveTo(x, y); else canvas.lineTo(x, y);
        }
        canvas.lineTo(w, specH); canvas.lineTo(0, specH); canvas.closePath();
        canvas.fillStyle = gradient; canvas.globalAlpha = 0.85; canvas.fill(); canvas.restore();

        // Draw Peaks
        currentPeaks.forEach((peak) => {
          const x = (peak.binIndex / n) * w, y = specH - spectrum[peak.binIndex] * specH;
          p.stroke(244, 114, 182); p.strokeWeight(1); p.line(x, y, x, specH); p.noStroke(); p.fill(244, 114, 182); p.ellipse(x, y, 8, 8);
          const label = peak.frequency >= 1000 ? `${(peak.frequency / 1000).toFixed(1)}k` : `${Math.round(peak.frequency)}`;
          p.fill(255); p.textSize(10); p.textAlign(p.CENTER, p.BOTTOM); p.text(label + "Hz", x, Math.max(12, y - 6));
        });

        // Draw Waveform
        p.noFill(); p.stroke(52, 211, 153, 200); p.strokeWeight(1.5); p.beginShape();
        for (let i = 0; i < n; i++) p.vertex(i * (w / n), specH + 8 + waveH / 2 + (spectrum[i] - 0.5) * waveH * 0.8);
        p.endShape();

        // Draw Freq Labels
        p.noStroke(); p.fill(100, 116, 139); p.textSize(9); p.textAlign(p.CENTER, p.TOP);[{f:100,l:"100Hz"},{f:500,l:"500Hz"},{f:1000,l:"1kHz"},{f:2000,l:"2kHz"},{f:5000,l:"5kHz"},{f:10000,l:"10kHz"}].forEach(({ f, l }) => {
          const x = (Math.log10(f / 20) / Math.log10(nyquist / 20)) * w; if (x >= 0 && x <= w) p.text(l, x, specH + 4);
        });
      };
    };
    p5InstanceRef.current = new P5(sketch);
  }, [bandColors, sampleRate]);

  useEffect(() => { initP5(); return () => { if (p5InstanceRef.current) p5InstanceRef.current.remove(); }; }, [initP5]);

  return <div ref={containerRef} className="w-full h-64 md:h-80 lg:h-96 bg-[#0a0a0f] rounded-xl border border-[#1e1e2e] overflow-hidden" style={{ minHeight: 220 }} />;
}
