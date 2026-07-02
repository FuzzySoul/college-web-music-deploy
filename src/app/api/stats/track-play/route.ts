import { NextResponse } from 'next/server';
import { cacheInvalidate } from '@/lib/cache-fetch';
import { getServiceSupabaseOrThrow } from '@/lib/supabase-service';

async function getSupabaseAdmin() {
  return getServiceSupabaseOrThrow();
}

interface TrackPlayRequest {
  trackId: string;
  platform: string;
  duration?: number;
}

export async function POST(request: Request) {
  try {
    const body: TrackPlayRequest = await request.json();

    if (!body.trackId || !body.platform) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: trackId and platform' },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseAdmin();

    const { data: track, error: fetchError } = await supabase
      .from('external_playlist_tracks')
      .select('id, play_count')
      .eq('id', body.trackId)
      .single();

    if (fetchError || !track) {
      console.error('[TrackPlay API] Track not found:', body.trackId, fetchError);
      return NextResponse.json(
        { success: false, error: 'Track not found' },
        { status: 404 }
      );
    }

    const currentPlayCount = track.play_count || 0;
    const newPlayCount = currentPlayCount + 1;
    const now = new Date().toISOString();

    const { data: updatedTrack, error: updateError } = await supabase
      .from('external_playlist_tracks')
      .update({
        play_count: newPlayCount,
        last_played_at: now,
      })
      .eq('id', body.trackId)
      .select('play_count, last_played_at')
      .single();

    if (updateError) {
      console.error('[TrackPlay API] Failed to update play count:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update play count' },
        { status: 500 }
      );
    }

    console.log(`[TrackPlay API] Track ${body.trackId} play count updated: ${currentPlayCount} -> ${newPlayCount}`);

    await cacheInvalidate(['stats:tracks', 'admin:stats']);
    return NextResponse.json({
      success: true,
      playCount: updatedTrack?.play_count || newPlayCount,
      lastPlayedAt: updatedTrack?.last_played_at || now,
    });
  } catch (error) {
    console.error('[TrackPlay API] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
