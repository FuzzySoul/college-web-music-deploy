/**
 * 评论系统类型定义
 * 用于评论相关的数据结构和 API 请求/响应类型
 */

/**
 * 评论数据结构
 */
export interface Comment {
  id: number;
  content: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  targetType: 'track' | 'playlist';
  targetId: number | string;
  parentId: number | string | null;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
  replies?: Comment[];
}

/**
 * 创建评论请求体
 */
export interface CreateCommentRequest {
  content: string;
  target_type: 'track' | 'playlist';
  target_id: number | string;
  parent_id?: number | string;
}

/**
 * 分页响应数据结构
 */
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  totalComments: number;
}

/**
 * 评论列表响应
 */
export interface CommentsResponse {
  data: Comment[];
  pagination: PaginationInfo;
}

/**
 * 创建评论响应
 */
export interface CreateCommentResponse {
  success: boolean;
  comment: Comment;
}

/**
 * 删除评论响应
 */
export interface DeleteCommentResponse {
  success: boolean;
  message: string;
  comment: Comment;
}

/**
 * 错误响应
 */
export interface CommentErrorResponse {
  error: string;
}

/**
 * 当前用户信息
 */
export interface CurrentUser {
  id: string;
  username: string;
  email?: string;
  avatar?: string;
}

/**
 * 评论目标类型
 */
export type CommentTargetType = 'track' | 'playlist';
