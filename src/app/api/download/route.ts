import { NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { SERVER_MEDIA_API_URL, withBaseUrl } from '@/lib/server-env'

const YTDLP_PATH = process.env.YTDLP_PATH || 'yt-dlp'
const PROXY = process.env.HTTP_PROXY || process.env.HTTPS_PROXY || ''

const BILIBILI_HEADERS = [
  'User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer:https://www.bilibili.com',
  'Origin:https://www.bilibili.com'
]

async function proxyToMediaApi(request: Request): Promise<NextResponse | null> {
  if (!SERVER_MEDIA_API_URL) return null

  const url = new URL(request.url)
  const targetUrl = withBaseUrl(SERVER_MEDIA_API_URL, `/api/download${url.search}`)
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

export async function GET(request: Request) {
  const proxied = await proxyToMediaApi(request)
  if (proxied) return proxied

  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url') || ''
  const source = searchParams.get('source') || ''

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  console.log('[Download API] Request:', { url, source })

  const isBilibili = source === 'Bilibili' || url.includes('bilibili.com')
  const useProxy = !isBilibili

  const args = [
    '--output', '-',
    '-f', 'bestaudio/best',
    '--no-playlist',
    '--no-warnings',
    '--no-check-certificate',
  ]

  let finalUrl = url
  if (isBilibili) {
    finalUrl = url.includes('bilibili.com') ? url : 
      (url.includes('av') ? `https://www.bilibili.com/video/${url}` : url)
  } else if (source === 'YouTube' || url.includes('youtube.com') || url.includes('youtu.be')) {
    if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
      finalUrl = `https://www.youtube.com/watch?v=${url}`
    }
  } else {
    finalUrl = url.startsWith('http') ? url : `https://www.youtube.com/watch?v=${url}`
  }

  args.push(finalUrl)

  const spawnOptions: { shell: boolean; proxy?: string; headers?: string[] } = { shell: true }
  if (useProxy) {
    spawnOptions.proxy = PROXY
  } else {
    spawnOptions.headers = BILIBILI_HEADERS
  }

  const encoder = new TextEncoder()
  let isClosed = false

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"type":"start","message":"开始下载..."}\n\n'))

      const finalArgs = []
      if (spawnOptions.proxy) finalArgs.push('--proxy', spawnOptions.proxy)
      if (spawnOptions.headers) for (const h of spawnOptions.headers) finalArgs.push('--add-header', h)
      finalArgs.push(...args)

      const process = spawn(YTDLP_PATH, finalArgs, { shell: true })
      let stderr = ''

      process.stdout.on('data', (data: Buffer) => {
        if (!isClosed) {
          try { controller.enqueue(data) } catch (e) {}
        }
      })

      process.stderr.on('data', (data: Buffer) => {
        stderr += data.toString()
      })

      process.on('close', (code) => {
        isClosed = true
        if (code === 0) {
          try { controller.enqueue(encoder.encode('data: {"type":"complete","message":"下载完成"}\n\n')) } catch (e) {}
          controller.close()
        } else {
          const errorMsg = stderr.includes('ERROR') ? stderr.split('\n').find(l => l.includes('ERROR')) || '下载失败' : `Process exited with code ${code}`
          console.error('[Download API] Error:', errorMsg)
          try { controller.enqueue(encoder.encode(`data: {"type":"error","message":"${errorMsg}"}\n\n`)) } catch (e) {}
          controller.close()
        }
      })

      process.on('error', (err) => {
        isClosed = true
        console.error('[Download API] Spawn error:', err.message)
        try { controller.enqueue(encoder.encode(`data: {"type":"error","message":"${err.message}"}\n\n`)) } catch (e) {}
        controller.close()
      })

      setTimeout(() => {
        if (!isClosed) {
          process.kill()
          controller.close()
        }
      }, 300000)
    },
    cancel() {
      isClosed = true
    }
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Disposition': "attachment; filename=\"download.mp3\"",
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    }
  })
}

export async function POST(request: Request) {
  const proxied = await proxyToMediaApi(request)
  if (proxied) return proxied

  try {
    const body = await request.json()
    const { url, source, filename } = body
    if (!url) return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })

    const isBilibili = source === 'Bilibili' || url.includes('bilibili.com')
    const useProxy = !isBilibili

    const args = [
      '--output', '-',
      '-f', 'bestaudio/best',
      '--no-playlist',
      '--no-warnings',
      '--no-check-certificate',
    ]

    let finalUrl = url
    if (isBilibili) {
      finalUrl = url.includes('bilibili.com') ? url : 
        (url.includes('av') ? `https://www.bilibili.com/video/${url}` : url)
    } else if (source === 'YouTube' || url.includes('youtube.com') || url.includes('youtu.be')) {
      if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
        finalUrl = `https://www.youtube.com/watch?v=${url}`
      }
    } else {
      finalUrl = url.startsWith('http') ? url : `https://www.youtube.com/watch?v=${url}`
    }

    args.push(finalUrl)

    const spawnOptions: { shell: boolean; proxy?: string; headers?: string[] } = { shell: true }
    if (useProxy) {
      spawnOptions.proxy = PROXY
    } else {
      spawnOptions.headers = BILIBILI_HEADERS
    }

    const stream = new ReadableStream({
      start(controller) {
        const finalArgs = []
        if (spawnOptions.proxy) finalArgs.push('--proxy', spawnOptions.proxy)
        if (spawnOptions.headers) for (const h of spawnOptions.headers) finalArgs.push('--add-header', h)
        finalArgs.push(...args)

        const ytProcess = spawn(YTDLP_PATH, finalArgs, { shell: true })
        let stderr = ''

        ytProcess.stdout.on('data', (data: Buffer) => {
          try { controller.enqueue(data) } catch (e) {}
        })

        ytProcess.stderr.on('data', (data: Buffer) => {
          stderr += data.toString()
        })

        ytProcess.on('close', (code) => {
          if (code !== 0) {
            const errorMsg = stderr.includes('ERROR') ? stderr.split('\n').find(l => l.includes('ERROR')) || '下载失败' : `Process exited with code ${code}`
            console.error('[Download API] Error:', errorMsg)
          }
          controller.close()
        })

        ytProcess.on('error', (err) => {
          console.error('[Download API] Spawn error:', err.message)
          controller.close()
        })

        setTimeout(() => {
          try { ytProcess.kill() } catch (e) {}
          controller.close()
        }, 300000)
      },
      cancel() {
      }
    })

    const safeFilename = filename 
      ? filename.replace(/[<>:"/\\|?*]/g, '_').substring(0, 100) 
      : 'download'

    const asciiFilename = safeFilename.replace(/[^a-zA-Z0-9_\-\.]/g, '_')
    const encodedFilename = encodeURIComponent(safeFilename)
    const contentDisposition = `attachment; filename="${asciiFilename}.mp3"; filename*=UTF-8''${encodedFilename}.mp3`

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': contentDisposition,
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
