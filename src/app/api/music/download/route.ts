import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseUrl = process.env['COZE_SUPABASE_URL'] || ''
const supabaseKey =
  process.env['SUPABASE_SERVICE_ROLE_KEY'] ||
  process.env['COZE_SUPABASE_SERVICE_ROLE_KEY'] ||
  ''

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase service env is missing')
  }
  return createClient(supabaseUrl, supabaseKey)
}
const LX_MUSIC_API = process.env['LX_MUSIC_API_URL'] || 'http://127.0.0.1:8080'

const SOURCES = ['kw', 'wy', 'tx', 'kg']
const QUALITIES = ['flac', '320k', '128k']

interface DownloadResult {
  source: string
  quality: string
  url: string
  success: boolean
  error?: string
}

async function tryGetDownloadUrl(songId: string, source: string, quality: string): Promise<DownloadResult> {
  try {
    const url = `${LX_MUSIC_API}/url?source=${source}&songId=${songId}&quality=${quality}`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)
    
    const data = await response.json()
    
    if (data.code === 200 && data.url) {
      return { source, quality, url: data.url, success: true }
    } else {
      return { source, quality, url: '', success: false, error: data.message || '获取失败' }
    }
  } catch (error) {
    return { source, quality, url: '', success: false, error: String(error) }
  }
}

async function getDownloadUrl(songId: string): Promise<DownloadResult[]> {
  const results: DownloadResult[] = []
  
  for (const source of SOURCES) {
    for (const quality of QUALITIES) {
      const result = await tryGetDownloadUrl(songId, source, quality)
      if (result.success) {
        return [result]
      }
      results.push(result)
    }
  }
  
  return results
}

function generateCacheKey(key: string): string {
  return crypto.createHash('md5').update(key).digest('hex')
}

export async function GET(request: Request) {
  try {
    const supabase = getSupabase()
    const { searchParams } = new URL(request.url)
    const songId = searchParams.get('songId')
    const songTitle = searchParams.get('title') || ''
    const artist = searchParams.get('artist') || ''

    console.log('\n========== [Music Download API] ==========')
    console.log('[API] Request:', { songId, songTitle, artist })
    console.log('[API] Time:', new Date().toISOString())

    if (!songId) {
      return NextResponse.json({
        success: false,
        error: '缺少歌曲ID参数',
        results: []
      }, { status: 400 })
    }

    const cacheKey = generateCacheKey(songId)

    const { data: cacheData } = await supabase
      .from('music_cache')
      .select('results, expires')
      .eq('song_key', cacheKey)
      .gt('expires', new Date().toISOString())
      .single()

    if (cacheData?.results) {
      console.log('[API] Cache hit!')
      return NextResponse.json({
        success: true,
        source: 'cache',
        songId,
        songTitle,
        artist,
        results: cacheData.results
      })
    }

    console.log('[API] Fetching from LX Music API...')
    const results = await getDownloadUrl(songId)
    console.log('[API] Results:', results.length, 'attempts')

    const successfulResult = results.find(r => r.success)
    
    if (successfulResult) {
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      await supabase
        .from('music_cache')
        .upsert({
          song_key: cacheKey,
          results: [successfulResult],
          expires: expires
        }, {
          onConflict: 'song_key'
        })
      console.log('[API] Cached result')
    }

    console.log('========== [API End] ==========\n')

    return NextResponse.json({
      success: !!successfulResult,
      songId,
      songTitle,
      artist,
      results: results,
      bestResult: successfulResult || null
    })
  } catch (error) {
    console.error('[API] Error:', error)
    return NextResponse.json({
      success: false,
      error: String(error),
      results: []
    }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    getSupabase()
    const body = await request.json()
    const { songIds, tracks } = body

    console.log('\n========== [Batch Download API] ==========')
    console.log('[Batch API] Received:', { songIds: songIds?.length, tracks: tracks?.length })

    const songs = tracks || []
    const results: any[] = []

    for (let i = 0; i < songs.length; i++) {
      const track = songs[i]
      console.log(`[Batch API] Processing ${i + 1}/${songs.length}: ${track.track_title}`)
      
      const songId = track.platform_song_id || track.id || track.platform_track_id
      if (!songId) {
        results.push({
          track,
          success: false,
          error: '缺少歌曲ID'
        })
        continue
      }

      const downloadResults = await getDownloadUrl(songId)
      const best = downloadResults.find(r => r.success)
      
      results.push({
        track,
        songId,
        success: !!best,
        results: downloadResults,
        bestResult: best || null
      })

      if (i < songs.length - 1) {
        await new Promise(r => setTimeout(r, 500))
      }
    }

    console.log('[Batch API] Complete:', results.filter(r => r.success).length, '/', results.length)
    console.log('========== [Batch End] ==========\n')

    return NextResponse.json({
      success: true,
      total: songs.length,
      successful: results.filter(r => r.success).length,
      results
    })
  } catch (error) {
    console.error('[Batch API] Error:', error)
    return NextResponse.json({
      success: false,
      error: String(error)
    }, { status: 500 })
  }
}
