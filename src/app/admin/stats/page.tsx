'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Heart, TrendingUp, Music, Trophy } from 'lucide-react';

interface StatsData {
  totalPlays: number;
  playedTrackCount: number;
  platformCount: number;
  topTracks: { title: string; artist: string; playCount: number }[];
}

const rankColors = ['#fbbf24', '#9ca3af', '#cd7f32'];

export default function StatsAdminPage() {
  const [filter, setFilter] = useState<'week' | 'all'>('week');
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    setLoading(true);
    try {
      // 播放歌曲数 = 已播放的曲目数（走 FastAPI 缓存）
      const statsRes = await fetch(`/api/stats/tracks?filter=${filter}`);
      const statsResult = await statsRes.json();

      const tracks = statsResult.data || [];
      const totalPlays = tracks.reduce((sum: number, t: any) => sum + (t.playCount || 0), 0);
      const playedTrackCount = tracks.length;

      const platformMap = new Map<string, number>();
      tracks.forEach((t: any) => {
        const p = t.platform || 'unknown';
        platformMap.set(p, (platformMap.get(p) || 0) + 1);
      });

      setData({
        totalPlays,
        playedTrackCount,
        platformCount: platformMap.size,
        topTracks: tracks.slice(0, 20)
      });
    } catch (error) {
      console.error('加载统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [filter]);

  const statCards = [
    { label: '总播放次数', value: data?.totalPlays ?? 0, icon: BarChart3 },
    { label: '播放歌曲数', value: data?.playedTrackCount ?? 0, icon: Heart },
    { label: '外部平台数', value: data?.platformCount ?? 0, icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>数据统计</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>查看平台播放和收藏数据统计</p>
        <div className="mt-4" style={{ height: '1px', background: 'rgba(255,255,255,0.08)' }} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {statCards.map((card, index) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
            className="rounded-xl p-5 backdrop-blur-sm cursor-default transition-colors duration-200"
            style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
              >
                <card.icon className="w-6 h-6" style={{ color: 'var(--foreground)' }} />
              </div>
              <div>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{card.label}</p>
                <p className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>{card.value.toLocaleString()}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setFilter('week')}
          className="rounded-full px-4 py-2 text-sm transition-colors duration-200"
          style={
            filter === 'week'
              ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }
              : { backgroundColor: 'transparent', color: 'var(--foreground)' }
          }
        >
          最近一周
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setFilter('all')}
          className="rounded-full px-4 py-2 text-sm transition-colors duration-200"
          style={
            filter === 'all'
              ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }
              : { backgroundColor: 'transparent', color: 'var(--foreground)' }
          }
        >
          所有时间
        </motion.button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl overflow-hidden"
        >
          <div className="flex items-center gap-2 px-4 pt-4 pb-2">
            <Trophy className="w-5 h-5" style={{ color: 'var(--muted-foreground)' }} />
            <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>播放排行</h2>
          </div>

          <div
            className="sticky top-0 z-10 grid grid-cols-[40px_1fr_120px_100px] gap-4 px-4 py-3 text-xs font-medium uppercase tracking-wider"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <div className="text-center">#</div>
            <div>标题</div>
            <div>歌手</div>
            <div className="text-right">播放次数</div>
          </div>

          <div className="pb-4">
            {(data?.topTracks || []).map((track, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.02 }}
                className="group grid grid-cols-[40px_1fr_120px_100px] gap-4 px-4 py-3 items-center cursor-default transition-all duration-300 ease-out hover:bg-white/[0.06] dark:hover:bg-white/[0.04]"
              >
                <div className="flex items-center justify-center">
                  {index < 3 ? (
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: rankColors[index] }}
                    >
                      {index + 1}
                    </span>
                  ) : (
                    <span className="text-sm tabular-nums" style={{ color: 'var(--muted-foreground)' }}>
                      {index + 1}
                    </span>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Music className="w-4 h-4 shrink-0" style={{ color: 'var(--muted-foreground)' }} />
                    <span className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{track.title}</span>
                  </div>
                </div>

                <div className="min-w-0">
                  <span className="text-sm truncate" style={{ color: 'var(--muted-foreground)' }}>{track.artist}</span>
                </div>

                <div className="text-right">
                  <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--foreground)' }}>
                    {track.playCount.toLocaleString()}
                  </span>
                </div>
              </motion.div>
            ))}
            {(!data?.topTracks || data.topTracks.length === 0) && (
              <div className="flex flex-col items-center justify-center py-16 px-4">
                <div
                  className="p-4 rounded-2xl mb-3"
                  style={{ backgroundColor: 'rgba(var(--primary-rgb), 0.08)' }}
                >
                  <Music className="w-10 h-10" style={{ color: 'var(--muted-foreground)' }} />
                </div>
                <p className="text-base font-medium" style={{ color: 'var(--foreground)' }}>暂无播放数据</p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
