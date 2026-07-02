'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { ExternalPlaylistTrack } from './types';
import { usePlaylistStore, addPreloadedTrackId, hasPreloadedTrack } from './stores/usePlaylistStore';

interface CachedUrl {
  url: string;
  thumbnail?: string;
  source: string;
  timestamp: number;
  expiresAt: number;
}

// 缓存有效期：4小时（YouTube/Bilibili直链通常只有2-6小时有效期）
const CACHE_DURATION = 4 * 60 * 60 * 1000;

// 根据搜索配置确定缓存源类型
function getCacheSourceType(youtubeCount: number, bilibiliCount: number): string {
  if (youtubeCount > 0 && bilibiliCount > 0) return 'mixed';
  if (bilibiliCount > 0) return 'bilibili';
  return 'youtube'; // 默认 youtube
}

// 生成缓存 key（包含播放源信息）
function generateCacheKey(title: string, artist: string, sourceType: string): string {
  return `${title}___${artist}___${sourceType}`;
}

// 统一使用 localStorage 作为缓存，与 layout.tsx 保持一致
// 支持传入播放源参数，如果不传则尝试所有可能的源（向后兼容）
function getCachedUrl(
  title: string, 
  artist: string, 
  youtubeCount?: number, 
  bilibiliCount?: number
): CachedUrl | null {
  if (typeof window === 'undefined') return null;
  try {
    const cache = localStorage.getItem('trackUrlCache');
    if (!cache) return null;
    const cacheObj = JSON.parse(cache);
    
    // 如果提供了搜索配置，使用特定源的缓存
    if (youtubeCount !== undefined && bilibiliCount !== undefined) {
      const sourceType = getCacheSourceType(youtubeCount, bilibiliCount);
      const key = generateCacheKey(title, artist, sourceType);
      const cached = cacheObj[key];
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return {
          url: cached.url,
          thumbnail: cached.thumbnail,
          source: cached.source || 'cached',
          timestamp: cached.timestamp,
          expiresAt: cached.timestamp + CACHE_DURATION,
        };
      }
    }
    
    // 向后兼容：尝试旧格式缓存（不带源信息）
    const oldKey = `${title}___${artist}`;
    const oldCached = cacheObj[oldKey];
    if (oldCached && Date.now() - oldCached.timestamp < CACHE_DURATION) {
      return {
        url: oldCached.url,
        thumbnail: oldCached.thumbnail,
        source: oldCached.source || 'cached',
        timestamp: oldCached.timestamp,
        expiresAt: oldCached.timestamp + CACHE_DURATION,
      };
    }
    
    return null;
  } catch {
    return null;
  }
}

function setCachedUrl(
  title: string, 
  artist: string, 
  url: string, 
  thumbnail: string | undefined, 
  source: string,
  youtubeCount?: number,
  bilibiliCount?: number
): void {
  if (typeof window === 'undefined') return;
  try {
    const cache = localStorage.getItem('trackUrlCache');
    const cacheObj = cache ? JSON.parse(cache) : {};
    
    // 使用新的带源信息的 key
    const sourceType = (youtubeCount !== undefined && bilibiliCount !== undefined) 
      ? getCacheSourceType(youtubeCount, bilibiliCount)
      : 'youtube'; // 默认
    const key = generateCacheKey(title, artist, sourceType);
    
    cacheObj[key] = {
      url,
      thumbnail,
      source,
      timestamp: Date.now(),
    };
    localStorage.setItem('trackUrlCache', JSON.stringify(cacheObj));
  } catch (e) {
    console.error('Failed to save to cache:', e);
  }
}

// 清除指定歌曲的缓存（清除所有源的缓存）
export function clearCachedUrl(title: string, artist: string): void {
  if (typeof window === 'undefined') return;
  try {
    const cache = localStorage.getItem('trackUrlCache');
    if (!cache) return;
    const cacheObj = JSON.parse(cache);
    let cleared = false;
    
    // 清除所有可能的缓存 key
    const sourceTypes = ['youtube', 'bilibili', 'mixed'];
    for (const sourceType of sourceTypes) {
      const key = generateCacheKey(title, artist, sourceType);
      if (cacheObj[key]) {
        delete cacheObj[key];
        cleared = true;
        console.log('[clearCachedUrl] 已清除缓存:', key);
      }
    }
    
    // 向后兼容：清除旧格式缓存
    const oldKey = `${title}___${artist}`;
    if (cacheObj[oldKey]) {
      delete cacheObj[oldKey];
      cleared = true;
      console.log('[clearCachedUrl] 已清除旧格式缓存:', oldKey);
    }
    
    if (cleared) {
      localStorage.setItem('trackUrlCache', JSON.stringify(cacheObj));
    }
  } catch (e) {
    console.error('Failed to clear cache:', e);
  }
}

export function fisherYatesShuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

interface UsePlaylistTrackHandlersProps {
  youtubeCount: number;
  bilibiliCount: number;
  onPlayUrl?: (url: string, title: string, artist: string, thumbnail?: string, onEnded?: () => void, trackId?: number | string) => void;
  externalPlaylistTracks: ExternalPlaylistTrack[];
  onBatchComplete?: () => void;
  onPlayQueue?: (tracks: ExternalPlaylistTrack[], startIndex: number, shouldShuffle: boolean) => void;
  onPreloadProgress?: (current: number, total: number) => void;
  currentQueueIndex?: number;
  isPlaying?: boolean;
  onSetShuffleMode?: (shuffle: boolean) => void;
  playlistId?: string;
}

interface UsePlaylistTrackHandlersReturn {
  downloadingTrackId: string | null;
  batchDownloading: boolean;
  batchProgress: { current: number; total: number };
  preloadProgress: { current: number; total: number; status: 'idle' | 'loading' | 'completed' };
  handlePlayTrack: (track: ExternalPlaylistTrack) => Promise<void>;
  handleDownloadTrack: (track: ExternalPlaylistTrack) => Promise<void>;
  handleBatchDownload: () => Promise<void>;
  handlePlayAll: () => Promise<void>;
  handleShufflePlay: () => Promise<void>;
  preloadAllTracks: () => Promise<void>;
  stopPreload: () => void;
  preloadNextBatch: () => Promise<void>;
  triggerPreloadCheck: () => void;
  // URL刷新相关
  refreshTrackUrl: (track: ExternalPlaylistTrack) => Promise<{ url: string; thumbnail?: string; source: string } | null>;
}

async function extractDirectUrl(
  track: ExternalPlaylistTrack,
  youtubeCount: number,
  bilibiliCount: number,
  signal?: AbortSignal
): Promise<{ url: string; thumbnail?: string; source: string } | null> {
  // 确保参数是数字
  const validYoutubeCount = Math.min(Math.max(Number(youtubeCount) || 0, 0), 10);
  const validBilibiliCount = Math.min(Math.max(Number(bilibiliCount) || 0, 0), 10);

  console.log('[extractDirectUrl] Received counts:', { youtubeCount, bilibiliCount });
  console.log('[extractDirectUrl] Validated counts:', { validYoutubeCount, validBilibiliCount });

  // 早期检查：如果 youtubeCount 和 bilibiliCount 都为 0 或负数，直接返回 null
  if (validYoutubeCount <= 0 && validBilibiliCount <= 0) {
    console.log('[extractDirectUrl] 所有搜索源已禁用，跳过搜索');
    return null;
  }

  try {
    if (signal?.aborted) return null;

    const response = await fetch('/api/music/ytdlp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'createSearchTask',
        trackTitle: track.track_title,
        trackArtist: track.track_artist,
        youtubeCount: validYoutubeCount,
        bilibiliCount: validBilibiliCount,
      }),
      signal,
    });
    
    if (signal?.aborted) return null;
    
    const data = await response.json();
    
    if (data.taskId) {
      let attempts = 0;
      const maxAttempts = 30;
      
      while (attempts < maxAttempts) {
        if (signal?.aborted) return null;
        
        const statusResponse = await fetch('/api/music/ytdlp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'getTaskStatus',
            taskId: data.taskId,
          }),
          signal,
        });
        
        if (signal?.aborted) return null;
        
        const statusData = await statusResponse.json();
        
        if (statusData.status === 'completed' && statusData.results && statusData.results.length > 0) {
          const result = statusData.results[0];
          
          if (signal?.aborted) return null;
          
          const urlResponse = await fetch('/api/music/ytdlp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'getUrl',
              songId: result.id,
              source: result.source,
              directUrl: result.url,
            }),
            signal,
          });
          
          if (signal?.aborted) return null;
          
          const urlData = await urlResponse.json();
          
          if (urlData.success && urlData.url) {
            return {
              url: urlData.url,
              thumbnail: result.thumbnail,
              source: result.source,
            };
          }
          return null;
        } else if (statusData.status === 'failed') {
          return null;
        }
        
        await new Promise((resolve, reject) => {
          const timeoutId = setTimeout(resolve, 1000);
          signal?.addEventListener('abort', () => {
            clearTimeout(timeoutId);
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
        attempts++;
      }
    }
    return null;
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      return null;
    }
    console.error('提取URL失败:', error);
    return null;
  }
}

export function usePlaylistTrackHandlers({
  youtubeCount,
  bilibiliCount,
  onPlayUrl,
  externalPlaylistTracks,
  onBatchComplete,
  onPlayQueue,
  onPreloadProgress,
  currentQueueIndex = 0,
  isPlaying = false,
  onSetShuffleMode,
  playlistId,
}: UsePlaylistTrackHandlersProps): UsePlaylistTrackHandlersReturn {
  const [downloadingTrackId, setDownloadingTrackId] = useState<string | null>(null);
  const [batchDownloading, setBatchDownloading] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [preloadProgress, setPreloadProgress] = useState({ current: 0, total: 0, status: 'idle' as 'idle' | 'loading' | 'completed' });
  
  const {
    preloadBatchSize,
    currentBatchIndex,
    setCurrentBatchIndex,
    setAbortController,
    abortPreload,
    setTracksList,
    setCurrentPlaylistId,
    setFullTracksList,
  } = usePlaylistStore();
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const tracksRef = useRef<ExternalPlaylistTrack[]>(externalPlaylistTracks);
  const currentPlaylistIdRef = useRef<string | null>(null);
  const youtubeCountRef = useRef<number>(youtubeCount);
  const bilibiliCountRef = useRef<number>(bilibiliCount);
  const preloadNextBatchRef = useRef<() => Promise<void>>(async () => {});

  // 同步外部歌单变化到 ref 和 store
  useEffect(() => {
    tracksRef.current = externalPlaylistTracks;
    if (externalPlaylistTracks.length > 0) {
      setTracksList(externalPlaylistTracks.map(t => ({ 
        id: t.id, 
        title: t.track_title, 
        artist: t.track_artist 
      })));
      // 存储完整的歌曲列表到全局 store
      setFullTracksList(externalPlaylistTracks);
      
      // 初始化随机队列（使用原始顺序）
      const store = usePlaylistStore.getState();
      if (store.shuffledQueue.length === 0 || store.shuffledQueue.length !== externalPlaylistTracks.length) {
        usePlaylistStore.setState({ shuffledQueue: externalPlaylistTracks });
      }
    }
  }, [externalPlaylistTracks, setTracksList, setFullTracksList]);

  // 同步搜索计数变化到 ref，确保预加载使用最新值
  useEffect(() => {
    youtubeCountRef.current = youtubeCount;
    bilibiliCountRef.current = bilibiliCount;
  }, [youtubeCount, bilibiliCount]);

  // 同步 playlistId 变化 - 变化时重置预加载状态
  useEffect(() => {
    if (playlistId) {
      const store = usePlaylistStore.getState();
      // 如果切换到新歌单，重置预加载状态
      if (playlistId !== store.currentPlaylistId) {
        usePlaylistStore.setState({
          currentBatchIndex: 0,
          preloadedTrackIds: new Set(),
          isPreloading: false,
          currentPlaylistId: playlistId,
        });
      }
      currentPlaylistIdRef.current = playlistId;
      setCurrentPlaylistId(playlistId);
    }
  }, [playlistId, setCurrentPlaylistId]);

  const getOrExtractDirectUrl = useCallback(async (
    track: ExternalPlaylistTrack,
    signal?: AbortSignal
  ): Promise<{ url: string; thumbnail?: string; source: string } | null> => {
    // 使用 ref 中的最新值，确保预加载时使用的是当前设置
    const currentYoutubeCount = youtubeCountRef.current;
    const currentBilibiliCount = bilibiliCountRef.current;

    console.log('[getOrExtractDirectUrl] Current counts from ref:', { currentYoutubeCount, currentBilibiliCount, youtubeCountRef: youtubeCountRef.current, bilibiliCountRef: bilibiliCountRef.current });

    // 确保值是数字
    const validYoutubeCount = Math.min(Math.max(Number(currentYoutubeCount) || 0, 0), 10);
    const validBilibiliCount = Math.min(Math.max(Number(currentBilibiliCount) || 0, 0), 10);

    console.log('[getOrExtractDirectUrl] Validated counts:', { validYoutubeCount, validBilibiliCount });

    // 早期检查：如果 youtubeCount 和 bilibiliCount 都为 0 或负数，直接返回 null
    if (validYoutubeCount <= 0 && validBilibiliCount <= 0) {
      console.log('[getOrExtractDirectUrl] 所有搜索源已禁用，跳过搜索');
      return null;
    }

    // 使用带播放源参数的缓存查询
    const cached = getCachedUrl(track.track_title, track.track_artist, validYoutubeCount, validBilibiliCount);
    if (cached) {
      console.log('[getOrExtractDirectUrl] 命中缓存:', { source: cached.source, title: track.track_title });
      return cached;
    }

    if (signal?.aborted) return null;

    const result = await extractDirectUrl(track, validYoutubeCount, validBilibiliCount, signal);
    if (result) {
      // 保存缓存时传入播放源参数
      setCachedUrl(track.track_title, track.track_artist, result.url, result.thumbnail, result.source, validYoutubeCount, validBilibiliCount);
      console.log('[getOrExtractDirectUrl] 已保存缓存:', { title: track.track_title, source: result.source, youtubeCount: validYoutubeCount, bilibiliCount: validBilibiliCount });
    }
    return result;
  }, []); // 空依赖数组，使用 ref 获取最新值

  const preloadNextBatch = useCallback(async () => {
    // 优先使用全局 store 中的完整歌曲列表
    const store = usePlaylistStore.getState();
    const tracks = store.fullTracksList.length > 0 ? store.fullTracksList : tracksRef.current;

    if (tracks.length === 0) return;

    if (store.isPreloading) return;

    const startIdx = store.currentBatchIndex * store.preloadBatchSize;
    if (startIdx >= tracks.length) return;

    const endIdx = Math.min(startIdx + store.preloadBatchSize, tracks.length);
    const batchToPreload = tracks.slice(startIdx, endIdx).filter(
      t => !hasPreloadedTrack(t.id)
    );

    if (batchToPreload.length === 0) {
      setCurrentBatchIndex(store.currentBatchIndex + 1);
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setAbortController(controller);

    // 更新 store 状态
    usePlaylistStore.setState({ isPreloading: true });
    setPreloadProgress({ current: startIdx, total: tracks.length, status: 'loading' });

    // 使用 ref 获取最新的搜索配置
    const currentYoutubeCount = youtubeCountRef.current;
    const currentBilibiliCount = bilibiliCountRef.current;

    // 确保值是数字
    const validYoutubeCount = Math.min(Math.max(Number(currentYoutubeCount) || 0, 0), 10);
    const validBilibiliCount = Math.min(Math.max(Number(currentBilibiliCount) || 0, 0), 10);

    console.log('[preloadNextBatch] 使用搜索配置:', { currentYoutubeCount, currentBilibiliCount, validYoutubeCount, validBilibiliCount });

    const concurrency = Math.min(3, batchToPreload.length);

    for (let i = 0; i < batchToPreload.length; i += concurrency) {
      if (controller.signal.aborted) break;

      const batch = batchToPreload.slice(i, i + concurrency);

      const results = await Promise.allSettled(
        batch.map(track => getOrExtractDirectUrl(track, controller.signal))
      );

      results.forEach((result, idx) => {
        if (result.status === 'fulfilled' && result.value) {
          addPreloadedTrackId(batch[idx].id);
        }
      });

      const progress = Math.min(startIdx + i + concurrency, tracks.length);
      setPreloadProgress({ current: progress, total: tracks.length, status: 'loading' });
      onPreloadProgress?.(progress, tracks.length);

      if (i + concurrency < batchToPreload.length && !controller.signal.aborted) {
        await new Promise((resolve, reject) => {
          const timeoutId = setTimeout(resolve, 500);
          controller.signal.addEventListener('abort', () => {
            clearTimeout(timeoutId);
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
      }
    }

    if (!controller.signal.aborted) {
      setCurrentBatchIndex(store.currentBatchIndex + 1);
    }

    usePlaylistStore.setState({ isPreloading: false });
    setAbortController(null);

    const allLoaded = usePlaylistStore.getState().preloadedTrackIds.size >= tracks.length;
    setPreloadProgress(prev => ({
      ...prev,
      status: allLoaded ? 'completed' : 'loading'
    }));
  }, [
    // 移除 getOrExtractDirectUrl 依赖，因为它使用 ref，不会变化
    onPreloadProgress,
    setCurrentBatchIndex,
    setAbortController,
  ]);

  // 同步 preloadNextBatch 到 ref，确保 setTimeout 使用的是最新版本
  useEffect(() => {
    preloadNextBatchRef.current = preloadNextBatch;
  }, [preloadNextBatch]);

  // 主动触发预加载检查的函数 - 供外部调用
  const triggerPreloadCheck = useCallback(() => {
    const store = usePlaylistStore.getState();
    const tracks = store.fullTracksList.length > 0 ? store.fullTracksList : tracksRef.current;
    
    if (!isPlaying || tracks.length === 0) return;
    
    const totalTracks = tracks.length;
    const preloadedCount = store.preloadedTrackIds.size;
    const threshold = 3;
    
    // 使用 store 中的 currentTrackId 来确定当前播放位置
    let currentIndex = -1;
    if (store.currentTrackId) {
      currentIndex = tracks.findIndex((t) => String(t.id) === String(store.currentTrackId));
    }
    
    console.log('[Preload Check]', {
      currentTrackId: store.currentTrackId,
      currentIndex,
      totalTracks,
      preloadedCount,
      isPreloading: store.isPreloading
    });
    
    // 如果找不到当前播放位置，可能是刚开始播放，从第0首开始预加载
    if (currentIndex === -1) {
      currentIndex = 0;
    }
    
    // 计算从当前播放位置往后，还有多少首已经预加载的歌曲
    let preloadedAfterCurrent = 0;
    for (let i = currentIndex + 1; i < tracks.length; i++) {
      if (store.preloadedTrackIds.has(tracks[i].id)) {
        preloadedAfterCurrent++;
      }
    }
    
    // 如果当前播放位置之后的预加载歌曲少于阈值，且还有歌曲未预加载，则触发预加载
    const remainingToPreload = totalTracks - preloadedCount;
    
    console.log('[Preload Check] Calculation:', {
      preloadedAfterCurrent,
      threshold,
      remainingToPreload,
      shouldTrigger: preloadedAfterCurrent <= threshold && remainingToPreload > 0 && !store.isPreloading
    });
    
    if (preloadedAfterCurrent <= threshold && remainingToPreload > 0 && !store.isPreloading) {
      console.log('[Preload] Triggering next batch:', { 
        currentIndex, 
        preloadedAfterCurrent, 
        threshold, 
        remainingToPreload 
      });
      preloadNextBatch();
    }
  }, [isPlaying, preloadNextBatch]);

  // 注意：全局预加载定时器已在 layout.tsx 中实现
  // 这里不再设置定时器，避免双重触发
  // 但保留 triggerPreloadCheck 函数供手动调用

  // 预加载状态已在上面统一处理，此 useEffect 不再需要

  const stopPreload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    usePlaylistStore.setState({ isPreloading: false });
    setAbortController(null);
    setPreloadProgress(prev => ({ ...prev, status: 'idle' }));
  }, [setAbortController]);

  const handlePlayTrack = useCallback(async (track: ExternalPlaylistTrack) => {
    if (!onPlayUrl) return;

    const result = await getOrExtractDirectUrl(track);
    if (result) {
      onPlayUrl(result.url, track.track_title, track.track_artist, result.thumbnail, undefined, track.id);
    } else {
      console.error('获取播放链接失败');
    }
  }, [onPlayUrl, getOrExtractDirectUrl]);

  // 强制刷新歌曲URL（清除缓存后重新获取）
  const refreshTrackUrl = useCallback(async (
    track: ExternalPlaylistTrack
  ): Promise<{ url: string; thumbnail?: string; source: string } | null> => {
    console.log('[refreshTrackUrl] 开始刷新URL:', track.track_title, '-', track.track_artist);
    
    // 1. 清除缓存
    clearCachedUrl(track.track_title, track.track_artist);
    
    // 2. 从 store 中移除预加载标记
    usePlaylistStore.setState((state) => {
      const newPreloadedIds = new Set(state.preloadedTrackIds);
      newPreloadedIds.delete(track.id);
      return { preloadedTrackIds: newPreloadedIds };
    });
    
    // 3. 强制重新获取URL（不使用缓存）
    const currentYoutubeCount = youtubeCountRef.current;
    const currentBilibiliCount = bilibiliCountRef.current;
    const validYoutubeCount = Math.min(Math.max(Number(currentYoutubeCount) || 0, 0), 10);
    const validBilibiliCount = Math.min(Math.max(Number(currentBilibiliCount) || 0, 0), 10);
    
    if (validYoutubeCount <= 0 && validBilibiliCount <= 0) {
      console.log('[refreshTrackUrl] 所有搜索源已禁用');
      return null;
    }
    
    const result = await extractDirectUrl(track, validYoutubeCount, validBilibiliCount);
    
    if (result) {
      // 4. 保存新URL到缓存（传入播放源参数）
      setCachedUrl(track.track_title, track.track_artist, result.url, result.thumbnail, result.source, validYoutubeCount, validBilibiliCount);
      // 5. 标记为已预加载
      addPreloadedTrackId(track.id);
      console.log('[refreshTrackUrl] URL刷新成功:', result.url.substring(0, 50) + '...');
    } else {
      console.error('[refreshTrackUrl] URL刷新失败');
    }
    
    return result;
  }, []);

  const handleDownloadTrack = useCallback(async (track: ExternalPlaylistTrack) => {
    setDownloadingTrackId(track.id);
    
    try {
      const result = await getOrExtractDirectUrl(track);
      
      if (result) {
        const downloadRes = await fetch('/api/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: result.url,
            source: result.source || 'YouTube',
            filename: `${track.track_title} - ${track.track_artist}`.replace(/[<>:"/\\|?*]/g, '_').substring(0, 100)
          })
        });
        
        if (!downloadRes.ok) {
          alert('下载失败，请稍后重试');
          return;
        }
        
        const blob = await downloadRes.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `${track.track_title} - ${track.track_artist}`.replace(/[<>:"/\\|?*]/g, '_').substring(0, 100) + '.mp3';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        alert('下载已开始！');
      } else {
        alert('获取下载链接失败');
      }
    } catch (error) {
      console.error('下载失败:', error);
      alert('下载失败，请稍后重试');
    } finally {
      setDownloadingTrackId(null);
    }
  }, [getOrExtractDirectUrl]);

  const handleBatchDownload = useCallback(async () => {
    if (!externalPlaylistTracks || externalPlaylistTracks.length === 0) return;
    
    setBatchDownloading(true);
    setBatchProgress({ current: 0, total: externalPlaylistTracks.length });
    
    for (let i = 0; i < externalPlaylistTracks.length; i++) {
      const track = externalPlaylistTracks[i];
      
      try {
        const result = await getOrExtractDirectUrl(track);
        
        if (result) {
          const downloadRes = await fetch('/api/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: result.url,
              source: result.source || 'YouTube',
              filename: `${track.track_title} - ${track.track_artist}`.replace(/[<>:"/\\|?*]/g, '_').substring(0, 100)
            })
          });
          
          if (downloadRes.ok) {
            const blob = await downloadRes.blob();
            const blobUrl = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `${track.track_title} - ${track.track_artist}`.replace(/[<>:"/\\|?*]/g, '_').substring(0, 100) + '.mp3';
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
          }
        }
      } catch (error) {
        console.error(`下载失败: ${track.track_title}`, error);
      }
      
      setBatchProgress({ current: i + 1, total: externalPlaylistTracks.length });
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    setBatchDownloading(false);
    onBatchComplete?.();
    alert('批量下载完成！');
  }, [externalPlaylistTracks, getOrExtractDirectUrl, onBatchComplete]);

  const handlePlayAll = useCallback(async () => {
    if (!externalPlaylistTracks || externalPlaylistTracks.length === 0) return;
    
    stopPreload();
    
    // 重置全局预加载状态和随机播放状态
    usePlaylistStore.setState({
      currentBatchIndex: 0,
      preloadedTrackIds: new Set(),
      isPreloading: false,
      shuffledQueue: externalPlaylistTracks,
      playedTrackIds: new Set(),
      isShuffleMode: false,
      currentTrackId: externalPlaylistTracks[0]?.id || null,
    });
    
    tracksRef.current = externalPlaylistTracks;
    setTracksList(externalPlaylistTracks.map(t => ({ 
      id: t.id, 
      title: t.track_title, 
      artist: t.track_artist 
    })));
    setFullTracksList(externalPlaylistTracks);
    
    const firstTrack = externalPlaylistTracks[0];
    const result = await getOrExtractDirectUrl(firstTrack);
    
    console.log('[handlePlayAll] result:', result);
    console.log('[handlePlayAll] firstTrack:', firstTrack);
    
    if (onPlayQueue) {
      const tracksWithUrl = externalPlaylistTracks.map((t, idx) => ({
        ...t,
        play_url: idx === 0 && result ? result.url : (t.play_url || ''),
        thumbnail: idx === 0 && result ? result.thumbnail : (t.thumbnail || ''),
        source: idx === 0 && result ? result.source : (t.source || ''),
      }));
      console.log('[handlePlayAll] tracksWithUrl[0]:', tracksWithUrl[0]);
      onPlayQueue(tracksWithUrl, 0, false);
      onSetShuffleMode?.(false);
    } else if (onPlayUrl && result) {
      onPlayUrl(result.url, firstTrack.track_title, firstTrack.track_artist, result.thumbnail);
    }
    
    if (result) {
      addPreloadedTrackId(firstTrack.id);
    }

    // 延迟后开始预加载 - 使用 ref 获取最新的 preloadNextBatch
    setTimeout(() => {
      console.log('[handlePlayAll] 1秒后触发预加载，当前搜索配置:', {
        youtubeCount: youtubeCountRef.current,
        bilibiliCount: bilibiliCountRef.current
      });
      preloadNextBatchRef.current();
    }, 1000);
  }, [externalPlaylistTracks, onPlayUrl, onPlayQueue, onSetShuffleMode, getOrExtractDirectUrl, stopPreload, setTracksList, setFullTracksList]);

  const handleShufflePlay = useCallback(async () => {
    if (!externalPlaylistTracks || externalPlaylistTracks.length === 0) return;
    
    stopPreload();
    
    const shuffledTracks = fisherYatesShuffle(externalPlaylistTracks);
    const firstTrack = shuffledTracks[0];
    
    // 重置全局预加载状态和随机播放状态
    usePlaylistStore.setState({
      currentBatchIndex: 0,
      preloadedTrackIds: new Set(),
      isPreloading: false,
      shuffledQueue: shuffledTracks,
      playedTrackIds: new Set([firstTrack.id]), // 第一首已播放
      isShuffleMode: true,
      currentTrackId: firstTrack.id,
    });
    
    tracksRef.current = externalPlaylistTracks;
    setTracksList(externalPlaylistTracks.map(t => ({ 
      id: t.id, 
      title: t.track_title, 
      artist: t.track_artist 
    })));
    setFullTracksList(externalPlaylistTracks);
    
    const result = await getOrExtractDirectUrl(firstTrack);
    
    if (onPlayQueue) {
      const tracksWithUrl = shuffledTracks.map((t, idx) => ({
        ...t,
        play_url: idx === 0 && result ? result.url : (t.play_url || ''),
        thumbnail: idx === 0 && result ? result.thumbnail : (t.thumbnail || ''),
        source: idx === 0 && result ? result.source : (t.source || ''),
      }));
      onPlayQueue(tracksWithUrl, 0, true);
      onSetShuffleMode?.(true);
    } else if (onPlayUrl && result) {
      onPlayUrl(result.url, firstTrack.track_title, firstTrack.track_artist, result.thumbnail);
    }
    
    if (result) {
      addPreloadedTrackId(firstTrack.id);
    }

    // 延迟后开始预加载（使用原始顺序）- 使用 ref 获取最新的 preloadNextBatch
    setTimeout(() => {
      console.log('[handleShufflePlay] 1秒后触发预加载，当前搜索配置:', {
        youtubeCount: youtubeCountRef.current,
        bilibiliCount: bilibiliCountRef.current
      });
      preloadNextBatchRef.current();
    }, 1000);
  }, [externalPlaylistTracks, onPlayUrl, onPlayQueue, onSetShuffleMode, getOrExtractDirectUrl, stopPreload, setTracksList, setFullTracksList]);

  const preloadAllTracks = useCallback(async () => {
    if (!externalPlaylistTracks || externalPlaylistTracks.length === 0) return;
    
    stopPreload();
    
    usePlaylistStore.setState({
      currentBatchIndex: 0,
      preloadedTrackIds: new Set(),
      isPreloading: false,
    });
    
    tracksRef.current = externalPlaylistTracks;
    setTracksList(externalPlaylistTracks.map(t => ({ 
      id: t.id, 
      title: t.track_title, 
      artist: t.track_artist 
    })));
    
    setPreloadProgress({ current: 0, total: externalPlaylistTracks.length, status: 'loading' });
    
    await preloadNextBatch();
  }, [externalPlaylistTracks, stopPreload, preloadNextBatch, setTracksList]);

  return {
    downloadingTrackId,
    batchDownloading,
    batchProgress,
    preloadProgress,
    handlePlayTrack,
    handleDownloadTrack,
    handleBatchDownload,
    handlePlayAll,
    handleShufflePlay,
    preloadAllTracks,
    stopPreload,
    preloadNextBatch,
    triggerPreloadCheck,
    refreshTrackUrl,
  };
}

export { getCachedUrl, setCachedUrl };
