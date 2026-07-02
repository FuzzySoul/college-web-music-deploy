import { NextRequest, NextResponse } from 'next/server';
import { SERVER_CACHE_API_URL } from '@/lib/server-env';
import { getServiceSupabaseOrThrow } from '@/lib/supabase-service';

function getSupabase() {
  return getServiceSupabaseOrThrow();
}

export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('forbidden_words')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data || []);
  } catch (error) {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { word } = await request.json();
    if (!word || !word.trim()) {
      return NextResponse.json({ error: '违禁词不能为空' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('forbidden_words')
      .insert({ word: word.trim() })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    fetch(`${SERVER_CACHE_API_URL}/api/cache/forbidden-words/invalidate`, { method: 'POST' }).catch(() => {});
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: '缺少ID' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { error } = await supabase
      .from('forbidden_words')
      .delete()
      .eq('id', parseInt(id));

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    fetch(`${SERVER_CACHE_API_URL}/api/cache/forbidden-words/invalidate`, { method: 'POST' }).catch(() => {});
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
