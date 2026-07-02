'use client';

import { useState, useCallback, useEffect } from 'react';
import type {
  Comment,
  CommentsResponse,
  CreateCommentRequest,
  CreateCommentResponse,
  DeleteCommentResponse,
  CommentTargetType,
  CurrentUser
} from '@/types/comment';

interface UseCommentsOptions {
  targetType: CommentTargetType;
  targetId: number | string;
  currentUser: CurrentUser | null;
  initialPage?: number;
  limit?: number;
}

interface UseCommentsReturn {
  comments: Comment[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  createComment: (content: string, parentId?: number | string) => Promise<boolean>;
  deleteComment: (commentId: number | string) => Promise<boolean>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * 评论系统自定义 Hook
 * 提供评论的获取、创建、删除功能，支持乐观更新
 */
export function useComments({
  targetType,
  targetId,
  currentUser,
  initialPage = 1,
  limit = 10
}: UseCommentsOptions): UseCommentsReturn {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(initialPage);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  /**
   * 获取评论列表
   */
  const fetchComments = useCallback(async (pageNum: number, isLoadMore: boolean = false) => {
    if (isLoadMore) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const response = await fetch(
        `/api/comments?target_type=${targetType}&target_id=${targetId}&page=${pageNum}&limit=${limit}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '获取评论失败');
      }

      const result: CommentsResponse = await response.json();

      if (isLoadMore) {
        setComments(prev => [...prev, ...result.data]);
      } else {
        setComments(result.data);
      }

      setTotal(result.pagination.total);
      setTotalPages(result.pagination.totalPages);
      setPage(pageNum);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取评论失败';
      setError(errorMessage);
      console.error('[useComments] Fetch error:', err);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [targetType, targetId, limit]);

  /**
   * 初始加载
   */
  useEffect(() => {
    if (targetId) {
      fetchComments(initialPage, false);
    }
  }, [targetId, targetType, fetchComments, initialPage]);

  /**
   * 创建评论（支持乐观更新）
   */
  const createComment = useCallback(async (content: string, parentId?: number | string): Promise<boolean> => {
    if (!currentUser) {
      setError('请先登录');
      return false;
    }

    if (!content.trim()) {
      setError('评论内容不能为空');
      return false;
    }

    // 乐观更新：立即添加临时评论到列表
    const tempComment: Comment = {
      id: Date.now(), // 临时 ID
      content: content.trim(),
      userId: currentUser.id,
      username: currentUser.username,
      avatarUrl: currentUser.avatar,
      targetType,
      targetId,
      parentId: parentId || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDeleted: false,
      replies: []
    };

    // 如果是回复，找到父评论并添加回复
    if (parentId) {
      setComments(prev => {
        const addReplyToComment = (comments: Comment[]): Comment[] => {
          return comments.map(comment => {
            if (comment.id === parentId) {
              return {
                ...comment,
                replies: [...(comment.replies || []), tempComment]
              };
            }
            if (comment.replies && comment.replies.length > 0) {
              return {
                ...comment,
                replies: addReplyToComment(comment.replies)
              };
            }
            return comment;
          });
        };
        return addReplyToComment(prev);
      });
    } else {
      // 根评论，添加到列表开头
      setComments(prev => [tempComment, ...prev]);
    }

    try {
      const requestBody: CreateCommentRequest = {
        content: content.trim(),
        target_type: targetType,
        target_id: targetId,
        parent_id: parentId
      };

      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
          'x-username': currentUser.username
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '创建评论失败');
      }

      const result: CreateCommentResponse = await response.json();

      // 用真实数据替换临时评论；若服务端未回传 avatarUrl，保留临时评论的（前端头像不丢失）
      setComments(prev => {
        const replaceTempComment = (comments: Comment[]): Comment[] => {
          return comments.map(comment => {
            if (comment.id === tempComment.id) {
              return {
                ...result.comment,
                avatarUrl: result.comment.avatarUrl || tempComment.avatarUrl
              };
            }
            if (comment.replies && comment.replies.length > 0) {
              return {
                ...comment,
                replies: replaceTempComment(comment.replies)
              };
            }
            return comment;
          });
        };
        return replaceTempComment(prev);
      });

      setError(null);
      return true;
    } catch (err) {
      // 乐观更新失败，移除临时评论
      setComments(prev => {
        const removeTempComment = (comments: Comment[]): Comment[] => {
          return comments
            .filter(comment => comment.id !== tempComment.id)
            .map(comment => {
              if (comment.replies && comment.replies.length > 0) {
                return {
                  ...comment,
                  replies: removeTempComment(comment.replies)
                };
              }
              return comment;
            });
        };
        return removeTempComment(prev);
      });

      const errorMessage = err instanceof Error ? err.message : '创建评论失败';
      setError(errorMessage);
      console.error('[useComments] Create error:', err);
      return false;
    }
  }, [currentUser, targetType, targetId]);

  /**
   * 删除评论（支持乐观更新）
   */
  const deleteComment = useCallback(async (commentId: number | string): Promise<boolean> => {
    if (!currentUser) {
      setError('请先登录');
      return false;
    }

    // 乐观更新：立即标记为已删除
    const originalComments = [...comments];
    
    setComments(prev => {
      const markAsDeleted = (comments: Comment[]): Comment[] => {
        return comments.map(comment => {
          if (comment.id === commentId) {
            return { ...comment, isDeleted: true };
          }
          if (comment.replies && comment.replies.length > 0) {
            return {
              ...comment,
              replies: markAsDeleted(comment.replies)
            };
          }
          return comment;
        });
      };
      return markAsDeleted(prev);
    });

    try {
      const response = await fetch(`/api/comments?id=${commentId}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': currentUser.id,
          'x-username': currentUser.username
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '删除评论失败');
      }

      const result: DeleteCommentResponse = await response.json();

      // 从列表中移除已删除的评论
      setComments(prev => {
        const removeDeleted = (comments: Comment[]): Comment[] => {
          return comments
            .filter(comment => comment.id !== commentId)
            .map(comment => {
              if (comment.replies && comment.replies.length > 0) {
                return {
                  ...comment,
                  replies: removeDeleted(comment.replies)
                };
              }
              return comment;
            });
        };
        return removeDeleted(prev);
      });

      setTotal(prev => Math.max(0, prev - 1));
      setError(null);
      return true;
    } catch (err) {
      // 乐观更新失败，恢复原始状态
      setComments(originalComments);

      const errorMessage = err instanceof Error ? err.message : '删除评论失败';
      setError(errorMessage);
      console.error('[useComments] Delete error:', err);
      return false;
    }
  }, [currentUser, comments]);

  /**
   * 加载更多评论
   */
  const loadMore = useCallback(async () => {
    if (page >= totalPages || isLoadingMore) return;
    await fetchComments(page + 1, true);
  }, [page, totalPages, isLoadingMore, fetchComments]);

  /**
   * 刷新评论列表
   */
  const refresh = useCallback(async () => {
    await fetchComments(1, false);
  }, [fetchComments]);

  return {
    comments,
    isLoading,
    isLoadingMore,
    error,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages
    },
    createComment,
    deleteComment,
    loadMore,
    refresh
  };
}
