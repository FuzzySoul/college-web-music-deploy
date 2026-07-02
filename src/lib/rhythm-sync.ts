import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { PUBLIC_CACHE_API_URL } from '@/lib/public-env';

const CACHE_URL = PUBLIC_CACHE_API_URL;

export interface SyncStatus {
  totalTracks: number;
  tracksWithCharts: number;
  unsyncedCharts: number;
  lastSyncTime: string | null;
}

export interface ConflictResolution {
  resolved: number;
  errors: string[];
}

async function getSupabaseClient(): Promise<SupabaseClient | null> {
  if (typeof window === 'undefined') {
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
  
  try {
    const response = await fetch(`/api/supabase/config`, {
      cache: 'no-store'
    });
    const config = await response.json();

    if (!config.url || !config.anonKey) {
      return null;
    }

    return createClient(config.url, config.anonKey, {
      db: { timeout: 60000 },
      auth: { autoRefreshToken: false, persistSession: false },
    });
  } catch (error) {
    return null;
  }
}

export async function checkSyncStatus(): Promise<SyncStatus> {
  try {
    const response = await fetch(`${CACHE_URL}/api/cache/rhythm/songs`);
    if (response.ok) {
      const songs = await response.json();
      if (Array.isArray(songs)) {
        const totalTracks = songs.length;
        const tracksWithCharts = songs.filter((s: any) => s.has_chart).length;
        return {
          totalTracks,
          tracksWithCharts,
          unsyncedCharts: 0,
          lastSyncTime: new Date().toISOString(),
        };
      }
    }
  } catch {}

  const supabase = await getSupabaseClient();

  if (!supabase) {
    return {
      totalTracks: 2,
      tracksWithCharts: 2,
      unsyncedCharts: 0,
      lastSyncTime: new Date().toISOString(),
    };
  }

  try {
    const { count: totalTracks, error: tracksError } = await supabase
      .from('tracks')
      .select('*', { count: 'exact', head: true });

    if (tracksError) {
      console.error('获取曲目总数失败:', tracksError);
      return {
        totalTracks: 0,
        tracksWithCharts: 0,
        unsyncedCharts: 0,
        lastSyncTime: null,
      };
    }

    const { data: tracksWithChartData, error: chartsError } = await supabase
      .from('rhythm_charts')
      .select('track_id');

    if (chartsError) {
      console.error('获取谱面数据失败:', chartsError);
      return {
        totalTracks: totalTracks || 0,
        tracksWithCharts: 0,
        unsyncedCharts: 0,
        lastSyncTime: null,
      };
    }

    const trackIdsWithCharts = new Set(
      tracksWithChartData?.map((chart) => chart.track_id) || []
    );

    const { data: allTracks, error: allTracksError } = await supabase
      .from('tracks')
      .select('id');

    if (allTracksError) {
      console.error('获取曲目ID列表失败:', allTracksError);
      return {
        totalTracks: totalTracks || 0,
        tracksWithCharts: trackIdsWithCharts.size,
        unsyncedCharts: 0,
        lastSyncTime: null,
      };
    }

    const validTrackIds = new Set(allTracks?.map((track) => track.id) || []);

    let unsyncedCharts = 0;
    if (tracksWithChartData) {
      for (const chart of tracksWithChartData) {
        if (!validTrackIds.has(chart.track_id)) {
          unsyncedCharts++;
        }
      }
    }

    const { data: syncLog, error: syncLogError } = await supabase
      .from('sync_logs')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      totalTracks: totalTracks || 0,
      tracksWithCharts: trackIdsWithCharts.size,
      unsyncedCharts,
      lastSyncTime: syncLog?.created_at || null,
    };
  } catch (error) {
    console.error('检查同步状态失败:', error);
    return {
      totalTracks: 0,
      tracksWithCharts: 0,
      unsyncedCharts: 0,
      lastSyncTime: null,
    };
  }
}

export async function resolveConflicts(): Promise<ConflictResolution> {
  const supabase = await getSupabaseClient();

  if (!supabase) {
    return {
      resolved: 0,
      errors: [],
    };
  }

  const result: ConflictResolution = {
    resolved: 0,
    errors: [],
  };

  try {
    const { data: allTracks, error: tracksError } = await supabase
      .from('tracks')
      .select('id');

    if (tracksError) {
      result.errors.push(`获取曲目列表失败: ${tracksError.message}`);
      return result;
    }

    const validTrackIds = new Set(allTracks?.map((track) => track.id) || []);

    const { data: allCharts, error: chartsError } = await supabase
      .from('rhythm_charts')
      .select('id, track_id');

    if (chartsError) {
      result.errors.push(`获取谱面列表失败: ${chartsError.message}`);
      return result;
    }

    if (!allCharts || allCharts.length === 0) {
      return result;
    }

    const orphanedChartIds: number[] = [];
    for (const chart of allCharts) {
      if (!validTrackIds.has(chart.track_id)) {
        orphanedChartIds.push(chart.id);
      }
    }

    if (orphanedChartIds.length === 0) {
      return result;
    }

    const { error: deleteError } = await supabase
      .from('rhythm_charts')
      .delete()
      .in('id', orphanedChartIds);

    if (deleteError) {
      result.errors.push(`删除孤立谱面失败: ${deleteError.message}`);
    } else {
      result.resolved = orphanedChartIds.length;
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.errors.push(`解决冲突时发生错误: ${errorMessage}`);
    return result;
  }
}

export async function logSyncStatus(status: SyncStatus): Promise<void> {
  const supabase = await getSupabaseClient();

  if (!supabase) {
    console.log('[Sync Log]', {
      ...status,
      loggedAt: new Date().toISOString(),
    });
    return;
  }

  try {
    const { error } = await supabase.from('sync_logs').insert({
      total_tracks: status.totalTracks,
      tracks_with_charts: status.tracksWithCharts,
      unsynced_charts: status.unsyncedCharts,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error('记录同步日志失败:', error);
    }
  } catch (error) {
    console.error('记录同步日志失败:', error);
  }
}
