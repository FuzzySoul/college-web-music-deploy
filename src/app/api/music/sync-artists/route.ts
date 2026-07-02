import { NextResponse } from 'next/server';
import { cacheFetch, cacheInvalidate } from '@/lib/cache-fetch';
import { getServiceSupabaseOrThrow } from '@/lib/supabase-service';

async function getSupabaseAdmin() {
  return getServiceSupabaseOrThrow();
}

export async function POST() {
  try {
    const supabase = await getSupabaseAdmin();
    
    const { data: tracks, error: tracksError } = await supabase
      .from('external_playlist_tracks')
      .select('track_title, track_artist');
    
    if (tracksError) {
      console.error('获取外部歌曲失败:', tracksError);
      return NextResponse.json({ error: tracksError.message }, { status: 500 });
    }
    
    const artistCount = new Map<string, number>();
    const artistAliases = new Map<string, string>();
    
    for (const track of tracks || []) {
      if (track.track_artist) {
        const artists = track.track_artist.split(/[,，、&]/).map((a: string) => a.trim()).filter(Boolean);
        for (const artist of artists) {
          artistCount.set(artist, (artistCount.get(artist) || 0) + 1);
          if (!artistAliases.has(artist)) {
            artistAliases.set(artist, track.track_artist);
          }
        }
      }
    }
    
    const results = { artists: 0, albums: 0 };
    
    for (const [artistName, count] of artistCount) {
      const { data: existing } = await supabase
        .from('artists')
        .select('id')
        .ilike('name', artistName)
        .single();
      
      if (!existing) {
        const { error } = await supabase
          .from('artists')
          .insert({
            name: artistName,
            alias: artistAliases.get(artistName),
          });
        
        if (!error) {
          results.artists++;
        }
      }
    }
    
    await cacheInvalidate(['artists']);

    return NextResponse.json({ 
      success: true, 
      message: `同步完成，新增 ${results.artists} 位歌手`,
      results 
    });
    
  } catch (error) {
    console.error('同步失败:', error);
    return NextResponse.json({ error: '同步失败' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const cached = await cacheFetch('/api/cache/artists');
    if (cached) {
      return NextResponse.json(cached);
    }

    const supabase = await getSupabaseAdmin();
    
    const { data: artists } = await supabase
      .from('artists')
      .select('*')
      .order('created_at', { ascending: false });
    
    const { data: albums } = await supabase
      .from('albums')
      .select('*')
      .order('created_at', { ascending: false });

    // 从 external_playlist_tracks 提取真正"外部同步"的歌手名
    // 用于前端判断哪些歌手是外部数据，哪些是手动新建
    const { data: externalTracks } = await supabase
      .from('external_playlist_tracks')
      .select('track_artist');
    const externalArtistsSet = new Set<string>();
    (externalTracks || []).forEach((t: any) => {
      if (t.track_artist) {
        t.track_artist.split(/[,，、&]/).map((s: string) => s.trim()).filter(Boolean).forEach((s: string) => {
          externalArtistsSet.add(s.toLowerCase());
        });
      }
    });
    
    return NextResponse.json({
      artistsCount: artists?.length || 0,
      albumsCount: albums?.length || 0,
      artists,
      albums,
      externalArtists: Array.from(externalArtistsSet),
    });
    
  } catch (error) {
    console.error('获取失败:', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}
