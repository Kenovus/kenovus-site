import { create } from 'zustand';

type SonaUiState = {
  isListening: boolean;
  setSonaListening: (v: boolean) => void;
};

/**
 * Drives the Sona tab bar icon subtle pulse when the Sona screen is actively listening.
 */
export const useSonaListeningStore = create<SonaUiState>((set) => ({
  isListening: false,
  setSonaListening: (v) => set({ isListening: v }),
}));
