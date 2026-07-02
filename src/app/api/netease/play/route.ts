import { NextResponse } from 'next/server';
import { SERVER_NETEASE_API_URL } from '@/lib/server-env';

const NETEASE_API_URL = SERVER_NETEASE_API_URL;

const VIP_THRESHOLD_MS = 30000;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { songId, songName, artist, youtubeCount = 1, bilibiliCount = 0 } = body;

    if (!songName) {
      return NextResponse.json({
        success: false,
        error: '缺少歌曲名称'
      }, { status: 400 });
    }

    if (songId) {
      console.log('[Netease Play] Trying native playback for song ID:', songId);
      
      try {
        const nativeResponse = await fetch(`${NETEASE_API_URL}/song/url?id=${songId}&level=exhigh`, {
          headers: {
            'Referer': 'https://music.163.com/',
          },
        });
        
        const nativeData = await nativeResponse.json();
        
        if (nativeData.code === 200 && nativeData.data && nativeData.data.length > 0) {
          const songUrl = nativeData.data[0];
          
          if (songUrl.url) {
            const isVipLimited = songUrl.time && songUrl.time < VIP_THRESHOLD_MS;
            
            if (!isVipLimited) {
              console.log('[Netease Play] Native playback success!');
              return NextResponse.json({
                success: true,
                url: songUrl.url,
                title: songName,
                artist: artist,
                source: 'netease-native',
                type: 'native',
                isVipLimited: false
              });
            } else {
              console.log('[Netease Play] VIP limited (30s preview), switching to yt-dlp');
            }
          } else {
            console.log('[Netease Play] Native failed - no URL, falling back to yt-dlp');
          }
        }
      } catch (nativeError) {
        console.log('[Netease Play] Native playback error, falling back to yt-dlp:', nativeError);
      }
    }

    const searchQuery = artist 
      ? `${songName} ${artist} 官方版` 
      : `${songName} 官方版`;

    console.log('[Netease Play] Searching via yt-dlp:', searchQuery);

    const origin = new URL(request.url).origin;
    const baseUrl = process.env['NEXT_PUBLIC_APP_URL'] || process.env['SITE_URL'] || origin;
    const response = await fetch(`${baseUrl}/api/music/ytdlp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'createSearchTask',
        trackTitle: songName,
        trackArtist: artist || '',
        youtubeCount,
        bilibiliCount,
      }),
    });

    const data = await response.json();

    if (!data.taskId) {
      return NextResponse.json({
        success: false,
        error: data.error || '创建搜索任务失败'
      }, { status: 500 });
    }

    const pollTask = async () => {
      let attempts = 0;
      const maxAttempts = 30;

      while (attempts < maxAttempts) {
        const statusResponse = await fetch(`${baseUrl}/api/music/ytdlp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'getTaskStatus',
            taskId: data.taskId,
          }),
        });

        const statusData = await statusResponse.json();

        if (statusData.status === 'completed' && statusData.results && statusData.results.length > 0) {
          const result = statusData.results[0];

          const urlResponse = await fetch(`${baseUrl}/api/music/ytdlp`, {
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
            return {
              success: true,
              url: urlData.url,
              title: result.title,
              thumbnail: result.thumbnail,
              source: result.source,
              type: 'ytdlp',
              isVipLimited: true
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
    };

    const result = await pollTask();
    return NextResponse.json(result);

  } catch (error) {
    console.error('[Netease Play] Error:', error);
    return NextResponse.json({
      success: false,
      error: String(error)
    }, { status: 500 });
  }
}
