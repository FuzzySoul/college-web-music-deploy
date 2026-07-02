'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Search, Trash2, Loader2, Filter } from 'lucide-react';

interface Comment {
  id: number;
  content: string;
  userId: string;
  username: string;
  targetType: 'track' | 'playlist';
  targetId: number;
  parentId: number | null;
  createdAt: string;
  isDeleted: boolean;
}

export default function CommentsAdminPage() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const loadComments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ table: 'comments', search, page: '1', limit: '50' });
      const res = await fetch(`/api/admin?${params}`);
      const result = await res.json();
      if (result.data) setComments(result.data);
    } catch (error) {
      console.error('加载评论失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComments();
  }, [search, typeFilter]);

  const handleDelete = async (id: number) => {
    const target = comments.find(c => c.id === id);
    if (!target) return;
    const previous = [...comments];
    setComments(prev => prev.filter(c => c.id !== id));
    try {
      const res = await fetch(`/api/admin?table=comments&id=${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (!result.success) {
        setComments(previous);
        alert(result.error || '删除失败');
      }
    } catch (error) {
      setComments(previous);
      alert('删除失败');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredComments = comments.filter(comment => {
    const matchType = typeFilter === 'all' || comment.targetType === typeFilter;
    return matchType;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>评论管理</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>查看、过滤和管理所有评论</p>
        <div className="mt-4" style={{ height: '1px', background: 'rgba(255,255,255,0.08)' }} />
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
          <Input
            placeholder="搜索评论内容或作者..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)', color: 'var(--foreground)' }}
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)', color: 'var(--foreground)', width: '160px' }}>
            <Filter className="w-4 h-4 mr-2" style={{ color: 'var(--muted-foreground)' }} />
            <SelectValue placeholder="类型过滤" />
          </SelectTrigger>
          <SelectContent style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
            <SelectItem value="all" style={{ color: 'var(--foreground)' }}>全部类型</SelectItem>
            <SelectItem value="track" style={{ color: 'var(--foreground)' }}>歌曲 (track)</SelectItem>
            <SelectItem value="playlist" style={{ color: 'var(--foreground)' }}>歌单 (playlist)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--muted-foreground)' }} />
        </div>
      ) : filteredComments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <MessageSquare className="w-12 h-12 mb-3" style={{ color: 'var(--muted-foreground)' }} />
          <p style={{ color: 'var(--muted-foreground)' }}>暂无评论数据</p>
        </div>
      ) : (
        <div className="overflow-hidden">
          <div
            className="grid grid-cols-[40px_1fr_100px_100px_120px_80px] gap-4 px-4 py-3 text-xs font-medium uppercase tracking-wider"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <div className="text-center">#</div>
            <div>内容</div>
            <div>用户</div>
            <div>类型</div>
            <div>状态</div>
            <div className="text-center">时间</div>
          </div>

          <div className="pb-4">
            {filteredComments.map((comment, index) => (
              <motion.div
                key={comment.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.02 }}
                className="group grid grid-cols-[40px_1fr_100px_100px_120px_80px] gap-4 px-4 py-3 items-center transition-all duration-300 ease-out hover:bg-white/[0.06] dark:hover:bg-white/[0.04]"
              >
                <div className="flex items-center justify-center">
                  <span className="text-sm tabular-nums" style={{ color: 'var(--muted-foreground)' }}>{index + 1}</span>
                </div>

                <div className="min-w-0">
                  <p className="text-sm truncate" style={{ color: 'var(--foreground)' }}>{comment.content}</p>
                </div>

                <div className="min-w-0">
                  <span className="text-sm truncate" style={{ color: 'var(--muted-foreground)' }}>{comment.username}</span>
                </div>

                <div>
                  <Badge
                    style={{
                      backgroundColor: comment.targetType === 'track' ? 'rgba(193,95,60,0.12)' : 'rgba(163,191,250,0.12)',
                      color: comment.targetType === 'track' ? 'var(--primary)' : '#a3bffa',
                      border: 'none',
                    }}
                  >
                    {comment.targetType === 'track' ? '歌曲' : '歌单'}
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  <Badge
                    style={{
                      backgroundColor: comment.isDeleted ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
                      color: comment.isDeleted ? '#ef4444' : '#22c55e',
                      border: 'none',
                    }}
                  >
                    {comment.isDeleted ? '已删除' : '正常'}
                  </Badge>
                  {!comment.isDeleted && (
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleDelete(comment.id)}
                      className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-[rgba(239,68,68,0.1)]"
                      style={{ color: 'var(--muted-foreground)' }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </motion.button>
                  )}
                </div>

                <div className="text-center">
                  <span className="text-xs tabular-nums" style={{ color: 'var(--muted-foreground)' }}>{formatDate(comment.createdAt)}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
