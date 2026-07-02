'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Music, Plus, Search, Edit, Trash2, Loader2, RefreshCw } from 'lucide-react';

interface Artist {
  id: string;
  name: string;
  alias: string;
  image: string;
  description: string;
  trackCount?: number;
  albumCount?: number;
}

export default function ArtistsPage() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<Artist | null>(null);
  const [form, setForm] = useState({ name: '', alias: '', image: '', description: '' });
  const [syncing, setSyncing] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [artistsRes, syncRes, tracksRes] = await Promise.all([
        fetch(`/api/admin?table=artists&search=${encodeURIComponent(search)}&page=1&limit=50`),
        fetch('/api/music/sync-artists'),
        fetch('/api/admin?table=tracks&page=1&limit=1000')
      ]);
      const artistsResult = await artistsRes.json();
      const syncResult = await syncRes.json();
      const tracksResult = await tracksRes.json();

      const dbArtists: Artist[] = artistsResult.data || [];
      const syncArtists: any[] = syncResult.artists || [];
      const syncAlbums: any[] = syncResult.albums || [];
      const dbTracks: any[] = tracksResult.data || [];

      const trackCountMap = new Map<string, number>();
      const albumCountMap = new Map<string, number>();

      dbTracks.forEach((t: any) => {
        if (t.artist) trackCountMap.set(t.artist.toLowerCase(), (trackCountMap.get(t.artist.toLowerCase()) || 0) + 1);
      });
      syncAlbums.forEach((a: any) => {
        if (a.artist) albumCountMap.set(a.artist.toLowerCase(), (albumCountMap.get(a.artist.toLowerCase()) || 0) + 1);
      });

      // 从 externalArtists（来自 external_playlist_tracks）构建"外部同步歌手名"集合
      // 手动新建的歌手（不在此集合中）albumCount 强制为 0
      const syncArtistSet = new Set<string>(((syncResult as any).externalArtists || []).map((n: string) => n.toLowerCase()));

      const mergedMap = new Map<string, Artist>();
      dbArtists.forEach(a => {
        const key = a.name.toLowerCase();
        // 手动新建的歌手（不在外部数据中）albumCount = 0
        const albumCount = syncArtistSet.has(key) ? (albumCountMap.get(key) || 0) : 0;
        mergedMap.set(key, { ...a, trackCount: trackCountMap.get(key) || 0, albumCount });
      });
      syncArtists.forEach(a => {
        const key = (a.name || '').toLowerCase();
        if (!mergedMap.has(key)) {
          mergedMap.set(key, { id: a.id || '', name: a.name, alias: a.alias || '', image: a.image || '', description: a.description || '', trackCount: trackCountMap.get(key) || 0, albumCount: albumCountMap.get(key) || 0 });
        }
      });

      setArtists(Array.from(mergedMap.values()));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/music/sync-artists', { method: 'POST' });
      if (res.ok) {
        loadData();
      } else {
        alert('同步失败');
      }
    } catch {
      alert('同步失败');
    } finally {
      setSyncing(false);
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
        body: JSON.stringify({ action: 'create', table: 'artists', data: { name: form.name, alias: form.alias, image: form.image, description: form.description } })
      });
      if (res.ok) { setAddOpen(false); setForm({ name: '', alias: '', image: '', description: '' }); loadData(); }
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
        body: JSON.stringify({ table: 'artists', id: selected.id, data: { name: form.name, alias: form.alias, image: form.image, description: form.description } })
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
      const res = await fetch(`/api/admin?table=artists&id=${selected.id}`, { method: 'DELETE' });
      if (res.ok) { setDeleteOpen(false); setSelected(null); loadData(); }
      else { alert('删除失败'); }
    } catch { alert('删除失败'); }
    finally { setSubmitting(false); }
  };

  const openEdit = (artist: Artist) => {
    setSelected(artist);
    setForm({ name: artist.name, alias: artist.alias || '', image: artist.image || '', description: artist.description || '' });
    setEditOpen(true);
  };

  const openDelete = (artist: Artist) => {
    setSelected(artist);
    setDeleteOpen(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-normal" style={{ color: 'var(--foreground)', letterSpacing: '-0.02em' }}>歌手管理</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>管理所有歌手信息</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
          <Input
            placeholder="搜索歌手名称或别名..."
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
        <Button onClick={handleSync} disabled={syncing} variant="outline" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
          <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
          同步歌手
        </Button>
        <Button onClick={() => { setForm({ name: '', alias: '', image: '', description: '' }); setAddOpen(true); }} style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>
          <Plus className="w-4 h-4 mr-2" />
          添加歌手
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--muted-foreground)' }} />
          <span className="ml-3 text-sm" style={{ color: 'var(--muted-foreground)' }}>加载中...</span>
        </div>
      ) : artists.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Music className="w-10 h-10 mb-3" style={{ color: 'var(--muted-foreground)' }} />
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>暂无歌手数据</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <AnimatePresence mode="popLayout">
            {artists.map((artist) => (
              <motion.div
                key={artist.id}
                layoutId={`artist-${artist.id}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                whileHover={{ scale: 1.02, y: -4 }}
                transition={{ duration: 0.3 }}
                className="rounded-xl cursor-pointer group relative"
                style={{ backgroundColor: 'var(--card)' }}
              >
                <div className="aspect-square rounded-t-xl overflow-hidden" style={{ backgroundColor: 'var(--accent)' }}>
                  {artist.image ? (
                    <img src={artist.image} alt={artist.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Music className="w-12 h-12" style={{ color: 'var(--muted-foreground)' }} />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="font-medium text-sm truncate" style={{ color: 'var(--foreground)' }}>{artist.name}</h3>
                  <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>{artist.alias || '-'}</p>
                  {artist.description && (
                    <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--muted-foreground)' }}>{artist.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{artist.trackCount || 0} 首歌曲</span>
                    <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{artist.albumCount || 0} 张专辑</span>
                  </div>
                </div>
                <div className="absolute bottom-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    className="p-2 rounded-full transition-colors"
                    style={{ backgroundColor: 'var(--accent)', color: 'var(--muted-foreground)' }}
                    onClick={(e) => { e.stopPropagation(); openEdit(artist); }}
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    className="p-2 rounded-full transition-colors"
                    style={{ backgroundColor: 'var(--accent)', color: '#ef4444' }}
                    onClick={(e) => { e.stopPropagation(); openDelete(artist); }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--foreground)' }}>添加歌手</DialogTitle>
            <DialogDescription style={{ color: 'var(--muted-foreground)' }}>创建一个新的歌手记录</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label style={{ color: 'var(--foreground)' }}>名称 *</Label>
              <Input placeholder="歌手名称" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }} />
            </div>
            <div className="space-y-2">
              <Label style={{ color: 'var(--foreground)' }}>别名</Label>
              <Input placeholder="歌手别名" value={form.alias} onChange={(e) => setForm({ ...form, alias: e.target.value })} style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }} />
            </div>
            <div className="space-y-2">
              <Label style={{ color: 'var(--foreground)' }}>头像URL</Label>
              <Input placeholder="https://..." value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }} />
            </div>
            <div className="space-y-2">
              <Label style={{ color: 'var(--foreground)' }}>简介</Label>
              <Input placeholder="歌手简介" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={submitting} style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>取消</Button>
            <Button onClick={handleAdd} disabled={submitting || !form.name.trim()} style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--foreground)' }}>编辑歌手</DialogTitle>
            <DialogDescription style={{ color: 'var(--muted-foreground)' }}>修改歌手信息</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label style={{ color: 'var(--foreground)' }}>名称 *</Label>
              <Input placeholder="歌手名称" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }} />
            </div>
            <div className="space-y-2">
              <Label style={{ color: 'var(--foreground)' }}>别名</Label>
              <Input placeholder="歌手别名" value={form.alias} onChange={(e) => setForm({ ...form, alias: e.target.value })} style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }} />
            </div>
            <div className="space-y-2">
              <Label style={{ color: 'var(--foreground)' }}>头像URL</Label>
              <Input placeholder="https://..." value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }} />
            </div>
            <div className="space-y-2">
              <Label style={{ color: 'var(--foreground)' }}>简介</Label>
              <Input placeholder="歌手简介" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={submitting} style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>取消</Button>
            <Button onClick={handleEdit} disabled={submitting || !form.name.trim()} style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--foreground)' }}>确认删除</DialogTitle>
            <DialogDescription style={{ color: 'var(--muted-foreground)' }}>
              确定要删除歌手「{selected?.name}」吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={submitting} style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>取消</Button>
            <Button onClick={handleDelete} disabled={submitting} style={{ backgroundColor: '#ef4444', color: '#fff' }}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
