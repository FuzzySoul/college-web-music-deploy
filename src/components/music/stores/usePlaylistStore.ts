import { create } from 'zustand';
import type { ExternalPlaylistTrack } from '../types';

// localStorage key for search counts
const SEARCH_COUNTS_KEY = 'playlistManager_searchCounts';

// 从 localStorage 加载搜索配置
function loadSearchCountsFromStorage(): { youtubeCount: number; bilibiliCount: number } {
  if (typeof window === 'undefined') return { youtubeCount: 1, bilibiliCount: 0 };
  try {
    const saved = localStorage.getItem(SEARCH_COUNTS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        youtubeCount: parsed.youtubeCount ?? 1,
        bilibiliCount: parsed.bilibiliCount ?? 0,
      };
    }
  } catch (error) {
    console.error('Failed to load search counts from localStorage:', error);
  }
  return { youtubeCount: 1, bilibiliCount: 0 };
}

// 保存搜索配置到 localStorage
function saveSearchCountsToStorage(youtubeCount: number, bilibiliCount: number): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SEARCH_COUNTS_KEY, JSON.stringify({ youtubeCount, bilibiliCount }));
  } catch (error) {
    console.error('Failed to save search counts to localStorage:', error);
  }
}

interface PreloadState {
  preloadQueue: string[];
  isPreloading: boolean;
  preloadBatchSize: number;
  currentBatchIndex: number;
  totalTracks: number;
  loadedCount: number;
  abortController: AbortController | null;
  preloadedTrackIds: Set<string>;
  tracksList: { id: string; title: string; artist: string }[];
  currentPlaylistId: string | null;
  fullTracksList: ExternalPlaylistTrack[]; // 存储完整的歌曲列表
  // 随机播放状态
  shuffledQueue: ExternalPlaylistTrack[]; // 随机排序后的队列
  playedTrackIds: Set<string>; // 已播放的歌曲ID
  isShuffleMode: boolean; // 是否随机播放模式
  currentTrackId: string | null; // 当前播放的歌曲ID
  // 搜索配置 - 全局共享
  youtubeCount: number;
  bilibiliCount: number;
}

interface PreloadActions {
  setPreloadQueue: (queue: string[]) => void;
  setIsPreloading: (isPreloading: boolean) => void;
  setPreloadBatchSize: (size: number) => void;
  setCurrentBatchIndex: (index: number) => void;
  incrementLoadedCount: () => void;
  resetPreloadState: () => void;
  setAbortController: (controller: AbortController | null) => void;
  abortPreload: () => void;
  addPreloadedTrackId: (trackId: string) => void;
  hasPreloadedTrack: (trackId: string) => boolean;
  setTracksList: (tracks: { id: string; title: string; artist: string }[]) => void;
  setCurrentPlaylistId: (id: string | null) => void;
  getPreloadedCount: () => number;
  setFullTracksList: (tracks: ExternalPlaylistTrack[]) => void;
  getFullTracksList: () => ExternalPlaylistTrack[];
  // 随机播放相关
  setShuffledQueue: (queue: ExternalPlaylistTrack[]) => void;
  addPlayedTrackId: (trackId: string) => void;
  resetPlayedTracks: () => void;
  setIsShuffleMode: (isShuffle: boolean) => void;
  setCurrentTrackId: (trackId: string | null) => void;
  getNextShuffleTrack: () => ExternalPlaylistTrack | null;
  getRemainingTracks: () => ExternalPlaylistTrack[];
  // 搜索配置相关
  setYoutubeCount: (count: number) => void;
  setBilibiliCount: (count: number) => void;
}

// 获取初始搜索配置
const initialSearchCounts = typeof window !== 'undefined' ? loadSearchCountsFromStorage() : { youtubeCount: 1, bilibiliCount: 0 };

const initialState: PreloadState = {
  preloadQueue: [],
  isPreloading: false,
  preloadBatchSize: 7,
  currentBatchIndex: 0,
  totalTracks: 0,
  loadedCount: 0,
  abortController: null,
  preloadedTrackIds: new Set(),
  tracksList: [],
  currentPlaylistId: null,
  fullTracksList: [],
  // 随机播放初始状态
  shuffledQueue: [],
  playedTrackIds: new Set(),
  isShuffleMode: false,
  currentTrackId: null,
  // 搜索配置 - 从 localStorage 加载
  youtubeCount: initialSearchCounts.youtubeCount,
  bilibiliCount: initialSearchCounts.bilibiliCount,
};

export const usePlaylistStore = create<PreloadState & PreloadActions>((set, get) => ({
  ...initialState,

  setPreloadQueue: (queue) => set({ 
    preloadQueue: queue, 
    totalTracks: queue.length,
  }),

  setIsPreloading: (isPreloading) => set({ isPreloading }),

  setPreloadBatchSize: (size) => set({ preloadBatchSize: size }),

  setCurrentBatchIndex: (index) => set({ currentBatchIndex: index }),

  incrementLoadedCount: () => set((state) => ({ 
    loadedCount: state.loadedCount + 1 
  })),

  resetPreloadState: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
    }
    set({
      ...initialState,
      preloadedTrackIds: new Set(),
    });
  },

  setAbortController: (controller) => set({ abortController: controller }),

  abortPreload: () => {
    const { abortController, isPreloading } = get();
    if (abortController && isPreloading) {
      abortController.abort();
      set({ 
        isPreloading: false, 
        abortController: null,
      });
    }
  },

  addPreloadedTrackId: (trackId) => set((state) => {
    const newSet = new Set(state.preloadedTrackIds);
    newSet.add(trackId);
    return { preloadedTrackIds: newSet };
  }),

  hasPreloadedTrack: (trackId) => get().preloadedTrackIds.has(trackId),

  setTracksList: (tracks) => set({ tracksList: tracks }),

  setCurrentPlaylistId: (id) => set({ currentPlaylistId: id }),

  getPreloadedCount: () => get().preloadedTrackIds.size,

  setFullTracksList: (tracks) => set({ fullTracksList: tracks }),

  getFullTracksList: () => get().fullTracksList,

  // 随机播放实现
  setShuffledQueue: (queue) => set({ shuffledQueue: queue }),

  addPlayedTrackId: (trackId) => set((state) => {
    const newSet = new Set(state.playedTrackIds);
    newSet.add(trackId);
    return { playedTrackIds: newSet };
  }),

  resetPlayedTracks: () => set({ playedTrackIds: new Set() }),

  setIsShuffleMode: (isShuffle) => set({ isShuffleMode: isShuffle }),

  setCurrentTrackId: (trackId) => set({ currentTrackId: trackId }),

  getNextShuffleTrack: () => {
    const state = get();
    const { shuffledQueue, playedTrackIds, currentTrackId, preloadedTrackIds } = state;

    if (shuffledQueue.length === 0) return null;

    // 获取未播放的歌曲
    const remainingTracks = shuffledQueue.filter(
      (t) => !playedTrackIds.has(t.id) && t.id !== currentTrackId
    );

    // 如果所有歌曲都播放过了，重置已播放列表
    if (remainingTracks.length === 0) {
      const otherTracks = shuffledQueue.filter((t) => t.id !== currentTrackId);
      if (otherTracks.length === 0) return null;
      // 优先选择有缓存的歌曲
      const cachedTracks = otherTracks.filter((t) => preloadedTrackIds.has(t.id));
      if (cachedTracks.length > 0) {
        const randomIndex = Math.floor(Math.random() * cachedTracks.length);
        return cachedTracks[randomIndex];
      }
      // 随机选择一首
      const randomIndex = Math.floor(Math.random() * otherTracks.length);
      return otherTracks[randomIndex];
    }

    // 优先选择有缓存且未播放的歌曲
    const cachedUnplayedTracks = remainingTracks.filter((t) => preloadedTrackIds.has(t.id));
    if (cachedUnplayedTracks.length > 0) {
      const randomIndex = Math.floor(Math.random() * cachedUnplayedTracks.length);
      return cachedUnplayedTracks[randomIndex];
    }

    // 随机选择一首未播放的歌曲
    const randomIndex = Math.floor(Math.random() * remainingTracks.length);
    return remainingTracks[randomIndex];
  },

  getRemainingTracks: () => {
    const state = get();
    const { shuffledQueue, playedTrackIds } = state;
    return shuffledQueue.filter((t) => !playedTrackIds.has(t.id));
  },

  // 搜索配置相关方法 - 同时保存到 localStorage
  setYoutubeCount: (count) => {
    const state = get();
    set({ youtubeCount: count });
    saveSearchCountsToStorage(count, state.bilibiliCount);
    console.log('[Store] Saved youtubeCount:', count, 'bilibiliCount:', state.bilibiliCount);
  },
  setBilibiliCount: (count) => {
    const state = get();
    set({ bilibiliCount: count });
    saveSearchCountsToStorage(state.youtubeCount, count);
    console.log('[Store] Saved youtubeCount:', state.youtubeCount, 'bilibiliCount:', count);
  },
}));

export const getPreloadBatchSize = () => usePlaylistStore.getState().preloadBatchSize;
export const getIsPreloading = () => usePlaylistStore.getState().isPreloading;
export const getPreloadQueue = () => usePlaylistStore.getState().preloadQueue;
export const getPreloadedTrackIds = () => usePlaylistStore.getState().preloadedTrackIds;
export const addPreloadedTrackId = (trackId: string) => usePlaylistStore.getState().addPreloadedTrackId(trackId);
export const hasPreloadedTrack = (trackId: string) => usePlaylistStore.getState().hasPreloadedTrack(trackId);
