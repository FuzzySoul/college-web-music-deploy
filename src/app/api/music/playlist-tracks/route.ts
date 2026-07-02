import { NextResponse } from 'next/server';
import { cacheFetch, cacheInvalidate } from '@/lib/cache-fetch';
import { getServiceSupabaseOrThrow } from '@/lib/supabase-service';

let supabaseInstance: ReturnType<typeof getServiceSupabaseOrThrow> | null = null;

function getSupabaseAdmin() {
  if (!supabaseInstance) {
    supabaseInstance = getServiceSupabaseOrThrow();
  }
  return supabaseInstance;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const playlistId = searchParams.get('playlist_id');
    const source = searchParams.get('source');

    if (!playlistId) {
      return NextResponse.json({ error: '缺少 playlist_id 参数' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    if (source === 'local') {
      const db = supabase as any;
      const { data: tracks, error } = await db
        .from('playlist_tracks')
        .select('position, track_id, tracks!inner(id, title, artist, album, cover, duration, play_url, audio_url, source, lyrics, mv_url, mv_cover)')
        .eq('playlist_id', playlistId)
        .order('position');

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const formatted = (tracks || []).map((pt: any) => ({
        id: pt.track_id,
        position: pt.position,
        ...(pt.tracks || {}),
      }));

      return NextResponse.json({ tracks: formatted });
    }

    const cached = await cacheFetch<any[]>('/api/cache/playlists/' + playlistId + '/tracks', { source: 'external' });
    if (cached !== null) {
      return NextResponse.json({ tracks: cached });
    }

    const { data: tracks, error } = await supabase
      .from('external_playlist_tracks')
      .select('id,track_title,track_artist,track_duration,platform_track_id,position')
      .eq('playlist_id', playlistId)
      .order('position');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ tracks: tracks || [] });

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: '获取失败', detail: errMsg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { playlist_id, track_id } = body;

    if (!playlist_id || !track_id) {
      return NextResponse.json({ error: '缺少 playlist_id 或 track_id' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const db = supabase as any;

    const { data: existing } = await db
      .from('playlist_tracks')
      .select('id')
      .eq('playlist_id', playlist_id)
      .eq('track_id', track_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ success: true, message: '歌曲已在歌单中' });
    }

    const { data: maxPos } = await db
      .from('playlist_tracks')
      .select('position')
      .eq('playlist_id', playlist_id)
      .order('position', { ascending: false })
      .limit(1);

    const nextPosition = (maxPos && maxPos.length > 0 ? (maxPos[0].position || 0) + 1 : 0);

    const { error } = await db
      .from('playlist_tracks')
      .insert({ playlist_id, track_id, position: nextPosition });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { count } = await db
      .from('playlist_tracks')
      .select('id', { count: 'exact', head: true })
      .eq('playlist_id', playlist_id);

    await db
      .from('playlists')
      .update({ track_count: count || 0 })
      .eq('id', playlist_id);

    console.log('✅ 歌曲已添加到歌单:', track_id, '→', playlist_id);

    cacheInvalidate(['playlists', 'home', 'admin:stats']);

    return NextResponse.json({ success: true, message: '歌曲添加成功' });

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: '添加失败', detail: errMsg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const playlist_id = searchParams.get('playlist_id');
    const track_id = searchParams.get('track_id');

    if (!playlist_id || !track_id) {
      return NextResponse.json({ error: '缺少 playlist_id 或 track_id' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const db = supabase as any;

    const { error } = await db
      .from('playlist_tracks')
      .delete()
      .eq('playlist_id', playlist_id)
      .eq('track_id', parseInt(track_id));

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { count } = await db
      .from('playlist_tracks')
      .select('id', { count: 'exact', head: true })
      .eq('playlist_id', playlist_id);

    await db
      .from('playlists')
      .update({ track_count: count || 0 })
      .eq('id', playlist_id);

    console.log('✅ 歌曲已从歌单移除:', track_id);

    cacheInvalidate(['playlists', 'home', 'admin:stats']);

    return NextResponse.json({ success: true, message: '歌曲移除成功' });

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: '移除失败', detail: errMsg }, { status: 500 });
  }
}
