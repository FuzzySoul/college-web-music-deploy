'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Disc, Repeat, Shuffle, ListMusic, Heart, RefreshCw, MessageCircle, ChevronUp, Video, FileText } from 'lucide-react';
import { Track } from '@/lib/music-service';
import { usePlayer } from '@/app/home/context/PlayerContext';
import { SongDetailPage } from './SongDetailPage';

interface MusicPlayerProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  isFavorite?: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onToggleFavorite?: () => void;
  shuffleMode?: boolean;
  onToggleShuffle?: () => void;
  onRefreshUrl?: () => Promise<boolean>;
  onPlayMv?: (track: any) => void;
  onShowLyrics?: (track: any) => void;
}

export function MusicPlayer({ 
  currentTrack, 
  isPlaying, 
  isFavorite,
  onPlayPause, 
  onNext, 
  onPrevious,
  onToggleFavorite,
  shuffleMode,
  onToggleShuffle,
  onRefreshUrl,
  onPlayMv,
  onShowLyrics,
}: MusicPlayerProps) {
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioData, setAudioData] = useState<number[]>(new Array(32).fill(0));
  const [isRefreshingUrl, setIsRefreshingUrl] = useState(false);
  const [urlErrorCount, setUrlErrorCount] = useState(0);
  const [isDark, setIsDark] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastTrackIdRef = useRef<string | number | null>(null);
  const { songCommentTarget, setSongCommentTarget } = usePlayer();

  // 判断是否为本地音乐（有歌词或MV）
  const isLocalMusic = currentTrack && (
    (currentTrack as any).lyrics ||
    (currentTrack as any).mv_url
  );

  const handleSeek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  }, []);

  useEffect(() => {
    const checkDarkMode = () => {
      const isDarkMode = document.documentElement.classList.contains('dark');
      setIsDark(isDarkMode);
    };
    
    checkDarkMode();
    
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          checkDarkMode();
        }
      });
    });
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 当歌曲切换时重置错误计数
  useEffect(() => {
    if (currentTrack?.id !== lastTrackIdRef.current) {
      setUrlErrorCount(0);
      lastTrackIdRef.current = currentTrack?.id || null;
    }
  }, [currentTrack]);

  useEffect(() => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          if (error.name !== 'AbortError') {
            console.error('Play error:', error);
          }
        });
      }
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, currentTrack]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    if (isPlaying) {
      const interval = setInterval(() => {
        setAudioData(Array.from({ length: 32 }, () => Math.random()));
      }, 100);
      return () => clearInterval(interval);
    } else {
      setAudioData(new Array(32).fill(0));
    }
  }, [isPlaying]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setProgress(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  // 处理音频加载错误（包括URL过期）
  const handleError = useCallback(async (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const audio = e.currentTarget;
    const error = audio.error;
    
    console.error('Audio load error:', {
      src: audio.src,
      errorCode: error?.code,
      errorMessage: error?.message,
      networkState: audio.networkState,
      readyState: audio.readyState,
    });
    
    // 错误码说明：
    // 1 = MEDIA_ERR_ABORTED - 获取过程被用户中止
    // 2 = MEDIA_ERR_NETWORK - 网络错误
    // 3 = MEDIA_ERR_DECODE - 解码错误
    // 4 = MEDIA_ERR_SRC_NOT_SUPPORTED - 不支持该音频格式/URL
    
    // 网络错误(2)或源不支持(4)可能是URL过期导致的
    const isUrlExpired = error?.code === 2 || error?.code === 4;
    const maxRetries = 2;
    
    if (isUrlExpired && urlErrorCount < maxRetries && onRefreshUrl && !isRefreshingUrl) {
      console.log(`[handleError] 检测到可能的URL过期，尝试刷新 (${urlErrorCount + 1}/${maxRetries})`);
      setIsRefreshingUrl(true);
      
      try {
        const success = await onRefreshUrl();
        if (success) {
          console.log('[handleError] URL刷新成功，重新播放');
          setUrlErrorCount(0); // 重置错误计数
          // 音频会自动重新加载，因为 currentTrack 已更新
        } else {
          console.error('[handleError] URL刷新失败');
          setUrlErrorCount(prev => prev + 1);
        }
      } catch (refreshError) {
        console.error('[handleError] URL刷新异常:', refreshError);
        setUrlErrorCount(prev => prev + 1);
      } finally {
        setIsRefreshingUrl(false);
      }
    } else if (urlErrorCount >= maxRetries) {
      console.error('[handleError] 已达到最大重试次数，跳过自动刷新');
      // 可以选择在这里显示一个提示给用户
    }
  }, [urlErrorCount, onRefreshUrl, isRefreshingUrl]);

  const handleEnded = () => {
    onNext();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!currentTrack || !audioRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * duration;
    audioRef.current.currentTime = newTime;
    setProgress(newTime);
  };

  if (!currentTrack) {
    return (
      <div
        className="fixed bottom-0 left-0 right-0 z-50 px-8 py-5 flex items-center justify-between border-t glass transition-colors duration-300"
        style={{
          backgroundColor: isDark ? 'rgba(30, 30, 30, 0.95)' : 'rgba(253, 251, 247, 0.95)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
          boxShadow: isDark
            ? '0 -4px 20px rgba(0, 0, 0, 0.3)'
            : '0 -4px 20px rgba(0, 0, 0, 0.06)',
        }}
      >
        <div className="flex items-center gap-4 flex-1">
          <div className="w-14 h-14 rounded-xl bg-transparent flex items-center justify-center magnetic-hover" style={{ backgroundColor: 'var(--accent)' }}>
            <ListMusic className="w-6 h-6" style={{ color: 'var(--muted-foreground)' }} />
          </div>
          <div>
            <p className="text-sm font-normal" style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-display)' }}>
              未选择歌曲
            </p>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              选择一首歌曲开始播放
            </p>
          </div>
        </div>

        <div className="flex-1 flex justify-center">
          <div className="flex items-center gap-5">
            <button type="button" className="p-2.5 rounded-full transition-all hover:scale-110" style={{ color: 'var(--muted-foreground)' }}>
              <SkipBack className="w-5 h-5" />
            </button>
            <button
              type="button"
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'var(--muted-foreground)', opacity: 0.3 }}
              disabled
            >
              <Play className="w-5 h-5" style={{ color: 'var(--card)' }} />
            </button>
            <button type="button" className="p-2.5 rounded-full transition-all hover:scale-110" style={{ color: 'var(--muted-foreground)' }}>
              <SkipForward className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex justify-end items-center gap-4">
          <div className="w-24 h-1 rounded-full" style={{ backgroundColor: 'var(--muted)', opacity: 0.3 }}>
            <div className="h-full rounded-full" style={{ width: '0%', backgroundColor: 'var(--muted-foreground)' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 px-8 py-5 border-t glass transition-colors duration-300"
      style={{
        backgroundColor: isDark ? 'rgba(30, 30, 30, 0.95)' : 'rgba(253, 251, 247, 0.95)',
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
        boxShadow: isDark
          ? '0 -4px 20px rgba(0, 0, 0, 0.3)'
          : '0 -4px 20px rgba(0, 0, 0, 0.06)',
      }}
    >
      {currentTrack.play_url ? (
        <audio
          ref={audioRef}
          src={currentTrack.play_url}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
          onError={handleError}
          preload="metadata"
          aria-label="Audio player"
        />
      ) : null}

      <div className="absolute top-0 left-0 right-0 h-1 flex items-end justify-center gap-[2px] px-4">
        {audioData.slice(0, 24).map((value, i) => (
          <div
            key={i}
            className="w-1 rounded-full transition-all duration-100"
            style={{
              height: `${Math.max(2, value * 12)}px`,
              backgroundColor: isPlaying ? 'var(--primary)' : 'var(--muted-foreground)',
              opacity: isPlaying ? 0.8 : 0.3
            }}
          />
        ))}
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* 可点击的封面和标题区域 - 打开详情页 */}
          <button
            type="button"
            onClick={() => setIsDetailOpen(true)}
            className="flex items-center gap-4 flex-1 min-w-0 group rounded-xl p-2 -m-2 transition-all"
            style={{
              '--hover-bg': isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
            } as React.CSSProperties}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = `${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)'}`;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
            title="打开歌曲详情"
          >
            <div className="relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
              <img
                src={currentTrack.cover || 'https://picsum.photos/seed/default/400/400'}
                alt={currentTrack.title}
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                style={{
                  animation: isPlaying ? 'spin 8s linear infinite' : 'none'
                }}
              />
              {isPlaying && (
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                  <Disc className="w-6 h-6 text-white spin" style={{ animationDuration: '4s' }} />
                </div>
              )}
              {/* 详情页提示图标 */}
              <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded-full p-1">
                <ChevronUp className="w-3 h-3 text-white" />
              </div>
            </div>
            <div className="min-w-0 text-left">
              <h4 className="font-medium text-sm truncate group-hover:text-primary transition-colors" style={{ color: 'var(--foreground)' }}>
                {currentTrack.title}
              </h4>
              <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
                {currentTrack.artist}
              </p>
            </div>
          </button>
          
          {onToggleFavorite && (
            <button
              type="button"
              onClick={onToggleFavorite}
              className="p-2 rounded-full transition-all magnetic-hover"
              style={{
                '--hover-bg': isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
              } as React.CSSProperties}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = `${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)'}`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
              title={isFavorite ? '取消收藏' : '添加收藏'}
            >
              <Heart 
                className="w-5 h-5 transition-all" 
                style={{ 
                  color: isFavorite ? 'var(--primary)' : 'var(--muted-foreground)',
                  fill: isFavorite ? 'var(--primary)' : 'none'
                }} 
              />
            </button>
          )}
          
          {/* 歌曲评论按钮 */}
          <button
            type="button"
            onClick={() => {
              if (!currentTrack) return;
              if (songCommentTarget?.trackId === currentTrack.id) {
                setSongCommentTarget(null);
              } else {
                setSongCommentTarget({
                  trackId: currentTrack.id,
                  title: currentTrack.title,
                  artist: currentTrack.artist
                });
              }
            }}
            title="查看评论"
            className="p-2 rounded-full transition-all duration-300 hover:scale-110 active:scale-95"
            style={{
              color: songCommentTarget?.trackId === currentTrack?.id ? 'var(--primary)' : 'var(--muted-foreground)'
            }}
          >
            <MessageCircle className="w-5 h-5" />
          </button>

          {/* URL刷新状态指示器 */}
          {isRefreshingUrl && (
            <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--primary)' }}>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>刷新链接...</span>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-3 flex-1">
          <div className="flex items-center gap-5">
            <button type="button"
              onClick={onToggleShuffle}
              className={`p-2.5 rounded-full transition-all magnetic-hover ${shuffleMode ? 'text-primary' : ''}`}
              style={{ color: shuffleMode ? 'var(--primary)' : 'var(--muted-foreground)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = `${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)'}`; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <Shuffle className="w-4 h-4" />
            </button>
            {/* MV播放按钮 - 仅本地音乐显示 */}
            {isLocalMusic && (currentTrack as any)?.mv_url && (
              <button
                type="button"
                onClick={() => onPlayMv?.(currentTrack)}
                title="播放MV"
                className="p-2.5 rounded-full transition-all magnetic-hover hover:scale-110"
                style={{ color: 'var(--muted-foreground)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = `${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)'}`; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <Video className="w-4 h-4" />
              </button>
            )}
            {/* 歌词按钮 - 仅本地音乐显示 */}
            {isLocalMusic && (currentTrack as any)?.lyrics && (
              <button
                type="button"
                onClick={() => onShowLyrics?.(currentTrack)}
                title="查看歌词"
                className="p-2.5 rounded-full transition-all magnetic-hover hover:scale-110"
                style={{ color: 'var(--muted-foreground)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = `${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)'}`; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <FileText className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onPrevious}
              className="p-2.5 rounded-full transition-all magnetic-hover"
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = `${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)'}`; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <SkipBack className="w-5 h-5" style={{ color: 'var(--foreground)' }} />
            </button>
            <button
              type="button"
              onClick={onPlayPause}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all play-pulse ${isPlaying ? 'active-pulse' : ''}`}
              style={{ backgroundColor: 'var(--primary)' }}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" style={{ color: 'var(--primary-foreground)' }} />
              ) : (
                <Play className="w-5 h-5 ml-0.5" style={{ color: 'var(--primary-foreground)' }} />
              )}
            </button>
            <button
              type="button"
              onClick={onNext}
              className="p-2.5 rounded-full transition-all magnetic-hover"
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = `${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)'}`; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <SkipForward className="w-5 h-5" style={{ color: 'var(--foreground)' }} />
            </button>
            <button type="button" className="p-2.5 rounded-full transition-all magnetic-hover"
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = `${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)'}`; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <Repeat className="w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
            </button>
          </div>
          
          <div className="flex items-center gap-3 w-full max-w-md">
            <span className="text-xs tabular-nums" style={{ color: 'var(--muted-foreground)' }}>
              {formatTime(progress)}
            </span>
            <div 
              className="flex-1 h-1.5 rounded-full cursor-pointer group progress-glow"
              style={{ backgroundColor: 'var(--muted)' }}
              onClick={handleProgressClick}
            >
              <div 
                className="h-full rounded-full relative group"
                style={{ 
                  width: `${duration > 0 ? (progress / duration) * 100 : 0}%`,
                  backgroundColor: 'var(--primary)'
                }}
              >
                <div 
                  className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                  style={{ backgroundColor: 'var(--primary)' }}
                />
              </div>
            </div>
            <span className="text-xs tabular-nums" style={{ color: 'var(--muted-foreground)' }}>
              {formatTime(duration)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 flex-1">
          <button
            type="button"
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 rounded-full transition-all magnetic-hover"
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = `${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)'}`; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            {isMuted ? (
              <VolumeX className="w-5 h-5" style={{ color: 'var(--muted-foreground)' }} />
            ) : (
              <Volume2 className="w-5 h-5" style={{ color: 'var(--muted-foreground)' }} />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-20 accent-primary"
            style={{ accentColor: 'var(--primary)' }}
          />
        </div>
      </div>

      {/* ===== 全屏详情页 ===== */}
      <SongDetailPage
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        isFavorite={isFavorite}
        onPlayPause={onPlayPause}
        onNext={onNext}
        onPrevious={onPrevious}
        onToggleFavorite={onToggleFavorite}
        shuffleMode={shuffleMode}
        onToggleShuffle={onToggleShuffle}
        currentTime={progress}
        duration={duration}
        onSeek={handleSeek}
        onPlayMv={onPlayMv}
      />
    </div>
  );
}
