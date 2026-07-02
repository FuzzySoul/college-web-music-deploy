'use client';

import { motion } from 'framer-motion';
import { Play, Download, Loader2, Volume2, Music, MessageCircle, Trash2 } from 'lucide-react';
import { PlayingIndicator } from './PlayingIndicator';
import type { ExternalPlaylistTrack } from './types';
import { usePlayer } from '@/app/home/context/PlayerContext';
import { useRouter } from 'next/navigation';

interface PlaylistTrackListProps {
  tracks: ExternalPlaylistTrack[];
  currentPlaying?: string | null;
  isPlaying?: boolean;
  downloadingTrackId: string | null;
  onPlayTrack: (track: ExternalPlaylistTrack) => void;
  onDownloadTrack: (track: ExternalPlaylistTrack) => void;
  onDeleteTrack?: (track: ExternalPlaylistTrack) => void;
  isLoading?: boolean;
  isInGlassContainer?: boolean;
  hideDuration?: boolean; // 隐藏时长列（用于自建爬虫歌单）
}

export function PlaylistTrackList({
  tracks,
  currentPlaying,
  isPlaying,
  downloadingTrackId,
  onPlayTrack,
  onDownloadTrack,
  onDeleteTrack,
  isLoading,
  isInGlassContainer = false,
  hideDuration = false,
}: PlaylistTrackListProps) {
  const { setSongCommentTarget, songCommentTarget } = usePlayer();
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <p style={{ color: 'var(--muted-foreground)' }}>加载中...</p>
        </motion.div>
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
          className="flex flex-col items-center gap-3"
        >
          <div 
            className="p-4 rounded-2xl"
            style={{ backgroundColor: 'rgba(var(--primary-rgb), 0.08)' }}
          >
            <Music className="w-10 h-10" style={{ color: 'var(--muted-foreground)' }} />
          </div>
          <p className="text-base font-medium" style={{ color: 'var(--foreground)' }}>歌单为空</p>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>在音乐库中右键添加歌曲到歌单</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden"
    >
      {/* 固定表头 - 全透明 */}
      <div
        className={`sticky top-0 z-10 grid gap-4 px-4 py-3 text-xs font-medium uppercase tracking-wider ${
          hideDuration ? 'grid-cols-[40px_1fr_200px_80px]' : 'grid-cols-[40px_1fr_200px_80px_80px]'
        }`}
        style={{
          color: 'var(--muted-foreground)',
        }}
      >
        <div className="text-center">#</div>
        <div>标题</div>
        <div>歌手</div>
        {!hideDuration && <div className="text-right">时长</div>}
        <div className="text-center">操作</div>
      </div>

      {/* 歌曲列表 - 移除 max-h 限制，让父容器控制滚动 */}
      <div className="pb-4">
        {tracks.map((track, index) => {
          const isCurrentPlaying = currentPlaying === track.track_title;

          return (
            <motion.div
              key={track.id || index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.02 }}
              onClick={() => onPlayTrack(track)}
              className={`group grid gap-4 px-4 py-3 items-center cursor-pointer transition-all duration-300 ease-out ${
                hideDuration ? 'grid-cols-[40px_1fr_200px_80px]' : 'grid-cols-[40px_1fr_200px_80px_80px]'
              } ${
                isCurrentPlaying
                  ? 'bg-white/[0.06] dark:bg-white/[0.04]'
                  : 'hover:bg-white/[0.06] dark:hover:bg-white/[0.04]'
              }`}
            >
              {/* 序号 / 播放指示器 */}
              <div className="flex items-center justify-center">
                {isCurrentPlaying && isPlaying ? (
                  <PlayingIndicator isPlaying={isPlaying} />
                ) : isCurrentPlaying ? (
                  <Volume2 className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                ) : (
                  <span className="text-sm tabular-nums group-hover:opacity-0 transition-opacity duration-200" style={{ color: 'var(--muted-foreground)' }}>
                    {index + 1}
                  </span>
                )}
                {/* 悬停时显示播放图标 */}
                {!isCurrentPlaying && (
                  <Play 
                    className="w-4 h-4 absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200" 
                    style={{ color: 'var(--foreground)' }}
                  />
                )}
              </div>

              {/* 标题 */}
              <div className="min-w-0">
                <div
                  className="text-sm font-medium truncate transition-colors duration-200"
                  style={{ color: isCurrentPlaying ? 'var(--primary)' : 'var(--foreground)' }}
                >
                  {track.track_title}
                </div>
              </div>

              {/* 歌手 */}
              <div className="min-w-0">
                <div
                  className="text-sm truncate transition-colors duration-200 group-hover:text-[var(--foreground)] cursor-pointer hover:underline"
                  style={{ color: 'var(--muted-foreground)' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/home/artists?name=${encodeURIComponent(track.track_artist)}`);
                  }}
                >
                  {track.track_artist}
                </div>
              </div>

              {/* 时长 - 自建爬虫歌单隐藏 */}
              {!hideDuration && (
                <div className="text-right">
                  <span className="text-sm tabular-nums" style={{ color: 'var(--muted-foreground)' }}>
                    {Math.floor(track.track_duration / 60)}:{String(track.track_duration % 60).padStart(2, '0')}
                  </span>
                </div>
              )}

              {/* 操作按钮 */}
              <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlayTrack(track);
                  }}
                  className="p-1.5 rounded-lg hover:bg-[rgba(193,95,60,0.1)] dark:hover:bg-[rgba(212,118,90,0.15)] transition-colors duration-200"
                  title="播放"
                >
                  <Play className="w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDownloadTrack(track);
                  }}
                  disabled={downloadingTrackId === track.id}
                  className="p-1.5 rounded-lg hover:bg-[rgba(193,95,60,0.1)] dark:hover:bg-[rgba(212,118,90,0.15)] transition-colors duration-200 disabled:opacity-50"
                  title="下载"
                >
                  {downloadingTrackId === track.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--primary)' }} />
                  ) : (
                    <Download className="w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSongCommentTarget({
                      trackId: track.platform_track_id || track.id,
                      title: track.track_title,
                      artist: track.track_artist
                    });
                  }}
                  title="查看评论"
                  className="p-1.5 rounded-lg hover:bg-[rgba(193,95,60,0.1)] dark:hover:bg-[rgba(212,118,90,0.15)] transition-colors duration-200"
                >
                  <MessageCircle className="w-4 h-4" style={{ color: songCommentTarget?.trackId === (track.platform_track_id || track.id) ? 'var(--primary)' : 'var(--muted-foreground)' }} />
                </button>
                {onDeleteTrack && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteTrack(track);
                    }}
                    title="删除"
                    className="p-1.5 rounded-lg hover:bg-[rgba(239,68,68,0.1)] transition-colors duration-200"
                  >
                    <Trash2 className="w-4 h-4" style={{ color: '#ef4444' }} />
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
