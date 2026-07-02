import { NextRequest, NextResponse } from 'next/server'

const BILIBILI_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://www.bilibili.com',
  'Origin': 'https://www.bilibili.com'
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const audioUrl = searchParams.get('url')

  if (!audioUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  try {
    const response = await fetch(audioUrl, {
      headers: BILIBILI_HEADERS
    })

    if (!response.ok) {
      return NextResponse.json({ 
        error: `Failed to fetch audio: ${response.status} ${response.statusText}` 
      }, { status: response.status })
    }

    const headers = new Headers(response.headers)
    headers.set('Access-Control-Allow-Origin', '*')
    headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
    headers.set('Access-Control-Allow-Headers', 'Content-Type')

    return new NextResponse(response.body, {
      status: 200,
      headers
    })
  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message || 'Proxy error' 
    }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}
