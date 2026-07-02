import { NextRequest, NextResponse } from 'next/server';
import { cacheInvalidate } from '@/lib/cache-fetch';
import { getServiceSupabaseOrThrow } from '@/lib/supabase-service';

function getSupabase() {
  return getServiceSupabaseOrThrow();
}

export async function PUT(request: NextRequest) {
  try {
    const { userId, username, email } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: '缺少用户ID' }, { status: 400 });
    }

    const supabase = getSupabase();

    const updateData: Record<string, string> = {};
    if (username !== undefined) updateData.username = username;
    if (email !== undefined) updateData.email = email;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: '没有需要更新的字段' }, { status: 400 });
    }

    if (email !== undefined) {
      const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
        email: email,
      });
      if (authError) {
        console.error('更新Auth邮箱失败:', authError);
      }
    }

    if (username !== undefined) {
      const { error: metaError } = await supabase.auth.admin.updateUserById(userId, {
        user_metadata: { username: username },
      });
      if (metaError) {
        console.error('更新Auth用户名失败:', metaError);
      }
    }

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('更新用户资料失败:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await cacheInvalidate(['admin:stats']);

    return NextResponse.json({ success: true, user: data });
  } catch (error) {
    console.error('用户资料API错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
