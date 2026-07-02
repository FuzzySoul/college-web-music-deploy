'use client';

import React from 'react';
import { motion, type Variants } from 'framer-motion';

export interface ActivityItem {
  id: string;
  image: string;
  title: string;
  subtitle?: string;
  description?: string;
  tag?: string;
  bgColor?: string;
  ctaText?: string;
  status?: 'ongoing' | 'upcoming';
}

interface ActivityBannersProps {
  activities: ActivityItem[];
  title?: string;
  maxDisplay?: number;
  loading?: boolean;
  isDark?: boolean;
  themeStyles?: {
    cardBackground: string;
    primaryText: string;
    secondaryText: string;
    accentGold: string;
    borderLight: string;
    skeletonFrom: string;
    skeletonTo: string;
  };
  onActivityClick?: (activity: ActivityItem) => void;
}

// 入场动画变体
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const }
  }
};

// 默认背景色循环
const defaultColors = ['#8FBC8F', '#222222', '#1E3A8A'];

export const ActivityBanners: React.FC<ActivityBannersProps> = ({
  activities,
  title = '精选活动',
  maxDisplay = 3,
  loading = false,
  isDark = true,
  themeStyles,
  onActivityClick,
}) => {
  const primaryText = themeStyles?.primaryText || (isDark ? '#f5f5f5' : '#1a1a1a');

  // Loading 骨架屏
  if (loading) {
    return (
      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold tracking-tight text-lg h-6 w-24 bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-38 md:h-40 rounded-xl animate-pulse"
              style={{ background: defaultColors[i - 1] }}
            />
          ))}
        </div>
      </section>
    );
  }

  // 空状态处理：返回 null 不渲染区块
  if (!activities || activities.length === 0) {
    return null;
  }

  const displayActivities = activities.slice(0, maxDisplay);

  return (
    <section>
      {/* 标题栏 */}
      <div className="flex justify-between items-center mb-4">
        <h2
          className="text-xl font-bold tracking-tight"
          style={{ color: primaryText }}
        >
          {title} {title === '精选活动' ? '>' : ''}
        </h2>
      </div>

      {/* 活动卡片网格 */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-3 gap-4"
      >
        {displayActivities.map((activity, i) => (
          <motion.div
            key={activity.id}
            variants={itemVariants}
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.4 }}
            onClick={() => onActivityClick?.(activity)}
            className="cursor-pointer"
          >
            <div
              className="relative overflow-hidden rounded-xl h-38 md:h-40 flex items-center justify-between px-5 transition-shadow duration-300 hover:shadow-2xl"
              style={{
                background: activity.bgColor || defaultColors[i % 3]
              }}
            >
              {/* 左侧/居中文字区域 */}
              <div
                className={`flex-1 z-10 ${
                  activity.ctaText
                    ? 'flex flex-col items-center justify-center text-center'
                    : ''
                }`}
              >
                {/* 副标题 */}
                {activity.subtitle && (
                  <p className="text-xs font-medium opacity-80 uppercase tracking-wider text-white/90 mb-1">
                    {activity.subtitle}
                  </p>
                )}

                {/* 主标题 */}
                <h3
                  className={`${
                    activity.ctaText ? 'text-2xl' : 'text-3xl'
                  } font-bold tracking-tight text-white mb-1`}
                >
                  {activity.title}
                </h3>

                {/* 描述文案（非 CTA 模式时显示） */}
                {activity.description && !activity.ctaText && (
                  <p className="text-sm opacity-70 text-white/80 line-clamp-1">
                    {activity.description}
                  </p>
                )}

                {/* CTA 按钮（有 ctaText 时显示） */}
                {activity.ctaText && (
                  <button className="mt-3 bg-white/90 text-inherit px-4 py-1.5 rounded-full text-xs font-medium hover:bg-white transition-colors">
                    {activity.ctaText}
                  </button>
                )}
              </div>

              {/* 右侧图片（有图片时才显示） */}
              {activity.image && (
                <img
                  src={activity.image}
                  alt={activity.title}
                  className="w-24 h-24 md:w-28 md:h-28 rounded-lg object-cover shadow-lg z-10 brightness-95 contrast-105 saturate-110"
                  loading="lazy"
                />
              )}

              {/* 红色标签角标 */}
              {activity.tag && (
                <span className="absolute bottom-3 right-3 bg-red-500/90 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded font-medium z-20">
                  {activity.tag}
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
};

export default ActivityBanners;
