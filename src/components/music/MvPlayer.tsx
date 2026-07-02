'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  PictureInPicture2,
  X,
  SkipBack,
  SkipForward,
  AlertCircle,
} from 'lucide-react';
import type { MvPlayerProps } from './types';

/**
 * MV 视频播放器组件
 * 全屏模态对话框，支持自定义控制栏、键盘快捷键、画中画模式
 */
export function MvPlayer({
  isOpen,
  onClose,
  mvUrl,
  title,
  artist,
  cover,
}: MvPlayerProps) {
  // 播放状态
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPiP, setIsPiP] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showInfoOverlay, setShowInfoOverlay] = useState(true);
  const [buffered, setBuffered] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // 引用
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressRef = useRef<HTMLInputElement>(null);

  // 重置所有状态
  const resetState = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setError(null);
    setShowInfoOverlay(true);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      videoRef.current.src = '';
    }
  }, []);

  // 打开时加载视频
  useEffect(() => {
    if (isOpen && videoRef.current && mvUrl) {
      resetState();
      videoRef.current.src = mvUrl;
      videoRef.current.load();
    } else if (!isOpen) {
      resetState();
    }

    return () => {
      // 清理定时器
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isOpen, mvUrl, resetState]);

  // 信息覆盖层自动隐藏（3秒后淡出）
  useEffect(() => {
    if (isOpen && showInfoOverlay) {
      const timer = setTimeout(() => setShowInfoOverlay(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, showInfoOverlay]);

  // 控制栏自动隐藏逻辑
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  }, [isPlaying]);

  // 鼠标移动时重置控制栏计时器
  const handleMouseMove = useCallback(() => {
    resetControlsTimer();
  }, [resetControlsTimer]);

  // 切换播放/暂停
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().catch((err) => {
        console.error('播放失败:', err);
        setError('播放失败，请检查视频格式是否支持');
      });
    } else {
      video.pause();
    }
  }, []);

  // 跳转
  const seekTo = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video || isNaN(time)) return;
    video.currentTime = Math.max(0, Math.min(time, duration));
  }, [duration]);

  // 快进快退（10秒）
  const skipForward = useCallback(
    () => seekTo(currentTime + 10),
    [seekTo, currentTime]
  );
  const skipBackward = useCallback(
    () => seekTo(currentTime - 10),
    [seekTo, currentTime]
  );

  // 音量控制
  const handleVolumeChange = useCallback((newVolume: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = newVolume;
    setVolume(newVolume);
    if (newVolume > 0) setIsMuted(false);
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isMuted) {
      video.volume = volume || 0.5;
      setIsMuted(false);
    } else {
      video.volume = 0;
      setIsMuted(true);
    }
  }, [isMuted, volume]);

  // 全屏切换
  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement && containerRef.current) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error('全屏切换失败:', err);
    }
  }, []);

  // 画中画模式
  const togglePiP = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiP(false);
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
        setIsPiP(true);
      } else {
        console.warn('浏览器不支持画中画');
      }
    } catch (err) {
      console.error('画中画切换失败:', err);
    }
  }, []);

  // 关闭播放器
  const handleClose = useCallback(() => {
    if (isFullscreen) {
      document.exitFullscreen().finally(onClose);
    } else {
      onClose();
    }
  }, [isFullscreen, onClose]);

  // 格式化时间显示
  const formatTime = useCallback((seconds: number): string => {
    if (isNaN(seconds) || !isFinite(seconds)) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }, []);

  // 进度条拖拽处理
  const handleProgressChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTime = (parseFloat(e.target.value) / 100) * duration;
      seekTo(newTime);
    },
    [duration, seekTo]
  );

  // 键盘快捷键
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 避免在输入框中触发
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'arrowleft':
          e.preventDefault();
          skipBackward();
          break;
        case 'arrowright':
          e.preventDefault();
          skipForward();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'escape':
          handleClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen,
    togglePlay,
    skipForward,
    skipBackward,
    toggleFullscreen,
    toggleMute,
    handleClose,
  ]);

  // 监听全屏变化
  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () =>
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);

  // 视频事件监听
  const videoEvents = useMemo(
    () => ({
      onPlay: () => setIsPlaying(true),
      onPause: () => setIsPlaying(false),
      onTimeUpdate: () => {
        if (videoRef.current) {
          setCurrentTime(videoRef.current.currentTime);
          updateBuffered();
        }
      },
      onLoadedMetadata: () => {
        if (videoRef.current) {
          setDuration(videoRef.current.duration);
          setError(null);
        }
      },
      onEnded: () => setIsPlaying(false),
      onError: () => {
        setError('视频加载失败，请检查文件格式或网络连接');
      },
      onVolumeChange: () => {
        if (videoRef.current) {
          setVolume(videoRef.current.volume);
          setIsMuted(videoRef.current.muted);
        }
      },
    }),
    []
  );

  // 更新缓冲进度
  const updateBuffered = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.buffered.length) return;

    let bufferedEnd = 0;
    for (let i = 0; i < video.buffered.length; i++) {
      if (video.buffered.start(i) <= video.currentTime) {
        bufferedEnd = video.buffered.end(i);
      }
    }
    setBuffered((bufferedEnd / video.duration) * 100);
  }, []);

  // 进度百分比
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // 渲染控制栏
  const renderControls = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: showControls ? 1 : 0 }}
      transition={{ duration: 0.3 }}
      className="absolute bottom-0 left-0 right-0 z-20"
    >
      {/* 渐变遮罩 */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />

      <div className="relative px-4 pb-4 pt-8 space-y-3">
        {/* 进度条 */}
        <div className="group flex items-center gap-3">
          <span className="text-xs text-white/70 tabular-nums w-11 text-right flex-shrink-0">
            {formatTime(currentTime)}
          </span>
          <div className="flex-1 relative h-1.5 rounded-full bg-white/20 cursor-pointer group/progress">
            {/* 缓冲进度 */}
            <div
              className="absolute top-0 left-0 h-full rounded-full bg-white/30"
              style={{ width: `${buffered}%` }}
            />
            {/* 播放进度 */}
            <motion.div
              className="absolute top-0 left-0 h-full rounded-full"
              style={{
                background:
                  'linear-gradient(to right, #D4765A, #E8A87C)',
                width: `${progressPercent}%`,
              }}
            />
            {/* 可拖拽滑块 */}
            <input
              ref={progressRef}
              type="range"
              min={0}
              max={100}
              value={progressPercent}
              onChange={handleProgressChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              aria-label="调整播放进度"
            />
            {/* 拖拽手柄 */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-lg opacity-0 group-hover/progress:opacity-100 transition-opacity"
              style={{ left: `calc(${progressPercent}% - 7px)` }}
            />
          </div>
          <span className="text-xs text-white/70 tabular-nums w-11 flex-shrink-0">
            {formatTime(duration)}
          </span>
        </div>

        {/* 控制按钮行 */}
        <div className="flex items-center justify-between">
          {/* 左侧：播放控制 */}
          <div className="flex items-center gap-1">
            <button
              onClick={skipBackward}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="后退10秒"
            >
              <SkipBack className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={togglePlay}
              className="p-3 rounded-full bg-white/15 hover:bg-white/25 transition-all duration-200 active:scale-95"
              aria-label={isPlaying ? '暂停' : '播放'}
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 text-white" fill="white" />
              ) : (
                <Play className="w-6 h-6 text-white ml-0.5" fill="white" />
              )}
            </button>
            <button
              onClick={skipForward}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="前进10秒"
            >
              <SkipForward className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* 右侧：音量、画中画、全屏、关闭 */}
          <div className="flex items-center gap-1">
            {/* 音量控制 */}
            <button
              onClick={toggleMute}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label={isMuted ? '取消静音' : '静音'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-5 h-5 text-white" />
              ) : (
                <Volume2 className="w-5 h-5 text-white" />
              )}
            </button>
            <div className="hidden sm:flex items-center w-20 group/volume">
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-full h-1 appearance-none rounded-full bg-white/30 cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md"
                aria-label="调节音量"
              />
            </div>

            {/* 分隔线 */}
            <div className="w-px h-5 bg-white/20 mx-1 hidden sm:block" />

            {/* 画中画 */}
            {typeof document !== 'undefined' &&
              document.pictureInPictureEnabled && (
                <button
                  onClick={togglePiP}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors hidden sm:flex"
                  aria-label={
                    isPiP ? '退出画中画' : '开启画中画'
                  }
                >
                  <PictureInPicture2
                    className={`w-5 h-5 ${isPiP ? 'text-[var(--primary)]' : 'text-white'}`}
                  />
                </button>
              )}

            {/* 全屏 */}
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label={isFullscreen ? '退出全屏' : '全屏'}
            >
              {isFullscreen ? (
                <Minimize className="w-5 h-5 text-white" />
              ) : (
                <Maximize className="w-5 h-5 text-white" />
              )}
            </button>

            {/* 关闭按钮 */}
            <button
              onClick={handleClose}
              className="p-2 rounded-lg hover:bg-red-500/20 transition-colors ml-1"
              aria-label="关闭播放器"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );

  // 渲染信息覆盖层
  const renderInfoOverlay = () => (
    <AnimatePresence>
      {showInfoOverlay && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="absolute top-0 left-0 right-0 z-10 pt-6 pb-16"
        >
          <div className="bg-gradient-to-b from-black/70 to-transparent px-6 py-4">
            <div className="flex items-center gap-4">
              {cover && (
                <img
                  src={cover}
                  alt={title}
                  className="w-14 h-14 rounded-lg object-cover shadow-lg"
                />
              )}
              <div>
                <h3 className="text-white font-semibold text-base truncate max-w-[300px] sm:max-w-[500px]">
                  {title}
                </h3>
                <p className="text-white/70 text-sm mt-0.5">{artist}</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // 渲染错误状态
  const renderError = () => (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-30 gap-4 p-6">
      <AlertCircle className="w-16 h-16 text-red-400" />
      <div className="text-center space-y-2">
        <p className="text-white font-medium">视频播放出错</p>
        <p className="text-white/60 text-sm max-w-sm">{error}</p>
      </div>
      <button
        onClick={() => {
          setError(null);
          if (videoRef.current) {
            videoRef.current.load();
          }
        }}
        className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20 transition-colors"
      >
        重试
      </button>
    </div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => isPlaying && setShowControls(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`MV播放器 - ${title} by ${artist}`}
        >
          <div
            ref={containerRef}
            className="relative w-full h-full max-w-screen-xl mx-auto"
            style={{ aspectRatio: '16/9' }}
          >
            {/* 视频元素 */}
            <video
              ref={videoRef}
              className="w-full h-full object-contain bg-black"
              playsInline
              preload="metadata"
              {...videoEvents}
              onClick={togglePlay}
              onDoubleClick={toggleFullscreen}
            />

            {/* 信息覆盖层 */}
            {renderInfoOverlay()}

            {/* 控制栏 */}
            {renderControls()}

            {/* 错误提示 */}
            {error && renderError()}

            {/* 中央大播放按钮（暂停时显示） */}
            {!isPlaying && !error && (
              <motion.button
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                onClick={togglePlay}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-all duration-200 active:scale-95"
                aria-label="播放"
              >
                <Play
                  className="w-10 h-10 text-white ml-1"
                  fill="white"
                />
              </motion.button>
            )}

            {/* 快捷键提示（移动端隐藏） */}
            <div className="absolute top-4 right-4 z-10 hidden lg:flex items-center gap-2 text-xs text-white/40">
              <kbd className="px-1.5 py-0.5 rounded bg-white/10">空格</kbd> 播放
              <kbd className="px-1.5 py-0.5 rounded bg-white/10">←→</kbd> 快进
              <kbd className="px-1.5 py-0.5 rounded bg-white/10">F</kbd> 全屏
              <kbd className="px-1.5 py-0.5 rounded bg-white/10">M</kbd> 静音
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default MvPlayer;
