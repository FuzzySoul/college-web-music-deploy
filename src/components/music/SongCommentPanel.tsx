'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageSquare } from 'lucide-react';
import { CommentSection } from './CommentSection';
import { usePlayer } from '@/app/home/context/PlayerContext';

interface SongCommentPanelProps {
  trackId: number | string;
  title: string;
  artist: string;
  onClose: () => void;
}

export function SongCommentPanel({
  trackId,
  title,
  artist,
  onClose,
}: SongCommentPanelProps) {
  const { currentUser } = usePlayer();

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
      >
        {/* 半透明遮罩层 */}
        <motion.div
          className="absolute inset-0"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />

        {/* 侧边滑入面板 */}
        <motion.div
          className="relative ml-auto w-full max-w-lg h-full flex flex-col shadow-2xl"
          style={{
            backgroundColor: 'var(--background)',
            borderLeft: '1px solid var(--border)',
          }}
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        >
          {/* ---- 顶部栏 ---- */}
          <div
            className="flex items-center gap-4 px-5 py-4 flex-shrink-0"
            style={{
              borderBottom: '1px solid var(--border)',
              backgroundColor: 'var(--card)',
            }}
          >
            {/* 返回按钮 */}
            <button
              onClick={onClose}
              className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors duration-200 hover:bg-[var(--border)]"
              style={{ color: 'var(--foreground)' }}
              aria-label="关闭评论区"
            >
              <X className="w-5 h-5" />
            </button>

            {/* 标题区域 */}
            <div className="flex-1 min-w-0">
              <div
                className="text-sm font-semibold truncate"
                style={{ color: 'var(--foreground)' }}
              >
                <MessageSquare
                  className="w-4 h-4 inline-block mr-1.5"
                  style={{ color: 'var(--primary)' }}
                />
                歌曲评论
              </div>
              <div
                className="text-xs truncate mt-0.5"
                style={{ color: 'var(--muted-foreground)' }}
              >
                {title} - {artist}
              </div>
            </div>
          </div>

          {/* ---- 评论内容区域 ---- */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <CommentSection
              targetType="track"
              targetId={trackId}
              currentUser={currentUser}
              title="歌曲评论"
            />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}