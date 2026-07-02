'use client';

import React from 'react';
import { RefreshCw } from 'lucide-react';

export interface PlaylistCard {
  id: string;
  cover: string;
  title: string;
  playCount?: number;
  creator?: string;
}

interface RecommendationCardsProps {
  playlists: PlaylistCard[];
  title?: string;
  columns?: number;
  loading?: boolean;
  isDark?: boolean;
  themeStyles?: any;
  onRefresh?: () => void;
  onCardClick?: (playlist: PlaylistCard) => void;
}

const formatPlayCount = (count: number): string => {
  if (count >= 100000000) return `${(count / 100000000).toFixed(1)}亿`;
  if (count >= 10000) return `${(count / 10000).toFixed(1)}万`;
  return count.toString();
};

export const RecommendationCards: React.FC<RecommendationCardsProps> = ({
  playlists,
  title = '推荐歌单',
  columns = 7,
  loading = false,
  isDark = true,
  themeStyles,
  onRefresh,
  onCardClick,
}) => {
  const primaryText = themeStyles?.primaryText || (isDark ? '#f5f5f5' : '#1a1a1a');
  const secondaryText = themeStyles?.secondaryText || (isDark ? '#999999' : '#666666');

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-xl font-bold" style={{ color: primaryText }}>{title}</h3>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="transition-colors duration-200 hover:opacity-80 disabled:opacity-50"
            style={{ color: secondaryText }}
            aria-label="刷新推荐"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-7 gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {loading
          ? Array.from({ length: columns }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div
                  className="w-full aspect-square rounded-xl shadow-sm"
                  style={{ background: isDark ? '#1a1a1a' : '#e5e1db' }}
                />
                <div
                  className="h-3 rounded mt-1"
                  style={{ background: isDark ? '#1a1a1a' : '#e5e1db', width: '80%' }}
                />
              </div>
            ))
          : playlists.slice(0, columns).map((playlist) => (
              <div
                key={playlist.id}
                className="group cursor-pointer hover:scale-[1.03] transition-transform duration-200"
                onClick={() => onCardClick?.(playlist)}
              >
                <div className="relative">
                  <img
                    src={playlist.cover}
                    alt={playlist.title}
                    className="w-full aspect-square rounded-xl object-cover shadow-sm group-hover:shadow-lg group-hover:scale-105 transition-all duration-300"
                    loading="lazy"
                  />
                  {playlist.playCount && (
                    <span className="absolute top-1.5 right-1.5 bg-black/70 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded-full">
                      {formatPlayCount(playlist.playCount)}
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium mt-1 line-clamp-2 leading-relaxed" style={{ color: primaryText }}>
                  {playlist.title}
                </p>
              </div>
            ))}
      </div>

      <style jsx>{`
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
};
