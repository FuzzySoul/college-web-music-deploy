import { NextResponse } from 'next/server';
import { cacheInvalidate } from '@/lib/cache-fetch';
import { getServiceSupabaseOrThrow } from '@/lib/supabase-service';

/**
 * 歌单 CRUD API 路由
 * 支持 POST(创建)、PUT(编辑)、DELETE(删除) 操作
 */

// Supabase Admin 客户端初始化
async function getSupabaseAdmin() {
  return getServiceSupabaseOrThrow();
}

// ==================== POST: 创建歌单（支持本地歌单 & 自建爬虫歌单） ====================
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, cover, user_id, source } = body;

    // 验证必填字段
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json(
        { error: '歌单名称不能为空' },
        { status: 400 }
      );
    }

    // 验证名称长度
    if (name.length > 100) {
      return NextResponse.json(
        { error: '歌单名称不能超过100个字符' },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseAdmin();

    // ===== 自建爬虫歌单：存入 external_playlists =====
    if (source === 'custom') {
      const { data: playlist, error } = await supabase
        .from('external_playlists')
        .insert({
          name: name.trim(),
          cover_url: cover || null,
          user_id: user_id || null,
          source: 'custom',
          platform_id: null,
          track_count: 0,
        })
        .select()
        .single();

      if (error) {
        console.error('创建自建爬虫歌单失败:', error);
        return NextResponse.json(
          { error: '创建自建爬虫歌单失败: ' + error.message },
          { status: 500 }
        );
      }

      console.log('✅ 自建爬虫歌单创建成功:', playlist.id);

      cacheInvalidate(['playlists', 'admin:playlists', 'home', 'admin:stats']);

      return NextResponse.json({
        success: true,
        data: playlist,
        message: '自建爬虫歌单创建成功',
      }, { status: 201 });
    }

    // ===== 本地歌单：存入 playlists =====
    const { data: playlist, error } = await supabase
      .from('playlists')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        cover: cover || null,
        user_id: user_id || null,
        platform_source: 'local',
        is_public: true,
      })
      .select()
      .single();

    if (error) {
      console.error('创建歌单失败:', error);
      return NextResponse.json(
        { error: '创建歌单失败: ' + error.message },
        { status: 500 }
      );
    }

    console.log('✅ 歌单创建成功:', playlist.id);

    cacheInvalidate(['playlists', 'admin:playlists', 'home', 'admin:stats']);

    return NextResponse.json({
      success: true,
      data: playlist,
      message: '歌单创建成功',
    }, { status: 201 });

  } catch (error) {
    console.error('创建歌单异常:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}

// ==================== PUT: 编辑歌单 ====================
export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const source = searchParams.get('source') || 'local';

    // 验证歌单ID
    if (!id) {
      return NextResponse.json(
        { error: '缺少歌单ID参数' },
        { status: 400 }
      );
    }

    // 🔧 关键修复：提前解析请求体（必须在 source=external 分支之前）
    const body = await request.json();
    const { name, description, cover } = body;

    // 对于外部歌单（平台同步 & 自建爬虫），需要先通过 external_playlist_id 找到 playlists 表中的记录
    let targetPlaylistId = id;
    if (source === 'external' || source === 'custom') {
      const supabase = await getSupabaseAdmin();

      // ===== 第一步：确认 external_playlists 记录存在 =====
      const { data: extPl, error: extError } = await supabase
        .from('external_playlists')
        .select('*')
        .eq('id', id)
        .single();

      if (extError || !extPl) {
        return NextResponse.json(
          { error: '未找到该外部歌单: ' + (extError?.message || 'not found') },
          { status: 404 }
        );
      }

      console.log('[PUT] Found external playlist:', extPl.id, extPl.name);

      // ===== 第二步：构建主表更新数据 =====
      const extUpdateData: Record<string, any> = {};
      if (name !== undefined) extUpdateData.name = name.trim();
      if (cover !== undefined) extUpdateData.cover_url = cover || null;

      // ===== 第三步：更新 external_playlists 主表（关键修复！）=====
      if (Object.keys(extUpdateData).length > 0) {
        const { error: extUpdateError } = await supabase
          .from('external_playlists')
          .update(extUpdateData)
          .eq('id', id);

        if (extUpdateError) {
          console.error('[PUT] Failed to update external_playlists:', extUpdateError);
          return NextResponse.json(
            { error: '更新外部歌单失败: ' + extUpdateError.message },
            { status: 500 }
          );
        }
        console.log('[PUT] ✅ Updated external_playlists table successfully');
      }

      // ===== 第四步：同步更新 playlists 引用表 =====
      let targetPlaylistId: string | null = null;

      // 查找已有的关联记录
      const { data: linkedPl } = await supabase
        .from('playlists')
        .select('id')
        .eq('external_playlist_id', id)
        .maybeSingle();

      if (linkedPl) {
        targetPlaylistId = linkedPl.id;

        // 更新引用记录保持同步
        const refUpdateData: Record<string, any> = { updated_at: new Date().toISOString() };
        if (name !== undefined) refUpdateData.name = name.trim();
        if (cover !== undefined) refUpdateData.cover = cover || null;

        const { error: refError } = await supabase
          .from('playlists')
          .update(refUpdateData)
          .eq('id', targetPlaylistId);

        if (refError) {
          console.warn('[PUT] Warning: failed to sync playlists reference:', refError.message);
          // 不阻断，主表已更新成功
        } else {
          console.log('[PUT] ✅ Synced playlists reference:', targetPlaylistId);
        }
      }

      // ===== 第五步：返回合并后的完整数据 =====
      // 重新查询获取最新数据用于返回
      const { data: updatedExt, error: fetchError } = await supabase
        .from('external_playlists')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !updatedExt) {
        // 查询失败但更新已成功，返回基本确认
        return NextResponse.json({
          success: true,
          data: { ...extPl, ...extUpdateData }, // 使用内存中的数据
          message: '外部歌单更新成功',
        });
      }

      console.log('[PUT] ✅ External playlist edit complete:', updatedExt.name);

      cacheInvalidate(['playlists', 'admin:playlists', 'home']);

      return NextResponse.json({
        success: true,
        data: {
          ...updatedExt,
          // 同时返回引用记录 ID 供前端使用
          _linkedPlaylistId: targetPlaylistId,
        },
        message: '外部歌单更新成功',
      });
    }

    // 验证至少有一个可更新字段（name/cover 已在上方解析）
    if (!name && !description && !cover) {
      return NextResponse.json(
        { error: '至少需要提供一个更新字段 (name, description, cover)' },
        { status: 400 }
      );
    }

    // 如果提供了name，验证长度
    if (name && name.length > 100) {
      return NextResponse.json(
        { error: '歌单名称不能超过100字符' },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseAdmin();

    // 构建更新数据对象
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (cover !== undefined) updateData.cover = cover || null;

    // 使用 targetPlaylistId（已解析的真实 UUID）更新歌单
    const { data: playlist, error } = await supabase
      .from('playlists')
      .update(updateData)
      .eq('id', targetPlaylistId)
      .select()
      .single();

    if (error) {
      console.error('编辑歌单失败:', error);
      return NextResponse.json(
        { error: '编辑歌单失败: ' + error.message },
        { status: 500 }
      );
    }

    if (!playlist) {
      return NextResponse.json(
        { error: '未找到该歌单' },
        { status: 404 }
      );
    }

    console.log('✅ 歌单编辑成功:', playlist.id, '(source:', source, ')');

    cacheInvalidate(['playlists', 'admin:playlists', 'home']);

    return NextResponse.json({
      success: true,
      data: playlist,
      message: '歌单更新成功',
    });

  } catch (error) {
    console.error('编辑歌单异常:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}

// ==================== DELETE: 删除歌单 ====================
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const source = searchParams.get('source') || 'local';

    // 验证歌单ID
    if (!id) {
      return NextResponse.json(
        { error: '缺少歌单ID参数' },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseAdmin();

    // 根据来源类型执行不同的删除逻辑
    if (source === 'external' || source === 'custom') {
      // ========== 删除外部索引歌单（平台同步 & 自建爬虫） ==========
      // 1. 先删除关联的外部歌曲
      const { error: tracksError } = await supabase
        .from('external_playlist_tracks')
        .delete()
        .eq('playlist_id', id);

      if (tracksError) {
        console.error('删除外部歌曲失败:', tracksError);
        return NextResponse.json(
          { error: '删除外部歌曲失败: ' + tracksError.message },
          { status: 500 }
        );
      }

      // 2. 再删除外部歌单
      const { error: playlistError } = await supabase
        .from('external_playlists')
        .delete()
        .eq('id', id);

      if (playlistError) {
        console.error('删除外部歌单失败:', playlistError);
        return NextResponse.json(
          { error: '删除外部歌单失败: ' + playlistError.message },
          { status: 500 }
        );
      }

      console.log('✅ 外部歌单删除成功:', id);

    } else {      // ========== 删除本地歌单 ==========
      // 1. 先删除关联的歌曲
      const { error: tracksError } = await supabase
        .from('playlist_tracks')
        .delete()
        .eq('playlist_id', id);

      if (tracksError) {
        console.error('删除本地歌曲失败:', tracksError);
        return NextResponse.json(
          { error: '删除本地歌曲失败: ' + tracksError.message },
          { status: 500 }
        );
      }

      // 2. 再删除本地歌单
      const { error: playlistError } = await supabase
        .from('playlists')
        .delete()
        .eq('id', id);

      if (playlistError) {
        console.error('删除本地歌单失败:', playlistError);
        return NextResponse.json(
          { error: '删除本地歌单失败: ' + playlistError.message },
          { status: 500 }
        );
      }

      console.log('✅ 本地歌单删除成功:', id);
    }

    cacheInvalidate(['playlists', 'admin:playlists', 'home', 'admin:stats']);

    return NextResponse.json({
      success: true,
      message: source === 'external' ? '外部歌单已删除' : '本地歌单已删除',
    });

  } catch (error) {
    console.error('删除歌单异常:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
