'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useScroll, MotionValue } from 'framer-motion';
import { Plus, Trash2, Play, Music, X, Check, Download, Loader2, Shuffle, MessageSquare, Heart, Search } from 'lucide-react';
import { PlaylistHero } from './PlaylistHero';
import { YouTubeIcon, BilibiliIcon } from './PlatformIcons';
import { PlaylistTrackList } from './PlaylistTrackList';
import { BatchDownloadConfigModal } from './BatchDownloadConfigModal';
import { AddToPlaylistModal } from './AddToPlaylistModal';
import { usePlaylistTrackHandlers } from './usePlaylistTrackHandlers';
import { usePlaylistStore } from './stores/usePlaylistStore';
import { useBackButtonStore } from './stores/useBackButtonStore';
import { CommentSection } from './CommentSection';
import { usePlayer } from '@/app/home/context/PlayerContext';
import { musicService } from '@/lib/music-service';
import type { Playlist, ExternalPlaylistTrack } from './types';

// 重新导出类型以保持向后兼容
export type { Playlist, ExternalPlaylistTrack } from './types';

// 详情视图组件 - 独立组件确保 useScroll 只在挂载时调用
interface PlaylistDetailViewProps {
  playlist: Playlist;
  externalPlaylistTracks: ExternalPlaylistTrack[];
  currentPlaying?: string | null;
  isPlaying?: boolean;
  onPlayPlaylist: (playlistId: string) => void;
  onLoadExternalTracks: (externalPlaylistId: string) => Promise<void>;
  onBack: () => void;
  youtubeCount: number;
  bilibiliCount: number;
  setYoutubeCount: (count: number) => void;
  setBilibiliCount: (count: number) => void;
  onPlayUrl?: (url: string, title: string, artist: string, thumbnail?: string, onEnded?: () => void, trackId?: string | number) => void;
  onPlayQueue?: (tracks: ExternalPlaylistTrack[], startIndex: number, shouldShuffle: boolean) => void;
  currentQueueIndex?: number;
  onSetShuffleMode?: (shuffle: boolean) => void;
  currentUser: { id: string; username: string } | null;
  onEditPlaylist?: () => void;      // 新增：编辑回调
  onDeletePlaylist?: () => void;    // 新增：删除回调
  isLocalPlaylist?: boolean;        // 新增：是否为本地歌单（用于控制编辑按钮显示）
}

function PlaylistDetailView({
  playlist,
  externalPlaylistTracks,
  currentPlaying,
  isPlaying,
  onPlayPlaylist,
  onLoadExternalTracks,
  onBack,
  youtubeCount,
  bilibiliCount,
  setYoutubeCount,
  setBilibiliCount,
  onPlayUrl,
  onPlayQueue,
  currentQueueIndex = 0,
  onSetShuffleMode,
  currentUser,
  onEditPlaylist,          // 新增
  onDeletePlaylist,        // 新增
  isLocalPlaylist = false,  // 新增
}: PlaylistDetailViewProps) {
  // 安全检查：确保 isLocalPlaylist 有合理的默认值和 fallback
  const safeIsLocal = isLocalPlaylist ?? (playlist.platformSource !== 'netease' && playlist.platformSource !== 'qq');

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [batchDownloadOpen, setBatchDownloadOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'tracks' | 'comments' | 'collectors'>('tracks');

  const [customTitle, setCustomTitle] = useState('');
  const [customArtist, setCustomArtist] = useState('');
  const [isAddingCustom, setIsAddingCustom] = useState(false);

  const [localSearch, setLocalSearch] = useState('');
  const [localTracks, setLocalTracks] = useState<any[]>([]);
  const [isLoadingLocal, setIsLoadingLocal] = useState(false);
  const [localAddedTracks, setLocalAddedTracks] = useState<Set<number>>(new Set());
  const [localPlaylistTracks, setLocalPlaylistTracks] = useState<any[]>([]);

  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [collectors, setCollectors] = useState<{
    user_id: string;
    username: string;
    avatar_url: string | null;
    created_at: string;
  }[]>([]);
  const [isLoadingCollectors, setIsLoadingCollectors] = useState(false);

  useEffect(() => {
    if (!playlist.id.startsWith('temp-')) {
      // external 歌单的 id 形如 "external-xxx" 不是合法 uuid，需要用 externalPlaylistId
      const realPlaylistId = playlist.externalPlaylistId || playlist.id;
      musicService.getPlaylistFavoriteCount(realPlaylistId).then(setFavoriteCount).catch(() => {});
      if (currentUser) {
        musicService.isPlaylistFavorited(realPlaylistId, currentUser.id).then(setIsFavorited).catch(() => {});
      }
    }
  }, [playlist.id, playlist.externalPlaylistId, currentUser?.id]);

  const handleToggleFavorite = async () => {
    if (!currentUser) return;
    const newFavorited = !isFavorited;
    setIsFavorited(newFavorited);
    setFavoriteCount(prev => newFavorited ? prev + 1 : Math.max(0, prev - 1));
    // external 歌单的 id 形如 "external-xxx" 不是合法 uuid，需要用 externalPlaylistId
    const realPlaylistId = playlist.externalPlaylistId || playlist.id;
    const ok = await musicService.togglePlaylistFavorite(realPlaylistId, currentUser.id).catch(() => false);
    if (!ok) {
      setIsFavorited(!newFavorited);
      setFavoriteCount(prev => newFavorited ? Math.max(0, prev - 1) : prev + 1);
    }
  };

  useEffect(() => {
    if (!playlist.id.startsWith('external-')) {
      fetchLocalTracks();
      fetch(`/api/music/playlist-tracks?playlist_id=${playlist.id}&source=local`)
        .then(r => r.json())
        .then(d => { if (d.tracks) setLocalPlaylistTracks(d.tracks); })
        .catch(e => console.error('加载本地歌单曲目失败:', e));
    }
  }, []);

  const { scrollYProgress } = useScroll({
    container: scrollContainerRef,
    offset: ["start start", "320px start"]
  });

  const {
    downloadingTrackId,
    batchDownloading,
    batchProgress,
    preloadProgress,
    handlePlayTrack,
    handleDownloadTrack,
    handleBatchDownload,
    handlePlayAll,
    handleShufflePlay,
  } = usePlaylistTrackHandlers({
    youtubeCount,
    bilibiliCount,
    onPlayUrl,
    externalPlaylistTracks,
    onBatchComplete: () => setBatchDownloadOpen(false),
    onPlayQueue,
    currentQueueIndex,
    isPlaying,
    onSetShuffleMode,
    playlistId: playlist.id,
  });

  // 检查是否为乐观更新的网易云歌单（正在后台同步）
  const isOptimisticNetease = playlist.id.startsWith('temp-netease-');

  const handleLoadTracks = async () => {
    // 乐观更新的歌单还没有真实ID，跳过加载
    if (isOptimisticNetease) return;
    if (playlist.externalPlaylistId && !playlist.externalPlaylistId.startsWith('temp-')) {
      setIsLoadingTracks(true);
      try {
        await onLoadExternalTracks(playlist.externalPlaylistId);
      } finally {
        setIsLoadingTracks(false);
      }
    }
  };

  const isCustomPlaylist = playlist.source === 'custom' || (!playlist.externalPlaylistId && playlist.id.startsWith('external-'));

  const handleAddCustomTrack = async () => {
    if (!customTitle.trim() || !playlist.externalPlaylistId) return;
    setIsAddingCustom(true);
    const optId = `opt-${Date.now()}`;
    const optimisticTrack: any = {
      id: optId,
      track_title: customTitle.trim(),
      track_artist: customArtist.trim() || '',
      track_duration: 0,
      platform_track_id: optId,
      position: externalPlaylistTracks.length,
    };
    try {
      const res = await fetch('/api/music/external-playlist-tracks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playlist_id: playlist.externalPlaylistId,
          track_title: customTitle.trim(),
          track_artist: customArtist.trim() || null,
        }),
      });
      if (res.ok) {
        setCustomTitle('');
        setCustomArtist('');
        await onLoadExternalTracks(playlist.externalPlaylistId);
      }
    } catch (e) {
      console.error('添加歌曲失败:', e);
    } finally {
      setIsAddingCustom(false);
    }
  };

  const handleDeleteCustomTrack = async (track: ExternalPlaylistTrack) => {
    if (!playlist.externalPlaylistId) return;
    try {
      const res = await fetch(`/api/music/external-playlist-tracks?id=${track.id}&playlist_id=${playlist.externalPlaylistId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await onLoadExternalTracks(playlist.externalPlaylistId);
      }
    } catch (e) {
      console.error('删除歌曲失败:', e);
    }
  };

  const fetchLocalTracks = async (search?: string) => {
    setIsLoadingLocal(true);
    try {
      const params = new URLSearchParams({ page: '1', pageSize: '20' });
      if (search) params.set('search', search);
      const res = await fetch(`/api/music/local-tracks?${params}`);
      const data = await res.json();
      if (data.success) {
        setLocalTracks(data.data || []);
      }
    } catch (e) {
      console.error('获取本地音乐失败:', e);
    } finally {
      setIsLoadingLocal(false);
    }
  };

  const handleAddLocalTrack = async (track: any) => {
    if (!playlist.id || playlist.id.startsWith('external-')) return;
    setLocalAddedTracks(prev => new Set(prev).add(track.id));
    setLocalPlaylistTracks(prev => [...prev, { ...track, position: prev.length }]);
    try {
      const res = await fetch('/api/music/playlist-tracks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlist_id: playlist.id, track_id: track.id }),
      });
      if (res.ok) {
        console.log('✅ 已添加到歌单:', track.title);
      }
    } catch (e) {
      setLocalAddedTracks(prev => {
        const next = new Set(prev);
        next.delete(track.id);
        return next;
      });
      setLocalPlaylistTracks(prev => prev.filter(t => t.id !== track.id));
      console.error('添加歌曲失败:', e);
    }
  };

  const isLocal = !isCustomPlaylist && !playlist.id.startsWith('external-');

  // 从 context 拿 handlePlay，用于本地歌单单首播放（与本地音乐模块一致）
  const { handlePlay: contextHandlePlay } = usePlayer();

  // 组件挂载时自动加载外部歌单歌曲
  useEffect(() => {
    if (isOptimisticNetease) return; // 乐观歌单不自动加载
    if (playlist.externalPlaylistId && externalPlaylistTracks.length === 0) {
      handleLoadTracks();
    }
  }, []); // 只在挂载时执行一次

  // 切换到收藏者 Tab 时加载数据
  useEffect(() => {
    if (activeTab === 'collectors' && !playlist.id.startsWith('temp-')) {
      setIsLoadingCollectors(true);
      // external 歌单的 id 形如 "external-xxx" 不是合法 uuid，需要用 externalPlaylistId
      const realPlaylistId = playlist.externalPlaylistId || playlist.id;
      musicService.getPlaylistFavorites(realPlaylistId)
        .then(setCollectors)
        .catch(() => setCollectors([]))
        .finally(() => setIsLoadingCollectors(false));
    }
  }, [activeTab, playlist.id, playlist.externalPlaylistId]);

  const handlePlay = () => {
    // 乐观更新的歌单不可播放
    if (isOptimisticNetease) return;
    // 外部/自建歌单：原有逻辑
    if (playlist.externalPlaylistId) {
      if (externalPlaylistTracks.length === 0) {
        handleLoadTracks();
      }
      handlePlayAll();
      return;
    }

    // 本地歌单：用本地曲目播放
    if (localPlaylistTracks.length > 0 && onPlayUrl) {
      const first = localPlaylistTracks[0];
      onPlayUrl(
        first.audio_url || first.play_url || '',
        first.title,
        first.artist,
        first.cover || undefined,
        undefined,
        String(first.id)
      );
    }
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="playlist-detail"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        ref={scrollContainerRef}
        className="h-full overflow-y-auto -mt-16 -mx-6"
        style={{ backgroundColor: 'transparent' }}
      >
        {/* Hero 区域 - sticky 固定在顶部 */}
        <div className="sticky top-0 z-20">
          <PlaylistHero
            name={playlist.name}
            description={playlist.description}
            cover={playlist.cover}
            trackCount={playlist.externalPlaylistId
              ? externalPlaylistTracks.length
              : localPlaylistTracks.length}
            onPlay={handlePlay}
            onBack={onBack}
            showBackButton={true}
            isInContainer={true}
            scrollProgress={scrollYProgress}
            onEdit={onEditPlaylist}
            isFavorited={isFavorited}
            favoriteCount={favoriteCount}
            onToggleFavorite={handleToggleFavorite}
            disabled={!currentUser}
            actionButtons={
              <>
                {/* 播放全部按钮 - warm gold 主色调 */}
                <button
                  onClick={handlePlay}
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

                {/* 批量下载按钮 */}
                {playlist.externalPlaylistId && externalPlaylistTracks.length > 0 && (
                  <button
                    onClick={() => setBatchDownloadOpen(true)}
                    title="批量下载"
                    disabled={batchDownloading}
                    className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ease-out hover:scale-[1.05] active:scale-[0.97] group backdrop-blur-sm border"
                    style={{
                      backgroundColor: 'rgba(var(--primary-rgb), 0.08)',
                      color: 'var(--foreground)',
                      borderColor: 'var(--border)',
                    }}
                  >
                    {batchDownloading ? (
                      <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--primary)' }} />
                    ) : (
                      <Download className="w-4 h-4 group-hover:scale-110 transition-transform duration-300" />
                    )}
                    <span>下载</span>
                  </button>
                )}
              </>
            }
          />
        </div>
      
        {/* 操作区 - 全透明无缝融合 */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex items-center gap-4 px-5 py-4"
        >
          {/* Tab 切换栏 - 最左侧三栏布局 */}
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
                {playlist.externalPlaylistId
                  ? externalPlaylistTracks.length
                  : localPlaylistTracks.length}
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

          {/* 播放来源设置文字 */}
          <span className="text-sm font-medium tracking-wide shrink-0 ml-auto" style={{ color: 'var(--muted-foreground)' }}>
            播放来源
          </span>
          
          {/* YouTube 图标 + 数量输入 */}
          <label className="flex items-center gap-2 group cursor-pointer select-none">
            <span className="inline-flex items-center justify-center w-5 h-5 transition-transform duration-300 ease-out group-hover:scale-110">
              <YouTubeIcon />
            </span>
            <input
              type="number"
              min="0"
              max="10"
              value={youtubeCount}
              onChange={(e) => {
                const value = e.target.value === '' ? 0 : parseInt(e.target.value, 10)
                setYoutubeCount(isNaN(value) ? 0 : Math.min(Math.max(value, 0), 10))
              }}
              className="w-12 px-2 py-1 text-sm text-center rounded-lg border font-semibold focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-all duration-200 hover:border-[var(--primary)]/50"
              style={{
                backgroundColor: 'var(--input)',
                color: 'var(--primary)',
                borderColor: 'var(--border)'
              }}
              title="YouTube 来源数量"
            />
          </label>
          
          {/* Bilibili 图标 + 数量输入 */}
          <label className="flex items-center gap-2 group cursor-pointer select-none">
            <span className="inline-flex items-center justify-center w-5 h-5 transition-transform duration-300 ease-out group-hover:scale-110">
              <BilibiliIcon />
            </span>
            <input
              type="number"
              min="0"
              max="10"
              value={bilibiliCount}
              onChange={(e) => {
                const value = e.target.value === '' ? 0 : parseInt(e.target.value, 10)
                setBilibiliCount(isNaN(value) ? 0 : Math.min(Math.max(value, 0), 10))
              }}
              className="w-12 px-2 py-1 text-sm text-center rounded-lg border font-semibold focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-all duration-200 hover:border-[var(--primary)]/50"
              style={{
                backgroundColor: 'var(--input)',
                color: 'var(--primary)',
                borderColor: 'var(--border)'
              }}
              title="Bilibili 来源数量"
            />
          </label>
          
          {/* 分隔线 */}
          <div className="w-px h-6 bg-[var(--border)]/50" />

          {/* 随机播放按钮 - cool silver 色调 */}
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

          {/* 歌单操作按钮 */}
          <div className="ml-auto flex items-center gap-2 shrink-0">
            {/* 编辑按钮 */}
            {onEditPlaylist && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  console.log('[PlaylistDetailView] Edit button clicked');
                  onEditPlaylist();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  color: 'var(--foreground)',
                  background: 'var(--accent)',
                  border: '1px solid var(--border)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--muted)';
                  e.currentTarget.style.borderColor = 'var(--primary)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(193, 95, 60, 0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--accent)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                title="编辑歌单"
                aria-label="编辑歌单"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  <path d="m15 5 4 4" />
                </svg>
                编辑
              </button>
            )}

            {/* 删除按钮 */}
            {onDeletePlaylist && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeletePlaylist();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  color: '#ef4444',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.06)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                title="删除歌单"
                aria-label="删除歌单"
              >
                <Trash2 className="w-3.5 h-3.5" />
                删除
              </button>
            )}
          </div>
        </motion.div>

        {/* Tab 内容区域 */}
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
              {/* 乐观更新的网易云歌单：显示同步中提示 */}
              {isOptimisticNetease && (
                <div className="flex flex-col items-center justify-center py-16 px-4">
                  <Loader2 className="w-8 h-8 animate-spin mb-4" style={{ color: 'var(--primary)' }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                    正在同步歌曲...
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                    歌单已保存，后台正在拉取歌曲列表，请稍后再试
                  </p>
                </div>
              )}
              {(isCustomPlaylist || playlist.id.startsWith('external-')) && !isOptimisticNetease && (
                <PlaylistTrackList
                  tracks={externalPlaylistTracks}
                  currentPlaying={currentPlaying}
                  isPlaying={isPlaying}
                  downloadingTrackId={downloadingTrackId}
                  onPlayTrack={handlePlayTrack}
                  onDownloadTrack={handleDownloadTrack}
                  onDeleteTrack={isCustomPlaylist ? handleDeleteCustomTrack : undefined}
                  isLoading={isLoadingTracks}
                  isInGlassContainer={true}
                  hideDuration={true}
                />
              )}
              {isLocal && (
                <div className="px-5 py-2">
                  {localPlaylistTracks.length > 0 ? (
                    localPlaylistTracks.map((track: any, idx: number) => (
                      <div
                        key={track.id}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-[var(--accent)]"
                      >
                        <span className="text-xs w-6 text-center" style={{ color: 'var(--muted-foreground)' }}>{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate" style={{ color: 'var(--foreground)' }}>{track.title}</p>
                          <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>{track.artist || '未知歌手'}</p>
                        </div>
                        <button
                          onClick={() => {
                            // 本地歌单：直接走 context 的 handlePlay，跟本地音乐模块一致
                            // 保留 lyrics/mv_url/mv_cover 等字段，播放器能正确显示 MV/歌词按钮
                            contextHandlePlay({
                              id: track.id,
                              title: track.title,
                              artist: track.artist || '',
                              album: track.album || '',
                              cover: track.cover || '',
                              duration: track.duration || 0,
                              play_url: track.audio_url || track.play_url || '',
                              source: track.source || 'local',
                              source_id: String(track.id),
                              lyrics: track.lyrics || null,
                              mv_url: track.mv_url || null,
                              mv_cover: track.mv_cover || null,
                              created_at: '',
                            });
                          }}
                          className="p-1 text-xs transition-colors hover:text-[var(--primary)]"
                          style={{ color: 'var(--muted-foreground)' }}
                          title="播放"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs py-4 text-center" style={{ color: 'var(--muted-foreground)' }}>
                      从下方本地音乐中添加歌曲
                    </p>
                  )}
                </div>
              )}
              {isCustomPlaylist && (
                <div className="px-5 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
                  <p className="text-sm font-medium mb-3" style={{ color: 'var(--foreground)' }}>添加歌曲</p>
                  <div className="flex gap-3 items-end flex-wrap">
                    <div className="flex-1 min-w-[140px]">
                      <input
                        type="text"
                        value={customTitle}
                        onChange={(e) => setCustomTitle(e.target.value)}
                        placeholder="歌曲名 *"
                        className="w-full px-3 py-2 rounded-lg text-sm border"
                        style={{ backgroundColor: 'var(--input)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
                      />
                    </div>
                    <div className="flex-1 min-w-[120px]">
                      <input
                        type="text"
                        value={customArtist}
                        onChange={(e) => setCustomArtist(e.target.value)}
                        placeholder="歌手（可选）"
                        className="w-full px-3 py-2 rounded-lg text-sm border"
                        style={{ backgroundColor: 'var(--input)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
                      />
                    </div>
                    <button
                      onClick={handleAddCustomTrack}
                      disabled={!customTitle.trim() || isAddingCustom}
                      className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50"
                      style={{ backgroundColor: 'var(--primary)', color: 'white' }}
                    >
                      {isAddingCustom ? '添加中...' : '添加'}
                    </button>
                  </div>
                </div>
              )}
              {isLocal && (
                <div className="px-5 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
                  <p className="text-sm font-medium mb-3" style={{ color: 'var(--foreground)' }}>本地音乐</p>
                  <div className="flex gap-2 mb-3">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
                      <input
                        type="text"
                        value={localSearch}
                        onChange={(e) => setLocalSearch(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') fetchLocalTracks(localSearch.trim() || undefined); }}
                        placeholder="搜索本地音乐..."
                        className="w-full pl-9 pr-3 py-2 rounded-lg text-sm border"
                        style={{ backgroundColor: 'var(--input)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
                      />
                    </div>
                    <button
                      onClick={() => fetchLocalTracks(localSearch.trim() || undefined)}
                      disabled={isLoadingLocal}
                      className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50"
                      style={{ backgroundColor: 'var(--accent)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                    >
                      {isLoadingLocal ? '搜索中...' : '搜索'}
                    </button>
                  </div>
                  {localTracks.length === 0 && !isLoadingLocal && (
                    <p className="text-xs py-4 text-center" style={{ color: 'var(--muted-foreground)' }}>
                      输入关键词搜索本地音乐
                    </p>
                  )}
                  {isLoadingLocal && (
                    <div className="flex justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--muted-foreground)' }} />
                    </div>
                  )}
                  <div className="space-y-0.5 max-h-64 overflow-y-auto">
                    {localTracks.map((track: any) => (
                      <div
                        key={track.id}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-[var(--accent)]"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate" style={{ color: 'var(--foreground)' }}>{track.title}</p>
                          <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>{track.artist || '未知歌手'}</p>
                        </div>
                        <button
                          onClick={() => handleAddLocalTrack(track)}
                          disabled={localAddedTracks.has(track.id)}
                          className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-200 disabled:opacity-30"
                          style={{
                            backgroundColor: localAddedTracks.has(track.id) ? 'var(--accent)' : 'var(--primary)',
                            color: 'white',
                          }}
                          title={localAddedTracks.has(track.id) ? '已添加' : '添加到歌单'}
                        >
                          {localAddedTracks.has(track.id) ? '✓' : '+'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
                targetId={playlist.id}
                currentUser={currentUser}
                title="歌单评论"
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
              {isLoadingCollectors ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--muted-foreground)' }} />
                </div>
              ) : collectors.length > 0 ? (
                <div className="px-5 py-4 space-y-1">
                  {collectors.map((c, i) => (
                    <div key={`collector-${c.user_id}-${i}`} className="flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-[var(--accent)]">
                      {c.avatar_url ? (
                        <img
                          src={c.avatar_url}
                          alt={c.username}
                          className="w-9 h-9 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0" style={{ backgroundColor: 'var(--primary)' }}>
                          {c.username?.charAt(0).toUpperCase() || '?'}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{c.username}</p>
                        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          收藏于 {new Date(c.created_at).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <Heart className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--muted-foreground)' }} />
                  <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--foreground)' }}>暂无收藏者</h3>
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>成为第一个收藏这个歌单的人吧</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* 批量下载配置弹窗 */}
        <BatchDownloadConfigModal
          isOpen={batchDownloadOpen}
          onClose={() => setBatchDownloadOpen(false)}
          onConfirm={handleBatchDownload}
          youtubeCount={youtubeCount}
          bilibiliCount={bilibiliCount}
          onYoutubeCountChange={setYoutubeCount}
          onBilibiliCountChange={setBilibiliCount}
          trackCount={externalPlaylistTracks.length}
          isDownloading={batchDownloading}
          progress={batchProgress}
        />
      </motion.div>
    </AnimatePresence>
  );
}

interface PlaylistManagerProps {
  playlists: Playlist[];
  onCreatePlaylist: (name: string, description?: string, source?: 'local' | 'custom') => void;
  onDeletePlaylist: (id: string) => void;
  onEditPlaylist?: (playlist: Playlist) => void;
  onAddToPlaylist: (playlistId: string) => void;
  onRemoveFromPlaylist: (playlistId: string, trackId: number) => void;
  onPlayPlaylist: (playlistId: string) => void;
  onLoadExternalTracks?: (externalPlaylistId: string) => Promise<ExternalPlaylistTrack[]>;
  externalPlaylistTracks?: ExternalPlaylistTrack[];
  currentTrackId?: number;
  currentPlaying?: string | null;
  isPlaying?: boolean;
  onPlayUrl?: (url: string, title: string, artist: string, thumbnail?: string, onEnded?: () => void, trackId?: string | number) => void;
  onPlayQueue?: (tracks: ExternalPlaylistTrack[], startIndex: number, shouldShuffle: boolean) => void;
  currentQueueIndex?: number;
  onSetShuffleMode?: (shuffle: boolean) => void;
  initialSelectedPlaylistId?: string;  // 外部传入的初始选中歌单ID（用于从侧边栏跳转）
}

export function PlaylistManager({
  playlists,
  onCreatePlaylist,
  onDeletePlaylist,
  onEditPlaylist,
  onAddToPlaylist,
  onRemoveFromPlaylist,
  onPlayPlaylist,
  onLoadExternalTracks,
  externalPlaylistTracks = [],
  currentTrackId,
  currentPlaying,
  isPlaying,
  onPlayUrl,
  onPlayQueue,
  currentQueueIndex = 0,
  onSetShuffleMode,
  initialSelectedPlaylistId,
}: PlaylistManagerProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [playlistType, setPlaylistType] = useState<'local' | 'custom'>('local');
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);

  useEffect(() => {
    if (selectedPlaylist) {
      let updated = playlists.find(p => p.id === selectedPlaylist.id);
      // 修复：处理网易云 temp id → real id 替换（complete 事件后），
      // 此时原 id 找不到，需通过 externalPlaylistId 找到对应的真实歌单
      if (!updated && selectedPlaylist.externalPlaylistId) {
        updated = playlists.find(p =>
          p.externalPlaylistId === selectedPlaylist.externalPlaylistId
          && !p.id.startsWith('temp-')
        );
      }
      if (updated) {
        setSelectedPlaylist(updated);
      } else {
        setSelectedPlaylist(null);
      }
    }
  }, [playlists]);

  // 使用全局 store 的搜索配置
  const { youtubeCount, bilibiliCount, setYoutubeCount, setBilibiliCount } = usePlaylistStore();

  // 从 context 获取当前用户
  const { currentUser } = usePlayer();

  // 🔧 修复：使用 ref 追踪上一次的 initialSelectedPlaylistId，检测 ID 变化
  const prevPlaylistIdRef = useRef<string | undefined>(undefined);

  // 当从侧边栏跳转时，自动选中对应的歌单
  useEffect(() => {
    console.log('[PlaylistManager] Checking auto-select:', {
      initialSelectedPlaylistId,
      playlistsCount: playlists.length,
      selectedPlaylist: selectedPlaylist?.name,
      playlistIds: playlists.map(p => p.id),
      prevPlaylistId: prevPlaylistIdRef.current
    });

    // 🎯 核心修复：检测 ID 是否真正发生变化
    const idChanged = initialSelectedPlaylistId !== prevPlaylistIdRef.current;

    if (idChanged && initialSelectedPlaylistId && playlists.length > 0) {
      // 更新 ref 为当前值
      prevPlaylistIdRef.current = initialSelectedPlaylistId;

      const playlist = playlists.find(p => p.id === initialSelectedPlaylistId);

      if (playlist) {
        console.log('[PlaylistManager] ✅ Auto-selecting playlist from URL:', playlist.name);

        // ✨ 直接替换为新歌单（无闪烁）
        setSelectedPlaylist(playlist);

        // 关键修复：根据歌单类型处理歌曲数据
        if (playlist.externalPlaylistId) {
          // 外部歌单：自动加载歌曲列表
          if (onLoadExternalTracks) {
            console.log('[PlaylistManager] Loading external tracks for:', playlist.externalPlaylistId);
            onLoadExternalTracks(playlist.externalPlaylistId);
          }
        } else {
          // 本地歌单：清空残留的外部歌曲数据
          if (externalPlaylistTracks.length > 0 && onLoadExternalTracks) {
            console.log('[PlaylistManager] Auto-select: clearing external tracks for local playlist:', playlist.name);
            onLoadExternalTracks('');
          }
        }
      } else {
        console.warn('[PlaylistManager] ❌ Playlist not found for ID:', initialSelectedPlaylistId);
        console.warn('[PlaylistManager] Available IDs:', playlists.map(p => p.id));
      }
    } else if (!initialSelectedPlaylistId) {
      // URL 中没有参数时，重置 ref（用于返回列表视图的场景）
      prevPlaylistIdRef.current = undefined;
    }
  }, [initialSelectedPlaylistId, playlists.length, onLoadExternalTracks]);

  const handleCreate = () => {
    if (newName.trim()) {
      onCreatePlaylist(newName.trim(), newDescription.trim(), playlistType);
      setNewName('');
      setNewDescription('');
      setPlaylistType('local');
      setIsCreating(false);
    }
  };

  const handleCancel = () => {
    setNewName('');
    setNewDescription('');
    setPlaylistType('local');
    setIsCreating(false);
  };

  const handleLoadTracks = async (externalPlaylistId: string) => {
    if (onLoadExternalTracks) {
      await onLoadExternalTracks(externalPlaylistId);
    }
  };

  const handleBack = () => {
    setSelectedPlaylist(null);
    if (onLoadExternalTracks) {
      onLoadExternalTracks('');
    }
  };

  // 同步 TopBar 返回按钮：选中歌单（详情视图）时显示，否则隐藏
  const setBack = useBackButtonStore((s) => s.setBack);
  const clearBack = useBackButtonStore((s) => s.clear);
  useEffect(() => {
    if (selectedPlaylist) {
      setBack(handleBack);
    } else {
      clearBack();
    }
    return () => clearBack();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlaylist?.id]);

  // 歌单详情视图 - 使用 AnimatePresence + key 实现切换动画
  if (selectedPlaylist) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedPlaylist.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{
            duration: 0.25,
            ease: [0.4, 0, 0.2, 1]
          }}
        >
          <PlaylistDetailView
            playlist={selectedPlaylist}
            externalPlaylistTracks={externalPlaylistTracks}
            currentPlaying={currentPlaying}
            isPlaying={isPlaying}
            onPlayPlaylist={onPlayPlaylist}
            onLoadExternalTracks={handleLoadTracks}
            onBack={handleBack}
            youtubeCount={youtubeCount}
            bilibiliCount={bilibiliCount}
            setYoutubeCount={setYoutubeCount}
            setBilibiliCount={setBilibiliCount}
            onPlayUrl={onPlayUrl}
            onPlayQueue={onPlayQueue}
            currentQueueIndex={currentQueueIndex}
            onSetShuffleMode={onSetShuffleMode}
            currentUser={currentUser}
            onEditPlaylist={onEditPlaylist ? () => onEditPlaylist(selectedPlaylist) : undefined}
            onDeletePlaylist={async () => {
              await onDeletePlaylist(selectedPlaylist.id);
              handleBack();
            }}
            isLocalPlaylist={selectedPlaylist.source === 'local' || selectedPlaylist.source === 'custom' || (!selectedPlaylist.source && selectedPlaylist.platformSource !== 'netease')}
          />
        </motion.div>
      </AnimatePresence>
    );
  }

  // 歌单列表视图
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">我的歌单</h2>
        {!isCreating && (
          <button onClick={() => setIsCreating(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            新建歌单
          </button>
        )}
      </div>

      {isCreating && (
        <div className="p-4 rounded-xl space-y-3" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="flex gap-2 mb-1">
            <button
              onClick={() => setPlaylistType('local')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                playlistType === 'local'
                  ? 'bg-[var(--primary)] text-white shadow-sm'
                  : 'bg-[var(--accent)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]'
              }`}
            >
              本地歌单
            </button>
            <button
              onClick={() => setPlaylistType('custom')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                playlistType === 'custom'
                  ? 'bg-[var(--primary)] text-white shadow-sm'
                  : 'bg-[var(--accent)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]'
              }`}
            >
              自建爬虫歌单
            </button>
          </div>
          {playlistType === 'local' && (
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>使用本地音乐库中的歌曲创建歌单</p>
          )}
          {playlistType === 'custom' && (
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>手动输入歌曲信息创建自定义歌单</p>
          )}
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="歌单名称"
            className="input-box w-full"
            autoFocus
          />
          <input
            type="text"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="描述（可选）"
            className="input-box w-full"
          />
          <div className="flex gap-2 justify-end">
            <button onClick={handleCancel} className="btn-secondary">
              <X className="w-4 h-4" />
              取消
            </button>
            <button onClick={handleCreate} className="btn-primary">
              <Check className="w-4 h-4" />
              创建
            </button>
          </div>
        </div>
      )}

      {playlists.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <AnimatePresence>
            {playlists.map((playlist) => (
              <motion.div
                key={playlist.id}
                layoutId={`playlist-card-${playlist.id}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                className="card cursor-pointer group"
                onClick={() => {
                  setSelectedPlaylist(playlist);

                  // 关键修复：根据歌单类型处理歌曲数据
                  if (playlist.externalPlaylistId) {
                    // 外部歌单：加载外部歌曲（增加 playlist_id 校验避免缓存错误）
                    if (externalPlaylistTracks.length === 0 ||
                        externalPlaylistTracks[0]?.playlist_id !== playlist.externalPlaylistId) {
                      handleLoadTracks(playlist.externalPlaylistId);
                    }
                  } else {
                    // 本地歌单：清空残留的外部歌曲数据
                    if (externalPlaylistTracks.length > 0 && onLoadExternalTracks) {
                      console.log('[PlaylistManager] Clearing external tracks for local playlist:', playlist.name);
                      onLoadExternalTracks(''); // 传空字符串触发清空
                    }
                  }
                }}
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
              >
                <motion.div 
                  className="card-cover relative"
                  layoutId={`playlist-cover-${playlist.id}`}
                >
                  {playlist.cover ? (
                    <img src={playlist.cover} alt={playlist.name} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: 'var(--accent)' }}>
                      <Music className="w-12 h-12" style={{ color: 'var(--muted-foreground)' }} />
                    </div>
                  )}
                  {!playlist.id.startsWith('external-') && playlist.source !== 'custom' && (
                    <span className="absolute bottom-2 right-2 px-1.5 py-0.5 text-[10px] font-medium rounded backdrop-blur-sm"
                      style={{ backgroundColor: 'rgba(var(--primary-rgb), 0.85)', color: 'white' }}>
                      网站歌单
                    </span>
                  )}
                  {playlist.source === 'custom' && (
                    <span className="absolute bottom-2 right-2 px-1.5 py-0.5 text-[10px] font-medium rounded backdrop-blur-sm"
                      style={{ backgroundColor: 'rgba(99, 102, 241, 0.85)', color: 'white' }}>
                      自建歌单
                    </span>
                  )}
                  <div className="play-overlay">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // 关键修复：根据歌单类型处理歌曲数据
                        if (playlist.externalPlaylistId) {
                          if (externalPlaylistTracks.length === 0 ||
                              externalPlaylistTracks[0]?.playlist_id !== playlist.externalPlaylistId) {
                            handleLoadTracks(playlist.externalPlaylistId);
                          }
                        } else {
                          // 本地歌单：清空残留数据
                          if (externalPlaylistTracks.length > 0 && onLoadExternalTracks) {
                            onLoadExternalTracks('');
                          }
                        }
                        onPlayPlaylist(playlist.id);
                      }}
                      className="play-button"
                    >
                      <Play className="w-5 h-5 ml-0.5" />
                    </button>
                  </div>
                </motion.div>
                <div className="p-3">
                  <h3 className="font-medium text-sm mb-1 truncate">{playlist.name}</h3>
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    {playlist.trackCount
                      ? `${playlist.trackCount} 首歌曲`
                      : (playlist.trackIds?.length || 0) > 0
                        ? `${playlist.trackIds.length} 首歌曲`
                        : '歌单为空'}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        !isCreating && (
          <div className="empty-state">
            <Music className="w-12 h-12" />
            <p>暂无歌单</p>
            <p className="text-xs mt-2">点击上方按钮创建你的第一个歌单</p>
          </div>
        )
      )}
    </div>
  );
}

// 重新导出 AddToPlaylistModal 以保持向后兼容
export { AddToPlaylistModal } from './AddToPlaylistModal';
