'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Users,
  Upload,
} from 'lucide-react';

interface User {
  id: string;
  email: string;
  username: string;
  role: 'user' | 'admin';
  created_at: string;
  avatar_url?: string;
  source?: string;
}

interface FormData {
  email: string;
  username: string;
  role: User['role'];
  avatar_url: string;
}

const emptyForm: FormData = { email: '', username: '', role: 'user', avatar_url: '' };

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string>('');
  const [form, setForm] = useState<FormData>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin?table=users&includeAuth=true&search=${encodeURIComponent(search)}&page=${page}&limit=50`
      );
      const data = await res.json();
      setUsers(data.data || []);
      setTotalPages(data.pagination?.totalPages ?? 1);
    } catch (error) {
      console.error('加载用户失败:', error);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleSearch = () => {
    setPage(1);
    loadUsers();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const openAdd = () => {
    setForm(emptyForm);
    setAddOpen(true);
  };

  const openEdit = (user: User) => {
    setEditId(user.id);
    setForm({
      email: user.email,
      username: user.username,
      role: user.role,
      avatar_url: user.avatar_url || '',
    });
    setEditOpen(true);
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editId) return;

    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('图片大小不能超过 5MB');
      return;
    }

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', editId);

      const res = await fetch('/api/user/avatar/upload', {
        method: 'POST',
        body: formData,
      });
      const result = await res.json();
      if (result.success) {
        setForm((f) => ({ ...f, avatar_url: result.avatar }));
        // 立即更新本地列表显示
        setUsers((prev) =>
          prev.map((u) => (u.id === editId ? { ...u, avatar_url: result.avatar } : u))
        );
      } else {
        alert(result.error || '上传失败');
      }
    } catch (error) {
      console.error('上传头像失败:', error);
      alert('上传失败');
    } finally {
      setUploadingAvatar(false);
      e.target.value = '';
    }
  };

  const handleCreate = async () => {
    if (!form.email || !form.username) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          table: 'users',
          data: { email: form.email, username: form.username, role: form.role },
        }),
      });
      const result = await res.json();
      if (result.success) {
        setAddOpen(false);
        loadUsers();
      } else {
        alert(result.error || '创建失败');
      }
    } catch (error) {
      console.error('创建用户失败:', error);
      alert('创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!form.email || !form.username) return;
    setSubmitting(true);
    // 乐观更新：立即同步本地状态，无需等待服务器响应
    setUsers((prev) =>
      prev.map((u) =>
        u.id === editId
          ? { ...u, email: form.email, username: form.username, role: form.role, avatar_url: form.avatar_url }
          : u
      )
    );
    setEditOpen(false);
    try {
      const res = await fetch('/api/admin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: 'users',
          id: editId,
          data: {
            email: form.email,
            username: form.username,
            role: form.role,
            avatar_url: form.avatar_url,
          },
        }),
      });
      const result = await res.json();
      if (!result.success) {
        alert(result.error || '更新失败');
        // 失败时回滚：重新加载
        loadUsers();
      }
    } catch (error) {
      console.error('更新用户失败:', error);
      alert('更新失败');
      loadUsers();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    // 乐观更新：立即移除列表项
    const removed = users.find((u) => u.id === id);
    setUsers((prev) => prev.filter((u) => u.id !== id));
    setDeleteConfirm(null);
    try {
      const res = await fetch(`/api/admin?table=users&id=${id}`, {
        method: 'DELETE',
      });
      const result = await res.json();
      if (!result.success) {
        alert(result.error || '删除失败');
        if (removed) loadUsers();
      }
    } catch (error) {
      console.error('删除用户失败:', error);
      alert('删除失败');
      if (removed) loadUsers();
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  return (
    <div className="space-y-6" style={{ backgroundColor: 'transparent' }}>
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>用户管理</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>管理系统用户账户与权限</p>
        <div className="mt-4" style={{ height: '1px', background: 'rgba(255,255,255,0.08)' }} />
      </div>

      <motion.div
        className="flex items-center gap-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
          <Input
            placeholder="搜索用户名或邮箱..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-10"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)', color: 'var(--foreground)' }}
          />
        </div>
        <button
          onClick={handleSearch}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 hover:scale-[1.05] active:scale-[0.97]"
          style={{
            backgroundColor: 'var(--card)',
            color: 'var(--foreground)',
            border: '1px solid var(--border)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}
        >
          搜索
        </button>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 hover:scale-[1.05] active:scale-[0.97]"
          style={{
            backgroundColor: 'var(--primary)',
            color: 'var(--foreground)',
            boxShadow: '0 4px 16px rgba(193, 95, 60, 0.3)',
          }}
        >
          <Plus className="w-4 h-4" />
          添加用户
        </button>
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--primary)' }} />
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Users className="w-10 h-10" style={{ color: 'var(--muted-foreground)' }} />
          <p style={{ color: 'var(--muted-foreground)' }}>暂无用户数据</p>
        </div>
      ) : (
        <div className="overflow-hidden">
          <div
            className="grid grid-cols-[40px_1fr_120px_100px_100px_120px] gap-4 px-4 py-3 text-xs font-medium uppercase tracking-wider"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <div className="text-center">#</div>
            <div>用户</div>
            <div>邮箱</div>
            <div>角色</div>
            <div>注册时间</div>
            <div className="text-center">操作</div>
          </div>
          <div className="pb-4">
            <AnimatePresence>
              {users.map((user, index) => (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2, delay: index * 0.02 }}
                  className="group grid grid-cols-[40px_1fr_120px_100px_100px_120px] gap-4 px-4 py-3 items-center hover:bg-white/[0.06] dark:hover:bg-white/[0.04] transition-colors duration-200"
                >
                  <div className="flex items-center justify-center">
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.username}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
                        style={{ backgroundColor: 'var(--primary)', color: 'var(--foreground)' }}
                      >
                        {user.username?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm font-medium truncate block" style={{ color: 'var(--foreground)' }}>
                      {user.username}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs truncate block" style={{ color: 'var(--muted-foreground)' }}>{user.email}</span>
                  </div>
                  <div>
                    <Badge
                      className="text-[10px] px-1.5 py-0"
                      style={{
                        backgroundColor: user.role === 'admin' ? 'rgba(193,95,60,0.12)' : 'rgba(107,114,128,0.12)',
                        color: user.role === 'admin' ? 'var(--primary)' : 'var(--muted-foreground)',
                      }}
                    >
                      {user.role === 'admin' ? '管理员' : '用户'}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      {formatDate(user.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      onClick={() => openEdit(user)}
                      className="p-1.5 rounded-lg hover:bg-[rgba(193,95,60,0.1)] dark:hover:bg-[rgba(212,118,90,0.15)] transition-colors duration-200"
                      title="编辑"
                    >
                      <Edit className="w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(user.id)}
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
        <DialogContent aria-describedby={undefined} style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--foreground)' }}>添加新用户</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label style={{ color: 'var(--foreground)' }}>邮箱</Label>
              <Input
                placeholder="user@example.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
              />
            </div>
            <div className="space-y-2">
              <Label style={{ color: 'var(--foreground)' }}>用户名</Label>
              <Input
                placeholder="username"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
              />
            </div>
            <div className="space-y-2">
              <Label style={{ color: 'var(--foreground)' }}>角色</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as User['role'] }))}>
                <SelectTrigger
                  className="w-full"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                  <SelectItem value="user" style={{ color: 'var(--foreground)' }}>普通用户</SelectItem>
                  <SelectItem value="admin" style={{ color: 'var(--foreground)' }}>管理员</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setAddOpen(false)}
              className="flex items-center px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 hover:scale-[1.05] active:scale-[0.97]"
              style={{
                backgroundColor: 'var(--card)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
              }}
            >
              取消
            </button>
            <button
              onClick={handleCreate}
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 hover:scale-[1.05] active:scale-[0.97] disabled:opacity-60"
              style={{
                backgroundColor: 'var(--primary)',
                color: 'var(--foreground)',
                boxShadow: '0 4px 16px rgba(193, 95, 60, 0.3)',
              }}
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              创建
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent aria-describedby={undefined} style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--foreground)' }}>编辑用户</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* 头像上传区域 */}
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center overflow-hidden shrink-0"
                style={{
                  backgroundColor: form.avatar_url ? 'transparent' : 'var(--primary)',
                  color: 'var(--foreground)',
                  fontWeight: 600,
                  fontSize: 18,
                }}
              >
                {form.avatar_url ? (
                  <img
                    src={form.avatar_url}
                    alt={form.username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  form.username?.charAt(0)?.toUpperCase() || '?'
                )}
              </div>
              <div className="flex-1">
                <Label style={{ color: 'var(--foreground)' }}>头像</Label>
                <label
                  htmlFor="admin-avatar-upload"
                  className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all duration-300 hover:scale-[1.03] active:scale-[0.97] cursor-pointer"
                  style={{
                    backgroundColor: 'var(--card)',
                    color: 'var(--foreground)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {uploadingAvatar ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  {uploadingAvatar ? '上传中...' : '上传头像'}
                </label>
                <input
                  id="admin-avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarFileChange}
                />
                <p className="text-[10px] mt-1" style={{ color: 'var(--muted-foreground)' }}>
                  支持 JPG/PNG/WebP，最大 5MB
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label style={{ color: 'var(--foreground)' }}>邮箱</Label>
              <Input
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
              />
            </div>
            <div className="space-y-2">
              <Label style={{ color: 'var(--foreground)' }}>用户名</Label>
              <Input
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
              />
            </div>
            <div className="space-y-2">
              <Label style={{ color: 'var(--foreground)' }}>角色</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as User['role'] }))}>
                <SelectTrigger
                  className="w-full"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                  <SelectItem value="user" style={{ color: 'var(--foreground)' }}>普通用户</SelectItem>
                  <SelectItem value="admin" style={{ color: 'var(--foreground)' }}>管理员</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setEditOpen(false)}
              className="flex items-center px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 hover:scale-[1.05] active:scale-[0.97]"
              style={{
                backgroundColor: 'var(--card)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
              }}
            >
              取消
            </button>
            <button
              onClick={handleUpdate}
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 hover:scale-[1.05] active:scale-[0.97] disabled:opacity-60"
              style={{
                backgroundColor: 'var(--primary)',
                color: 'var(--foreground)',
                boxShadow: '0 4px 16px rgba(193, 95, 60, 0.3)',
              }}
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              保存
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent aria-describedby={undefined} style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--foreground)' }}>确认删除</DialogTitle>
          </DialogHeader>
          <p className="py-4" style={{ color: 'var(--muted-foreground)' }}>
            确定要删除该用户吗？此操作不可撤销。
          </p>
          <DialogFooter>
            <button
              onClick={() => setDeleteConfirm(null)}
              className="flex items-center px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 hover:scale-[1.05] active:scale-[0.97]"
              style={{
                backgroundColor: 'var(--card)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
              }}
            >
              取消
            </button>
            <button
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 hover:scale-[1.05] active:scale-[0.97]"
              style={{
                backgroundColor: '#ef4444',
                color: 'var(--foreground)',
                boxShadow: '0 4px 16px rgba(239, 68, 68, 0.3)',
              }}
            >
              删除
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
