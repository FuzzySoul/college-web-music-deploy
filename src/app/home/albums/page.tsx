'use client';

import { useState, useEffect, useMemo } from 'react';
import { Music, Disc3 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { usePlayer } from '../context/PlayerContext';

function Disc({ iconClassName }: { iconClassName?: string }) {
  return (
    <svg
      className={iconClassName}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-label="Disc"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default function AlbumsPage() {
  const { allTracks } = usePlayer();
  const router = useRouter();
  const [albums, setAlbums] = useState<any[]>([]);

  const loadArtistsAndAlbums = async () => {
    try {
      const response = await fetch('/api/music/sync-artists');
      if (response.ok) {
        const data = await response.json();
        setAlbums(data.albums || []);
      }
    } catch (error) {
      console.error('加载专辑失败:', error);
    }
  };

  useEffect(() => {
    loadArtistsAndAlbums();
  }, []);

  // 合并：albums 表为权威来源（带 cover），用 name 小写做匹配
  // 若 tracks 中有但 albums 中没有的，仍用 string 渲染（无 cover）
  const albumMap = useMemo(() => {
    const m = new Map<string, any>();
    albums.forEach(a => { if (a.name) m.set(a.name.toLowerCase(), a); });
    return m;
  }, [albums]);

  const trackAlbumNames = allTracks
    .map(t => t.album)
    .filter((name): name is string => Boolean(name));
  const uniqueTrackAlbums = [...new Set(trackAlbumNames)];

  // 优先用 albums 表数据（带 cover）；tracks 中独有的补充到末尾
  const merged: any[] = [];
  const seen = new Set<string>();
  albums.forEach(a => {
    if (a.name) {
      merged.push(a);
      seen.add(a.name.toLowerCase());
    }
  });
  uniqueTrackAlbums.forEach(name => {
    const key = name.toLowerCase();
    if (!seen.has(key)) {
      merged.push({ id: null, name, artist: '', cover: null });
      seen.add(key);
    }
  });

  const handleAlbumClick = (album: any) => {
    if (album.id) {
      router.push(`/home/albums/${album.id}`);
    } else {
      // tracks 独有专辑（无 albums.id）→ 用 name 查询
      router.push(`/home/albums/by-name?name=${encodeURIComponent(album.name)}`);
    }
  };

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-normal artistic-title">专辑</h2>
      </div>

      {merged.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {merged.map((album: any, index: number) => (
            <div
              key={`${album.id || 'track'}-${index}`}
              className="card-premium cursor-pointer text-center p-4 group"
              onClick={() => handleAlbumClick(album)}
            >
              <div className="w-20 h-20 mx-auto rounded-lg overflow-hidden mb-3 bg-muted relative">
                {album.cover || album.coverUrl ? (
                  <img src={album.cover || album.coverUrl} alt={album.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Disc3 className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
              </div>
              <p className="font-medium truncate">{album.name}</p>
              <p className="text-xs text-muted-foreground">{album.artist || (allTracks.find((t: any) => t.album === album.name)?.artist) || ''}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Music className="w-16 h-16" />
          <p className="text-lg font-medium mt-4">暂无专辑</p>
          <p className="text-sm mt-2">从外部歌单导入歌曲后可显示专辑信息</p>
        </div>
      )}
    </div>
  );
}
