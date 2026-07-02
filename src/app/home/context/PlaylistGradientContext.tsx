'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface GradientColor {
  r: number;
  g: number;
  b: number;
}

interface PlaylistGradientContextType {
  gradientColor: GradientColor | null;
  setGradientColor: (color: GradientColor | null) => void;
}

const PlaylistGradientContext = createContext<PlaylistGradientContextType>({
  gradientColor: null,
  setGradientColor: () => {},
});

export function usePlaylistGradient() {
  return useContext(PlaylistGradientContext);
}

export function PlaylistGradientProvider({ children }: { children: ReactNode }) {
  const [gradientColor, setGradientColor] = useState<GradientColor | null>(null);

  return (
    <PlaylistGradientContext.Provider value={{ gradientColor, setGradientColor }}>
      {children}
    </PlaylistGradientContext.Provider>
  );
}
