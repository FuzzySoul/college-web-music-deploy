import { NextRequest, NextResponse } from 'next/server';
import { cacheFetch } from '@/lib/cache-fetch';
import { getServiceSupabaseOrThrow } from '@/lib/supabase-service';

function getSupabase() {
  return getServiceSupabaseOrThrow();
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const search = searchParams.get('search') || '';

  // 1️⃣ 优先读 FastAPI 聚合缓存（一次拿到专辑列表 + 每张专辑的歌曲数）
  const cached = await cacheFetch<{ data: any[]; pagination: any }>(
    '/api/cache/admin/albums/all',
    { page: String(page), limit: String(limit), search },
  );
  if (cached && Array.isArray(cached.data)) {
    return NextResponse.json(cached);
  }

  // 2️⃣ 缓存未命中：直连 Supabase，用 2 次请求拉够（替代 N+1 的 50 次）
  try {
    const supabase = getSupabase();
    const offset = (page - 1) * limit;

    let albumsQuery = supabase
      .from('albums')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      albumsQuery = albumsQuery.or(`name.ilike.%${search}%,artist.ilike.%${search}%`);
    }

    const [albumsRes, tracksRes] = await Promise.all([
      albumsQuery,
      supabase.from('tracks').select('album'),
    ]);

    // 按 album 字段聚合 tracks 歌曲数
    const trackCountMap: Record<string, number> = {};
    for (const t of (tracksRes.data || [])) {
      const key = (t.album || '').trim();
      if (key) trackCountMap[key] = (trackCountMap[key] || 0) + 1;
    }

    const data = (albumsRes.data || []).map((a: any) => ({
      ...a,
      track_count: trackCountMap[(a.name || '').trim()] || 0,
    }));

    const total = albumsRes.count || 0;
    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    console.error('Admin albums all error:', error);
    return NextResponse.json(
      { data: [], pagination: { page, limit, total: 0, totalPages: 1 } },
      { status: 500 },
    );
  }
}
