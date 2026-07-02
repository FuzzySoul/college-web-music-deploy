'use client';

import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePlayer } from '../context/PlayerContext';
import { PlaylistManager, Playlist, ExternalPlaylistTrack } from '@/components/music/PlaylistManager';
import { PlaylistFormDialog } from '@/components/music/PlaylistFormDialog';
import { Track } from '@/lib/music-service';

function PlaylistsPageContent() {
  const { 
    playlists, 
    setPlaylists,
    handlePlay,
    currentTrack,
    isPlaying,
    openAddToPlaylistModal,
    setCurrentTrack,
    setIsPlaying,
    setPlaylistQueue,
    setPlaybackMode,
    setIsPlaylistPlaying,
    setCurrentQueueIndex,
    shuffleMode,
    setShuffleMode,
    allTracks,
    handlePlayPlaylistQueue,
    currentQueueIndex,
    currentUser,
  } = usePlayer();

  const searchParams = useSearchParams();
  const [externalPlaylistTracks, setExternalPlaylistTracks] = useState<ExternalPlaylistTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // 🔧 修复：使用 AbortController 和 ref 防止重复请求
  const abortControllerRef = useRef<AbortController | null>(null);
  const isLoadingRef = useRef(false);

  // 从 URL 参数获取初始选中的歌单 ID
  const urlPlaylistId = searchParams.get('id');
  const urlSource = searchParams.get('source');

  // 调试日志：记录 URL 参数（可在生产环境移除）
  useEffect(() => {
    if (urlPlaylistId) {
      console.log('[PlaylistsPage] URL params detected:', { 
        id: urlPlaylistId, 
        source: urlSource,
        fullUrl: window.location.search 
      });
    }
  }, [urlPlaylistId, urlSource]);

  const loadExternalPlaylists = useCallback(async (retryCount = 0) => {
    const MAX_RETRIES = 2;
    const RETRY_DELAY = 3000;

    if (isLoadingRef.current) {
      console.log('[PlaylistsPage] Skipping duplicate load');
      return;
    }
    
    isLoadingRef.current = true;
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    setIsLoading(true);
    
    let success = false;
    
    try {
      const response = await fetch('/api/music/sync-playlists', {
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(35000)])
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[PlaylistsPage] Got data:', data);
      
      const allPlaylists: Playlist[] = [];
      
      if (data.localPlaylists && data.localPlaylists.length > 0) {
        const mappedLocal = data.localPlaylists.map((p: any) => ({
          id: String(p.id),
          name: p.name,
          description: p.description || '',
          cover: p.cover,
          trackIds: [],
          createdAt: p.created_at,
          platformSource: p.platform_source || 'local',
          source: 'local' as const,
          externalPlaylistId: String(p.external_playlist_id || ''),
          trackCount: p.track_count || 0
        }));
        allPlaylists.push(...mappedLocal);
      }
      
      if (data.externalPlaylists && data.externalPlaylists.length > 0) {
        const mappedExternal = data.externalPlaylists.map((p: any) => ({
          id: `external-${p.id}`,
          name: p.name,
          description: p.description || '',
          cover: p.cover_url,
          trackIds: [],
          createdAt: p.created_at,
          platformSource: p.source === 'custom' ? 'local' : 'netease',
          source: (p.source === 'custom' ? 'custom' : 'external') as 'custom' | 'external',
          externalPlaylistId: String(p.id),
          platformPlaylistId: p.platform_playlist_id,
          trackCount: p.track_count || 0
        }));
        allPlaylists.push(...mappedExternal);
      }
      
      console.log('[PlaylistsPage] Total playlists:', allPlaylists.length);

      setPlaylists((prev: Playlist[]) => {
        // 保留所有乐观更新的歌单（包括本地创建 temp- 和网易云导入 temp-netease-）
        const optimisticItems = prev.filter(p =>
          p.id.startsWith('temp-') || p.id.startsWith('temp-netease-')
        );
        // 过滤掉服务器返回的、与乐观歌单重复的真实歌单（通过 platformPlaylistId 匹配）
        const optimisticPlatformIds = new Set(
          optimisticItems
            .filter(p => p.platformPlaylistId)
            .map(p => p.platformPlaylistId)
        );
        const dedupedServer = allPlaylists.filter(p =>
          !p.platformPlaylistId || !optimisticPlatformIds.has(p.platformPlaylistId)
        );
        return [...optimisticItems, ...dedupedServer];
      });
      
      success = true;
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === 'AbortError'
        && (error.message.includes('超时') || error.message.includes('timeout'));
      const isUserAbort = error instanceof Error && error.name === 'AbortError' && !isTimeout;
      
      if (isUserAbort) {
        console.log('[PlaylistsPage] Request aborted by user');
        setIsLoading(false);
        isLoadingRef.current = false;
        abortControllerRef.current = null;
        return;
      }
      
      if (isTimeout) {
        console.log(`[PlaylistsPage] 请求超时 (第${retryCount + 1}次)`);
      } else {
        console.error('[PlaylistsPage] 加载外部歌单失败:', error);
      }
      
      if (retryCount < MAX_RETRIES) {
        console.log(`[PlaylistsPage] ${RETRY_DELAY / 1000}s 后重试 (${retryCount + 1}/${MAX_RETRIES})...`);
        isLoadingRef.current = false;
        abortControllerRef.current = null;
        await new Promise(r => setTimeout(r, RETRY_DELAY));
        loadExternalPlaylists(retryCount + 1);
        return;
      }
      
      console.error('[PlaylistsPage] 重试耗尽，加载失败');
      setIsLoading(false);
      isLoadingRef.current = false;
      abortControllerRef.current = null;
      return;
    }
    
    if (success) {
      setIsLoading(false);
      isLoadingRef.current = false;
      abortControllerRef.current = null;
    }
  }, [setPlaylists]);

  useEffect(() => {
    loadExternalPlaylists();
  }, [loadExternalPlaylists]);

  // 监听全局歌单更新事件（如网易云导入）
  useEffect(() => {
    const handlePlaylistsUpdated = () => {
      console.log('[PlaylistsPage] Received playlists:updated event, reloading...');
      isLoadingRef.current = false;
      loadExternalPlaylists();
    };
    window.addEventListener('playlists:updated', handlePlaylistsUpdated);
    return () => window.removeEventListener('playlists:updated', handlePlaylistsUpdated);
  }, [loadExternalPlaylists]);

  // 监听网易云导入乐观更新事件
  useEffect(() => {
    // 导入开始：添加乐观歌单
    const handleImportStart = (e: CustomEvent) => {
      const { playlists: optimisticPlaylists } = e.detail || {};
      if (!optimisticPlaylists?.length) return;

      console.log('[PlaylistsPage] Adding optimistic netease playlists:', optimisticPlaylists.length);

      const mapped: Playlist[] = optimisticPlaylists.map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description || '',
        cover: p.cover,
        trackIds: [],
        createdAt: p.createdAt,
        platformSource: p.platformSource,
        source: p.source,
        externalPlaylistId: p.externalPlaylistId,
        platformPlaylistId: p.platformPlaylistId,
        trackCount: p.trackCount,
      }));

      setPlaylists((prev: Playlist[]) => [...mapped, ...prev]);
    };

    // 导入完成：用真实ID替换临时ID
    const handleImportComplete = (e: CustomEvent) => {
      const { tempIds, realPlaylists } = e.detail || {};
      if (!tempIds?.length) return;

      console.log('[PlaylistsPage] Replacing optimistic playlists with real IDs');

      setPlaylists((prev: Playlist[]) => {
        return prev.map(p => {
          const tempIndex = tempIds.indexOf(p.id);
          if (tempIndex === -1) return p;

          const real = realPlaylists?.[tempIndex];
          if (!real) return p;

          return {
            ...p,
            id: `external-${real.id}`,
            externalPlaylistId: String(real.id),
            platformPlaylistId: real.platformPlaylistId,
          };
        });
      });
      // M3: 删除 500ms 强制 reload —— 此时 FastAPI 'playlists' 缓存刚被 save-playlists 失效，
      // 立即重拉会撞上 cache miss 又走 Supabase。改为：依赖用户下次主动进入页面触发 loadExternalPlaylists。
    };

    // 导入失败：移除乐观歌单
    const handleImportFailed = (e: CustomEvent) => {
      const { tempIds } = e.detail || {};
      if (!tempIds?.length) return;

      console.log('[PlaylistsPage] Removing failed optimistic playlists');
      setPlaylists((prev: Playlist[]) => prev.filter(p => !tempIds.includes(p.id)));
    };

    window.addEventListener('playlists:netease-import-start', handleImportStart as EventListener);
    window.addEventListener('playlists:netease-import-complete', handleImportComplete as EventListener);
    window.addEventListener('playlists:netease-import-failed', handleImportFailed as EventListener);

    return () => {
      window.removeEventListener('playlists:netease-import-start', handleImportStart as EventListener);
      window.removeEventListener('playlists:netease-import-complete', handleImportComplete as EventListener);
      window.removeEventListener('playlists:netease-import-failed', handleImportFailed as EventListener);
    };
  }, [setPlaylists, loadExternalPlaylists]);

  const handleCreatePlaylist = async (name: string, description?: string, source: 'local' | 'custom' = 'local') => {
    const tempId = `temp-${Date.now()}`;
    const now = new Date().toISOString();

    const optimisticPlaylist: Playlist = {
      id: tempId,
      name,
      description: description || '',
      cover: null,
      trackIds: [],
      createdAt: now,
      platformSource: 'local',
      source,
      externalPlaylistId: source === 'custom' ? tempId : undefined,
      trackCount: 0,
    };

    setPlaylists((prev: Playlist[]) => [optimisticPlaylist, ...prev]);

    try {
      const response = await fetch('/api/music/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, source }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '创建失败');
      }

      const result = await response.json();
      const p = result.data || result;

      setPlaylists((prev: Playlist[]) =>
        prev.map(pl => pl.id === tempId ? {
          ...pl,
          id: source === 'custom' ? `external-${String(p.id)}` : String(p.id),
          externalPlaylistId: source === 'custom' ? String(p.id) : pl.externalPlaylistId,
          createdAt: p.created_at || pl.createdAt,
        } : pl)
      );
    } catch (error) {
      console.warn('[PlaylistsPage] 歌单已创建(本地)，同步到服务器失败:', error);
      setPlaylists((prev: Playlist[]) =>
        prev.map(pl => pl.id === tempId ? { ...pl, _syncFailed: true } : pl)
      );
    }
  };

  const handleEditPlaylist = async (id: string, data: { name?: string; description?: string; cover?: string }) => {
    const original = playlists.find((p: Playlist) => p.id === id);

    setPlaylists((prev: Playlist[]) => prev.map((p: Playlist) =>
      p.id === id ? { ...p, ...data } : p
    ));

    try {
      const isExternal = id.startsWith('external-');
      const cleanId = isExternal ? id.replace(/^external-/, '') : id;
      const playlist = playlists.find((p: Playlist) => p.id === id);
      const source = playlist?.source === 'custom' ? 'custom'
        : isExternal ? 'external'
        : 'local';

      const response = await fetch(`/api/music/playlists?id=${cleanId}&source=${source}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '更新失败');
      }
    } catch (error) {
      console.warn('[PlaylistsPage] 歌单已更新(本地)，同步到服务器失败:', error);
      if (original) {
        setPlaylists((prev: Playlist[]) => prev.map((p: Playlist) =>
          p.id === id ? original : p
        ));
      }
    }
  };

  const handleDeletePlaylist = async (id: string) => {
    const playlist = playlists.find((p: Playlist) => p.id === id);
    const name = playlist?.name || '该歌单';

    if (!window.confirm(`确定要删除歌单「${name}」吗？\n\n此操作不可恢复，关联的歌曲也将被清除。`)) {
      return;
    }

    const removedPlaylist = { ...playlist };
    setPlaylists((prev: Playlist[]) => prev.filter((p: Playlist) => p.id !== id));

    try {
      const source = playlist?.source === 'custom' ? 'custom'
        : playlist?.platformSource === 'netease' ? 'external'
        : 'local';
      const cleanId = id.replace(/^external-/, '');

      const response = await fetch(`/api/music/playlists?id=${cleanId}&source=${source}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '删除失败');
      }
    } catch (error) {
      console.warn('[PlaylistsPage] 歌单已从本地移除，同步到服务器失败:', error);
      if (removedPlaylist) {
        setPlaylists((prev: Playlist[]) => [...prev, removedPlaylist as Playlist]);
      }
    }
  };

  const handleAddToPlaylist = (playlistId: string) => {};

  // 打开编辑对话框
  const openEditDialog = (playlist: Playlist) => {
    setEditingPlaylist(playlist);
    setEditDialogOpen(true);
  };

  // 提交编辑
  const handleSubmitEdit = async (data: { name: string; description?: string; cover?: string }) => {
    if (!editingPlaylist) return;
    await handleEditPlaylist(editingPlaylist.id, data);
    setEditDialogOpen(false);
    setEditingPlaylist(null);
  };

  const handleRemoveFromPlaylist = (playlistId: string, trackId: number) => {
    setPlaylists((prev: Playlist[]) => prev.map((p: Playlist) => 
      p.id === playlistId
        ? { ...p, trackIds: p.trackIds.filter(id => id !== trackId) }
        : p
    ));
  };

  // 🔧 防止重复加载同一歌单的歌曲
  const loadingTracksRef = useRef<string | null>(null);
  
  const handleLoadExternalTracks = async (externalPlaylistId: string) => {
    console.log('[PlaylistsPage] Loading external tracks for:', externalPlaylistId);
    
    // 🔧 防抖：如果正在加载同一个歌单的曲目，跳过
    if (loadingTracksRef.current === externalPlaylistId) {
      console.log('[PlaylistsPage] Skipping duplicate track load for:', externalPlaylistId);
      return [];
    }
    
    if (!externalPlaylistId) {
      setExternalPlaylistTracks([]);
      return [];
    }
    
    // 🔧 标记正在加载
    loadingTracksRef.current = externalPlaylistId;
    
    try {
      const response = await fetch(`/api/music/playlist-tracks?playlist_id=${externalPlaylistId}`);
      const data = await response.json();
      if (data.tracks) {
        console.log('[PlaylistsPage] Got tracks:', data.tracks.length);
        setExternalPlaylistTracks(data.tracks);
        return data.tracks;
      }
      return [];
    } catch (error) {
      console.error('[PlaylistsPage] Load external tracks failed:', error);
      return [];
    } finally {
      // 🔧 延迟重置（防止 StrictMode 双重调用）
      setTimeout(() => {
        loadingTracksRef.current = null;
      }, 100);
    }
  };

  const handlePlayPlaylist = async (playlistId: string) => {
    console.log('[PlaylistsPage] Play playlist:', playlistId);
    const playlist = playlists.find((p: Playlist) => p.id === playlistId);
    if (!playlist) return;

    // 本地歌单：从 playlist-tracks API 加载歌曲并播放
    if (!playlist.externalPlaylistId || playlist.platformSource === 'local') {
      try {
        const res = await fetch(`/api/music/playlist-tracks?playlist_id=${playlistId}&source=local`);
        const data = await res.json();
        if (data.tracks && data.tracks.length > 0) {
          const tracks: Track[] = data.tracks.map((t: any) => ({
            id: t.id,
            title: t.title,
            artist: t.artist,
            album: t.album || '',
            cover: t.cover || '',
            duration: t.duration || 0,
            source: (t.source || 'local') as Track['source'],
            source_id: String(t.id),
            play_url: t.play_url || t.audio_url || '',
            audio_url: t.audio_url || t.play_url || '',
            lyrics: t.lyrics || null,
            mv_url: t.mv_url || null,
            mv_cover: t.mv_cover || null,
            created_at: t.created_at || new Date().toISOString(),
          }));
          handlePlayPlaylistQueue(tracks, 0, false);
        }
      } catch (e) {
        console.error('[PlaylistsPage] 播放本地歌单失败:', e);
      }
      return;
    }

    // 外部/自建歌单：加载外部曲目后播放
    if (playlist.externalPlaylistId) {
      const tracks = await handleLoadExternalTracks(playlist.externalPlaylistId);
      if (tracks && tracks.length > 0) {
        handlePlayExternalTrackQueue(tracks, 0, false);
      }
    }
  };

  const handlePlayExternalTrackQueue = (tracks: ExternalPlaylistTrack[], startIndex: number = 0, shouldShuffle: boolean = false) => {
    console.log('[handlePlayExternalTrackQueue] tracks:', tracks);
    console.log('[handlePlayExternalTrackQueue] tracks[0]:', tracks[0]);
    console.log('[handlePlayExternalTrackQueue] shouldShuffle:', shouldShuffle);
    
    const convertedTracks: Track[] = tracks.map((t, idx) => ({
      id: parseInt(t.platform_track_id) || Date.now() + idx,
      title: t.track_title,
      artist: t.track_artist,
      album: '',
      cover: t.thumbnail || '',
      duration: t.track_duration,
      source: (t.source || 'external') as 'external',
      source_id: t.platform_track_id,
      play_url: t.play_url || '',
      audio_url: t.play_url || '',
      lyrics: null,
      mv_url: null,
      mv_cover: null,
      created_at: new Date().toISOString(),
    }));
    
    console.log('[handlePlayExternalTrackQueue] convertedTracks[0]:', convertedTracks[0]);
    handlePlayPlaylistQueue(convertedTracks, startIndex, shouldShuffle);
  };

  if (isLoading && playlists.length === 0) {
    return (
      <div className="fade-in flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-4" style={{ borderColor: 'var(--primary)' }}></div>
          <p style={{ color: 'var(--muted-foreground)' }}>加载歌单中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <PlaylistManager
        playlists={playlists}
        onCreatePlaylist={handleCreatePlaylist}
        onDeletePlaylist={handleDeletePlaylist}
        onEditPlaylist={openEditDialog}
        onAddToPlaylist={handleAddToPlaylist}
        onRemoveFromPlaylist={handleRemoveFromPlaylist}
        onPlayPlaylist={handlePlayPlaylist}
        onLoadExternalTracks={handleLoadExternalTracks}
        externalPlaylistTracks={externalPlaylistTracks}
        currentTrackId={currentTrack?.id}
        currentPlaying={currentTrack?.title}
        isPlaying={isPlaying}
        onPlayUrl={(url, title, artist, thumbnail, onEnded, trackId?: number | string) => {
          const fakeTrack: Track = {
            id: Date.now(),
            title,
            artist,
            album: '',
            cover: thumbnail || '',
            duration: 0,
            source: 'youtube',
            source_id: '',
            play_url: url,
            lyrics: null,
            mv_url: null,
            mv_cover: null,
            created_at: new Date().toISOString()
          };
          setCurrentTrack(fakeTrack);
          setIsPlaying(true);

          if (trackId) {
            fetch('/api/stats/track-play', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ trackId, platform: 'netease' }),
            }).catch(err => console.error('[PlaylistsPage] 播放追踪失败:', err));
          }
        }}
        onPlayQueue={handlePlayExternalTrackQueue}
        currentQueueIndex={currentQueueIndex}
        onSetShuffleMode={setShuffleMode}
        initialSelectedPlaylistId={urlPlaylistId || undefined}
      />

      {/* 编辑歌单对话框 */}
      <PlaylistFormDialog
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setEditingPlaylist(null);
        }}
        mode="edit"
        initialData={editingPlaylist ? {
          id: editingPlaylist.id,
          name: editingPlaylist.name,
          description: editingPlaylist.description,
          cover: editingPlaylist.cover,
        } : undefined}
        onSubmit={handleSubmitEdit}
        isLoading={isEditing}
      />
    </div>
  );
}

export default function PlaylistsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--primary)' }} />
        </div>
      }
    >
      <PlaylistsPageContent />
    </Suspense>
  );
}
