'use client';

import { useState } from 'react';
import { Heart, Play, ListPlus, MoreHorizontal } from 'lucide-react';
import type { Track } from '@/lib/music-service';

interface TrackRowProps {
  track: Track;
  index: number;
  isPlaying: boolean;
  isFavorite: boolean;
  onPlay: () => void;
  onToggleFavorite: () => void;
  onAddToPlaylist?: () => void;
}

const formatDuration = (seconds: number): string => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export function TrackRow({ track, index, isPlaying, isFavorite, onPlay, onToggleFavorite, onAddToPlaylist }: TrackRowProps) {
  const [isLiked, setIsLiked] = useState(false);

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLiked(true);
    onToggleFavorite();
    setTimeout(() => setIsLiked(false), 400);
  };

  return (
    <div
      className={`track-item group stagger-item w-full ${isPlaying ? 'active' : ''}`}
      style={{ animationDelay: `${index * 0.03}s` }}
      role="button"
      tabIndex={0}
      onClick={onPlay}
      onKeyDown={(e) => e.key === 'Enter' && onPlay()}
    >
      <div className="w-8 text-center">
        {isPlaying ? (
          <div className="spectrum-enhanced">
            {([0.3, 0.6, 0.4, 0.8, 0.5] as const).map((height, i) => (
              <div key={`bar-${i}`} className="bar" style={{ height: `${height * 100}%` }} />
            ))}
          </div>
        ) : (
          <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{index + 1}</span>
        )}
      </div>

      <div className="track-cover">
        <img src={track.cover || 'https://picsum.photos/seed/default/400/400'} alt={track.title} />
        <div className="play-overlay">
          <div className="play-button play-3d" style={{ width: 36, height: 36 }}>
            <Play className="w-4 h-4 ml-0.5" />
          </div>
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-normal text-sm truncate" style={{ color: isPlaying ? 'var(--primary)' : 'var(--foreground)', fontFamily: 'var(--font-display)' }}>
          {track.title}
        </div>
        <div className="artist-name truncate">{track.artist}</div>
      </div>

      <div className="hidden md:block flex-1 min-w-0">
        <div className="text-sm truncate" style={{ color: 'var(--muted-foreground)' }}>{track.album}</div>
      </div>

      <div className="duration">{formatDuration(track.duration)}</div>

      <button type="button" className={`p-2 opacity-0 group-hover:opacity-100 transition-all heart-beat ${isLiked || isFavorite ? 'liked' : ''}`} onClick={handleFavorite}>
        <Heart className="w-4 h-4" style={{ color: isFavorite ? 'var(--primary)' : 'var(--muted-foreground)', fill: isFavorite ? 'var(--primary)' : 'none' }} />
      </button>

      {onAddToPlaylist && (
        <button type="button" className="p-2 opacity-0 group-hover:opacity-100 transition-all" onClick={(e) => { e.stopPropagation(); onAddToPlaylist(); }} title="添加到歌单">
          <ListPlus className="w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
        </button>
      )}

      <button type="button" className="p-2 opacity-0 group-hover:opacity-100 transition-all">
        <MoreHorizontal className="w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
      </button>
    </div>
  );
}
