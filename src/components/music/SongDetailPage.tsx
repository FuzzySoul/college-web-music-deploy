'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Shuffle,
  Heart,
  ChevronDown,
  MessageCircle,
  Music,
  Disc3,
  X,
  Search
} from 'lucide-react';
import { Track } from '@/lib/music-service';
import { CommentSection } from './CommentSection';
import { LyricsDisplay } from './LyricsDisplay';
import { LyricsSearchModal } from './LyricsSearchModal';
import type { CurrentUser } from '@/types/comment';

interface SongDetailPageProps {
  isOpen: boolean;
  onClose: () => void;
  currentTrack: Track | null;
  isPlaying: boolean;
  isFavorite?: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onToggleFavorite?: () => void;
  shuffleMode?: boolean;
  onToggleShuffle?: () => void;
  currentUser?: CurrentUser | null;
  currentTime?: number;
  duration?: number;
  onSeek?: (time: number) => void;
  onPlayMv?: (track: any) => void;
}

export function SongDetailPage({
  isOpen,
  onClose,
  currentTrack,
  isPlaying,
  isFavorite,
  onPlayPause,
  onNext,
  onPrevious,
  onToggleFavorite,
  shuffleMode,
  onToggleShuffle,
  currentUser,
  currentTime = 0,
  duration = 0,
  onSeek,
  onPlayMv
}: SongDetailPageProps) {
  const [showComments, setShowComments] = useState(false);
  const [showLyricsSearch, setShowLyricsSearch] = useState(false);
  const [currentLyrics, setCurrentLyrics] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentLyrics(null);
  }, [currentTrack?.id]);

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!currentTrack || !duration || !onSeek) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * duration;
    onSeek(newTime);
  };

  // 手势处理 - 下滑关闭
  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100) {
      onClose();
    }
    if (info.offset.y < -50) {
      setShowComments(true);
    }
  };

  // 键盘事件处理
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!currentTrack) return null;

  const detailContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 背景模糊层 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            className="fixed inset-0 z-[99]"
            style={{
              background: `linear-gradient(180deg,
                rgba(13, 13, 13, 0.97) 0%,
                rgba(17, 17, 17, 0.95) 50%,
                rgba(26, 26, 26, 0.98) 100%)`
            }}
          >
            {/* 背景装饰光晕 */}
            <div
              className="absolute inset-0 opacity-20 pointer-events-none"
              style={{
                backgroundImage: `radial-gradient(circle at 30% 40%, rgba(212, 118, 90, 0.15) 0%, transparent 50%),
                                  radial-gradient(circle at 70% 60%, rgba(212, 175, 119, 0.08) 0%, transparent 50%)`
              }}
            />
          </motion.div>

          {/* 主内容区 */}
          <motion.div
            ref={containerRef}
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.1}
            onDragEnd={handleDragEnd}
            className="fixed inset-x-0 bottom-0 z-[100] max-h-[95vh] rounded-t-3xl overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, rgba(17, 17, 17, 0.98) 0%, rgba(13, 13, 13, 0.99) 100%)',
              backdropFilter: 'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderBottom: 'none',
              boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.03)'
            }}
          >
            {/* 顶部拖拽指示条 */}
            <div className="flex justify-center pt-3 pb-2">
              <div
                className="w-12 h-1 rounded-full"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)' }}
              />
            </div>

            {/* 关闭按钮 */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full transition-all duration-300 hover:scale-110 active:scale-95 z-10"
              style={{ color: 'rgba(255, 255, 255, 0.5)' }}
            >
              <X className="w-5 h-5" />
            </button>

            {!showComments ? (
              /* ========== 主内容视图 ========== */
              <div className="px-8 pb-8 h-[calc(95vh-28px)] flex flex-col">
                <div className="flex-1 flex items-center gap-12 lg:gap-16 min-h-0">
                  {/* ===== 左侧：黑胶唱片展示区 ===== */}
                  <div className="flex-shrink-0 relative">
                    {/* 唱片外圈光晕 */}
                    <div
                      className="absolute -inset-8 rounded-full opacity-30 blur-2xl"
                      style={{
                        background: `radial-gradient(circle, ${isPlaying ? 'rgba(212, 118, 90, 0.3)' : 'rgba(139, 115, 85, 0.2)'} 0%, transparent 70%)`,
                        transition: 'all 0.6s ease'
                      }}
                    />

                    {/* 唱片主体容器 */}
                    <motion.div
                      animate={{ rotate: isPlaying ? 360 : 0 }}
                      transition={{
                        duration: 8,
                        ease: 'linear',
                        repeat: isPlaying ? Infinity : 0
                      }}
                      className="relative w-64 h-64 md:w-80 md:h-80 lg:w-96 lg:h-96 rounded-full cursor-pointer group"
                      style={{
                        background: 'linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 50%, #1a1a1a 100%)',
                        boxShadow: `
                          0 24px 48px rgba(0, 0, 0, 0.6),
                          inset 0 2px 4px rgba(255, 255, 255, 0.05),
                          inset 0 -2px 4px rgba(0, 0, 0, 0.3)
                        `
                      }}
                    >
                      {/* 唱片纹路 */}
                      <div
                        className="absolute inset-0 rounded-full opacity-20"
                        style={{
                          background: `repeating-radial-gradient(
                            circle at center,
                            transparent 0px,
                            transparent 2px,
                            rgba(255, 255, 255, 0.03) 2px,
                            rgba(255, 255, 255, 0.03) 3px
                          )`
                        }}
                      />

                      {/* 唱片封面图 */}
                      <div className="absolute inset-[12%] rounded-full overflow-hidden shadow-inner">
                        <img
                          src={currentTrack.cover || 'https://picsum.photos/seed/default/400/400'}
                          alt={currentTrack.title}
                          className="w-full h-full object-cover"
                        />
                        {/* 封面暗角 */}
                        <div
                          className="absolute inset-0 rounded-full"
                          style={{
                            boxShadow: 'inset 0 0 30px rgba(0, 0, 0, 0.4)'
                          }}
                        />
                      </div>

                      {/* 中心标签 */}
                      <div
                        className="absolute inset-[38%] rounded-full flex items-center justify-center"
                        style={{
                          background: 'linear-gradient(135deg, #d4af77 0%, #8b7355 100%)',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)'
                        }}
                      >
                        <Disc3 className="w-8 h-8 text-black/70" />
                      </div>

                      {/* 高光反射 */}
                      <div
                        className="absolute inset-0 rounded-full opacity-30 pointer-events-none"
                        style={{
                          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, transparent 50%)'
                        }}
                      />
                    </motion.div>

                    {/* 唱臂 */}
                    <motion.div
                      animate={{ rotate: isPlaying ? 18 : -25 }}
                      transition={{
                        duration: 0.8,
                        ease: [0.4, 0, 0.2, 1]
                      }}
                      className="absolute top-4 right-[-20px] w-1 h-36 lg:h-44 origin-top rounded-full hidden md:block"
                      style={{
                        background: 'linear-gradient(to bottom, #d4af77 0%, #8b7355 50%, #6b5544 100%)',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
                      }}
                    >
                      {/* 唱头 */}
                      <div
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full"
                        style={{
                          background: 'linear-gradient(135deg, #d4af77 0%, #a08060 100%)',
                          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.4)'
                        }}
                      />
                    </motion.div>
                  </div>

                  {/* ===== 右侧：歌曲信息区 ===== */}
                  <div className="flex-1 flex flex-col min-w-0 max-w-xl">
                    {/* 歌曲标题 */}
                    <motion.h1
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1, duration: 0.5 }}
                      className="text-3xl md:text-4xl font-bold mb-3 truncate"
                      style={{
                        fontFamily: 'var(--font-display)',
                        color: '#f5f5f5',
                        letterSpacing: '-0.02em',
                        lineHeight: 1.2
                      }}
                    >
                      {currentTrack.title}
                    </motion.h1>

                    {/* 元信息行 */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15, duration: 0.5 }}
                      className="space-y-2 mb-6"
                    >
                      {/* 专辑名 */}
                      {currentTrack.album && (
                        <p
                          className="text-sm truncate"
                          style={{ color: '#999999' }}
                        >
                          专辑 · {currentTrack.album}
                        </p>
                      )}
                      {/* 歌手 */}
                      <p
                        className="text-sm font-medium truncate"
                        style={{ color: '#cccccc' }}
                      >
                        {currentTrack.artist}
                      </p>
                    </motion.div>

                    {/* 歌词/视频显示区域 */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3, duration: 0.5 }}
                      className="flex-1 min-h-[120px] rounded-2xl relative overflow-hidden"
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.04)'
                      }}
                    >
                      {(currentLyrics ?? currentTrack.lyrics) ? (
                        <LyricsDisplay
                          lyrics={(currentLyrics ?? currentTrack.lyrics)!}
                          currentTime={currentTime}
                          onSeek={(time) => onSeek?.(time)}
                          height={250}
                          className="rounded-2xl"
                          trackId={currentTrack.id}
                        />
                      ) : (
                        <>
                          <div className="text-center space-y-2 h-full flex flex-col items-center justify-center">
                            <Music
                              className="w-10 h-10 mx-auto opacity-20"
                              style={{ color: '#666666' }}
                            />
                            <p
                              className="text-sm"
                              style={{ color: '#555555' }}
                            >
                              歌词区域 · 暂无歌词
                            </p>
                          </div>

                          <div
                            className="absolute inset-0 opacity-[0.03]"
                            style={{
                              backgroundImage: `
                                linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
                                linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)
                              `,
                              backgroundSize: '40px 40px'
                            }}
                          />
                        </>
                      )}

                      <button
                        onClick={() => setShowLyricsSearch(true)}
                        className="absolute top-2 right-2 z-10 p-1.5 rounded-full transition-all hover:scale-110"
                        style={{
                          backgroundColor: 'rgba(0,0,0,0.4)',
                          color: 'rgba(255,255,255,0.5)',
                          backdropFilter: 'blur(8px)',
                        }}
                        title="搜索歌词"
                      >
                        <Search className="w-3.5 h-3.5" />
                      </button>
                    </motion.div>
                  </div>
                </div>

                {/* ===== 底部：播放控制栏 ===== */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35, duration: 0.5 }}
                  className="mt-8 pt-6"
                  style={{
                    borderTop: '1px solid rgba(255, 255, 255, 0.06)'
                  }}
                >
                  {/* 进度条 */}
                  <div className="mb-6">
                    <div
                      className="flex items-center gap-3 w-full cursor-pointer group"
                      onClick={handleProgressClick}
                    >
                      <span
                        className="text-xs tabular-nums w-10 text-right"
                        style={{ color: '#888888' }}
                      >
                        {formatTime(currentTime)}
                      </span>
                      <div
                        className="flex-1 h-1.5 rounded-full relative overflow-hidden"
                        style={{ backgroundColor: 'rgba(255, 255, 255, 0.08)' }}
                      >
                        <motion.div
                          className="h-full rounded-full relative"
                          style={{
                            width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                            background: 'linear-gradient(90deg, #D4765A 0%, #d4af77 100%)',
                            boxShadow: '0 0 12px rgba(212, 118, 90, 0.4)'
                          }}
                        >
                          {/* 进度条拖动点 */}
                          <div
                            className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200"
                            style={{
                              backgroundColor: '#d4af77',
                              boxShadow: '0 0 8px rgba(212, 175, 119, 0.6)'
                            }}
                          />
                        </motion.div>
                      </div>
                      <span
                        className="text-xs tabular-nums w-10"
                        style={{ color: '#888888' }}
                      >
                        {formatTime(duration)}
                      </span>
                    </div>
                  </div>

                  {/* 控制按钮组 */}
                  <div className="flex items-center justify-between">
                    {/* 左侧：占位（保持布局平衡） */}
                    <div className="flex items-center gap-2 w-32" />

                    {/* 中间：主播放控制 */}
                    <div className="flex items-center gap-6">
                      <button
                        type="button"
                        onClick={onToggleShuffle}
                        className={`p-2.5 rounded-full transition-all duration-300 hover:scale-110 active:scale-95 ${
                          shuffleMode ? 'opacity-100' : 'opacity-50'
                        }`}
                        style={{
                          color: shuffleMode ? '#d4af77' : '#999999'
                        }}
                      >
                        <Shuffle className="w-5 h-5" />
                      </button>

                      <button
                        type="button"
                        onClick={onPrevious}
                        className="p-2.5 rounded-full transition-all duration-300 hover:scale-110 active:scale-95"
                        style={{ color: '#cccccc' }}
                      >
                        <SkipBack className="w-6 h-6" />
                      </button>

                      {/* 播放/暂停主按钮 */}
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={onPlayPause}
                        className="w-16 h-16 rounded-full flex items-center justify-center relative"
                        style={{
                          background: 'linear-gradient(135deg, #D4765A 0%, #c45f42 100%)',
                          boxShadow: `
                            0 8px 24px rgba(212, 118, 90, 0.4),
                            inset 0 2px 4px rgba(255, 255, 255, 0.2)
                          `
                        }}
                      >
                        {/* 脉冲动画环 */}
                        {isPlaying && (
                          <motion.div
                            className="absolute inset-0 rounded-full"
                            animate={{
                              scale: [1, 1.3],
                              opacity: [0.4, 0]
                            }}
                            transition={{
                              duration: 1.5,
                              repeat: Infinity,
                              ease: 'easeOut'
                            }}
                            style={{
                              border: '2px solid #D4765A'
                            }}
                          />
                        )}

                        {isPlaying ? (
                          <Pause className="w-7 h-7 ml-0.5" style={{ color: '#ffffff' }} />
                        ) : (
                          <Play className="w-7 h-7 ml-1" style={{ color: '#ffffff' }} />
                        )}
                      </motion.button>

                      <button
                        type="button"
                        onClick={onNext}
                        className="p-2.5 rounded-full transition-all duration-300 hover:scale-110 active:scale-95"
                        style={{ color: '#cccccc' }}
                      >
                        <SkipForward className="w-6 h-6" />
                      </button>

                      <button
                        type="button"
                        className="p-2.5 rounded-full transition-all duration-300 hover:scale-110 active:scale-95 opacity-50"
                        style={{ color: '#999999' }}
                      >
                        <Repeat className="w-5 h-5" />
                      </button>
                    </div>

                    {/* 右侧：收藏和评论 */}
                    <div className="flex items-center gap-3 w-32 justify-end">
                      {onToggleFavorite && (
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.15 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={onToggleFavorite}
                          className="p-2.5 rounded-full transition-colors duration-300"
                          title={isFavorite ? '取消收藏' : '添加收藏'}
                        >
                          <Heart
                            className="w-5 h-5"
                            style={{
                              color: isFavorite ? '#D4765A' : '#999999',
                              fill: isFavorite ? '#D4765A' : 'transparent'
                            }}
                          />
                        </motion.button>
                      )}

                      <button
                        type="button"
                        onClick={() => setShowComments(true)}
                        className="p-2.5 rounded-full transition-all duration-300 hover:scale-110 active:scale-95"
                        style={{ color: '#999999' }}
                        title="查看评论"
                      >
                        <MessageCircle className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            ) : (
              /* ========== 评论区视图 ========== */
              <div className="h-[calc(95vh-28px)] flex flex-col">
                {/* 评论头部 */}
                <div
                  className="flex items-center gap-4 px-8 py-4"
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
                  }}
                >
                  <button
                    onClick={() => setShowComments(false)}
                    className="p-2 -ml-2 rounded-full transition-all duration-300 hover:scale-110 active:scale-95"
                    style={{ color: '#999999' }}
                  >
                    <ChevronDown className="w-6 h-6 rotate-90" />
                  </button>
                  <div className="flex-1">
                    <h2
                      className="text-lg font-semibold"
                      style={{
                        fontFamily: 'var(--font-display)',
                        color: '#f5f5f5'
                      }}
                    >
                      {currentTrack.title}
                    </h2>
                    <p
                      className="text-sm"
                      style={{ color: '#888888' }}
                    >
                      {currentTrack.artist} · 评论
                    </p>
                  </div>
                </div>

                {/* 评论内容区 */}
                <div className="flex-1 overflow-y-auto px-8 py-6">
                  <CommentSection
                    targetType="track"
                    targetId={currentTrack.id}
                    currentUser={currentUser || null}
                    title={`${currentTrack.title} 的评论`}
                  />
                </div>
              </div>
            )}

          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {detailContent}
      <LyricsSearchModal
        isOpen={showLyricsSearch}
        onClose={() => setShowLyricsSearch(false)}
        trackTitle={currentTrack.title}
        trackArtist={currentTrack.artist}
        trackId={currentTrack.id as number}
        onLyricsApplied={(lyrics) => setCurrentLyrics(lyrics)}
      />
    </>
  );
}
