'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, Edit, Trash2, Loader2, Image } from 'lucide-react';

interface Banner {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  image_url?: string;
  tag?: string;
  background_color?: string;
  cta_text?: string;
  link_type?: 'none' | 'playlist' | 'track' | 'external';
  link_id?: string;
  link_url?: string;
  sort_order?: number;
  is_active?: boolean;
  created_at?: string;
}

type BannerFormData = {
  title: string;
  subtitle: string;
  description: string;
  image_url: string;
  tag: string;
  background_color: string;
  cta_text: string;
  link_type: NonNullable<Banner['link_type']>;
  link_id: string;
  link_url: string;
  sort_order: number;
  is_active: boolean;
};

const defaultForm: BannerFormData = {
  title: '',
  subtitle: '',
  description: '',
  image_url: '',
  tag: '',
  background_color: '#1E3A8A',
  cta_text: '',
  link_type: 'none',
  link_id: '',
  link_url: '',
  sort_order: 0,
  is_active: true,
};

const linkTypeLabels: Record<string, string> = {
  none: '无',
  playlist: '歌单',
  track: '歌曲',
  external: '外部链接',
};

const linkTypeColors: Record<string, string> = {
  none: 'var(--muted-foreground)',
  playlist: '#3b82f6',
  track: '#8b5cf6',
  external: '#f97316',
};

export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<BannerFormData>({ ...defaultForm });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/banners');
      const result = await res.json();
      setBanners(result.data || result || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = async () => {
    if (!formData.title.trim()) return;
    setSaving(true);

    const tempId = `temp-${Date.now()}`;
    const optimistic: Banner = {
      id: tempId,
      title: formData.title,
      subtitle: formData.subtitle,
      description: formData.description,
      image_url: formData.image_url,
      tag: formData.tag,
      background_color: formData.background_color,
      cta_text: formData.cta_text,
      link_type: formData.link_type,
      link_id: formData.link_id,
      link_url: formData.link_url,
      sort_order: formData.sort_order,
      is_active: formData.is_active,
    };

    setBanners(prev => [optimistic, ...prev]);
    setEditOpen(false);
    resetForm();

    try {
      const res = await fetch('/api/admin/banners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', data: optimistic }),
      });
      if (res.ok) {
        const result = await res.json();
        const created = result.data || result;
        setBanners(prev => prev.map(b => b.id === tempId ? { ...b, id: String(created.id) } : b));
      } else {
        setBanners(prev => prev.filter(b => b.id !== tempId));
      }
    } catch (e) {
      console.error(e);
      setBanners(prev => prev.filter(b => b.id !== tempId));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingId || !formData.title.trim()) return;
    setSaving(true);

    setBanners(prev => prev.map(b =>
      b.id === editingId
        ? {
            ...b,
            title: formData.title,
            subtitle: formData.subtitle,
            description: formData.description,
            image_url: formData.image_url,
            tag: formData.tag,
            background_color: formData.background_color,
            cta_text: formData.cta_text,
            link_type: formData.link_type,
            link_id: formData.link_id,
            link_url: formData.link_url,
            sort_order: formData.sort_order,
            is_active: formData.is_active,
          }
        : b
    ));
    setEditOpen(false);
    setEditingId(null);
    resetForm();

    try {
      const res = await fetch('/api/admin/banners', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
          data: {
            title: formData.title,
            subtitle: formData.subtitle,
            description: formData.description,
            image_url: formData.image_url,
            tag: formData.tag,
            background_color: formData.background_color,
            cta_text: formData.cta_text,
            link_type: formData.link_type,
            link_id: formData.link_id,
            link_url: formData.link_url,
            sort_order: formData.sort_order,
            is_active: formData.is_active,
          },
        }),
      });
      if (!res.ok) loadData();
    } catch (e) {
      console.error(e);
      loadData();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const targetId = deleteId;
    setDeleteId(null);

    setBanners(prev => prev.filter(b => b.id !== targetId));

    try {
      const res = await fetch(`/api/admin/banners?id=${targetId}`, { method: 'DELETE' });
      if (!res.ok) loadData();
    } catch (e) {
      console.error(e);
      loadData();
    }
  };

  const openEdit = (banner: Banner) => {
    setEditingId(banner.id);
    setFormData({
      title: banner.title,
      subtitle: banner.subtitle || '',
      description: banner.description || '',
      image_url: banner.image_url || '',
      tag: banner.tag || '',
      background_color: banner.background_color || '#1E3A8A',
      cta_text: banner.cta_text || '',
      link_type: banner.link_type || 'none',
      link_id: banner.link_id || '',
      link_url: banner.link_url || '',
      sort_order: banner.sort_order || 0,
      is_active: banner.is_active ?? true,
    });
    setEditOpen(true);
  };

  const openCreate = () => {
    setEditingId(null);
    resetForm();
    setEditOpen(true);
  };

  const resetForm = () => {
    setFormData({ ...defaultForm });
  };

  const filteredBanners = banners.filter(b =>
    b.title.toLowerCase().includes(search.toLowerCase()) ||
    (b.subtitle || '').toLowerCase().includes(search.toLowerCase()) ||
    (b.tag || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-normal" style={{ color: 'var(--foreground)', letterSpacing: '-0.02em' }}>轮播图管理</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>管理探索页精选活动展示</p>
        <div className="mt-4" style={{ height: '1px', background: 'rgba(255,255,255,0.08)' }} />
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
          <Input
            placeholder="搜索轮播图..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)', color: 'var(--foreground)' }}
          />
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 hover:scale-[1.05] active:scale-[0.97]"
          style={{ backgroundColor: 'var(--primary)', color: 'var(--foreground)' }}
        >
          <Plus className="w-4 h-4" />
          添加轮播图
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--muted-foreground)' }} />
          <span className="ml-3 text-sm" style={{ color: 'var(--muted-foreground)' }}>加载中...</span>
        </div>
      ) : filteredBanners.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Image className="w-10 h-10 mb-3" style={{ color: 'var(--muted-foreground)' }} />
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>暂无轮播图数据</p>
        </div>
      ) : (
        <div className="overflow-hidden">
          <div
            className="grid grid-cols-[40px_60px_1fr_120px_100px_80px_100px] gap-4 px-4 py-3 text-xs font-medium uppercase tracking-wider"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <div className="text-center">#</div>
            <div />
            <div>标题</div>
            <div>标签</div>
            <div>链接类型</div>
            <div className="text-center">状态</div>
            <div className="text-center">操作</div>
          </div>

          <div className="pb-4">
            <AnimatePresence mode="popLayout">
              {filteredBanners.map((banner, index) => (
                <motion.div
                  key={banner.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3, delay: index * 0.02 }}
                  className="group grid grid-cols-[40px_60px_1fr_120px_100px_80px_100px] gap-4 px-4 py-3 items-center transition-all duration-300 ease-out hover:bg-white/[0.06]"
                >
                  <div className="flex items-center justify-center">
                    <span className="text-sm tabular-nums" style={{ color: 'var(--muted-foreground)' }}>{index + 1}</span>
                  </div>

                  <div className="w-[52px] h-[34px] rounded overflow-hidden flex-shrink-0" style={{ backgroundColor: banner.background_color || 'var(--accent)' }}>
                    {banner.image_url ? (
                      <img src={banner.image_url} alt={banner.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Image className="w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{banner.title}</p>
                    {banner.subtitle && (
                      <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>{banner.subtitle}</p>
                    )}
                  </div>

                  <div className="min-w-0">
                    {banner.tag ? (
                      <Badge
                        className="text-xs truncate max-w-full"
                        style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'var(--foreground)', border: 'none' }}
                      >
                        {banner.tag}
                      </Badge>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>-</span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full inline-block truncate max-w-full"
                      style={{ backgroundColor: `${linkTypeColors[banner.link_type || 'none']}20`, color: linkTypeColors[banner.link_type || 'none'] }}
                    >
                      {linkTypeLabels[banner.link_type || 'none']}
                    </span>
                  </div>

                  <div className="flex items-center justify-center">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: banner.is_active ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                        color: banner.is_active ? '#22c55e' : '#ef4444',
                      }}
                    >
                      {banner.is_active ? '启用' : '禁用'}
                    </span>
                  </div>

                  <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      className="p-1.5 rounded-lg hover:bg-[rgba(193,95,60,0.1)] transition-colors duration-200"
                      style={{ color: 'var(--muted-foreground)' }}
                      onClick={() => openEdit(banner)}
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      className="p-1.5 rounded-lg hover:bg-[rgba(239,68,68,0.1)] transition-colors duration-200"
                      style={{ color: '#ef4444' }}
                      onClick={() => setDeleteId(banner.id)}
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--foreground)' }}>{editingId ? '编辑轮播图' : '添加轮播图'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label style={{ color: 'var(--foreground)' }}>标题 *</Label>
              <Input
                placeholder="轮播图标题"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
              />
            </div>
            <div className="space-y-2">
              <Label style={{ color: 'var(--foreground)' }}>副标题</Label>
              <Input
                placeholder="副标题"
                value={formData.subtitle}
                onChange={(e) => setFormData(prev => ({ ...prev, subtitle: e.target.value }))}
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
              />
            </div>
            <div className="space-y-2">
              <Label style={{ color: 'var(--foreground)' }}>描述</Label>
              <Input
                placeholder="轮播图描述"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
              />
            </div>
            <div className="space-y-2">
              <Label style={{ color: 'var(--foreground)' }}>图片URL</Label>
              <Input
                placeholder="https://..."
                value={formData.image_url}
                onChange={(e) => setFormData(prev => ({ ...prev, image_url: e.target.value }))}
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
              />
            </div>
            <div className="space-y-2">
              <Label style={{ color: 'var(--foreground)' }}>标签</Label>
              <Input
                placeholder="如：热门、推荐"
                value={formData.tag}
                onChange={(e) => setFormData(prev => ({ ...prev, tag: e.target.value }))}
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
              />
            </div>
            <div className="space-y-2">
              <Label style={{ color: 'var(--foreground)' }}>背景色</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={formData.background_color}
                  onChange={(e) => setFormData(prev => ({ ...prev, background_color: e.target.value }))}
                  className="w-9 h-9 rounded cursor-pointer border-0 p-0"
                  style={{ backgroundColor: 'transparent' }}
                />
                <Input
                  value={formData.background_color}
                  onChange={(e) => setFormData(prev => ({ ...prev, background_color: e.target.value }))}
                  className="flex-1"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label style={{ color: 'var(--foreground)' }}>CTA文字</Label>
              <Input
                placeholder="如：立即收听"
                value={formData.cta_text}
                onChange={(e) => setFormData(prev => ({ ...prev, cta_text: e.target.value }))}
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
              />
            </div>
            <div className="space-y-2">
              <Label style={{ color: 'var(--foreground)' }}>链接类型</Label>
              <Select value={formData.link_type} onValueChange={(v) => setFormData(prev => ({ ...prev, link_type: v as BannerFormData['link_type'] }))}>
                <SelectTrigger className="w-full" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                  <SelectItem value="none">无</SelectItem>
                  <SelectItem value="playlist">歌单</SelectItem>
                  <SelectItem value="track">歌曲</SelectItem>
                  <SelectItem value="external">外部链接</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(formData.link_type === 'playlist' || formData.link_type === 'track') && (
              <div className="space-y-2">
                <Label style={{ color: 'var(--foreground)' }}>链接ID</Label>
                <Input
                  placeholder="输入对应的ID"
                  value={formData.link_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, link_id: e.target.value }))}
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
                />
              </div>
            )}
            {formData.link_type === 'external' && (
              <div className="space-y-2">
                <Label style={{ color: 'var(--foreground)' }}>链接URL</Label>
                <Input
                  placeholder="https://..."
                  value={formData.link_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, link_url: e.target.value }))}
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label style={{ color: 'var(--foreground)' }}>排序</Label>
              <Input
                type="number"
                placeholder="数字越小越靠前"
                value={formData.sort_order}
                onChange={(e) => setFormData(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label style={{ color: 'var(--foreground)' }}>是否启用</Label>
              <button
                onClick={() => setFormData(prev => ({ ...prev, is_active: !prev.is_active }))}
                className="relative w-11 h-6 rounded-full transition-colors duration-200"
                style={{ backgroundColor: formData.is_active ? 'var(--primary)' : 'var(--accent)' }}
              >
                <span
                  className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200"
                  style={{ transform: formData.is_active ? 'translateX(20px)' : 'translateX(0)' }}
                />
              </button>
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => { setEditOpen(false); setEditingId(null); resetForm(); }}
              className="px-4 py-2 rounded-full text-sm transition-all duration-200 hover:scale-[1.02]"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--foreground)' }}
            >
              取消
            </button>
            <button
              onClick={editingId ? handleUpdate : handleCreate}
              disabled={saving || !formData.title.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 hover:scale-[1.05] disabled:opacity-50"
              style={{ backgroundColor: 'var(--primary)', color: 'var(--foreground)' }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? <Edit className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {editingId ? '保存' : '添加'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <DialogContent style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--foreground)' }}>确认删除</DialogTitle>
          </DialogHeader>
          <p className="py-4" style={{ color: 'var(--muted-foreground)' }}>确定要删除这个轮播图吗？此操作不可恢复。</p>
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
    </div>
  );
}
