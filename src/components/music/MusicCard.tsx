'use client';

import { Play, Heart, MoreHorizontal, Clock } from 'lucide-react';

interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  duration: string;
  isLiked?: boolean;
}

interface MusicCardProps {
  track: Track;
  onPlay: (track: Track) => void;
  onLike?: (track: Track) => void;
  isPlaying?: boolean;
}

export function MusicCard({ track, onPlay, onLike, isPlaying }: MusicCardProps) {
  return (
    <div 
      className="music-card group relative bg-card rounded-xl overflow-hidden cursor-pointer border border-border/50 hover:border-primary/30"
      onClick={() => onPlay(track)}
    >
      {/* 封面 */}
      <div className="relative aspect-square overflow-hidden">
        <img
          src={track.cover}
          alt={track.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        
        {/* 悬停遮罩 */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <button className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center transform scale-90 group-hover:scale-100 transition-transform duration-300 hover:scale-110">
            <Play className="w-6 h-6 ml-1" />
          </button>
        </div>

        {/* 正在播放指示器 */}
        {isPlaying && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1">
            <div className="flex items-end gap-[2px] h-4">
              {[0.4, 0.7, 0.5, 0.9, 0.6].map((height, i) => (
                <div
                  key={i}
                  className="w-1 bg-primary rounded-full spectrum-bar"
                  style={{
                    height: `${height * 100}%`,
                    animationDelay: `${i * 0.1}s`
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* 收藏按钮 */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onLike?.(track);
          }}
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-primary hover:text-primary-foreground"
        >
          <Heart 
            className={`w-4 h-4 ${track.isLiked ? 'fill-current text-red-500' : ''}`} 
          />
        </button>
      </div>

      {/* 信息 */}
      <div className="p-4">
        <h3 className="font-styrene font-semibold text-sm truncate group-hover:text-primary transition-colors">
          {track.title}
        </h3>
        <p className="text-muted-foreground text-xs truncate mt-1">
          {track.artist}
        </p>
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <span>{track.album}</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {track.duration}
          </span>
        </div>
      </div>
    </div>
  );
}

interface TrackListProps {
  tracks: Track[];
  onPlay: (track: Track) => void;
  onLike?: (track: Track) => void;
  currentTrack?: Track | null;
}

export function TrackList({ tracks, onPlay, onLike, currentTrack }: TrackListProps) {
  return (
    <div className="space-y-2">
      {tracks.map((track, index) => (
        <div
          key={track.id}
          className={`group flex items-center gap-4 p-3 rounded-lg hover:bg-accent cursor-pointer transition-all duration-300 ${
            currentTrack?.id === track.id ? 'bg-primary/10' : ''
          }`}
          onClick={() => onPlay(track)}
        >
          {/* 序号 */}
          <span className="w-6 text-center text-sm text-muted-foreground group-hover:hidden">
            {index + 1}
          </span>
          <span className="w-6 text-center hidden group-hover:block">
            <Play className="w-4 h-4 mx-auto text-primary" />
          </span>

          {/* 封面 */}
          <div className="relative w-12 h-12 rounded overflow-hidden flex-shrink-0">
            <img
              src={track.cover}
              alt={track.title}
              className="w-full h-full object-cover"
            />
            {currentTrack?.id === track.id && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="flex items-end gap-[2px] h-4">
                  {[0.4, 0.7, 0.5, 0.9, 0.6].map((height, i) => (
                    <div
                      key={i}
                      className="w-1 bg-primary rounded-full"
                      style={{ height: `${height * 100}%` }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 信息 */}
          <div className="flex-1 min-w-0">
            <h4 className={`font-medium text-sm truncate ${
              currentTrack?.id === track.id ? 'text-primary' : ''
            }`}>
              {track.title}
            </h4>
            <p className="text-muted-foreground text-xs truncate">{track.artist}</p>
          </div>

          {/* 专辑 */}
          <div className="hidden md:block flex-1 min-w-0">
            <p className="text-muted-foreground text-sm truncate">{track.album}</p>
          </div>

          {/* 时长 */}
          <span className="text-muted-foreground text-sm">{track.duration}</span>

          {/* 操作 */}
          <button className="opacity-0 group-hover:opacity-100 p-2 hover:bg-primary/10 rounded-full transition-all">
            <Heart className={`w-4 h-4 ${track.isLiked ? 'fill-current text-red-500' : ''}`} />
          </button>
          <button className="opacity-0 group-hover:opacity-100 p-2 hover:bg-primary/10 rounded-full transition-all">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
