'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Play, RefreshCw, Music, Clock, Headphones } from 'lucide-react';
import { NeteaseSongList } from './NeteaseSongList';

// 榜单类型
interface ChartPlaylist {
  id: number;
  name: string;
  coverImgUrl: string;
  description?: string;
  trackCount?: number;
  playCount?: number;
  updateTime?: number;
}

// 歌曲类型
interface NeteaseTrack {
  id: number;
  name: string;
  ar: { id: number; name: string }[];
  al: { id: number; name: string; picUrl: string };
  dt: number;
}

interface ChartDetailProps {
  chart: ChartPlaylist;
  onBack: () => void;
  onPlay: (song: NeteaseTrack) => void;
}

export function ChartDetail({ chart, onBack, onPlay }: ChartDetailProps) {
  const [tracks, setTracks] = useState<NeteaseTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<number | null>(null);

  // 加载榜单详情
  useEffect(() => {
    const fetchChartDetail = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/netease/chart/${chart.id}`);
        const data = await res.json();
        if (data.playlist?.tracks) {
          setTracks(data.playlist.tracks);
        }
      } catch (error) {
        console.error('获取榜单详情失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchChartDetail();
  }, [chart.id]);

  // 播放全部
  const handlePlayAll = async () => {
    if (tracks.length > 0) {
      await onPlay(tracks[0]);
    }
  };

  // 格式化播放量
  const formatPlayCount = (count: number) => {
    if (count >= 100000000) {
      return (count / 100000000).toFixed(1) + '亿';
    } else if (count >= 10000) {
      return (count / 10000).toFixed(1) + '万';
    }
    return count.toString();
  };

  // 格式化日期
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('zh-CN');
  };

  return (
    <div className="fade-in">
      {/* 返回按钮和标题 */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-accent transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-normal artistic-title">{chart.name}</h1>
      </div>

      {/* 榜单信息卡片 */}
      <div className="flex gap-6 mb-6 p-4 rounded-xl" style={{ backgroundColor: 'var(--card)' }}>
        <div className="w-40 h-40 flex-shrink-0 rounded-lg overflow-hidden">
          <img 
            src={chart.coverImgUrl || 'https://picsum.photos/seed/chart/400/400'} 
            alt={chart.name}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            <span className="flex items-center gap-1">
              <Headphones className="w-4 h-4" />
              {formatPlayCount(chart.playCount || Math.random() * 10000000)}
            </span>
            <span className="flex items-center gap-1">
              <Music className="w-4 h-4" />
              {chart.trackCount || tracks.length} 首
            </span>
            {chart.updateTime && (
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {formatDate(chart.updateTime)}
              </span>
            )}
          </div>
          {chart.description && (
            <p className="text-sm line-clamp-2" style={{ color: 'var(--muted-foreground)' }}>
              {chart.description}
            </p>
          )}
          <button
            onClick={handlePlayAll}
            className="btn-primary flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            播放全部
          </button>
        </div>
      </div>

      {/* 歌曲列表 */}
      <NeteaseSongList 
        songs={tracks} 
        title={chart.name}
        onPlay={onPlay}
        loading={loading}
      />
    </div>
  );
}
