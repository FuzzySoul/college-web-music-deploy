import { NextResponse } from 'next/server';
import { cacheFetch } from '@/lib/cache-fetch';
import { getServiceSupabaseOrThrow } from '@/lib/supabase-service';

function getSupabase() {
  return getServiceSupabaseOrThrow();
}

export async function GET() {
  try {
    const cached = await cacheFetch('/api/cache/admin/stats');
    if (cached) {
      return NextResponse.json(cached);
    }

    const supabase = getSupabase();

    const [usersRes, artistsRes, tracksRes, playlistsRes, externalPlaylistsRes, favoritesRes, playlistFavoritesRes, commentsRes] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('artists').select('id', { count: 'exact', head: true }),
      supabase.from('tracks').select('id', { count: 'exact', head: true }),
      supabase.from('playlists').select('id', { count: 'exact', head: true }),
      supabase.from('external_playlists').select('id', { count: 'exact', head: true }),
      supabase.from('favorites').select('id', { count: 'exact', head: true }),
      supabase.from('playlist_favorites').select('id', { count: 'exact', head: true }),
      supabase.from('comments').select('*').eq('is_deleted', false).order('created_at', { ascending: false }).limit(5),
    ]);

    return NextResponse.json({
      users: usersRes.count || 0,
      artists: artistsRes.count || 0,
      tracks: tracksRes.count || 0,
      playlists: (playlistsRes.count || 0) + (externalPlaylistsRes.count || 0),
      localPlaylists: playlistsRes.count || 0,
      externalPlaylists: externalPlaylistsRes.count || 0,
      favorites: favoritesRes.count || 0,
      playlistFavorites: playlistFavoritesRes.count || 0,
      recentComments: commentsRes.data || [],
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
