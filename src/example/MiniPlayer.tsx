'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Shuffle,
  Repeat,
  Heart,
  MoreHorizontal,
  Minimize2,
  Maximize2,
  Disc,
  ListMusic
} from 'lucide-react';
import { Track } from '@/lib/music-service';

interface MusicPlayerProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  isFavorite?: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onToggleFavorite?: () => void;
}

export function MusicPlayer({
  currentTrack,
  isPlaying,
  isFavorite = false,
  onPlayPause,
  onNext,
  onPrevious,
  onToggleFavorite,
}: MusicPlayerProps) {
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [audioData, setAudioData] = useState<number[]>(new Array(32).fill(0));
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Audio playback control
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

  // Volume control
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Audio visualizer
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

  const handleError = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    console.error('Audio load error:', e);
    const audio = e.currentTarget;
    console.error('Audio src:', audio.src);
    console.error('Audio error:', audio.error);
  };

  const handleEnded = () => {
    onNext();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!currentTrack || !audioRef.current || !progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * duration;
    audioRef.current.currentTime = newTime;
    setProgress(newTime);
  };

  const handleToggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
    } else {
      setIsMuted(true);
    }
  };

  // Minimized view
  if (isMinimized && currentTrack) {
    return (
      <div 
        className="fixed bottom-4 right-4 rounded-full shadow-lg border p-2 z-50 transition-all duration-300 hover:scale-105"
        style={{ 
          backgroundColor: 'var(--card)',
          borderColor: 'var(--border)'
        }}
      >
        {currentTrack.play_url && (
          <audio
            ref={audioRef}
            src={currentTrack.play_url}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleEnded}
            onError={handleError}
            preload="metadata"
          />
        )}
        <div className="flex items-center space-x-2">
          <img
            src={currentTrack.cover || 'https://picsum.photos/seed/default/400/400'}
            alt={currentTrack.title}
            className="w-10 h-10 rounded-full object-cover"
          />
          <button
            onClick={onPlayPause}
            className="flex items-center justify-center w-8 h-8 rounded-full transition-colors duration-200"
            style={{ 
              backgroundColor: 'var(--primary)',
              color: 'var(--primary-foreground)'
            }}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
          <button
            onClick={() => setIsMinimized(false)}
            className="flex items-center justify-center w-6 h-6 transition-colors duration-200"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <Maximize2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  // No track selected
  if (!currentTrack) {
    return (
      <div 
        className="fixed bottom-0 left-0 right-0 z-50 px-8 py-5 flex items-center justify-between border-t glass"
        style={{ 
          backgroundColor: 'rgba(253, 251, 247, 0.95)',
          borderColor: 'var(--border)'
        }}
      >
        <div className="flex items-center gap-4 flex-1">
          <div 
            className="w-14 h-14 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: 'var(--accent)' }}
          >
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
            <button type="button" className="p-2.5" style={{ color: 'var(--muted-foreground)' }}>
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
            <button type="button" className="p-2.5" style={{ color: 'var(--muted-foreground)' }}>
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

  // Full player view
  return (
    <div 
      className="fixed bottom-0 left-0 right-0 z-50 border-t glass"
      style={{ 
        backgroundColor: 'rgba(253, 251, 247, 0.95)',
        borderColor: 'var(--border)'
      }}
    >
      {currentTrack.play_url && (
        <audio
          ref={audioRef}
          src={currentTrack.play_url}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
          onError={handleError}
          preload="metadata"
        />
      )}

      {/* Progress bar - full width at top */}
      <div 
        className="w-full h-1 cursor-pointer group" 
        ref={progressRef}
        onClick={handleProgressClick}
        style={{ backgroundColor: 'var(--muted)' }}
      >
        <div 
          className="h-full transition-all duration-100 relative group-hover:opacity-80"
          style={{ 
            width: `${duration > 0 ? (progress / duration) * 100 : 0}%`,
            backgroundColor: 'var(--primary)'
          }}
        >
          <div 
            className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 -mr-1.5"
            style={{ backgroundColor: 'var(--primary)' }}
          />
        </div>
      </div>

      {/* Audio visualizer */}
      <div className="absolute top-1 left-0 right-0 h-3 flex items-end justify-center gap-[2px] px-4 pointer-events-none">
        {audioData.slice(0, 24).map((value, i) => (
          <div
            key={i}
            className="w-1 rounded-full transition-all duration-100"
            style={{
              height: `${Math.max(2, value * 8)}px`,
              backgroundColor: isPlaying ? 'var(--primary)' : 'var(--muted-foreground)',
              opacity: isPlaying ? 0.6 : 0.2
            }}
          />
        ))}
      </div>

      <div className="flex items-center justify-between px-4 py-3">
        {/* Track info */}
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
            <img
              src={currentTrack.cover || 'https://picsum.photos/seed/default/400/400'}
              alt={currentTrack.title}
              className="w-full h-full object-cover"
              style={{
                animation: isPlaying ? 'spin 8s linear infinite' : 'none'
              }}
            />
            {isPlaying && (
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                <Disc className="w-5 h-5 text-white" style={{ animation: 'spin 4s linear infinite' }} />
              </div>
            )}
          </div>
          
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-sm truncate" style={{ color: 'var(--foreground)' }}>
              {currentTrack.title || 'Unknown Track'}
            </h3>
            <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
              {currentTrack.artist || 'Unknown Artist'}
            </p>
          </div>
          
          {onToggleFavorite && (
            <button
              onClick={onToggleFavorite}
              className="p-2 rounded-full transition-all duration-200 hover:scale-110"
              title={isFavorite ? '取消收藏' : '添加收藏'}
            >
              <Heart 
                className="w-4 h-4 transition-all"
                style={{ 
                  color: isFavorite ? 'var(--primary)' : 'var(--muted-foreground)',
                  fill: isFavorite ? 'var(--primary)' : 'none'
                }}
              />
            </button>
          )}
        </div>

        {/* Main controls */}
        <div className="flex items-center space-x-4 px-8">
          {/* Shuffle */}
          <button
            className="flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200 hover:scale-110"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <Shuffle className="w-4 h-4" />
          </button>

          {/* Previous */}
          <button
            onClick={onPrevious}
            className="flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200 hover:scale-110 hover:bg-accent"
            style={{ color: 'var(--foreground)' }}
          >
            <SkipBack className="w-5 h-5" />
          </button>

          {/* Play/Pause */}
          <button
            onClick={onPlayPause}
            className="flex items-center justify-center w-12 h-12 rounded-full shadow-lg transition-all duration-200 hover:scale-105"
            style={{ 
              backgroundColor: 'var(--primary)',
              color: 'var(--primary-foreground)'
            }}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5 ml-0.5" />
            )}
          </button>

          {/* Next */}
          <button
            onClick={onNext}
            className="flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200 hover:scale-110 hover:bg-accent"
            style={{ color: 'var(--foreground)' }}
          >
            <SkipForward className="w-5 h-5" />
          </button>

          {/* Repeat */}
          <button
            className="flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200 hover:scale-110"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <Repeat className="w-4 h-4" />
          </button>
        </div>

        {/* Time and volume */}
        <div className="flex items-center space-x-4 min-w-0 flex-1 justify-end">
          {/* Time display */}
          <div className="text-xs font-mono" style={{ color: 'var(--muted-foreground)' }}>
            {formatTime(progress)} / {formatTime(duration)}
          </div>

          {/* Volume control */}
          <div 
            className="relative"
            onMouseEnter={() => setShowVolumeSlider(true)}
            onMouseLeave={() => setShowVolumeSlider(false)}
          >
            <button
              onClick={handleToggleMute}
              className="flex items-center justify-center w-8 h-8 rounded-full transition-colors duration-200"
              style={{ color: 'var(--muted-foreground)' }}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            
            {/* Volume slider */}
            {showVolumeSlider && (
              <div 
                className="absolute bottom-full right-0 mb-2 rounded-lg shadow-lg border p-2"
                style={{ 
                  backgroundColor: 'var(--card)',
                  borderColor: 'var(--border)'
                }}
              >
                <div className="w-20 h-24 flex flex-col items-center">
                  <div className="text-xs mb-2" style={{ color: 'var(--muted-foreground)' }}>
                    {Math.round(volume * 100)}%
                  </div>
                  <div 
                    className="flex-1 w-1.5 rounded-full relative"
                    style={{ backgroundColor: 'var(--muted)' }}
                  >
                    <div 
                      className="w-full rounded-full absolute bottom-0"
                      style={{ 
                        height: `${volume * 100}%`,
                        backgroundColor: 'var(--primary)'
                      }}
                    />
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* More options */}
          <button
            className="flex items-center justify-center w-8 h-8 rounded-full transition-colors duration-200"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {/* Minimize */}
          <button
            onClick={() => setIsMinimized(true)}
            className="flex items-center justify-center w-8 h-8 rounded-full transition-colors duration-200"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
