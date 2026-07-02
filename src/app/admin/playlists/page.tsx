'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { PUBLIC_CACHE_API_URL } from '@/lib/public-env';
import {
  ListMusic,
  Plus,
  Search,
  Edit,
  Trash2,
  Globe,
  Lock,
  Loader2
} from 'lucide-react';

interface Playlist {
  id: string;
  name: string;
  description?: string;
  cover: string | null;
  trackCount: number;
  source: 'local' | 'external';
  is_public?: boolean;
  platform_source?: string | null;
  created_by?: string | null;
}

export default function PlaylistsPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', cover: '', is_public: true });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tracksModal, setTracksModal] = useState<Playlist | null>(null);
  const [tracks, setTracks] = useState<any[]>([]);
  const [tracksLoading, setTracksLoading] = useState(false);

  const loadData = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch('/api/admin/playlists/all');
      const data = await res.json();

      const localList: Playlist[] = (data.local || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description || '',
        cover: p.cover || null,
        trackCount: p.track_count || 0,
        source: 'local' as const,
        is_public: p.is_public ?? true,
        platform_source: p.platform_source || null,
        created_by: p.created_by,
      }));

      const externalList: Playlist[] = (data.external || []).map((p: any) => ({
        id: `external-${p.id}`,
        name: p.name,
        description: '',
        cover: p.cover_url || null,
        trackCount: p.track_count || 0,
        source: 'external' as const,
        created_by: p.created_by,
      }));

      setPlaylists([...localList, ...externalList]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(true);
  }, []);

  const handleCreate = async () => {
    if (!formData.name.trim()) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticPlaylist: Playlist = {
      id: tempId,
      name: formData.name,
      description: formData.description || '',
      cover: formData.cover || null,
      trackCount: 0,
      source: 'local' as const,
      is_public: formData.is_public,
      platform_source: null,
    };

    setPlaylists(prev => [optimisticPlaylist, ...prev]);
    setCreateOpen(false);
    resetForm();

    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          table: 'playlists',
          data: {
            name: formData.name,
            description: formData.description,
            cover: formData.cover,
            is_public: formData.is_public
          }
        })
      });
      if (res.ok) {
        const result = await res.json();
        const created = result.data || result;
        setPlaylists(prev => prev.map(p =>
          p.id === tempId ? { ...p, id: String(created.id) } : p
        ));
      } else {
        setPlaylists(prev => prev.filter(p => p.id !== tempId));
      }
    } catch (e) {
      console.error(e);
      setPlaylists(prev => prev.filter(p => p.id !== tempId));
    }
  };

  const handleUpdate = async () => {
    if (!editingId || !formData.name.trim()) return;

    setPlaylists(prev => prev.map(p =>
      p.id === editingId
        ? { ...p, name: formData.name, description: formData.description, cover: formData.cover || null, is_public: formData.is_public }
        : p
    ));
    setEditOpen(false);
    resetForm();
    setEditingId(null);

    try {
      const res = await fetch('/api/admin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: 'playlists',
          id: editingId,
          data: {
            name: formData.name,
            description: formData.description,
            cover: formData.cover,
            is_public: formData.is_public
          }
        })
      });
      if (!res.ok) {
        loadData();
      }
    } catch (e) {
      console.error(e);
      loadData();
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const targetId = deleteId;
    setDeleteId(null);

    setPlaylists(prev => prev.filter(p => p.id !== targetId));

    try {
      const res = await fetch(`/api/admin?table=playlists&id=${targetId}`, { method: 'DELETE' });
      if (!res.ok) {
        loadData();
      }
    } catch (e) {
      console.error(e);
      loadData();
    }
  };

  const openTracks = async (playlist: Playlist) => {
    setTracksModal(playlist);
    setTracksLoading(true);
    setTracks([]);
    try {
      const playlistId = playlist.source === 'external'
        ? playlist.id.replace('external-', '')
        : playlist.id;
      const res = await fetch(`${PUBLIC_CACHE_API_URL}/api/cache/playlists/${playlistId}/tracks?source=${playlist.source}`);
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data) ? data : [];
        setTracks(items.map((item: any) => {
          const t = item.tracks || item;
          return {
            id: t.id || item.id,
            title: t.title || t.track_title || '未知歌曲',
            artist: t.artist || t.track_artist || '未知',
            album: t.album || null,
            duration: t.duration || t.track_duration || 0,
          };
        }));
      }
    } catch (e) {
      console.error('获取歌单歌曲失败:', e);
    } finally {
      setTracksLoading(false);
    }
  };

  const openEdit = (playlist: Playlist) => {
    setEditingId(playlist.id);
    setFormData({
      name: playlist.name,
      description: playlist.description || '',
      cover: playlist.cover || '',
      is_public: playlist.is_public ?? true
    });
    setEditOpen(true);
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', cover: '', is_public: true });
  };

  const filteredPlaylists = playlists.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6" style={{ backgroundColor: 'transparent' }}>
      <div>
        <h1 className="text-2xl font-normal" style={{ color: 'var(--foreground)' }}>歌单管理</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>管理所有歌单的创建、编辑与删除</p>
        <div className="mt-4" style={{ height: '1px', background: 'rgba(255,255,255,0.08)' }} />
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
          <Input
            placeholder="搜索歌单..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-10"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)', color: 'var(--foreground)' }}
          />
        </div>
        <button
          onClick={() => { resetForm(); setCreateOpen(true); }}
          className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 hover:scale-[1.05] active:scale-[0.97]"
          style={{ backgroundColor: 'var(--primary)', color: 'var(--foreground)' }}
        >
          <Plus className="w-4 h-4" />
          创建歌单
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--muted-foreground)' }} />
        </div>
      ) : filteredPlaylists.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <ListMusic className="w-12 h-12 mb-3" style={{ color: 'var(--muted-foreground)' }} />
          <p style={{ color: 'var(--muted-foreground)' }}>暂无歌单</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <AnimatePresence>
            {filteredPlaylists.map((playlist) => (
              <motion.div
                key={playlist.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.3 }}
                className="cursor-pointer group overflow-hidden"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 12,
                  transition: 'border-color 0.3s ease, transform 0.3s ease',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--gold)';
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)';
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                }}
              >
                <div className="aspect-square overflow-hidden relative" style={{ backgroundColor: 'var(--accent)', borderRadius: '12px 12px 0 0' }}>
                  {playlist.cover ? (
                    <img src={playlist.cover} alt={playlist.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ListMusic className="w-12 h-12" style={{ color: 'var(--muted-foreground)' }} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    {playlist.source === 'local' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); openEdit(playlist); }}
                        className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                        title="编辑"
                      >
                        <Edit className="w-5 h-5" style={{ color: 'var(--foreground)' }} />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); openTracks(playlist); }}
                      className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                      title="查看歌曲"
                    >
                      <ListMusic className="w-5 h-5" style={{ color: 'var(--foreground)' }} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteId(playlist.id); }}
                      className="p-2 rounded-full bg-white/20 hover:bg-red-500/50 transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-5 h-5" style={{ color: 'var(--foreground)' }} />
                    </button>
                  </div>
                </div>
                <div className="p-3">
                  <h3 className="font-medium text-sm truncate" style={{ color: 'var(--foreground)' }}>{playlist.name}</h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                    由 {playlist.created_by || '未知'} 创建
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span
                      className="text-xs rounded-full px-2 py-0.5"
                      style={{ backgroundColor: playlist.source === 'local' ? '#3b82f6' : '#f97316', color: 'var(--foreground)' }}
                    >
                      {playlist.source === 'local' ? '本地' : '外部'}
                    </span>
                    {playlist.source === 'local' && (
                      <span
                        className="text-xs rounded-full px-2 py-0.5 flex items-center gap-1"
                        style={{ backgroundColor: playlist.is_public ? '#22c55e' : 'var(--muted-foreground)', color: 'var(--foreground)' }}
                      >
                        {playlist.is_public ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                        {playlist.is_public ? '公开' : '私有'}
                      </span>
                    )}
                    <span className="text-xs ml-auto" style={{ color: 'var(--muted-foreground)' }}>
                      {playlist.trackCount} 首
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--foreground)' }}>创建歌单</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label style={{ color: 'var(--foreground)' }}>名称</Label>
              <Input
                placeholder="输入歌单名称"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
              />
            </div>
            <div className="space-y-2">
              <Label style={{ color: 'var(--foreground)' }}>描述</Label>
              <Input
                placeholder="输入歌单描述"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
              />
            </div>
            <div className="space-y-2">
              <Label style={{ color: 'var(--foreground)' }}>封面URL</Label>
              <Input
                placeholder="输入封面图片URL"
                value={formData.cover}
                onChange={(e) => setFormData(prev => ({ ...prev, cover: e.target.value }))}
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label style={{ color: 'var(--foreground)' }}>是否公开</Label>
              <Switch
                checked={formData.is_public}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_public: checked }))}
              />
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setCreateOpen(false)}
              className="px-4 py-2 rounded-full text-sm transition-all duration-200 hover:scale-[1.02]"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--foreground)' }}
            >
              取消
            </button>
            <button
              onClick={handleCreate}
              disabled={saving || !formData.name.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 hover:scale-[1.05] disabled:opacity-50"
              style={{ backgroundColor: 'var(--primary)', color: 'var(--foreground)' }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              创建
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--foreground)' }}>编辑歌单</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label style={{ color: 'var(--foreground)' }}>名称</Label>
              <Input
                placeholder="输入歌单名称"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
              />
            </div>
            <div className="space-y-2">
              <Label style={{ color: 'var(--foreground)' }}>描述</Label>
              <Input
                placeholder="输入歌单描述"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
              />
            </div>
            <div className="space-y-2">
              <Label style={{ color: 'var(--foreground)' }}>封面URL</Label>
              <Input
                placeholder="输入封面图片URL"
                value={formData.cover}
                onChange={(e) => setFormData(prev => ({ ...prev, cover: e.target.value }))}
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label style={{ color: 'var(--foreground)' }}>是否公开</Label>
              <Switch
                checked={formData.is_public}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_public: checked }))}
              />
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setEditOpen(false)}
              className="px-4 py-2 rounded-full text-sm transition-all duration-200 hover:scale-[1.02]"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--foreground)' }}
            >
              取消
            </button>
            <button
              onClick={handleUpdate}
              disabled={saving || !formData.name.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 hover:scale-[1.05] disabled:opacity-50"
              style={{ backgroundColor: 'var(--primary)', color: 'var(--foreground)' }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Edit className="w-4 h-4" />}
              保存
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <DialogContent style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--foreground)' }}>确认删除</DialogTitle>
          </DialogHeader>
          <p className="py-4" style={{ color: 'var(--muted-foreground)' }}>确定要删除这个歌单吗？此操作不可恢复。</p>
          <DialogFooter>
            <button
              onClick={() => setDeleteId(null)}
              className="px-4 py-2 rounded-full text-sm transition-all duration-200 hover:scale-[1.02]"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--foreground)' }}
            >
              取消
            </button>
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 hover:scale-[1.05]"
              style={{ backgroundColor: '#ef4444', color: 'var(--foreground)' }}
            >
              <Trash2 className="w-4 h-4" />
              删除
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!tracksModal} onOpenChange={(open) => { if (!open) setTracksModal(null); }}>
        <DialogContent style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', maxWidth: 600 }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--foreground)' }}>{tracksModal?.name} - 歌曲列表</DialogTitle>
          </DialogHeader>
          <div className="py-4 max-h-96 overflow-y-auto">
            {tracksLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--muted-foreground)' }} />
              </div>
            ) : tracks.length === 0 ? (
              <p className="text-center py-8 text-sm" style={{ color: 'var(--muted-foreground)' }}>暂无歌曲</p>
            ) : (
              <div className="space-y-1">
                {tracks.map((track, i) => (
                  <div
                    key={track.id || i}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg"
                    style={{ backgroundColor: i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent' }}
                  >
                    <span className="text-xs w-6 text-center opacity-40">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate" style={{ color: 'var(--foreground)' }}>{track.title}</p>
                      <p className="text-xs truncate opacity-50">{track.artist}{track.album ? ` · ${track.album}` : ''}</p>
                    </div>
                    <span className="text-xs opacity-40">
                      {track.duration ? `${Math.floor(track.duration / 60)}:${String(Math.floor(track.duration % 60)).padStart(2, '0')}` : '--:--'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <button
              onClick={() => setTracksModal(null)}
              className="px-4 py-2 rounded-full text-sm transition-all duration-200 hover:scale-[1.02]"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--foreground)' }}
            >
              关闭
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
