'use strict';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

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
const ALLOWED_EXTENSIONS = ['mp3', 'flac', 'wav', 'ogg', 'm4a'];
const MAX_AUDIO_SIZE = 50 * 1024 * 1024; // 50MB

function generateFileName(originalName: string): string {
  const ext = originalName.split('.').pop()?.toLowerCase() || 'mp3';
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${randomStr}.${ext}`;
}

async function getAudioDuration(file: File): Promise<number> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (file.type === 'audio/mpeg' || file.name.toLowerCase().endsWith('.mp3')) {
      const header = buffer.slice(0, 10);
      if (header.length >= 10 && header[0] === 0xFF && (header[1] & 0xE0) === 0xE0) {
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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const artist = formData.get('artist') as string;
    const album = formData.get('album') as string;
    const storage = (formData.get('storage') as string) || 'supabase';
    const clientDuration = parseInt(formData.get('duration') as string) || 0;

    if (!file) {
      return NextResponse.json({ error: '没有选择文件' }, { status: 400 });
    }

    const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
      return NextResponse.json({
        error: `不支持的文件格式，允许的格式：${ALLOWED_EXTENSIONS.join(', ')}`
      }, { status: 400 });
    }

    if (!ALLOWED_AUDIO_TYPES.includes(file.type) && !ALLOWED_EXTENSIONS.includes(fileExt)) {
      return NextResponse.json({ error: '文件类型必须是音频文件' }, { status: 400 });
    }

    if (file.size > MAX_AUDIO_SIZE) {
      return NextResponse.json({ error: '文件大小超过限制（最大50MB）' }, { status: 400 });
    }

    const supabase = await getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase 未配置' }, { status: 500 });
    }

    let playUrl: string;
    let audioUrl: string | null = null;
    let coverUrl: string | null = null;

    // 处理封面上传
    const coverFile = formData.get('cover') as File;
    if (coverFile && coverFile.size > 0) {
      const coverExt = coverFile.name.split('.').pop()?.toLowerCase() || 'jpg';
      const coverFileName = `cover-${Date.now()}-${Math.random().toString(36).substring(2, 10)}.${coverExt}`;
      const coverPath = `local-covers/${coverFileName}`;

      const { error: coverUploadError } = await supabase.storage
        .from('music')
        .upload(coverPath, coverFile, {
          contentType: coverFile.type || 'image/jpeg',
          upsert: false,
        });

      if (!coverUploadError) {
        const { data: coverUrlData } = supabase.storage
          .from('music')
          .getPublicUrl(coverPath);
        coverUrl = coverUrlData.publicUrl;
      } else {
        console.warn('封面上传失败:', coverUploadError);
      }
    }

    if (storage === 'local') {
      const fileName = generateFileName(file.name);
      const localDir = path.join(process.cwd(), 'public', 'music', 'local');

      try {
        await mkdir(localDir, { recursive: true });
      } catch (e) {
        console.error('创建目录失败:', e);
      }

      const filePath = path.join(localDir, fileName);
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await writeFile(filePath, buffer);

      playUrl = `/music/local/${fileName}`;

    } else {
      const fileName = generateFileName(file.name);
      const supabasePath = `local-audio/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('music')
        .upload(supabasePath, file, {
          contentType: file.type || 'audio/mpeg',
          upsert: false,
        });

      if (uploadError) {
        console.error('Supabase 上传失败:', uploadError);
        return NextResponse.json({ error: '文件上传失败: ' + uploadError.message }, { status: 500 });
      }

      const { data: urlData } = supabase.storage
        .from('music')
        .getPublicUrl(supabasePath);

      playUrl = urlData.publicUrl;
    }

    // 优先使用前端通过 HTMLAudioElement 解析的时长（支持所有格式且更准确），
    // 仅当客户端未提供时（如直接通过 API 调用）才使用后端 MP3 帧头解析作为兜底
    const duration = clientDuration > 0 ? clientDuration : await getAudioDuration(file);

    const trackTitle = title || file.name.replace(/\.[^/.]+$/, '');
    const trackArtist = artist || '未知歌手';
    const trackAlbum = album || '本地音乐';

    const { data: trackData, error: dbError } = await supabase
      .from('tracks')
      .insert({
        title: trackTitle,
        artist: trackArtist,
        album: trackAlbum,
        cover: coverUrl,
        duration: duration,
        source: storage === 'local' ? 'local' : 'upload',
        play_url: playUrl,
        audio_url: audioUrl,
        has_chart: false,
      })
      .select()
      .single();

    if (dbError) {
      console.error('保存曲目记录失败:', dbError);

      if (storage === 'local' && playUrl.startsWith('/music/local/')) {
        try {
          const fileName = playUrl.split('/music/local/')[1];
          const localPath = path.join(process.cwd(), 'public', 'music', 'local', fileName);
          const { unlink } = await import('fs/promises');
          await unlink(localPath).catch(() => {});
        } catch (e) {
          console.error('清理本地文件失败:', e);
        }
      }

      return NextResponse.json({ error: '保存到数据库失败: ' + dbError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      track: trackData,
      url: playUrl,
      storage,
    });

  } catch (error) {
    console.error('音频上传处理失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '音频上传失败' },
      { status: 500 }
    );
  }
}
