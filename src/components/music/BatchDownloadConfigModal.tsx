'use client';

import { X, Download, Loader2 } from 'lucide-react';
import { YouTubeIcon, BilibiliIcon } from './PlatformIcons';

interface BatchDownloadConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  youtubeCount: number;
  bilibiliCount: number;
  onYoutubeCountChange: (count: number) => void;
  onBilibiliCountChange: (count: number) => void;
  trackCount: number;
  isDownloading: boolean;
  progress: { current: number; total: number };
}

export function BatchDownloadConfigModal({
  isOpen,
  onClose,
  onConfirm,
  youtubeCount,
  bilibiliCount,
  onYoutubeCountChange,
  onBilibiliCountChange,
  trackCount,
  isDownloading,
  progress,
}: BatchDownloadConfigModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl p-6 space-y-4" style={{ backgroundColor: 'var(--card)' }}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">批量下载配置</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-accent rounded-full"
            disabled={isDownloading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          配置每个搜索源的搜索数量，将下载 {trackCount} 首歌曲
        </p>

        <div className="space-y-3">
          <label className="flex items-center gap-3">
            <span className="text-sm w-24">YouTube:</span>
            <input
              type="number"
              min="0"
              max="10"
              value={youtubeCount}
              onChange={(e) => onYoutubeCountChange(parseInt(e.target.value) || 0)}
              className="w-20 p-2 rounded-lg border"
              disabled={isDownloading}
            />
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>个结果</span>
          </label>
          <label className="flex items-center gap-3">
            <span className="text-sm w-24">Bilibili:</span>
            <input
              type="number"
              min="0"
              max="10"
              value={bilibiliCount}
              onChange={(e) => onBilibiliCountChange(parseInt(e.target.value) || 0)}
              className="w-20 p-2 rounded-lg border"
              disabled={isDownloading}
            />
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>个结果</span>
          </label>
        </div>

        {isDownloading ? (
          <div className="text-center py-4">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" style={{ color: 'var(--primary)' }} />
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              下载中... {progress.current}/{progress.total}
            </p>
          </div>
        ) : (
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary flex-1">
              取消
            </button>
            <button onClick={onConfirm} className="btn-primary flex-1">
              <Download className="w-4 h-4 mr-1" />
              开始下载
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
