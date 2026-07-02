import { NextResponse } from 'next/server'
import axios from 'axios'

const LX_API = process.env['LX_MUSIC_API_URL'] || 'http://127.0.0.1:8080'

async function getDownloadUrl(songId: string, source: string, quality: string = 'flac') {
  try {
    const sourceMap: Record<string, string> = {
      kugou: 'kg',
      kuwo: 'kw',
      migu: 'mg',
      wy: 'wy',
      tx: 'tx',
    }
    
    const apiSource = sourceMap[source] || source
    
    console.log('[GetURL] Request:', { apiSource, songId, quality })
    
    const response = await axios.get(`${LX_API}/url`, {
      params: {
        source: apiSource,
        songId: songId,
        quality: quality,
      },
      timeout: 15000,
    })
    
    if (response.data?.code === 200 && response.data?.url) {
      return response.data.url
    }
    return null
  } catch (error: any) {
    console.error('[GetURL] Error:', error.message)
    return null
  }
}

export async function GET() {
  return NextResponse.json({
    success: false,
    error: '搜索功能暂不可用。请使用批量下载功能，系统会直接使用已存储的歌曲信息获取下载链接。',
    results: []
  })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { songId, source, quality } = body

    if (!songId || !source) {
      return NextResponse.json({
        success: false,
        error: '缺少必要参数 songId 或 source'
      })
    }

    console.log('[GetURL] Request:', { songId, source, quality })

    const url = await getDownloadUrl(songId, source, quality || 'flac')

    if (url) {
      console.log('[GetURL] Success:', url.substring(0, 50) + '...')
      return NextResponse.json({
        success: true,
        url,
      })
    }

    console.log('[GetURL] Failed - trying fallback sources')
    
    const fallbackSources = ['kw', 'kg', 'mg', 'tx', 'wy']
    for (const fbSource of fallbackSources) {
      const fallbackUrl = await getDownloadUrl(songId, fbSource, quality || '320k')
      if (fallbackUrl) {
        return NextResponse.json({
          success: true,
          url: fallbackUrl,
          note: `使用了${fbSource}源`,
        })
      }
    }

    return NextResponse.json({
      success: false,
      error: '获取下载链接失败，请确保 LX Music API Server 正在运行',
    })
  } catch (error: any) {
    console.error('[GetURL] Error:', error.message)
    return NextResponse.json({
      success: false,
      error: String(error),
    }, { status: 500 })
  }
}
