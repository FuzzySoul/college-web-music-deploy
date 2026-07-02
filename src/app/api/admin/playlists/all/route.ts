import { NextResponse } from 'next/server';
import { cacheFetch } from '@/lib/cache-fetch';
import { getServiceSupabaseOrThrow } from '@/lib/supabase-service';

function getSupabase() {
  return getServiceSupabaseOrThrow();
}

// 把 user 信息补到每条记录上（user_id → created_by）
function attachCreatedBy(rows: any[] | null | undefined, userMap: Record<string, string>) {
  return (rows || []).map((p: any) => ({
    ...p,
    created_by: p.user_id
      ? (userMap[p.user_id] || '站内用户')
      : '未知用户',
  }));
}

export async function GET() {
  // 1️⃣ 优先读 FastAPI 缓存（预热过，亚毫秒返回）
  const cached = await cacheFetch<{ local: any[]; external: any[]; users: any[] }>(
    '/api/cache/admin/playlists/all',
  );
  if (cached && Array.isArray(cached.local) && Array.isArray(cached.external)) {
    return NextResponse.json({ local: cached.local, external: cached.external });
  }

  // 2️⃣ 缓存未命中：直接查 Supabase（用嵌入式 JOIN，1 次拉够）
  try {
    const supabase = getSupabase();
    const [localRes, externalRes, countsRes, usersRes] = await Promise.all([
      supabase
        .from('playlists')
        .select('id,name,description,cover,is_public,platform_source,external_playlist_id,platform_playlist_id,track_count,created_at,user_id,user:users(username,email)')
        .order('created_at', { ascending: false }),
      supabase
        .from('external_playlists')
        .select('id,name,cover_url,track_count,platform_id,platform_playlist_id,source,created_at,user_id,user:users(username,email)')
        .order('created_at', { ascending: false }),
      supabase.from('playlist_tracks').select('playlist_id'),
      supabase.from('users').select('id,username,email'),
    ]);

    // 兜底 userMap：JOIN 失败时仍能补 username
    const userMap: Record<string, string> = {};
    for (const u of (usersRes.data || [])) {
      userMap[u.id] = u.username || u.email?.split('@')[0] || '站内用户';
    }

    const countMap: Record<string, number> = {};
    for (const item of (countsRes.data || [])) {
      countMap[item.playlist_id] = (countMap[item.playlist_id] || 0) + 1;
    }

    // 优先用嵌入式 JOIN 返回的 user.username，否则走 userMap 兜底
    const local = (localRes.data || []).map((p: any) => ({
      ...p,
      user: undefined, // 不外泄嵌套对象
      track_count: countMap[p.id] || 0,
      created_by: p.user?.username
        || p.user?.email?.split('@')[0]
        || (p.user_id ? (userMap[p.user_id] || '站内用户') : '未知用户'),
    }));

    const external = (externalRes.data || []).map((p: any) => {
      const userName = p.user?.username || p.user?.email?.split('@')[0]
        || (p.user_id ? (userMap[p.user_id] || '站内用户') : '未知用户');
      const created_by = p.source === 'platform' ? `${userName} 同步` : userName;
      return { ...p, user: undefined, created_by };
    });

    return NextResponse.json({ local, external });
  } catch (error) {
    console.error('Admin playlists all error:', error);
    return NextResponse.json({ local: [], external: [] }, { status: 500 });
  }
}
