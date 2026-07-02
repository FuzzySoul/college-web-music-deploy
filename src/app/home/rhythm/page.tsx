'use client';

import { RhythmGame } from '@/components/music/RhythmGame';
import { usePlayer } from '../context/PlayerContext';

export default function RhythmPage() {
  const { allTracks } = usePlayer();

  return (
    <div className="fade-in">
      <RhythmGame allTracks={allTracks} />
    </div>
  );
}
