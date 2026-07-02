import { NextRequest, NextResponse } from 'next/server';
import { cacheInvalidate } from '@/lib/cache-fetch';
import { getServiceSupabaseOrThrow } from '@/lib/supabase-service';

function getSupabase() {
  return getServiceSupabaseOrThrow();
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const userId = formData.get('userId') as string | null;

    if (!file || !userId) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 });
    }

    const supabase = getSupabase();

    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.find((b) => b.name === 'avatars')) {
      const { error: createError } = await supabase.storage.createBucket('avatars', { public: true });
      if (createError) {
        return NextResponse.json({ error: '无法创建存储空间: ' + createError.message }, { status: 500 });
      }
    }

    const ext = file.name.split('.').pop() || 'jpg';
    const filePath = `avatars/${userId}_${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      return NextResponse.json({ error: '上传失败: ' + uploadError.message }, { status: 500 });
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    // 同步更新 auth.users.user_metadata（如该用户存在）
    // 测试数据等仅在 public.users 中的用户没有对应的 auth.users 记录，
    // 此调用会失败，但不应阻塞主流程（public.users 才是头像展示的源头）
    try {
      const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
        user_metadata: { avatar_url: publicUrl },
      });
      if (updateError) {
        console.warn(`更新 auth.users.user_metadata 失败（${userId}）:`, updateError.message);
      }
    } catch (e) {
      console.warn(`更新 auth.users 异常（${userId}）:`, e);
    }

    // 主流程：更新 public.users.avatar_url（这是头像展示的源头）
    const { error: dbError } = await supabase
      .from('users')
      .update({ avatar_url: publicUrl })
      .eq('id', userId);

    if (dbError) {
      return NextResponse.json({ error: '更新用户表失败: ' + dbError.message }, { status: 500 });
    }

    await cacheInvalidate(['admin:stats']);

    return NextResponse.json({ success: true, avatar: publicUrl });
  } catch (error) {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
