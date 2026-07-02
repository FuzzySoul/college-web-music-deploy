import { NextResponse } from 'next/server';
import { cacheFetch, cacheInvalidate } from '@/lib/cache-fetch';
import { getServiceSupabaseOrThrow } from '@/lib/supabase-service';

function getSupabase() {
  return getServiceSupabaseOrThrow();
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (type === 'artist') {
      const cached = await cacheFetch('/api/cache/admin/play-stats/artist');
      if (cached) {
        return NextResponse.json(cached);
      }

      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('play_history')
        .select('track_id, tracks(artist)')
        .limit(10000);

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      const artistMap: Record<string, number> = {};
      (data || []).forEach((row: any) => {
        const artist = row.tracks?.artist || '未知歌手';
        artistMap[artist] = (artistMap[artist] || 0) + 1;
      });

      const result = Object.entries(artistMap)
        .map(([artist, play_count]) => ({ artist, play_count }))
        .sort((a, b) => b.play_count - a.play_count)
        .slice(0, 10);

      return NextResponse.json({ success: true, data: result });
    }

    if (type === 'daily') {
      const range = searchParams.get('range') || 'week';
      const days = range === 'month' ? 30 : 7;

      const cached = await cacheFetch(`/api/cache/admin/play-stats/daily?range=${range}`);
      if (cached) {
        return NextResponse.json(cached);
      }

      const supabase = getSupabase();
      const since = new Date();
      since.setDate(since.getDate() - days);
      const sinceStr = since.toISOString();

      const { data, error } = await supabase
        .from('play_history')
        .select('played_at')
        .gte('played_at', sinceStr)
        .limit(10000);

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      const dateMap: Record<string, number> = {};
      for (let i = 0; i < days; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        dateMap[key] = 0;
      }

      (data || []).forEach((row: any) => {
        const date = row.played_at?.slice(0, 10);
        if (date && dateMap[date] !== undefined) {
          dateMap[date]++;
        }
      });

      const result = Object.entries(dateMap)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return NextResponse.json({ success: true, data: result });
    }

    return NextResponse.json({ success: false, error: '无效的type参数' }, { status: 400 });
  } catch (error) {
    console.error('Play stats error:', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'seed') {
      const supabase = getSupabase();

      const { data: tracks } = await supabase.from('tracks').select('id');
      if (!tracks || tracks.length === 0) {
        return NextResponse.json({ success: false, error: '没有可用的歌曲' }, { status: 400 });
      }

      const records = Array.from({ length: 100 }, () => {
        const track = tracks[Math.floor(Math.random() * tracks.length)];
        const daysAgo = Math.floor(Math.random() * 30);
        const hoursAgo = Math.floor(Math.random() * 24);
        const playedAt = new Date(Date.now() - (daysAgo * 86400000 + hoursAgo * 3600000));
        return { track_id: track.id, played_at: playedAt.toISOString() };
      });

      const { error } = await supabase.from('play_history').insert(records);
      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      await cacheInvalidate(['stats:tracks', 'admin:stats']);
      return NextResponse.json({ success: true, count: 100 });
    }

    return NextResponse.json({ success: false, error: '无效的action参数' }, { status: 400 });
  } catch (error) {
    console.error('Play stats seed error:', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
