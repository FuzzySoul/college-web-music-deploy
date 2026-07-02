import { create } from 'zustand';

interface BackButtonState {
  show: boolean;
  onBack: () => void;
  setBack: (onBack: () => void) => void;
  clear: () => void;
}

export const useBackButtonStore = create<BackButtonState>((set) => ({
  show: false,
  onBack: () => {
    if (typeof window !== 'undefined') {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = '/home';
      }
    }
  },
  setBack: (onBack) => set({ show: true, onBack }),
  clear: () => set({ show: false }),
}));
