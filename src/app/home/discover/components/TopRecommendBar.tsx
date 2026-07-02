'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface TopRecommendItem {
  id: string;
  title: string;
  image?: string;
  gradient?: string;
  isSpecial?: boolean;
}

interface TopRecommendBarProps {
  items: TopRecommendItem[];
  autoPlayInterval?: number;
  isDark?: boolean;
  themeStyles?: any;
  onItemClick?: (item: TopRecommendItem) => void;
}

const TopRecommendBar: React.FC<TopRecommendBarProps> = ({
  items,
  autoPlayInterval = 5000,
  isDark = true,
  themeStyles,
  onItemClick,
}) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const ITEMS_PER_PAGE = 7;

  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
  const getCurrentPageItems = (): TopRecommendItem[] => {
    const start = currentPage * ITEMS_PER_PAGE;
    return items.slice(start, start + ITEMS_PER_PAGE);
  };

  useEffect(() => {
    if (isPaused || totalPages <= 1) return;

    const timer = setInterval(() => {
      setDirection(1);
      setCurrentPage((prev) => (prev + 1) % totalPages);
    }, autoPlayInterval);

    return () => clearInterval(timer);
  }, [isPaused, totalPages, autoPlayInterval]);

  const goToPage = useCallback((index: number) => {
    setDirection(index > currentPage ? 1 : -1);
    setCurrentPage(index);
  }, [currentPage]);

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 100 : -100,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction > 0 ? -100 : 100,
      opacity: 0,
    }),
  };

  if (!items || items.length === 0) {
    return null;
  }

  const cardBg = themeStyles?.cardBackground || (isDark ? '#222222' : '#ffffff');
  const secondaryText = themeStyles?.secondaryText || (isDark ? '#999999' : '#666666');

  return (
    <div
      className="relative w-full mb-6"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={currentPage}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            duration: 0.4,
            ease: [0.4, 0, 0.2, 1],
          }}
        >
          <div className="grid grid-cols-7 gap-3">
            {getCurrentPageItems().map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onItemClick?.(item)}
                className="group relative cursor-pointer rounded-xl overflow-hidden shadow-md hover:shadow-xl hover:scale-[1.03] transition-all duration-300 ease-out"
                style={{
                  background: item.isSpecial ? undefined : cardBg,
                  boxShadow: isDark
                    ? 'inset 0 1px 0 rgba(255,255,255,0.03), 0 4px 16px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.2)'
                    : 'inset 0 1px 0 rgba(255,255,255,0.5), 0 4px 16px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.06)',
                }}
              >
                {item.isSpecial ? (
                  <div
                    className={`relative w-full aspect-square flex items-center justify-center bg-gradient-to-br ${item.gradient || 'from-pink-500 to-red-500'} rounded-xl`}
                  >
                    <div className="absolute inset-0 bg-black/20 rounded-xl pointer-events-none" />
                    <div className="p-4 text-center text-white font-bold text-lg tracking-tight relative z-10">
                      {item.title}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="relative w-full aspect-square overflow-hidden rounded-xl">
                      {item.image && (
                        <img
                          src={item.image}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent rounded-xl pointer-events-none" />
                    </div>
                    <div
                      className="p-2 text-sm font-semibold tracking-wide truncate transition-colors duration-300"
                      style={{ color: isDark ? '#f5f5f5' : (themeStyles?.primaryText || '#1a1a1a') }}
                    >
                      {item.title}
                    </div>
                  </>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>

      {totalPages > 1 && (
        <div className="flex justify-center gap-1.5 mt-4">
          {Array.from({ length: totalPages }).map((_, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                goToPage(index);
              }}
              className="transition-all duration-300 rounded-full"
              style={{
                width: index === currentPage ? '20px' : '6px',
                height: '6px',
                background:
                  index === currentPage
                    ? (themeStyles?.accentGold || (isDark ? '#d4af77' : '#c9a66b'))
                    : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'),
                boxShadow:
                  index === currentPage
                    ? `0 0 8px ${themeStyles?.accentGold || (isDark ? '#d4af7740' : '#c9a66b30')}`
                    : 'none',
              }}
              aria-label={`切换到第${index + 1}组`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default TopRecommendBar;
export { TopRecommendBar };