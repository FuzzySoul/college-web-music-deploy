'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import LocalMusicUploader from '@/components/music/LocalMusicUploader';
import {
  HardDrive,
  Upload,
  Music,
  FileText,
  Video,
  Search,
  Edit,
  Trash2,
  Loader2,
  ArrowLeft,
} from 'lucide-react';

interface LocalTrack {
  id: number;
  title: string;
  artist: string;
  album: string;
  duration: number;
  cover: string | null;
  lyrics: string | null;
  mv_url: string | null;
  source: string;
}

export default function LocalMusicPage() {
  const [tracks, setTracks] = useState<LocalTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [mvCount, setMvCount] = useState(0);
  const [lyricsCount, setLyricsCount] = useState(0);
  const [showUploader, setShowUploader] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [savingLyrics, setSavingLyrics] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<LocalTrack | null>(null);
  const [lyricsText, setLyricsText] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/music/local-tracks?search=${encodeURIComponent(search)}&page=${page}&limit=50`);
      const result = await res.json();
      if (result.data) {
        setTracks(result.data);
        setTotal(result.total || result.data.length);
        setMvCount(result.data.filter((t: LocalTrack) => !!t.mv_url).length);
        setLyricsCount(result.data.filter((t: LocalTrack) => !!t.lyrics).length);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, page]);

  const handleUploadComplete = () => {
    setShowUploader(false);
    loadData();
  };

  const handleSaveLyrics = async () => {
    if (!currentTrack) return;
    setSavingLyrics(true);
    try {
      const res = await fetch('/api/music/local-tracks/upload/lyrics', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId: currentTrack.id, lyrics: lyricsText })
      });
      if (res.ok) {
        setLyricsOpen(false);
        setCurrentTrack(null);
        setLyricsText('');
        loadData();
      } else {
        alert('保存歌词失败');
      }
    } catch (e) {
      console.error(e);
      alert('保存歌词失败');
    } finally {
      setSavingLyrics(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这首曲目吗？')) return;
    try {
      const res = await fetch(`/api/music/local-tracks?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadData();
      } else {
        alert('删除失败');
      }
    } catch (e) {
      console.error(e);
      alert('删除失败');
    }
  };

  const openLyricsEditor = (track: LocalTrack) => {
    setCurrentTrack(track);
    setLyricsText('');
    setLyricsOpen(true);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const stats = [
    { label: '总曲目数', value: total, icon: HardDrive },
    { label: '含MV数', value: mvCount, icon: Video },
    { label: '含歌词数', value: lyricsCount, icon: FileText }
  ];

  if (showUploader) {
    return (
      <div className="space-y-6" style={{ backgroundColor: 'transparent' }}>
        <div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowUploader(false)}
              className="p-2 rounded-lg transition-all duration-200 hover:bg-white/[0.06]"
              style={{ color: 'var(--muted-foreground)' }}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>上传音频</h1>
              <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>上传本地音乐文件到平台</p>
            </div>
          </div>
          <div className="mt-4" style={{ height: '1px', background: 'rgba(255,255,255,0.08)' }} />
        </div>
        <LocalMusicUploader
          onUploadComplete={handleUploadComplete}
          onCancel={() => setShowUploader(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6" style={{ backgroundColor: 'transparent' }}>
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>本地音乐管理</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>管理本地音乐曲目、歌词与MV</p>
        <div className="mt-4" style={{ height: '1px', background: 'rgba(255,255,255,0.08)' }} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
              className="rounded-xl p-5 backdrop-blur-sm cursor-default transition-colors duration-200"
              style={{
                backgroundColor: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                >
                  <Icon className="w-6 h-6" style={{ color: 'var(--foreground)' }} />
                </div>
                <div>
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{stat.label}</p>
                  <p className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>{stat.value.toLocaleString()}</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
          <Input
            placeholder="搜索曲目..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-10"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)', color: 'var(--foreground)' }}
          />
        </div>
        <button
          onClick={() => setShowUploader(true)}
          className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 hover:scale-[1.05] active:scale-[0.97]"
          style={{ backgroundColor: 'var(--primary)', color: 'white' }}
        >
          <Upload className="w-4 h-4" />
          上传音频
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--muted-foreground)' }} />
        </div>
      ) : tracks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div
            className="p-4 rounded-2xl"
            style={{ backgroundColor: 'rgba(var(--primary-rgb), 0.08)' }}
          >
            <Music className="w-10 h-10" style={{ color: 'var(--muted-foreground)' }} />
          </div>
          <p className="text-base font-medium mt-3" style={{ color: 'var(--foreground)' }}>暂无数据</p>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>点击上方按钮上传音频</p>
        </div>
      ) : (
        <div className="overflow-hidden">
          <div
            className="grid grid-cols-[40px_1fr_200px_80px_80px] gap-4 px-4 py-3 text-xs font-medium uppercase tracking-wider"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <div className="text-center">#</div>
            <div>标题</div>
            <div>歌手</div>
            <div className="text-right">时长</div>
            <div className="text-center">操作</div>
          </div>

          <div className="pb-4">
            <AnimatePresence>
              {tracks.map((track, index) => (
                <motion.div
                  key={track.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2, delay: index * 0.02 }}
                  className="group grid grid-cols-[40px_1fr_200px_80px_80px] gap-4 px-4 py-3 items-center transition-all duration-300 ease-out hover:bg-white/[0.06] dark:hover:bg-white/[0.04]"
                >
                  <div className="flex items-center justify-center">
                    <span className="text-sm tabular-nums group-hover:opacity-0 transition-opacity duration-200" style={{ color: 'var(--muted-foreground)' }}>
                      {index + 1}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{track.title}</span>
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: track.lyrics ? '#22c55e' : 'transparent' }} title={track.lyrics ? '有歌词' : ''} />
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: track.mv_url ? '#22c55e' : 'transparent' }} title={track.mv_url ? '有MV' : ''} />
                    </div>
                    {track.album && (
                      <p className="text-xs truncate mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{track.album}</p>
                    )}
                  </div>

                  <div className="min-w-0">
                    <span className="text-sm truncate" style={{ color: 'var(--muted-foreground)' }}>{track.artist}</span>
                  </div>

                  <div className="text-right">
                    <span className="text-sm tabular-nums" style={{ color: 'var(--muted-foreground)' }}>{formatDuration(track.duration)}</span>
                  </div>

                  <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      onClick={() => openLyricsEditor(track)}
                      className="p-1.5 rounded-lg hover:bg-[rgba(193,95,60,0.1)] dark:hover:bg-[rgba(212,118,90,0.15)] transition-colors duration-200"
                      title="编辑歌词"
                    >
                      <FileText className="w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
                    </button>
                    <button
                      onClick={() => handleDelete(track.id)}
                      className="p-1.5 rounded-lg hover:bg-[rgba(239,68,68,0.1)] dark:hover:bg-[rgba(239,68,68,0.15)] transition-colors duration-200"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" style={{ color: '#ef4444' }} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      <Dialog open={lyricsOpen} onOpenChange={setLyricsOpen}>
        <DialogContent style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--foreground)' }}>
              编辑歌词 - {currentTrack?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label style={{ color: 'var(--foreground)' }}>LRC格式歌词</Label>
              <Textarea
                placeholder="[00:00.00]歌词内容..."
                value={lyricsText}
                onChange={(e) => setLyricsText(e.target.value)}
                rows={12}
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
              />
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setLyricsOpen(false)}
              className="px-4 py-2 rounded-full text-sm transition-all duration-200 hover:scale-[1.02]"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--foreground)' }}
            >
              取消
            </button>
            <button
              onClick={handleSaveLyrics}
              disabled={savingLyrics}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 hover:scale-[1.05] disabled:opacity-50"
              style={{ backgroundColor: 'var(--primary)', color: 'white' }}
            >
              {savingLyrics ? <Loader2 className="w-4 h-4 animate-spin" /> : <Edit className="w-4 h-4" />}
              保存歌词
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
