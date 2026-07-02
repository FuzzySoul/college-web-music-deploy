'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Music, Download, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface NeteaseSong {
  id: number;
  name: string;
  artists: { name: string }[];
  album?: { name: string };
}

interface LyricsSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackTitle: string;
  trackArtist: string;
  trackId: number;
  onLyricsApplied: (lyrics: string) => void;
}

export function LyricsSearchModal({
  isOpen,
  onClose,
  trackTitle,
  trackArtist,
  trackId,
  onLyricsApplied,
}: LyricsSearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NeteaseSong[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [previewLyrics, setPreviewLyrics] = useState<string | null>(null);
  const [isFetchingLyrics, setIsFetchingLyrics] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const defaultQuery = `${trackTitle} ${trackArtist}`.trim();
      setQuery(defaultQuery);
      setResults([]);
      setSelectedId(null);
      setPreviewLyrics(null);
      setApplied(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, trackTitle, trackArtist]);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    setResults([]);
    setSelectedId(null);
    setPreviewLyrics(null);

    try {
      const res = await fetch(
        `/api/netease/search?keywords=${encodeURIComponent(query.trim())}&limit=15&type=1`
      );
      const data = await res.json();

      if (data?.result?.songs) {
        setResults(data.result.songs);
        if (data.result.songs.length === 0) {
          toast.info('未找到匹配歌曲');
        }
      } else if (data?.error) {
        toast.error(`搜索失败：${data.error || '网易云API不可用'}`);
      } else {
        toast.info('未找到匹配歌曲');
      }
    } catch {
      toast.error('搜索失败，请检查网络连接');
    } finally {
      setIsSearching(false);
    }
  }, [query]);

  const handleSelect = useCallback(async (song: NeteaseSong) => {
    setSelectedId(song.id);
    setPreviewLyrics(null);
    setIsFetchingLyrics(true);

    try {
      const res = await fetch(`/api/netease/lyric?id=${song.id}`);
      const data = await res.json();

      const lrc = data?.lrc?.lyric;
      if (lrc && lrc.trim()) {
        setPreviewLyrics(lrc);
      } else {
        toast.info('该歌曲暂无歌词');
        setPreviewLyrics(null);
      }
    } catch {
      toast.error('获取歌词失败');
      setPreviewLyrics(null);
    } finally {
      setIsFetchingLyrics(false);
    }
  }, []);

  const handleApply = useCallback(async () => {
    if (!previewLyrics || !trackId) return;
    setIsApplying(true);

    try {
      const formData = new FormData();
      formData.append('track_id', String(trackId));
      formData.append('lyrics', previewLyrics);

      const res = await fetch('/api/music/local-tracks/upload/lyrics', {
        method: 'PUT',
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        toast.success('歌词已应用');
        setApplied(true);
        onLyricsApplied(previewLyrics);
        setTimeout(() => onClose(), 800);
      } else {
        toast.error(data.error || '应用歌词失败');
      }
    } catch {
      toast.error('应用歌词失败');
    } finally {
      setIsApplying(false);
    }
  }, [previewLyrics, trackId, onLyricsApplied, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !isSearching) {
        handleSearch();
      }
    },
    [handleSearch, isSearching]
  );

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center"
        style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.25 }}
          onClick={(e) => e.stopPropagation()}
          className="w-[90vw] max-w-2xl max-h-[80vh] rounded-2xl overflow-hidden flex flex-col"
          style={{
            backgroundColor: 'rgba(24, 24, 27, 0.98)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
          }}
        >
          <div
            className="flex items-center gap-3 px-5 py-4"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            <Search className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--primary)' }} />
            <div className="flex-1 flex items-center gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="搜索歌曲名或歌手..."
                className="flex-1 bg-transparent outline-none text-sm"
                style={{ color: '#f5f5f5' }}
              />
              {query && (
                <button onClick={() => setQuery('')} className="p-0.5 rounded-full hover:bg-white/10">
                  <X className="w-3.5 h-3.5" style={{ color: '#888' }} />
                </button>
              )}
            </div>
            <button
              onClick={handleSearch}
              disabled={isSearching || !query.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40"
              style={{
                backgroundColor: 'rgba(212, 118, 90, 0.2)',
                color: '#D4765A',
                border: '1px solid rgba(212, 118, 90, 0.3)',
              }}
            >
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : '搜索'}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10">
              <X className="w-4 h-4" style={{ color: '#888' }} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0" style={{ maxHeight: 'calc(80vh - 60px)' }}>
            <div className="flex flex-col md:flex-row" style={{ minHeight: '300px' }}>
              <div
                className="md:w-1/2 overflow-y-auto border-b md:border-b-0 md:border-r"
                style={{ borderColor: 'rgba(255,255,255,0.04)' }}
              >
                {results.length === 0 && !isSearching && (
                  <div className="flex flex-col items-center justify-center py-12 px-4">
                    <Music className="w-10 h-10 mb-3" style={{ color: '#444' }} />
                    <p className="text-sm" style={{ color: '#666' }}>
                      输入歌名搜索歌词
                    </p>
                    <p className="text-xs mt-1" style={{ color: '#555' }}>
                      数据来源：网易云音乐
                    </p>
                  </div>
                )}

                {isSearching && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#D4765A' }} />
                  </div>
                )}

                {results.map((song) => (
                  <button
                    key={song.id}
                    onClick={() => handleSelect(song)}
                    className="w-full text-left px-4 py-3 transition-colors hover:bg-white/[0.04] flex items-center gap-3"
                    style={{
                      backgroundColor: selectedId === song.id ? 'rgba(212, 118, 90, 0.08)' : undefined,
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                    }}
                  >
                    <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                      <Music className="w-4 h-4" style={{ color: '#666' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate" style={{ color: selectedId === song.id ? '#D4765A' : '#ddd' }}>
                        {song.name}
                      </p>
                      <p className="text-xs truncate" style={{ color: '#888' }}>
                        {song.artists?.map((a) => a.name).join(' / ')}
                        {song.album?.name ? ` · ${song.album.name}` : ''}
                      </p>
                    </div>
                    {selectedId === song.id && (
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: '#D4765A' }} />
                    )}
                  </button>
                ))}
              </div>

              <div className="md:w-1/2 overflow-y-auto flex flex-col">
                {isFetchingLyrics && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#D4765A' }} />
                    <span className="ml-2 text-sm" style={{ color: '#888' }}>获取歌词中...</span>
                  </div>
                )}

                {!isFetchingLyrics && !previewLyrics && selectedId === null && (
                  <div className="flex flex-col items-center justify-center py-12 px-4">
                    <p className="text-xs" style={{ color: '#555' }}>
                      选择歌曲后预览歌词
                    </p>
                  </div>
                )}

                {!isFetchingLyrics && !previewLyrics && selectedId !== null && (
                  <div className="flex flex-col items-center justify-center py-12 px-4">
                    <p className="text-xs" style={{ color: '#555' }}>
                      该歌曲暂无歌词
                    </p>
                  </div>
                )}

                {previewLyrics && (
                  <>
                    <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <span className="text-xs font-medium" style={{ color: '#D4765A' }}>歌词预览</span>
                      <span className="text-[10px]" style={{ color: '#555' }}>
                        {previewLyrics.split('\n').filter(l => l.trim()).length} 行
                      </span>
                    </div>
                    <div className="flex-1 overflow-y-auto px-4 py-3" style={{ maxHeight: '300px' }}>
                      <pre
                        className="text-xs leading-relaxed whitespace-pre-wrap font-sans"
                        style={{ color: '#bbb' }}
                      >
                        {previewLyrics}
                      </pre>
                    </div>
                    <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                      <button
                        onClick={handleApply}
                        disabled={isApplying || applied}
                        className="w-full py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2"
                        style={{
                          backgroundColor: applied ? 'rgba(34,197,94,0.15)' : 'rgba(212, 118, 90, 0.2)',
                          color: applied ? '#22c55e' : '#D4765A',
                          border: applied ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(212, 118, 90, 0.3)',
                        }}
                      >
                        {isApplying ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : applied ? (
                          <>
                            <Check className="w-4 h-4" />
                            已应用
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4" />
                            应用歌词
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
