'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Play, Music, Disc3, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePlayer } from '../../context/PlayerContext';
import type { Track } from '@/lib/music-service';

interface Album {
  id: string;
  name: string;
  artist: string | null;
  cover: string | null;
  release_year: number | null;
}

export default function AlbumDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { handlePlayPlaylistQueue } = usePlayer();
  const albumId = params.id as string;

  const [album, setAlbum] = useState<Album | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!albumId) return;
    loadAlbum();
  }, [albumId]);

  const loadAlbum = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/music/album-detail?id=${albumId}`);
      if (res.ok) {
        const data = await res.json();
        setAlbum(data.album);
        setTracks(data.tracks || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayAll = () => {
    if (tracks.length > 0) {
      handlePlayPlaylistQueue(tracks);
    }
  };

  const handlePlayTrack = (track: Track, index: number) => {
    handlePlayPlaylistQueue(tracks, index);
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--primary)' }} />
      </div>
    );
  }

  if (!album) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Disc3 className="w-16 h-16 mb-4" style={{ color: 'var(--muted-foreground)' }} />
        <p className="text-lg" style={{ color: 'var(--foreground)' }}>专辑不存在</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/home/albums')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回专辑列表
        </Button>
      </div>
    );
  }

  return (
    <div className="fade-in space-y-6">
      {/* 专辑头部 */}
      <div className="flex items-start gap-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/home/albums')}
          className="flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          返回
        </Button>
        <div className="flex items-start gap-5 flex-1">
          <div className="w-40 h-40 md:w-52 md:h-52 rounded-xl overflow-hidden flex-shrink-0" style={{ backgroundColor: 'var(--accent)' }}>
            {album.cover ? (
              <img src={album.cover} alt={album.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Disc3 className="w-16 h-16" style={{ color: 'var(--muted-foreground)' }} />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 pt-2">
            <h1 className="text-2xl md:text-3xl font-bold truncate" style={{ color: 'var(--foreground)' }}>{album.name}</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>{album.artist || '未知歌手'}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>{album.release_year ? `${album.release_year}年 · ` : ''}{tracks.length} 首歌曲</p>
            {tracks.length > 0 && (
              <Button
                onClick={handlePlayAll}
                className="mt-4"
                style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
              >
                <Play className="w-4 h-4 mr-2" fill="white" />
                播放全部
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 歌曲列表 */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium px-1" style={{ color: 'var(--muted-foreground)' }}>
          歌曲列表
        </h3>
        {tracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Music className="w-12 h-12 mb-3" style={{ color: 'var(--muted-foreground)' }} />
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>暂无歌曲</p>
          </div>
        ) : (
          <div className="space-y-1">
            {tracks.map((track, index) => (
              <motion.div
                key={track.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer group"
                style={{ backgroundColor: 'var(--card)' }}
                onClick={() => handlePlayTrack(track, index)}
              >
                <span className="w-6 text-xs text-center flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
                  {index + 1}
                </span>
                <div className="w-9 h-9 rounded-md overflow-hidden flex-shrink-0" style={{ backgroundColor: 'var(--accent)' }}>
                  {track.cover ? (
                    <img src={track.cover} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Music className="w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{track.title}</p>
                  <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>{track.artist}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    {formatDuration(track.duration)}
                  </span>
                  <Play className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--primary)' }} />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
