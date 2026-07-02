import { NextRequest, NextResponse } from 'next/server';
import { cacheInvalidate } from '@/lib/cache-fetch';
import { syncArtistInfo, type MBSyncResult } from '@/lib/musicbrainz-service';
import { getServiceSupabaseOrThrow } from '@/lib/supabase-service';

export const maxDuration = 120;

function getSupabase() {
  return getServiceSupabaseOrThrow();
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const artistName = searchParams.get('artistName');
    if (!artistName) {
      return NextResponse.json({ error: '缺少歌手名称' }, { status: 400 });
    }

    const mbResult: MBSyncResult = await syncArtistInfo(artistName);
    const supabase = getSupabase();

    if (mbResult.artist) {
      const { country, type, gender, disambiguation, tags } = mbResult.artist;
      const descParts: string[] = [];
      if (country) descParts.push(`国家: ${country}`);
      if (type) descParts.push(`类型: ${type}`);
      if (gender) descParts.push(`性别: ${gender}`);
      if (disambiguation) descParts.push(disambiguation);
      if (tags?.length) descParts.push(`标签: ${tags.map(t => t.name).join(', ')}`);
      const description = descParts.join('\n');

      console.log(`[MB Sync] 写入歌手: ${artistName}, MBID: ${mbResult.artist.id}`);

      await supabase.from('artists').upsert({
        name: artistName,
        ...(description && { description }),
        musicbrainz_id: mbResult.artist.id,
        mb_synced_at: new Date().toISOString(),
      }, { onConflict: 'name' });
    }

    if (mbResult.releaseGroups?.length) {
      console.log(`[MB Sync] 写入 ${mbResult.releaseGroups.length} 个专辑`);
      const albumUpserts = mbResult.releaseGroups.map(rg => ({
        name: rg.title,
        artist: artistName,
        release_year: rg['first-release-date'] ? parseInt(rg['first-release-date'].split('-')[0]) || null : null,
        cover: rg.coverUrl || null,
      }));
      for (const album of albumUpserts) {
        const { error } = await supabase.from('albums').upsert(album, { onConflict: 'name,artist' });
        if (error) console.error('[MB Sync] 专辑写入失败:', album.name, error.message);
      }
    }

    if (mbResult.recordings?.length) {
      console.log(`[MB Sync] 写入 ${Math.min(mbResult.recordings.length, 50)} 首歌曲`);
      const uniqueRecordings = mbResult.recordings.filter(
        (r, i, self) => self.findIndex(x => x.title === r.title) === i
      );
      const trackUpserts = uniqueRecordings.slice(0, 50).map(r => {
        let albumName = null;
        if (r['release-list']?.length) {
          albumName = r['release-list'][0].title || null;
        }
        let coverUrl = null;
        if (albumName && mbResult.releaseGroups) {
          const matchedRG = mbResult.releaseGroups.find(rg => rg.title === albumName);
          if (matchedRG?.coverUrl) coverUrl = matchedRG.coverUrl;
        }
        return {
          title: r.title,
          artist: artistName,
          duration: Math.floor((r.length || 0) / 1000),
          source: 'musicbrainz',
          album: albumName,
          cover: coverUrl,
        };
      });
      for (const track of trackUpserts) {
        await supabase.from('tracks').upsert(track, { onConflict: 'title,artist' });
      }
    }

    await cacheInvalidate(['artists', 'home', 'admin:stats']);

    return NextResponse.json({
      success: true,
      artistName,
      data: mbResult,
      albumsSynced: mbResult.releaseGroups?.length || 0,
      tracksSynced: Math.min(
        mbResult.recordings?.filter((r, i, self) => self.findIndex(x => x.title === r.title) === i).length || 0,
        50
      ),
      artistInfo: {
        musicbrainz_id: mbResult.artist?.id,
        name: mbResult.artist?.name,
        totalReleaseGroups: mbResult.releaseGroups?.length || 0,
        totalRecordings: mbResult.recordings?.length || 0,
        hasCoverArt: mbResult.releaseGroups?.some((rg: any) => rg.coverUrl) || false,
      },
    });
  } catch (error) {
    console.error('MusicBrainz 同步失败:', error);
    return NextResponse.json({ error: '同步失败', detail: String(error) }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const artistName = searchParams.get('artistName');
    if (!artistName) {
      return NextResponse.json({ error: '缺少歌手名称' }, { status: 400 });
    }

    const result = await syncArtistInfo(artistName);
    return NextResponse.json(result);
  } catch (error) {
    console.error('获取 MusicBrainz 数据失败:', error);
    return NextResponse.json({ error: '获取数据失败' }, { status: 500 });
  }
}
