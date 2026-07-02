'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Music,
  Film,
  FileText,
  Upload,
  Search,
  X,
  Loader2,
  Disc3,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePlayer } from '../context/PlayerContext';
import { LocalMusicList } from '@/components/music/LocalMusicList';
import { MvPlayer } from '@/components/music/MvPlayer';
import { LyricsEditor } from '@/components/music/LyricsEditor';
import { LocalMusicUploader } from '@/components/music/LocalMusicUploader';
import type { LocalTrack } from '@/components/music/types';

export default function LocalMusicPage() {
  const { handlePlay: contextHandlePlay } = usePlayer();

  const [tracks, setTracks] = useState<LocalTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrackForMv, setSelectedTrackForMv] = useState<LocalTrack | null>(null);
  const [selectedTrackForLyrics, setSelectedTrackForLyrics] = useState<LocalTrack | null>(null);
  const [showUploader, setShowUploader] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);

  const fetchTracks = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/music/local-tracks?pageSize=100');
      const result = await response.json();
      if (result.success) {
        setTracks(result.data || []);
      } else {
        toast.error(result.error || '获取音乐列表失败');
      }
    } catch (error) {
      console.error('获取本地音乐失败:', error);
      toast.error('网络错误，请重试');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTracks();
  }, [fetchTracks]);

  const stats = useMemo(() => ({
    total: tracks.length,
    hasMv: tracks.filter((t) => t.mv_url).length,
    hasLyrics: tracks.filter((t) => t.lyrics).length,
  }), [tracks]);

  const handlePlay = useCallback(
    (track: LocalTrack) => {
      contextHandlePlay({
        id: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album || '',
        cover: track.cover || '',
        duration: track.duration,
        play_url: track.play_url || track.audio_url || '',
        source: track.source,
        source_id: String(track.id),
        lyrics: track.lyrics || null,
        mv_url: track.mv_url || null,
        mv_cover: track.mv_cover || null,
        created_at: track.created_at || '',
      });
    },
    [contextHandlePlay]
  );

  const handlePlayMv = useCallback((track: LocalTrack) => {
    setSelectedTrackForMv(track);
  }, []);

  const handleEditLyrics = useCallback((track: LocalTrack) => {
    setSelectedTrackForLyrics(track);
  }, []);

  const handleDelete = useCallback(
    async (trackId: number) => {
      setIsDeleting(trackId);
      try {
        const response = await fetch(`/api/music/local-tracks?id=${trackId}`, {
          method: 'DELETE',
        });
        const result = await response.json();
        if (result.success) {
          toast.success('删除成功');
          setTracks((prev) => prev.filter((t) => t.id !== trackId));
        } else {
          toast.error(result.error || '删除失败');
        }
      } catch (error) {
        console.error('删除失败:', error);
        toast.error('网络错误，删除失败');
      } finally {
        setIsDeleting(null);
      }
    },
    []
  );

  const handleSaveLyrics = useCallback(
    async (lyrics: string) => {
      if (!selectedTrackForLyrics) return;
      const uploadData = new FormData();
      uploadData.append('track_id', String(selectedTrackForLyrics.id));
      uploadData.append('lyrics', lyrics);
      const response = await fetch('/api/music/local-tracks/upload/lyrics', {
        method: 'PUT',
        body: uploadData,
      });
      if (!response.ok) throw new Error('保存歌词失败');
      setTracks((prev) =>
        prev.map((t) =>
          t.id === selectedTrackForLyrics.id ? { ...t, lyrics } : t
        )
      );
    },
    [selectedTrackForLyrics]
  );

  const handleUploadComplete = useCallback(() => {
    setShowUploader(false);
    fetchTracks();
  }, [fetchTracks]);

  return (
    <div className="fade-in min-h-full">
      {/* 页面标题区 */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
      >
        <div>
          <h1 className="text-3xl font-bold artistic-title flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl" style={{ backgroundColor: 'rgba(var(--primary-rgb), 0.12)' }}>
              <Disc3 className="w-5 h-5" style={{ color: 'var(--primary)' }} />
            </span>
            本地音乐库
          </h1>
          <p className="text-sm mt-2" style={{ color: 'var(--muted-foreground)' }}>
            管理您的本地音频、MV视频和LRC歌词
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowUploader(true)}
          className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium"
        >
          <Upload className="w-4 h-4" />
          上传音乐
        </motion.button>
      </motion.div>

      {/* 统计卡片区 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: [0.34, 1.56, 0.64, 1] }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8"
      >
        {[
          {
            icon: Music,
            label: '总曲目数',
            value: stats.total,
            gradient: 'linear-gradient(135deg, rgba(193,95,60,0.12), rgba(193,95,60,0.04))',
            iconColor: 'var(--primary)',
            border: 'rgba(193,95,60,0.15)',
          },
          {
            icon: Film,
            label: '含MV数',
            value: stats.hasMv,
            gradient: 'linear-gradient(135deg, rgba(234,179,8,0.12), rgba(234,179,8,0.04))',
            iconColor: '#EAB308',
            border: 'rgba(234,179,8,0.15)',
          },
          {
            icon: FileText,
            label: '含歌词数',
            value: stats.hasLyrics,
            gradient: 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(34,197,94,0.04))',
            iconColor: '#22C55E',
            border: 'rgba(34,197,94,0.15)',
          },
        ].map(({ icon: Icon, label, value, gradient, iconColor, border }) => (
          <div
            key={label}
            className="rounded-2xl p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
            style={{
              background: gradient,
              border: `1px solid ${border}`,
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${iconColor}15` }}
              >
                <Icon className="w-5 h-5" style={{ color: iconColor }} />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                  {label}
                </p>
                {isLoading ? (
                  <Loader2 className="w-6 h-6 animate-spin mt-1" style={{ color: 'var(--muted-foreground)' }} />
                ) : (
                  <p className="text-2xl font-bold tabular-nums mt-0.5" style={{ color: 'var(--foreground)', fontFamily: "'Instrument Serif', serif" }}>
                    {value}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </motion.div>

      {/* 搜索栏 */}
      {!showUploader && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mb-6"
        >
          <div className="relative max-w-md">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: 'var(--muted-foreground)' }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索歌曲、歌手或专辑..."
              className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border transition-all duration-200 focus:outline-none focus:ring-2"
              style={{
                backgroundColor: 'var(--card)',
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
                '--tw-ring-color': 'rgba(193, 95, 60, 0.3)',
              } as React.CSSProperties}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-[var(--accent)] transition-colors"
                aria-label="清空搜索"
              >
                <X className="w-3.5 h-3.5" style={{ color: 'var(--muted-foreground)' }} />
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* 主内容区域 */}
      <AnimatePresence mode="wait">
        {showUploader ? (
          <motion.div
            key="uploader"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            className="rounded-2xl p-2 sm:p-4"
            style={{
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)',
            }}
          >
            <LocalMusicUploader
              onUploadComplete={handleUploadComplete}
              onCancel={() => setShowUploader(false)}
            />
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="rounded-2xl overflow-hidden"
            style={{
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)',
            }}
          >
            <LocalMusicList
              tracks={
                searchQuery.trim()
                  ? tracks.filter(
                      (t) =>
                        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        t.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (t.album && t.album.toLowerCase().includes(searchQuery.toLowerCase()))
                    )
                  : tracks
              }
              onPlay={handlePlay}
              onPlayMv={handlePlayMv}
              onEditLyrics={handleEditLyrics}
              onDelete={handleDelete}
              isLoading={isLoading}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* MV播放器浮层 */}
      <MvPlayer
        isOpen={!!selectedTrackForMv}
        onClose={() => setSelectedTrackForMv(null)}
        mvUrl={selectedTrackForMv?.mv_url || ''}
        title={selectedTrackForMv?.title || ''}
        artist={selectedTrackForMv?.artist || ''}
        cover={selectedTrackForMv?.mv_cover || selectedTrackForMv?.cover || undefined}
      />

      {/* 歌词编辑弹窗 */}
      <AnimatePresence>
        {selectedTrackForLyrics && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTrackForLyrics(null)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[90]"
            />
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-x-4 top-[5%] bottom-[5%] z-[100] max-w-4xl mx-auto overflow-hidden rounded-2xl shadow-2xl flex flex-col"
              style={{
                backgroundColor: 'var(--background)',
                border: '1px solid var(--border)',
              }}
            >
              {/* 弹窗头部 */}
              <div className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
                <div>
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                    编辑歌词
                  </h2>
                  <p className="text-sm mt-0.5 truncate max-w-md" style={{ color: 'var(--muted-foreground)' }}>
                    {selectedTrackForLyrics.title} - {selectedTrackForLyrics.artist}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedTrackForLyrics(null)}
                  className="p-2 rounded-lg hover:bg-[var(--accent)] transition-colors"
                  aria-label="关闭编辑器"
                >
                  <X className="w-5 h-5" style={{ color: 'var(--muted-foreground)' }} />
                </button>
              </div>

              {/* 编辑器内容 */}
              <div className="flex-1 overflow-y-auto p-6">
                <LyricsEditor
                  initialLyrics={selectedTrackForLyrics.lyrics || ''}
                  trackId={selectedTrackForLyrics.id}
                  onSave={handleSaveLyrics}
                  onCancel={() => setSelectedTrackForLyrics(null)}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
