'use client';

import { useState } from 'react';
import { MessageCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Comment, CurrentUser } from '@/types/comment';

interface CommentItemProps {
  comment: Comment;
  currentUser: CurrentUser | null;
  onReply: (parentId: number | string, username: string) => void;
  onDelete: (commentId: number | string) => void;
  depth?: number;
}

/**
 * 格式化时间显示
 */
function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 30) return `${diffDays}天前`;
  
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

/**
 * 获取用户名首字母作为头像
 */
function getAvatarLetter(username: string): string {
  return username.charAt(0).toUpperCase();
}

/**
 * 生成头像背景色
 */
function getAvatarColor(username: string): string {
  const colors = [
    'bg-orange-500',
    'bg-amber-500',
    'bg-yellow-500',
    'bg-lime-500',
    'bg-emerald-500',
    'bg-teal-500',
    'bg-cyan-500',
    'bg-sky-500',
    'bg-blue-500',
    'bg-indigo-500',
    'bg-violet-500',
    'bg-purple-500',
    'bg-fuchsia-500',
    'bg-pink-500',
    'bg-rose-500'
  ];
  
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}

export function CommentItem({
  comment,
  currentUser,
  onReply,
  onDelete,
  depth = 0
}: CommentItemProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const isAuthor = currentUser?.id === comment.userId;
  const isAdmin = currentUser?.id === 'admin'; // 简化判断，实际应根据角色判断
  const canDelete = isAuthor || isAdmin;

  const handleDelete = async () => {
    if (!confirm('确定要删除这条评论吗？')) return;
    
    setIsDeleting(true);
    try {
      await onDelete(comment.id);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReply = () => {
    onReply(comment.id, comment.username);
  };

  return (
    <div 
      className={`${depth > 0 ? 'ml-12 mt-3' : 'py-4'} ${depth === 0 ? 'border-b' : ''}`}
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="flex gap-3">
        {/* 头像：优先显示用户头像图片，否则显示首字母 */}
        {comment.avatarUrl ? (
          <img
            src={comment.avatarUrl}
            alt={comment.username}
            className="w-10 h-10 rounded-full object-cover flex-shrink-0 bg-black/5"
            onError={(e) => {
              // 图片加载失败时，替换为首字母
              const target = e.currentTarget;
              target.style.display = 'none';
              const fallback = target.nextElementSibling as HTMLElement | null;
              if (fallback) fallback.style.display = 'flex';
            }}
          />
        ) : null}
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm flex-shrink-0 ${getAvatarColor(comment.username)} ${comment.avatarUrl ? 'hidden' : ''}`}
          style={{ display: comment.avatarUrl ? 'none' : 'flex' }}
        >
          {getAvatarLetter(comment.username)}
        </div>

        {/* 内容区域 */}
        <div className="flex-1 min-w-0">
          {/* 头部：用户名和时间 */}
          <div className="flex items-center gap-2 mb-1">
            <span 
              className="font-medium text-sm"
              style={{ color: 'var(--foreground)' }}
            >
              {comment.username}
            </span>
            <span 
              className="text-xs"
              style={{ color: 'var(--muted-foreground)' }}
            >
              {formatTimeAgo(comment.createdAt)}
            </span>
          </div>

          {/* 评论内容 */}
          <p 
            className="text-sm leading-relaxed break-words"
            style={{ color: 'var(--foreground)' }}
          >
            {comment.content}
          </p>

          {/* 操作按钮 */}
          <div className="flex items-center gap-4 mt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReply}
              className="h-auto py-1 px-2 text-xs"
              style={{ color: 'var(--muted-foreground)' }}
            >
              <MessageCircle className="w-3 h-3 mr-1" />
              回复
            </Button>

            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting}
                className="h-auto py-1 px-2 text-xs"
                style={{ color: 'var(--muted-foreground)' }}
              >
                <Trash2 className="w-3 h-3 mr-1" />
                {isDeleting ? '删除中...' : '删除'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 嵌套回复 */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-3">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              currentUser={currentUser}
              onReply={onReply}
              onDelete={onDelete}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
