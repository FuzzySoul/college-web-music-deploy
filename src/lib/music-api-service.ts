import { getSupabaseClient } from '@/storage/database/supabase-client'

export interface ExternalPlaylist {
  id: string
  platform_id: string
  platform_playlist_id: string
  name: string
  description: string | null
  cover_url: string | null
  track_count: number
}

export interface ExternalTrack {
  id: string
  playlist_id: string
  track_title: string
  track_artist: string | null
  track_album: string | null
  track_duration: number | null
  platform_track_id: string | null
  position: number | null
}

export async function fetchUserPlaylists(platform: 'netease' | 'qq', apiUrl: string, cookie: string) {
  const supabase = await getSupabaseClient()
  
  const { data: platformData } = await supabase
    .from('external_platforms')
    .select('id')
    .eq('platform', platform)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!platformData) {
    throw new Error('未登录该平台')
  }

  const response = await fetch(
    `${apiUrl}/user/playlist?cookie=${encodeURIComponent(cookie)}&limit=100`,
    { headers: { 'Referer': 'https://music.163.com/' } }
  )
  const data = await response.json()

  if (data.code !== 200) {
    throw new Error(data.message || '获取歌单失败')
  }

  const playlists = data.playlist || []

  for (const playlist of playlists) {
    await supabase.from('external_playlists').upsert({
      platform_id: platformData.id,
      platform_playlist_id: String(playlist.id),
      name: playlist.name,
      cover_url: playlist.coverImgUrl,
      track_count: playlist.trackCount,
    }, {
      onConflict: 'platform_id,platform_playlist_id'
    })
  }

  return playlists
}

export async function fetchPlaylistTracks(
  platform: 'netease' | 'qq',
  apiUrl: string,
  cookie: string,
  playlistId: string
) {
  const supabase = await getSupabaseClient()

  const { data: playlistData } = await supabase
    .from('external_playlists')
    .select('id')
    .eq('platform_playlist_id', playlistId)
    .single()

  if (!playlistData) {
    throw new Error('歌单不存在')
  }

  const proxyUrl = `/api/netease/proxy?path=${encodeURIComponent(`/playlist/track/all?cookie=${encodeURIComponent(cookie)}&id=${playlistId}&limit=1000`)}`
  const response = await fetch(proxyUrl)
  const data = await response.json()

  if (data.code !== 200) {
    throw new Error(data.message || '获取歌曲失败')
  }

  const tracks = data.songs || []

  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i]
    await supabase.from('external_playlist_tracks').insert({
      playlist_id: playlistData.id,
      track_title: track.name,
      track_artist: track.ar?.map((a: any) => a.name).join(', '),
      track_album: track.al?.name,
      track_duration: track.dt,
      platform_track_id: String(track.id),
      position: i + 1,
    })
  }

  return tracks
}

export async function getStoredPlaylists(platform: 'netease' | 'qq') {
  const supabase = await getSupabaseClient()

  const { data: platformData } = await supabase
    .from('external_platforms')
    .select('id')
    .eq('platform', platform)
    .order('created_at', { ascending: false })

  if (!platformData || platformData.length === 0) {
    return []
  }

  const platformIds = platformData.map(p => p.id)

  const { data: playlists } = await supabase
    .from('external_playlists')
    .select('*')
    .in('platform_id', platformIds)
    .order('track_count', { ascending: false })

  return playlists || []
}

export async function getPlaylistTracks(playlistId: string) {
  const supabase = await getSupabaseClient()

  const { data: tracks } = await supabase
    .from('external_playlist_tracks')
    .select('*')
    .eq('playlist_id', playlistId)
    .order('position')

  return tracks || []
}
