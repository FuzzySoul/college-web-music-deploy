'use client';

import { useState, useEffect, useMemo } from 'react';
import { Heart, Play, ListPlus, Trash2, MoreHorizontal } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { Track, musicService } from '@/lib/music-service';

const formatDuration = (seconds: number): string => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default function FavoritesPage() {
  const { 
    allTracks, 
    favorites, 
    handlePlay, 
    currentTrack, 
    isPlaying, 
    handleToggleFavorite,
    openAddToPlaylistModal 
  } = usePlayer();
  const favoriteIds = favorites as Array<number | string>;

  // 兜底：favorites 中的 track_id 可能不在 allTracks（前 50 首 + 本地音乐）中，需要从 DB 拉
  const [extraTracks, setExtraTracks] = useState<Track[]>([]);
  useEffect(() => {
    // 分离 number（本地 tracks）和 string（external ext-xxx）
    const localTrackIds = new Set(allTracks.map(t => t.id));
    const missingLocalIds = favoriteIds
      .filter((id): id is number => typeof id === 'number' && !localTrackIds.has(id));
    const externalIds = favoriteIds.filter((id): id is string => typeof id === 'string');
    if (missingLocalIds.length === 0 && externalIds.length === 0) {
      setExtraTracks(prev => prev.length === 0 ? prev : []);
      return;
    }
    let cancelled = false;
    const promises: Promise<Track[]>[] = [];
    if (missingLocalIds.length > 0) {
      promises.push(musicService.getTracksByIds(missingLocalIds));
    }
    if (externalIds.length > 0) {
      // 通过 getFavorites 的方式拉取 external 详情（已经在 getFavorites 内部实现）
      promises.push(musicService.getFavorites().then(tracks => tracks.filter(t => externalIds.includes(String(t.id)))));
    }
    Promise.all(promises).then(results => {
      if (!cancelled) setExtraTracks(results.flat());
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [favoriteIds, allTracks]);

  const favoriteTracks = useMemo(() => {
    const trackMap = new Map<number | string, Track>();
    for (const t of allTracks) trackMap.set(t.id, t);
    for (const t of extraTracks) trackMap.set(t.id, t);
    return favoriteIds
      .map(id => trackMap.get(id))
      .filter((t): t is Track => Boolean(t));
  }, [favoriteIds, allTracks, extraTracks]);

  return (
    <div className="fade-in">
      <div className="flex items-center gap-5 mb-8">
        <div className="w-20 h-20 rounded-xl flex items-center justify-center glass" style={{ backgroundColor: 'var(--primary)' }}>
          <Heart className="w-10 h-10" style={{ color: 'var(--primary-foreground)' }} />
        </div>
        <div>
          <h2 className="text-2xl font-normal artistic-title">我的收藏</h2>
          <p className="text-base" style={{ color: 'var(--muted-foreground)' }}>{favoriteIds.length} 首歌曲</p>
        </div>
      </div>

      {favoriteTracks.length > 0 ? (
        <div className="space-y-1">
          {favoriteTracks.map((track, index) => (
            <TrackRow
              key={track.id}
              track={track}
              index={index}
              isPlaying={currentTrack?.id === track.id && isPlaying}
              isFavorite={true}
              onPlay={() => handlePlay(track)}
              onToggleFavorite={() => handleToggleFavorite(track)}
              onAddToPlaylist={() => openAddToPlaylistModal(track.id)}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state blur-in">
          <Heart className="w-16 h-16" />
          <p className="text-lg font-medium mt-4">暂无收藏</p>
          <p className="text-sm mt-2">点击歌曲右侧的心形图标添加收藏</p>
        </div>
      )}
    </div>
  );
}

interface TrackRowProps {
  track: Track;
  index: number;
  isPlaying: boolean;
  isFavorite: boolean;
  onPlay: () => void;
  onToggleFavorite: () => void;
  onAddToPlaylist?: () => void;
}

function TrackRow({ track, index, isPlaying, isFavorite, onPlay, onToggleFavorite, onAddToPlaylist }: TrackRowProps) {
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
