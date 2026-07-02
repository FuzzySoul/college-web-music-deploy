import { NextRequest, NextResponse } from 'next/server';
import { cacheFetch, cacheInvalidate } from '@/lib/cache-fetch';
import { getServiceSupabaseOrThrow } from '@/lib/supabase-service';

function getSupabase() {
  return getServiceSupabaseOrThrow();
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const artistId = searchParams.get('id');
    if (!artistId) {
      return NextResponse.json({ error: '缺少歌手ID' }, { status: 400 });
    }

    const cached = await cacheFetch(`/api/cache/artists/${artistId}`);
    if (cached) {
      return NextResponse.json(cached);
    }

    const supabase = getSupabase();

    const { data: artist, error: artistError } = await supabase
      .from('artists')
      .select('*')
      .eq('id', artistId)
      .single();

    if (artistError || !artist) {
      return NextResponse.json({ error: '歌手不存在' }, { status: 404 });
    }

    const { data: tracks } = await supabase
      .from('tracks')
      .select('*')
      .ilike('artist', artist.name);

    const { data: albums } = await supabase
      .from('albums')
      .select('*')
      .ilike('artist', artist.name);

    const result = {
      artist,
      tracks: tracks || [],
      albums: albums || [],
      trackCount: tracks?.length || 0,
      albumCount: albums?.length || 0,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('获取歌手详情失败:', error);
    return NextResponse.json({ error: '获取歌手详情失败' }, { status: 500 });
  }
}
