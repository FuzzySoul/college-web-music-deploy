import cors from 'cors'
import express, { type Request as ExpressRequest, type Response as ExpressResponse } from 'express'
import { Readable } from 'node:stream'

import { GET as downloadGet, POST as downloadPost } from '../../src/app/api/download/route'
import { GET as ytdlpGet, POST as ytdlpPost } from '../../src/app/api/music/ytdlp/route'

const app = express()
const port = Number(process.env.PORT || 10000)

app.use(cors())
app.use(express.json({ limit: '2mb' }))

function buildRequest(req: ExpressRequest): Request {
  const origin = `${req.protocol}://${req.get('host')}`
  const headers = new Headers()

  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      headers.set(key, value.join(', '))
    } else {
      headers.set(key, value)
    }
  }

  const init: RequestInit = {
    method: req.method,
    headers,
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = JSON.stringify(req.body ?? {})
  }

  return new Request(new URL(req.originalUrl, origin), init)
}

async function sendWebResponse(webResponse: Response, res: ExpressResponse) {
  res.status(webResponse.status)

  webResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'content-encoding') return
    res.setHeader(key, value)
  })

  if (!webResponse.body) {
    const text = await webResponse.text()
    res.send(text)
    return
  }

  Readable.fromWeb(webResponse.body as never).pipe(res)
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'render-media-api',
    timestamp: new Date().toISOString(),
  })
})

app.all('/api/music/ytdlp', async (req, res) => {
  try {
    const request = buildRequest(req)
    const response = req.method === 'GET' ? await ytdlpGet(request) : await ytdlpPost(request)
    await sendWebResponse(response, res)
  } catch (error) {
    console.error('[render-media-api:ytdlp]', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' })
  }
})

app.all('/api/download', async (req, res) => {
  try {
    const request = buildRequest(req)
    const response = req.method === 'GET' ? await downloadGet(request) : await downloadPost(request)
    await sendWebResponse(response, res)
  } catch (error) {
    console.error('[render-media-api:download]', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' })
  }
})

app.listen(port, '0.0.0.0', () => {
  console.log(`render-media-api listening on ${port}`)
})
