import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabaseOrThrow } from '@/lib/supabase-service';

function getSupabase() {
  return getServiceSupabaseOrThrow();
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');
    if (!name) {
      return NextResponse.json({ error: '缺少专辑名' }, { status: 400 });
    }

    const supabase = getSupabase();

    // 用 name 查 tracks
    const { data: tracks } = await supabase
      .from('tracks')
      .select('*')
      .ilike('album', name)
      .order('id', { ascending: true });

    // 尝试从 albums 表取 cover + artist
    const { data: album } = await supabase
      .from('albums')
      .select('cover, artist')
      .ilike('name', name)
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      tracks: tracks || [],
      cover: album?.cover || tracks?.[0]?.cover || null,
      artist: album?.artist || tracks?.[0]?.artist || '',
    });
  } catch (error) {
    console.error('获取专辑歌曲失败:', error);
    return NextResponse.json({ error: '获取专辑歌曲失败' }, { status: 500 });
  }
}
