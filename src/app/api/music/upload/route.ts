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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const artist = formData.get('artist') as string;
    const album = formData.get('album') as string || '本地音乐';

    if (!file) {
      return NextResponse.json({ error: '没有文件' }, { status: 400 });
    }

    const supabase = await getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase 未配置' }, { status: 500 });
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `uploads/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('music')
      .upload(filePath, file, {
        contentType: file.type || 'audio/mpeg',
        upsert: false,
      });

    if (uploadError) {
      console.error('上传失败:', uploadError);
      return NextResponse.json({ error: '文件上传失败: ' + uploadError.message }, { status: 500 });
    }

    const { data: urlData } = supabase.storage
      .from('music')
      .getPublicUrl(filePath);

    const publicUrl = urlData.publicUrl;

    const { data: trackData, error: dbError } = await supabase
      .from('tracks')
      .insert({
        title: title || file.name.replace(/\.[^/.]+$/, ''),
        artist: artist || '未知歌手',
        album: album,
        duration: 0,
        source: 'upload',
        play_url: publicUrl,
        has_chart: false,
      })
      .select()
      .single();

    if (dbError) {
      console.error('保存数据库失败:', dbError);
      return NextResponse.json({ error: '保存到数据库失败: ' + dbError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      track: trackData,
      url: publicUrl,
    });

  } catch (error) {
    console.error('上传处理失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '上传失败' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const playUrl = searchParams.get('play_url');

    if (!id) {
      return NextResponse.json({ error: '缺少曲目ID' }, { status: 400 });
    }

    const supabase = await getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase 未配置' }, { status: 500 });
    }

    if (playUrl) {
      try {
        const urlParts = playUrl.split('/storage/v1/object/public/music/');
        if (urlParts[1]) {
          const filePath = urlParts[1];
          await supabase.storage.from('music').remove([filePath]);
        }
      } catch (e) {
        console.error('删除文件失败:', e);
      }
    }

    await supabase.from('rhythm_charts').delete().eq('track_id', parseInt(id));

    const { error: deleteError } = await supabase
      .from('tracks')
      .delete()
      .eq('id', parseInt(id));

    if (deleteError) {
      console.error('删除失败:', deleteError);
      return NextResponse.json({ error: '删除失败: ' + deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('删除处理失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除失败' },
      { status: 500 }
    );
  }
}
