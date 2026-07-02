import { NextRequest, NextResponse } from 'next/server';
import { cacheInvalidate } from '@/lib/cache-fetch';
import { getServiceSupabaseOrThrow } from '@/lib/supabase-service';

function getSupabase() {
  return getServiceSupabaseOrThrow();
}

export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('explore_banners')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Banners API error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;

    if (action === 'create') {
      if (!data) {
        return NextResponse.json({ error: '缺少参数' }, { status: 400 });
      }

      const insertData: Record<string, any> = {};
      if (data.title !== undefined) insertData.title = data.title;
      if (data.image_url !== undefined) insertData.image_url = data.image_url;
      if (data.link_type !== undefined) insertData.link_type = data.link_type;
      if (data.link_id !== undefined) insertData.link_id = data.link_id;
      if (data.link_url !== undefined) insertData.link_url = data.link_url;
      if (data.sort_order !== undefined) insertData.sort_order = data.sort_order;
      if (data.is_active !== undefined) insertData.is_active = data.is_active;
      if (data.subtitle !== undefined) insertData.subtitle = data.subtitle;
      if (data.description !== undefined) insertData.description = data.description;
      if (data.tag !== undefined) insertData.tag = data.tag;
      if (data.bg_color !== undefined) insertData.bg_color = data.bg_color;
      if (data.cta_text !== undefined) insertData.cta_text = data.cta_text;

      const supabase = getSupabase();
      const { error } = await supabase.from('explore_banners').insert(insertData);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      await cacheInvalidate(['explore']);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: '无效的操作' }, { status: 400 });
  } catch (error) {
    console.error('Banners API error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, data } = body;

    if (!id || !data) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 });
    }

    const updateData: Record<string, any> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.image_url !== undefined) updateData.image_url = data.image_url;
    if (data.link_type !== undefined) updateData.link_type = data.link_type;
    if (data.link_id !== undefined) updateData.link_id = data.link_id;
    if (data.link_url !== undefined) updateData.link_url = data.link_url;
    if (data.sort_order !== undefined) updateData.sort_order = data.sort_order;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;
    if (data.subtitle !== undefined) updateData.subtitle = data.subtitle;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.tag !== undefined) updateData.tag = data.tag;
    if (data.bg_color !== undefined) updateData.bg_color = data.bg_color;
    if (data.cta_text !== undefined) updateData.cta_text = data.cta_text;

    const supabase = getSupabase();
    const { error } = await supabase.from('explore_banners').update(updateData).eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await cacheInvalidate(['explore']);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Banners API error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { error } = await supabase.from('explore_banners').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await cacheInvalidate(['explore']);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Banners API error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
