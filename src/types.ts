export interface Peak {
  binIndex: number;
  frequency: number;
  amplitude: number;
}

export interface BandState {
  id: string;
  name: string;
  frequency: number;
  gainDb: number;
  color: string;
}

export interface AudioStudio {
  exportPreset: () => Record<string, unknown>;
  importPreset: (data: Record<string, unknown>) => void;
}
