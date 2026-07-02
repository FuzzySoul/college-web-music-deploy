'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, Music, Heart, BarChart3, LogIn, ExternalLink, Camera, Upload, X, Pencil, Loader2, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { usePlayer } from '@/app/home/context/PlayerContext';
import { musicService } from '@/lib/music-service';
import type { Playlist } from '@/components/music/types';

function getSourceInfo(p: Playlist): { label: string; color: string } {
  if (p.source === 'custom') return { label: '自建', color: '#6366f1' };
  if (p.source === 'external' || p.platformSource === 'netease' || p.id.startsWith('external-'))
    return { label: '网易云', color: '#ff7a00' };
  return { label: '本地', color: '#10b981' };
}

function PlaylistGrid({ playlists, emptyText }: { playlists: Playlist[]; emptyText: string }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {playlists.map((p) => {
        const { label, color } = getSourceInfo(p);
        return (
          <Link
            key={p.id}
            href={`/home/playlists?id=${encodeURIComponent(p.id)}&source=${encodeURIComponent(p.source || 'local')}`}
            className="group"
          >
            <div className="aspect-square rounded-xl overflow-hidden mb-2 relative bg-black/5 dark:bg-white/5">
              {p.cover ? (
                <img
                  src={p.cover}
                  alt={p.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Music className="w-8 h-8 opacity-30" />
                </div>
              )}
              <span
                className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: color + '20', color }}
              >
                {label}
              </span>
            </div>
            <p className="text-sm font-medium truncate">{p.name}</p>
            <p className="text-xs opacity-50">{p.trackCount || 0} 首歌曲</p>
          </Link>
        );
      })}
    </div>
  );
}

function AvatarEditor({ currentUser, currentAvatar, onSave, onClose }: {
  currentUser: { id: string; username: string };
  currentAvatar: string;
  onSave: (url: string) => void;
  onClose: () => void;
}) {
  const [urlInput, setUrlInput] = useState(currentAvatar || '');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 乐观上传：立即显示本地预览
    const objectUrl = URL.createObjectURL(file);
    setUrlInput(objectUrl);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', currentUser.id);

      const res = await fetch('/api/user/avatar/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.avatar) {
        setUrlInput(data.avatar);
      } else {
        alert(data.error || '上传失败');
      }
    } catch (err) {
      console.error('上传失败:', err);
      alert('上传失败，请尝试使用URL链接');
    } finally {
      setUploading(false);
      URL.revokeObjectURL(objectUrl);
    }
  };

  const handleSave = async () => {
    if (!urlInput.trim()) return;
    onSave(urlInput.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="rounded-2xl p-6 w-full max-w-sm mx-4"
        style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">设置头像</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex justify-center mb-4">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-4xl text-white font-bold shadow-lg">
            {urlInput ? (
              <img src={urlInput} alt="头像预览" className="w-full h-full object-cover" />
            ) : (
              currentUser.username.charAt(0).toUpperCase()
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs opacity-60 mb-1 block">图片链接</label>
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="输入图片URL..."
              className="w-full px-3 py-2 rounded-xl text-sm outline-none"
              style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs opacity-40">或</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <Upload className="w-4 h-4" />
            {uploading ? '上传中...' : '上传本地图片'}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
        </div>

        <button
          onClick={handleSave}
          disabled={!urlInput.trim()}
          className="w-full mt-4 px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 text-white"
          style={{ background: 'linear-gradient(135deg, #ff7a00, #ff5500)' }}
        >
          保存
        </button>
      </div>
    </div>
  );
}

function ProfileEditor({ currentUser, onSave, onClose }: {
  currentUser: { id: string; username: string; email?: string };
  onSave: (data: { username: string; email: string }) => void;
  onClose: () => void;
}) {
  const [username, setUsername] = useState(currentUser.username);
  const [email, setEmail] = useState(currentUser.email || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!username.trim()) return;
    setSaving(true);
    onSave({ username: username.trim(), email: email.trim() });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="rounded-2xl p-6 w-full max-w-sm mx-4"
        style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">编辑资料</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs opacity-60 mb-1 block">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="输入用户名..."
              className="w-full px-3 py-2 rounded-xl text-sm outline-none"
              style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          </div>
          <div>
            <label className="text-xs opacity-60 mb-1 block">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="输入邮箱..."
              className="w-full px-3 py-2 rounded-xl text-sm outline-none"
              style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={!username.trim() || saving}
          className="w-full mt-4 px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 text-white"
          style={{ background: 'linear-gradient(135deg, #ff7a00, #ff5500)' }}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : '保存'}
        </button>
      </div>
    </div>
  );
}

function PasswordEditor({ userId, onClose }: {
  userId: string;
  onClose: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setError('');
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('请填写所有字段');
      return;
    }
    if (newPassword.length < 6) {
      setError('新密码至少6位');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/user/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        onClose();
      } else {
        setError(data.error || '修改失败');
      }
    } catch {
      setError('修改失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="rounded-2xl p-6 w-full max-w-sm mx-4"
        style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Lock className="w-4 h-4" />
            修改密码
          </h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs opacity-60 mb-1 block">当前密码</label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="输入当前密码..."
                className="w-full px-3 py-2 pr-9 rounded-xl text-sm outline-none"
                style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-70"
              >
                {showCurrent ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs opacity-60 mb-1 block">新密码</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="至少6位..."
                className="w-full px-3 py-2 pr-9 rounded-xl text-sm outline-none"
                style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-70"
              >
                {showNew ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs opacity-60 mb-1 block">确认新密码</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="再次输入新密码..."
              className="w-full px-3 py-2 rounded-xl text-sm outline-none"
              style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          </div>
        </div>

        {error && (
          <p className="text-xs mt-3" style={{ color: '#ef4444' }}>{error}</p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full mt-4 px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 text-white"
          style={{ background: 'linear-gradient(135deg, #ff7a00, #ff5500)' }}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : '确认修改'}
        </button>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { currentUser, playlists, setCurrentUser } = usePlayer();
  const [favoritedPlaylistIds, setFavoritedPlaylistIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAvatarEditor, setShowAvatarEditor] = useState(false);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [showPasswordEditor, setShowPasswordEditor] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      setIsLoading(false);
      return;
    }
    const load = async () => {
      try {
        const ids = await musicService.getUserFavoritePlaylistIds(currentUser.id);
        setFavoritedPlaylistIds(ids);
      } catch (e) {
        console.error('获取收藏歌单失败:', e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [currentUser]);

  const handleAvatarSave = async (url: string) => {
    if (!currentUser) return;

    try {
      const res = await fetch('/api/user/avatar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, avatarUrl: url }),
      });

      if (res.ok) {
        setCurrentUser({ ...currentUser, avatar: url });
        setShowAvatarEditor(false);
      } else {
        const data = await res.json();
        alert(data.error || '保存失败');
      }
    } catch (err) {
      console.error('保存头像失败:', err);
      alert('保存失败');
    }
  };

  const handleProfileSave = async (data: { username: string; email: string }) => {
    if (!currentUser) return;

    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, username: data.username, email: data.email }),
      });

      if (res.ok) {
        setCurrentUser({ ...currentUser, username: data.username, email: data.email });
        setShowProfileEditor(false);
      } else {
        const result = await res.json();
        alert(result.error || '保存失败');
      }
    } catch (err) {
      console.error('保存资料失败:', err);
      alert('保存失败');
    }
  };

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
          style={{ background: 'rgba(255,255,255,0.08)' }}
        >
          <User className="w-10 h-10 opacity-40" />
        </div>
        <h2 className="text-xl font-bold mb-2">请先登录</h2>
        <p className="text-sm opacity-50 mb-6">登录后即可查看个人中心和收藏的歌单</p>
        <button
          onClick={() => router.push('/login')}
          className="flex items-center gap-2 px-6 py-2.5 rounded-full text-white font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #ff7a00, #ff5500)' }}
        >
          <LogIn className="w-4 h-4" />
          去登录
        </button>
      </div>
    );
  }

  const createdPlaylists = playlists;
  const favoritedPlaylists = playlists.filter((p) => favoritedPlaylistIds.includes(p.id));
  const totalTracks = createdPlaylists.reduce((sum, p) => sum + (p.trackCount || 0), 0);

  return (
    <div className="max-w-5xl mx-auto">
      {/* 用户头像和名称 */}
      <div className="flex items-center gap-5 mb-8">
        <div className="relative group">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-3xl text-white font-bold shadow-lg shadow-orange-500/20">
            {currentUser.avatar ? (
              <img src={currentUser.avatar} alt={currentUser.username} className="w-full h-full object-cover" />
            ) : (
              currentUser.username.charAt(0).toUpperCase()
            )}
          </div>
          <button
            onClick={() => setShowAvatarEditor(true)}
            className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center transition-all hover:scale-110"
            style={{ backgroundColor: '#ff7a00', color: 'white' }}
            title="修改头像"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{currentUser.username}</h1>
            <button
              onClick={() => setShowProfileEditor(true)}
              className="p-1.5 rounded-full transition-all hover:scale-110"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
              title="编辑资料"
            >
              <Pencil className="w-3.5 h-3.5 opacity-50" />
            </button>
          </div>
          {currentUser.email && (
            <p className="text-sm opacity-50 mt-0.5 flex items-center gap-1">
              <Mail className="w-3 h-3" />
              {currentUser.email}
            </p>
          )}
          <button
            onClick={() => setShowPasswordEditor(true)}
            className="mt-2 flex items-center gap-1.5 text-xs opacity-50 hover:opacity-80 transition-opacity"
          >
            <Lock className="w-3 h-3" />
            修改密码
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      <button
        onClick={() => router.push('/home/stats')}
        className="w-full rounded-2xl p-5 mb-8 text-left transition-all hover:scale-[1.005] active:scale-[0.995]"
        style={{
          background: 'linear-gradient(135deg, rgba(249,115,22,0.1), rgba(249,115,22,0.03))',
          border: '1px solid rgba(249,115,22,0.15)',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-orange-500" />
            听歌统计
          </h3>
          <ExternalLink className="w-3.5 h-3.5 opacity-40" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { value: totalTracks, label: '歌曲总数' },
            { value: createdPlaylists.length, label: '创建歌单' },
            { value: favoritedPlaylists.length, label: '收藏歌单' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs opacity-50 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </button>

      {/* 创建的歌单 */}
      <section className="mb-8">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Music className="w-4 h-4" />
          创建的歌单
        </h2>
        {createdPlaylists.length === 0 ? (
          <p className="text-sm opacity-40 py-8 text-center">还没有创建歌单</p>
        ) : (
          <PlaylistGrid playlists={createdPlaylists} emptyText="还没有创建歌单" />
        )}
      </section>

      {/* 收藏的歌单 */}
      <section>
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Heart className="w-4 h-4" />
          收藏的歌单
        </h2>
        {isLoading ? (
          <p className="text-sm opacity-40 py-8 text-center">加载中...</p>
        ) : favoritedPlaylists.length === 0 ? (
          <p className="text-sm opacity-40 py-8 text-center">还没有收藏歌单</p>
        ) : (
          <PlaylistGrid playlists={favoritedPlaylists} emptyText="还没有收藏歌单" />
        )}
      </section>

      {/* 头像编辑器 */}
      {showAvatarEditor && (
        <AvatarEditor
          currentUser={currentUser}
          currentAvatar={currentUser.avatar || ''}
          onSave={handleAvatarSave}
          onClose={() => setShowAvatarEditor(false)}
        />
      )}

      {showProfileEditor && (
        <ProfileEditor
          currentUser={currentUser}
          onSave={handleProfileSave}
          onClose={() => setShowProfileEditor(false)}
        />
      )}

      {showPasswordEditor && (
        <PasswordEditor
          userId={currentUser.id}
          onClose={() => setShowPasswordEditor(false)}
        />
      )}
    </div>
  );
}
