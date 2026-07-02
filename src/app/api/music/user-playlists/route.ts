import { NextResponse } from 'next/server';
import { cacheFetch } from '@/lib/cache-fetch';
import { getServiceSupabaseOrThrow } from '@/lib/supabase-service';

function getSupabaseAdmin() {
  return getServiceSupabaseOrThrow();
}

interface UserPlaylist {
  id: string;
  name: string;
  description?: string;
  cover: string | null;
  trackCount: number;
  source: 'local' | 'external' | 'custom';
  is_public?: boolean;
  platform_source?: string | null;
  createdAt: string;
}

export async function GET() {
  try {
    const cached = await cacheFetch<{ local: any[]; external: any[] }>('/api/cache/playlists');
    if (cached !== null) {
      const formattedLocal: UserPlaylist[] = (cached.local || []).map((playlist: any) => ({
        id: playlist.id,
        name: playlist.name,
        description: playlist.description || '',
        cover: playlist.cover || null,
        trackCount: 0,
        source: 'local' as const,
        is_public: playlist.is_public ?? true,
        platform_source: playlist.platform_source || null,
        createdAt: playlist.created_at,
      }));
      const formattedExternal: UserPlaylist[] = (cached.external || []).map((playlist: any) => ({
        id: `external-${playlist.id}`,
        name: playlist.name,
        cover: playlist.cover_url || null,
        trackCount: playlist.track_count || 0,
        source: (playlist.source === 'custom' ? 'custom' : 'external') as 'custom' | 'external',
        createdAt: playlist.created_at,
      }));
      const allPlaylists = [...formattedLocal, ...formattedExternal].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      return NextResponse.json({ success: true, data: allPlaylists, count: allPlaylists.length });
    }

    const supabase = getSupabaseAdmin();

    const { data: localPlaylists, error: localError } = await supabase
      .from('playlists')
      .select('id, name, cover, description, is_public, platform_source, created_at')
      .order('created_at', { ascending: false });

    if (localError) {
      console.error('获取本地歌单失败:', localError);
      return NextResponse.json({ error: localError.message }, { status: 500 });
    }

    const { data: externalPlaylists, error: externalError } = await supabase
      .from('external_playlists')
      .select('id, name, cover_url, track_count, source, created_at')
      .order('created_at', { ascending: false });

    if (externalError) {
      console.error('获取外部歌单失败:', externalError);
      return NextResponse.json({ error: externalError.message }, { status: 500 });
    }

    const formattedLocal: UserPlaylist[] = (localPlaylists || []).map((playlist) => ({
      id: playlist.id,
      name: playlist.name,
      description: playlist.description || '',
      cover: playlist.cover || null,
      trackCount: 0,
      source: 'local' as const,
      is_public: playlist.is_public ?? true,
      platform_source: playlist.platform_source || null,
      createdAt: playlist.created_at,
    }));

    const formattedExternal: UserPlaylist[] = (externalPlaylists || []).map((playlist) => ({
      id: `external-${playlist.id}`,
      name: playlist.name,
      cover: playlist.cover_url || null,
      trackCount: playlist.track_count || 0,
      source: (playlist.source === 'custom' ? 'custom' : 'external') as 'custom' | 'external',
      createdAt: playlist.created_at,
    }));

    const allPlaylists = [...formattedLocal, ...formattedExternal].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({
      success: true,
      data: allPlaylists,
      count: allPlaylists.length,
    });
  } catch (error) {
    console.error('获取用户歌单列表失败:', error);
    return NextResponse.json(
      { error: '获取用户歌单列表失败' },
      { status: 500 }
    );
  }
}
