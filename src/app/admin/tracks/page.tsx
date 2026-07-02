'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Disc3, Plus, Search, Edit, Trash2, Loader2, Clock, Upload, Film } from 'lucide-react';

interface Track {
  id: number;
  title: string;
  artist: string;
  album: string;
  cover: string;
  duration: number;
  source: string;
  mv_url?: string;
}

const formatDuration = (seconds: number) => {
  if (!seconds && seconds !== 0) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const sourceConfig: Record<string, { label: string; bg: string; color: string }> = {
  local: { label: '本地', bg: '#f97316', color: 'var(--foreground)' },
  netease: { label: '网易云', bg: '#ef4444', color: 'var(--foreground)' },
};

const getSourceStyle = (source: string) => {
  const cfg = sourceConfig[source];
  if (cfg) return { backgroundColor: cfg.bg, color: cfg.color };
  return { backgroundColor: 'var(--muted-foreground)', color: 'var(--foreground)' };
};

const getSourceLabel = (source: string) => {
  const cfg = sourceConfig[source];
  return cfg ? cfg.label : source || '未知';
};

export default function TracksPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<Track | null>(null);
  const [form, setForm] = useState({ title: '', artist: '', album: '', duration: '', source: 'local' });
  const [mvFile, setMvFile] = useState<File | null>(null);
  const [mvStorage, setMvStorage] = useState<'local' | 'supabase'>('local');
  const [uploadingMv, setUploadingMv] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin?table=tracks&search=${encodeURIComponent(search)}&page=${page}&limit=50`);
      const result = await res.json();
      if (result.data) setTracks(result.data);
      setTotalPages(result.pagination?.totalPages ?? 1);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSearch = () => { setPage(1); loadData(); };

  const handleAdd = async () => {
    if (!form.title.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          table: 'tracks',
          data: {
            title: form.title,
            artist: form.artist,
            album: form.album,
            duration: form.duration ? parseInt(form.duration) : 0,
            source: form.source,
          }
        })
      });
      if (res.ok) { setAddOpen(false); setForm({ title: '', artist: '', album: '', duration: '', source: 'local' }); loadData(); }
      else { const r = await res.json(); alert(r.error || '添加失败'); }
    } catch { alert('添加失败'); }
    finally { setSubmitting(false); }
  };

  const handleEdit = async () => {
    if (!selected || !form.title.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: 'tracks',
          id: selected.id,
          data: {
            title: form.title,
            artist: form.artist,
            album: form.album,
            duration: form.duration ? parseInt(form.duration) : 0,
          }
        })
      });
      if (res.ok) {
        // 上传MV（如果有）
        if (mvFile) {
          await handleUploadMv(selected.id);
        }
        setEditOpen(false);
        setSelected(null);
        setMvFile(null);
        loadData();
      }
      else { const r = await res.json(); alert(r.error || '更新失败'); }
    } catch { alert('更新失败'); }
    finally { setSubmitting(false); }
  };

  // MV上传处理
  const handleUploadMv = async (trackId: number) => {
    if (!mvFile) return;
    setUploadingMv(true);
    try {
      const mvData = new FormData();
      mvData.append('file', mvFile);
      mvData.append('track_id', String(trackId));
      mvData.append('storage', mvStorage);

      const res = await fetch('/api/music/local-tracks/upload/mv', {
        method: 'POST',
        body: mvData,
      });
      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || 'MV上传失败');
      }

      // MV上传成功后，更新 tracks 表的 mv_url 字段
      if (result.mv_url) {
        await fetch('/api/admin', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table: 'tracks',
            id: trackId,
            data: { mv_url: result.mv_url }
          })
        });
      }

      alert('MV上传成功！');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'MV上传失败';
      alert(`MV上传失败: ${msg}`);
    } finally {
      setUploadingMv(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin?table=tracks&id=${selected.id}`, { method: 'DELETE' });
      if (res.ok) { setDeleteOpen(false); setSelected(null); loadData(); }
      else { alert('删除失败'); }
    } catch { alert('删除失败'); }
    finally { setSubmitting(false); }
  };

  const openEdit = (track: Track) => {
    setSelected(track);
    setForm({
      title: track.title,
      artist: track.artist || '',
      album: track.album || '',
      duration: track.duration ? String(track.duration) : '',
      source: track.source || 'local',
    });
    setEditOpen(true);
  };

  const openDelete = (track: Track) => {
    setSelected(track);
    setDeleteOpen(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>歌曲管理</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>管理所有歌曲信息</p>
        <div className="mt-4" style={{ height: '1px', background: 'rgba(255,255,255,0.08)' }} />
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
          <Input
            placeholder="搜索歌曲、歌手或专辑..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-10"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)', color: 'var(--foreground)' }}
          />
        </div>
        <Button onClick={handleSearch} variant="outline" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
          搜索
        </Button>
        <Button onClick={() => { setForm({ title: '', artist: '', album: '', duration: '', source: 'local' }); setAddOpen(true); }} style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>
          <Plus className="w-4 h-4 mr-2" />
          添加歌曲
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--muted-foreground)' }} />
          <span className="ml-3 text-sm" style={{ color: 'var(--muted-foreground)' }}>加载中...</span>
        </div>
      ) : tracks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Disc3 className="w-10 h-10 mb-3" style={{ color: 'var(--muted-foreground)' }} />
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>暂无歌曲数据</p>
        </div>
      ) : (
        <div className="overflow-hidden">
          <div
            className="grid grid-cols-[40px_40px_1fr_150px_80px_80px_100px] gap-4 px-4 py-3 text-xs font-medium uppercase tracking-wider"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <div className="text-center">#</div>
            <div />
            <div>标题</div>
            <div>来源</div>
            <div className="text-right">时长</div>
            <div className="text-center">标签</div>
            <div className="text-center">操作</div>
          </div>

          <div className="pb-4">
            <AnimatePresence mode="popLayout">
              {tracks.map((track, index) => (
                <motion.div
                  key={track.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3, delay: index * 0.02 }}
                  className="group grid grid-cols-[40px_40px_1fr_150px_80px_80px_100px] gap-4 px-4 py-3 items-center transition-all duration-300 ease-out hover:bg-white/[0.06] dark:hover:bg-white/[0.04]"
                >
                  <div className="flex items-center justify-center">
                    <span className="text-sm tabular-nums" style={{ color: 'var(--muted-foreground)' }}>{index + 1}</span>
                  </div>

                  <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0" style={{ backgroundColor: 'var(--accent)' }}>
                    {track.cover ? (
                      <img src={track.cover} alt={track.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Disc3 className="w-5 h-5" style={{ color: 'var(--muted-foreground)' }} />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{track.title}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
                      {track.artist || '未知歌手'} · {track.album || '未知专辑'}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm truncate" style={{ color: 'var(--muted-foreground)' }}>{track.source || '-'}</p>
                  </div>

                  <div className="text-right">
                    <span className="text-sm tabular-nums" style={{ color: 'var(--muted-foreground)' }}>
                      {formatDuration(track.duration)}
                    </span>
                  </div>

                  <div className="flex items-center justify-center">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={getSourceStyle(track.source)}
                    >
                      {getSourceLabel(track.source)}
                    </span>
                  </div>

                  <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      className="p-1.5 rounded-lg hover:bg-[rgba(193,95,60,0.1)] dark:hover:bg-[rgba(212,118,90,0.15)] transition-colors duration-200"
                      style={{ color: 'var(--muted-foreground)' }}
                      onClick={() => openEdit(track)}
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      className="p-1.5 rounded-lg hover:bg-[rgba(239,68,68,0.1)] dark:hover:bg-[rgba(239,68,68,0.15)] transition-colors duration-200"
                      style={{ color: '#ef4444' }}
                      onClick={() => openDelete(track)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <motion.div
          className="flex items-center justify-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="flex items-center px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 hover:scale-[1.05] active:scale-[0.97] disabled:opacity-40 disabled:hover:scale-100"
            style={{
              backgroundColor: 'var(--card)',
              color: 'var(--foreground)',
              border: '1px solid var(--border)',
            }}
          >
            上一页
          </button>
          <span className="text-sm px-3" style={{ color: 'var(--muted-foreground)' }}>
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="flex items-center px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 hover:scale-[1.05] active:scale-[0.97] disabled:opacity-40 disabled:hover:scale-100"
            style={{
              backgroundColor: 'var(--card)',
              color: 'var(--foreground)',
              border: '1px solid var(--border)',
            }}
          >
            下一页
          </button>
        </motion.div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--foreground)' }}>添加歌曲</DialogTitle>
            <DialogDescription style={{ color: 'var(--muted-foreground)' }}>创建一首新的歌曲记录</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label style={{ color: 'var(--foreground)' }}>标题 *</Label>
              <Input placeholder="歌曲标题" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }} />
            </div>
            <div className="space-y-2">
              <Label style={{ color: 'var(--foreground)' }}>歌手</Label>
              <Input placeholder="歌手名称" value={form.artist} onChange={(e) => setForm({ ...form, artist: e.target.value })} style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }} />
            </div>
            <div className="space-y-2">
              <Label style={{ color: 'var(--foreground)' }}>专辑</Label>
              <Input placeholder="专辑名称" value={form.album} onChange={(e) => setForm({ ...form, album: e.target.value })} style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }} />
            </div>
            <div className="space-y-2">
              <Label style={{ color: 'var(--foreground)' }}>时长（秒）</Label>
              <Input type="number" placeholder="如 270" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }} />
            </div>
            <div className="space-y-2">
              <Label style={{ color: 'var(--foreground)' }}>来源</Label>
              <select
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
                className="w-full h-9 rounded-md px-3 text-sm"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)', borderWidth: '1px', borderStyle: 'solid' }}
              >
                <option value="local">本地</option>
                <option value="netease">网易云</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={submitting} style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>取消</Button>
            <Button onClick={handleAdd} disabled={submitting || !form.title.trim()} style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--foreground)' }}>编辑歌曲</DialogTitle>
            <DialogDescription style={{ color: 'var(--muted-foreground)' }}>修改歌曲信息</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label style={{ color: 'var(--foreground)' }}>标题 *</Label>
              <Input placeholder="歌曲标题" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }} />
            </div>
            <div className="space-y-2">
              <Label style={{ color: 'var(--foreground)' }}>歌手</Label>
              <Input placeholder="歌手名称" value={form.artist} onChange={(e) => setForm({ ...form, artist: e.target.value })} style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }} />
            </div>
            <div className="space-y-2">
              <Label style={{ color: 'var(--foreground)' }}>专辑</Label>
              <Input placeholder="专辑名称" value={form.album} onChange={(e) => setForm({ ...form, album: e.target.value })} style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }} />
            </div>
            <div className="space-y-2">
              <Label style={{ color: 'var(--foreground)' }}>时长（秒）</Label>
              <Input type="number" placeholder="如 270" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }} />
            </div>

            {/* MV上传区 */}
            <div className="space-y-2 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
              <Label style={{ color: 'var(--foreground)' }} className="flex items-center gap-2">
                <Film className="w-4 h-4" />
                MV 上传 (可选)
              </Label>
              {selected?.mv_url && !mvFile && (
                <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  当前MV: <a href={selected.mv_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }} className="underline">{selected.mv_url}</a>
                </div>
              )}
              <div className="flex items-center gap-2 mt-2">
                <Input
                  type="file"
                  accept="video/*"
                  onChange={e => setMvFile(e.target.files?.[0] || null)}
                  className="flex-1"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
                />
              </div>
              <div className="flex items-center gap-3 mt-2">
                <Label style={{ color: 'var(--muted-foreground)' }} className="text-xs">存储位置:</Label>
                <label className="flex items-center gap-1 text-xs cursor-pointer" style={{ color: 'var(--foreground)' }}>
                  <input
                    type="radio"
                    name="mvStorage"
                    value="local"
                    checked={mvStorage === 'local'}
                    onChange={() => setMvStorage('local')}
                  />
                  本地
                </label>
                <label className="flex items-center gap-1 text-xs cursor-pointer" style={{ color: 'var(--foreground)' }}>
                  <input
                    type="radio"
                    name="mvStorage"
                    value="supabase"
                    checked={mvStorage === 'supabase'}
                    onChange={() => setMvStorage('supabase')}
                  />
                  Supabase
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={submitting || uploadingMv} style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>取消</Button>
            <Button onClick={handleEdit} disabled={submitting || uploadingMv || !form.title.trim()} style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>
              {(submitting || uploadingMv) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {uploadingMv ? '上传中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--foreground)' }}>确认删除</DialogTitle>
            <DialogDescription style={{ color: 'var(--muted-foreground)' }}>
              确定要删除歌曲「{selected?.title}」吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={submitting} style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>取消</Button>
            <Button onClick={handleDelete} disabled={submitting} style={{ backgroundColor: '#ef4444', color: 'var(--foreground)' }}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
