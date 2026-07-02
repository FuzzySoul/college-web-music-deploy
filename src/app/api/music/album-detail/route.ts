import { NextRequest, NextResponse } from 'next/server';
import { cacheFetch } from '@/lib/cache-fetch';
import { getServiceSupabaseOrThrow } from '@/lib/supabase-service';

function getSupabase() {
  return getServiceSupabaseOrThrow();
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const albumId = searchParams.get('id');
    if (!albumId) {
      return NextResponse.json({ error: '缺少专辑ID' }, { status: 400 });
    }

    const cached = await cacheFetch(`/api/cache/albums/${albumId}`);
    if (cached) {
      return NextResponse.json(cached);
    }

    const supabase = getSupabase();

    const { data: album, error: albumError } = await supabase
      .from('albums')
      .select('*')
      .eq('id', albumId)
      .single();

    if (albumError || !album) {
      return NextResponse.json({ error: '专辑不存在' }, { status: 404 });
    }

    const { data: tracks } = await supabase
      .from('tracks')
      .select('*')
      .ilike('album', album.name)
      .order('id', { ascending: true });

    const result = {
      album,
      tracks: tracks || [],
      trackCount: tracks?.length || 0,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('获取专辑详情失败:', error);
    return NextResponse.json({ error: '获取专辑详情失败' }, { status: 500 });
  }
}
