/**
 * 网易云音乐 yt-dlp 搜索逻辑
 * 用于VIP歌曲或无版权歌曲的搜索播放
 */

const YTDLP_BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'http://localhost:5000';

/**
 * 缓存数据结构
 */
export interface VideoCacheData {
  videoId: string;        // YouTube: JwEuJc0fOYo, Bilibili: BV1xx411c7mD
  source: 'YouTube' | 'Bilibili';
  title: string;
  artist: string;
  thumbnail: string;
  duration: number;
  directUrl: string;      // 视频页面 URL (如 https://www.youtube.com/watch?v=xxx)
  timestamp: number;      // 缓存创建时间
}

/**
 * 从 localStorage 获取缓存的视频信息
 */
export function getCachedVideoId(title: string, artist: string): VideoCacheData | null {
  if (typeof window === 'undefined') return null;
  try {
    const cache = localStorage.getItem('videoIdCache');
    if (!cache) return null;
    const cacheObj: Record<string, VideoCacheData> = JSON.parse(cache);
    const key = `${title}___${artist}`;
    const cached = cacheObj[key];
    // 缓存有效期：7天
    if (cached && Date.now() - cached.timestamp < 7 * 24 * 60 * 60 * 1000) {
      return cached;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 保存视频信息到 localStorage 缓存
 */
export function saveVideoIdCache(
  title: string,
  artist: string,
  data: Omit<VideoCacheData, 'timestamp'>
): void {
  if (typeof window === 'undefined') return;
  try {
    const cache = localStorage.getItem('videoIdCache');
    const cacheObj: Record<string, VideoCacheData> = cache ? JSON.parse(cache) : {};
    const key = `${title}___${artist}`;
    cacheObj[key] = {
      ...data,
      timestamp: Date.now(),
    };
    localStorage.setItem('videoIdCache', JSON.stringify(cacheObj));
  } catch (e) {
    console.error('Failed to save video cache:', e);
  }
}

/**
 * 使用缓存的视频 ID 直接获取播放 URL（无需重新搜索）
 */
export async function getUrlFromVideoId(
  videoId: string,
  source: 'YouTube' | 'Bilibili',
  directUrl?: string
): Promise<{
  success: boolean;
  url?: string;
  streamType?: string;
  needsProxy?: boolean;
  headers?: Record<string, string>;
  error?: string;
}> {
  console.log('[YtDlpSearch] Getting URL from videoId:', { videoId, source, directUrl });

  try {
    const response = await fetch(`${YTDLP_BASE_URL}/api/music/ytdlp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'getUrl',
        songId: videoId,
        source: source,
        directUrl: directUrl,
      }),
    });

    const data = await response.json();

    if (data.success && data.url) {
      return {
        success: true,
        url: data.url,
        streamType: data.streamType,
        needsProxy: data.needsProxy,
        headers: data.headers,
      };
    } else {
      return {
        success: false,
        error: data.error || '获取播放链接失败',
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || '请求失败',
    };
  }
}

/**
 * 智能获取播放 URL：先检查缓存，有则直接用 videoId 获取，无则搜索
 */
export async function getPlayUrlWithCache(
  title: string,
  artist: string,
  youtubeCount: number = 1,
  bilibiliCount: number = 0
): Promise<{
  success: boolean;
  url?: string;
  title?: string;
  thumbnail?: string;
  source?: string;
  type?: string;
  streamType?: string;
  needsProxy?: boolean;
  headers?: Record<string, string>;
  error?: string;
  fromCache?: boolean;
}> {
  // 1. 先检查是否有缓存的视频 ID
  const cached = getCachedVideoId(title, artist);

  if (cached) {
    console.log('[YtDlpSearch] Found cached videoId:', cached.videoId);

    // 直接使用缓存的 videoId 获取播放 URL
    const urlResult = await getUrlFromVideoId(
      cached.videoId,
      cached.source,
      cached.directUrl
    );

    if (urlResult.success) {
      return {
        success: true,
        url: urlResult.url,
        title: cached.title,
        thumbnail: cached.thumbnail,
        source: cached.source,
        type: 'ytdlp',
        streamType: urlResult.streamType,
        needsProxy: urlResult.needsProxy,
        headers: urlResult.headers,
        fromCache: true,
      };
    } else {
      // 如果获取 URL 失败（可能是视频被删除），清除缓存并继续搜索
      console.log('[YtDlpSearch] Cached videoId failed, clearing cache and re-searching');
      clearVideoCache(title, artist);
    }
  }

  // 2. 没有缓存或缓存失效，执行搜索
  console.log('[YtDlpSearch] No cache found, searching...');
  return await searchWithYtDlp(`${title} ${artist}`, youtubeCount, bilibiliCount);
}

/**
 * 清除指定歌曲的视频缓存
 */
export function clearVideoCache(title: string, artist: string): void {
  if (typeof window === 'undefined') return;
  try {
    const cache = localStorage.getItem('videoIdCache');
    if (!cache) return;
    const cacheObj: Record<string, VideoCacheData> = JSON.parse(cache);
    const key = `${title}___${artist}`;
    delete cacheObj[key];
    localStorage.setItem('videoIdCache', JSON.stringify(cacheObj));
  } catch (e) {
    console.error('Failed to clear video cache:', e);
  }
}

/**
 * 清除所有视频缓存
 */
export function clearAllVideoCache(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('videoIdCache');
}

/**
 * 使用yt-dlp搜索并获取播放URL
 */
export async function searchWithYtDlp(
  searchQuery: string,
  youtubeCount: number = 1,
  bilibiliCount: number = 0
): Promise<{
  success: boolean;
  url?: string;
  title?: string;
  thumbnail?: string;
  source?: string;
  type?: string;
  streamType?: string;
  needsProxy?: boolean;
  headers?: Record<string, string>;
  error?: string;
  fromCache?: boolean;
}> {
  console.log('[YtDlpSearch] Searching:', searchQuery);

  const response = await fetch(`${YTDLP_BASE_URL}/api/music/ytdlp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'createSearchTask',
      trackTitle: searchQuery,
      trackArtist: '',
      youtubeCount,
      bilibiliCount,
    }),
  });

  const data = await response.json();

  if (!data.taskId) {
    return {
      success: false,
      error: data.error || '创建搜索任务失败'
    };
  }

  // 轮询任务状态
  return await pollTaskStatus(data.taskId, searchQuery);
}

/**
 * 轮询任务状态直到完成
 */
async function pollTaskStatus(
  taskId: string,
  searchQuery?: string
): Promise<{
  success: boolean;
  url?: string;
  title?: string;
  thumbnail?: string;
  source?: string;
  type?: string;
  streamType?: string;
  needsProxy?: boolean;
  headers?: Record<string, string>;
  error?: string;
  fromCache?: boolean;
}> {
  let attempts = 0;
  const maxAttempts = 30;

  while (attempts < maxAttempts) {
    const statusResponse = await fetch(`${YTDLP_BASE_URL}/api/music/ytdlp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'getTaskStatus',
        taskId: taskId,
      }),
    });

    const statusData = await statusResponse.json();

    if (statusData.status === 'completed' && statusData.results && statusData.results.length > 0) {
      const result = statusData.results[0];

      // 获取实际可播放的音频URL
      const urlResponse = await fetch(`${YTDLP_BASE_URL}/api/music/ytdlp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'getUrl',
          songId: result.id,
          source: result.source,
          directUrl: result.url,
        }),
      });

      const urlData = await urlResponse.json();

      if (urlData.success && urlData.url) {
        // 解析搜索关键词中的 title 和 artist
        if (searchQuery) {
          const parts = searchQuery.split(' ');
          // 简单假设：最后一个空格后的可能是 artist，前面的是 title
          // 实际使用时可能需要更智能的解析
          const title = parts.slice(0, -1).join(' ') || parts[0];
          const artist = parts.length > 1 ? parts[parts.length - 1] : 'Unknown';

          // 保存到缓存
          saveVideoIdCache(title, artist, {
            videoId: result.id,
            source: result.source,
            title: result.title,
            artist: result.artist,
            thumbnail: result.thumbnail,
            duration: result.duration,
            directUrl: result.url,
          });
        }

        return {
          success: true,
          url: urlData.url,
          title: result.title,
          thumbnail: result.thumbnail,
          source: result.source,
          type: 'ytdlp',
          streamType: urlData.streamType,
          needsProxy: urlData.needsProxy,
          headers: urlData.headers,
          fromCache: false,
        };
      } else {
        return {
          success: false,
          error: urlData.error || '获取播放链接失败'
        };
      }
    } else if (statusData.status === 'failed') {
      return {
        success: false,
        error: statusData.error || '搜索失败'
      };
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
  }

  return {
    success: false,
    error: '搜索超时'
  };
}

/**
 * 构建搜索关键词
 */
export function buildSearchQuery(songName: string, artist?: string): string {
  return artist
    ? `${songName} ${artist} 官方版`
    : `${songName} 官方版`;
}
