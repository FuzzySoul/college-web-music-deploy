import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Track } from '@/lib/music-service';

// 播放模式
export type LoopMode = 'none' | 'all' | 'one';

// 播放状态
export interface AudioPlayerState {
  // 播放列表
  tracks: Track[];
  currentIndex: number;

  // 播放状态
  playing: boolean;
  loopMode: LoopMode;
  shuffled: boolean;

  // 播放进度
  position: number; // 当前位置（秒）
  duration: number; // 总时长（秒）
  buffered: number; // 缓冲位置（秒）

  // 音量
  volume: number;
  muted: boolean;

  // 当前播放歌曲
  currentTrack: Track | null;

  // 播放队列历史（用于随机播放）
  playedTrackIds: Set<string>;
  shuffledQueue: Track[];

  // 加载状态
  isLoading: boolean;
  error: string | null;

  // 音频元素引用
  audioElement: HTMLAudioElement | null;
}

// 播放动作
export interface AudioPlayerActions {
  // 播放控制
  play: () => void;
  pause: () => void;
  toggle: () => void;

  // 导航
  next: () => void;
  previous: () => void;

  // 进度控制
  seek: (position: number) => void;
  setPosition: (position: number) => void;
  setDuration: (duration: number) => void;
  setBuffered: (buffered: number) => void;

  // 音量控制
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;

  // 播放列表管理
  setTracks: (tracks: Track[], startIndex?: number) => void;
  addTracks: (tracks: Track[]) => void;
  removeTrack: (index: number) => void;
  clearTracks: () => void;

  // 播放模式
  setLoopMode: (mode: LoopMode) => void;
  toggleShuffle: () => void;

  // 设置当前歌曲
  setCurrentTrack: (track: Track | null) => void;
  playTrack: (track: Track) => void;

  // 音频元素
  setAudioElement: (element: HTMLAudioElement | null) => void;

  // 加载状态
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // 重置
  reset: () => void;
}

// 初始状态
const initialState: AudioPlayerState = {
  tracks: [],
  currentIndex: 0,
  playing: false,
  loopMode: 'none',
  shuffled: false,
  position: 0,
  duration: 0,
  buffered: 0,
  volume: 0.7,
  muted: false,
  currentTrack: null,
  playedTrackIds: new Set(),
  shuffledQueue: [],
  isLoading: false,
  error: null,
  audioElement: null,
};

// 创建音频播放器 Store
export const useAudioPlayerStore = create<AudioPlayerState & AudioPlayerActions>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    // 播放控制
    play: () => set({ playing: true }),
    pause: () => set({ playing: false }),
    toggle: () => set((state) => ({ playing: !state.playing })),

    // 导航
    next: () => {
      const { tracks, currentIndex, shuffled, shuffledQueue } = get();
      if (tracks.length === 0) return;

      let nextIndex: number;
      if (shuffled && shuffledQueue.length > 0) {
        const currentTrack = tracks[currentIndex];
        const shuffledIndex = shuffledQueue.findIndex(t => t.id === currentTrack?.id);
        nextIndex = (shuffledIndex + 1) % shuffledQueue.length;
        const nextTrack = shuffledQueue[nextIndex];
        const originalIndex = tracks.findIndex(t => t.id === nextTrack?.id);
        set({ currentIndex: originalIndex >= 0 ? originalIndex : 0, currentTrack: nextTrack });
      } else {
        nextIndex = (currentIndex + 1) % tracks.length;
        set({ currentIndex: nextIndex, currentTrack: tracks[nextIndex] });
      }
    },

    previous: () => {
      const { tracks, currentIndex, shuffled, shuffledQueue } = get();
      if (tracks.length === 0) return;

      let prevIndex: number;
      if (shuffled && shuffledQueue.length > 0) {
        const currentTrack = tracks[currentIndex];
        const shuffledIndex = shuffledQueue.findIndex(t => t.id === currentTrack?.id);
        prevIndex = shuffledIndex <= 0 ? shuffledQueue.length - 1 : shuffledIndex - 1;
        const prevTrack = shuffledQueue[prevIndex];
        const originalIndex = tracks.findIndex(t => t.id === prevTrack?.id);
        set({ currentIndex: originalIndex >= 0 ? originalIndex : 0, currentTrack: prevTrack });
      } else {
        prevIndex = currentIndex <= 0 ? tracks.length - 1 : currentIndex - 1;
        set({ currentIndex: prevIndex, currentTrack: tracks[prevIndex] });
      }
    },

    // 进度控制
    seek: (position: number) => {
      const { audioElement } = get();
      if (audioElement) {
        audioElement.currentTime = position;
      }
      set({ position });
    },
    setPosition: (position: number) => set({ position }),
    setDuration: (duration: number) => set({ duration }),
    setBuffered: (buffered: number) => set({ buffered }),

    // 音量控制
    setVolume: (volume: number) => {
      const { audioElement } = get();
      if (audioElement) {
        audioElement.volume = volume;
      }
      set({ volume });
    },
    setMuted: (muted: boolean) => {
      const { audioElement } = get();
      if (audioElement) {
        audioElement.muted = muted;
      }
      set({ muted });
    },

    // 播放列表管理
    setTracks: (tracks: Track[], startIndex = 0) => {
      set({
        tracks,
        currentIndex: startIndex,
        currentTrack: tracks[startIndex] || null,
        playedTrackIds: new Set(),
        shuffledQueue: [],
      });
    },
    addTracks: (tracks: Track[]) => {
      const { tracks: currentTracks } = get();
      set({ tracks: [...currentTracks, ...tracks] });
    },
    removeTrack: (index: number) => {
      const { tracks, currentIndex } = get();
      const newTracks = tracks.filter((_, i) => i !== index);
      const newIndex = index < currentIndex ? currentIndex - 1 : currentIndex;
      set({
        tracks: newTracks,
        currentIndex: newIndex,
        currentTrack: newTracks[newIndex] || null,
      });
    },
    clearTracks: () => {
      set({
        tracks: [],
        currentIndex: 0,
        currentTrack: null,
        playedTrackIds: new Set(),
        shuffledQueue: [],
      });
    },

    // 播放模式
    setLoopMode: (loopMode: LoopMode) => set({ loopMode }),
    toggleShuffle: () => {
      const { shuffled, tracks } = get();
      if (!shuffled) {
        // 开启随机：创建随机队列
        const shuffledQueue = [...tracks].sort(() => Math.random() - 0.5);
        set({ shuffled: true, shuffledQueue });
      } else {
        // 关闭随机
        set({ shuffled: false, shuffledQueue: [] });
      }
    },

    // 设置当前歌曲
    setCurrentTrack: (track: Track | null) => set({ currentTrack: track }),
    playTrack: (track: Track) => {
      const { tracks } = get();
      const index = tracks.findIndex(t => t.id === track.id);
      set({
        currentTrack: track,
        currentIndex: index >= 0 ? index : 0,
        playing: true,
      });
    },

    // 音频元素
    setAudioElement: (audioElement: HTMLAudioElement | null) => set({ audioElement }),

    // 加载状态
    setLoading: (isLoading: boolean) => set({ isLoading }),
    setError: (error: string | null) => set({ error }),

    // 重置
    reset: () => set(initialState),
  }))
);

// 导出选择器
export const selectCurrentTrack = (state: AudioPlayerState & AudioPlayerActions) => state.currentTrack;
export const selectIsPlaying = (state: AudioPlayerState & AudioPlayerActions) => state.playing;
export const selectVolume = (state: AudioPlayerState & AudioPlayerActions) => state.volume;
