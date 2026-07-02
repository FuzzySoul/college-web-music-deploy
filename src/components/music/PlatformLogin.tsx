'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, User } from 'lucide-react'

interface Playlist {
  id: number
  name: string
  coverImgUrl: string
  trackCount: number
  creator: { nickname: string }
}

interface PlatformLoginProps {
  platform: 'netease' | 'qq'
  onLoginComplete?: () => void
}

export function PlatformLogin({ platform, onLoginComplete }: PlatformLoginProps) {
  const [uidInput, setUidInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [selectedPlaylists, setSelectedPlaylists] = useState<Set<number>>(new Set())
  const [error, setError] = useState('')
  const [isSaved, setIsSaved] = useState(false)

  const extractUid = (input: string): string | null => {
    const urlMatch = input.match(/id=(\d+)/)
    if (urlMatch) return urlMatch[1]
    const numMatch = input.match(/^\d+$/)
    if (numMatch) return numMatch[0]
    return null
  }

  const fetchPlaylists = async () => {
    const uid = extractUid(uidInput)
    if (!uid) {
      setError('请输入正确的UID或主页链接')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/netease/user/playlist?uid=${uid}&limit=100`)
      const data = await response.json()

      if (data.code !== 200) {
        throw new Error(data.message || '获取歌单失败')
      }

      const userPlaylists = data.playlist || []
      setPlaylists(userPlaylists)
      setSelectedPlaylists(new Set(userPlaylists.map((p: Playlist) => p.id)))
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取歌单失败')
      setPlaylists([])
    } finally {
      setIsLoading(false)
    }
  }

  const togglePlaylist = (id: number) => {
    const newSelected = new Set(selectedPlaylists)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedPlaylists(newSelected)
  }

  const selectAll = () => {
    setSelectedPlaylists(new Set(playlists.map(p => p.id)))
  }

  const deselectAll = () => {
    setSelectedPlaylists(new Set())
  }

  const saveSelectedPlaylists = async () => {
    if (selectedPlaylists.size === 0) {
      setError('请至少选择一个歌单')
      return
    }

    const selectedItems = playlists.filter(p => selectedPlaylists.has(p.id))
    const uid = extractUid(uidInput)
    if (!uid) return

    // ===== 乐观更新：立即将选中的歌单加入全局列表 =====
    const now = new Date().toISOString()
    const optimisticPlaylists = selectedItems.map(p => ({
      id: `temp-netease-${p.id}-${Date.now()}`,
      name: p.name,
      description: '',
      cover: p.coverImgUrl,
      trackIds: [] as number[],
      createdAt: now,
      platformSource: 'netease' as const,
      source: 'external' as const,
      externalPlaylistId: `temp-${p.id}`,
      platformPlaylistId: String(p.id),
      trackCount: p.trackCount,
      _optimistic: true,
      _originalId: p.id,
    }))

    // 触发全局事件，携带乐观歌单数据
    window.dispatchEvent(new CustomEvent('playlists:netease-import-start', {
      detail: { playlists: optimisticPlaylists }
    }))

    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/netease/save-playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          uid,
          playlistIds: Array.from(selectedPlaylists)
        })
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || '保存失败')
      }

      // 通知歌单列表页用真实ID替换临时ID
      window.dispatchEvent(new CustomEvent('playlists:netease-import-complete', {
        detail: {
          tempIds: optimisticPlaylists.map(p => p.id),
          realPlaylists: result.playlists || [],
        }
      }))

      setIsSaved(true)
      onLoginComplete?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
      // 通知歌单列表页移除乐观歌单
      window.dispatchEvent(new CustomEvent('playlists:netease-import-failed', {
        detail: { tempIds: optimisticPlaylists.map(p => p.id) }
      }))
    } finally {
      setIsLoading(false)
    }
  }

  const platformName = platform === 'netease' ? '网易云音乐' : 'QQ音乐'
  const platformColor = platform === 'netease' ? 'bg-red-500' : 'bg-green-500'

  if (isSaved) {
    return (
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${platformColor}`} />
            {platformName}
          </CardTitle>
          <span className="text-sm text-green-500">已导入</span>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-green-500 font-medium mb-4">成功导入 {selectedPlaylists.size} 个歌单</p>
            <Button variant="outline" onClick={() => {
              setIsSaved(false)
              setPlaylists([])
              setSelectedPlaylists(new Set())
              setUidInput('')
            }}>
              重新导入
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${platformColor}`} />
          {platformName}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {platform === 'netease' ? (
          <div className="space-y-4">
            <div className="bg-muted border border-border rounded-lg p-3 text-sm">
              <p className="font-medium mb-1" style={{ color: 'var(--foreground)' }}>获取UID方法：</p>
              <ol className="list-decimal list-inside space-y-1" style={{ color: 'var(--muted-foreground)' }}>
                <li>打开 <a href="https://music.163.com" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--primary)' }}>网易云音乐</a> 网页版</li>
                <li>点击右上角头像 → &quot;我的主页&quot;</li>
                <li>复制浏览器地址栏中的数字（如：<code className="bg-accent px-1" style={{ color: 'var(--foreground)' }}>id=123456789</code> 中的数字）</li>
              </ol>
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="输入UID或粘贴主页链接"
                value={uidInput}
                onChange={(e) => setUidInput(e.target.value)}
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                onClick={fetchPlaylists}
                disabled={isLoading || !uidInput}
              >
                {isLoading && !playlists.length ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <User className="w-4 h-4 mr-1" />
                    获取歌单
                  </>
                )}
              </Button>
            </div>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            {playlists.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    共 {playlists.length} 个歌单，已选择 {selectedPlaylists.size} 个
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={selectAll}>
                      全选
                    </Button>
                    <Button variant="outline" size="sm" onClick={deselectAll}>
                      取消
                    </Button>
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto border rounded-lg">
                  {playlists.map((playlist) => (
                    <div
                      key={playlist.id}
                      className="flex items-center gap-3 p-2 hover:bg-muted/50 border-b last:border-b-0"
                    >
                      <Checkbox
                        checked={selectedPlaylists.has(playlist.id)}
                        onCheckedChange={() => togglePlaylist(playlist.id)}
                      />
                      <img
                        src={playlist.coverImgUrl + '?param=50y50'}
                        alt={playlist.name}
                        className="w-10 h-10 rounded object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{playlist.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {playlist.trackCount} 首 · by {playlist.creator.nickname}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  className="w-full"
                  onClick={saveSelectedPlaylists}
                  disabled={isLoading || selectedPlaylists.size === 0}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      导入中...
                    </>
                  ) : (
                    `导入 ${selectedPlaylists.size} 个歌单`
                  )}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>QQ音乐功能开发中</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
