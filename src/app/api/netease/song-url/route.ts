import { NextResponse } from 'next/server';
import { SERVER_NETEASE_API_URL } from '@/lib/server-env';

const NETEASE_API_URL = SERVER_NETEASE_API_URL;

/**
 * 网易云原生播放 - 直接通过歌曲ID获取播放URL
 * API: /song/url?id=歌曲ID
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const songId = searchParams.get('id');

  if (!songId) {
    return NextResponse.json({
      success: false,
      error: '缺少歌曲ID'
    }, { status: 400 });
  }

  try {
    console.log('[Netease Song URL] Fetching URL for song ID:', songId);

    // 调用网易云API获取播放URL
    const response = await fetch(`${NETEASE_API_URL}/song/url?id=${songId}&level=exhigh`, {
      headers: {
        'Referer': 'https://music.163.com/',
      },
    });

    const data = await response.json();

    if (data.code === 200 && data.data && data.data.length > 0) {
      const songUrl = data.data[0];
      
      if (songUrl.url) {
        console.log('[Netease Song URL] Got URL:', songUrl.url.substring(0, 50) + '...');
        
        return NextResponse.json({
          success: true,
          url: songUrl.url,
          time: songUrl.time,
          type: songUrl.type,
          size: songUrl.size,
        });
      } else {
        console.log('[Netease Song URL] No URL available, song may be unavailable');
        return NextResponse.json({
          success: false,
          error: '该歌曲无法播放（可能无版权）',
          code: data.data[0].code,
        });
      }
    } else {
      console.error('[Netease Song URL] API error:', data);
      return NextResponse.json({
        success: false,
        error: data.message || '获取播放链接失败',
      }, { status: 500 });
    }
  } catch (error) {
    console.error('[Netease Song URL] Error:', error);
    return NextResponse.json({
      success: false,
      error: String(error)
    }, { status: 500 });
  }
}
