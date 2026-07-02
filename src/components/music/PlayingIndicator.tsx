'use client';

import { motion } from 'framer-motion';

interface PlayingIndicatorProps {
  isPlaying: boolean;
}

// 动态音波组件 - 显示播放状态
export function PlayingIndicator({ isPlaying }: PlayingIndicatorProps) {
  return (
    <div className="flex items-end gap-0.5 h-4">
      {[1, 2, 3, 4].map((i) => (
        <motion.div
          key={i}
          className="w-0.5 rounded-full"
          style={{ backgroundColor: 'var(--primary)' }}
          animate={{
            height: isPlaying ? [4, 16, 4] : 4,
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.1,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}
