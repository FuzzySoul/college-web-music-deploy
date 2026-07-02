'use client'

import { useState, useCallback } from 'react'
import { PlatformLogin } from '@/components/music/PlatformLogin'
import { PlaylistAggregator } from '@/components/music/PlaylistAggregator'

export function MusicAggregationSection() {
  const neteaseApiUrl = process.env.NEXT_PUBLIC_NETEASE_API_URL || ''
  const [refreshKey, setRefreshKey] = useState(0)

  const handleLoginComplete = useCallback(() => {
    setRefreshKey(k => k + 1)
  }, [])

  if (!neteaseApiUrl) {
    return (
      <div className="p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-900">
        <p className="text-yellow-800 dark:text-yellow-200">
          ⚠️ 请配置环境变量 NEXT_PUBLIC_NETEASE_API_URL
        </p>
        <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-2">
          参考文件: .env.music-api.example
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PlatformLogin platform="netease" onLoginComplete={handleLoginComplete} />
      <PlaylistAggregator 
        key={refreshKey}
        platform="netease" 
        apiUrl={neteaseApiUrl} 
      />
    </div>
  )
}
