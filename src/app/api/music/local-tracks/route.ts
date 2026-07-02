'use strict';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';
import { cacheFetch, cacheInvalidate } from '@/lib/cache-fetch';

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

const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/flac', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/x-m4a'];
const MAX_AUDIO_SIZE = 50 * 1024 * 1024; // 50MB

function generateFileName(originalName: string, prefix: string = '') {
  const ext = originalName.split('.').pop() || 'mp3';
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 10);
  return `${prefix}${timestamp}-${randomStr}.${ext}`;
}

async function getAudioDuration(file: File): Promise<number> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (file.type === 'audio/mpeg' || file.name.endsWith('.mp3')) {
      const header = buffer.slice(0, 10);
      if (header[0] === 0xFF && (header[1] & 0xE0) === 0xE0) {
        const bitrateTable = [
          32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0, 0
        ];
        const bitrateIndex = (header[2] >> 4) & 0x0F;
        const bitrate = bitrateTable[bitrateIndex] * 1000;
        const sampleRateTable = [44100, 48000, 32000];
        const sampleRateIndex = (header[2] >> 2) & 0x03;
        const sampleRate = sampleRateTable[sampleRateIndex];
        const padding = (header[2] >> 1) & 0x01;
        const frameSize = Math.floor((144 * bitrate) / sampleRate) + padding;
        if (frameSize > 0 && bitrate > 0) {
          return Math.round((file.size / frameSize) * (1152 / sampleRate));
        }
      }
    }

    return 0;
  } catch (error) {
    console.error('获取音频时长失败:', error);
    return 0;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const search = searchParams.get('search') || '';

    const cached = await cacheFetch<{ success: boolean; data: any[]; total: number; page: number; pageSize: number; totalPages: number }>(
      '/api/cache/tracks/local',
      { page: String(page), pageSize: String(pageSize), search }
    );
    if (cached !== null) {
      return NextResponse.json(cached);
    }

    const supabase = await getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase 未配置' }, { status: 500 });
    }

    let query = supabase
      .from('tracks')
      .select('*', { count: 'exact' })
      .or('source.eq.local,source.eq.upload')
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (search) {
      query = query.or(`title.ilike.%${search}%,artist.ilike.%${search}%,album.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('查询本地音乐失败:', error);
      return NextResponse.json({ error: '查询失败: ' + error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    });

  } catch (error) {
    console.error('获取本地音乐列表失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取列表失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, artist, album, cover, duration, play_url, audio_url, source = 'local' } = body;

    if (!title || !artist) {
      return NextResponse.json({ error: '标题和歌手为必填项' }, { status: 400 });
    }

    const supabase = await getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase 未配置' }, { status: 500 });
    }

    const { data: trackData, error: dbError } = await supabase
      .from('tracks')
      .insert({
        title,
        artist,
        album: album || null,
        cover: cover || null,
        duration: duration || 0,
        source,
        play_url: play_url || null,
        audio_url: audio_url || null,
        has_chart: false,
      })
      .select()
      .single();

    if (dbError) {
      console.error('创建本地音乐记录失败:', dbError);
      return NextResponse.json({ error: '创建失败: ' + dbError.message }, { status: 500 });
    }

    await cacheInvalidate(['tracks', 'home']);

    return NextResponse.json({
      success: true,
      track: trackData,
    });

  } catch (error) {
    console.error('创建本地音乐记录失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建失败' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少曲目ID' }, { status: 400 });
    }

    const supabase = await getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase 未配置' }, { status: 500 });
    }

    const { data: track } = await supabase
      .from('tracks')
      .select('*')
      .eq('id', parseInt(id))
      .single();

    if (track) {
      if (track.play_url && track.play_url.includes('/storage/v1/object/public/music/')) {
        try {
          const filePath = track.play_url.split('/storage/v1/object/public/music/')[1];
          if (filePath) {
            await supabase.storage.from('music').remove([filePath]);
          }
        } catch (e) {
          console.error('删除 Supabase 音频文件失败:', e);
        }
      }

      if (track.mv_url && track.mv_url.includes('/storage/v1/object/public/music/')) {
        try {
          const mvFilePath = track.mv_url.split('/storage/v1/object/public/music/')[1];
          if (mvFilePath) {
            await supabase.storage.from('music').remove([mvFilePath]);
          }
        } catch (e) {
          console.error('删除 Supabase MV 文件失败:', e);
        }
      }

      if (track.play_url && track.play_url.includes('/music/local/')) {
        try {
          const fileName = track.play_url.split('/music/local/')[1]?.split('?')[0];
          if (fileName) {
            const localPath = path.join(process.cwd(), 'public', 'music', 'local', fileName);
            await unlink(localPath).catch(() => {});
          }
        } catch (e) {
          console.error('删除本地音频文件失败:', e);
        }
      }

      if (track.mv_url && track.mv_url.includes('/music/mv/')) {
        try {
          const mvFileName = track.mv_url.split('/music/mv/')[1]?.split('?')[0];
          if (mvFileName) {
            const localMvPath = path.join(process.cwd(), 'public', 'music', 'mv', mvFileName);
            await unlink(localMvPath).catch(() => {});
          }
        } catch (e) {
          console.error('删除本地 MV 文件失败:', e);
        }
      }
    }

    await supabase.from('rhythm_charts').delete().eq('track_id', parseInt(id));
    await supabase.from('favorites').delete().eq('track_id', parseInt(id));
    await supabase.from('playlist_tracks').delete().eq('track_id', parseInt(id));

    const { error: deleteError } = await supabase
      .from('tracks')
      .delete()
      .eq('id', parseInt(id));

    if (deleteError) {
      console.error('删除曲目失败:', deleteError);
      return NextResponse.json({ error: '删除失败: ' + deleteError.message }, { status: 500 });
    }

    await cacheInvalidate(['tracks', 'home']);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('删除处理失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除失败' },
      { status: 500 }
    );
  }
}
