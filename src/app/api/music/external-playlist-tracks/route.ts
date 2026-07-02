import { NextResponse } from 'next/server';
import { cacheInvalidate } from '@/lib/cache-fetch';
import { getServiceSupabaseOrThrow } from '@/lib/supabase-service';

async function getSupabaseAdmin() {
  return getServiceSupabaseOrThrow();
}

// POST: 向自建爬虫歌单添加歌曲
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { playlist_id, track_title, track_artist, track_duration } = body;

    if (!playlist_id) {
      return NextResponse.json({ error: '缺少歌单ID' }, { status: 400 });
    }
    if (!track_title || typeof track_title !== 'string' || track_title.trim() === '') {
      return NextResponse.json({ error: '歌曲名称不能为空' }, { status: 400 });
    }

    const supabase = await getSupabaseAdmin();

    const { data: maxPos, error: posError } = await supabase
      .from('external_playlist_tracks')
      .select('position')
      .eq('playlist_id', playlist_id)
      .order('position', { ascending: false })
      .limit(1);

    const nextPosition = (maxPos && maxPos.length > 0 ? (maxPos[0].position || 0) + 1 : 0);

    const { data: track, error } = await supabase
      .from('external_playlist_tracks')
      .insert({
        playlist_id,
        track_title: track_title.trim(),
        track_artist: track_artist?.trim() || null,
        track_duration: track_duration || null,
        position: nextPosition,
      })
      .select()
      .single();

    if (error) {
      console.error('添加歌曲失败:', error);
      return NextResponse.json({ error: '添加歌曲失败: ' + error.message }, { status: 500 });
    }

    const { error: countError } = await supabase.rpc('increment_track_count', {
      p_playlist_id: playlist_id,
    });

    if (countError) {
      const { data: countData } = await supabase
        .from('external_playlist_tracks')
        .select('id', { count: 'exact', head: true })
        .eq('playlist_id', playlist_id);

      await supabase
        .from('external_playlists')
        .update({ track_count: countData ? (countData as any).count : 0 })
        .eq('id', playlist_id);
    }

    console.log('✅ 歌曲已添加到自建爬虫歌单:', track.id);

    cacheInvalidate(['playlists', 'admin:playlists', 'home']);

    return NextResponse.json({ success: true, data: track, message: '歌曲添加成功' }, { status: 201 });
  } catch (error) {
    console.error('添加歌曲异常:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

// DELETE: 从自建爬虫歌单删除歌曲
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const playlist_id = searchParams.get('playlist_id');

    if (!id) {
      return NextResponse.json({ error: '缺少歌曲ID' }, { status: 400 });
    }

    const supabase = await getSupabaseAdmin();

    const { error } = await supabase
      .from('external_playlist_tracks')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('删除歌曲失败:', error);
      return NextResponse.json({ error: '删除歌曲失败: ' + error.message }, { status: 500 });
    }

    if (playlist_id) {
      const { data: countData } = await supabase
        .from('external_playlist_tracks')
        .select('id', { count: 'exact', head: true })
        .eq('playlist_id', playlist_id);

      const count = countData ? (countData as any).count : 0;

      await supabase
        .from('external_playlists')
        .update({ track_count: count })
        .eq('id', playlist_id);
    }

    console.log('✅ 歌曲已从自建爬虫歌单删除:', id);

    cacheInvalidate(['playlists', 'admin:playlists', 'home']);

    return NextResponse.json({ success: true, message: '歌曲删除成功' });
  } catch (error) {
    console.error('删除歌曲异常:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
