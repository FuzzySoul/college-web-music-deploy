'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Search, ChevronRight, Heart, Play, ListPlus, Loader2 } from 'lucide-react';
import { Sidebar } from '@/components/music/Sidebar';
import { AudioVisualizer } from '@/components/music/AudioVisualizer';
import { MusicPlayer } from '@/components/music/MusicPlayer';
import { MvPlayer } from '@/components/music/MvPlayer';
import { LocalTrack } from '@/components/music/MusicImporter';
import { PlaylistManager, AddToPlaylistModal, Playlist } from '@/components/music/PlaylistManager';
import { SongCommentPanel } from '@/components/music/SongCommentPanel';
import { musicService, Track } from '@/lib/music-service';
import { usePlaylistStore } from '@/components/music/stores/usePlaylistStore';
import type { CurrentUser } from '@/types/comment';
import { PlayerContext } from './context/PlayerContext';
import { getBrowserClient, resetBrowserClient } from '@/lib/supabase-browser';
import { PlaylistGradientProvider, usePlaylistGradient } from './context/PlaylistGradientContext';
import { TrackRow } from './components/TrackRow';
import { TopBar } from '@/components/music/TopBar';
import { PUBLIC_CACHE_API_URL } from '@/lib/public-env';

const formatDuration = (seconds: number): string => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

function fisherYatesShuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  // 从路径获取当前 tab
  const getTabFromPath = (path: string): string => {
    const pathToTab: Record<string, string> = {
      '/home/explore': 'explore-music',
      '/home/import': 'import',
      '/home/favorites': 'favorites',
      '/home/playlists': 'playlists',
      '/home/artists': 'artists',
      '/home/albums': 'albums',
      '/home/rhythm': 'rhythm-games',
      '/home/aggregation': 'music-aggregation',
      '/home/stats': 'stats',
      '/home/local-music': 'local-music',
      '/home/profile': 'profile',
    };
    return pathToTab[path] || 'explore-music';
  };

  const [activeTab, setActiveTab] = useState(getTabFromPath(pathname));

  // 路由变化时同步 activeTab，避免侧栏出现两个选中态
  useEffect(() => {
    setActiveTab(getTabFromPath(pathname));
  }, [pathname]);

  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [localTracks, setLocalTracks] = useState<LocalTrack[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchMode, setSearchMode] = useState<'database' | 'crawler'>('database');
  const [favorites, setFavorites] = useState<(number | string)[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);
  const [selectedTrackId, setSelectedTrackId] = useState<number | null>(null);
  const [artists, setArtists] = useState<any[]>([]);
  const [albums, setAlbums] = useState<any[]>([]);
  const [playbackMode, setPlaybackMode] = useState<'all' | 'external' | 'playlist'>('all');
  const [currentQueueIndex, setCurrentQueueIndex] = useState(-1);
  const [playlistQueue, setPlaylistQueue] = useState<Track[]>([]);
  const [shuffleMode, setShuffleMode] = useState(false);
  const [isPlaylistPlaying, setIsPlaylistPlaying] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [songCommentTarget, setSongCommentTarget] = useState<{ trackId: number | string; title: string; artist: string } | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [mvTrack, setMvTrack] = useState<Track | null>(null);
  const searchRef = useRef<AbortController | null>(null);

  const allTracks: Track[] = useMemo(() => [
    ...tracks,
    ...localTracks.map((lt, idx) => ({
      id: -1 - idx,
      title: lt.title,
      artist: lt.artist,
      album: lt.album,
      cover: lt.cover,
      duration: lt.duration,
      source: 'local' as const,
      source_id: lt.id,
      play_url: lt.objectUrl,
      lyrics: null,
      mv_url: null,
      mv_cover: null,
      created_at: '',
    }))
  ], [tracks, localTracks]);

  // 从 localStorage 加载数据
  useEffect(() => {
    const savedTracks = localStorage.getItem('localTracks');
    if (savedTracks) {
      try {
        setLocalTracks(JSON.parse(savedTracks));
      } catch (e) {
        console.error('加载本地音乐失败:', e);
      }
    }

    const savedFavorites = localStorage.getItem('favorites');
    if (savedFavorites) {
      try {
        setFavorites(JSON.parse(savedFavorites));
      } catch (e) {
        console.error('加载收藏失败:', e);
      }
    }

    const savedPlaylists = localStorage.getItem('playlists');
    if (savedPlaylists) {
      try {
        setPlaylists(JSON.parse(savedPlaylists));
      } catch (e) {
        console.error('加载歌单失败:', e);
      }
    }
  }, []);

  // 初始化主题（从Sidebar提升上来，统一管理）
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const initialDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
      setIsDark(initialDark);
      document.documentElement.classList.toggle('dark', initialDark);
    } catch {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDark(prefersDark);
      document.documentElement.classList.toggle('dark', prefersDark);
    }
  }, []);

  const toggleDarkMode = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    document.documentElement.classList.toggle('dark', newDark);
    try { localStorage.setItem('theme', newDark ? 'dark' : 'light'); } catch {}
  };

  const handleLogout = async () => {
    try {
      const supabase = getBrowserClient();
      await supabase.auth.signOut();
      setCurrentUser(null);
      setFavorites([]);
      resetBrowserClient(); // 重置客户端，确保下次创建新实例
      router.push('/login');
    } catch (error) {
      console.error('退出登录失败:', error);
    }
  };

  // 获取当前登录用户（使用统一的浏览器端客户端单例）
  useEffect(() => {
    const supabase = getBrowserClient();
    let retryCount = 0;
    const maxRetries = 3;
    let isAborted = false;

    const getCurrentUser = async () => {
      if (isAborted) return;
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.warn('[Auth] getSession error:', sessionError.message);
        }
        const user = session?.user;
        if (user) {
          const { data: dbUser, error: dbError } = await supabase
            .from('users')
            .select('username, email, avatar_url')
            .eq('id', user.id)
            .single();
          if (dbError && dbError.code !== 'PGRST116') {
            console.warn('[Auth] DB user query error:', dbError.message);
          }
          setCurrentUser({
            id: user.id,
            username: dbUser?.username || user.user_metadata?.username || user.email?.split('@')[0] || '用户',
            email: dbUser?.email || user.email || undefined,
            avatar: dbUser?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.avatar || undefined,
          });
          // 从 DB 同步收藏（覆盖 localStorage），保证跨设备/清缓存后仍能看到
          musicService.getFavorites(user.id).then(tracks => {
            setFavorites(tracks.map(t => t.id));
          }).catch(console.error);
          retryCount = 0; // 成功获取后重置重试计数
        } else {
          // session 为 null，可能是刚登录后 session 还没写入 localStorage
          // 添加延迟重试机制
          if (retryCount < maxRetries) {
            retryCount++;
            console.log(`[Auth] Session not found, retrying ${retryCount}/${maxRetries} in 500ms...`);
            setTimeout(getCurrentUser, 500);
            return;
          }
          setCurrentUser(null);
        }
      } catch (error) {
        // 关键修复：AbortError 是请求中断的正常情况，延迟重试而不是清空用户状态
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('[Auth] getCurrentUser aborted (normal during Fast Refresh), will retry...');
          if (retryCount < maxRetries) {
            retryCount++;
            setTimeout(getCurrentUser, 300);
          }
          return;
        }
        console.error('获取当前用户失败:', error);
        setCurrentUser(null);
      } finally {
        setAuthReady(true);
      }
    };

    getCurrentUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[Auth] onAuthStateChange:', event, session?.user?.id);
      if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setFavorites([]);
        return;
      }
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        if (session?.user) {
          supabase
            .from('users')
            .select('username, email, avatar_url')
            .eq('id', session.user.id)
            .single()
            .then(({ data: dbUser }) => {
              setCurrentUser({
                id: session.user.id,
                username: dbUser?.username || session.user.user_metadata?.username || session.user.email?.split('@')[0] || '用户',
                email: dbUser?.email || session.user.email || undefined,
                avatar: dbUser?.avatar_url || session.user.user_metadata?.avatar_url || session.user.user_metadata?.avatar || undefined,
              });
              // 登录态变化时也同步 DB 收藏
              musicService.getFavorites(session.user.id).then(tracks => {
                setFavorites(tracks.map(t => t.id));
              }).catch(console.error);
            });
        }
        return;
      }
      if (event === 'TOKEN_REFRESHED') return;
      if (event === 'INITIAL_SESSION') {
        // 初始 session 为 null，不做处理（已由 getCurrentUser 处理）
      }
    });

    return () => {
      isAborted = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    try {
      const slim = localTracks.map(({ objectUrl, file, ...rest }) => rest);
      const json = JSON.stringify(slim);
      if (json.length < 500 * 1024) {
        localStorage.setItem('localTracks', json);
      }
    } catch (e) {
      console.warn('[HomeLayout] 本地音乐缓存失败，已跳过');
    }
  }, [localTracks]);

  useEffect(() => {
    try {
      localStorage.setItem('favorites', JSON.stringify(favorites));
    } catch (e) {
      console.warn('[HomeLayout] 收藏数据过大，跳过 localStorage 缓存');
    }
  }, [favorites]);

  useEffect(() => {
    try {
      const slim = playlists.map(({ id, name, cover, platformSource, externalPlaylistId, trackCount }) => ({
        id, name, cover, platformSource, externalPlaylistId, trackCount
      }));
      const json = JSON.stringify(slim);
      if (json.length < 500 * 1024) {
        localStorage.setItem('playlists', json);
      }
    } catch (e) {
      console.warn('[HomeLayout] 歌单缓存失败，已跳过');
    }
  }, [playlists]);

  useEffect(() => {
    const loadTracks = async () => {
      try {
        const dbTracks = await musicService.getTracks(50);
        setTracks(dbTracks.length > 0 ? dbTracks : []);
      } catch (error) {
        console.error('加载歌曲失败:', error);
        setTracks([]);
      }
    };
    loadTracks();
  }, []);

  const loadArtistsAndAlbums = useCallback(async () => {
    try {
      const response = await fetch('/api/music/sync-artists');
      if (response.ok) {
        const data = await response.json();
        setArtists(data.artists || []);
        setAlbums(data.albums || []);
      }
    } catch (error) {
      console.error('加载歌手和专辑失败:', error);
    }
  }, []);

  useEffect(() => {
    loadArtistsAndAlbums();
  }, [loadArtistsAndAlbums]);

  useEffect(() => {
    fetch('/api/music/sync-playlists')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        const all: Playlist[] = [];
        if (data.localPlaylists?.length) {
          all.push(...data.localPlaylists.map((p: any) => ({
            id: String(p.id), name: p.name, description: p.description || '',
            cover: p.cover, trackIds: [], createdAt: p.created_at,
            platformSource: p.platform_source || 'local',
            externalPlaylistId: String(p.external_playlist_id || ''),
            trackCount: p.track_count || 0,
          })));
        }
        if (data.externalPlaylists?.length) {
          all.push(...data.externalPlaylists.map((p: any) => ({
            id: `external-${p.id}`, name: p.name, description: '',
            cover: p.cover_url, trackIds: [], createdAt: p.created_at,
            platformSource: 'netease', externalPlaylistId: String(p.id),
            platformPlaylistId: p.platform_playlist_id,
            trackCount: p.track_count || 0,
          })));
        }
        if (all.length > 0) setPlaylists(all);
      })
      .catch(() => {});
  }, []);

  // 缓存有效期：4小时（YouTube/Bilibili直链通常只有2-6小时有效期）
  const CACHE_DURATION = 4 * 60 * 60 * 1000;
  const CACHE_MAX_SIZE = 1024 * 1024;

  // 安全写入 trackUrlCache，超过 1MB 时淘汰最旧 20% 条目
  const saveTrackUrlCache = (key: string, entry: { url: string; thumbnail?: string; source?: string; timestamp: number }) => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('trackUrlCache');
      const cacheObj: Record<string, { url: string; thumbnail?: string; source?: string; timestamp: number }> = raw ? JSON.parse(raw) : {};
      cacheObj[key] = entry;
      let json = JSON.stringify(cacheObj);
      if (json.length > CACHE_MAX_SIZE) {
        const entries = Object.entries(cacheObj).sort(([, a], [, b]) => a.timestamp - b.timestamp);
        const removeCount = Math.ceil(entries.length * 0.2);
        entries.slice(0, removeCount).forEach(([k]) => { delete cacheObj[k]; });
        json = JSON.stringify(cacheObj);
      }
      localStorage.setItem('trackUrlCache', json);
    } catch {}
  };

  // 根据搜索配置确定缓存源类型
  const getCacheSourceType = (youtubeCount: number, bilibiliCount: number): string => {
    if (youtubeCount > 0 && bilibiliCount > 0) return 'mixed';
    if (bilibiliCount > 0) return 'bilibili';
    return 'youtube';
  };

  // 生成缓存 key（包含播放源信息）
  const generateCacheKey = (title: string, artist: string, sourceType: string): string => {
    return `${title}___${artist}___${sourceType}`;
  };

  // 从缓存获取URL的辅助函数（支持播放源参数）
  const getCachedUrlFromLayout = (
    title: string,
    artist: string,
    youtubeCount: number = 1,
    bilibiliCount: number = 0
  ): { url: string; thumbnail?: string; source?: string } | null => {
    if (typeof window === 'undefined') return null;
    try {
      const cache = localStorage.getItem('trackUrlCache');
      if (!cache) return null;
      const cacheObj = JSON.parse(cache);

      // 使用带源信息的 key 查询
      const sourceType = getCacheSourceType(youtubeCount, bilibiliCount);
      const key = generateCacheKey(title, artist, sourceType);
      const cached = cacheObj[key];
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return { url: cached.url, thumbnail: cached.thumbnail, source: cached.source };
      }

      // 向后兼容：尝试旧格式缓存
      const oldKey = `${title}___${artist}`;
      const oldCached = cacheObj[oldKey];
      if (oldCached && Date.now() - oldCached.timestamp < CACHE_DURATION) {
        return { url: oldCached.url, thumbnail: oldCached.thumbnail, source: oldCached.source };
      }

      return null;
    } catch {
      return null;
    }
  };

  // 执行预加载的函数 - 完整的预加载逻辑，不依赖 usePlaylistTrackHandlers
  const executePreload = useCallback(async () => {
    const store = usePlaylistStore.getState();

    // 随机播放模式下使用 shuffledQueue，否则使用 fullTracksList
    const isShuffle = store.isShuffleMode;
    const tracks = isShuffle && store.shuffledQueue.length > 0
      ? store.shuffledQueue
      : store.fullTracksList;

    // 严格的并发控制检查
    if (tracks.length === 0) {
      console.log('[Layout Preload] No tracks to preload');
      return;
    }

    if (store.isPreloading) {
      console.log('[Layout Preload] Already in progress, skipping');
      return;
    }

    // 原子操作：立即设置 isPreloading 为 true，防止其他调用
    usePlaylistStore.setState({ isPreloading: true });

    const startIdx = store.currentBatchIndex * store.preloadBatchSize;
    if (startIdx >= tracks.length) return;

    const endIdx = Math.min(startIdx + store.preloadBatchSize, tracks.length);
    const batchToPreload = tracks.slice(startIdx, endIdx).filter(
      t => !store.preloadedTrackIds.has(t.id)
    );

    if (batchToPreload.length === 0) {
      // 使用函数式更新确保获取最新状态
      usePlaylistStore.setState((state) => ({
        isPreloading: false,
        currentBatchIndex: state.currentBatchIndex + 1
      }));
      console.log('[Layout] Batch already preloaded, skipping to next batch');
      return;
    }

    // 获取当前搜索配置
    const youtubeCount = store.youtubeCount ?? 1;
    const bilibiliCount = store.bilibiliCount ?? 0;
    const sourceType = getCacheSourceType(youtubeCount, bilibiliCount);

    console.log('[Layout] Starting preload batch:', {
      startIdx,
      endIdx,
      batchSize: batchToPreload.length,
      youtubeCount,
      bilibiliCount,
      sourceType
    });

    // isPreloading 已在函数开始时设置
    const controller = new AbortController();
    const concurrency = Math.min(3, batchToPreload.length);

    for (let i = 0; i < batchToPreload.length; i += concurrency) {
      if (controller.signal.aborted) break;

      const batch = batchToPreload.slice(i, i + concurrency);

      await Promise.allSettled(
        batch.map(async (track) => {
          try {
            // 先检查缓存（传入搜索配置）
            const cached = getCachedUrlFromLayout(track.track_title, track.track_artist, youtubeCount, bilibiliCount);
            if (cached) {
              console.log('[Layout Preload] 命中缓存:', track.track_title, 'source:', cached.source);
              usePlaylistStore.getState().addPreloadedTrackId(track.id);
              return;
            }

            // 没有缓存则请求API
            const response = await fetch('/api/music/ytdlp', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'createSearchTask',
                trackTitle: track.track_title,
                trackArtist: track.track_artist,
                youtubeCount,
                bilibiliCount,
              }),
              signal: controller.signal,
            });

            const data = await response.json();

            if (data.taskId) {
              let attempts = 0;
              const maxAttempts = 30;

              while (attempts < maxAttempts && !controller.signal.aborted) {
                const statusResponse = await fetch('/api/music/ytdlp', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action: 'getTaskStatus',
                    taskId: data.taskId,
                  }),
                  signal: controller.signal,
                });

                const statusData = await statusResponse.json();

                if (statusData.status === 'completed' && statusData.results && statusData.results.length > 0) {
                  const result = statusData.results[0];

                  const urlResponse = await fetch('/api/music/ytdlp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      action: 'getUrl',
                      songId: result.id,
                      source: result.source,
                      directUrl: result.url,
                    }),
                    signal: controller.signal,
                  });

                  const urlData = await urlResponse.json();

                  if (urlData.success && urlData.url) {
                    try {
                      const key = generateCacheKey(track.track_title, track.track_artist, sourceType);
                      saveTrackUrlCache(key, {
                        url: urlData.url,
                        thumbnail: result.thumbnail,
                        source: result.source,
                        timestamp: Date.now(),
                      });
                      console.log('[Layout Preload] 已保存缓存:', track.track_title, 'source:', result.source, 'key:', key);
                    } catch (e) {
                      console.error('Failed to save to cache:', e);
                    }

                    usePlaylistStore.getState().addPreloadedTrackId(track.id);
                  }
                  break;
                } else if (statusData.status === 'failed') {
                  break;
                }

                await new Promise(resolve => setTimeout(resolve, 1000));
                attempts++;
              }
            }
          } catch (error) {
            if ((error as Error).name !== 'AbortError') {
              console.error('Preload error:', error);
            }
          }
        })
      );

      // 批次间隔
      if (i + concurrency < batchToPreload.length && !controller.signal.aborted) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // 使用函数式更新确保获取最新状态
    usePlaylistStore.setState((state) => ({
      isPreloading: false,
      currentBatchIndex: state.currentBatchIndex + 1
    }));

    console.log('[Layout] Preload batch completed');
  }, []);

  // 主动触发预加载检查的辅助函数
  const triggerPreloadCheck = useCallback(() => {
    const store = usePlaylistStore.getState();

    // 随机播放模式下使用 shuffledQueue，否则使用 fullTracksList
    const isShuffle = store.isShuffleMode;
    const tracks = isShuffle && store.shuffledQueue.length > 0
      ? store.shuffledQueue
      : store.fullTracksList;

    if (!isPlaying || tracks.length === 0) return;

    const totalTracks = tracks.length;
    const preloadedCount = store.preloadedTrackIds.size;
    const threshold = 3;

    // 使用 store 中的 currentTrackId 来确定当前播放位置
    let currentIndex = -1;
    if (store.currentTrackId) {
      currentIndex = tracks.findIndex((t) => String(t.id) === String(store.currentTrackId));
    }

    // 如果找不到当前播放位置，从第0首开始
    if (currentIndex === -1) {
      currentIndex = 0;
    }

    // 计算从当前播放位置往后，还有多少首已经预加载的歌曲
    let preloadedAfterCurrent = 0;
    for (let i = currentIndex + 1; i < tracks.length; i++) {
      if (store.preloadedTrackIds.has(tracks[i].id)) {
        preloadedAfterCurrent++;
      }
    }

    // 如果当前播放位置之后的预加载歌曲少于阈值，且还有歌曲未预加载，则触发预加载
    const remainingToPreload = totalTracks - preloadedCount;

    console.log('[Layout Preload Check]', {
      isShuffle,
      currentIndex,
      preloadedAfterCurrent,
      threshold,
      remainingToPreload,
      shouldTrigger: preloadedAfterCurrent <= threshold && remainingToPreload > 0 && !store.isPreloading
    });

    if (preloadedAfterCurrent <= threshold && remainingToPreload > 0 && !store.isPreloading) {
      console.log('[Layout] Triggering preload from layout');
      executePreload();
    }
  }, [isPlaying, executePreload]);

  // 全局预加载定时器 - 确保离开歌单详情页后预加载仍然继续
  useEffect(() => {
    // 立即检查一次
    triggerPreloadCheck();

    // 设置定时器定期检查预加载状态
    const intervalId = setInterval(() => {
      triggerPreloadCheck();
    }, 5000);

    return () => clearInterval(intervalId);
  }, [triggerPreloadCheck]);

  const handlePlay = async (track: Track) => {
    if (currentTrack?.id === track.id) {
      setIsPlaying(!isPlaying);
      return;
    }

    // 更新 store 的当前播放歌曲ID
    usePlaylistStore.setState({ currentTrackId: String(track.id) });

    // 延迟触发预加载检查
    setTimeout(() => {
      triggerPreloadCheck();
    }, 500);

    let trackToPlay = track;

    // 获取当前搜索配置
    const store = usePlaylistStore.getState();
    const youtubeCount = store.youtubeCount ?? 1;
    const bilibiliCount = store.bilibiliCount ?? 0;
    const sourceType = getCacheSourceType(youtubeCount, bilibiliCount);

    if (!track.play_url || track.play_url === '') {
      // 使用带搜索配置的缓存查询
      const cached = getCachedUrlFromLayout(track.title, track.artist, youtubeCount, bilibiliCount);
      if (cached) {
        console.log('[handlePlay] 命中缓存:', track.title, 'source:', cached.source);
        trackToPlay = {
          ...track,
          play_url: cached.url,
          cover: cached.thumbnail || track.cover,
        };
      } else {
        try {
          console.log('[handlePlay] 未命中缓存，开始搜索:', track.title, 'youtubeCount:', youtubeCount, 'bilibiliCount:', bilibiliCount);
          const response = await fetch('/api/music/ytdlp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'createSearchTask',
              trackTitle: track.title,
              trackArtist: track.artist,
              youtubeCount,
              bilibiliCount,
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
                body: JSON.stringify({
                  action: 'getTaskStatus',
                  taskId: data.taskId,
                }),
              });

              const statusData = await statusResponse.json();

              if (statusData.status === 'completed' && statusData.results && statusData.results.length > 0) {
                const result = statusData.results[0];

                const urlResponse = await fetch('/api/music/ytdlp', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action: 'getUrl',
                    songId: result.id,
                    source: result.source,
                    directUrl: result.url,
                  }),
                });

                const urlData = await urlResponse.json();

                if (urlData.success && urlData.url) {
                  trackToPlay = {
                    ...track,
                    play_url: urlData.url,
                    cover: result.thumbnail || track.cover,
                  };

                  // 保存到缓存（使用带源信息的 key）
                  try {
                    const key = generateCacheKey(track.title, track.artist, sourceType);
                    saveTrackUrlCache(key, {
                      url: urlData.url,
                      thumbnail: result.thumbnail,
                      source: result.source,
                      timestamp: Date.now(),
                    });
                    console.log('[handlePlay] 已保存缓存:', track.title, 'source:', result.source, 'key:', key);
                  } catch (e) {
                    console.error('Failed to save to cache:', e);
                  }
                }
                break;
              } else if (statusData.status === 'failed') {
                break;
              }

              await new Promise(resolve => setTimeout(resolve, 1000));
              attempts++;
            }
          }
        } catch (error) {
          console.error('获取播放链接失败:', error);
        }
      }
    }

    setCurrentTrack(trackToPlay);
    setIsPlaying(true);
    musicService.addPlayHistory(trackToPlay.id).catch(console.error);
  };

  const handleToggleFavorite = async (track: Track) => {
    const newFavorites = favorites.includes(track.id)
      ? favorites.filter(id => id !== track.id)
      : [...favorites, track.id];
    setFavorites(newFavorites);
    // 必须传 userId，否则 favorites.user_id (NOT NULL) 约束会拒绝写入
    await musicService.toggleFavorite(track.id, currentUser?.id).catch(console.error);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    // 客户端过滤（即时）
    const clientResults = allTracks.filter(t =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.album && t.album.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    setSearchResults(clientResults);
    // 服务端搜索：本地tracks + 外部歌单tracks
    setSearchLoading(true);
    try {
      const [localRes, externalRes] = await Promise.all([
        fetch(`${PUBLIC_CACHE_API_URL}/api/cache/tracks?limit=20&search=${encodeURIComponent(searchQuery)}`),
        fetch(`${PUBLIC_CACHE_API_URL}/api/cache/external-tracks/search?q=${encodeURIComponent(searchQuery)}`),
      ]);

      const existingIds = new Set<number | string>(clientResults.map(t => t.id));
      const merged = [...clientResults];

      if (localRes.ok) {
        const serverTracks: Track[] = await localRes.json();
        if (Array.isArray(serverTracks)) {
          for (const st of serverTracks) {
            if (!existingIds.has(st.id)) {
              merged.push(st);
              existingIds.add(st.id);
            }
          }
        }
      }

      if (externalRes.ok) {
        const extTracks: any[] = await externalRes.json();
        if (Array.isArray(extTracks)) {
          for (const et of extTracks) {
            const fakeId = `ext-${et.id}`;
            if (!existingIds.has(fakeId)) {
              merged.push({
                id: fakeId as any,
                title: et.track_title || '未知歌曲',
                artist: et.track_artist || '未知',
                album: null,
                cover: null,
                duration: et.track_duration || 0,
                source: 'netease',
                source_id: et.platform_track_id || String(et.id),
                play_url: null,
                lyrics: null,
                mv_url: null,
                mv_cover: null,
                created_at: '',
              });
              existingIds.add(fakeId);
            }
          }
        }
      }

      setSearchResults(merged);
    } catch (e) {
      console.error('服务器搜索失败:', e);
    } finally {
      setSearchLoading(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchLoading(false);
  };

  const openAddToPlaylistModal = (trackId: number) => {
    setSelectedTrackId(trackId);
    setShowAddToPlaylist(true);
  };

  const handleAddToPlaylist = (playlistId: string) => {
    if (selectedTrackId) {
      setPlaylists(prev => prev.map(p =>
        p.id === playlistId && !p.trackIds.includes(selectedTrackId)
          ? { ...p, trackIds: [...p.trackIds, selectedTrackId] }
          : p
      ));
    }
  };

  const handleCreateAndAddToPlaylist = (name: string) => {
    const newPlaylist: Playlist = {
      id: `playlist-${Date.now()}`,
      name,
      description: '',
      cover: null,
      trackIds: selectedTrackId ? [selectedTrackId] : [],
      createdAt: new Date().toISOString(),
    };
    setPlaylists(prev => [...prev, newPlaylist]);
  };

  const handleTabChange = (tab: string) => {
    searchRef.current?.abort();
    setActiveTab(tab);
    setSearchQuery('');
    setSearchResults([]);
    setSearchLoading(false);

    const tabToPath: Record<string, string> = {
      'explore-music': '/home/explore',
      'import': '/home/import',
      'favorites': '/home/favorites',
      'playlists': '/home/playlists',
      'artists': '/home/artists',
      'albums': '/home/albums',
      'rhythm-games': '/home/rhythm',
      'music-aggregation': '/home/aggregation',
      'profile': '/home/profile',
      'stats': '/home/stats',
      'local-music': '/home/local-music',
    };

    const path = tabToPath[tab];
    if (path) {
      router.push(path);
    }
  };

  // 根据模式执行搜索
  async function runSearch(query: string, mode: 'database' | 'crawler') {
    if (!query.trim()) return;
    searchRef.current?.abort();
    const controller = new AbortController();
    searchRef.current = controller;

    setSearchLoading(true);
    setSearchMode(mode);

    if (mode === 'database') {
      // 客户端过滤即时反馈
      const clientResults = allTracks.filter(t =>
        t.title.toLowerCase().includes(query.toLowerCase()) ||
        t.artist.toLowerCase().includes(query.toLowerCase()) ||
        (t.album && t.album.toLowerCase().includes(query.toLowerCase()))
      );
      if (!controller.signal.aborted) setSearchResults(clientResults);

      try {
        const [localRes, externalRes] = await Promise.all([
          fetch(`${PUBLIC_CACHE_API_URL}/api/cache/tracks?limit=20&search=${encodeURIComponent(query)}`),
          fetch(`${PUBLIC_CACHE_API_URL}/api/cache/external-tracks/search?q=${encodeURIComponent(query)}`),
        ]);

        if (controller.signal.aborted) return;

        const existingIds = new Set<number | string>(clientResults.map(t => t.id));
        const merged = [...clientResults];

        if (localRes.ok) {
          const serverTracks: Track[] = await localRes.json();
          if (Array.isArray(serverTracks)) {
            for (const st of serverTracks) {
              if (!existingIds.has(st.id)) { merged.push(st); existingIds.add(st.id); }
            }
          }
        }

        if (externalRes.ok) {
          const extTracks: any[] = await externalRes.json();
          if (Array.isArray(extTracks)) {
            for (const et of extTracks) {
              const fakeId = `ext-${et.id}`;
              if (!existingIds.has(fakeId)) {
                merged.push({
                  id: fakeId as any,
                  title: et.track_title || '未知歌曲', artist: et.track_artist || '未知',
                  album: null, cover: null, duration: et.track_duration || 0,
                  source: 'netease', source_id: et.platform_track_id || String(et.id),
                  play_url: null, lyrics: null, mv_url: null, mv_cover: null, created_at: '',
                });
                existingIds.add(fakeId);
              }
            }
          }
        }

        if (!controller.signal.aborted) setSearchResults(merged);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') console.error('数据库搜索失败:', e);
      }
    } else {
      // 爬虫模式 — yt-dlp SSE 流式搜索
      setSearchResults([]);
      try {
        const ytRes = await fetch(`/api/music/ytdlp?q=${encodeURIComponent(query)}&youtube_count=3&bilibili_count=2`, {
          signal: controller.signal,
          headers: { 'Accept': 'text/event-stream' },
        });
        if (!ytRes.ok) throw new Error(`HTTP ${ytRes.status}`);

        const reader = ytRes.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) throw new Error('No response body');

        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'source_done' || data.type === 'complete') {
                  const ytResults = (data.results || []).map((r: any) => ({
                    id: `yt-${r.id}`,
                    title: r.title || '未知', artist: r.artist || '未知',
                    album: null, cover: r.thumbnail || null, duration: r.duration || 0,
                    source: (r.source === 'Bilibili' ? 'bilibili' : 'youtube') as 'youtube' | 'bilibili',
                    source_id: r.id, play_url: r.url || null,
                    lyrics: null, mv_url: null, mv_cover: null, created_at: '',
                  }));
                  if (!controller.signal.aborted) {
                    setSearchResults(prev => {
                      const ids = new Set(prev.map(t => t.id));
                      const next = [...prev];
                      for (const yt of ytResults) { if (!ids.has(yt.id)) { next.push(yt); ids.add(yt.id); } }
                      return next;
                    });
                  }
                  if (data.type === 'complete') { if (!controller.signal.aborted) setSearchLoading(false); return; }
                }
              } catch {}
            }
          }
        }
      } catch (e) {
        if ((e as Error).name !== 'AbortError') console.error('爬虫搜索失败:', e);
      }
    }

    if (!controller.signal.aborted) setSearchLoading(false);
  }

  // 播放队列相关
  const handleShuffleNext = async () => {
    if (playlistQueue.length <= 1) return;

    const store = usePlaylistStore.getState();

    // 使用 store 的随机播放逻辑获取下一首
    const nextTrack = store.getNextShuffleTrack();
    if (!nextTrack) return;

    // 转换为 Track 类型
    const trackToPlay: Track = {
      id: parseInt(nextTrack.platform_track_id) || Date.now(),
      title: nextTrack.track_title,
      artist: nextTrack.track_artist,
      album: '',
      cover: nextTrack.thumbnail || '',
      duration: nextTrack.track_duration,
      source: (nextTrack.source || 'external') as 'external',
      source_id: nextTrack.platform_track_id,
      play_url: nextTrack.play_url || '',
      lyrics: null,
      mv_url: null,
      mv_cover: null,
      created_at: new Date().toISOString(),
    };

    // 更新 store 状态
    usePlaylistStore.setState({
      currentTrackId: nextTrack.id,
    });
    usePlaylistStore.getState().addPlayedTrackId(nextTrack.id);

    const newIndex = playlistQueue.findIndex(t => t.id === trackToPlay.id);
    if (newIndex >= 0) {
      setCurrentQueueIndex(newIndex);
    }

    await handlePlay(trackToPlay);
    // 主动触发预加载检查
    setTimeout(() => triggerPreloadCheck(), 500);
  };

  const handleShufflePrevious = async () => {
    if (playlistQueue.length <= 1) return;

    const store = usePlaylistStore.getState();

    // 使用 store 的随机播放逻辑获取上一首（实际上也是随机选择一首未播放的）
    const prevTrack = store.getNextShuffleTrack();
    if (!prevTrack) return;

    // 转换为 Track 类型
    const trackToPlay: Track = {
      id: parseInt(prevTrack.platform_track_id) || Date.now(),
      title: prevTrack.track_title,
      artist: prevTrack.track_artist,
      album: '',
      cover: prevTrack.thumbnail || '',
      duration: prevTrack.track_duration,
      source: (prevTrack.source || 'external') as 'external',
      source_id: prevTrack.platform_track_id,
      play_url: prevTrack.play_url || '',
      lyrics: null,
      mv_url: null,
      mv_cover: null,
      created_at: new Date().toISOString(),
    };

    // 更新 store 状态
    usePlaylistStore.setState({
      currentTrackId: prevTrack.id,
    });
    usePlaylistStore.getState().addPlayedTrackId(prevTrack.id);

    const newIndex = playlistQueue.findIndex(t => t.id === trackToPlay.id);
    if (newIndex >= 0) {
      setCurrentQueueIndex(newIndex);
    }

    await handlePlay(trackToPlay);
    // 主动触发预加载检查
    setTimeout(() => triggerPreloadCheck(), 500);
  };

  const handlePlayPlaylistQueue = async (tracks: Track[], startIndex: number = 0, shouldShuffle: boolean = false) => {
    console.log('[handlePlayPlaylistQueue] tracks:', tracks);
    console.log('[handlePlayPlaylistQueue] tracks[0]:', tracks[0]);
    console.log('[handlePlayPlaylistQueue] shouldShuffle:', shouldShuffle);

    if (tracks.length === 0) return;

    const queue = shouldShuffle ? fisherYatesShuffle(tracks) : tracks;
    const actualStartIndex = shouldShuffle ? 0 : startIndex;

    console.log('[handlePlayPlaylistQueue] queue[actualStartIndex]:', queue[actualStartIndex]);

    setPlaylistQueue(queue);
    setCurrentQueueIndex(actualStartIndex);
    setPlaybackMode('playlist');
    setIsPlaylistPlaying(true);
    setShuffleMode(shouldShuffle);

    const trackToPlay = queue[actualStartIndex];

    // 转换 Track[] 为 ExternalPlaylistTrack[] 存储到 store
    const externalTracks = tracks.map((t, idx) => ({
      id: String(t.id),
      platform_track_id: String(t.id),
      track_title: t.title,
      track_artist: t.artist,
      track_duration: t.duration,
      thumbnail: t.cover || undefined,
      play_url: t.play_url || undefined,
      source: t.source,
      position: idx,
    }));

    // 更新 store 状态以支持预加载和随机播放
    const trackToPlayId = String(trackToPlay.id);
    usePlaylistStore.setState({
      currentTrackId: trackToPlayId,
      isShuffleMode: shouldShuffle,
      playedTrackIds: new Set([trackToPlayId]),
      // 重置预加载状态，从头开始预加载
      currentBatchIndex: 0,
      preloadedTrackIds: new Set(),
      isPreloading: false,
      fullTracksList: externalTracks,
      shuffledQueue: shouldShuffle ? externalTracks : externalTracks,
    });

    if (trackToPlay.play_url && trackToPlay.play_url !== '') {
      setCurrentTrack(trackToPlay);
      setIsPlaying(true);
    } else {
      await handlePlay(trackToPlay);
    }

    // 延迟后开始预加载
    setTimeout(() => {
      triggerPreloadCheck();
    }, 1000);
  };

  const handleToggleShuffle = () => {
    const newShuffleMode = !shuffleMode;
    setShuffleMode(newShuffleMode);

    // 更新 store 状态
    usePlaylistStore.setState({ isShuffleMode: newShuffleMode });

    if (newShuffleMode && playlistQueue.length > 0 && isPlaylistPlaying) {
      // 开启随机播放：重新排序队列，但保持当前歌曲位置
      const currentTrackInQueue = playlistQueue[currentQueueIndex];
      const shuffled = fisherYatesShuffle(playlistQueue);
      const newCurrentIndex = shuffled.findIndex(t => t.id === currentTrackInQueue?.id);
      setPlaylistQueue(shuffled);
      setCurrentQueueIndex(newCurrentIndex >= 0 ? newCurrentIndex : 0);

      // 更新 store 的随机队列
      const externalTracks = shuffled.map((t, idx) => ({
        id: String(t.id),
        platform_track_id: String(t.id),
        track_title: t.title,
        track_artist: t.artist,
        track_duration: t.duration,
        thumbnail: t.cover || undefined,
        play_url: t.play_url || undefined,
        source: t.source,
        position: idx,
      }));
      usePlaylistStore.setState({
        shuffledQueue: externalTracks,
        playedTrackIds: new Set([String(currentTrackInQueue?.id)]),
      });
    } else if (!newShuffleMode) {
      // 关闭随机播放：恢复原始顺序（按ID排序）
      if (playlistQueue.length > 0 && currentTrack) {
        const currentTrackId = currentTrack.id;
        // 按原始ID排序恢复顺序
        const originalOrder = [...playlistQueue].sort((a, b) => a.id - b.id);
        const newCurrentIndex = originalOrder.findIndex(t => t.id === currentTrackId);
        setPlaylistQueue(originalOrder);
        setCurrentQueueIndex(newCurrentIndex >= 0 ? newCurrentIndex : 0);

        // 更新 store
        const externalTracks = originalOrder.map((t, idx) => ({
          id: String(t.id),
          platform_track_id: String(t.id),
          track_title: t.title,
          track_artist: t.artist,
          track_duration: t.duration,
          thumbnail: t.cover || undefined,
          play_url: t.play_url || undefined,
          source: t.source,
          position: idx,
        }));
        usePlaylistStore.setState({
          shuffledQueue: externalTracks,
          playedTrackIds: new Set(), // 清空已播放列表
        });
      }
    }
  };

  // 刷新当前播放歌曲的URL（用于处理缓存URL过期）
  const refreshCurrentTrackUrl = useCallback(async (): Promise<boolean> => {
    if (!currentTrack) return false;

    console.log('[refreshCurrentTrackUrl] 开始刷新当前歌曲URL:', currentTrack.title);

    // 获取当前搜索配置
    const store = usePlaylistStore.getState();
    const youtubeCount = store.youtubeCount ?? 1;
    const bilibiliCount = store.bilibiliCount ?? 0;
    const sourceType = getCacheSourceType(youtubeCount, bilibiliCount);

    try {
      // 清除所有源的缓存
      const cache = localStorage.getItem('trackUrlCache');
      if (cache) {
        const cacheObj = JSON.parse(cache);
        let cleared = false;

        // 清除所有可能的缓存 key
        const sourceTypes = ['youtube', 'bilibili', 'mixed'];
        for (const st of sourceTypes) {
          const key = generateCacheKey(currentTrack.title, currentTrack.artist, st);
          if (cacheObj[key]) {
            delete cacheObj[key];
            cleared = true;
            console.log('[refreshCurrentTrackUrl] 已清除缓存:', key);
          }
        }

        // 向后兼容：清除旧格式缓存
        const oldKey = `${currentTrack.title}___${currentTrack.artist}`;
        if (cacheObj[oldKey]) {
          delete cacheObj[oldKey];
          cleared = true;
          console.log('[refreshCurrentTrackUrl] 已清除旧格式缓存:', oldKey);
        }

        if (cleared) {
          try { localStorage.setItem('trackUrlCache', JSON.stringify(cacheObj)); } catch {}
        }
      }

      // 重新获取URL
      const response = await fetch('/api/music/ytdlp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createSearchTask',
          trackTitle: currentTrack.title,
          trackArtist: currentTrack.artist,
          youtubeCount,
          bilibiliCount,
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
            body: JSON.stringify({
              action: 'getTaskStatus',
              taskId: data.taskId,
            }),
          });

          const statusData = await statusResponse.json();

          if (statusData.status === 'completed' && statusData.results && statusData.results.length > 0) {
            const result = statusData.results[0];

            const urlResponse = await fetch('/api/music/ytdlp', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'getUrl',
                songId: result.id,
                source: result.source,
                directUrl: result.url,
              }),
            });

            const urlData = await urlResponse.json();

            if (urlData.success && urlData.url) {
              // 更新当前歌曲的URL
              const updatedTrack = {
                ...currentTrack,
                play_url: urlData.url,
                cover: result.thumbnail || currentTrack.cover,
              };

              // 保存到缓存（使用带源信息的 key）
              const cache = localStorage.getItem('trackUrlCache');
              const cacheObj = cache ? JSON.parse(cache) : {};
              const key = generateCacheKey(currentTrack.title, currentTrack.artist, sourceType);
              saveTrackUrlCache(key, {
                url: urlData.url,
                thumbnail: result.thumbnail,
                source: result.source,
                timestamp: Date.now(),
              });
              console.log('[refreshCurrentTrackUrl] URL刷新成功，已保存缓存:', key);

              setCurrentTrack(updatedTrack);
              return true;
            }
            break;
          } else if (statusData.status === 'failed') {
            console.error('[refreshCurrentTrackUrl] 任务失败');
            break;
          }

          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }
      }
    } catch (error) {
      console.error('[refreshCurrentTrackUrl] 刷新失败:', error);
    }

    return false;
  }, [currentTrack]);

  const playerContextValue = useMemo(() => ({
    currentTrack,
    setCurrentTrack,
    isPlaying,
    setIsPlaying,
    favorites,
    setFavorites,
    playlists,
    setPlaylists,
    allTracks,
    localTracks,
    setLocalTracks,
    handleToggleFavorite,
    handlePlay,
    openAddToPlaylistModal,
    playbackMode,
    setPlaybackMode,
    playlistQueue,
    setPlaylistQueue,
    currentQueueIndex,
    setCurrentQueueIndex,
    shuffleMode,
    setShuffleMode,
    isPlaylistPlaying,
    setIsPlaylistPlaying,
    handlePlayPlaylistQueue,
    handleToggleShuffle,
    refreshCurrentTrackUrl,
    currentUser,
    setCurrentUser,
    songCommentTarget,
    setSongCommentTarget,
  }), [
    currentTrack,
    isPlaying,
    favorites,
    playlists,
    allTracks,
    localTracks,
    handleToggleFavorite,
    handlePlay,
    openAddToPlaylistModal,
    playbackMode,
    playlistQueue,
    currentQueueIndex,
    shuffleMode,
    isPlaylistPlaying,
    handlePlayPlaylistQueue,
    handleToggleShuffle,
    refreshCurrentTrackUrl,
    currentUser,
    songCommentTarget,
  ]);

  // 处理下一首/上一首
  const handleNext = async () => {
    if (playbackMode === 'playlist' && playlistQueue.length > 0) {
      if (shuffleMode) {
        await handleShuffleNext();
        return;
      }
      const nextIndex = currentQueueIndex + 1;
      if (nextIndex < playlistQueue.length) {
        setCurrentQueueIndex(nextIndex);
        const nextTrack = playlistQueue[nextIndex];
        usePlaylistStore.setState({ currentTrackId: String(nextTrack.id) });
        await handlePlay(nextTrack);
        // 主动触发预加载检查
        setTimeout(() => triggerPreloadCheck(), 500);
      } else {
        setCurrentQueueIndex(0);
        const firstTrack = playlistQueue[0];
        usePlaylistStore.setState({ currentTrackId: String(firstTrack.id) });
        await handlePlay(firstTrack);
        // 主动触发预加载检查
        setTimeout(() => triggerPreloadCheck(), 500);
      }
      return;
    }
    // 默认模式
    const currentIndex = allTracks.findIndex(t => t.id === currentTrack?.id);
    if (currentIndex < allTracks.length - 1) {
      const nextTrack = allTracks[currentIndex + 1];
      usePlaylistStore.setState({ currentTrackId: String(nextTrack.id) });
      await handlePlay(nextTrack);
      // 主动触发预加载检查
      setTimeout(() => triggerPreloadCheck(), 500);
    }
  };

  const handlePrevious = async () => {
    if (playbackMode === 'playlist' && playlistQueue.length > 0) {
      if (shuffleMode) {
        await handleShufflePrevious();
        // 主动触发预加载检查
        setTimeout(() => triggerPreloadCheck(), 500);
        return;
      }
      const prevIndex = currentQueueIndex - 1;
      if (prevIndex >= 0) {
        setCurrentQueueIndex(prevIndex);
        const prevTrack = playlistQueue[prevIndex];
        usePlaylistStore.setState({ currentTrackId: String(prevTrack.id) });
        await handlePlay(prevTrack);
        // 主动触发预加载检查
        setTimeout(() => triggerPreloadCheck(), 500);
      } else {
        const lastIndex = playlistQueue.length - 1;
        setCurrentQueueIndex(lastIndex);
        const lastTrack = playlistQueue[lastIndex];
        usePlaylistStore.setState({ currentTrackId: String(lastTrack.id) });
        await handlePlay(lastTrack);
        // 主动触发预加载检查
        setTimeout(() => triggerPreloadCheck(), 500);
      }
      return;
    }
    // 默认模式
    const currentIndex = allTracks.findIndex(t => t.id === currentTrack?.id);
    if (currentIndex > 0) {
      const prevTrack = allTracks[currentIndex - 1];
      usePlaylistStore.setState({ currentTrackId: String(prevTrack.id) });
      await handlePlay(prevTrack);
      // 主动触发预加载检查
      setTimeout(() => triggerPreloadCheck(), 500);
    }
  };

  return (
    <PlaylistGradientProvider>
      <PlayerContext.Provider value={playerContextValue}>
        <GlobalGradientBackground />
        <div className="min-h-screen paper-texture relative" style={{ backgroundColor: 'transparent', zIndex: 1, position: 'relative' }}>
          <AudioVisualizer isPlaying={isPlaying} />
          <Sidebar activeTab={activeTab} onTabChange={handleTabChange} isDark={isDark} onToggleTheme={toggleDarkMode} />

        <main className="ml-64 relative" style={{ zIndex: 2, position: 'relative' }}>
          <TopBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onSearch={(query) => runSearch(query, searchMode)}
            currentUser={currentUser ? {
              name: currentUser.username || '用户',
              avatar: currentUser.avatar || ''
            } : null}
            isDark={isDark}
            onToggleTheme={toggleDarkMode}
            onLogout={handleLogout}
          />

          <div className="pt-16 pb-36 px-6">
            {searchQuery || searchResults.length > 0 ? (
              <div className="fade-in">
                <h2 className="text-2xl font-normal artistic-title mb-4">
                  {searchResults.length > 0 ? `"${searchQuery}" 的搜索结果` : '搜索'}
                </h2>

                {/* 搜索模式切换 */}
                <div className="flex gap-2 mb-6">
                  <button
                    onClick={() => { setSearchMode('database'); if (searchQuery) runSearch(searchQuery, 'database'); }}
                    className="px-4 py-1.5 rounded-full text-xs font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      backgroundColor: searchMode === 'database' ? 'var(--primary, #ff7a00)' : 'rgba(255,255,255,0.08)',
                      color: searchMode === 'database' ? '#fff' : 'var(--foreground, rgba(255,255,255,0.8))',
                    }}
                  >
                    音乐库搜索
                  </button>
                  <button
                    onClick={() => { setSearchMode('crawler'); if (searchQuery) runSearch(searchQuery, 'crawler'); }}
                    className="px-4 py-1.5 rounded-full text-xs font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      backgroundColor: searchMode === 'crawler' ? 'var(--primary, #ff7a00)' : 'rgba(255,255,255,0.08)',
                      color: searchMode === 'crawler' ? '#fff' : 'var(--foreground, rgba(255,255,255,0.8))',
                    }}
                  >
                    全网搜索
                  </button>
                  {searchLoading && (
                    <span className="flex items-center gap-1 text-xs opacity-50 ml-2">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      搜索中...
                    </span>
                  )}
                </div>

                {searchResults.length > 0 ? (
                  <div className="space-y-1">
                    {searchResults.map((track, index) => (
                      <div key={track.id} className="relative">
                        <span
                          className="absolute top-2 right-2 z-10 text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                          style={{
                            backgroundColor: track.source === 'external' || track.source === 'netease'
                              ? 'rgba(255,122,0,0.2)' : track.source === 'local'
                              ? 'rgba(16,185,129,0.2)' : track.source === 'youtube'
                              ? 'rgba(255,0,0,0.2)' : track.source === 'bilibili'
                              ? 'rgba(0,174,234,0.2)' : 'rgba(99,102,241,0.2)',
                            color: track.source === 'external' || track.source === 'netease'
                              ? '#ff7a00' : track.source === 'local'
                              ? '#10b981' : track.source === 'youtube'
                              ? '#ff0000' : track.source === 'bilibili'
                              ? '#00aeec' : '#6366f1',
                          }}
                        >
                          {track.source === 'external' || track.source === 'netease' ? '网易云'
                            : track.source === 'local' ? '本地'
                            : track.source === 'youtube' ? 'YouTube'
                            : track.source === 'bilibili' ? 'B站'
                            : '缓存'}
                        </span>
                        <TrackRow
                          track={track}
                          index={index}
                          isPlaying={currentTrack?.id === track.id && isPlaying}
                          isFavorite={favorites.includes(track.id)}
                          onPlay={() => handlePlay(track)}
                          onToggleFavorite={() => handleToggleFavorite(track)}
                          onAddToPlaylist={() => openAddToPlaylistModal(track.id)}
                        />
                      </div>
                    ))}
                  </div>
                ) : searchLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--muted-foreground)' }} />
                    <span className="ml-3 text-sm opacity-50">正在搜索...</span>
                  </div>
                ) : (
                    <div className="empty-state blur-in">
                      <Search className="w-16 h-16" />
                      <p className="text-lg font-medium mt-4">未找到结果</p>
                      <p className="text-sm mt-2">尝试其他关键词</p>
                    </div>
                  )
                }
              </div>
            ) : (
              children
            )}
          </div>
        </main>

        {/* 歌曲评论全屏面板 - 仅覆盖右侧内容区(不含左侧边栏) */}
        {songCommentTarget && (
          <SongCommentPanel
            trackId={songCommentTarget.trackId}
            title={songCommentTarget.title}
            artist={songCommentTarget.artist}
            onClose={() => setSongCommentTarget(null)}
          />
        )}

        <MusicPlayer
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          isFavorite={currentTrack ? favorites.includes(currentTrack.id) : false}
          onPlayPause={() => setIsPlaying(!isPlaying)}
          onNext={handleNext}
          onPrevious={handlePrevious}
          onToggleFavorite={() => currentTrack && handleToggleFavorite(currentTrack)}
          shuffleMode={shuffleMode}
          onToggleShuffle={handleToggleShuffle}
          onRefreshUrl={refreshCurrentTrackUrl}
          onPlayMv={(track) => setMvTrack(track)}
        />

        {mvTrack && (
          <MvPlayer
            isOpen={!!mvTrack}
            onClose={() => setMvTrack(null)}
            mvUrl={(mvTrack as any).mv_url || ''}
            title={mvTrack.title}
            artist={mvTrack.artist}
            cover={(mvTrack as any).mv_cover || mvTrack.cover || undefined}
          />
        )}

        <AddToPlaylistModal
          isOpen={showAddToPlaylist}
          onClose={() => setShowAddToPlaylist(false)}
          playlists={playlists}
          onAddToPlaylist={handleAddToPlaylist}
          onCreateAndAdd={handleCreateAndAddToPlaylist}
          trackTitle={allTracks.find(t => t.id === selectedTrackId)?.title}
        />
      </div>
      </PlayerContext.Provider>
    </PlaylistGradientProvider>
  );
}

function GlobalGradientBackground() {
  const { gradientColor } = usePlaylistGradient();

  if (!gradientColor) {
    return null;
  }

  const { r, g, b } = gradientColor;

  return (
    <div
      className="fixed inset-0 z-0 transition-all duration-700"
      style={{
        background: `
          linear-gradient(
            180deg,
            rgb(${r}, ${g}, ${b}) 0%,
            rgba(${r}, ${g}, ${b}, 0.7) 180px,
            #121212 380px
          )
        `,
        backgroundAttachment: 'fixed',
        zIndex: 0,
      }}
    />
  );
}
