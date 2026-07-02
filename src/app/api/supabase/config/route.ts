import { NextResponse } from 'next/server';

export async function GET() {
  const url = process.env.COZE_SUPABASE_URL;
  const key = process.env.COZE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return NextResponse.json(
      { error: 'Supabase not configured' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    url,
    anonKey: key,
  });
}
