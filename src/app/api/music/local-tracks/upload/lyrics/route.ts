'use strict';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

function validateLRCFormat(content: string): boolean {
  if (!content || content.trim().length === 0) {
    return false;
  }

  const lines = content.split('\n');
  const hasTimeTag = lines.some(line => /\[\d{2}:\d{2}[\.:]\d{2,3}\]/.test(line));
  const hasLyricText = lines.some(line => {
    const cleaned = line.replace(/\[\d{2}:\d{2}[\.:]\d{2,3}\]/g, '').trim();
    return cleaned.length > 0;
  });

  if (hasTimeTag && hasLyricText) {
    return true;
  }

  const nonEmptyLines = lines.filter(line => line.trim().length > 0);
  return nonEmptyLines.length >= 1;
}

export async function PUT(request: NextRequest) {
  try {
    const formData = await request.formData();
    const trackId = formData.get('track_id') as string;
    const lyricsText = formData.get('lyrics') as string;
    const lyricsFile = formData.get('file') as File;

    if (!trackId) {
      return NextResponse.json({ error: '缺少曲目ID（track_id）' }, { status: 400 });
    }

    let lyricsContent: string | null = null;

    if (lyricsFile && lyricsFile.size > 0) {
      const fileExt = lyricsFile.name.split('.').pop()?.toLowerCase();
      if (fileExt !== 'lrc' && fileExt !== 'txt') {
        return NextResponse.json({
          error: '歌词文件格式不支持，请上传 .lrc 或 .txt 文件'
        }, { status: 400 });
      }

      if (lyricsFile.size > 1024 * 1024) {
        return NextResponse.json({ error: '歌词文件大小超过限制（最大1MB）' }, { status: 400 });
      }

      try {
        const bytes = await lyricsFile.arrayBuffer();
        const buffer = Buffer.from(bytes);
        lyricsContent = buffer.toString('utf-8');
      } catch (e) {
        console.error('读取歌词文件失败:', e);
        return NextResponse.json({ error: '读取歌词文件失败' }, { status: 500 });
      }
    } else if (lyricsText && lyricsText.trim().length > 0) {
      lyricsContent = lyricsText.trim();
    } else {
      return NextResponse.json({ error: '请提供歌词内容或上传歌词文件' }, { status: 400 });
    }

    if (lyricsContent && !validateLRCFormat(lyricsContent)) {
      return NextResponse.json({
        error: '歌词格式无效，请确保包含有效的 LRC 时间标签或文本内容'
      }, { status: 400 });
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

    const { data: updatedTrack, error: updateError } = await supabase
      .from('tracks')
      .update({
        lyrics: lyricsContent,
      })
      .eq('id', parseInt(trackId))
      .select()
      .single();

    if (updateError) {
      console.error('更新歌词失败:', updateError);
      return NextResponse.json({ error: '更新歌词失败: ' + updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      track: updatedTrack,
      message: '歌词更新成功',
    });

  } catch (error) {
    console.error('歌词更新处理失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '歌词更新失败' },
      { status: 500 }
    );
  }
}
