'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useScroll } from 'framer-motion';
import { Play, Music, RefreshCw, Shuffle, Headphones, Clock, Heart, MessageSquare } from 'lucide-react';
import { PlaylistHero } from './PlaylistHero';
import { PlaylistTrackList } from './PlaylistTrackList';
import { CommentSection } from './CommentSection';
import { usePlayer } from '@/app/home/context/PlayerContext';
import type { ExternalPlaylistTrack } from './types';

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

interface NeteaseChartDetailViewProps {
  chart: NeteaseChart;
  onBack: () => void;
}

function formatPlayCount(count: number): string {
  if (count >= 100000000) return `${(count / 100000000).toFixed(1)}亿`;
  if (count >= 10000) return `${(count / 10000).toFixed(1)}万`;
  return count.toString();
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('zh-CN');
}

function neteaseTrackToExternal(track: NeteaseTrack, position: number): ExternalPlaylistTrack {
  return {
    id: String(track.id),
    track_title: track.name,
    track_artist: track.ar?.map(a => a.name).join(', ') || '',
    track_duration: Math.floor((track.dt || 0) / 1000),
    thumbnail: track.al?.picUrl || undefined,
    platform_track_id: String(track.id),
    position,
    source: 'netease',
  };
}

export function NeteaseChartDetailView({ chart, onBack }: NeteaseChartDetailViewProps) {
  const { handlePlay, currentUser } = usePlayer();
  const [tracks, setTracks] = useState<NeteaseTrack[]>(chart.tracks || []);
  const [loading, setLoading] = useState(false);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [downloadingTrackId, setDownloadingTrackId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'tracks' | 'comments' | 'collectors'>('tracks');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    container: scrollContainerRef,
    offset: ["start start", "320px start"]
  });

  useEffect(() => {
    if (tracks.length === 0) {
      const fetchDetail = async () => {
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
      fetchDetail();
    }
  }, [chart.id]);

  const handlePlayNeteaseSong = async (song: NeteaseTrack) => {
    setPlayingId(song.id);
    try {
      const artistName = song.ar?.map(a => a.name).join(', ') || '';
      const response = await fetch('/api/netease/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          songId: song.id,
          songName: song.name,
          artist: artistName,
          youtubeCount: 1,
          bilibiliCount: 0,
        }),
      });
      const data = await response.json();
      if (data.success && data.url) {
        const virtualTrack = {
          id: song.id,
          title: data.title || song.name,
          artist: artistName,
          album: song.al?.name || null,
          cover: data.thumbnail || song.al?.picUrl || 'https://picsum.photos/seed/default/400/400',
          duration: 0,
          source: 'external' as const,
          source_id: song.id.toString(),
          play_url: data.url,
          lyrics: null,
          mv_url: null,
          mv_cover: null,
          created_at: new Date().toISOString(),
        };
        handlePlay(virtualTrack);
      }
    } catch (error) {
      console.error('播放失败:', error);
    } finally {
      setPlayingId(null);
    }
  };

  const handlePlayAll = () => {
    if (tracks.length > 0) {
      handlePlayNeteaseSong(tracks[0]);
    }
  };

  const handleShufflePlay = () => {
    if (tracks.length > 0) {
      const randomIndex = Math.floor(Math.random() * tracks.length);
      handlePlayNeteaseSong(tracks[randomIndex]);
    }
  };

  const handlePlayTrack = (extTrack: ExternalPlaylistTrack) => {
    const song = tracks.find(t => String(t.id) === extTrack.platform_track_id);
    if (song) {
      handlePlayNeteaseSong(song);
    }
  };

  const handleDownloadTrack = (extTrack: ExternalPlaylistTrack) => {
    const doDownload = async () => {
      setDownloadingTrackId(extTrack.id);
      try {
        const artistName = extTrack.track_artist;
        const response = await fetch('/api/music/ytdlp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'createSearchTask',
            trackTitle: extTrack.track_title,
            trackArtist: artistName,
            youtubeCount: 1,
            bilibiliCount: 0,
          }),
        });
        const data = await response.json();
        if (data.taskId) {
          let attempts = 0;
          const maxAttempts = 30;
          while (attempts < maxAttempts) {
            const statusResponse = await fetch('/api/music/ytdlp', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'getTaskStatus', taskId: data.taskId }),
            });
            const statusData = await statusResponse.json();
            if (statusData.status === 'completed' && statusData.results?.length > 0) {
              const result = statusData.results[0];
              const urlResponse = await fetch('/api/music/ytdlp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'getUrl', songId: result.id, source: result.source, directUrl: result.url }),
              });
              const urlData = await urlResponse.json();
              if (urlData.success && urlData.url) {
                const a = document.createElement('a');
                a.href = urlData.url;
                a.download = `${extTrack.track_title} - ${artistName}.mp3`;
                a.click();
              }
              break;
            } else if (statusData.status === 'failed') {
              break;
            }
            await new Promise(r => setTimeout(r, 1000));
            attempts++;
          }
        }
      } catch (error) {
        console.error('下载失败:', error);
      } finally {
        setDownloadingTrackId(null);
      }
    };
    doDownload();
  };

  const trackCount = tracks.length || chart.trackCount || 0;
  const externalTracks = tracks.map((t, i) => neteaseTrackToExternal(t, i));
  const currentPlaying = playingId ? String(playingId) : null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="chart-detail"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        ref={scrollContainerRef}
        className="h-full overflow-y-auto -mt-16 -mx-6"
        style={{ backgroundColor: 'transparent' }}
      >
        <div className="sticky top-0 z-20">
          <PlaylistHero
            name={chart.name}
            description={chart.description}
            cover={chart.coverImgUrl}
            trackCount={trackCount}
            onPlay={handlePlayAll}
            onBack={onBack}
            showBackButton={true}
            isInContainer={true}
            scrollProgress={scrollYProgress}
            actionButtons={
              <>
                <button
                  onClick={handlePlayAll}
                  title="播放全部"
                  className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition-all duration-400 ease-out hover:scale-[1.05] active:scale-[0.97] group relative overflow-hidden"
                  style={{
                    backgroundColor: 'var(--primary)',
                    color: 'white',
                    boxShadow: '0 4px 16px rgba(193, 95, 60, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                  }}
                >
                  <Play className="w-4 h-4" fill="white" />
                  <span>播放全部</span>
                </button>

                <button
                  onClick={handleShufflePlay}
                  title="随机播放"
                  className="p-2.5 rounded-full transition-all duration-400 ease-out hover:scale-[1.08] active:scale-[0.95] group relative overflow-hidden border border-[#a3bffa]/20"
                  style={{
                    backgroundColor: 'rgba(163, 191, 250, 0.08)',
                    color: '#a3bffa',
                    boxShadow: '0 2px 12px rgba(163, 191, 250, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <Shuffle className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
                </button>
              </>
            }
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex items-center gap-4 px-5 py-4"
        >
          <div className="flex items-center gap-6">
            <button
              onClick={() => setActiveTab('tracks')}
              className={`relative pb-2 text-base transition-all duration-200 ${
                activeTab === 'tracks' ? 'text-white font-bold' : 'text-gray-400 hover:text-gray-300 font-light'
              }`}
            >
              歌曲
              {activeTab === 'tracks' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ff7a00] rounded-full" />
              )}
              <span className={`absolute -top-1 -right-4 text-xs transition-colors duration-200 ${
                activeTab === 'tracks' ? 'text-white font-bold' : 'text-gray-500 font-normal'
              }`}>
                {trackCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('comments')}
              className={`relative pb-2 text-base transition-all duration-200 ${
                activeTab === 'comments' ? 'text-white font-bold' : 'text-gray-400 hover:text-gray-300 font-light'
              }`}
            >
              评论
              {activeTab === 'comments' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ff7a00] rounded-full" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('collectors')}
              className={`relative pb-2 text-base transition-all duration-200 ${
                activeTab === 'collectors' ? 'text-white font-bold' : 'text-gray-400 hover:text-gray-300 font-light'
              }`}
            >
              收藏者
              {activeTab === 'collectors' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ff7a00] rounded-full" />
              )}
            </button>
          </div>

          <div className="ml-auto flex items-center gap-3 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            {chart.playCount ? (
              <span className="flex items-center gap-1">
                <Headphones className="w-4 h-4" />
                {formatPlayCount(chart.playCount)}
              </span>
            ) : null}
            {chart.updateTime ? (
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {formatDate(chart.updateTime)}
              </span>
            ) : null}
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {activeTab === 'tracks' && (
            <motion.div
              key="tracks"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              style={{ backgroundColor: 'transparent' }}
            >
              <PlaylistTrackList
                tracks={externalTracks}
                currentPlaying={currentPlaying}
                isPlaying={!!playingId}
                downloadingTrackId={downloadingTrackId}
                onPlayTrack={handlePlayTrack}
                onDownloadTrack={handleDownloadTrack}
                isLoading={loading}
                isInGlassContainer={true}
              />
            </motion.div>
          )}

          {activeTab === 'comments' && (
            <motion.div
              key="comments"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="px-5 py-4"
              style={{ backgroundColor: 'transparent' }}
            >
              <CommentSection
                targetType="playlist"
                targetId={String(chart.id)}
                currentUser={currentUser}
                title="榜单评论"
              />
            </motion.div>
          )}

          {activeTab === 'collectors' && (
            <motion.div
              key="collectors"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              style={{ backgroundColor: 'transparent' }}
            >
              <div className="text-center py-12">
                <Heart className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                <h3 className="text-lg font-medium text-gray-300 mb-2">收藏者列表</h3>
                <p className="text-sm text-gray-500">暂无收藏者数据</p>
                <p className="text-xs text-gray-600 mt-2">功能开发中...</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
