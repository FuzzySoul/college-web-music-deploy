import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cacheFetch } from '@/lib/cache-fetch';

const MOCK_CHARTS: Record<string, { time: number; lane: number }[]> = {
  "1_easy": [
    { time: 1.0, lane: 0 },
    { time: 2.0, lane: 1 },
    { time: 3.0, lane: 2 },
    { time: 4.0, lane: 3 }
  ],
  "1_normal": [
    { time: 1.0, lane: 0 },
    { time: 1.5, lane: 1 },
    { time: 2.0, lane: 2 },
    { time: 2.5, lane: 3 },
    { time: 3.0, lane: 0 },
    { time: 3.5, lane: 1 },
    { time: 4.0, lane: 2 },
    { time: 4.5, lane: 3 }
  ],
  "1_hard": [
    { time: 0.5, lane: 0 },
    { time: 1.0, lane: 1 },
    { time: 1.25, lane: 2 },
    { time: 1.5, lane: 3 },
    { time: 1.75, lane: 0 },
    { time: 2.0, lane: 1 },
    { time: 2.25, lane: 2 },
    { time: 2.5, lane: 3 },
    { time: 2.75, lane: 0 },
    { time: 3.0, lane: 1 }
  ],
  "2_normal": [
    { time: 1.0, lane: 0 },
    { time: 1.5, lane: 1 },
    { time: 2.0, lane: 2 },
    { time: 2.5, lane: 3 }
  ],
  "2_hard": [
    { time: 0.5, lane: 0 },
    { time: 1.0, lane: 1 },
    { time: 1.5, lane: 2 },
    { time: 2.0, lane: 3 },
    { time: 2.5, lane: 0 },
    { time: 3.0, lane: 1 }
  ]
};

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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const trackId = searchParams.get('track_id');
    const difficulty = searchParams.get('difficulty') || 'normal';

    if (!trackId) {
      return NextResponse.json(
        { error: '缺少 track_id 参数' },
        { status: 400 }
      );
    }

    const cached = await cacheFetch('/api/cache/rhythm/charts/' + trackId, { difficulty });
    if (cached) {
      const chart = cached as any;
      return NextResponse.json({
        track_id: chart.track_id,
        difficulty: chart.difficulty,
        note_speed: chart.note_speed || 500,
        judgment_window: chart.judgment_window || 50,
        notes: chart.notes || []
      });
    }

    const supabase = await getSupabaseClient();

    if (!supabase) {
      const mockKey = `${trackId}_${difficulty}`;
      const mockNotes = MOCK_CHARTS[mockKey] || MOCK_CHARTS["1_normal"];
      
      return NextResponse.json({
        track_id: parseInt(trackId),
        difficulty: difficulty,
        note_speed: 500,
        judgment_window: 50,
        notes: mockNotes
      });
    }

    const { data, error } = await supabase
      .from('rhythm_charts')
      .select('*')
      .eq('track_id', parseInt(trackId))
      .eq('difficulty', difficulty)
      .single();

    if (error) {
      console.error('获取谱面数据失败:', error);
      const mockKey = `${trackId}_${difficulty}`;
      const mockNotes = MOCK_CHARTS[mockKey] || MOCK_CHARTS["1_normal"];
      
      return NextResponse.json({
        track_id: parseInt(trackId),
        difficulty: difficulty,
        note_speed: 500,
        judgment_window: 50,
        notes: mockNotes
      });
    }

    if (!data) {
      const mockKey = `${trackId}_${difficulty}`;
      const mockNotes = MOCK_CHARTS[mockKey] || MOCK_CHARTS["1_normal"];
      
      return NextResponse.json({
        track_id: parseInt(trackId),
        difficulty: difficulty,
        note_speed: 500,
        judgment_window: 50,
        notes: mockNotes
      });
    }

    return NextResponse.json({
      track_id: data.track_id,
      difficulty: data.difficulty,
      note_speed: data.note_speed || 500,
      judgment_window: data.judgment_window || 50,
      notes: data.notes || []
    });
  } catch (error) {
    console.error('获取谱面数据失败:', error);
    return NextResponse.json(
      { error: '获取谱面数据失败' },
      { status: 500 }
    );
  }
}
