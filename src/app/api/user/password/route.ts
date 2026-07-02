import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabaseOrThrow } from '@/lib/supabase-service';

function getSupabase() {
  return getServiceSupabaseOrThrow();
}

export async function PUT(request: NextRequest) {
  try {
    const { userId, currentPassword, newPassword } = await request.json();
    if (!userId || !currentPassword || !newPassword) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: '新密码至少6位' }, { status: 400 });
    }

    const supabase = getSupabase();

    const { data: dbUser } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();

    const email = dbUser?.email;
    if (!email) {
      return NextResponse.json({ error: '用户邮箱不存在' }, { status: 400 });
    }

    const anonUrl =
      process.env['NEXT_PUBLIC_COZE_SUPABASE_URL'] ||
      process.env['NEXT_PUBLIC_SUPABASE_URL'] ||
      '';
    const anonKey =
      process.env['NEXT_PUBLIC_COZE_SUPABASE_ANON_KEY'] ||
      process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ||
      '';
    if (!anonUrl || !anonKey) {
      return NextResponse.json({ error: 'Supabase 匿名配置缺失' }, { status: 500 });
    }
    const anonClient = createClient(anonUrl, anonKey);

    const { error: signInError } = await anonClient.auth.signInWithPassword({
      email,
      password: currentPassword,
    });

    if (signInError) {
      return NextResponse.json({ error: '当前密码不正确' }, { status: 400 });
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (updateError) {
      console.error('更新密码失败:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('密码修改API错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
