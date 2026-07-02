'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

export interface ChartTrack {
  rank: number;
  name: string;
  artist: string;
  trend?: 'up' | 'down' | 'new' | 'same';
}

export interface ChartItem {
  id: string;
  name: string;
  slug: string;
  cover: string;
  updateFrequency?: string;
  updateTime?: string;
  topTracks: ChartTrack[];
}

interface ChartRankingsProps {
  charts: ChartItem[];
  title?: string;
  columns?: number;
  loading?: boolean;
  isDark?: boolean;
  themeStyles?: any;
  onRefresh?: () => void;
  onChartClick?: (chart: ChartItem) => void;
  onTrackClick?: (chartId: string, track: ChartTrack) => void;
}

const MOCK_CHARTS_FALLBACK: ChartItem[] = [
  {
    id: '1',
    name: '热歌榜',
    slug: 'hot',
    cover: 'https://picsum.photos/seed/chart1/240/240',
    updateTime: '更新25首',
    topTracks: [
      { rank: 1, name: '海屿你', artist: '马也_Crabbit', trend: 'up' },
      { rank: 2, name: '颜色', artist: 'Gareth.T', trend: 'same' },
      { rank: 3, name: '如果呢', artist: '郑润泽', trend: 'up' },
    ],
  },
  {
    id: '2',
    name: '新歌榜',
    slug: 'new',
    cover: 'https://picsum.photos/seed/chart2/240/240',
    updateTime: '刚刚更新',
    topTracks: [
      { rank: 1, name: '主角', artist: '王菲', trend: 'up' },
      { rank: 2, name: '新鲜感', artist: '颜人中', trend: 'up' },
      { rank: 3, name: '淡季', artist: 'i.c/音乐合伙人', trend: 'up' },
    ],
  },
  {
    id: '3',
    name: '数字专辑畅销榜',
    slug: 'album',
    cover: 'https://picsum.photos/seed/chart3/240/240',
    updateTime: '每30分钟更新',
    topTracks: [
      { rank: 1, name: 'Heavy Serenade', artist: 'NMIXX', trend: 'up' },
      { rank: 2, name: '冀西南林路行', artist: '万能青年旅店', trend: 'up' },
    ],
  },
  {
    id: '4',
    name: '飙升榜',
    slug: 'soaring',
    cover: 'https://picsum.photos/seed/chart4/240/240',
    updateTime: '刚刚更新',
    topTracks: [
      { rank: 1, name: '坠夏', artist: '曾舜晞', trend: 'new' },
      { rank: 2, name: '坚定的浪潮', artist: '念念不忘', trend: 'new' },
      { rank: 3, name: 'Forget it', artist: 'SETI', trend: 'new' },
    ],
  },
  {
    id: '5',
    name: '原创榜',
    slug: 'original',
    cover: 'https://picsum.photos/seed/chart5/240/240',
    updateTime: '每周四更新',
    topTracks: [
      { rank: 1, name: '旧商务', artist: '马赫mood/夏辰熙', trend: 'new' },
      { rank: 2, name: '排尾后巷', artist: '万妮达Vinida Weng', trend: 'new' },
      { rank: 3, name: 'SGA', artist: 'CHILLSENONE/Top Barry', trend: 'new' },
    ],
  },
  {
    id: '6',
    name: '歌曲畅销指数榜',
    slug: 'sale',
    cover: 'https://picsum.photos/seed/chart6/240/240',
    updateTime: '每1小时更新',
    topTracks: [
      { rank: 1, name: '海屿你', artist: '马也_Crabbit', trend: 'same' },
      { rank: 2, name: '知我', artist: '国风堂/哦漏', trend: 'same' },
    ],
  },
];

function TrendIcon({ trend }: { trend?: 'up' | 'down' | 'new' | 'same' }) {
  if (!trend || trend === 'same') return null;

  if (trend === 'up') {
    return <i className="fa fa-caret-up text-[#ef4444]" />;
  }
  if (trend === 'new') {
    return <span className="text-[#22c55e] text-xs font-medium">新</span>;
  }
  if (trend === 'down') {
    return <i className="fa fa-caret-down text-[#6b7280]" />;
  }
  return null;
}

function ChartCard({
  chart,
  isDark,
  onChartClick,
  onTrackClick,
}: {
  chart: ChartItem;
  isDark: boolean;
  onChartClick?: (chart: ChartItem) => void;
  onTrackClick?: (chartId: string, track: ChartTrack) => void;
}) {
  const tracks = chart.topTracks?.length > 0 ? chart.topTracks : MOCK_CHARTS_FALLBACK.find(c => c.id === chart.id)?.topTracks || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onChartClick?.(chart)}
      className={`rounded-xl p-3 cursor-pointer transition-all duration-300 hover:shadow-lg ${
        isDark ? 'bg-[#222] hover:bg-[#2a2a2a] shadow-sm' : 'bg-white hover:bg-gray-50 shadow-md'
      }`}
    >
      <div className="flex justify-between items-center mb-2">
        <h4 className={`font-bold text-base ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {chart.name}
        </h4>
        {chart.updateTime && (
          <span className={`text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            {chart.updateTime}
          </span>
        )}
      </div>

      <div className="flex items-start gap-2">
        <img
          src={chart.cover}
          alt={chart.name}
          className="w-14 h-14 rounded object-cover flex-shrink-0"
          loading="lazy"
        />

        <div className={`text-sm flex-1 min-w-0 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          {tracks.slice(0, 3).map((track, idx) => (
            <div
              key={track.rank || idx}
              onClick={(e) => {
                e.stopPropagation();
                onTrackClick?.(chart.id, track);
              }}
              className={`flex justify-between items-center mb-1 last:mb-0 ${
                idx < tracks.length - 1 ? 'mb-1' : ''
              }`}
            >
              <span className="truncate pr-2">
                {track.rank} {track.name} - {track.artist}
              </span>
              <TrendIcon trend={track.trend} />
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export const ChartRankings: React.FC<ChartRankingsProps> = ({
  charts,
  title = '榜单精选',
  columns = 2,
  loading = false,
  isDark = true,
  themeStyles,
  onRefresh,
  onChartClick,
  onTrackClick,
}) => {
  const displayCharts = charts?.length > 0 ? charts : MOCK_CHARTS_FALLBACK;

  const leftColumn = displayCharts.filter((_, i) => i % columns === 0);
  const rightColumn = displayCharts.filter((_, i) => i % columns === 1);

  if (loading) {
    return (
      <div className="w-full pb-12">
        <div className="flex justify-between items-center mb-3">
          <div className={`h-5 w-20 rounded ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`} />
          <div className={`w-4 h-4 rounded-full ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[0, 1].map((col) => (
            <div key={col} className="space-y-4">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={`rounded-xl p-3 ${isDark ? 'bg-[#222]' : 'bg-white'}`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <div className={`h-4 w-16 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />
                    <div className={`h-3 w-14 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`} />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-14 h-14 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />
                    <div className="flex-1 space-y-2">
                      {[0, 1, 2].map((j) => (
                        <div key={j} className={`h-3 w-full rounded ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`} />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full pb-12">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex justify-between items-center mb-3"
      >
        <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {title}
        </h3>

        <motion.button
          whileHover={{ rotate: 180 }}
          whileTap={{ scale: 0.9 }}
          onClick={onRefresh}
          className={`p-1 rounded-full transition-colors ${
            isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
          }`}
          aria-label="刷新榜单"
        >
          <RefreshCw
            className={`w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}
          />
        </motion.button>
      </motion.div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-4">
          {leftColumn.map((chart) => (
            <ChartCard
              key={chart.id}
              chart={chart}
              isDark={isDark}
              onChartClick={onChartClick}
              onTrackClick={onTrackClick}
            />
          ))}
        </div>

        <div className="space-y-4">
          {rightColumn.map((chart) => (
            <ChartCard
              key={chart.id}
              chart={chart}
              isDark={isDark}
              onChartClick={onChartClick}
              onTrackClick={onTrackClick}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ChartRankings;
