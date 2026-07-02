'use client';

import { createContext, useContext, type Dispatch, type SetStateAction } from 'react';
import type { Track } from '@/lib/music-service';
import type { LocalTrack } from '@/components/music/MusicImporter';
import type { Playlist } from '@/components/music/PlaylistManager';
import type { CurrentUser } from '@/types/comment';

export interface PlayerContextType {
  currentTrack: Track | null;
  setCurrentTrack: Dispatch<SetStateAction<Track | null>>;
  isPlaying: boolean;
  setIsPlaying: Dispatch<SetStateAction<boolean>>;
  favorites: (number | string)[];
  setFavorites: Dispatch<SetStateAction<(number | string)[]>>;
  playlists: Playlist[];
  setPlaylists: Dispatch<SetStateAction<Playlist[]>>;
  allTracks: Track[];
  localTracks: LocalTrack[];
  setLocalTracks: Dispatch<SetStateAction<LocalTrack[]>>;
  handleToggleFavorite: (track: Track) => void;
  handlePlay: (track: Track) => void;
  openAddToPlaylistModal: (trackId: number) => void;
  playbackMode: 'all' | 'external' | 'playlist';
  setPlaybackMode: Dispatch<SetStateAction<'all' | 'external' | 'playlist'>>;
  playlistQueue: Track[];
  setPlaylistQueue: Dispatch<SetStateAction<Track[]>>;
  currentQueueIndex: number;
  setCurrentQueueIndex: Dispatch<SetStateAction<number>>;
  shuffleMode: boolean;
  setShuffleMode: Dispatch<SetStateAction<boolean>>;
  isPlaylistPlaying: boolean;
  setIsPlaylistPlaying: Dispatch<SetStateAction<boolean>>;
  handlePlayPlaylistQueue: (tracks: Track[], startIndex?: number, shouldShuffle?: boolean) => void;
  handleToggleShuffle: () => void;
  // URL刷新相关
  refreshCurrentTrackUrl: () => Promise<boolean>;
  // 当前用户信息
  currentUser: CurrentUser | null;
  setCurrentUser: Dispatch<SetStateAction<CurrentUser | null>>;
  // 歌曲评论面板状态
  songCommentTarget: { trackId: number | string; title: string; artist: string } | null;
  setSongCommentTarget: Dispatch<SetStateAction<{ trackId: number | string; title: string; artist: string } | null>>;
}

export const PlayerContext = createContext<PlayerContextType | null>(null);

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
}
