'use client';

import { useState, useRef } from 'react';
import { Send, MessageSquare, Loader2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CommentItem } from './CommentItem';
import { useComments } from '@/hooks/useComments';
import type { CommentTargetType, CurrentUser } from '@/types/comment';

interface CommentSectionProps {
  targetType: CommentTargetType;
  targetId: number | string;
  currentUser: CurrentUser | null;
  title?: string;
}

export function CommentSection({
  targetType,
  targetId,
  currentUser,
  title = '评论'
}: CommentSectionProps) {
  const [content, setContent] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: number | string; username: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    comments,
    isLoading,
    isLoadingMore,
    error,
    pagination,
    createComment,
    deleteComment,
    loadMore,
    refresh
  } = useComments({
    targetType,
    targetId,
    currentUser,
    limit: 10
  });

  const handleSubmit = async () => {
    if (!content.trim()) return;

    const success = await createComment(content, replyTo?.id);
    if (success) {
      setContent('');
      setReplyTo(null);
    }
  };

  const handleReply = (parentId: number | string, username: string) => {
    setReplyTo({ id: parentId, username });
    // 聚焦到输入框
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  const handleCancelReply = () => {
    setReplyTo(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl+Enter 或 Cmd+Enter 提交
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* 标题 */}
      <div className="flex items-center gap-2 pb-2">
        <MessageSquare className="w-5 h-5" style={{ color: 'var(--primary)' }} />
        <span 
          className="text-lg font-medium"
          style={{ color: 'var(--foreground)' }}
        >
          {title}
        </span>
        {pagination.total > 0 && (
          <span 
            className="text-sm font-normal"
            style={{ color: 'var(--muted-foreground)' }}
          >
            ({pagination.total})
          </span>
        )}
      </div>
        {/* 错误提示 */}
        {error && (
          <div 
            className="p-3 rounded-lg text-sm"
            style={{ 
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: 'rgb(239, 68, 68)'
            }}
          >
            {error}
          </div>
        )}

        {/* 评论输入框 */}
        {currentUser ? (
          <div className="space-y-3">
            {/* 回复提示 */}
            {replyTo && (
              <div 
                className="flex items-center justify-between p-2 rounded-lg text-sm"
                style={{ 
                  backgroundColor: 'var(--background)',
                  borderColor: 'var(--border)',
                  borderWidth: '1px'
                }}
              >
                <span style={{ color: 'var(--muted-foreground)' }}>
                  回复 <strong style={{ color: 'var(--foreground)' }}>@{replyTo.username}</strong>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelReply}
                  className="h-auto py-1 px-2"
                >
                  取消
                </Button>
              </div>
            )}

            <div className="flex gap-3">
              {/* 当前用户头像：优先显示头像图片 */}
              {currentUser.avatar ? (
                <img
                  src={currentUser.avatar}
                  alt={currentUser.username}
                  className="w-10 h-10 rounded-full object-cover flex-shrink-0 bg-black/5"
                  onError={(e) => {
                    const target = e.currentTarget;
                    target.style.display = 'none';
                    const fallback = target.nextElementSibling as HTMLElement | null;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
              ) : null}
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm flex-shrink-0"
                style={{
                  backgroundColor: 'var(--primary)',
                  display: currentUser.avatar ? 'none' : 'flex'
                }}
              >
                {currentUser.username.charAt(0).toUpperCase()}
              </div>

              <div className="flex-1 space-y-2">
                <Textarea
                  ref={textareaRef}
                  placeholder={replyTo ? `回复 @${replyTo.username}...` : '写下你的评论...'}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="min-h-[80px] resize-none"
                  style={{ 
                    backgroundColor: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)'
                  }}
                />

                <div className="flex items-center justify-between">
                  <span 
                    className="text-xs"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    按 Ctrl+Enter 快速发送
                  </span>
                  <Button
                    onClick={handleSubmit}
                    disabled={!content.trim()}
                    size="sm"
                    style={{ 
                      backgroundColor: 'var(--primary)',
                      color: 'var(--primary-foreground)'
                    }}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    发布
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div 
            className="p-4 rounded-lg text-center text-sm"
            style={{ 
              backgroundColor: 'var(--background)',
              borderColor: 'var(--border)',
              borderWidth: '1px dashed',
              color: 'var(--muted-foreground)'
            }}
          >
            登录后即可发表评论
          </div>
        )}

        {/* 分隔线 */}
        <div 
          className="h-px w-full"
          style={{ backgroundColor: 'var(--border)' }}
        />

        {/* 评论列表 */}
        <div className="space-y-0">
          {isLoading ? (
            <div className="py-8 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--primary)' }} />
            </div>
          ) : comments.length === 0 ? (
            <div 
              className="py-8 text-center"
              style={{ color: 'var(--muted-foreground)' }}
            >
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">暂无评论，来说点什么吧~</p>
            </div>
          ) : (
            <>
              {comments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  currentUser={currentUser}
                  onReply={handleReply}
                  onDelete={deleteComment}
                />
              ))}

              {/* 加载更多 */}
              {pagination.hasMore && (
                <div className="pt-4 text-center">
                  <Button
                    variant="ghost"
                    onClick={loadMore}
                    disabled={isLoadingMore}
                    className="text-sm"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        加载中...
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4 mr-2" />
                        加载更多评论
                      </>
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
    </div>
  );
}
