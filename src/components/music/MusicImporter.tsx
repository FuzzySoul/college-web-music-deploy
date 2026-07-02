'use client';

import { useState, useRef } from 'react';
import { Upload, Music, FileAudio, Trash2, Play, Check } from 'lucide-react';

export interface LocalTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  cover: string | null;
  file: File;
  objectUrl: string;
}

interface MusicImporterProps {
  onImport: (tracks: LocalTrack[]) => void;
  existingTracks: LocalTrack[];
}

const SUPPORTED_FORMATS = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/flac', 'audio/aac', 'audio/ogg', 'audio/x-m4a'];

export function MusicImporter({ onImport, existingTracks }: MusicImporterProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [pendingTracks, setPendingTracks] = useState<LocalTrack[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      processFiles(files);
    }
  };

  const processFiles = async (files: File[]) => {
    setIsProcessing(true);
    const audioFiles = files.filter(file => 
      SUPPORTED_FORMATS.includes(file.type) || 
      file.name.match(/\.(mp3|wav|flac|aac|ogg|m4a)$/i)
    );

    const newTracks: LocalTrack[] = [];

    for (const file of audioFiles) {
      const existingIds = new Set(existingTracks.map(t => t.id));
      const pendingIds = new Set(pendingTracks.map(t => t.id));
      const fileId = `local-${file.name}-${file.size}`;
      
      if (existingIds.has(fileId) || pendingIds.has(fileId)) continue;

      const objectUrl = URL.createObjectURL(file);
      const metadata = await extractMetadata(file, objectUrl);
      
      newTracks.push({
        id: fileId,
        title: metadata.title || file.name.replace(/\.[^/.]+$/, ''),
        artist: metadata.artist || '未知歌手',
        album: metadata.album || '本地音乐',
        duration: metadata.duration || 0,
        cover: metadata.cover ?? null,
        file,
        objectUrl,
      });
    }

    setPendingTracks(prev => [...prev, ...newTracks]);
    setIsProcessing(false);
  };

  const extractMetadata = async (file: File, objectUrl: string): Promise<{
    title?: string;
    artist?: string;
    album?: string;
    duration?: number;
    cover?: string | null;
  }> => {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.src = objectUrl;
      
      audio.onloadedmetadata = () => {
        resolve({
          title: file.name.replace(/\.[^/.]+$/, ''),
          artist: '未知歌手',
          album: '本地音乐',
          duration: audio.duration,
          cover: null,
        });
      };

      audio.onerror = () => {
        resolve({
          title: file.name.replace(/\.[^/.]+$/, ''),
          artist: '未知歌手',
          album: '本地音乐',
          duration: 0,
          cover: null,
        });
      };
    });
  };

  const removePendingTrack = (id: string) => {
    setPendingTracks(prev => {
      const track = prev.find(t => t.id === id);
      if (track) {
        URL.revokeObjectURL(track.objectUrl);
      }
      return prev.filter(t => t.id !== id);
    });
  };

  const confirmImport = async () => {
    setIsProcessing(true);
    
    const uploadedTracks: LocalTrack[] = [];
    
    for (const track of pendingTracks) {
      try {
        const formData = new FormData();
        formData.append('file', track.file);
        formData.append('title', track.title);
        formData.append('artist', track.artist);
        formData.append('album', track.album);
        
        const response = await fetch('/api/music/upload', {
          method: 'POST',
          body: formData,
        });
        
        const result = await response.json();
        
        if (result.success && result.track) {
          uploadedTracks.push({
            id: String(result.track.id),
            title: result.track.title,
            artist: result.track.artist,
            album: result.track.album,
            duration: result.track.duration,
            cover: result.track.cover,
            file: track.file,
            objectUrl: result.track.play_url,
          });
        } else {
          console.error('上传失败:', result.error);
        }
      } catch (error) {
        console.error('上传出错:', error);
      }
    }
    
    if (uploadedTracks.length > 0) {
      onImport(uploadedTracks);
    }
    
    setPendingTracks([]);
    setIsProcessing(false);
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <div
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300 ${
          isDragging 
            ? 'border-primary bg-primary/5 scale-[1.02]' 
            : 'border-border hover:border-primary/50'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="audio/*,.mp3,.wav,.flac,.aac,.ogg,.m4a"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <div className="flex flex-col items-center gap-4">
          <div 
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            <Upload className="w-8 h-8" style={{ color: 'var(--primary-foreground)' }} />
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--foreground)' }}>
              拖拽音乐文件到这里
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--muted-foreground)' }}>
              支持 MP3、WAV、FLAC、AAC、OGG 等格式
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-primary"
            >
              <FileAudio className="w-4 h-4" />
              选择文件
            </button>
          </div>
        </div>
      </div>

      {isProcessing && (
        <div className="flex items-center justify-center gap-3 py-4">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span style={{ color: 'var(--muted-foreground)' }}>正在处理文件...</span>
        </div>
      )}

      {pendingTracks.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium" style={{ color: 'var(--foreground)' }}>
              待导入 ({pendingTracks.length} 首)
            </h3>
            <button
              onClick={confirmImport}
              className="btn-primary"
            >
              <Check className="w-4 h-4" />
              确认导入
            </button>
          </div>

          <div className="space-y-2">
            {pendingTracks.map((track) => (
              <div
                key={track.id}
                className="flex items-center gap-4 p-3 rounded-lg"
                style={{ backgroundColor: 'var(--card)' }}
              >
                <div 
                  className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  {track.cover ? (
                    <img src={track.cover} alt="" className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <Music className="w-6 h-6" style={{ color: 'var(--muted-foreground)' }} />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{track.title}</div>
                  <div className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
                    {track.artist} · {track.album}
                  </div>
                </div>

                <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  {formatDuration(track.duration)}
                </div>

                <button
                  onClick={() => removePendingTrack(track.id)}
                  className="p-2 rounded-lg hover:bg-destructive/10 transition-colors"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {existingTracks.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium" style={{ color: 'var(--foreground)' }}>
            已导入 ({existingTracks.length} 首)
          </h3>

          <div className="space-y-2">
            {existingTracks.map((track) => (
              <div
                key={track.id}
                className="flex items-center gap-4 p-3 rounded-lg"
                style={{ backgroundColor: 'var(--card)' }}
              >
                <div 
                  className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  {track.cover ? (
                    <img src={track.cover} alt="" className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <Music className="w-6 h-6" style={{ color: 'var(--muted-foreground)' }} />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{track.title}</div>
                  <div className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
                    {track.artist} · {track.album}
                  </div>
                </div>

                <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  {formatDuration(track.duration)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
