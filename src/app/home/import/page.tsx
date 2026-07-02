'use client';

import { MusicImporter } from '@/components/music/MusicImporter';
import { usePlayer } from '../context/PlayerContext';

export default function ImportPage() {
  const { localTracks, setLocalTracks } = usePlayer();

  const handleImport = async (importedTracks: any[]) => {
    setLocalTracks([...localTracks, ...importedTracks]);
  };

  return (
    <div className="fade-in">
      <div className="mb-8">
        <h2 className="text-2xl font-normal artistic-title mb-3">导入音乐</h2>
        <p className="text-base" style={{ color: 'var(--muted-foreground)' }}>
          从本地文件夹添加音乐文件到音乐库
        </p>
      </div>
      <MusicImporter onImport={handleImport} existingTracks={localTracks} />
    </div>
  );
}
