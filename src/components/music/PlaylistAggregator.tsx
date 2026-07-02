'use client'

import { useEffect, useState, useCallback, useRef, lazy, Suspense } from 'react'
import Hls from 'hls.js'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { getStoredPlaylists, getPlaylistTracks, ExternalPlaylist, ExternalTrack } from '@/lib/music-api-service'
import { Music, RefreshCw, ChevronRight, Search, Download, Loader2, AlertCircle, Play, X } from 'lucide-react'

interface PlaylistAggregatorProps {
  platform: 'netease' | 'qq'
  apiUrl: string
}

interface SearchResult {
  id: string
  title: string
  url: string
  duration: number
  uploader: string
  thumbnail?: string
  source?: string
}

export function PlaylistAggregator({ platform, apiUrl }: PlaylistAggregatorProps) {
  const [playlists, setPlaylists] = useState<ExternalPlaylist[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPlaylist, setSelectedPlaylist] = useState<ExternalPlaylist | null>(null)
  const [playlistTracks, setPlaylistTracks] = useState<ExternalTrack[]>([])
  const [loadingTracks, setLoadingTracks] = useState(false)

  // 搜索相关状态
  const [searchDialogOpen, setSearchDialogOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [currentSearchTrack, setCurrentSearchTrack] = useState<ExternalTrack | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [youtubeCount, setYoutubeCount] = useState(2)
  const [bilibiliCount, setBilibiliCount] = useState(2)
  
  // 从 localStorage 加载搜索数量配置
  const loadSearchCounts = () => {
    try {
      const saved = localStorage.getItem('searchCounts')
      if (saved) {
        const parsed = JSON.parse(saved)
        setYoutubeCount(parsed.youtubeCount || 2)
        setBilibiliCount(parsed.bilibiliCount || 2)
      }
    } catch (error) {
      console.error('Failed to load search counts:', error)
    }
  }
  
  const saveSearchCounts = () => {
    try {
      const counts = { youtubeCount, bilibiliCount }
      localStorage.setItem('searchCounts', JSON.stringify(counts))
    } catch (error) {
      console.error('Failed to save search counts:', error)
    }
  }
  
  // 初始化时从 localStorage 加载
  useEffect(() => {
    loadSearchCounts()
  }, [])
  
  // 当搜索数量变化时自动保存
  useEffect(() => {
    saveSearchCounts()
  }, [youtubeCount, bilibiliCount])
  
  // 音频播放状态
  const [currentPlaying, setCurrentPlaying] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  
  // HLS 流状态
  const [hlsPlayer, setHlsPlayer] = useState<Hls | null>(null)
  const [videoRef, setVideoRef] = useState<HTMLVideoElement | null>(null)
  const [hlsUrl, setHlsUrl] = useState<string | null>(null)
  const [videoDialogOpen, setVideoDialogOpen] = useState(false)

  // 检测 HLS 流
  const isHlsStream = (url: string): boolean => {
    return url.includes('.m3u8') || url.includes('m3u8')
  }

  // 清理 HLS 播放器
  const cleanupPlayer = useCallback(() => {
    if (hlsPlayer) {
      hlsPlayer.destroy()
      setHlsPlayer(null)
    }
  }, [hlsPlayer])

  const togglePlay = useCallback((url: string) => {
    if (!url) return
    
    if (isHlsStream(url)) {
      if (currentPlaying === url && videoRef) {
        if (isPlaying) {
          videoRef.pause()
          setIsPlaying(false)
        } else {
          videoRef.play()
          setIsPlaying(true)
        }
      } else {
        cleanupPlayer()
        setHlsUrl(url)
        setCurrentPlaying(url)
        setVideoDialogOpen(true)
      }
      return
    }

    if (currentPlaying === url && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
        setIsPlaying(false)
      } else {
        audioRef.current.play()
        setIsPlaying(true)
      }
    } else {
      if (audioRef.current) {
        audioRef.current.src = url
        audioRef.current.play().catch((err) => {
          console.error('Audio play failed:', err)
          alert('播放失败，请尝试其他来源')
          setCurrentPlaying(null)
          setIsPlaying(false)
        })
        setCurrentPlaying(url)
        setIsPlaying(true)
      }
    }
  }, [currentPlaying, isPlaying, videoRef, cleanupPlayer])

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
      }
      cleanupPlayer()
    }
  }, [cleanupPlayer])

  // HLS 流加载和播放
  useEffect(() => {
    if (videoDialogOpen && hlsUrl && videoRef) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
        })
        hls.loadSource(hlsUrl)
        hls.attachMedia(videoRef)
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          videoRef.play().then(() => {
            setIsPlaying(true)
          }).catch(console.error)
        })
        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('HLS error:', data)
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                hls.startLoad()
                break
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError()
                break
              default:
                cleanupPlayer()
                setVideoDialogOpen(false)
                break
            }
          }
        })
        setHlsPlayer(hls)
      } else if (videoRef.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.src = hlsUrl
        videoRef.addEventListener('loadedmetadata', () => {
          videoRef.play().then(() => {
            setIsPlaying(true)
          }).catch(console.error)
        })
      } else {
        alert('您的浏览器不支持 HLS 播放')
        setVideoDialogOpen(false)
      }
    }
    return () => {
      if (videoDialogOpen && !hlsUrl) {
        cleanupPlayer()
      }
    }
  }, [videoDialogOpen, hlsUrl, videoRef])

  // 批量搜索状态
  const [batchSearchOpen, setBatchSearchOpen] = useState(false)
  const [batchSearching, setBatchSearching] = useState(false)
  const [batchResults, setBatchResults] = useState<Map<string, SearchResult[]>>(new Map())
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 })
  const [downloadLinks, setDownloadLinks] = useState<Map<string, string>>(new Map())

  const platformName = platform === 'netease' ? '网易云音乐' : 'QQ音乐'
  const platformColor = platform === 'netease' ? 'bg-red-500' : 'bg-green-500'

  const loadPlaylists = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getStoredPlaylists(platform)
      setPlaylists(data)
    } catch (error) {
      console.error('Failed to load playlists:', error)
    } finally {
      setLoading(false)
    }
  }, [platform])

  useEffect(() => {
    loadPlaylists()
  }, [loadPlaylists])

  const handlePlaylistClick = useCallback(async (playlist: ExternalPlaylist) => {
    if (selectedPlaylist?.id === playlist.id) {
      setSelectedPlaylist(null)
      setPlaylistTracks([])
      return
    }
    
    setSelectedPlaylist(playlist)
    setLoadingTracks(true)
    try {
      const tracks = await getPlaylistTracks(playlist.id)
      setPlaylistTracks(tracks)
    } catch (error) {
      console.error('Failed to load tracks:', error)
    } finally {
      setLoadingTracks(false)
    }
  }, [selectedPlaylist])

  const handleDirectDownload = useCallback(async (track: ExternalTrack) => {
    console.log('[yt-dlp] Streaming search:', track.track_title, '-', track.track_artist)
    
    const query = `${track.track_title} ${track.track_artist}`
    setCurrentSearchTrack(track)
    setSearchQuery(query)
    setSearchDialogOpen(true)
    setSearchResults([])
    setDownloadLinks(new Map())
    setSearching(true)
    
    try {
      const response = await fetch(`/api/music/ytdlp?q=${encodeURIComponent(query)}&youtube_count=${youtubeCount}&bilibili_count=${bilibiliCount}`, {
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream',
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      
      if (!reader) {
        throw new Error('No response body')
      }
      
      let buffer = ''
      
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break
        
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              console.log('[Stream]', data)
              
              if (data.type === 'progress' || data.type === 'start') {
                // 更新进度状态
              } else if (data.type === 'source_done') {
                console.log(`[Stream] ${data.source} 完成，找到 ${data.count} 个结果，当前共 ${data.results?.length || 0} 个`)
                if (data.results && data.results.length > 0) {
                  setSearchResults(data.results)
                }
              } else if (data.type === 'complete') {
                setSearchResults(data.results || [])
                setSearching(false)
              } else if (data.type === 'error') {
                alert(data.error || '搜索失败')
                setSearching(false)
              }
            } catch (e) {
              console.error('[Stream] Parse error:', e)
            }
          }
        }
      }
    } catch (error) {
      console.error('[yt-dlp] Error:', error)
      alert('搜索失败，请稍后重试')
      setSearching(false)
    }
  }, [youtubeCount, bilibiliCount])

  // 单曲搜索（仅当没有 platform_track_id 时使用）
  const handleSearchTrack = useCallback(async (track: ExternalTrack) => {
    // 如果有平台ID，直接下载
    if (track.platform_track_id) {
      handleDirectDownload(track)
      return
    }
    
    // 否则打开搜索对话框
    setCurrentSearchTrack(track)
    setSearchQuery(`${track.track_title} ${track.track_artist}`)
    setSearchDialogOpen(true)
    setSearchResults([])
  }, [handleDirectDownload])

  const executeSearch = useCallback(async (query: string, ytCount: number, biliCount: number) => {
    if (!query.trim()) return
    
    setSearching(true)
    setSearchResults([])
    console.log('[yt-dlp] Starting streaming search for:', query, 'YouTube count:', ytCount, 'Bilibili count:', biliCount)
    
    try {
      const url = `/api/music/ytdlp?q=${encodeURIComponent(query)}&youtube_count=${ytCount}&bilibili_count=${biliCount}`
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream',
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      
      if (!reader) {
        throw new Error('No response body')
      }
      
      let buffer = ''
      
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break
        
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              console.log('[Stream]', data)
              
              if (data.type === 'complete') {
                setSearchResults(data.results || [])
                setSearching(false)
              } else if (data.type === 'error') {
                alert(data.error || '搜索失败')
                setSearching(false)
              }
            } catch (e) {
              console.error('[Stream] Parse error:', e)
            }
          }
        }
      }
    } catch (error) {
      console.error('[Search] Failed:', error)
      alert('网络请求失败')
      setSearching(false)
    }
  }, [youtubeCount, bilibiliCount])

  const handleBatchSearch = useCallback(async () => {
    if (!selectedPlaylist || playlistTracks.length === 0) return
    
    setBatchSearchOpen(true)
    setBatchSearching(true)
    setBatchResults(new Map())
    setBatchProgress({ current: 0, total: playlistTracks.length })
    
    const results = new Map<string, SearchResult[]>()
    const taskIds: string[] = []
    
    // 第一轮：创建所有搜索任务
    for (let i = 0; i < playlistTracks.length; i++) {
      const track = playlistTracks[i]
      try {
        const res = await fetch('/api/music/ytdlp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'createSearchTask',
            trackTitle: track.track_title,
            trackArtist: track.track_artist,
            youtubeCount,
            bilibiliCount,
          })
        })
        const data = await res.json()
        if (data.taskId) {
          taskIds.push(data.taskId)
        }
      } catch (error) {
        console.error('[yt-dlp] Create task failed for:', track.track_title, error)
        results.set(track.track_title, [])
      }
    }

    // 第二轮：轮询所有任务状态
    const pollAllTasks = async () => {
      let completed = 0
      const maxRetries = 60
      
      while (completed < taskIds.length && maxRetries > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        for (let i = 0; i < taskIds.length; i++) {
          const taskId = taskIds[i]
          const track = playlistTracks[i]
          
          try {
            const statusRes = await fetch('/api/music/ytdlp', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'getTaskStatus',
                taskId: taskId,
              })
            })
            const statusData = await statusRes.json()
            
            if (statusData.status === 'completed') {
              results.set(track.track_title, statusData.results || [])
              completed++
              setBatchProgress({ current: completed, total: taskIds.length })
              setBatchResults(new Map(results))
            } else if (statusData.status === 'failed') {
              results.set(track.track_title, [])
              completed++
            }
          } catch (error) {
            console.error('[yt-dlp] Poll task failed:', taskId, error)
          }
        }
      }
      
      setBatchSearching(false)
    }

    pollAllTasks()
  }, [selectedPlaylist, playlistTracks, youtubeCount, bilibiliCount])

  const handleDownload = useCallback(async (result: SearchResult) => {
    console.log('[yt-dlp] Getting URL for:', result.title, '| ID:', result.id, '| Source:', result.source)
    
    try {
      setDownloading(true)
      
      const res = await fetch('/api/music/ytdlp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'getUrl',
          songId: result.id,
          source: result.source,
          directUrl: result.url,
        })
      })
      const data = await res.json()
      console.log('[yt-dlp] Response:', data)
      
      if (data.success && data.url) {
        const streamType = data.streamType || 'mp4'
        
        if (streamType === 'hls' || streamType === 'dash') {
          console.log('[yt-dlp] Setting HLS stream URL:', data.url)
          const newLinks = new Map(downloadLinks)
          newLinks.set(result.id, data.url)
          setDownloadLinks(newLinks)
          togglePlay(data.url)
        } else {
          console.log('[yt-dlp] Setting direct URL:', data.url.substring(0, 50))
          const newLinks = new Map(downloadLinks)
          newLinks.set(result.id, data.url)
          setDownloadLinks(newLinks)
          togglePlay(data.url)
        }
      } else {
        alert(`获取下载链接失败: ${data.error || '未知错误'}`)
      }
    } catch (error) {
      console.error('[yt-dlp] Error:', error)
      alert('网络请求失败，请稍后重试')
    } finally {
      setDownloading(false)
    }
  }, [downloadLinks, togglePlay])

  const handleRealDownload = useCallback(async (result: SearchResult) => {
    console.log('[Download] Starting download for:', result.title)
    
    try {
      setDownloading(true)
      
      const downloadRes = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: result.url || result.id,
          source: result.source || 'YouTube',
          filename: result.title.replace(/[<>:"/\\|?*]/g, '_').substring(0, 100)
        })
      })
      
      if (!downloadRes.ok) {
        const errorText = await downloadRes.text()
        console.error('[Download] API error:', errorText)
        alert('下载失败，请稍后重试')
        setDownloading(false)
        return
      }
      
      const blob = await downloadRes.blob()
      const blobUrl = URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = `${result.title.replace(/[<>:"/\\|?*]/g, '_').substring(0, 100)}.mp3`
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      // 清理 blob URL
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
      
      console.log('[Download] Download triggered for:', result.title)
      alert('下载已开始！如果未自动下载，请检查浏览器弹窗设置')
      
    } catch (error) {
      console.error('[Download] Error:', error)
      alert('下载失败，请稍后重试')
    } finally {
      setDownloading(false)
    }
  }, [])

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>加载中...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <audio 
        ref={audioRef} 
        onEnded={() => setIsPlaying(false)}
        onError={() => {
          setIsPlaying(false)
          setCurrentPlaying(null)
        }}
        className="hidden"
      />
      <Dialog open={videoDialogOpen} onOpenChange={(open) => {
        setVideoDialogOpen(open)
        if (!open) {
          if (videoRef) {
            videoRef.pause()
          }
          cleanupPlayer()
          setHlsUrl(null)
          setIsPlaying(false)
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>音频播放</span>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => {
                  setVideoDialogOpen(false)
                  cleanupPlayer()
                  setHlsUrl(null)
                  setIsPlaying(false)
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-center bg-black rounded-lg overflow-hidden">
            <video 
              ref={(el) => setVideoRef(el)}
              className="w-full max-h-[300px]"
              controls
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${platformColor}`} />
            <CardTitle className="text-base">{platformName}歌单</CardTitle>
            <span className="text-sm text-muted-foreground">({playlists.length})</span>
          </div>
          <div className="flex gap-2">
            {selectedPlaylist && playlistTracks.length > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleBatchSearch}
                disabled={batchSearching}
              >
                {batchSearching ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <Download className="w-4 h-4 mr-1" />
                )}
                批量搜索
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={loadPlaylists}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {playlists.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Music className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">暂无歌单</p>
              <p className="text-xs mt-1">请在上方输入UID导入歌单</p>
            </div>
          ) : (
            <div className="flex">
              <ScrollArea className={selectedPlaylist ? "w-1/2 h-80" : "w-full h-80"}>
                <div className="p-2 space-y-1">
                  {playlists.map((playlist) => (
                    <button
                      type="button"
                      key={playlist.id}
                      onClick={() => handlePlaylistClick(playlist)}
                      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors w-full text-left ${
                        selectedPlaylist?.id === playlist.id 
                          ? 'bg-accent' 
                          : 'hover:bg-accent/50'
                      }`}
                    >
                      {playlist.cover_url ? (
                        <img
                          src={playlist.cover_url + '?param=50y50'}
                          alt={playlist.name}
                          className="w-10 h-10 rounded object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                          <Music className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{playlist.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {playlist.track_count}首
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </ScrollArea>

              {selectedPlaylist && (
                <div className="w-1/2 h-80 border-l">
                  <div className="flex items-center justify-between p-2 border-b">
                    <p className="font-medium text-sm truncate flex-1 min-w-0">{selectedPlaylist.name}</p>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6"
                      onClick={() => {
                        setSelectedPlaylist(null)
                        setPlaylistTracks([])
                      }}
                    >
                      <ChevronRight className="w-4 h-4 rotate-90" />
                    </Button>
                  </div>
                  <ScrollArea className="h-[calc(100%-40px)]">
                    {loadingTracks ? (
                      <div className="flex items-center justify-center py-8">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      </div>
                    ) : playlistTracks.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        暂无歌曲
                      </div>
                    ) : (
                      <div className="p-2 space-y-1">
                        {playlistTracks.map((track, idx) => (
                          <div 
                            key={track.id || `track-${track.track_title}-${track.track_artist}`}
                            className="flex items-center gap-2 p-1.5 rounded hover:bg-accent/50 text-sm group"
                          >
                            <span className="w-5 text-center text-xs text-muted-foreground">
                              {idx + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="truncate">{track.track_title}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {track.track_artist}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleSearchTrack(track)
                              }}
                            >
                              <Search className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 单曲搜索 Dialog */}
      <Dialog open={searchDialogOpen} onOpenChange={setSearchDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>搜索歌曲</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="输入歌曲名和歌手..."
              className="w-full"
              onKeyDown={(e) => e.key === 'Enter' && executeSearch(searchQuery, youtubeCount, bilibiliCount)}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-500 font-medium">YouTube</span>
                <Input
                  type="number"
                  min={0}
                  max={10}
                  value={youtubeCount}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === '') {
                      setYoutubeCount(0)
                    } else {
                      const num = parseInt(val)
                      if (!isNaN(num)) {
                        setYoutubeCount(Math.min(Math.max(num, 0), 10))
                      }
                    }
                  }}
                  className="w-full"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm text-pink-500 font-medium">Bilibili</span>
                <Input
                  type="number"
                  min={0}
                  max={10}
                  value={bilibiliCount}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === '') {
                      setBilibiliCount(0)
                    } else {
                      const num = parseInt(val)
                      if (!isNaN(num)) {
                        setBilibiliCount(Math.min(Math.max(num, 0), 10))
                      }
                    }
                  }}
                  className="w-full"
                />
              </div>
            </div>
            
            <div className="flex justify-center">
              <Button onClick={() => executeSearch(searchQuery, youtubeCount, bilibiliCount)} disabled={searching}>
                {searching ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                开始搜索
              </Button>
            </div>
          </div>
          
          {currentSearchTrack && (
            <p className="text-sm text-muted-foreground">
              正在搜索: {currentSearchTrack.track_title} - {currentSearchTrack.track_artist}
            </p>
          )}

          {searching && (
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>正在搜索，请稍候...</span>
            </div>
          )}

          <ScrollArea className="h-[300px] mt-4">
            {searchResults.length === 0 && !searching ? (
              <div className="text-center py-8 text-muted-foreground px-4">
                {searchQuery ? '未找到相关结果，请检查网络或稍后重试' : '输入关键词搜索'}
              </div>
            ) : searchResults.length > 0 ? (
              <>
                <p className="text-sm text-green-600 mb-2 flex items-center justify-between">
                  <span>找到 {searchResults.length} 个结果</span>
                  {!searching && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => executeSearch(searchQuery, youtubeCount, bilibiliCount)}
                      className="text-blue-600 border-blue-600 hover:bg-blue-50"
                    >
                      <RefreshCw className="w-4 h-4 mr-1" />
                      重新搜索
                    </Button>
                  )}
                </p>
                <div className="space-y-2">
                  {searchResults.map((result) => (
                    <div 
                      key={result.id || result.url}
                      className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent/50"
                    >
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <p className="font-medium text-sm leading-tight break-words line-clamp-2" title={result.title}>{result.title}</p>
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {result.uploader} • {Math.floor((result.duration || 0) / 60)}:{String(Math.floor((result.duration || 0) % 60)).padStart(2, '0')} • {result.source || 'YouTube'}
                        </p>
                      </div>
                      <div className="flex-shrink-0 flex gap-1">
                        {downloadLinks.get(result.id) ? (
                          <>
                            <Button 
                              size="sm" 
                              variant={currentPlaying === downloadLinks.get(result.id) && isPlaying ? "default" : "outline"}
                              onClick={() => togglePlay(downloadLinks.get(result.id)!)}
                              className="px-2"
                            >
                              <Play className="w-4 h-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="secondary" 
                              onClick={() => handleRealDownload(result)}
                              className="px-2 whitespace-nowrap"
                            >
                              <Download className="w-4 h-4 mr-1" />
                              下载
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button 
                              size="sm" 
                              onClick={() => handleDownload(result)} 
                              disabled={downloading}
                              className="px-2"
                            >
                              <Play className="w-4 h-4 mr-1" />
                              播放
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleRealDownload(result)}
                              className="px-2 whitespace-nowrap"
                            >
                              <Download className="w-4 h-4 mr-1" />
                              下载
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                搜索中...
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* 批量搜索 Dialog */}
      <Dialog open={batchSearchOpen} onOpenChange={setBatchSearchOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>批量搜索配置</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground mb-2">
              配置每个源搜索的歌曲数量
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-500 font-medium">YouTube</span>
                <Input
                  type="number"
                  min={0}
                  max={10}
                  value={youtubeCount}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === '') {
                      setYoutubeCount(0)
                    } else {
                      const num = parseInt(val)
                      if (!isNaN(num)) {
                        setYoutubeCount(Math.min(Math.max(num, 0), 10))
                      }
                    }
                  }}
                  className="w-full"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm text-pink-500 font-medium">Bilibili</span>
                <Input
                  type="number"
                  min={0}
                  max={10}
                  value={bilibiliCount}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === '') {
                      setBilibiliCount(0)
                    } else {
                      const num = parseInt(val)
                      if (!isNaN(num)) {
                        setBilibiliCount(Math.min(Math.max(num, 0), 10))
                      }
                    }
                  }}
                  className="w-full"
                />
              </div>
            </div>
            
            <div className="flex justify-center">
              <Button onClick={handleBatchSearch} disabled={batchSearching}>
                {batchSearching ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                开始批量搜索
              </Button>
            </div>
          </div>
          
          {batchSearching ? (
            <div className="flex-1 flex flex-col items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin mb-4" />
              <p className="text-muted-foreground">
                搜索中... ({batchProgress.current}/{batchProgress.total})
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                批量搜索可能需要一些时间，请耐心等待
              </p>
            </div>
          ) : (
            <>
              <div className="text-sm text-muted-foreground mb-2 px-1">
                共 {playlistTracks.length} 首歌曲，已搜索 {batchResults.size} 首
              </div>
              <ScrollArea className="h-[300px]">
                <div className="space-y-3 px-1">
                  {playlistTracks.map((track) => {
                    const results = batchResults.get(track.track_title) || []
                    return (
                      <div key={track.id || track.track_title} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{track.track_title}</p>
                            <p className="text-xs text-muted-foreground">{track.track_artist}</p>
                          </div>
                          <span className="text-xs text-muted-foreground ml-2">
                            {results.length}个结果
                          </span>
                        </div>
                        {results.length > 0 && (
                          <div className="space-y-1 mt-2 pl-2 border-l-2">
                            {results.slice(0, 3).map((result) => {
                              const url = downloadLinks.get(result.id)
                              return (
                                <div 
                                  key={result.url || result.title}
                                  className="flex items-center justify-between text-xs gap-2"
                                >
                                  <span className="truncate flex-1 min-w-0">{result.title}</span>
                                  <div className="flex-shrink-0 flex gap-1">
                                    {url ? (
                                      <>
                                        <Button 
                                          size="sm" 
                                          variant="ghost"
                                          className="h-6 px-1"
                                          onClick={() => togglePlay(url)}
                                        >
                                          <Play className="w-3 h-3" />
                                        </Button>
                                        <Button 
                                          size="sm" 
                                          variant="ghost"
                                          className="h-6 px-1"
                                          onClick={() => handleRealDownload(result)}
                                        >
                                          <Download className="w-3 h-3" />
                                        </Button>
                                      </>
                                    ) : (
                                      <>
                                        <Button 
                                          size="sm" 
                                          variant="ghost"
                                          className="h-6 px-1"
                                          onClick={() => handleDownload(result)}
                                        >
                                          <Play className="w-3 h-3" />
                                        </Button>
                                        <Button 
                                          size="sm" 
                                          variant="ghost"
                                          className="h-6 px-1"
                                          onClick={() => handleRealDownload(result)}
                                        >
                                          <Download className="w-3 h-3" />
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                            {results.length > 3 && (
                              <p className="text-xs text-muted-foreground">
                                还有 {results.length - 3} 个结果...
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
