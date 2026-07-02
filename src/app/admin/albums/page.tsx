'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Disc3, Plus, Search, Edit, Trash2, Loader2, Music, Eye, X, RefreshCw } from 'lucide-react';

interface Album {
  id: string;
  name: string;
  artist: string | null;
  cover: string | null;
  release_year: number | null;
  track_count?: number;
  created_at: string;
}

interface Track {
  id: number;
  title: string;
  artist: string;
  duration: number;
  audio_url: string | null;
}

export default function AlbumsAdminPage() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selected, setSelected] = useState<Album | null>(null);
  const [form, setForm] = useState({ name: '', artist: '', cover: '', year: '' });
  const [tracks, setTracks] = useState<Track[]>([]);
  const [tracksLoading, setTracksLoading] = useState(false);
  const [syncingAlbumId, setSyncingAlbumId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      // 一次返回专辑列表 + 每张专辑的歌曲数（FastAPI 聚合缓存，避免 N+1）
      const res = await fetch(`/api/admin/albums/all?page=1&limit=50&search=${encodeURIComponent(search)}`);
      const result = await res.json();
      setAlbums(result.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadTracks = async (album: Album) => {
    setTracksLoading(true);
    try {
      const res = await fetch(`/api/music/album-detail?id=${album.id}`);
      if (res.ok) {
        const data = await res.json();
        setTracks(data.tracks || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTracksLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleSearch = () => { loadData(); };

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          table: 'albums',
          data: {
            name: form.name,
            artist: form.artist || null,
            cover: form.cover || null,
            year: form.year ? parseInt(form.year) : null,
          }
        })
      });
      if (res.ok) { setAddOpen(false); setForm({ name: '', artist: '', cover: '', year: '' }); loadData(); }
      else { const r = await res.json(); alert(r.error || '添加失败'); }
    } catch { alert('添加失败'); }
    finally { setSubmitting(false); }
  };

  const handleEdit = async () => {
    if (!selected || !form.name.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: 'albums',
          id: selected.id,
          data: {
            name: form.name,
            artist: form.artist || null,
            cover: form.cover || null,
            year: form.year ? parseInt(form.year) : null,
          }
        })
      });
      if (res.ok) { setEditOpen(false); setSelected(null); loadData(); }
      else { const r = await res.json(); alert(r.error || '更新失败'); }
    } catch { alert('更新失败'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin?table=albums&id=${selected.id}`, { method: 'DELETE' });
      if (res.ok) { setDeleteOpen(false); setSelected(null); loadData(); }
      else { alert('删除失败'); }
    } catch { alert('删除失败'); }
    finally { setSubmitting(false); }
  };

  const openEdit = (album: Album) => {
    setSelected(album);
    setForm({
      name: album.name,
      artist: album.artist || '',
      cover: album.cover || '',
      year: album.release_year ? String(album.release_year) : ''
    });
    setEditOpen(true);
  };

  const openDelete = (album: Album) => {
    setSelected(album);
    setDeleteOpen(true);
  };

  const openView = (album: Album) => {
    setSelected(album);
    setTracks([]);
    setViewOpen(true);
    loadTracks(album);
  };

  const handleSyncTracks = async (album: Album) => {
    setSyncingAlbumId(album.id);
    try {
      const res = await fetch(`/api/music/sync-album-tracks?albumName=${encodeURIComponent(album.name)}&artistName=${encodeURIComponent(album.artist || '')}`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        alert(`同步完成：${data.data?.tracksSynced || 0} 首歌曲`);
        // 同步完成后刷新整张专辑的歌曲数（走 FastAPI 聚合缓存）
        const r = await fetch(`/api/admin/albums/all?page=1&limit=50&search=${encodeURIComponent(album.name)}`);
        if (r.ok) {
          const d = await r.json();
          const fresh = (d.data || []).find((x: Album) => x.id === album.id);
          if (fresh) {
            setAlbums(prev => prev.map(a => a.id === album.id ? { ...a, track_count: fresh.track_count ?? 0 } : a));
          }
        }
      } else {
        const err = await res.json();
        alert(err.error || '同步失败');
      }
    } catch {
      alert('同步请求失败');
    } finally {
      setSyncingAlbumId(null);
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-normal" style={{ color: 'var(--foreground)', letterSpacing: '-0.02em' }}>专辑管理</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>管理所有专辑信息</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
          <Input
            placeholder="搜索专辑名称或歌手..."
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
        <Button onClick={() => { setForm({ name: '', artist: '', cover: '', year: '' }); setAddOpen(true); }} style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>
          <Plus className="w-4 h-4 mr-2" />
          添加专辑
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--muted-foreground)' }} />
          <span className="ml-3 text-sm" style={{ color: 'var(--muted-foreground)' }}>加载中...</span>
        </div>
      ) : albums.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Disc3 className="w-10 h-10 mb-3" style={{ color: 'var(--muted-foreground)' }} />
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>暂无专辑数据</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <AnimatePresence mode="popLayout">
            {albums.map((album) => (
              <motion.div
                key={album.id}
                layoutId={`album-${album.id}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                whileHover={{ scale: 1.02, y: -4 }}
                transition={{ duration: 0.3 }}
                className="rounded-xl cursor-pointer group relative"
                style={{ backgroundColor: 'var(--card)' }}
              >
                <div className="aspect-square rounded-t-xl overflow-hidden" style={{ backgroundColor: 'var(--accent)' }}>
                  {album.cover ? (
                    <img src={album.cover} alt={album.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Disc3 className="w-12 h-12" style={{ color: 'var(--muted-foreground)' }} />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="font-medium text-sm truncate" style={{ color: 'var(--foreground)' }}>{album.name}</h3>
                  <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>{album.artist || '-'}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                    {album.release_year ? `${album.release_year}年 · ` : ''}{album.track_count ?? 0} 首
                  </p>
                </div>
                <div className="absolute bottom-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    className="p-2 rounded-full transition-colors"
                    style={{ backgroundColor: 'var(--accent)', color: 'var(--muted-foreground)' }}
                    onClick={(e) => { e.stopPropagation(); handleSyncTracks(album); }}
                    title="同步歌曲"
                    disabled={syncingAlbumId === album.id}
                  >
                    {syncingAlbumId === album.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    className="p-2 rounded-full transition-colors"
                    style={{ backgroundColor: 'var(--accent)', color: 'var(--muted-foreground)' }}
                    onClick={(e) => { e.stopPropagation(); openView(album); }}
                    title="查看歌曲"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    className="p-2 rounded-full transition-colors"
                    style={{ backgroundColor: 'var(--accent)', color: 'var(--muted-foreground)' }}
                    onClick={(e) => { e.stopPropagation(); openEdit(album); }}
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    className="p-2 rounded-full transition-colors"
                    style={{ backgroundColor: 'var(--accent)', color: '#ef4444' }}
                    onClick={(e) => { e.stopPropagation(); openDelete(album); }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* 添加 */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--foreground)' }}>添加专辑</DialogTitle>
            <DialogDescription style={{ color: 'var(--muted-foreground)' }}>创建一个新的专辑记录</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label style={{ color: 'var(--foreground)' }}>名称 *</Label><Input placeholder="专辑名称" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }} /></div>
            <div className="space-y-2"><Label style={{ color: 'var(--foreground)' }}>歌手</Label><Input placeholder="歌手名称" value={form.artist} onChange={(e) => setForm({ ...form, artist: e.target.value })} style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }} /></div>
            <div className="space-y-2"><Label style={{ color: 'var(--foreground)' }}>封面URL</Label><Input placeholder="https://..." value={form.cover} onChange={(e) => setForm({ ...form, cover: e.target.value })} style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }} /></div>
            <div className="space-y-2"><Label style={{ color: 'var(--foreground)' }}>发行年份</Label><Input type="number" placeholder="2024" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={submitting} style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>取消</Button>
            <Button onClick={handleAdd} disabled={submitting || !form.name.trim()} style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑 */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--foreground)' }}>编辑专辑</DialogTitle>
            <DialogDescription style={{ color: 'var(--muted-foreground)' }}>修改专辑信息</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label style={{ color: 'var(--foreground)' }}>名称 *</Label><Input placeholder="专辑名称" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }} /></div>
            <div className="space-y-2"><Label style={{ color: 'var(--foreground)' }}>歌手</Label><Input placeholder="歌手名称" value={form.artist} onChange={(e) => setForm({ ...form, artist: e.target.value })} style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }} /></div>
            <div className="space-y-2"><Label style={{ color: 'var(--foreground)' }}>封面URL</Label><Input placeholder="https://..." value={form.cover} onChange={(e) => setForm({ ...form, cover: e.target.value })} style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }} /></div>
            <div className="space-y-2"><Label style={{ color: 'var(--foreground)' }}>发行年份</Label><Input type="number" placeholder="2024" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={submitting} style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>取消</Button>
            <Button onClick={handleEdit} disabled={submitting || !form.name.trim()} style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除 */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--foreground)' }}>确认删除</DialogTitle>
            <DialogDescription style={{ color: 'var(--muted-foreground)' }}>
              确定要删除专辑「{selected?.name}」吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={submitting} style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>取消</Button>
            <Button onClick={handleDelete} disabled={submitting} style={{ backgroundColor: '#ef4444', color: '#fff' }}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 查看歌曲 */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--foreground)' }}>{selected?.name} - 歌曲列表</DialogTitle>
            <DialogDescription style={{ color: 'var(--muted-foreground)' }}>
              共 {tracks.length} 首歌曲
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-1">
            {tracksLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--muted-foreground)' }} />
              </div>
            ) : tracks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Music className="w-8 h-8 mb-2" style={{ color: 'var(--muted-foreground)' }} />
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>暂无歌曲</p>
              </div>
            ) : (
              tracks.map((track, idx) => (
                <div key={track.id} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--background)' }}>
                  <span className="text-xs w-5 text-center" style={{ color: 'var(--muted-foreground)' }}>{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ color: 'var(--foreground)' }}>{track.title}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>{track.artist}</p>
                  </div>
                  <span className="text-xs flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>{formatDuration(track.duration)}</span>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
