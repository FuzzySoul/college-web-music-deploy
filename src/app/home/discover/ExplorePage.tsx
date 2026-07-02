'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TopRecommendBar, TopRecommendItem } from './components/TopRecommendBar';
import {
  RecommendationCards,
  PlaylistCard,
} from './components/RecommendationCards';
import { ActivityBanners, ActivityItem } from './components/ActivityBanners';
import { ChartRankings, ChartItem } from './components/ChartRankings';
import { NeteaseChartDetailView } from '@/components/music/NeteaseChartDetailView';
import { useBackButtonStore } from '@/components/music/stores/useBackButtonStore';

interface NeteaseTrack {
  id: number;
  name: string;
  ar: { id: number; name: string }[];
  al: { id: number; name: string; picUrl: string };
  dt: number;
}

interface NeteaseChart {
  id: number;
  name: string;
  coverImgUrl: string;
  description?: string;
  trackCount?: number;
  playCount?: number;
  updateTime?: number;
  tracks?: NeteaseTrack[];
}

const TOP_LIST_IDS = [
  { id: 19723756, name: '飙升榜' },
  { id: 3779629, name: '新歌榜' },
  { id: 2884035, name: '原创榜' },
  { id: 3778678, name: '热歌榜' },
];

let exploreCache: { data: any; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

async function getExploreData(): Promise<any> {
  if (exploreCache && Date.now() - exploreCache.timestamp < CACHE_TTL) {
    return exploreCache.data;
  }
  const res = await fetch('/api/explore');
  const result = await res.json();
  if (result.success && result.data) {
    exploreCache = { data: result.data, timestamp: Date.now() };
    return result.data;
  }
  return null;
}

interface ThemeColors {
  background: string;
  gradientEnd: string;
  cardBackground: string;
  primaryText: string;
  secondaryText: string;
  accentGold: string;
  borderLight: string;
  dividerGold: string;
  dividerLight: string;
  noiseOpacity: number;
  skeletonFrom: string;
  skeletonTo: string;
}

interface ExplorePageConfig {
  topItems?: TopRecommendItem[];
  playlists?: PlaylistCard[];
  activities?: ActivityItem[];
  charts?: ChartItem[];
}

const MOCK_TOP_ITEMS: TopRecommendItem[] = [
  { id: '1', title: '每日推荐 | 从「Una Mattina」听起', image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&h=400&fit=crop' },
  { id: '2', title: '热歌榜', isSpecial: true, gradient: 'from-pink-500 to-red-500' },
  { id: '3', title: '私人漫游', image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop' },
  { id: '4', title: '华语流行日推', image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=400&fit=crop' },
  { id: '5', title: '舒缓轻音乐', image: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=400&h=400&fit=crop' },
  { id: '6', title: '新歌首发', isSpecial: true, gradient: 'from-blue-500 to-cyan-500' },
  { id: '7', title: '经典老歌', image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&h=400&fit=crop' },
];

const MOCK_PLAYLISTS: PlaylistCard[] = [
  { id: '1', cover: 'https://picsum.photos/seed/p1/400/400', title: '因眠人觉 | 百听不腻的爆款歌曲大全', playCount: 450664 },
  { id: '2', cover: 'https://picsum.photos/seed/p2/400/400', title: '这些歌听的青春 都在内心的力量', playCount: 349183 },
  { id: '3', cover: 'https://picsum.photos/seed/p3/400/400', title: '治愈疲惫|今日好心情Max', playCount: 254483 },
  { id: '4', cover: 'https://picsum.photos/seed/p4/400/400', title: '高燃BGM | 燃烧血曲燃放观影必备', playCount: 233233 },
  { id: '5', cover: 'https://picsum.photos/seed/p5/400/400', title: '媚外爆发力极强的女高音', playCount: 113675 },
  { id: '6', cover: 'https://picsum.photos/seed/p6/400/400', title: '追剧的巨人终极季 Part 1', playCount: 85158 },
  { id: '7', cover: 'https://picsum.photos/seed/p7/400/400', title: '小众歌漫治愈系 | 带你心的灵时好', playCount: 193757 },
];

const MOCK_ACTIVITIES: ActivityItem[] = [
  {
    id: '1',
    image: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=200&h=200&fit=crop',
    subtitle: '郭静 全新单曲',
    title: '半日闲',
    description: '| 从喧嚣中抽身，回归内心的宁静',
    tag: '新歌首发',
    bgColor: '#8FBC8F',
  },
  {
    id: '2',
    image: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=200&h=200&fit=crop',
    subtitle: 'RAIN 全新单曲',
    title: 'Feel It',
    description: '| 「不能呼吸的爱」开启无限感动',
    tag: '独家首发',
    bgColor: '#222222',
  },
  {
    id: '3',
    image: 'https://images.unsplash.com/photo-1571330735066-03aaa9429d89?w=200&h=200&fit=crop',
    subtitle: '',
    title: '速览本月新鲜事',
    description: '精选热门活动不容错过',
    tag: '热门活动',
    ctaText: '立即查看',
    bgColor: '#1E3A8A',
  },
];

const MOCK_CHARTS: ChartItem[] = [
  {
    id: '1', name: '热歌榜', slug: 'hot', cover: 'https://picsum.photos/seed/hot/120/120',
    updateFrequency: '每日更新', updateTime: '更新25首',
    topTracks: [
      { rank: 1, name: '海屿你', artist: '马也_Crabbit', trend: 'same' },
      { rank: 2, name: '颜色', artist: 'Gareth.T', trend: 'up' },
      { rank: 3, name: '罗生门 (Follow)', artist: '梨冻紧/Wiz_H张子豪', trend: 'same' },
    ],
  },
  {
    id: '2', name: '飙升榜', slug: 'rising', cover: 'https://picsum.photos/seed/rising/120/120',
    updateFrequency: '每日更新', updateTime: '刚刚更新',
    topTracks: [
      { rank: 1, name: '颜色', artist: 'Gareth.T', trend: 'new' },
      { rank: 2, name: '心似烟火', artist: '陈雪千', trend: 'new' },
      { rank: 3, name: 'Montagem pitty', artist: '见过夏天lp/洛天依', trend: 'new' },
    ],
  },
  {
    id: '3', name: '新歌榜', slug: 'new', cover: 'https://picsum.photos/seed/new/120/120',
    updateFrequency: '每周更新', updateTime: '刚刚更新',
    topTracks: [
      { rank: 1, name: '主角', artist: '王菲', trend: 'up' },
      { rank: 2, name: '新鲜感', artist: '颜人中', trend: 'up' },
      { rank: 3, name: 'SpringThing', artist: 'Veda', trend: 'same' },
    ],
  },
  {
    id: '4', name: '原创榜', slug: 'original', cover: 'https://picsum.photos/seed/original/120/120',
    updateFrequency: '每周更新', updateTime: '每周四更新',
    topTracks: [
      { rank: 1, name: '旧商券', artist: '马赫mood/夏晨熙', trend: 'up' },
      { rank: 2, name: '非尾后巷', artist: '万能Vinda Weng', trend: 'new' },
      { rank: 3, name: 'SGA', artist: 'HILLSENONE/Top Barry', trend: 'same' },
    ],
  },
  {
    id: '5', name: '数字专辑畅销榜', slug: 'digital', cover: 'https://picsum.photos/seed/digital/120/120',
    updateFrequency: '实时更新', updateTime: '每30分钟更新',
    topTracks: [
      { rank: 1, name: 'Heavy Serenade', artist: 'NIMIXX', trend: 'same' },
      { rank: 2, name: '星河', artist: '未知艺术家', trend: 'down' },
      { rank: 3, name: '夜航', artist: '独立音乐人', trend: 'same' },
    ],
  },
  {
    id: '6', name: '歌曲畅销指数榜', slug: 'custom', cover: 'https://picsum.photos/seed/custom/120/120',
    updateFrequency: '每日更新', updateTime: '每1小时更新',
    topTracks: [
      { rank: 1, name: '坚夏', artist: '宫羽陈', trend: 'up' },
      { rank: 2, name: '光年之外', artist: '邓紫棋', trend: 'same' },
      { rank: 3, name: '晴天', artist: '周杰伦', trend: 'down' },
    ],
  },
];

interface ExplorePageProps {
  config?: ExplorePageConfig;
  onTopItemClick?: (item: TopRecommendItem) => void;
  onPlaylistClick?: (playlist: PlaylistCard) => void;
  onActivityClick?: (activity: ActivityItem) => void;
  onChartClick?: (chart: ChartItem) => void;
  onTrackClick?: (chartId: string, track: any) => void;
}

export const ExplorePage: React.FC<ExplorePageProps> = ({
  config = {},
  onTopItemClick,
  onPlaylistClick,
  onActivityClick,
  onChartClick,
  onTrackClick,
}) => {
  const [topItems, setTopItems] = useState<TopRecommendItem[]>(config.topItems || MOCK_TOP_ITEMS);
  const [playlists, setPlaylists] = useState<PlaylistCard[]>(config.playlists || MOCK_PLAYLISTS);
  const [activities, setActivities] = useState<ActivityItem[]>(config.activities || MOCK_ACTIVITIES);
  const [charts, setCharts] = useState<ChartItem[]>(config.charts || MOCK_CHARTS);

  const [loading, setLoading] = useState({ playlists: false, charts: false, topItems: false });
  const [isDark, setIsDark] = useState(false);
  const [selectedChart, setSelectedChart] = useState<NeteaseChart | null>(null);
  const [newSongsData, setNewSongsData] = useState<NeteaseTrack[]>([]);

  useEffect(() => {
    const checkTheme = () => {
      let savedTheme: string | null = null;
      try { savedTheme = localStorage.getItem('theme'); } catch {}
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const hasDarkClass = document.documentElement.classList.contains('dark');
      setIsDark(savedTheme === 'dark' || (!savedTheme && (hasDarkClass || prefersDark)));
    };
    checkTheme();
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((m) => { if (m.attributeName === 'class') checkTheme(); });
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('storage', (e: StorageEvent) => { if (e.key === 'theme') checkTheme(); });

    return () => {
      observer.disconnect();
      window.removeEventListener('storage', (e: StorageEvent) => { if (e.key === 'theme') checkTheme(); });
    };
  }, []);

  const themeStyles = useMemo<ThemeColors>(() => ({
    background: isDark ? '#121212' : '#faf9f7',
    gradientEnd: isDark ? '#121212' : '#faf9f7',
    cardBackground: isDark ? '#222' : '#fff',
    primaryText: isDark ? '#eee' : '#1a1a1a',
    secondaryText: isDark ? '#888' : '#666',
    accentGold: isDark ? '#d4af77' : '#c9a66b',
    borderLight: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)',
    dividerGold: isDark ? 'rgba(212,175,119,0.15)' : 'rgba(201,166,107,0.2)',
    dividerLight: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    noiseOpacity: isDark ? 0.03 : 0.01,
    skeletonFrom: isDark ? '#1a1a1a' : '#e5e1db',
    skeletonTo: isDark ? '#262626' : '#d5d1cb',
  }), [isDark]);

  const fetchNewSongs = async () => {
    setLoading((p) => ({ ...p, topItems: true }));
    try {
      const res = await fetch('/api/netease/top-songs');
      const data = await res.json();
      if (data.data && Array.isArray(data.data)) {
        const songs = data.data.slice(0, 7);
        setNewSongsData(data.data);
        const items: TopRecommendItem[] = songs.map((song: NeteaseTrack, i: number) => ({
          id: String(song.id),
          title: song.name,
          image: song.al?.picUrl ? `${song.al.picUrl}?param=400y400` : `https://picsum.photos/seed/${song.id}/400/400`,
          isSpecial: i === 1 || i === 5 ? true : undefined,
          gradient: i === 1 ? 'from-pink-500 to-red-500' : i === 5 ? 'from-blue-500 to-cyan-500' : undefined,
        }));
        if (items.length > 0) setTopItems(items);
      }
    } catch (error) {
      console.error('获取新歌失败:', error);
    } finally {
      setLoading((p) => ({ ...p, topItems: false }));
    }
  };

  const fetchCharts = async () => {
    setLoading((p) => ({ ...p, charts: true }));
    try {
      const promises = TOP_LIST_IDS.map(async (list) => {
        const res = await fetch(`/api/netease/chart/${list.id}`);
        const data = await res.json();
        const playlist = data.playlist;
        const topTracks = (playlist?.tracks || []).slice(0, 3).map((t: NeteaseTrack, i: number) => ({
          rank: i + 1,
          name: t.name,
          artist: t.ar?.map((a: { name: string }) => a.name).join(', ') || '',
          trend: i === 0 ? 'up' as const : i === 1 ? 'new' as const : 'same' as const,
        }));
        return {
          id: String(list.id),
          name: list.name,
          slug: list.name === '飙升榜' ? 'rising' : list.name === '新歌榜' ? 'new' : list.name === '原创榜' ? 'original' : 'hot',
          cover: playlist?.coverImgUrl || `https://picsum.photos/seed/${list.id}/120/120`,
          updateFrequency: '每日更新',
          updateTime: playlist?.updateTime ? new Date(playlist.updateTime).toLocaleDateString('zh-CN') : '刚刚更新',
          topTracks,
          _neteaseId: list.id,
          _coverImgUrl: playlist?.coverImgUrl || '',
          _description: playlist?.description || '',
          _trackCount: playlist?.trackCount || 0,
          _playCount: playlist?.playCount || 0,
          _updateTime: playlist?.updateTime || 0,
          _tracks: playlist?.tracks || [],
        };
      });
      const results = await Promise.all(promises);
      if (results.length > 0) setCharts(results);
    } catch (error) {
      console.error('获取榜单失败:', error);
    } finally {
      setLoading((p) => ({ ...p, charts: false }));
    }
  };

  useEffect(() => {
    fetchNewSongs();
    fetchCharts();
  }, []);

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const res = await fetch('/api/explore');
        const result = await res.json();
        if (result.success && result.data?.banners?.length > 0) {
          const mapped: ActivityItem[] = result.data.banners.map((b: any) => ({
            id: b.id,
            image: b.image_url || '',
            title: b.title || '',
            subtitle: b.subtitle || undefined,
            description: b.description || undefined,
            tag: b.tag || undefined,
            bgColor: b.bg_color || '#1E3A8A',
            ctaText: b.cta_text || undefined,
          }));
          setActivities(mapped);
        }
      } catch (error) {
        console.error('获取轮播图数据失败:', error);
      }
    };
    fetchBanners();
  }, []);

  const handleRefreshPlaylists = () => { setLoading((p) => ({ ...p, playlists: true })); setTimeout(() => setLoading((p) => ({ ...p, playlists: false })), 1000); };
  const handleRefreshCharts = () => { fetchCharts(); };

  const handleChartClick = (chart: ChartItem) => {
    const neteaseChart: NeteaseChart = {
      id: (chart as any)._neteaseId || parseInt(chart.id),
      name: chart.name,
      coverImgUrl: (chart as any)._coverImgUrl || chart.cover,
      description: (chart as any)._description || '',
      trackCount: (chart as any)._trackCount || 0,
      playCount: (chart as any)._playCount || 0,
      updateTime: (chart as any)._updateTime || 0,
      tracks: (chart as any)._tracks || [],
    };
    setSelectedChart(neteaseChart);
    onChartClick?.(chart);
  };

  const handleTopItemClick = (item: TopRecommendItem) => {
    const neteaseChart: NeteaseChart = {
      id: parseInt(item.id),
      name: item.title,
      coverImgUrl: item.image || '',
      description: '',
      trackCount: newSongsData.length,
      tracks: newSongsData,
    };
    setSelectedChart(neteaseChart);
    onTopItemClick?.(item);
  };

  // 同步 TopBar 返回按钮：选中榜单（详情视图）时显示，否则隐藏
  const setBack = useBackButtonStore((s) => s.setBack);
  const clearBack = useBackButtonStore((s) => s.clear);
  useEffect(() => {
    if (selectedChart) {
      setBack(() => setSelectedChart(null));
    } else {
      clearBack();
    }
    return () => clearBack();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChart?.id]);

  if (selectedChart) {
    return (
      <div className="w-full h-full" style={{ minHeight: 'calc(100vh - 80px)' }}>
        <NeteaseChartDetailView
          chart={selectedChart}
          onBack={() => setSelectedChart(null)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-3">
      <section>
        <TopRecommendBar
          items={topItems}
          autoPlayInterval={5000}
          isDark={isDark}
          themeStyles={themeStyles}
          onItemClick={handleTopItemClick}
        />
      </section>

      <section>
        <RecommendationCards
          playlists={playlists}
          title="推荐歌单"
          columns={7}
          loading={loading.playlists}
          isDark={isDark}
          themeStyles={themeStyles}
          onRefresh={handleRefreshPlaylists}
          onCardClick={onPlaylistClick}
        />
      </section>

      <section>
        <ActivityBanners
          activities={activities}
          title="精选活动"
          maxDisplay={3}
          isDark={isDark}
          themeStyles={themeStyles}
          onActivityClick={onActivityClick}
        />
      </section>

      <section className="flex-1 min-h-0">
        <ChartRankings
          charts={charts}
          title="榜单精选"
          columns={2}
          loading={loading.charts}
          isDark={isDark}
          themeStyles={themeStyles}
          onRefresh={handleRefreshCharts}
          onChartClick={handleChartClick}
          onTrackClick={onTrackClick}
        />
      </section>
    </div>
  );
};

export default ExplorePage;
