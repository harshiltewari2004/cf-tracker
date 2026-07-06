import { create } from "zustand";

interface IngestState {
  isIngestActive: boolean;
  setIngestActive: (active: boolean) => void;
}

export const useIngestStore = create<IngestState>((set) => ({
  isIngestActive: false,
  setIngestActive: (active) => set({ isIngestActive: active }),
}));
