import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PUBLIC_CACHE_API_URL } from '@/lib/public-env';

const CACHE_URL = PUBLIC_CACHE_API_URL;

export interface Track {
  id: number;
  title: string;
  artist: string;
  album: string | null;
  cover: string | null;
  duration: number;
  source: string;
  source_id: string | null;
  play_url: string | null;
  lyrics: string | null;
  mv_url: string | null;
  mv_cover: string | null;
  created_at: string;
}

export interface Playlist {
  id: number;
  name: string;
  description: string | null;
  cover: string | null;
  user_id: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  platform_source?: string;
  external_playlist_id?: string;
  platform_playlist_id?: string;
}

export interface Favorite {
  id: number;
  track_id: number;
  user_id: string | null;
  created_at: string;
}

let client: SupabaseClient | null = null;
let isConfigured = false;
let configChecked = false;

async function getClient(): Promise<SupabaseClient | null> {
  if (client) return client;
  if (configChecked && !isConfigured) return null;

  try {
    const response = await fetch('/api/supabase/config');
    const config = await response.json();

    if (!config.url || !config.anonKey) {
      configChecked = true;
      isConfigured = false;
      console.log('Supabase 未配置，使用本地模拟数据');
      return null;
    }

    client = createClient(config.url, config.anonKey, {
      db: { timeout: 60000 },
      auth: { autoRefreshToken: true, persistSession: true },
    });

    configChecked = true;
    isConfigured = true;
    return client;
  } catch (error) {
    configChecked = true;
    isConfigured = false;
    console.log('Supabase 配置获取失败，使用本地模拟数据');
    return null;
  }
}

export class MusicService {
  async getTracks(limit = 50): Promise<Track[]> {
    try {
      const response = await fetch(`${CACHE_URL}/api/cache/tracks?limit=${limit}`);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) return data;
      }
    } catch {}

    try {
      const supabase = await getClient();
      if (!supabase) return [];

      const { data, error } = await supabase
        .from('tracks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('获取歌曲失败:', error);
        return [];
      }
      return data || [];
    } catch (error) {
      console.error('获取歌曲失败:', error);
      return [];
    }
  }

  async searchTracks(query: string): Promise<Track[]> {
    try {
      const response = await fetch(`${CACHE_URL}/api/cache/tracks?limit=20&search=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) return data;
      }
    } catch {}

    try {
      const supabase = await getClient();
      if (!supabase) return [];

      const { data, error } = await supabase
        .from('tracks')
        .select('*')
        .or(`title.ilike.%${query}%,artist.ilike.%${query}%,album.ilike.%${query}%`)
        .limit(20);

      if (error) {
        console.error('搜索歌曲失败:', error);
        return [];
      }
      return data || [];
    } catch (error) {
      console.error('搜索歌曲失败:', error);
      return [];
    }
  }

  async addTrack(track: Omit<Track, 'id' | 'created_at'>): Promise<Track | null> {
    try {
      const supabase = await getClient();
      if (!supabase) return null;

      const { data, error } = await supabase
        .from('tracks')
        .insert(track)
        .select()
        .single();

      if (error) {
        console.error('添加歌曲失败:', error);
        return null;
      }
      return data;
    } catch (error) {
      console.error('添加歌曲失败:', error);
      return null;
    }
  }

  async getPlaylists(): Promise<Playlist[]> {
    try {
      const response = await fetch(`${CACHE_URL}/api/cache/playlists`);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) return data;
      }
    } catch {}

    try {
      const supabase = await getClient();
      if (!supabase) return [];

      const { data, error } = await supabase
        .from('playlists')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('获取歌单失败:', error);
        return [];
      }
      return data || [];
    } catch (error) {
      console.error('获取歌单失败:', error);
      return [];
    }
  }

  async getPlaylistTracks(playlistId: number): Promise<Track[]> {
    try {
      const response = await fetch(`${CACHE_URL}/api/cache/playlists/${playlistId}/tracks?source=local`);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          return data.map((d: any) => d.tracks || d).filter(Boolean);
        }
      }
    } catch {}

    try {
      const supabase = await getClient();
      if (!supabase) return [];

      const { data, error } = await supabase
        .from('playlist_tracks')
        .select('track_id, position')
        .eq('playlist_id', playlistId)
        .order('position', { ascending: true });

      if (error || !data) {
        console.error('获取歌单歌曲失败:', error);
        return [];
      }

      const trackIds = data.map(d => d.track_id);
      if (trackIds.length === 0) return [];

      const { data: tracks, error: tracksError } = await supabase
        .from('tracks')
        .select('*')
        .in('id', trackIds);

      if (tracksError) {
        console.error('获取歌曲失败:', tracksError);
        return [];
      }

      const trackMap = new Map(tracks?.map(t => [t.id, t]));
      return data.map(d => trackMap.get(d.track_id)).filter(Boolean) as Track[];
    } catch (error) {
      console.error('获取歌单歌曲失败:', error);
      return [];
    }
  }

  async getFavorites(userId?: string): Promise<Track[]> {
    try {
      const supabase = await getClient();
      if (!supabase) return [];

      // 查询当前用户的 favorites (本地 + external)
      let favQuery = supabase
        .from('favorites')
        .select('track_id, external_track_id, created_at')
        .order('created_at', { ascending: false });
      if (userId) favQuery = favQuery.eq('user_id', userId);

      const { data, error } = await favQuery;
      if (error || !data) {
        console.error('获取收藏失败:', error);
        return [];
      }

      const trackIds = data.map(d => d.track_id).filter((id): id is number => id != null);
      const externalIds = data.map(d => d.external_track_id).filter((id): id is string => id != null);

      if (trackIds.length === 0 && externalIds.length === 0) return [];

      const result: Track[] = [];

      // 本地 tracks 走 FastAPI 缓存（已在 fastapi-cache-service 中预热）
      if (trackIds.length > 0) {
        try {
          const response = await fetch(`${CACHE_URL}/api/cache/tracks?limit=500`);
          if (response.ok) {
            const allTracks: Track[] = await response.json();
            if (Array.isArray(allTracks)) {
              const trackMap = new Map(allTracks.map(t => [t.id, t]));
              for (const id of trackIds) {
                const t = trackMap.get(id);
                if (t) result.push(t);
              }
            }
          }
        } catch {}
        // 缓存未命中时 fallback 直接查 Supabase
        if (result.length === 0) {
          const { data: tracks } = await supabase
            .from('tracks')
            .select('*')
            .in('id', trackIds);
          if (tracks) result.push(...(tracks as Track[]));
        }
      }

      // external 歌单歌曲：直查 external_playlist_tracks
      if (externalIds.length > 0) {
        const { data: extTracks } = await supabase
          .from('external_playlist_tracks')
          .select('id, track_title, track_artist, track_duration, platform_track_id')
          .in('id', externalIds);
        if (extTracks) {
          for (const et of extTracks) {
            // 用 ext-xxx 格式与前端 search 行为一致
            result.push({
              id: `ext-${et.id}` as any,
              title: et.track_title || '未知歌曲',
              artist: et.track_artist || '未知艺术家',
              album: null,
              cover: null,
              duration: et.track_duration || 0,
              source: 'external',
              source_id: et.platform_track_id,
              play_url: null,
              lyrics: null,
              mv_url: null,
              mv_cover: null,
              created_at: '',
            } as Track);
          }
        }
      }

      return result;
    } catch (error) {
      console.error('获取收藏失败:', error);
      return [];
    }
  }

  /**
   * 兜底：根据 track id 列表从 tracks 表拉取详情（用于收藏页）
   */
  async getTracksByIds(ids: number[]): Promise<Track[]> {
    if (ids.length === 0) return [];
    try {
      // 优先走 FastAPI 缓存
      try {
        const response = await fetch(`${CACHE_URL}/api/cache/tracks?limit=500`);
        if (response.ok) {
          const allTracks: Track[] = await response.json();
          if (Array.isArray(allTracks)) {
            const map = new Map(allTracks.map(t => [t.id, t]));
            return ids.map(id => map.get(id)).filter((t): t is Track => Boolean(t));
          }
        }
      } catch {}
      // fallback 直接查 Supabase
      const supabase = await getClient();
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('tracks')
        .select('*')
        .in('id', ids);
      if (error) {
        console.error('getTracksByIds 失败:', error);
        return [];
      }
      return (data as Track[]) || [];
    } catch (error) {
      console.error('getTracksByIds 失败:', error);
      return [];
    }
  }

  /**
   * 切换歌曲收藏：支持本地 tracks (number) 和 external (string `ext-xxx`)
   */
  async toggleFavorite(trackId: number | string, userId?: string): Promise<boolean> {
    try {
      if (!userId) {
        console.warn('收藏失败：用户未登录');
        return false;
      }
      const supabase = await getClient();
      if (!supabase) return false;

      // 判断是 external 收藏（id 以 "ext-" 开头）还是本地 tracks
      const isExternal = typeof trackId === 'string' && trackId.startsWith('ext-');
      const externalId = isExternal ? (trackId as string).slice(4) : null;
      const realTrackId = !isExternal ? Number(trackId) : null;

      // 查询现有收藏
      let q = supabase.from('favorites').select('id');
      q = isExternal
        ? q.eq('external_track_id', externalId)
        : q.eq('track_id', realTrackId);
      const { data: existing } = await q.eq('user_id', userId).maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('id', existing.id);
        return !error;
      } else {
        const insertData: any = { user_id: userId };
        if (isExternal) insertData.external_track_id = externalId;
        else insertData.track_id = realTrackId;
        const { error } = await supabase
          .from('favorites')
          .insert(insertData);
        return !error;
      }
    } catch (error) {
      console.error('收藏操作失败:', error);
      return false;
    }
  }

  async togglePlaylistFavorite(playlistId: string, userId: string): Promise<boolean> {
    try {
      const supabase = await getClient();
      if (!supabase) return false;

      const { data: existing } = await supabase
        .from('playlist_favorites')
        .select('id')
        .eq('playlist_id', playlistId)
        .eq('user_id', userId)
        .single();

      if (existing) {
        const { error } = await supabase
          .from('playlist_favorites')
          .delete()
          .eq('playlist_id', playlistId)
          .eq('user_id', userId);
        return !error;
      } else {
        const { error } = await supabase
          .from('playlist_favorites')
          .insert({ playlist_id: playlistId, user_id: userId });
        return !error;
      }
    } catch (error) {
      console.error('歌单收藏操作失败:', error);
      return false;
    }
  }

  async getPlaylistFavoriteCount(playlistId: string): Promise<number> {
    try {
      const supabase = await getClient();
      if (!supabase) return 0;

      const { count, error } = await supabase
        .from('playlist_favorites')
        .select('*', { count: 'exact', head: true })
        .eq('playlist_id', playlistId);

      if (error) {
        console.error('获取歌单收藏数失败:', error);
        return 0;
      }
      return count || 0;
    } catch (error) {
      console.error('获取歌单收藏数失败:', error);
      return 0;
    }
  }

  async getPlaylistFavorites(playlistId: string): Promise<{
    user_id: string;
    username: string;
    avatar_url: string | null;
    created_at: string;
  }[]> {
    try {
      const supabase = await getClient();
      if (!supabase) return [];

      const { data, error } = await supabase
        .from('playlist_favorites')
        .select(`
          user_id,
          created_at,
          users:user_id (
            username,
            avatar_url
          )
        `)
        .eq('playlist_id', playlistId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('获取收藏者列表失败:', error);
        return [];
      }
      return (data || []).map((d: any) => ({
        user_id: d.user_id,
        username: d.users?.username || '未知用户',
        avatar_url: d.users?.avatar_url || null,
        created_at: d.created_at,
      }));
    } catch (error) {
      console.error('获取收藏者列表失败:', error);
      return [];
    }
  }

  async isPlaylistFavorited(playlistId: string, userId: string): Promise<boolean> {
    try {
      const supabase = await getClient();
      if (!supabase) return false;

      const { data, error } = await supabase
        .from('playlist_favorites')
        .select('id')
        .eq('playlist_id', playlistId)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('检查歌单收藏状态失败:', error);
        return false;
      }
      return !!data;
    } catch (error) {
      console.error('检查歌单收藏状态失败:', error);
      return false;
    }
  }

  async getUserFavoritePlaylistIds(userId: string): Promise<string[]> {
    try {
      const supabase = await getClient();
      if (!supabase) return [];

      const { data, error } = await supabase
        .from('playlist_favorites')
        .select('playlist_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('获取用户收藏歌单ID失败:', error);
        return [];
      }
      return data?.map(d => d.playlist_id) || [];
    } catch (error) {
      console.error('获取用户收藏歌单ID失败:', error);
      return [];
    }
  }

  async addPlayHistory(trackId: number, userId?: string, durationPlayed = 0): Promise<void> {
    try {
      const supabase = await getClient();
      if (!supabase) return;

      await supabase
        .from('play_history')
        .insert({
          track_id: trackId,
          user_id: userId || null,
          duration_played: durationPlayed,
        });
    } catch (error) {
      console.error('添加播放历史失败:', error);
    }
  }
}

export const musicService = new MusicService();
