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
    const artistName = searchParams.get('artistName');

    if (!artistName) {
      return NextResponse.json({ error: '缺少 artistName 参数' }, { status: 400 });
    }

    console.log(`[Netease Sync] 开始同步歌手: ${artistName}`);

    const headers = { Referer: 'https://music.163.com/' };

    const searchRes = await fetch(
      `${NETEASE_API_URL}/search?keywords=${encodeURIComponent(artistName)}&type=100`,
      { headers }
    );
    if (!searchRes.ok) {
      return NextResponse.json({ error: '搜索歌手失败' }, { status: 502 });
    }
    const searchData = await searchRes.json();

    if (searchData.code !== 200 || !searchData.result?.artists?.length) {
      return NextResponse.json({ error: '未找到该歌手' }, { status: 404 });
    }

    const artist = searchData.result.artists[0];
    const artistId = artist.id;

    const [detailRes, albumsRes, songsRes] = await Promise.all([
      fetch(`${NETEASE_API_URL}/artist/detail?id=${artistId}`, { headers }),
      fetch(`${NETEASE_API_URL}/artist/album?id=${artistId}&limit=30`, { headers }),
      fetch(`${NETEASE_API_URL}/artist/top/song?id=${artistId}`, { headers }),
    ]);

    if (!detailRes.ok || !albumsRes.ok || !songsRes.ok) {
      return NextResponse.json({ error: '获取歌手数据失败' }, { status: 502 });
    }

    const [detailData, albumsData, songsData] = await Promise.all([
      detailRes.json(),
      albumsRes.json(),
      songsRes.json(),
    ]);

    const artistDetail = detailData.data?.artist || {};
    const picUrl = artist.picUrl || artistDetail.cover;
    const briefDesc = artist.briefDesc || artistDetail.briefDesc;

    const { error: artistError } = await supabase.from('artists').upsert(
      {
        name: artistName,
        image: picUrl,
        description: briefDesc,
      },
      { onConflict: 'name' }
    );
    if (artistError) {
      console.error('[Netease Sync] 歌手写入失败:', artistError.message);
    }

    const albums = albumsData.hotAlbums || [];
    let albumsSynced = 0;
    for (const album of albums.slice(0, 20)) {
      const { error } = await supabase.from('albums').upsert(
        {
          name: album.name,
          artist: artistName,
          cover: album.picUrl,
          release_year: album.publishTime ? new Date(album.publishTime).getFullYear() : null,
        },
        { onConflict: 'name,artist' }
      );
      if (!error) {
        albumsSynced++;
      } else {
        console.error('[Netease Sync] 专辑写入失败:', album.name, error.message);
      }
    }

    const songs = songsData.songs || [];
    let tracksSynced = 0;
    for (const song of songs.slice(0, 50)) {
      const { error } = await supabase.from('tracks').upsert(
        {
          title: song.name,
          artist: artistName,
          album: song.al?.name || null,
          cover: song.al?.picUrl || null,
          duration: Math.floor((song.dt || 0) / 1000),
          source: 'netease',
          mv_url: song.mv ? `https://music.163.com/mv?id=${song.mv}` : null,
        },
        { onConflict: 'title,artist' }
      );
      if (!error) {
        tracksSynced++;
      } else {
        console.error('[Netease Sync] 歌曲写入失败:', song.name, error.message);
      }
    }

    await cacheInvalidate(['artists', 'home', 'admin:stats']);

    return NextResponse.json({
      success: true,
      data: {
        artist: { id: artistId, name: artist.name, picUrl },
        albumsSynced,
        tracksSynced,
        totalAlbums: albums.length,
        totalTracks: songs.length,
      },
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Netease Sync] 同步失败:', error);
    return NextResponse.json({ error: '同步失败', detail: String(error) }, { status: 500 });
  }
}
