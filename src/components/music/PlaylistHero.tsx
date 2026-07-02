'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, useTransform, useSpring, MotionValue } from 'framer-motion';
import { Music, Play, Heart, MoreHorizontal, ArrowLeft } from 'lucide-react';
import React from 'react';
import { usePlaylistGradient } from '@/app/home/context/PlaylistGradientContext';

interface PlaylistHeroProps {
  name: string;
  description?: string;
  cover: string | null;
  trackCount?: number;
  creator?: string;
  onPlay?: () => void;
  onBack?: () => void;
  onEdit?: () => void;
  showBackButton?: boolean;
  isInContainer?: boolean;
  scrollProgress?: MotionValue<number>;
  dominantColorOverride?: { hex: string; rgb: { r: number; g: number; b: number } };
  actionButtons?: React.ReactNode;
  coverShape?: 'square' | 'circle';
  static?: boolean;
  isFavorited?: boolean;
  favoriteCount?: number;
  onToggleFavorite?: () => void;
  disabled?: boolean;
}

function extractDominantColor(imageUrl: string): Promise<{ hex: string; rgb: { r: number; g: number; b: number } }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({ hex: '#C15F3C', rgb: { r: 193, g: 95, b: 60 } });
        return;
      }
      
      canvas.width = 50;
      canvas.height = 50;
      ctx.drawImage(img, 0, 0, 50, 50);
      
      const imageData = ctx.getImageData(0, 0, 50, 50).data;
      let r = 0, g = 0, b = 0, count = 0;
      
      for (let i = 0; i < imageData.length; i += 16) {
        r += imageData[i];
        g += imageData[i + 1];
        b += imageData[i + 2];
        count++;
      }
      
      r = Math.floor(r / count);
      g = Math.floor(g / count);
      b = Math.floor(b / count);
      
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const gray = Math.floor((max + min) / 2);
      r = Math.floor(r * 0.3 + gray * 0.7);
      g = Math.floor(g * 0.3 + gray * 0.7);
      b = Math.floor(b * 0.3 + gray * 0.7);
      
      const hex = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
      resolve({ hex, rgb: { r, g, b } });
    };
    img.onerror = () => resolve({ hex: '#C15F3C', rgb: { r: 193, g: 95, b: 60 } });
    img.src = imageUrl;
  });
}

export function PlaylistHero({
  name,
  description,
  cover,
  trackCount,
  creator,
  onPlay,
  onBack,
  onEdit,
  showBackButton = false,
  isInContainer = false,
  scrollProgress,
  dominantColorOverride,
  actionButtons,
  coverShape = 'square',
  static: isStatic = false,
  isFavorited = false,
  favoriteCount,
  onToggleFavorite,
  disabled = false,
}: PlaylistHeroProps) {
  const [dominantColor, setDominantColor] = useState(dominantColorOverride || { hex: '#C15F3C', rgb: { r: 193, g: 95, b: 60 } });
  const coverRef = useRef<HTMLDivElement>(null);
  const { setGradientColor } = usePlaylistGradient();
  const { r, g, b } = dominantColor.rgb;

  useEffect(() => {
    if (dominantColorOverride) {
      setDominantColor(dominantColorOverride);
      setGradientColor(dominantColorOverride.rgb);
    } else if (cover) {
      extractDominantColor(cover).then((color) => {
        setDominantColor(color);
        setGradientColor(color.rgb);
      });
    }

    return () => {
      setGradientColor(null);
    };
  }, [cover, dominantColorOverride]);

  // 默认滚动进度值
  const defaultProgress: MotionValue<number> = { get: () => 0 } as MotionValue<number>;
  const progress = scrollProgress || defaultProgress;

  const smoothProgress = useSpring(progress, {
    stiffness: 300,
    damping: 30,
    restDelta: 0.001
  });

  const heroHeight = isStatic ? 250 : useTransform(smoothProgress, [0, 1], [250, 80]);
  const coverScale = isStatic ? 1 : useTransform(smoothProgress, [0, 1], [1, 0.35]);
  const coverSize = isStatic ? 176 : useTransform(smoothProgress, [0, 1], [176, 56]);
  const titleFontSize = isStatic ? 64 : useTransform(smoothProgress, [0, 1], [64, 24]);
  const infoOpacity = isStatic ? 1 : useTransform(smoothProgress, [0, 0.5], [1, 0]);
  const infoY = isStatic ? 0 : useTransform(smoothProgress, [0, 0.5], [0, -20]);
  const headerBgOpacity = isStatic ? 0 : useTransform(smoothProgress, [0.3, 1], [0, 1]);
  const blurOpacity = isStatic ? 0.4 : useTransform(smoothProgress, [0, 1], [0.4, 0.15]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className={`relative overflow-hidden ${isInContainer ? '' : 'rounded-2xl'}`}
      style={{
        height: heroHeight,
        backgroundColor: 'transparent',
        minHeight: 80,
      }}
    >
      {/* 主内容区域 - 使用 flex 布局 */}
      <div className="relative z-10 flex items-center gap-4 sm:gap-6 p-5 sm:p-6 h-full">
        
        {/* 封面图 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.34, 1.56, 0.64, 1] }}
          ref={coverRef}
          className="flex-shrink-0 relative group"
          style={{
            scale: coverScale,
            marginTop: '65px',
          }}
        >
          <motion.div
            className={`${coverShape === 'circle' ? 'rounded-full' : 'rounded-xl'} overflow-hidden shadow-xl ring-1 ring-black/5 dark:ring-white/10 transition-transform duration-300 group-hover:scale-[1.02]`}
            style={{
              width: coverSize,
              height: coverSize,
              boxShadow: '0 12px 40px -8px rgba(0, 0, 0, 0.15), 0 4px 12px -2px rgba(0, 0, 0, 0.1)',
            }}
          >
            {cover ? (
              <img
                src={cover}
                alt={name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{
                  background: coverShape === 'circle'
                    ? `linear-gradient(135deg, hsl(${name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360}, 70%, 50%), hsl(${(name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 3) % 360}, 60%, 40%))`
                    : 'var(--primary)'
                }}
              >
                {coverShape === 'circle' ? (
                  <span className="text-white font-bold" style={{ fontSize: '40%' }}>{name.charAt(0).toUpperCase()}</span>
                ) : (
                  <Music className="w-10 h-10 text-white/80" />
                )}
              </div>
            )}
          </motion.div>
        </motion.div>

        {/* 歌单信息 */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex-1 min-w-0 flex flex-col justify-center"
        >
          {/* 歌单名称 - Alan Wake 风格超粗体 */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
            className="font-black tracking-tighter leading-[1.1] mb-1 mt-0 flex items-center gap-2"
            style={{
              color: 'var(--foreground)',
              fontFamily: 'var(--font-display)',
              letterSpacing: '-0.02em',
              fontSize: titleFontSize,
            }}
          >
            {name}
            {onEdit && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="p-1 rounded-md hover:bg-[var(--accent)]/50 transition-all duration-200 hover:scale-110 active:scale-95"
                title="编辑歌单"
                aria-label="编辑歌单"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  <path d="m15 5 4 4" />
                </svg>
              </button>
            )}
          </motion.h1>

          {/* 操作按钮区域 - 网易云音乐风格 */}
          {actionButtons && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 57 }}
              transition={{ duration: 0.4, delay: 0.35 }}
              className="flex items-center gap-3 mt-1"
              style={{
                opacity: infoOpacity,
              }}
            >
              {actionButtons}
            </motion.div>
          )}
          
          {/* 描述 - 滚动时隐藏 */}
          {description && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="text-sm text-[var(--muted-foreground)] mb-2 line-clamp-2 max-w-xl"
              style={{
                opacity: infoOpacity,
                y: infoY,
              }}
            >
              {description}
            </motion.p>
          )}
          
          {/* 创建者和歌曲数量 - 滚动时隐藏 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.45 }}
            className="flex items-center gap-4 text-sm"
            style={{ 
              color: 'var(--muted-foreground)',
              opacity: infoOpacity,
              y: infoY,
            }}
          >
            {creator && (
              <span className="flex items-center gap-1.5">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-xs text-white"
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  {creator[0]}
                </div>
                <span>{creator}</span>
              </span>
            )}
          </motion.div>
        </motion.div>

        {/* 操作按钮 - 滚动时隐藏 */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="hidden sm:flex items-center gap-2"
          style={{
            opacity: infoOpacity,
          }}
        >
          <button
            onClick={onToggleFavorite}
            disabled={disabled}
            className="p-2.5 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title={isFavorited ? '取消收藏' : '收藏'}
          >
            <Heart
              className="w-5 h-5 transition-colors"
              style={{
                color: isFavorited ? '#ff4444' : 'var(--foreground)',
                fill: isFavorited ? '#ff4444' : 'transparent',
              }}
            />
          </button>
          {favoriteCount !== undefined && (
            <span className="text-sm font-medium whitespace-nowrap" style={{ color: 'var(--muted-foreground)' }}>
              {favoriteCount}
            </span>
          )}
          <button
            className="p-2.5 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-colors"
            title="更多"
          >
            <MoreHorizontal className="w-5 h-5" style={{ color: 'var(--foreground)' }} />
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}
