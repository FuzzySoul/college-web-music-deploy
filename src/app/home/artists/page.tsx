'use client';

import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, User, Play, Music, Disc3, ArrowLeft, Info, Users, Video, Database, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PlaylistHero } from '@/components/music/PlaylistHero';
import { usePlayer } from '../context/PlayerContext';
import type { Track } from '@/lib/music-service';
import MvPlayer from '@/components/music/MvPlayer';

interface ArtistItem {
  id: string;
  name: string;
  alias: string;
  image: string;
  description: string;
}

interface TrackItem {
  id: number;
  title: string;
  artist: string;
  album: string | null;
  cover: string | null;
  duration: number;
  source: string;
  audio_url: string | null;
  mv_url?: string | null;
  mv_cover?: string | null;
}

interface AlbumItem {
  id: number;
  name: string;
  artist: string;
  cover: string | null;
  release_year: number | null;
}

type DetailTab = 'tracks' | 'albums' | 'mv' | 'info' | 'similar';

function ArtistsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { handlePlayPlaylistQueue, allTracks } = usePlayer();
  const [artists, setArtists] = useState<ArtistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedArtist, setSelectedArtist] = useState<ArtistItem | null>(null);
  const [artistTracks, setArtistTracks] = useState<TrackItem[]>([]);
  const [artistAlbums, setArtistAlbums] = useState<AlbumItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>('tracks');

  useEffect(() => {
    const id = searchParams.get('id');
    const name = searchParams.get('name');
    if (id && artists.length > 0) {
      const found = artists.find(a => a.id === id);
      if (found) {
        loadArtistDetail(found);
      }
    } else if (name && artists.length > 0) {
      const found = artists.find(a => a.name.toLowerCase() === name.toLowerCase());
      if (found) {
        loadArtistDetail(found);
      }
    } else if (!id && !name) {
      setSelectedArtist(null);
    }
  }, [searchParams, artists]);

  const loadArtists = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/music/sync-artists');
      if (response.ok) {
        const data = await response.json();
        setArtists((data.artists || []).map((a: any) => ({
          id: a.id,
          name: a.name,
          alias: a.alias || '',
          image: a.image || '',
          description: a.description || '',
        })));
      }
    } catch (error) {
      console.error('加载歌手失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadArtistDetail = async (artist: ArtistItem) => {
    setSelectedArtist(artist);
    setDetailLoading(true);
    setActiveTab('tracks');
    try {
      const response = await fetch(`/api/music/artist-detail?id=${artist.id}`);
      if (response.ok) {
        const data = await response.json();
        setArtistTracks(data.tracks || []);
        setArtistAlbums(data.albums || []);
      }
    } catch (error) {
      console.error('加载歌手详情失败:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleArtistClick = (artist: ArtistItem) => {
    router.push(`/home/artists?id=${artist.id}`);
  };

  const handleBack = () => {
    router.push('/home/artists');
  };

  const handlePlayAll = () => {
    if (artistTracks.length === 0) return;
    const tracks: Track[] = artistTracks.map(t => ({
      id: t.id,
      title: t.title,
      artist: t.artist,
      album: t.album || null,
      cover: t.cover || null,
      duration: t.duration,
      source: t.source || 'local',
      source_id: null,
      play_url: t.audio_url || null,
      lyrics: null,
      mv_url: null,
      mv_cover: null,
      created_at: new Date().toISOString(),
    }));
    handlePlayPlaylistQueue(tracks, 0);
  };

  useEffect(() => { loadArtists(); }, []);

  if (selectedArtist) {
    return <ArtistDetailView
      artist={selectedArtist}
      tracks={artistTracks}
      albums={artistAlbums}
      loading={detailLoading}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      onBack={handleBack}
      onPlayAll={handlePlayAll}
      onArtistClick={handleArtistClick}
      onTracksUpdate={(t) => setArtistTracks(t)}
      onAlbumsUpdate={(a) => setArtistAlbums(a)}
      allArtists={artists}
    />;
  }

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-normal artistic-title">歌手</h2>
        <Button variant="outline" size="sm" onClick={async () => {
          try {
            const response = await fetch('/api/music/sync-artists', { method: 'POST' });
            const data = await response.json();
            alert(data.message || '同步完成');
            loadArtists();
          } catch (error) {
            console.error('同步失败:', error);
            alert('同步失败');
          }
        }}>
          <RefreshCw className="w-4 h-4 mr-1" />
          同步歌手
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-3 text-sm text-muted-foreground">加载中...</span>
        </div>
      ) : artists.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {artists.map((artist) => (
            <div
              key={artist.id}
              className="card-premium cursor-pointer text-center p-4"
              onClick={() => handleArtistClick(artist)}
            >
              <div className="w-20 h-20 mx-auto rounded-full overflow-hidden mb-3 bg-muted">
                {artist.image ? (
                  <img src={artist.image} alt={artist.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"
                    style={{ background: `linear-gradient(135deg, hsl(${artist.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360}, 70%, 50%), hsl(${(artist.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 3) % 360}, 60%, 40%))` }}>
                    <span className="text-white font-bold text-lg">{artist.name.charAt(0).toUpperCase()}</span>
                  </div>
                )}
              </div>
              <p className="font-medium truncate">{artist.name}</p>
              {artist.alias && <p className="text-xs text-muted-foreground">{artist.alias}</p>}
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <User className="w-16 h-16" />
          <p className="text-lg font-medium mt-4">暂无歌手</p>
          <p className="text-sm mt-2">点击"同步歌手"从外部歌单导入歌手信息</p>
        </div>
      )}
    </div>
  );
}

export default function ArtistsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--primary)' }} />
        </div>
      }
    >
      <ArtistsPageContent />
    </Suspense>
  );
}

function ArtistDetailView({
  artist,
  tracks,
  albums,
  loading,
  activeTab,
  setActiveTab,
  onBack,
  onPlayAll,
  onArtistClick,
  onTracksUpdate,
  onAlbumsUpdate,
  allArtists,
}: {
  artist: ArtistItem;
  tracks: TrackItem[];
  albums: AlbumItem[];
  loading: boolean;
  activeTab: DetailTab;
  setActiveTab: (tab: DetailTab) => void;
  onBack: () => void;
  onPlayAll: () => void;
  onArtistClick: (artist: ArtistItem) => void;
  onTracksUpdate?: (tracks: TrackItem[]) => void;
  onAlbumsUpdate?: (albums: AlbumItem[]) => void;
  allArtists?: ArtistItem[];
}) {
  const router = useRouter();
  const { handlePlayPlaylistQueue } = usePlayer();
  const [mbSyncing, setMbSyncing] = useState(false);
  const [mbStatus, setMbStatus] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle');
  const [mbData, setMbData] = useState<any>(null);

  const [mvPlayerOpen, setMvPlayerOpen] = useState(false);
  const [currentMv, setCurrentMv] = useState<{url: string, title: string, artist: string, cover: string} | null>(null);

  const similarArtists = (allArtists || [])
    .filter(a => a.id !== artist.id)
    .slice(0, 6);

  const handlePlayTrack = (track: TrackItem) => {
    const playTrack: Track = {
      id: track.id,
      title: track.title,
      artist: track.artist,
      album: track.album || null,
      cover: track.cover || null,
      duration: track.duration,
      source: track.source || 'local',
      source_id: null,
      play_url: track.audio_url || null,
      lyrics: null,
      mv_url: track.mv_url || null,
      mv_cover: track.mv_cover || null,
      created_at: new Date().toISOString(),
    };
    handlePlayPlaylistQueue([playTrack], 0);
  };

  const handlePlayMv = (track: TrackItem) => {
    if (track.mv_url) {
      setCurrentMv({
        url: track.mv_url,
        title: track.title,
        artist: track.artist,
        cover: track.cover || '',
      });
      setMvPlayerOpen(true);
    }
  };

  const refreshArtistData = useCallback(async () => {
    try {
      const res = await fetch(`/api/music/artist-detail?id=${artist.id}`);
      if (res.ok) {
        const data = await res.json();
        onTracksUpdate?.(data.tracks || []);
        onAlbumsUpdate?.(data.albums || []);
      }
    } catch {}
  }, [artist.id]);

  const handleMbSync = async () => {
    setMbSyncing(true);
    setMbStatus('syncing');
    setMbData(null);

    try {
      const resp = await fetch(`/api/music/sync-netease-artist?artistName=${encodeURIComponent(artist.name)}`, {
        method: 'POST',
      });

      const result = await resp.json();

      if (!resp.ok || result.error) {
        console.error('[Netease Sync] 同步失败:', result.error || result.detail);
        setMbStatus('error');
        setMbSyncing(false);
        return;
      }

      if (result.success) {
        setMbData(result.data);
        setMbStatus('done');
        const { albumsSynced, tracksSynced } = result.data;
        console.log(`[Netease] 同步完成: ${albumsSynced}张专辑, ${tracksSynced}首歌`);
      } else {
        setMbStatus('error');
      }
      setMbSyncing(false);

      refreshArtistData();
    } catch (error) {
      console.error('[Netease Sync] 请求异常:', error);
      setMbStatus('error');
      setMbSyncing(false);
    }
  };
  const tabs: { key: DetailTab; label: string; count?: number }[] = [
    { key: 'tracks', label: '歌曲', count: tracks.length },
    { key: 'albums', label: '专辑', count: albums.length },
    { key: 'mv', label: 'MV' },
    { key: 'info', label: '歌手详情' },
    { key: 'similar', label: '相似歌手' },
  ];

  return (
    <div
      className="overflow-y-auto -mt-16 -mx-6"
      style={{ backgroundColor: 'transparent', height: 'calc(100vh - 140px)' }}
    >
      <PlaylistHero
        name={artist.name}
        description={artist.alias && artist.alias !== artist.name ? `别名: ${artist.alias}` : undefined}
        cover={artist.image || null}
        trackCount={tracks.length}
        onBack={onBack}
        showBackButton={true}
        isInContainer={true}
        coverShape="circle"
        static={true}
        actionButtons={
          <>
              <button
                onClick={onPlayAll}
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
                onClick={handleMbSync}
                disabled={mbSyncing}
                title="从网易云音乐同步歌手信息"
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-400 ease-out hover:scale-[1.05] active:scale-[0.97] disabled:opacity-50 disabled:hover:scale-100 border"
                style={{
                  color: mbStatus === 'done' ? '#22c55e' : mbStatus === 'error' ? '#ef4444' : 'var(--muted-foreground)',
                  borderColor: mbStatus === 'done' ? '#22c55e' : mbStatus === 'error' ? '#ef4444' : 'var(--border)',
                }}
              >
                {mbSyncing || mbStatus === 'syncing' ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>网易云同步中...</span>
                  </>
                ) : mbStatus === 'done' ? (
                  <span>✓ 已同步 {mbData?.albumsSynced || 0}专辑 {mbData?.tracksSynced || 0}歌曲</span>
                ) : mbStatus === 'error' ? (
                  <span className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    同步失败，点击重试
                  </span>
                ) : (
                  <>
                    <span>网易云同步</span>
                  </>
                )}
              </button>
            </>
          }
        />

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex items-center gap-4 px-5 py-4"
      >
        <div className="flex items-center gap-6">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative pb-2 text-base transition-all duration-200 ${
                activeTab === tab.key ? 'text-white font-bold' : 'text-gray-400 hover:text-gray-300 font-light'
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ff7a00] rounded-full" />
              )}
              {tab.count !== undefined && (
                <span className={`absolute -top-1 -right-4 text-xs transition-colors duration-200 ${
                  activeTab === tab.key ? 'text-white font-bold' : 'text-gray-500 font-normal'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </motion.div>

      <div className="px-5 pb-8" style={{ minHeight: 'calc(100vh - 200px)' }}>
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center justify-center py-20">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            </motion.div>
          ) : (
            <>
              {activeTab === 'tracks' && (
                <motion.div key="tracks" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                  {tracks.length > 0 ? (
                    <div className="space-y-1">
                      <div className="grid grid-cols-[40px_1fr_1fr_80px] items-center gap-3 px-3 py-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        <span className="text-center">#</span>
                        <span>歌名</span>
                        <span className="hidden md:block">专辑</span>
                        <span className="text-right">时长</span>
                      </div>
                      {tracks.map((track, idx) => (
                        <div
                          key={track.id}
                          className="grid grid-cols-[40px_1fr_1fr_80px] items-center gap-3 px-3 py-2.5 rounded-lg group hover:bg-white/5 hover:translate-x-1 transition-all duration-200 cursor-pointer"
                          onClick={() => handlePlayTrack(track)}
                        >
                          <span className="text-sm text-center tabular-nums" style={{ color: 'var(--muted-foreground)' }}>{idx + 1}</span>
                          <div className="min-w-0 flex items-center gap-3">
                            {track.cover ? (
                              <img src={track.cover} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-10 h-10 rounded bg-gray-800 flex items-center justify-center flex-shrink-0">
                                <Music className="w-5 h-5 text-gray-600" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                                {track.title}
                                {track.mv_url && (
                                  <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-xs rounded flex-shrink-0">MV</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="min-w-0 hidden md:block">
                            <div className="text-sm truncate" style={{ color: 'var(--muted-foreground)' }}>{track.album || '-'}</div>
                          </div>
                          <div className="text-right">
                            <span className="text-sm tabular-nums" style={{ color: 'var(--muted-foreground)' }}>
                              {Math.floor(track.duration / 60)}:{String(track.duration % 60).padStart(2, '0')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16">
                      <Music className="w-12 h-12 mb-3" style={{ color: 'var(--muted-foreground)' }} />
                      <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>暂无歌曲</p>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'albums' && (
                <motion.div key="albums" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                  {albums.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {albums.map(album => (
                        <div
                          key={album.id}
                          className="group cursor-pointer"
                          onClick={() => router.push(`/home/albums/${album.id}`)}
                        >
                          <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-800/50">
                            {album.cover ? (
                              <img
                                src={album.cover}
                                alt={album.name}
                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Disc3 className="w-12 h-12 text-gray-600" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Play className="w-10 h-10 text-white" />
                            </div>
                          </div>
                          <p className="mt-2 text-sm font-medium truncate">{album.name}</p>
                          <p className="text-xs text-gray-400">{album.release_year || '未知年份'}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16">
                      <Disc3 className="w-12 h-12 mb-3" style={{ color: 'var(--muted-foreground)' }} />
                      <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>暂无专辑</p>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'mv' && (
                <motion.div key="mv" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                  {(() => {
                    const mvTracks = tracks.filter(t => t.mv_url);
                    if (mvTracks.length === 0) {
                      return (
                        <div className="flex flex-col items-center justify-center py-20">
                          <Video className="w-16 h-16 text-gray-600 mb-4" />
                          <p className="text-gray-400">暂无MV</p>
                          <p className="text-sm text-gray-500 mt-2">尝试从 MusicBrainz 同步获取更多数据</p>
                        </div>
                      );
                    }
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {mvTracks.map(track => (
                          <div
                            key={track.id}
                            className="group relative rounded-lg overflow-hidden bg-gray-800/50 cursor-pointer hover:bg-gray-700/50 transition-colors"
                            onClick={() => handlePlayMv(track)}
                          >
                            <div className="aspect-video relative">
                              {track.mv_cover ? (
                                <img src={track.mv_cover} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-900/30 to-blue-900/30">
                                  <Video className="w-16 h-16 text-gray-500" />
                                </div>
                              )}
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                                  <Play className="w-7 h-7 text-white ml-1" fill="white" />
                                </div>
                              </div>
                            </div>
                            <div className="p-4">
                              <h4 className="font-medium truncate">{track.title}</h4>
                              <p className="text-sm text-gray-400 mt-1">{track.artist}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </motion.div>
              )}

              {activeTab === 'info' && (
                <motion.div key="info" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                  <div className="max-w-2xl space-y-6">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 mb-6">
                      <div className="w-32 h-32 rounded-full overflow-hidden bg-muted flex-shrink-0 ring-2 ring-white/10">
                        {artist.image ? (
                          <img src={artist.image} alt={artist.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"
                            style={{ background: `linear-gradient(135deg, hsl(${artist.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360}, 70%, 50%), hsl(${(artist.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 3) % 360}, 60%, 40%))` }}>
                            <span className="text-white font-bold text-3xl">{artist.name.charAt(0).toUpperCase()}</span>
                          </div>
                        )}
                      </div>
                      <div className="text-center sm:text-left flex-1">
                        <h3 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{artist.name}</h3>
                        {artist.alias && artist.alias !== artist.name && (
                          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>别名: {artist.alias}</p>
                        )}
                        <div className="flex items-center justify-center sm:justify-start gap-4 mt-3">
                          <div className="text-center">
                            <div className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>{tracks.length}</div>
                            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>歌曲</div>
                          </div>
                          <div className="w-px h-8 bg-white/10" />
                          <div className="text-center">
                            <div className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>{albums.length}</div>
                            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>专辑</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {(artist.description || mbData?.artistInfo?.briefDesc) && (
                      <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <h4 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--muted-foreground)' }}>歌手简介</h4>
                        <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'var(--foreground)' }}>
                          {artist.description || mbData?.artistInfo?.briefDesc}
                        </p>
                      </div>
                    )}

                    {mbData?.neteaseArtistId ? (
                      <div className="space-y-4 rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <h4 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>网易云音乐 信息</h4>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          {mbData.artistInfo?.name && (
                            <div className="flex items-center gap-2">
                              <span style={{ color: 'var(--muted-foreground)' }}>歌手名</span>
                              <span style={{ color: 'var(--foreground)' }}>{mbData.artistInfo.name}</span>
                            </div>
                          )}
                          {mbData.artistInfo?.trans && (
                            <div className="flex items-center gap-2">
                              <span style={{ color: 'var(--muted-foreground)' }}>译名</span>
                              <span style={{ color: 'var(--foreground)' }}>{mbData.artistInfo.trans}</span>
                            </div>
                          )}
                          {mbData.artistInfo?.albumSize !== undefined && (
                            <div className="flex items-center gap-2">
                              <span style={{ color: 'var(--muted-foreground)' }}>专辑数</span>
                              <span style={{ color: 'var(--foreground)' }}>{mbData.artistInfo.albumSize}</span>
                            </div>
                          )}
                          {mbData.artistInfo?.musicSize !== undefined && (
                            <div className="flex items-center gap-2">
                              <span style={{ color: 'var(--muted-foreground)' }}>歌曲数</span>
                              <span style={{ color: 'var(--foreground)' }}>{mbData.artistInfo.musicSize}</span>
                            </div>
                          )}
                        </div>
                        {mbData.neteaseArtistId && (
                          <div className="mt-4 p-3 bg-black/20 rounded-lg">
                            <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                              <Database className="w-3.5 h-3.5" />
                              <span>网易云歌手 ID</span>
                            </div>
                            <code className="text-xs text-gray-300 break-all font-mono">{mbData.neteaseArtistId}</code>
                            <a
                              href={`https://music.163.com/#/artist?id=${mbData.neteaseArtistId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-2 text-blue-400 hover:text-blue-300 text-xs inline-flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3" />
                              在线查看
                            </a>
                          </div>
                        )}
                        {mbData.syncedAt && (
                          <div className="mt-3 flex items-center gap-2 text-xs text-green-400">
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>最后同步: {new Date(mbData.syncedAt).toLocaleString('zh-CN')}</span>
                          </div>
                        )}
                        <div className="grid grid-cols-3 gap-3 mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                          <div className="text-center">
                            <div className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>{mbData.tracksSynced || 0}</div>
                            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>收录歌曲</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>{mbData.albumsSynced || 0}</div>
                            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>发行专辑</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>{mbData.syncedAt ? new Date(mbData.syncedAt).toLocaleDateString('zh-CN') : '-'}</div>
                            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>同步时间</div>
                          </div>
                        </div>
                      </div>
                    ) : !artist.description && (
                      <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>暂无歌手简介，点击「网易云同步」获取网易云音乐数据</p>
                    )}
                  </div>
                </motion.div>
              )}

              {activeTab === 'similar' && (
                <motion.div key="similar" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                  {similarArtists.length > 0 ? (
                    <div className="space-y-4">
                      <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>你可能感兴趣的歌手</p>
                      <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                        {similarArtists.map((similar, idx) => (
                          <motion.div
                            key={similar.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="group cursor-pointer text-center"
                            onClick={() => onArtistClick(similar)}
                          >
                            <div className="w-full aspect-square rounded-full overflow-hidden mb-2 bg-muted ring-1 ring-white/10 group-hover:ring-white/30 transition-all duration-300 group-hover:scale-105">
                              {similar.image ? (
                                <img src={similar.image} alt={similar.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center"
                                  style={{ background: `linear-gradient(135deg, hsl(${similar.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360}, 70%, 50%), hsl(${(similar.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 3) % 360}, 60%, 40%))` }}>
                                  <span className="text-white font-bold text-xl">{similar.name.charAt(0).toUpperCase()}</span>
                                </div>
                              )}
                            </div>
                            <p className="text-sm font-medium truncate group-hover:text-white transition-colors">{similar.name}</p>
                            {similar.alias && <p className="text-xs text-muted-foreground truncate">{similar.alias}</p>}
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16">
                      <Users className="w-12 h-12 mb-3" style={{ color: 'var(--muted-foreground)' }} />
                      <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>暂无其他歌手推荐</p>
                    </div>
                  )}
                </motion.div>
              )}
            </>
          )}
        </AnimatePresence>
      </div>

      {mvPlayerOpen && currentMv && (
        <MvPlayer
          isOpen={mvPlayerOpen}
          onClose={() => setMvPlayerOpen(false)}
          mvUrl={currentMv.url}
          title={currentMv.title}
          artist={currentMv.artist}
          cover={currentMv.cover}
        />
      )}
    </div>
  );
}
