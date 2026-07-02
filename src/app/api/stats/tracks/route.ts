import { NextResponse } from 'next/server';
import { cacheFetch } from '@/lib/cache-fetch';
import { getServiceSupabaseOrThrow } from '@/lib/supabase-service';

async function getSupabaseAdmin() {
  return getServiceSupabaseOrThrow();
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all';

    const cached = await cacheFetch('/api/cache/stats/tracks', { filter });
    if (cached) {
      return NextResponse.json(cached);
    }

    const supabase = await getSupabaseAdmin();

    let query = supabase
      .from('external_playlist_tracks')
      .select(`
        id,
        track_title,
        track_artist,
        track_duration,
        platform_track_id,
        position,
        play_count,
        last_played_at,
        created_at,
        playlist:external_playlists (
          id,
          name,
          cover_url,
          platform:external_platforms (
            platform
          )
        )
      `)
      .gt('play_count', 0)
      .order('play_count', { ascending: false })
      .limit(100);

    if (filter === 'week') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      query = query.gte('last_played_at', oneWeekAgo.toISOString());
    }

    const { data: tracks, error } = await query;

    if (error) {
      console.error('获取统计数据失败:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const formattedTracks = (tracks || []).map((track: any, index: number) => ({
      id: track.id,
      title: track.track_title,
      artist: track.track_artist,
      duration: track.track_duration,
      platform_track_id: track.platform_track_id,
      position: track.position || index + 1,
      playCount: track.play_count || 0,
      lastPlayedAt: track.last_played_at,
      createdAt: track.created_at,
      cover: track.playlist?.cover_url || null,
      playlistName: track.playlist?.name || '未知歌单',
      platform: track.playlist?.platform?.platform || 'netease',
    }));

    return NextResponse.json({
      success: true,
      data: formattedTracks,
      count: formattedTracks.length,
    });
  } catch (error) {
    console.error('获取统计数据异常:', error);
    return NextResponse.json(
      { error: '获取统计数据失败' },
      { status: 500 }
    );
  }
}
