import { NextResponse } from 'next/server';
import { cacheFetch, cacheInvalidate } from '@/lib/cache-fetch';
import { getServiceSupabaseOrThrow } from '@/lib/supabase-service';

function getSupabaseAdmin() {
  return getServiceSupabaseOrThrow();
}

export async function POST() {
  try {
    const supabase = getSupabaseAdmin();
    
    const { data: externalPlaylists, error: epError } = await supabase
      .from('external_playlists')
      .select('id,platform_playlist_id,name,cover_url,track_count,created_at');
    
    if (epError) {
      console.error('获取外部歌单失败:', epError);
      return NextResponse.json({ error: epError.message }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `共 ${externalPlaylists?.length || 0} 个外部歌单`,
      count: externalPlaylists?.length || 0
    });
    
  } catch (error) {
    console.error('同步失败:', error);
    return NextResponse.json({ error: '同步失败' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const cached = await cacheFetch<{ local: any[]; external: any[] }>('/api/cache/playlists');
    if (cached !== null) {
      return NextResponse.json({
        localPlaylists: cached.local || [],
        externalPlaylists: cached.external || []
      });
    }
    
    const supabase = getSupabaseAdmin();
    
    const [localResult, externalResult] = await Promise.all([
      supabase.from('playlists').select('id,name,description,cover,created_at,platform_source,external_playlist_id,track_count').eq('platform_source', 'local'),
      supabase.from('external_playlists').select('id,platform_playlist_id,name,cover_url,track_count,source,created_at'),
    ]);

    const localPlaylists = localResult.data;
    if (localResult.error) {
      console.error('获取本地歌单失败:', localResult.error);
    }

    // 补充本地歌单的准确歌曲数（从 playlist_tracks 表实时计数）
    if (localPlaylists && localPlaylists.length > 0) {
      const playlistIds = localPlaylists.map((p: any) => p.id);
      const { data: counts } = await supabase
        .from('playlist_tracks')
        .select('playlist_id')
        .in('playlist_id', playlistIds);

      const countMap: Record<string, number> = {};
      (counts || []).forEach((pt: any) => {
        countMap[pt.playlist_id] = (countMap[pt.playlist_id] || 0) + 1;
      });
      localPlaylists.forEach((p: any) => {
        p.track_count = countMap[p.id] || 0;
      });
    }
    
    const externalPlaylists = externalResult.data;
    if (externalResult.error) {
      console.error('获取外部歌单失败:', externalResult.error);
    }
    
    return NextResponse.json({
      localPlaylists: localPlaylists || [],
      externalPlaylists: externalPlaylists || []
    });
    
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('获取状态失败:', error);
    return NextResponse.json({ error: '获取状态失败', detail: errMsg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const source = searchParams.get('source');
    const name = searchParams.get('name');
    
    if (!id) {
      return NextResponse.json({ error: '缺少歌单ID' }, { status: 400 });
    }
    
    const supabase = getSupabaseAdmin();
    
    if (source === 'external' || id.startsWith('external-')) {
      const numericId = id.replace('external-', '');
      const { error } = await supabase
        .from('external_playlists')
        .delete()
        .eq('id', numericId);
      
      if (error) {
        console.error('删除外部歌单失败:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      const numericId = parseInt(id);
      
      if (isNaN(numericId) && name) {
        const { error } = await supabase
          .from('playlists')
          .delete()
          .eq('name', name)
          .eq('platform_source', 'local');
        
        if (error) {
          console.error('删除本地歌单失败:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      } else {
        const { error } = await supabase
          .from('playlists')
          .delete()
          .eq('id', numericId);
        
        if (error) {
          console.error('删除本地歌单失败:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      }
    }
    
    await cacheInvalidate(['playlists', 'home']);
    
    return NextResponse.json({ success: true, message: '歌单已删除' });
    
  } catch (error) {
    console.error('删除失败:', error);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
