import { NextResponse } from 'next/server';
import { SERVER_NETEASE_API_URL, withBaseUrl } from '@/lib/server-env';

const NETEASE_API_URL = SERVER_NETEASE_API_URL;

// 测试网络连接
async function testConnection() {
  try {
    const testUrl = withBaseUrl(NETEASE_API_URL, '/captcha/sent?phone=13800000000');
    console.log('[Netease API] Testing connection to:', testUrl);
    const response = await fetch(testUrl, {
      headers: { 'Referer': 'https://music.163.com/' }
    });
    const data = await response.json();
    console.log('[Netease API] Test result:', data);
    return data;
  } catch (e) {
    console.error('[Netease API] Test failed:', e);
    return null;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const pathString = '/' + path.join('/');
  
  const { searchParams } = new URL(request.url);
  const queryString = searchParams.toString();
  
  const urlString = queryString 
    ? `${NETEASE_API_URL}${pathString}?${queryString}`
    : `${NETEASE_API_URL}${pathString}`;

  try {
    console.log('[Netease API] Fetching:', urlString);
    const response = await fetch(urlString, {
      headers: {
        'Referer': 'https://music.163.com/',
      },
    });

    const data = await response.json();
    console.log('[Netease API] Response:', data);

    return NextResponse.json(data);
  } catch (error) {
    console.error('[Netease API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch from Netease API', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const pathString = '/' + path.join('/');
  
  const body = await request.json();
  
  try {
    const response = await fetch(`${NETEASE_API_URL}${pathString}`, {
      method: 'POST',
      headers: {
        'Referer': 'https://music.163.com/',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch from Netease API', details: String(error) },
      { status: 500 }
    );
  }
}
