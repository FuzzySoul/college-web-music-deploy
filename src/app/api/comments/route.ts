import { NextRequest, NextResponse } from 'next/server';
import { cacheFetch, cacheInvalidate } from '@/lib/cache-fetch';
import { SERVER_CACHE_API_URL } from '@/lib/server-env';
import { getServiceSupabaseOrThrow } from '@/lib/supabase-service';

function getSupabase() {
  return getServiceSupabaseOrThrow();
}

// 评论类型定义
interface Comment {
  id: number;
  content: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  targetType: string;
  targetId: number | string;
  parentId: number | string | null;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
  replies?: Comment[];
}

// 从请求头获取用户信息
function getUserFromRequest(request: NextRequest): { userId: string; username: string; isAdmin: boolean } | null {
  // 从自定义请求头获取用户信息（由前端 middleware 或客户端设置）
  const userId = request.headers.get('x-user-id');
  const username = request.headers.get('x-username');
  const isAdmin = request.headers.get('x-is-admin') === 'true';

  if (!userId || !username) {
    return null;
  }

  return { userId, username, isAdmin };
}

function mapCommentFields(data: any): Comment {
  return {
    id: data.id,
    content: data.content,
    userId: data.user_id,
    username: data.username,
    avatarUrl: data.avatar_url || undefined,
    targetType: data.target_type,
    targetId: data.target_id,
    parentId: data.parent_id,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    isDeleted: data.is_deleted,
    replies: data.replies?.map(mapCommentFields)
  };
}

function buildCommentTree(comments: Comment[]): Comment[] {
  const commentMap = new Map<number | string, Comment>();
  const rootComments: Comment[] = [];

  // 首先将所有评论放入 map
  comments.forEach(comment => {
    commentMap.set(comment.id, { ...comment, replies: [] });
  });

  // 构建树结构
  comments.forEach(comment => {
    const commentWithReplies = commentMap.get(comment.id)!;
    if (comment.parentId && commentMap.has(comment.parentId)) {
      const parent = commentMap.get(comment.parentId)!;
      if (!parent.replies) parent.replies = [];
      parent.replies.push(commentWithReplies);
    } else {
      rootComments.push(commentWithReplies);
    }
  });

  return rootComments;
}

/**
 * GET - 获取评论列表
 * 查询参数:
 * - target_type: 目标类型 (必需)
 * - target_id: 目标ID (必需)
 * - page: 页码 (默认 1)
 * - limit: 每页数量 (默认 10)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetType = searchParams.get('target_type');
    const targetId = searchParams.get('target_id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    // 验证必需参数
    if (!targetType || !targetId) {
      return NextResponse.json(
        { error: '缺少必需参数: target_type 和 target_id' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase 未配置' },
        { status: 500 }
      );
    }

    const cached = await cacheFetch<Comment[]>('/api/cache/comments', { target_type: targetType, target_id: targetId });
    let comments: Comment[];
    let count: number | null;

    if (cached) {
      comments = cached.map(mapCommentFields);
      count = cached.length;
    } else {
      const { data, error, count: dbCount } = await supabase
        .from('comments')
        .select('*', { count: 'exact' })
        .eq('target_type', targetType)
        .eq('target_id', targetId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[Comments API] Query error:', error);
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }

      comments = (data || []).map(mapCommentFields);
      count = dbCount || 0;

      // 批量查询评论用户的头像
      const userIds = Array.from(new Set(comments.map((c) => c.userId).filter(Boolean)));
      if (userIds.length > 0) {
        const { data: usersData } = await supabase
          .from('users')
          .select('id, avatar_url')
          .in('id', userIds);

        const avatarMap = new Map<string, string>();
        ((usersData || []) as { id: string; avatar_url: string | null }[]).forEach((u) => {
          if (u.avatar_url) avatarMap.set(u.id, u.avatar_url);
        });

        comments = comments.map((c) => ({
          ...c,
          avatarUrl: avatarMap.get(c.userId) || c.avatarUrl
        }));
      }
    }

    const commentTree = buildCommentTree(comments);

    const from = (page - 1) * limit;
    const to = from + limit;
    const paginatedTree = commentTree.slice(from, to);

    return NextResponse.json({
      data: paginatedTree,
      pagination: {
        page,
        limit,
        total: commentTree.length,
        totalPages: Math.ceil(commentTree.length / limit),
        totalComments: count
      }
    });

  } catch (error) {
    console.error('[Comments API] GET error:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}

/**
 * POST - 创建评论
 * 请求体:
 * - content: 评论内容 (必需)
 * - target_type: 目标类型 (必需)
 * - target_id: 目标ID (必需)
 * - parent_id: 父评论ID (可选，用于回复)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, target_type, target_id, parent_id } = body;

    // 验证必填字段
    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: '评论内容不能为空' },
        { status: 400 }
      );
    }

    if (!target_type || !target_type.trim()) {
      return NextResponse.json(
        { error: 'target_type 不能为空' },
        { status: 400 }
      );
    }

    if (!target_id || target_id.toString().trim() === '') {
      return NextResponse.json(
        { error: 'target_id 不能为空' },
        { status: 400 }
      );
    }

    // 获取当前用户信息
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: '未登录或用户信息无效' },
        { status: 401 }
      );
    }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase 未配置' },
        { status: 500 }
      );
    }

    // 违禁词检测（容错：FastAPI 不可用时降级到直接查 Supabase）
    let forbiddenWords: string[] = [];
    try {
      const forbiddenRes = await fetch(`${SERVER_CACHE_API_URL}/api/cache/forbidden-words`, {
        // 设置短超时，避免 FastAPI 不可用时阻塞请求
        signal: AbortSignal.timeout(1500)
      });
      if (forbiddenRes.ok) {
        const data = await forbiddenRes.json();
        forbiddenWords = Array.isArray(data) ? data : data?.words || [];
      }
    } catch (e) {
      console.warn('[Comments API] 违禁词缓存不可用，降级查 Supabase:', e instanceof Error ? e.message : e);
    }
    if (forbiddenWords.length === 0) {
      try {
        const { data: words } = await supabase.from('forbidden_words').select('word');
        forbiddenWords = ((words || []) as { word: string }[]).map((w) => w.word);
      } catch (e) {
        console.warn('[Comments API] 违禁词表查询失败，跳过检测:', e instanceof Error ? e.message : e);
        // 不阻断评论提交
      }
    }

    if (forbiddenWords.length > 0) {
      const lowerContent = content.toLowerCase();
      for (const word of forbiddenWords) {
        if (lowerContent.includes(word.toLowerCase())) {
          return NextResponse.json(
            { error: '评论内容包含违禁词' },
            { status: 400 }
          );
        }
      }
    }

    // 如果指定了 parent_id，验证父评论是否存在
    if (parent_id) {
      const { data: parentComment, error: parentError } = await supabase
        .from('comments')
        .select('id')
        .eq('id', parent_id)
        .eq('is_deleted', false)
        .single();

      if (parentError || !parentComment) {
        return NextResponse.json(
          { error: '父评论不存在或已被删除' },
          { status: 400 }
        );
      }
    }

    // 插入评论
    const { data, error } = await supabase
      .from('comments')
      .insert({
        content: content.trim(),
        user_id: user.userId,
        username: user.username,
        target_type: target_type,
        target_id: target_id.toString(),
        parent_id: parent_id ? parent_id.toString() : null,
        is_deleted: false
      })
      .select()
      .single();

    if (error) {
      console.error('[Comments API] Insert error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    // 顺便查出当前用户的头像 URL（与 GET 行为保持一致，前端刷新列表时头像不丢）
    const { data: userData } = await supabase
      .from('users')
      .select('avatar_url')
      .eq('id', user.userId)
      .single();
    const avatarUrl = (userData as { avatar_url?: string | null } | null)?.avatar_url || undefined;

    await cacheInvalidate(['comments']);
    return NextResponse.json({
      success: true,
      comment: { ...mapCommentFields(data), avatarUrl }
    });

  } catch (error) {
    console.error('[Comments API] POST error:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - 软删除评论
 * 查询参数:
 * - id: 评论ID (必需)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { error: '缺少有效的评论 ID' },
        { status: 400 }
      );
    }

    // 获取当前用户信息
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: '未登录或用户信息无效' },
        { status: 401 }
      );
    }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase 未配置' },
        { status: 500 }
      );
    }

    // 查询评论信息
    const { data: comment, error: fetchError } = await supabase
      .from('comments')
      .select('id, user_id, is_deleted')
      .eq('id', parseInt(id))
      .single();

    if (fetchError || !comment) {
      return NextResponse.json(
        { error: '评论不存在' },
        { status: 404 }
      );
    }

    // 检查是否已删除
    if (comment.is_deleted) {
      return NextResponse.json(
        { error: '评论已被删除' },
        { status: 400 }
      );
    }

    // 验证权限：只有评论作者或管理员可以删除
    if (comment.user_id !== user.userId && !user.isAdmin) {
      return NextResponse.json(
        { error: '无权删除此评论' },
        { status: 403 }
      );
    }

    // 软删除评论
    const { data, error } = await supabase
      .from('comments')
      .update({
        is_deleted: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', parseInt(id))
      .select()
      .single();

    if (error) {
      console.error('[Comments API] Delete error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    await cacheInvalidate(['comments']);
    return NextResponse.json({
      success: true,
      message: '评论已删除',
      comment: mapCommentFields(data)
    });

  } catch (error) {
    console.error('[Comments API] DELETE error:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
