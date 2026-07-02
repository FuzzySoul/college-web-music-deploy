'use client';

import { useCallback, useRef } from 'react';

interface TrackPlayRequest {
  trackId: string;
  platform: string;
  duration?: number;
}

interface TrackPlayResponse {
  success: boolean;
  playCount?: number;
  lastPlayedAt?: string;
  error?: string;
}

export function usePlayTracker() {
  const trackedIds = useRef<Set<string>>(new Set());

  const trackPlay = useCallback(async (
    trackId: string,
    platform: string,
    duration?: number
  ): Promise<void> => {
    if (trackedIds.current.has(trackId)) {
      console.log(`[PlayTracker] Track ${trackId} already tracked in this session`);
      return;
    }

    trackedIds.current.add(trackId);

    const request: TrackPlayRequest = {
      trackId,
      platform,
      duration,
    };

    try {
      const response = await fetch('/api/stats/track-play', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      const result: TrackPlayResponse = await response.json();

      if (result.success) {
        console.log(`[PlayTracker] Track ${trackId} play counted. Total: ${result.playCount}`);
      } else {
        console.error(`[PlayTracker] Failed to track play for ${trackId}: ${result.error}`);
      }
    } catch (error) {
      console.error(`[PlayTracker] Network error tracking play for ${trackId}:`, error);
    }
  }, []);

  const isTracked = useCallback((trackId: string): boolean => {
    return trackedIds.current.has(trackId);
  }, []);

  const resetTracker = useCallback(() => {
    trackedIds.current.clear();
    console.log('[PlayTracker] Tracker reset for new session');
  }, []);

  return {
    trackPlay,
    isTracked,
    resetTracker,
  };
}
