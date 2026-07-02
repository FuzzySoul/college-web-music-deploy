'use strict';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { cacheInvalidate } from '@/lib/cache-fetch';

async function getSupabaseAdmin() {
  const url = process.env.COZE_SUPABASE_URL;
  const key = process.env.COZE_SUPABASE_ANON_KEY;
  const serviceKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  const adminKey = serviceKey || key;
  return createClient(url, adminKey, {
    db: { timeout: 60000 },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm'];
const ALLOWED_EXTENSIONS = ['mp4', 'webm'];
const MAX_MV_SIZE = 100 * 1024 * 1024; // 100MB

function generateFileName(originalName: string): string {
  const ext = originalName.split('.').pop()?.toLowerCase() || 'mp4';
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 10);
  return `mv-${timestamp}-${randomStr}.${ext}`;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const trackId = formData.get('track_id') as string;
    const storage = (formData.get('storage') as string) || 'supabase';

    if (!file) {
      return NextResponse.json({ error: '没有选择文件' }, { status: 400 });
    }

    if (!trackId) {
      return NextResponse.json({ error: '缺少曲目ID（track_id）' }, { status: 400 });
    }

    const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
      return NextResponse.json({
        error: `不支持的视频格式，允许的格式：${ALLOWED_EXTENSIONS.join(', ')}`
      }, { status: 400 });
    }

    if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
      return NextResponse.json({ error: '文件类型必须是视频文件（mp4/webm）' }, { status: 400 });
    }

    // 本地存储不限制大小，Supabase 限制 100MB
    if (storage === 'supabase' && file.size > MAX_MV_SIZE) {
      return NextResponse.json({ error: 'Supabase 存储文件大小超过限制（最大100MB）' }, { status: 400 });
    }

    const supabase = await getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase 未配置' }, { status: 500 });
    }

    const { data: existingTrack } = await supabase
      .from('tracks')
      .select('*')
      .eq('id', parseInt(trackId))
      .single();

    if (!existingTrack) {
      return NextResponse.json({ error: '指定的曲目不存在' }, { status: 404 });
    }

    let mvUrl: string;

    if (storage === 'local') {
      const fileName = generateFileName(file.name);
      const localDir = path.join(process.cwd(), 'public', 'music', 'mv');

      try {
        await mkdir(localDir, { recursive: true });
      } catch (e) {
        console.error('创建目录失败:', e);
      }

      const filePath = path.join(localDir, fileName);
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await writeFile(filePath, buffer);

      mvUrl = `/music/mv/${fileName}`;

    } else {
      const fileName = generateFileName(file.name);
      const supabasePath = `local-mv/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('music')
        .upload(supabasePath, file, {
          contentType: file.type || 'video/mp4',
          upsert: true,
        });

      if (uploadError) {
        console.error('MV 上传失败:', uploadError);
        return NextResponse.json({ error: 'MV 上传失败: ' + uploadError.message }, { status: 500 });
      }

      const { data: urlData } = supabase.storage
        .from('music')
        .getPublicUrl(supabasePath);

      mvUrl = urlData.publicUrl;
    }

    let mvCover: string | null = null;
    if (existingTrack.cover) {
      mvCover = existingTrack.cover;
    }

    const { data: updatedTrack, error: updateError } = await supabase
      .from('tracks')
      .update({
        mv_url: mvUrl,
        mv_cover: mvCover,
      })
      .eq('id', parseInt(trackId))
      .select()
      .single();

    if (updateError) {
      console.error('更新曲目 MV 信息失败:', updateError);

      try {
        if (storage === 'local' && mvUrl.startsWith('/music/mv/')) {
          const fileName = mvUrl.split('/music/mv/')[1];
          const localPath = path.join(process.cwd(), 'public', 'music', 'mv', fileName);
          const { unlink } = await import('fs/promises');
          await unlink(localPath).catch(() => {});
        } else if (mvUrl.includes('/storage/v1/object/public/music/')) {
          const filePath = mvUrl.split('/storage/v1/object/public/music/')[1];
          if (filePath) {
            await supabase.storage.from('music').remove([filePath]);
          }
        }
      } catch (e) {
        console.error('清理上传的 MV 文件失败:', e);
      }

      return NextResponse.json({ error: '更新 MV 信息失败: ' + updateError.message }, { status: 500 });
    }

    // 上传成功，失效 tracks 相关缓存（admin:tracks 缓存、首页等）
    cacheInvalidate(['admin:tracks', 'tracks', 'home']).catch((e) => console.error('失效缓存失败:', e));

    return NextResponse.json({
      success: true,
      track: updatedTrack,
      mv_url: mvUrl,
      storage,
    });

  } catch (error) {
    console.error('MV 上传处理失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'MV 上传失败' },
      { status: 500 }
    );
  }
}
