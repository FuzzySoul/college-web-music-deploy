'use client';

import { useState } from 'react';
import { Plus, X, Music } from 'lucide-react';
import type { Playlist } from './types';

interface AddToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  playlists: Playlist[];
  onAddToPlaylist: (playlistId: string) => void;
  onCreateAndAdd: (name: string) => void;
  trackTitle?: string;
}

export function AddToPlaylistModal({
  isOpen,
  onClose,
  playlists,
  onAddToPlaylist,
  onCreateAndAdd,
  trackTitle,
}: AddToPlaylistModalProps) {
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showNewPlaylist, setShowNewPlaylist] = useState(false);

  if (!isOpen) return null;

  const handleCreateAndAdd = () => {
    if (newPlaylistName.trim()) {
      onCreateAndAdd(newPlaylistName.trim());
      setNewPlaylistName('');
      setShowNewPlaylist(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl p-6 space-y-4" style={{ backgroundColor: 'var(--card)' }}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">添加到歌单{trackTitle ? `：「${trackTitle}」` : ''}</h3>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        {trackTitle && (
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            将「{trackTitle}」添加到：
          </p>
        )}

        {showNewPlaylist ? (
          <div className="space-y-3">
            <input
              type="text"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              placeholder="歌单名称"
              className="input-box w-full"
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => setShowNewPlaylist(false)} className="btn-secondary flex-1">
                取消
              </button>
              <button onClick={handleCreateAndAdd} className="btn-primary flex-1">
                创建并添加
              </button>
            </div>
          </div>
        ) : (
          <>
            <button
              onClick={() => setShowNewPlaylist(true)}
              className="w-full p-3 rounded-lg flex items-center gap-3 hover:bg-accent transition-colors"
              style={{ border: '1px dashed var(--border)' }}
            >
              <Plus className="w-5 h-5" style={{ color: 'var(--primary)' }} />
              <span>新建歌单</span>
            </button>

            <div className="max-h-64 overflow-y-auto space-y-1">
              {playlists.map((playlist) => (
                <button
                  key={playlist.id}
                  onClick={() => {
                    onAddToPlaylist(playlist.id);
                    onClose();
                  }}
                  className="w-full p-3 rounded-lg flex items-center gap-3 hover:bg-accent transition-colors"
                >
                  <Music className="w-5 h-5" style={{ color: 'var(--muted-foreground)' }} />
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium">{playlist.name}</div>
                    <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      {playlist.trackIds.length > 0 ? `${playlist.trackIds.length} 首歌曲` : '歌单为空'}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {playlists.length === 0 && (
              <p className="text-center text-sm py-4" style={{ color: 'var(--muted-foreground)' }}>
                暂无歌单，请先创建一个
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
