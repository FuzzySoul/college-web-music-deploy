import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cacheInvalidate } from '@/lib/cache-fetch'
import { SERVER_NETEASE_API_URL } from '@/lib/server-env'

const supabaseUrl = process.env['COZE_SUPABASE_URL'] || ''
const supabaseKey =
  process.env['SUPABASE_SERVICE_ROLE_KEY'] ||
  process.env['COZE_SUPABASE_SERVICE_ROLE_KEY'] ||
  ''

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase service env is missing')
  }
  return createClient(supabaseUrl, supabaseKey)
}

const NETEASE_API_URL = SERVER_NETEASE_API_URL

// 保存歌单元数据（并行处理，立即返回）
export async function POST(request: Request) {
  try {
    const supabase = getSupabase()
    const { platform, uid, playlistIds } = await request.json()

    if (!uid || !playlistIds || !Array.isArray(playlistIds)) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      )
    }

    const { data: platformData, error: platformError } = await supabase
      .from('external_platforms')
      .upsert({
        platform,
        platform_user_id: uid,
        nickname: '',
        cookie: '',
      }, {
        onConflict: 'platform,platform_user_id'
      })
      .select('id')
      .single()

    if (platformError) {
      return NextResponse.json(
        { error: '保存平台信息失败' },
        { status: 500 }
      )
    }

    const platformId = platformData.id

    // 并行获取所有歌单详情
    const playlistDetails = await Promise.all(
      playlistIds.map(async (playlistId: number) => {
        try {
          const detailResponse = await fetch(
            `${NETEASE_API_URL}/playlist/detail?id=${playlistId}`,
            { headers: { 'Referer': 'https://music.163.com/' } }
          )
          const detailData = await detailResponse.json()
          if (detailData.code !== 200) return null
          return {
            platformPlaylistId: String(playlistId),
            name: detailData.playlist.name,
            coverUrl: detailData.playlist.coverImgUrl,
            trackCount: detailData.playlist.trackCount || 0,
          }
        } catch (e) {
          console.error(`[save-playlists] Failed to fetch detail for ${playlistId}:`, e)
          return null
        }
      })
    )

    // 并行保存所有歌单元数据
    const savedPlaylists = await Promise.all(
      playlistDetails
        .filter((p): p is NonNullable<typeof p> => p !== null)
        .map(async (playlist) => {
          const { data, error } = await supabase
            .from('external_playlists')
            .upsert({
              platform_id: platformId,
              platform_playlist_id: playlist.platformPlaylistId,
              name: playlist.name,
              cover_url: playlist.coverUrl,
              track_count: playlist.trackCount,
            }, {
              onConflict: 'platform_id,platform_playlist_id'
            })
            .select('id,platform_playlist_id,name,cover_url,track_count')
            .single()

          if (error) {
            console.error(`[save-playlists] Failed to save playlist ${playlist.name}:`, error)
            return null
          }
          return data
        })
    )

    const successful = savedPlaylists.filter((p): p is NonNullable<typeof p> => p !== null)

    // 异步拉取歌曲（不阻塞返回）
    if (successful.length > 0) {
      fetchPlaylistTracksInBackground(successful, platformId)
    }

    await cacheInvalidate(['playlists', 'admin:playlists:all', 'home', 'admin:stats'])

    return NextResponse.json({
      success: true,
      message: `成功导入 ${successful.length} 个歌单`,
      playlists: successful.map(p => ({
        id: p.id,
        platformPlaylistId: p.platform_playlist_id,
        name: p.name,
        coverUrl: p.cover_url,
        trackCount: p.track_count,
      }))
    })
  } catch (error) {
    console.error('Save playlists error:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}

// 后台异步拉取歌曲（不阻塞主响应）
async function fetchPlaylistTracksInBackground(
  playlists: Array<{ id: string; platform_playlist_id: string }>,
  platformId: string
) {
  const supabase = getSupabase()
  for (const playlist of playlists) {
    try {
      const tracksResponse = await fetch(
        `${NETEASE_API_URL}/playlist/track/all?id=${playlist.platform_playlist_id}&limit=1000`,
        { headers: { 'Referer': 'https://music.163.com/' } }
      )
      const tracksData = await tracksResponse.json()

      if (tracksData.code !== 200) continue

      const tracks = tracksData.songs || []
      if (tracks.length === 0) continue

      // 批量插入歌曲（每批100条）
      const batchSize = 100
      for (let i = 0; i < tracks.length; i += batchSize) {
        const batch = tracks.slice(i, i + batchSize).map((track: any, idx: number) => ({
          playlist_id: playlist.id,
          track_title: track.name,
          track_artist: track.ar?.map((a: any) => a.name).join(', '),
          track_duration: track.dt,
          platform_track_id: String(track.id),
          position: i + idx + 1,
        }))

        const { error } = await supabase
          .from('external_playlist_tracks')
          .upsert(batch, {
            onConflict: 'playlist_id,platform_track_id'
          })

        if (error) {
          console.error(`[save-playlists] Batch insert failed for playlist ${playlist.id}:`, error)
        }
      }

      console.log(`[save-playlists] Background: loaded ${tracks.length} tracks for playlist ${playlist.id}`)
    } catch (error) {
      console.error(`[save-playlists] Background: failed to load tracks for playlist ${playlist.id}:`, error)
    }
  }

  // 歌曲加载完成后再次失效缓存
  await cacheInvalidate(['playlists', 'admin:playlists:all', 'home', 'admin:stats'])
}
