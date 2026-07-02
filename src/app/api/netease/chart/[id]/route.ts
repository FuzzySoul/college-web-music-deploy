import { NextResponse } from 'next/server';
import { SERVER_NETEASE_API_URL } from '@/lib/server-env';

const NETEASE_API_URL = SERVER_NETEASE_API_URL;

// 榜单ID常量
export const TOP_LIST_IDS = [
  { id: 19723756, name: '飙升榜' },
  { id: 3779629, name: '新歌榜' },
  { id: 2884035, name: '原创榜' },
  { id: 3778678, name: '热歌榜' },
];

// 简单内存缓存
interface CacheItem {
  data: any;
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5分钟
const cache = new Map<string, CacheItem>();

function getCached(key: string): any | null {
  const item = cache.get(key);
  if (item && Date.now() - item.timestamp < CACHE_TTL) {
    return item.data;
  }
  cache.delete(key);
  return null;
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const playlistId = id;
  const cacheKey = `chart-${playlistId}`;
  
  const cached = getCached(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    const response = await fetch(`${NETEASE_API_URL}/playlist/detail?id=${playlistId}`, {
      headers: {
        'Referer': 'https://music.163.com/',
      },
    });

    const data = await response.json();
    
    // 缓存结果
    setCache(cacheKey, data);
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Chart] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chart', details: String(error) },
      { status: 500 }
    );
  }
}
