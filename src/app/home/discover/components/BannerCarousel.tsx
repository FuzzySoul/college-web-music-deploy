'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';

// 类型定义
export interface BannerItem {
  id: string;
  image: string;
  title: string;
  subtitle?: string;
  ctaText?: string;
  ctaLink?: string;
}

// 导入主题颜色类型（从父组件传入）
interface ThemeColors {
  background: string;
  primaryText: string;
  secondaryText: string;
  accentGold: string;
  borderMedium: string;
  skeletonFrom: string;
  skeletonTo: string;
  skeletonShimmer: string;
}

interface BannerCarouselProps {
  banners: BannerItem[];
  autoPlayInterval?: number; // 默认5000ms
  height?: string; // 默认 'h-[320px]'
  className?: string;
  onBannerClick?: (banner: BannerItem) => void;
  isDark?: boolean; // 新增：主题状态
  themeStyles?: ThemeColors; // 新增：主题样式对象
}

export const BannerCarousel: React.FC<BannerCarouselProps> = ({
  banners,
  autoPlayInterval = 5000,
  height = 'h-[320px]',
  className = '',
  onBannerClick,
  isDark = true, // 默认深色模式（向后兼容）
  themeStyles, // 从父组件传入的主题样式
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0); // 1: next, -1: prev
  const [isPaused, setIsPaused] = useState(false);

  // 自动轮播逻辑
  useEffect(() => {
    if (isPaused || banners.length <= 1) return;

    const timer = setInterval(() => {
      setDirection(1);
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, autoPlayInterval);

    return () => clearInterval(timer);
  }, [isPaused, banners.length, autoPlayInterval]);

  // 手动切换到指定索引
  const goToSlide = useCallback((index: number) => {
    setDirection(index > currentIndex ? 1 : -1);
    setCurrentIndex(index);
  }, [currentIndex]);

  // 下一张
  const nextSlide = useCallback(() => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  }, [banners.length]);

  // 上一张
  const prevSlide = useCallback(() => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
  }, [banners.length]);

  // 动画变体
  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
      scale: 0.95,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (direction: number) => ({
      x: direction > 0 ? -300 : 300,
      opacity: 0,
      scale: 1.05,
    }),
  };

  // Loading骨架屏
  if (!banners || banners.length === 0) {
    return (
      <div
        className={`relative w-full ${height} rounded-2xl overflow-hidden transition-colors duration-300`}
        style={{
          background: `linear-gradient(135deg, ${themeStyles?.skeletonFrom || '#111111'} 0%, ${themeStyles?.skeletonTo || '#1a1a1a'} 100%)`,
        }}
      >
        {/* 骨架屏shimmer效果 */}
        <div
          className="absolute inset-0 skeleton-shimmer"
          style={{
            background: `linear-gradient(90deg, ${themeStyles?.skeletonTo || '#1a1a1a'} 0%, ${themeStyles?.skeletonShimmer || '#262626'} 50%, ${themeStyles?.skeletonTo || '#1a1a1a'} 100%)`,
            backgroundSize: '200% 100%',
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={`relative group w-full ${height} rounded-2xl overflow-hidden cursor-pointer ${className} transition-all duration-400 ease-out`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      style={{
        background: themeStyles?.background || '#0a0a0a',
        boxShadow: isDark
          ? 'inset 0 1px 0 rgba(255,255,255,0.03), 0 8px 32px rgba(0,0,0,0.4)'
          : 'inset 0 1px 0 rgba(255,255,255,0.5), 0 8px 32px rgba(0,0,0,0.08)',
      }}
    >
      {/* 轮播内容区域 */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={currentIndex}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            duration: 0.6,
            ease: [0.4, 0, 0.2, 1],
          }}
          className="absolute inset-0"
          onClick={() => onBannerClick?.(banners[currentIndex])}
        >
          {/* 背景图片 */}
          <div className="relative w-full h-full">
            <img
              src={banners[currentIndex].image}
              alt={banners[currentIndex].title}
              className="w-full h-full object-cover"
              loading="lazy"
            />

            {/* 底部深色渐变遮罩 */}
            <div
              className="absolute bottom-0 left-0 right-0 h-3/4 transition-opacity duration-300"
              style={{
                background: isDark
                  ? 'linear-gradient(to top, rgba(10,10,10,0.95) 0%, rgba(10,10,10,0.6) 40%, transparent 100%)'
                  : 'linear-gradient(to top, rgba(250,249,247,0.95) 0%, rgba(250,249,247,0.5) 40%, transparent 100%)',
              }}
            />

            {/* 左侧微光效果 */}
            <div
              className="absolute top-0 left-0 w-1/3 h-full opacity-20 transition-opacity duration-300"
              style={{
                background: `linear-gradient(90deg, ${themeStyles?.accentGold ? `${themeStyles.accentGold}15` : 'rgba(212,175,119,0.15)'}, transparent)`,
              }}
            />

            {/* 文字内容区 */}
            <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12">
              <div className="max-w-2xl">
                <motion.h2
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="text-3xl md:text-4xl font-bold mb-3 leading-tight transition-colors duration-300"
                  style={{ color: themeStyles?.primaryText || '#f5f5f5', fontFamily: "'Instrument Serif', serif" }}
                >
                  {banners[currentIndex].title}
                </motion.h2>

                {banners[currentIndex].subtitle && (
                  <motion.p
                    initial={{ y: 16, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3, duration: 0.5 }}
                    className="text-base md:text-lg mb-6 max-w-xl line-clamp-2 transition-colors duration-300"
                    style={{ color: themeStyles?.secondaryText || '#999999' }}
                  >
                    {banners[currentIndex].subtitle}
                  </motion.p>
                )}

                {banners[currentIndex].ctaText && (
                  <motion.button
                    initial={{ y: 12, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4, duration: 0.4 }}
                    whileHover={{ scale: 1.02, boxShadow: `0 8px 24px ${themeStyles?.accentGold ? `${themeStyles.accentGold}40` : 'rgba(212,175,119,0.25)'}` }}
                    whileTap={{ scale: 0.98 }}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-all duration-300"
                    style={{
                      background: `linear-gradient(135deg, ${themeStyles?.accentGold || '#d4af77'} 0%, ${isDark ? '#b29364' : '#a88b5a'} 100%)`,
                      color: isDark ? '#0a0a0a' : '#faf9f7',
                      boxShadow: `0 4px 12px ${themeStyles?.accentGold ? `${themeStyles.accentGold}33` : 'rgba(212,175,119,0.2)'}`,
                    }}
                  >
                    <Play className="w-4 h-4" />
                    {banners[currentIndex].ctaText}
                  </motion.button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* 左右导航箭头 */}
      <>
        <button
          onClick={(e) => {
            e.stopPropagation();
            prevSlide();
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-400 backdrop-blur-sm"
          style={{
            background: isDark ? 'rgba(17,17,17,0.7)' : 'rgba(255,255,255,0.85)',
            border: `1px solid ${themeStyles?.borderMedium || (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)')}`,
            boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.3)' : '0 4px 16px rgba(0,0,0,0.08)',
          }}
          aria-label="上一张"
        >
          <ChevronLeft className="w-6 h-6" style={{ color: themeStyles?.primaryText || '#f5f5f5' }} />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            nextSlide();
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-400 backdrop-blur-sm"
          style={{
            background: isDark ? 'rgba(17,17,17,0.7)' : 'rgba(255,255,255,0.85)',
            border: `1px solid ${themeStyles?.borderMedium || (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)')}`,
            boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.3)' : '0 4px 16px rgba(0,0,0,0.08)',
          }}
          aria-label="下一张"
        >
          <ChevronRight className="w-6 h-6" style={{ color: themeStyles?.primaryText || '#f5f5f5' }} />
        </button>
      </>

      {/* 底部圆点指示器 */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
        {banners.map((_, index) => (
          <button
            key={index}
            onClick={(e) => {
              e.stopPropagation();
              goToSlide(index);
            }}
            className="transition-all duration-300 rounded-full"
            style={{
              width: index === currentIndex ? '24px' : '8px',
              height: '8px',
              background:
                index === currentIndex
                  ? `linear-gradient(90deg, ${themeStyles?.accentGold || '#d4af77'}, ${isDark ? '#b29364' : '#a88b5a'})`
                  : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'),
              boxShadow:
                index === currentIndex ? `0 0 12px ${themeStyles?.accentGold ? `${themeStyles.accentGold}66` : 'rgba(212,175,119,0.4)'}` : 'none',
            }}
            aria-label={`切换到第${index + 1}张`}
          />
        ))}
      </div>

      {/* 顶部微边框高亮 */}
      <div
        className="absolute top-0 left-0 right-0 h-px z-20 transition-opacity duration-300"
        style={{
          background: `linear-gradient(90deg, transparent, ${themeStyles?.accentGold ? `${themeStyles.accentGold}4D` : 'rgba(212,175,119,0.3)'}, transparent)`,
        }}
      />
    </div>
  );
};

export default BannerCarousel;
