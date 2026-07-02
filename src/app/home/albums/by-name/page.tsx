'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Play, Music, Disc3, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePlayer } from '../../context/PlayerContext';
import type { Track } from '@/lib/music-service';

function AlbumByNamePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { handlePlayPlaylistQueue } = usePlayer();
  const albumName = searchParams.get('name') || '';

  const [tracks, setTracks] = useState<Track[]>([]);
  const [cover, setCover] = useState<string | null>(null);
  const [artist, setArtist] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!albumName) return;
    loadAlbum();
  }, [albumName]);

  const loadAlbum = async () => {
    setLoading(true);
    try {
      // 查 tracks 表 album 字段匹配的歌曲
      const res = await fetch(`/api/music/album-tracks-by-name?name=${encodeURIComponent(albumName)}`);
      if (res.ok) {
        const data = await res.json();
        setTracks(data.tracks || []);
        setCover(data.cover || null);
        setArtist(data.artist || '');
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

  return (
    <div className="fade-in space-y-6">
      <div className="flex items-start gap-6">
        <Button variant="ghost" size="sm" onClick={() => router.push('/home/albums')} className="flex-shrink-0">
          <ArrowLeft className="w-4 h-4 mr-1" />
          返回
        </Button>
        <div className="flex items-start gap-5 flex-1">
          <div className="w-40 h-40 md:w-52 md:h-52 rounded-xl overflow-hidden flex-shrink-0" style={{ backgroundColor: 'var(--accent)' }}>
            {cover ? (
              <img src={cover} alt={albumName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Disc3 className="w-16 h-16" style={{ color: 'var(--muted-foreground)' }} />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 pt-2">
            <h1 className="text-2xl md:text-3xl font-bold truncate" style={{ color: 'var(--foreground)' }}>{albumName}</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>{artist || '未知歌手'}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>{tracks.length} 首歌曲</p>
            {tracks.length > 0 && (
              <Button onClick={handlePlayAll} className="mt-4" style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>
                <Play className="w-4 h-4 mr-2" fill="white" />
                播放全部
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium px-1" style={{ color: 'var(--muted-foreground)' }}>歌曲列表</h3>
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
                <span className="w-6 text-xs text-center flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>{index + 1}</span>
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
                <span className="text-xs flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>{formatDuration(track.duration)}</span>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AlbumByNamePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--primary)' }} />
        </div>
      }
    >
      <AlbumByNamePageContent />
    </Suspense>
  );
}
