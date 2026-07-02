'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Library, Play } from 'lucide-react';

interface LibraryTabProps {
  allTracks: any[];
  currentTrack: any;
  isPlaying: boolean;
  onPlay: (track: any) => void;
}

export function LibraryTab({ 
  allTracks, 
  currentTrack, 
  isPlaying, 
  onPlay 
}: LibraryTabProps) {
  return (
    <>
      {allTracks.length > 0 ? (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-normal artistic-title">我的音乐</h2>
            <span className="text-sm" style={{ color: 'var(--primary)' }}>共 {allTracks.length} 首</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <AnimatePresence>
              {allTracks.slice(0, 8).map((track, index) => (
                <motion.button
                  type="button"
                  key={track.id}
                  className="card-premium cursor-pointer text-left stagger-item"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06 }}
                  onClick={() => onPlay(track)}
                  whileHover={{ scale: 1.03, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="card-cover">
                    <img src={track.cover || 'https://picsum.photos/seed/default/400/400'} alt={track.title} />
                    <div className="play-overlay">
                      <div className="play-button play-3d">
                        {currentTrack?.id === track.id && isPlaying ? (
                          <div className="spectrum-enhanced">
                            <div className="bar" /><div className="bar" /><div className="bar" /><div className="bar" />
                          </div>
                        ) : (
                          <Play className="w-5 h-5 ml-0.5" />
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="p-3">
                    <h3 className="font-normal text-sm mb-1 truncate" style={{ fontFamily: 'var(--font-display)' }}>{track.title}</h3>
                    <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>{track.artist}</p>
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        </>
      ) : (
        <motion.div 
          className="empty-state blur-in py-12"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Library className="w-12 h-12" />
          <p className="text-base font-medium mt-3">暂无音乐</p>
          <p className="text-sm mt-2">点击上方"导入音乐"添加本地音乐文件</p>
        </motion.div>
      )}
    </>
  );
}
