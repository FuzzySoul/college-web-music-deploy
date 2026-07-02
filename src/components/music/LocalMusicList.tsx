'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Music,
  Video,
  FileText,
  Trash2,
  Search,
  Film,
  Edit3,
  Loader2,
} from 'lucide-react';
import { PlayingIndicator } from './PlayingIndicator';
import type { LocalTrack, LocalMusicListProps } from './types';

/**
 * 本地音乐列表组件
 * 展示所有本地音乐，支持搜索过滤、播放、MV播放、歌词编辑、删除等操作
 * 表格布局：序号 | 标题 | 歌手 | 时长 | 特殊标识 | 操作
 */
export function LocalMusicList({
  tracks,
  onPlay,
  onPlayMv,
  onEditLyrics,
  onDelete,
  isLoading = false,
}: LocalMusicListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // 搜索过滤 - 支持按标题、歌手、专辑搜索
  const filteredTracks = useMemo(() => {
    if (!searchQuery.trim()) return tracks;
    const query = searchQuery.toLowerCase();
    return tracks.filter(
      (track) =>
        track.title.toLowerCase().includes(query) ||
        track.artist.toLowerCase().includes(query) ||
        (track.album && track.album.toLowerCase().includes(query))
    );
  }, [tracks, searchQuery]);

  // 格式化时长显示
  const formatDuration = useCallback((seconds: number): string => {
    if (!seconds || seconds <= 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // 加载骨架屏
  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-[40px_1fr_200px_80px_100px_100px] gap-4 px-4 py-3 items-center"
          >
            <div className="h-4 w-4 rounded skeleton-shimmer" />
            <div className="h-4 w-3/4 rounded skeleton-shimmer" />
            <div className="h-4 w-1/2 rounded skeleton-shimmer" />
            <div className="h-4 w-10 rounded skeleton-shimmer" />
            <div className="h-4 w-16 rounded skeleton-shimmer" />
            <div className="h-4 w-20 rounded skeleton-shimmer" />
          </div>
        ))}
      </div>
    );
  }

  // 空状态
  if (tracks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
          className="flex flex-col items-center gap-4"
        >
          <div
            className="p-6 rounded-2xl"
            style={{ backgroundColor: 'rgba(var(--primary-rgb), 0.08)' }}
          >
            <Music className="w-12 h-12" style={{ color: 'var(--muted-foreground)' }} />
          </div>
          <div className="text-center space-y-2">
            <p
              className="text-lg font-medium"
              style={{ color: 'var(--foreground)' }}
            >
              暂无本地音乐
            </p>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              点击上方按钮上传你的音乐文件
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden">
      {/* 搜索栏 */}
      <div className="px-4 pb-4">
        <div className="relative max-w-md">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: 'var(--muted-foreground)' }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索歌曲、歌手或专辑..."
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border transition-all duration-200 focus:outline-none focus:ring-2"
            style={{
              backgroundColor: 'var(--card)',
              borderColor: 'var(--border)',
              color: 'var(--foreground)',
              '--tw-ring-color': 'rgba(193, 95, 60, 0.3)',
            } as React.CSSProperties}
          />
          {searchQuery && (
            <span
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--muted-foreground)',
              }}
            >
              {filteredTracks.length} / {tracks.length}
            </span>
          )}
        </div>
      </div>

      {/* 固定表头 */}
      <div
        className="sticky top-0 z-10 grid grid-cols-[40px_1fr_180px_70px_90px_120px] gap-3 px-4 py-3 text-xs font-medium uppercase tracking-wider"
        style={{ color: 'var(--muted-foreground)' }}
      >
        <div className="text-center">#</div>
        <div>标题</div>
        <div>歌手</div>
        <div className="text-right">时长</div>
        <div className="text-center">标识</div>
        <div className="text-center">操作</div>
      </div>

      {/* 歌曲列表 */}
      <div className="pb-4 min-h-[200px]">
        <AnimatePresence mode="popLayout">
          {filteredTracks.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-12"
            >
              <Search
                className="w-10 h-10 mb-3"
                style={{ color: 'var(--muted-foreground)', opacity: 0.4 }}
              />
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                未找到匹配 &quot;{searchQuery}&quot; 的歌曲
              </p>
            </motion.div>
          ) : (
            filteredTracks.map((track, index) => (
              <motion.div
                key={track.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25, delay: index * 0.015 }}
                onClick={() => onPlay(track)}
                className="group grid grid-cols-[40px_1fr_180px_70px_90px_120px] gap-3 px-4 py-3 items-center cursor-pointer transition-all duration-300 ease-out hover:bg-white/[0.06] dark:hover:bg-white/[0.04] active:scale-[0.99]"
                role="button"
                tabIndex={0}
                aria-label={`播放 ${track.title} - ${track.artist}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onPlay(track);
                  }
                }}
              >
                {/* 序号列 */}
                <div className="relative flex items-center justify-center w-5">
                  <span
                    className="text-sm tabular-nums group-hover:opacity-0 transition-opacity duration-200"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    {index + 1}
                  </span>
                  <Play
                    className="absolute w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    style={{ color: 'var(--foreground)' }}
                  />
                </div>

                {/* 标题列 */}
                <div className="min-w-0">
                  <p
                    className="text-sm font-medium truncate transition-colors duration-200"
                    style={{ color: 'var(--foreground)' }}
                  >
                    {track.title}
                  </p>
                  {track.album && (
                    <p
                      className="text-xs truncate md:hidden"
                      style={{ color: 'var(--muted-foreground)' }}
                    >
                      {track.album}
                    </p>
                  )}
                </div>

                {/* 歌手列 */}
                <div className="min-w-0 hidden md:block">
                  <p
                    className="text-sm truncate group-hover:text-[var(--foreground)] transition-colors duration-200"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    {track.artist}
                  </p>
                </div>

                {/* 时长列 */}
                <div className="text-right hidden sm:block">
                  <span
                    className="text-xs tabular-nums"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    {formatDuration(track.duration)}
                  </span>
                </div>

                {/* 特殊标识列 - 显示资源图标 */}
                <div className="flex items-center justify-center gap-1">
                  {track.audio_url && (
                    <Music
                      className="w-3.5 h-3.5"
                      style={{ color: 'var(--primary)' }}
                      aria-label="有音频文件"
                    />
                  )}
                  {track.mv_url && (
                    <Video
                      className="w-3.5 h-3.5"
                      style={{ color: '#EAB308' }}
                      aria-label="有MV视频"
                    />
                  )}
                  {track.lyrics && (
                    <FileText
                      className="w-3.5 h-3.5"
                      style={{ color: '#22C55E' }}
                      aria-label="有歌词文件"
                    />
                  )}
                </div>

                {/* 操作按钮列 */}
                <div className="flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  {/* MV 按钮 */}
                  {track.mv_url && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlayMv(track);
                      }}
                      className="p-1.5 rounded-lg hover:bg-[rgba(193,95,60,0.1)] dark:hover:bg-[rgba(212,118,90,0.15)] transition-colors duration-200"
                      title="播放MV"
                      aria-label={`播放 ${track.title} 的MV`}
                    >
                      <Film
                        className="w-3.5 h-3.5"
                        style={{ color: 'var(--muted-foreground)' }}
                      />
                    </button>
                  )}

                  {/* 歌词编辑按钮 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditLyrics(track);
                    }}
                    className="p-1.5 rounded-lg hover:bg-[rgba(193,95,60,0.1)] dark:hover:bg-[rgba(212,118,90,0.15)] transition-colors duration-200"
                    title={track.lyrics ? '编辑歌词' : '添加歌词'}
                    aria-label={`${track.lyrics ? '编辑' : '添加'} ${track.title} 的歌词`}
                  >
                    <Edit3
                      className="w-3.5 h-3.5"
                      style={{
                        color: track.lyrics ? 'var(--primary)' : 'var(--muted-foreground)',
                      }}
                    />
                  </button>

                  {/* 删除按钮 - 带二次确认 */}
                  {deleteConfirmId === track.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(track.id);
                          setDeleteConfirmId(null);
                        }}
                        className="px-2 py-1 text-xs rounded-md bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                        aria-label="确认删除"
                      >
                        确认?
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(null);
                        }}
                        className="p-1 rounded-md hover:bg-[var(--accent)] transition-colors"
                        aria-label="取消删除"
                      >
                        <span
                          className="text-xs"
                          style={{ color: 'var(--muted-foreground)' }}
                        >
                          x
                        </span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmId(track.id);
                        // 3秒后自动取消确认状态
                        setTimeout(() => setDeleteConfirmId(null), 3000);
                      }}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors duration-200"
                      title="删除歌曲"
                      aria-label={`删除 ${track.title}`}
                    >
                      <Trash2
                        className="w-3.5 h-3.5"
                        style={{ color: 'var(--muted-foreground)' }}
                      />
                    </button>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* 底部统计信息 */}
      {filteredTracks.length > 0 && (
        <div
          className="px-4 py-3 text-xs border-t"
          style={{
            color: 'var(--muted-foreground)',
            borderColor: 'var(--border)',
          }}
        >
          共 {filteredTracks.length} 首歌曲
          {searchQuery && ` (筛选自 ${tracks.length} 首)`}
          {' · '}
          总时长:{' '}
          {formatDuration(
            filteredTracks.reduce((sum, t) => sum + (t.duration || 0), 0)
          )}
        </div>
      )}
    </div>
  );
}

export default LocalMusicList;
