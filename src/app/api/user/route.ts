import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabaseOrThrow } from '@/lib/supabase-service';

function getSupabase() {
  return getServiceSupabaseOrThrow();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, userData } = body;
    const supabase = getSupabase();

    if (!supabase) {
      return NextResponse.json({ error: 'Supabase未配置' }, { status: 500 });
    }

    if (action === 'create_user' && userData) {
      const { id, email: userEmail, username } = userData;

      if (!id || !userEmail) {
        return NextResponse.json({ error: '缺少必需参数: id 或 email' }, { status: 400 });
      }

      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('email', userEmail)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ success: true, message: '用户已存在' });
      }

      const { data, error } = await supabase
        .from('users')
        .insert({
          id,
          email: userEmail,
          username: username || userEmail.split('@')[0],
          role: 'user'
        })
        .select()
        .single();

      if (error) {
        console.error('[User API] Insert error:', error);
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ success: true, user: data });
    }

    return NextResponse.json({ error: '无效的操作' }, { status: 400 });
  } catch (error) {
    console.error('[User API] Error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
