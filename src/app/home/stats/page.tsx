'use client';

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { Heart, PlayCircle } from 'lucide-react';

interface ExternalTrack {
  id: string;
  title: string;
  artist: string;
  cover: string | null;
  playCount: number;
  playlistName: string;
  platform: string;
}

interface ExternalPlatform {
  id: string;
  name: string;
  icon: string;
  playlistCount: number;
  totalPlays: number;
}

interface StatsSummary {
  totalPlays: number;
  totalTracks: number;
  totalPlatforms: number;
  totalPlaylists: number;
}

function generatePlaceholderCover(title: string, size: number = 40): string {
  const colors = ['667eea', 'f093fb', '4facfe', '43e97b', 'fa709a', 'fee140', 'a18cd1', 'ffecd2'];
  const hash = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const color = colors[hash % colors.length];
  return `https://via.placeholder.com/${size}x${size}/${color}/ffffff?text=${encodeURIComponent(title.charAt(0))}`;
}

function getPlatformInfo(platform: string): { name: string; icon: string } {
  const platformMap: Record<string, { name: string; icon: string }> = {
    netease: { name: '网易云音乐', icon: '🎵' },
    qq: { name: 'QQ音乐', icon: '🎶' },
    spotify: { name: 'Spotify', icon: '💚' },
    apple: { name: 'Apple Music', icon: '🍎' },
    bilibili: { name: 'Bilibili', icon: '📺' },
    youtube: { name: 'YouTube', icon: '▶️' },
  };
  return platformMap[platform.toLowerCase()] || { name: platform, icon: '🎵' };
}

function formatPlayCount(count: number): string {
  if (count >= 10000) {
    return (count / 10000).toFixed(1) + '万';
  }
  return count.toString();
}

const TrackItem = memo(function TrackItem({
  track,
  index,
  isVisible,
  favorites,
  onToggleFavorite
}: {
  track: ExternalTrack;
  index: number;
  isVisible: boolean;
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
}) {
  return (
    <li
      className={`flex items-center justify-between py-1.5 px-1 hover:bg-white/5 rounded transition-all duration-200 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ transitionDelay: `${index * 20}ms` }}
    >
      <div className="flex items-center gap-3">
        <span className="w-6 text-center text-[#B3B3B3] text-sm">
          {(index + 1).toString().padStart(2, '0')}
        </span>

        <img
          src={track.cover || generatePlaceholderCover(track.title)}
          alt={track.title}
          className="w-10 h-10 rounded object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = generatePlaceholderCover(track.title);
          }}
        />

        <div className="flex flex-col">
          <span className="text-sm text-[#FFFFFF]">{track.title}</span>
          <span className="text-xs text-[#B3B3B3] flex items-center gap-1">
            {track.platform && (
              <span className="inline-block bg-[#1E90FF] text-white px-1 rounded text-[10px]">
                {getPlatformInfo(track.platform).name}
              </span>
            )}
            {track.artist}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => onToggleFavorite(track.id)}
          className="transition-colors duration-200"
        >
          <Heart
            className={`cursor-pointer text-lg ${
              favorites.has(track.id)
                ? 'fill-[#E63950] text-[#E63950]'
                : 'text-[#B3B3B3] hover:text-[#E63950]'
            }`}
            size={18}
          />
        </button>

        <span className="text-xs text-[#727272] flex items-center gap-1">
          <PlayCircle size={14} />
          {formatPlayCount(track.playCount)}
        </span>
      </div>
    </li>
  );
});

export default function StatsPage() {
  const [activeTab, setActiveTab] = useState<'week' | 'all'>('all');
  const [tracks, setTracks] = useState<ExternalTrack[]>([]);
  const [platforms, setPlatforms] = useState<ExternalPlatform[]>([]);
  const [summary, setSummary] = useState<StatsSummary>({
    totalPlays: 0,
    totalTracks: 0,
    totalPlatforms: 0,
    totalPlaylists: 0,
  });
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (filter: 'week' | 'all') => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/stats/tracks?filter=${filter}`);
      const result = await response.json();

      if (result.success) {
        setTracks(result.data || []);

        const uniquePlatforms = new Map<string, ExternalPlatform>();
        result.data?.forEach((track: any) => {
          if (!uniquePlatforms.has(track.platform)) {
            const info = getPlatformInfo(track.platform);
            uniquePlatforms.set(track.platform, {
              id: track.platform,
              name: info.name,
              icon: info.icon,
              playlistCount: 1,
              totalPlays: track.playCount || 0,
            });
          } else {
            const existing = uniquePlatforms.get(track.platform)!;
            existing.totalPlays += track.playCount || 0;
          }
        });

        setPlatforms(Array.from(uniquePlatforms.values()));

        const totalPlays = result.data?.reduce((sum: number, track: any) => sum + (track.playCount || 0), 0) || 0;
        setSummary({
          totalPlays,
          totalTracks: result.data?.length || 0,
          totalPlatforms: uniquePlatforms.size,
          totalPlaylists: new Set(result.data?.map((t: any) => t.playlistName)).size,
        });
      } else {
        setError(result.error || '获取数据失败');
      }
    } catch (err) {
      setError('网络错误，请稍后重试');
      console.error('获取统计数据失败:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(activeTab);
  }, [activeTab, fetchData]);

  const handleTabChange = useCallback(async (tab: 'week' | 'all') => {
    if (tab === activeTab || isTransitioning) return;

    setIsTransitioning(true);
    await new Promise(resolve => setTimeout(resolve, 200));
    setActiveTab(tab);
    await new Promise(resolve => setTimeout(resolve, 50));
    setIsTransitioning(false);
  }, [activeTab, isTransitioning]);

  const toggleFavorite = useCallback((trackId: string) => {
    setFavorites(prev => {
      const newSet = new Set(prev);
      if (newSet.has(trackId)) {
        newSet.delete(trackId);
      } else {
        newSet.add(trackId);
      }
      return newSet;
    });
  }, []);

  const displayTracks = useMemo(() => tracks, [tracks]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#121212] to-[#0A0A0A] text-[#FFFFFF] font-sans">
      <div className="px-6 pt-4 pb-2 flex items-center gap-6 border-b border-white/10">
        <button
          onClick={() => handleTabChange('week')}
          disabled={isTransitioning}
          className={`text-sm transition-all duration-200 ${
            activeTab === 'week'
              ? 'font-medium text-[#FFFFFF] border-b-2 border-[#FFFFFF]'
              : 'text-[#B3B3B3] hover:text-[#FFFFFF]'
          } ${isTransitioning ? 'cursor-not-allowed opacity-50' : ''}`}
        >
          最近一周
        </button>
        <button
          onClick={() => handleTabChange('all')}
          disabled={isTransitioning}
          className={`text-sm transition-all duration-200 ${
            activeTab === 'all'
              ? 'font-medium text-[#FFFFFF] border-b-2 border-[#FFFFFF]'
              : 'text-[#B3B3B3] hover:text-[#FFFFFF]'
          } ${isTransitioning ? 'cursor-not-allowed opacity-50' : ''}`}
        >
          所有时间
        </button>
      </div>

      <div className="px-6 pt-6 pb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white/5 rounded-lg p-4 border border-white/10 backdrop-blur-sm">
            <div className="text-xs text-[#B3B3B3] mb-1">总播放次数</div>
            <div className="text-2xl font-semibold text-[#FFFFFF]">{formatPlayCount(summary.totalPlays)}</div>
            <div className="text-xs text-[#727272] mt-1">较上周 +12.5%</div>
          </div>

          <div className="bg-white/5 rounded-lg p-4 border border-white/10 backdrop-blur-sm">
            <div className="text-xs text-[#B3B3B3] mb-1">播放歌曲</div>
            <div className="text-2xl font-semibold text-[#FFFFFF]">{summary.totalTracks}</div>
            <div className="text-xs text-[#727272] mt-1">已收录 {summary.totalTracks} 首曲目</div>
          </div>

          <div className="bg-white/5 rounded-lg p-4 border border-white/10 backdrop-blur-sm">
            <div className="text-xs text-[#B3B3B3] mb-1">外部平台</div>
            <div className="text-2xl font-semibold text-[#FFFFFF]">{summary.totalPlatforms}</div>
            <div className="text-xs text-[#727272] mt-1">{summary.totalPlaylists} 个歌单</div>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-sm font-medium text-[#B3B3B3] mb-3">平台分布</h3>
          <div className="flex flex-wrap gap-2">
            {platforms.map(platform => (
              <div
                key={platform.id}
                className="bg-white/5 rounded px-3 py-2 border border-white/10 flex items-center gap-2"
              >
                <span>{platform.icon}</span>
                <span className="text-xs text-[#FFFFFF]">{platform.name}</span>
                <span className="text-xs text-[#727272]">({platform.playlistCount})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="h-[calc(100vh-28rem)] overflow-y-auto scrollbar-hide px-6 pb-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFFFFF]"></div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 text-[#B3B3B3]">
            <p className="mb-4">{error}</p>
            <button
              onClick={() => fetchData(activeTab)}
              className="px-4 py-2 bg-white/10 rounded hover:bg-white/20 transition-colors"
            >
              重试
            </button>
          </div>
        ) : displayTracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-[#B3B3B3]">
            <p>暂无统计数据</p>
          </div>
        ) : (
          <ul className="space-y-1">
            {displayTracks.map((track, index) => (
              <TrackItem
                key={track.id}
                track={track}
                index={index}
                isVisible={!isTransitioning}
                favorites={favorites}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </ul>
        )}
      </div>

      <style jsx global>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
