import { NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { createClient } from '@supabase/supabase-js'
import { SERVER_MEDIA_API_URL, withBaseUrl } from '@/lib/server-env'

const YTDLP_PATH = process.env.YTDLP_PATH || 'yt-dlp'
const PROXY = process.env.HTTP_PROXY || process.env.HTTPS_PROXY || ''

const SUPABASE_URL = process.env['COZE_SUPABASE_URL'] || ''
const SUPABASE_SERVICE_KEY =
  process.env['SUPABASE_SERVICE_ROLE_KEY'] ||
  process.env['COZE_SUPABASE_SERVICE_ROLE_KEY'] ||
  ''

async function proxyToMediaApi(request: Request): Promise<NextResponse | null> {
  if (!SERVER_MEDIA_API_URL) return null

  const url = new URL(request.url)
  const targetUrl = withBaseUrl(SERVER_MEDIA_API_URL, `/api/music/ytdlp${url.search}`)
  const init: RequestInit = {
    method: request.method,
    headers: request.headers,
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.text()
  }

  const response = await fetch(targetUrl, init)
  return new NextResponse(response.body, {
    status: response.status,
    headers: new Headers(response.headers),
  })
}

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
}

interface SearchResult {
  title: string
  artist: string
  url: string
  quality: string
  duration: number
  thumbnail: string
  source: string
  id: string
}

const EXTRACTORS = [
  { name: 'YouTube', key: 'yt', prefix: 'ytsearch', useProxy: true },
  { name: 'Bilibili', key: 'bilibili', prefix: 'bilisearch', useProxy: false },
]

const BILIBILI_HEADERS = [
  'User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer: https://www.bilibili.com',
  'Origin: https://www.bilibili.com',
  'Accept: */*',
  'Accept-Language: zh-CN,zh;q=0.9,en;q=0.8',
  'Accept-Encoding: gzip, deflate, br',
]

function encoderForFormat(format: string): TextEncoder {
  return new TextEncoder()
}

function parseJSONLines(input: string): any[] {
  const results: any[] = []
  for (const line of input.split('\n')) {
    if (line.trim()) {
      try {
        results.push(JSON.parse(line))
      } catch {
        continue
      }
    }
  }
  return results
}

function execCommand(args: string[], options: { proxy?: string; headers?: string[] } = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const { proxy, headers } = options
    const finalArgs = []
    
    if (proxy) {
      finalArgs.push('--proxy', proxy)
    }
    
    if (headers) {
      for (const h of headers) {
        finalArgs.push('--add-header', h)
        console.log('[yt-dlp] Adding header:', h)
      }
    }
    
    finalArgs.push(...args)
    
    console.log('[yt-dlp] Executing:', finalArgs.join(' '))
    const process = spawn(YTDLP_PATH, finalArgs, { shell: true })
    let stdout = ''
    let stderr = ''

    process.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    process.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    process.on('close', (code) => {
      if (code === 0 || stdout.trim()) {
        resolve(stdout)
      } else {
        const errorLines = stderr.split('\n').filter(l => l.includes('ERROR') || l.includes('WARNING'))
        const errorMsg = errorLines.slice(0, 3).join('; ') || `Process exited with code ${code}`
        console.log('[yt-dlp] Command error:', errorMsg)
        reject(new Error(errorMsg))
      }
    })

    process.on('error', (err) => {
      console.log('[yt-dlp] Spawn error:', err.message)
      reject(err)
    })

    setTimeout(() => {
      process.kill()
      reject(new Error('Command timeout'))
    }, 30000)
  })
}

async function enrichBilibiliMetadata(results: SearchResult[]): Promise<SearchResult[]> {
  const enrichedResults: SearchResult[] = []
  
  for (const result of results) {
    if (result.source !== 'Bilibili') {
      enrichedResults.push(result)
      continue
    }
    
    try {
      console.log(`[yt-dlp] Enriching Bilibili metadata for: ${result.url}`)
      
      const output = await execCommand([
        '--dump-json',
        '--no-download',
        '--no-warnings',
        result.url,
      ], {
        headers: BILIBILI_HEADERS
      })
      
      const data = JSON.parse(output.trim())
      
      const duration = data.duration ? Math.floor(data.duration) : result.duration
      
      enrichedResults.push({
        ...result,
        title: data.title || result.title,
        artist: data.uploader || data.channel || data.creator || result.artist,
        duration: duration,
        thumbnail: data.thumbnail || data.thumbnails?.[0]?.url || result.thumbnail,
      })
      
      console.log(`[yt-dlp] Enriched: ${data.title} by ${data.uploader}`)
    } catch (err: any) {
      console.log(`[yt-dlp] Failed to enrich ${result.url}:`, err.message)
      enrichedResults.push(result)
    }
  }
  
  return enrichedResults
}

function parseSearchResults(output: string, sourceName: string): SearchResult[] {
  const results: SearchResult[] = []
  const lines = output.split('\n').filter(line => line.trim())

  for (const line of lines) {
    try {
      const data = JSON.parse(line)
      if (!data.id) continue

      let title = data.title || ''
      let artist = data.artist || data.uploader || data.channel || 'Unknown'
      let url = data.url || data.webpage_url || ''
      let thumbnail = data.thumbnail || data.thumbnails?.[0]?.url || ''
      let duration = Math.floor(data.duration) || 0
      let quality = 'unknown'

      if (sourceName === 'Bilibili') {
        const videoId = data.id
        
        url = data.webpage_url?.replace('http://', 'https://') || 
              (videoId.startsWith('av') ? `https://www.bilibili.com/video/${videoId}` : `https://www.bilibili.com/video/av${videoId}`)
        
        title = data.title || data.playlist_title || `Bilibili 视频 ${videoId}`
        
        artist = data.uploader || data.channel || data.creator || 'Bilibili'
        
        thumbnail = data.thumbnail || data.thumbnails?.[0]?.url || ''
      }

      if (!url && data.id) {
        if (sourceName === 'YouTube') {
          url = `https://www.youtube.com/watch?v=${data.id}`
        } else if (sourceName === 'Bilibili') {
          url = data.webpage_url?.replace('http://', 'https://') || `https://www.bilibili.com/video/av${data.id}`
        }
      }

      if (!title && data.playlist_title) {
        title = data.playlist_title
      }

      if (data.ext === 'm4a' || data.ext === 'mp3' || data.ext === 'wav') {
        quality = data.ext
      } else if (data.ext === 'webm' && data.audio_ext === 'webm') {
        quality = 'webm audio'
      }

      results.push({
        id: data.id,
        title,
        artist,
        url,
        quality,
        duration,
        thumbnail,
        source: sourceName,
      })
    } catch {
      continue
    }
  }

  return results
}

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().replace(/[^\w\u4e00-\u9fa5]/g, '')
  const s2 = str2.toLowerCase().replace(/[^\w\u4e00-\u9fa5]/g, '')
  if (s1 === s2) return 1
  if (s1.includes(s2) || s2.includes(s1)) return 0.8
  let matchCount = 0
  for (let i = 0; i < Math.min(s1.length, s2.length); i++) {
    if (s1[i] === s2[i]) matchCount++
  }
  return matchCount / Math.max(s1.length, s2.length)
}

function deduplicateResults(results: SearchResult[]): SearchResult[] {
  const seen = new Map<string, SearchResult>()
  
  for (const result of results) {
    const key = `${result.title}-${result.artist}-${result.url}`.toLowerCase()
    let isDuplicate = false
    let bestMatch: SearchResult | null = null
    
    for (const [existingKey, existingResult] of seen) {
      const similarity = calculateSimilarity(key, existingKey)
      if (similarity > 0.7) {
        isDuplicate = true
        if (!bestMatch || result.source === 'YouTube') {
          bestMatch = result
        }
        break
      }
    }
    
    if (!isDuplicate) {
      seen.set(key, result)
    } else if (bestMatch) {
      seen.set(key, bestMatch)
    }
  }

  return Array.from(seen.values()).sort((a, b) => {
    const priority: Record<string, number> = { 
      'YouTube': 0, 
      'Bilibili': 1,
    }
    return (priority[a.source] || 2) - (priority[b.source] || 2)
  })
}

async function searchWithExtractor(extractor: typeof EXTRACTORS[0], query: string, maxCount: number = 1): Promise<SearchResult[]> {
  console.log(`[yt-dlp] Trying ${extractor.name} with query: ${query}, maxCount: ${maxCount}`)
  
  let options: { proxy?: string; headers?: string[] } = {}
  
  if (extractor.useProxy && extractor.name !== 'Bilibili') {
    options = { proxy: PROXY }
  } else if (extractor.name === 'Bilibili') {
    options = { headers: BILIBILI_HEADERS }
  }
  
  try {
    const searchArgs = [
      '--dump-json',
      '--no-download',
      '--no-warnings',
      '--flat-playlist',
    ]
    
    if (extractor.name === 'Bilibili') {
      searchArgs.push('--extractor-args', 'bilibili:player=web')
    }
    
    const searchQuery = `${extractor.prefix}${maxCount}:"${query}"`
    searchArgs.push(searchQuery)
    
    console.log('[yt-dlp] Search query:', searchQuery)
    
    const output = await execCommand(searchArgs, options)

    console.log('[yt-dlp] Raw output (first 500 chars):', output.substring(0, 500))
    console.log('[yt-dlp] Raw output lines:', output.split('\n').filter(l => l.trim()).length)
    const results = parseSearchResults(output, extractor.name)
    
    if (extractor.name === 'Bilibili' && results.length > 0) {
      const enriched = await enrichBilibiliMetadata(results)
      console.log(`[yt-dlp] ${extractor.name} enriched to ${enriched.length} results`)
      return enriched
    }
    
    console.log(`[yt-dlp] ${extractor.name} found ${results.length} results`)
    return results
  } catch (error: any) {
    console.log(`[yt-dlp] ${extractor.name} failed:`, error.message)
    return []
  }
}

  async function executeSearchAsync(
    taskId: string,
    query: string,
    youtubeCount: number = 1,
    bilibiliCount: number = 0
  ): Promise<void> {
  try {
    const supabase = getSupabase()

    // 确保参数是数字且在有效范围内
    const validYoutubeCount = Math.min(Math.max(Number(youtubeCount) || 0, 0), 10)
    const validBilibiliCount = Math.min(Math.max(Number(bilibiliCount) || 0, 0), 10)

    console.log('[executeSearchAsync] Raw counts:', { youtubeCount, bilibiliCount })
    console.log('[executeSearchAsync] Validated counts:', { validYoutubeCount, validBilibiliCount })

    // 提前检查：如果所有源的 count 都为 0，直接返回错误
    if (validYoutubeCount <= 0 && validBilibiliCount <= 0) {
      console.log('[Search] 所有搜索源已禁用 (count=0)')
      await supabase
        .from('search_tasks')
        .update({
          status: 'failed',
          progress: 100,
          error: '所有搜索渠道已禁用，请至少启用一个搜索源',
          updated_at: new Date().toISOString()
        })
        .eq('task_id', taskId)
      return
    }

    await supabase
      .from('search_tasks')
      .update({ status: 'processing', progress: 0, updated_at: new Date().toISOString() })
      .eq('task_id', taskId)
    
    let allResults: SearchResult[] = []
    let completed = 0
    const total = EXTRACTORS.length
    
    for (const extractor of EXTRACTORS) {
      try {
        // 根据源确定搜索数量（0-10）
        const maxCount = extractor.name === 'YouTube' ? validYoutubeCount : validBilibiliCount
        
        // 如果搜索数量为0，跳过该搜索源
        if (maxCount <= 0) {
          console.log(`[Search] Skipping ${extractor.name}: count is 0`)
          completed++
          const progress = Math.round((completed / total) * 100)
          await supabase
            .from('search_tasks')
            .update({ progress, updated_at: new Date().toISOString() })
            .eq('task_id', taskId)
          continue
        }
        
        const results = await searchWithExtractor(extractor, query, maxCount)
        if (results.length > 0) {
          allResults = [...allResults, ...results]
        }
        completed++
        const progress = Math.round((completed / total) * 100)
        await supabase
          .from('search_tasks')
          .update({ progress, updated_at: new Date().toISOString() })
          .eq('task_id', taskId)
    } catch (err: unknown) {
      const error = err as Error
      console.error(`[Search] ${extractor.name} error:`, error.message)
      completed++
      const progress = Math.round((completed / total) * 100)
      await supabase
          .from('search_tasks')
          .update({ progress, updated_at: new Date().toISOString() })
          .eq('task_id', taskId)
      }
    }
    
    const deduplicated = deduplicateResults(allResults)
    
    if (deduplicated.length > 0) {
      await supabase
        .from('search_tasks')
        .update({ status: 'completed', progress: 100, results: deduplicated, updated_at: new Date().toISOString() })
        .eq('task_id', taskId)
    } else {
      await supabase
        .from('search_tasks')
        .update({ status: 'failed', progress: 100, error: '所有搜索渠道均未找到结果', updated_at: new Date().toISOString() })
        .eq('task_id', taskId)
    }
  } catch (err) {
    console.error('[Task] Execute failed:', err)
  }
  }

export async function POST(request: Request) {
  const proxied = await proxyToMediaApi(request)
  if (proxied) return proxied

  try {
    const body = await request.json()
    const { action, query, taskId, songId, trackTitle, trackArtist, quality, youtubeCount: rawYoutubeCount, bilibiliCount: rawBilibiliCount } = body

    console.log('[yt-dlp] Action:', action)

    // 只在 createSearchTask 时解析和记录搜索配置
    let youtubeCount = 1
    let bilibiliCount = 0
    if (action === 'createSearchTask') {
      youtubeCount = Math.min(Math.max(parseInt(String(rawYoutubeCount)) || 0, 0), 10)
      bilibiliCount = Math.min(Math.max(parseInt(String(rawBilibiliCount)) || 0, 0), 10)
      console.log('[yt-dlp] Parsed counts:', { youtubeCount, bilibiliCount, rawYoutubeCount, rawBilibiliCount })
    }
    
    // 异步搜索任务 - 立即返回任务ID，后台处理
    if (action === 'createSearchTask') {
      const searchQuery = (trackTitle || trackArtist) 
        ? `${trackTitle || ''} ${trackArtist || ''}`.trim() 
        : (query || '')
      
      if (!searchQuery) {
        return NextResponse.json({
          success: false,
          error: '请提供搜索关键词',
          taskId: null
        })
      }
      
      // 创建任务记录（包含独立数量配置）
      const supabase = getSupabase()
      const { data: task, error: taskError } = await supabase
        .from('search_tasks')
        .insert({
          query: searchQuery,
          status: 'pending',
          progress: 0,
          total_extractors: EXTRACTORS.length,
          completed_extractors: 0,
          results: [],
          youtube_count: youtubeCount,
          bilibili_count: bilibiliCount,
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()
        })
        .select()
        .single()

      if (taskError || !task) {
        console.error('[Task] Create failed:', taskError)
        return NextResponse.json({
          success: false,
          error: '创建任务失败',
          taskId: null
        })
      }

      // 启动后台任务，传递独立数量配置
      executeSearchAsync(
        task.task_id,
        searchQuery,
        youtubeCount,
        bilibiliCount
      ).catch(err => {
        console.error('[Task] Async execution failed:', err)
      })
      
      return NextResponse.json({
        success: true,
        taskId: task.task_id,
        status: 'pending',
        message: '任务已创建，正在后台搜索...'
      })
    }

    // 查询任务状态
    if (action === 'getTaskStatus') {
      if (!taskId) {
        return NextResponse.json({
          success: false,
          error: '缺少 taskId 参数'
        })
      }
      
      const supabase = getSupabase()
      const { data: task, error } = await supabase
        .from('search_tasks')
        .select('*')
        .eq('task_id', taskId)
        .single()
      
      if (error || !task) {
        return NextResponse.json({
          success: false,
          error: '任务不存在'
        })
      }
      
      return NextResponse.json({
        success: true,
        status: task.status,
        progress: task.progress,
        results: task.results || [],
        error: task.error,
        query: task.query
      })
    }

    if (action === 'getUrl') {
      const source = body.source || 'unknown'
      let url = songId || query
      let directUrl = body.directUrl

      console.log('[yt-dlp] getUrl source:', source, 'url:', url)

      let finalUrl = url
      let useDirectUrl = false

      if (source === 'Bilibili') {
        if (directUrl && directUrl.startsWith('http') && directUrl.includes('bilibili.com')) {
          finalUrl = directUrl
        } else if (!url.includes('bilibili.com')) {
          finalUrl = url.includes('av') ? `https://www.bilibili.com/video/${url}` : `https://www.bilibili.com/video/${url}`
        }
        console.log('[yt-dlp] Bilibili final URL:', finalUrl)

        const audioUrl = await execCommand([
          '-g',
          '-f', '30280/30232/30216/bestaudio',
          '--no-warnings',
          finalUrl,
        ], {
          headers: [
            'User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer:https://www.bilibili.com',
            'Origin:https://www.bilibili.com'
          ]
        })
        let downloadUrl = audioUrl.trim().split('\n')[0]
        
        if (!downloadUrl) {
          throw new Error('无法获取Bilibili音频链接')
        }

        console.log('[yt-dlp] Bilibili downloadUrl:', downloadUrl)

        // 只有.m3u8是HLS，其他都是原生音频格式
        const streamType = downloadUrl.includes('.m3u8') ? 'hls' : 'mp4'
        console.log('[yt-dlp] Bilibili streamType:', streamType)

        return NextResponse.json({ 
          success: true, 
          url: `/api/music/ytdlp/proxy?url=${encodeURIComponent(downloadUrl)}`,
          streamType: streamType,
          message: streamType === 'hls' ? 'HLS流' : 'MP4流'
        })
      }

      if (source === 'YouTube') {
        if (!url.includes('youtube.com') && !url.includes('youtu.be') && !url.startsWith('http')) {
          url = `https://www.youtube.com/watch?v=${url}`
        }
      } else if (source === 'SoundCloud') {
        if (!url.includes('soundcloud.com') && !url.startsWith('http')) {
          url = `https://soundcloud.com/search?q=${encodeURIComponent(url)}`
        }
      } else if (source === 'Bandcamp') {
        if (!url.includes('bandcamp.com') && !url.startsWith('http')) {
          url = `https://bandcamp.com/search?q=${encodeURIComponent(url)}`
        }
      } else {
        if (!url.startsWith('http')) {
          url = `https://www.youtube.com/watch?v=${url}`
        }
      }

      console.log('[yt-dlp] Final URL:', url)

      const audioUrl = await execCommand([
        '-g',
        '-f', 'bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio[ext=webm]/bestaudio',
        '--no-warnings',
        url,
      ], { proxy: PROXY })

      const downloadUrl = audioUrl.trim().split('\n')[0]

      if (!downloadUrl) {
        throw new Error('无法获取下载链接')
      }

      console.log('[yt-dlp] Got URL:', downloadUrl.substring(0, 50) + '...')

      return NextResponse.json({
        success: true,
        url: downloadUrl,
      })
    }

    return NextResponse.json({
      success: false,
      error: '未知操作',
    })
  } catch (error: any) {
    console.error('[yt-dlp] Error:', error.message)
    return NextResponse.json({
      success: false,
      error: error.message || '操作失败',
    }, { status: 500 })
  }
}

// 流式搜索端点 - 实时推送进度和结果
export async function GET(request: Request) {
  const proxied = await proxyToMediaApi(request)
  if (proxied) return proxied

  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q') || searchParams.get('query') || ''
  
  console.log('[Stream] URL:', request.url)
  console.log('[Stream] youtube_count raw:', searchParams.get('youtube_count'), 'bilibili_count raw:', searchParams.get('bilibili_count'))
  
  const youtubeCountParam = searchParams.get('youtube_count') || searchParams.get('youtubeCount') || '1'
  const bilibiliCountParam = searchParams.get('bilibili_count') || searchParams.get('bilibiliCount') || '0'
  
  const parsedYoutubeCount = parseInt(youtubeCountParam)
  const parsedBilibiliCount = parseInt(bilibiliCountParam)
  const youtubeCount = Math.min(Math.max(Number.isNaN(parsedYoutubeCount) ? 1 : parsedYoutubeCount, 0), 10)
  const bilibiliCount = Math.min(Math.max(Number.isNaN(parsedBilibiliCount) ? 0 : parsedBilibiliCount, 0), 10)

  if (!query) {
    return new NextResponse('Missing query', { status: 400 })
  }

  console.log('[Stream] Starting streaming search for:', query, 'YouTube count:', youtubeCount, 'Bilibili count:', bilibiliCount)

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        send({ type: 'start', message: '开始搜索...', query })

        let allResults: SearchResult[] = []
        const total = EXTRACTORS.length

        for (let i = 0; i < EXTRACTORS.length; i++) {
          const extractor = EXTRACTORS[i]
          
          // 根据源确定搜索数量
          const maxCount = extractor.name === 'YouTube' ? youtubeCount : bilibiliCount
          
          // 如果搜索数量为0，跳过该搜索源
          if (maxCount <= 0) {
            console.log(`[Stream] Skipping ${extractor.name}: count is 0`)
            send({ type: 'skipped', source: extractor.name, reason: 'count is 0' })
            continue
          }
          
          send({ type: 'progress', progress: Math.round((i / total) * 50), message: `正在搜索 ${extractor.name}...` })

          try {
            let results = await searchWithExtractor(extractor, query, maxCount)
            
            if (results.length > 0) {
              allResults = [...allResults, ...results]
              const currentResults = deduplicateResults([...allResults])
              send({ 
                type: 'source_done', 
                source: extractor.name, 
                count: results.length,
                results: currentResults,
                progress: Math.round(((i + 0.5) / total) * 50)
              })
            }
          } catch (err: any) {
            console.error(`[Stream] ${extractor.name} error:`, err.message)
            send({ type: 'error', source: extractor.name, error: err.message })
          }
        }

        send({ type: 'progress', progress: 75, message: '处理结果...' })

        const deduplicated = deduplicateResults(allResults)
        
        send({ type: 'progress', progress: 90, message: '去重完成' })

        if (deduplicated.length > 0) {
          send({ 
            type: 'complete', 
            results: deduplicated,
            count: deduplicated.length,
            message: `找到 ${deduplicated.length} 个结果`
          })
        } else {
          send({ 
            type: 'complete', 
            results: [],
            count: 0,
            message: '未找到相关结果'
          })
        }

        controller.close()
      } catch (err: any) {
        console.error('[Stream] Error:', err)
        send({ type: 'error', error: err.message || '搜索失败' })
        controller.close()
      }
    }
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  })
}
