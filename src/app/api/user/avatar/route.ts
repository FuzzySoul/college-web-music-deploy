import { NextRequest, NextResponse } from 'next/server';
import { cacheInvalidate } from '@/lib/cache-fetch';
import { getServiceSupabaseOrThrow } from '@/lib/supabase-service';

function getSupabase() {
  return getServiceSupabaseOrThrow();
}

export async function PUT(request: NextRequest) {
  try {
    const { userId, avatarUrl } = await request.json();
    if (!userId || !avatarUrl) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: { avatar_url: avatarUrl },
    });

    if (error) {
      console.error('更新头像失败:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase.from('users').update({ avatar_url: avatarUrl }).eq('id', userId);
    await cacheInvalidate(['admin:stats']);

    return NextResponse.json({ success: true, avatar: avatarUrl });
  } catch (error) {
    console.error('头像API错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
