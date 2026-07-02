'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Music,
  Disc3,
  ListMusic,
  MessageSquare,
  ArrowRight,
  Loader2,
  BarChart3
} from 'lucide-react';
import Link from 'next/link';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, CartesianGrid, ResponsiveContainer } from 'recharts';

interface StatsData {
  users: number;
  artists: number;
  tracks: number;
  playlists: number;
  localPlaylists: number;
  externalPlaylists: number;
  recentComments: {
    id: number;
    content: string;
    username: string;
    target_type: string;
    target_id: number;
    created_at: string;
    is_deleted: boolean;
  }[];
}

export default function AdminDashboard() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState<'artist' | 'daily'>('artist');
  const [chartMode, setChartMode] = useState<'pie' | 'bar'>('pie');
  const [dailyRange, setDailyRange] = useState<'week' | 'month'>('week');
  const [artistData, setArtistData] = useState<{artist: string, play_count: number}[]>([]);
  const [dailyData, setDailyData] = useState<{date: string, count: number}[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [noData, setNoData] = useState(false);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(res => res.json())
      .then((result: StatsData) => setData(result))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const loadChartData = async () => {
    setChartLoading(true);
    try {
      if (chartType === 'artist') {
        const res = await fetch('/api/admin/play-stats?type=artist');
        const result = await res.json();
        if (result.success && result.data?.length > 0) {
          setArtistData(result.data);
          setNoData(false);
        } else {
          setArtistData([]);
          setNoData(true);
        }
      } else {
        const res = await fetch(`/api/admin/play-stats?type=daily&range=${dailyRange}`);
        const result = await res.json();
        if (result.success && result.data?.length > 0) {
          setDailyData(result.data);
          setNoData(false);
        } else {
          setDailyData([]);
          setNoData(true);
        }
      }
    } catch (error) {
      console.error('加载图表数据失败:', error);
      setNoData(true);
    } finally {
      setChartLoading(false);
    }
  };

  const handleSeedData = async () => {
    try {
      const res = await fetch('/api/admin/play-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed' }),
      });
      const result = await res.json();
      if (result.success) {
        loadChartData();
      }
    } catch (error) {
      console.error('生成测试数据失败:', error);
    }
  };

  useEffect(() => {
    loadChartData();
  }, [chartType, dailyRange]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const truncateContent = (content: string, max: number = 60) => {
    if (content.length <= max) return content;
    return content.substring(0, max) + '...';
  };

  const statCards = data ? [
    { label: '用户数', value: data.users, icon: Users, href: '/admin/users' },
    { label: '歌手数', value: data.artists, icon: Music, href: '/admin/artists' },
    { label: '歌曲数', value: data.tracks, icon: Disc3, href: '/admin/tracks' },
    { label: '歌单数', value: data.playlists, icon: ListMusic, href: '/admin/playlists' },
  ] : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--primary)' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6" style={{ backgroundColor: 'transparent' }}>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>仪表盘</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>系统概览与数据总览</p>
        <div className="mt-4" style={{ height: '1px', background: 'rgba(255,255,255,0.08)' }} />
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <AnimatePresence>
          {statCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.3, delay: index * 0.08, ease: [0.4, 0, 0.2, 1] }}>
                <Link href={stat.href}>
                  <motion.div
                    className="rounded-xl p-4 cursor-pointer backdrop-blur-sm"
                    style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                    whileHover={{ scale: 1.03, backgroundColor: 'rgba(255,255,255,0.08)' }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                        <Icon className="w-5 h-5" style={{ color: 'var(--foreground)' }} />
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{stat.value.toLocaleString()}</div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{stat.label}</div>
                      </div>
                    </div>
                  </motion.div>
                </Link>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" style={{ color: 'var(--primary)' }} />
            <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>最近评论</h2>
          </div>
          <Link href="/admin/comments" className="flex items-center gap-1 text-sm transition-colors hover:opacity-80" style={{ color: 'var(--primary)' }}>
            查看全部 <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {(!data?.recentComments || data.recentComments.length === 0) ? (
          <div className="text-center py-12" style={{ color: 'var(--muted-foreground)' }}>暂无评论</div>
        ) : (
          <div className="overflow-hidden">
            <div
              className="grid grid-cols-[40px_1fr_80px_100px_80px] gap-4 px-4 py-3 text-xs font-medium uppercase tracking-wider"
              style={{ color: 'var(--muted-foreground)' }}
            >
              <div className="text-center">#</div>
              <div>内容</div>
              <div>用户</div>
              <div>类型</div>
              <div className="text-right">时间</div>
            </div>
            <div className="pb-4">
              <AnimatePresence>
                {data.recentComments.map((comment, index) => (
                  <motion.div
                    key={comment.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2, delay: index * 0.03 }}
                    className="group grid grid-cols-[40px_1fr_80px_100px_80px] gap-4 px-4 py-3 items-center hover:bg-white/[0.06] dark:hover:bg-white/[0.04] transition-colors duration-200"
                  >
                    <div className="flex items-center justify-center">
                      <span className="text-sm tabular-nums" style={{ color: 'var(--muted-foreground)' }}>{index + 1}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm truncate" style={{ color: 'var(--foreground)' }}>{truncateContent(comment.content)}</p>
                    </div>
                    <div className="min-w-0">
                      <span className="text-sm truncate" style={{ color: 'var(--muted-foreground)' }}>{comment.username}</span>
                    </div>
                    <div>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0" style={{ backgroundColor: comment.target_type === 'track' ? 'rgba(193,95,60,0.12)' : 'rgba(163,191,250,0.12)', color: comment.target_type === 'track' ? 'var(--primary)' : '#a3bffa' }}>
                        {comment.target_type === 'track' ? '歌曲' : '歌单'}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <span className="text-xs" style={{ color: 'var(--muted-foreground)', opacity: 0.6 }}>{formatDate(comment.created_at)}</span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.4 }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" style={{ color: 'var(--primary)' }} />
            <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>播放统计</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-full overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                onClick={() => setChartType('artist')}
                className="px-3 py-1 text-xs font-medium transition-colors"
                style={{
                  backgroundColor: chartType === 'artist' ? 'var(--primary)' : 'transparent',
                  color: chartType === 'artist' ? 'white' : 'var(--muted-foreground)',
                }}
              >
                歌手播放
              </button>
              <button
                onClick={() => setChartType('daily')}
                className="px-3 py-1 text-xs font-medium transition-colors"
                style={{
                  backgroundColor: chartType === 'daily' ? 'var(--primary)' : 'transparent',
                  color: chartType === 'daily' ? 'white' : 'var(--muted-foreground)',
                }}
              >
                播放趋势
              </button>
            </div>

            {chartType === 'artist' && (
              <div className="flex rounded-full overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                <button onClick={() => setChartMode('pie')} className="px-3 py-1 text-xs" style={{ backgroundColor: chartMode === 'pie' ? 'rgba(255,255,255,0.1)' : 'transparent', color: chartMode === 'pie' ? 'var(--foreground)' : 'var(--muted-foreground)' }}>饼图</button>
                <button onClick={() => setChartMode('bar')} className="px-3 py-1 text-xs" style={{ backgroundColor: chartMode === 'bar' ? 'rgba(255,255,255,0.1)' : 'transparent', color: chartMode === 'bar' ? 'var(--foreground)' : 'var(--muted-foreground)' }}>柱状图</button>
              </div>
            )}

            {chartType === 'daily' && (
              <div className="flex rounded-full overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                <button onClick={() => setDailyRange('week')} className="px-3 py-1 text-xs" style={{ backgroundColor: dailyRange === 'week' ? 'rgba(255,255,255,0.1)' : 'transparent', color: dailyRange === 'week' ? 'var(--foreground)' : 'var(--muted-foreground)' }}>近一周</button>
                <button onClick={() => setDailyRange('month')} className="px-3 py-1 text-xs" style={{ backgroundColor: dailyRange === 'month' ? 'rgba(255,255,255,0.1)' : 'transparent', color: dailyRange === 'month' ? 'var(--foreground)' : 'var(--muted-foreground)' }}>近一月</button>
              </div>
            )}
          </div>
        </div>

        {chartLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--primary)' }} />
          </div>
        ) : noData ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3" style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
            <BarChart3 className="w-10 h-10" style={{ color: 'var(--muted-foreground)' }} />
            <p style={{ color: 'var(--muted-foreground)' }}>暂无播放数据</p>
            <button
              onClick={handleSeedData}
              className="mt-2 px-4 py-2 rounded-full text-sm font-medium transition-all hover:scale-[1.05] active:scale-[0.97]"
              style={{ backgroundColor: 'var(--primary)', color: 'white', boxShadow: '0 4px 16px rgba(193, 95, 60, 0.3)' }}
            >
              生成测试数据
            </button>
          </div>
        ) : (
          <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }} className="p-4">
            {chartType === 'artist' && chartMode === 'pie' && (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={artistData} dataKey="play_count" nameKey="artist" cx="50%" cy="50%" outerRadius={100} label={({ artist, percent }: { artist: string; percent: number }) => `${artist} ${(percent * 100).toFixed(0)}%`}>
                    {artistData.map((_, index) => (
                      <Cell key={index} fill={['#C15F3C', '#a3bffa', '#22c55e', '#fbbf24', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6'][index % 10]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(26,26,46,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
            {chartType === 'artist' && chartMode === 'bar' && (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={artistData}>
                  <XAxis dataKey="artist" tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
                  <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(26,26,46,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }} />
                  <Bar dataKey="play_count" fill="#C15F3C" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
            {chartType === 'daily' && (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="date" tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
                  <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(26,26,46,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }} />
                  <Line type="monotone" dataKey="count" stroke="#C15F3C" strokeWidth={2} dot={{ fill: '#C15F3C', r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
