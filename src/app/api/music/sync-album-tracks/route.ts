import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cacheInvalidate } from '@/lib/cache-fetch';
import { SERVER_NETEASE_API_URL } from '@/lib/server-env';
import { getServiceSupabaseOrThrow } from '@/lib/supabase-service';

function getSupabase() {
  return getServiceSupabaseOrThrow();
}

const NETEASE_API_URL = SERVER_NETEASE_API_URL;

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);
    const albumName = searchParams.get('albumName');
    const artistName = searchParams.get('artistName');

    if (!albumName) {
      return NextResponse.json({ error: '缺少 albumName 参数' }, { status: 400 });
    }

    console.log(`[Album Sync] 开始同步专辑歌曲: ${albumName}`);

    const headers = { Referer: 'https://music.163.com/' };

    // 1. 搜索专辑
    const searchRes = await fetch(
      `${NETEASE_API_URL}/search?keywords=${encodeURIComponent(albumName)}&type=10`,
      { headers }
    );
    if (!searchRes.ok) {
      return NextResponse.json({ error: '搜索专辑失败' }, { status: 502 });
    }
    const searchData = await searchRes.json();

    if (searchData.code !== 200 || !searchData.result?.albums?.length) {
      return NextResponse.json({ error: '未找到该专辑' }, { status: 404 });
    }

    // 匹配歌手名称（如果提供了）
    let album = searchData.result.albums[0];
    if (artistName) {
      const matched = searchData.result.albums.find(
        (a: any) => a.artist?.name === artistName || a.artist?.name?.includes(artistName)
      );
      if (matched) album = matched;
    }

    const albumId = album.id;
    const albumArtist = album.artist?.name || artistName || '';
    const albumCover = album.picUrl || album.blurPicUrl || '';

    // 2. 获取专辑详情（含歌曲列表）
    const detailRes = await fetch(
      `${NETEASE_API_URL}/album?id=${albumId}`,
      { headers }
    );
    if (!detailRes.ok) {
      return NextResponse.json({ error: '获取专辑详情失败' }, { status: 502 });
    }
    const detailData = await detailRes.json();

    if (detailData.code !== 200 || !detailData.album) {
      return NextResponse.json({ error: '专辑详情无效' }, { status: 502 });
    }

    const songs = detailData.songs || [];

    // 3. 写入 tracks 表
    let tracksSynced = 0;
    for (const song of songs) {
      const { error } = await supabase.from('tracks').upsert(
        {
          title: song.name,
          artist: song.ar?.map((a: any) => a.name).join(', ') || albumArtist,
          album: albumName,
          cover: song.al?.picUrl || albumCover,
          duration: Math.floor((song.dt || 0) / 1000),
          source: 'netease',
          play_url: song.id ? `https://music.163.com/song?id=${song.id}` : null,
          mv_url: song.mv ? `https://music.163.com/mv?id=${song.mv}` : null,
        },
        { onConflict: 'title,artist' }
      );
      if (!error) {
        tracksSynced++;
      } else {
        console.error('[Album Sync] 歌曲写入失败:', song.name, error.message);
      }
    }

    // 4. 更新 albums 表封面（如果之前没有）
    await supabase.from('albums').update({
      cover: albumCover,
      release_year: detailData.album.publishTime
        ? new Date(detailData.album.publishTime).getFullYear()
        : null,
    }).eq('name', albumName);

    await cacheInvalidate(['tracks', 'home', 'admin:stats']);

    return NextResponse.json({
      success: true,
      data: {
        albumName,
        albumId,
        artist: albumArtist,
        tracksSynced,
        totalTracks: songs.length,
      },
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Album Sync] 同步失败:', error);
    return NextResponse.json({ error: '同步失败', detail: String(error) }, { status: 500 });
  }
}
