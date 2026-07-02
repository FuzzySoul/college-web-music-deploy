import { NextResponse } from 'next/server';
import { SERVER_NETEASE_API_URL } from '@/lib/server-env';

const NETEASE_API_URL = SERVER_NETEASE_API_URL;

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

export async function GET() {
  const cacheKey = 'top-songs';
  const cached = getCached(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    const response = await fetch(`${NETEASE_API_URL}/top/song?type=0`, {
      headers: {
        'Referer': 'https://music.163.com/',
      },
    });

    const data = await response.json();
    
    // 缓存结果
    setCache(cacheKey, data);
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Top Songs] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch top songs', details: String(error) },
      { status: 500 }
    );
  }
}
