'use client';

import { useState } from 'react';
import { Play, Pause, Music, RefreshCw } from 'lucide-react';

// 歌曲类型
interface NeteaseTrack {
  id: number;
  name: string;
  ar: { id: number; name: string }[];
  al: { id: number; name: string; picUrl: string };
  dt: number;
}

interface NeteaseSongListProps {
  songs: NeteaseTrack[];
  title: string;
  onPlay: (song: NeteaseTrack) => void;
  loading?: boolean;
}

export function NeteaseSongList({ 
  songs, 
  title, 
  onPlay,
  loading = false 
}: NeteaseSongListProps) {
  const [playingId, setPlayingId] = useState<number | null>(null);

  // 格式化时长
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 获取歌手名称
  const getArtistNames = (ar: { name: string }[]) => {
    return ar.map(a => a.name).join(', ');
  };

  // 处理播放
  const handlePlay = async (song: NeteaseTrack) => {
    setPlayingId(song.id);
    try {
      await onPlay(song);
    } finally {
      setPlayingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin" style={{ color: 'var(--primary)' }} />
      </div>
    );
  }

  if (songs.length === 0) {
    return (
      <div className="text-center py-12" style={{ color: 'var(--muted-foreground)' }}>
        <Music className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>暂无歌曲数据</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 歌曲列表 */}
      <div className="space-y-1">
        {songs.map((song, index) => (
          <div
            key={song.id}
            className="p-3 rounded-lg flex items-center gap-3 hover:bg-accent cursor-pointer transition-colors group"
            onClick={() => handlePlay(song)}
          >
            <span className="text-sm w-6 text-center" style={{ color: 'var(--muted-foreground)' }}>
              {playingId === song.id ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                index + 1
              )}
            </span>
            
            {/* 封面 */}
            <div className="w-10 h-10 rounded flex-shrink-0 overflow-hidden relative">
              <img 
                src={song.al?.picUrl || 'https://picsum.photos/seed/default/100/100'} 
                alt={song.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                {playingId === song.id ? (
                  <RefreshCw className="w-4 h-4 text-white animate-spin" />
                ) : (
                  <Play className="w-4 h-4 text-white" />
                )}
              </div>
            </div>

            {/* 歌曲信息 */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{song.name}</div>
              <div className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
                {getArtistNames(song.ar || [])}
              </div>
            </div>

            {/* 时长 */}
            <span className="text-xs flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
              {formatDuration(song.dt)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
