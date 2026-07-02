// 歌单类型定义
export interface Playlist {
  id: string;
  name: string;
  description: string;
  cover: string | null;
  trackIds: number[];
  createdAt: string;
  platformSource?: 'local' | 'netease' | 'qq';
  source?: 'local' | 'external' | 'custom';
  externalPlaylistId?: string;
  platformPlaylistId?: string;
  trackCount?: number;
}

// 外部歌单轨道类型
export interface ExternalPlaylistTrack {
  id: string;
  track_title: string;
  track_artist: string;
  track_duration: number;
  platform_track_id: string;
  position: number;
  playlist_id?: string;
  play_url?: string;
  thumbnail?: string;
  source?: string;
}

// 本地音乐轨道类型（数据库版本，用于 LocalMusicList 等组件）
export interface LocalTrack {
  id: number;
  title: string;
  artist: string;
  album: string | null;
  cover: string | null;
  duration: number;
  source: string;
  play_url: string | null;
  audio_url: string | null;
  lyrics: string | null;
  mv_url: string | null;
  mv_cover: string | null;
  created_at: string;
}

// LRC 歌词行
export interface LyricLine {
  time: number;      // 毫秒数
  text: string;
}

// MV 播放器 Props
export interface MvPlayerProps {
  isOpen: boolean;
  onClose: () => void;
  mvUrl: string;
  title: string;
  artist: string;
  cover?: string;
}

// 歌词显示 Props
export interface LyricsDisplayProps {
  lyrics: string;
  currentTime?: number;
  onSeek?: (time: number) => void;
  height?: number;
  className?: string;
  trackId?: string | number;
}

// 歌词编辑器 Props
export interface LyricsEditorProps {
  initialLyrics?: string;
  trackId: number;
  onSave: (lyrics: string) => Promise<void>;
  onCancel: () => void;
}

// 本地音乐列表 Props
export interface LocalMusicListProps {
  tracks: LocalTrack[];
  onPlay: (track: LocalTrack) => void;
  onPlayMv: (track: LocalTrack) => void;
  onEditLyrics: (track: LocalTrack) => void;
  onDelete: (trackId: number) => void;
  isLoading?: boolean;
}

// 上传步骤枚举
export type UploadStep = 'select' | 'metadata' | 'mv' | 'lyrics' | 'confirm';

// 上传表单数据
export interface UploadFormData {
  audioFile: File | null;
  title: string;
  artist: string;
  album: string;
  coverFile: File | null;
  coverPreview: string | null;
  mvFile: File | null;
  mvPreview: string | null;
  lyrics: string;
  storageType: 'supabase' | 'local';
}
