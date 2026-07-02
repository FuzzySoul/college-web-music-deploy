import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cacheFetch } from '@/lib/cache-fetch';

const MOCK_SONGS = [
  {
    id: 1,
    name: "示例曲目1",
    artist: "艺术家1",
    duration: 180,
    audio_url: "/music/sample1.mp3",
    cover_url: "https://picsum.photos/seed/song1/400/400",
    bpm: 120,
    has_chart: true,
    chart_difficulties: ["easy", "normal", "hard"]
  },
  {
    id: 2,
    name: "示例曲目2",
    artist: "艺术家2",
    duration: 210,
    audio_url: "/music/sample2.mp3",
    cover_url: "https://picsum.photos/seed/song2/400/400",
    bpm: 140,
    has_chart: true,
    chart_difficulties: ["normal", "hard"]
  }
];

async function getSupabaseClient() {
  const url = process.env.COZE_SUPABASE_URL;
  const key = process.env.COZE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    db: { timeout: 60000 },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET() {
  try {
    const cached = await cacheFetch('/api/cache/rhythm/songs');
    if (cached) {
      return NextResponse.json(cached);
    }

    const supabase = await getSupabaseClient();

    if (!supabase) {
      return NextResponse.json(MOCK_SONGS);
    }

    const { data: tracks, error: tracksError } = await supabase
      .from('tracks')
      .select('*')
      .order('created_at', { ascending: false });

    if (tracksError) {
      console.error('获取曲目列表失败:', tracksError);
      return NextResponse.json(MOCK_SONGS);
    }

    if (!tracks || tracks.length === 0) {
      return NextResponse.json(MOCK_SONGS);
    }

    const { data: charts, error: chartsError } = await supabase
      .from('rhythm_charts')
      .select('track_id, difficulty');

    const chartMap = new Map<number, string[]>();
    if (charts && !chartsError) {
      charts.forEach(chart => {
        const trackId = chart.track_id;
        if (!chartMap.has(trackId)) {
          chartMap.set(trackId, []);
        }
        chartMap.get(trackId)!.push(chart.difficulty);
      });
    }

    const songs = tracks.map(track => {
      const difficulties = chartMap.get(track.id) || [];
      return {
        id: track.id,
        name: track.title,
        artist: track.artist,
        duration: track.duration,
        audio_url: track.audio_url,
        cover_url: track.cover_url,
        bpm: track.bpm,
        has_chart: difficulties.length > 0,
        chart_difficulties: difficulties
      };
    });

    return NextResponse.json(songs);
  } catch (error) {
    console.error('获取曲目列表失败:', error);
    return NextResponse.json(MOCK_SONGS);
  }
}
