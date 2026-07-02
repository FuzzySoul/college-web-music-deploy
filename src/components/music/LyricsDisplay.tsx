'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Copy, Check, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import type { LyricLine, LyricsDisplayProps } from './types';

function parseLrc(lrcText: string): LyricLine[] {
  const lines: LyricLine[] = [];
  if (!lrcText || !lrcText.trim()) return lines;

  const timeTagRegex = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
  const lineRegex = /((?:\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\])+)(.*)/;

  for (const rawLine of lrcText.split('\n')) {
    const trimmedLine = rawLine.trim();
    if (!trimmedLine) continue;

    const match = trimmedLine.match(lineRegex);
    if (match) {
      const timeTagsStr = match[1];
      const text = match[2].trim();

      let timeMatch: RegExpExecArray | null;
      timeTagRegex.lastIndex = 0;

      while ((timeMatch = timeTagRegex.exec(timeTagsStr)) !== null) {
        const minutes = parseInt(timeMatch[1], 10);
        const seconds = parseInt(timeMatch[2], 10);
        const msStr = timeMatch[3] || '0';
        const ms =
          msStr.length === 1
            ? parseInt(msStr, 10) * 100
            : msStr.length === 2
              ? parseInt(msStr, 10) * 10
              : parseInt(msStr, 10);

        const totalMs = minutes * 60 * 1000 + seconds * 1000 + ms;

        if (totalMs >= 0 && text) {
          lines.push({ time: totalMs, text });
        }
      }
    }
  }

  lines.sort((a, b) => a.time - b.time);

  return lines;
}

const OFFSET_STEP = 500;
const OFFSET_MAX = 10000;
const OFFSET_STORAGE_KEY = 'lyrics-offset';

function getStoredOffset(trackId: string | number): number {
  try {
    const stored = localStorage.getItem(`${OFFSET_STORAGE_KEY}-${trackId}`);
    return stored ? parseInt(stored, 10) : 0;
  } catch {
    return 0;
  }
}

function setStoredOffset(trackId: string | number, offset: number) {
  try {
    localStorage.setItem(`${OFFSET_STORAGE_KEY}-${trackId}`, String(offset));
  } catch {}
}

export function LyricsDisplay({
  lyrics,
  currentTime = 0,
  onSeek,
  height = 300,
  className = '',
  trackId,
}: LyricsDisplayProps) {
  const parsedLyrics = useMemo(() => parseLrc(lyrics), [lyrics]);

  const [offset, setOffset] = useState(0);
  const offsetInitializedRef = useRef(false);

  useEffect(() => {
    if (trackId != null && !offsetInitializedRef.current) {
      setOffset(getStoredOffset(trackId));
      offsetInitializedRef.current = true;
    }
  }, [trackId]);

  useEffect(() => {
    return () => {
      offsetInitializedRef.current = false;
    };
  }, [trackId]);

  const adjustOffset = useCallback((delta: number) => {
    setOffset(prev => {
      const next = Math.max(-OFFSET_MAX, Math.min(OFFSET_MAX, prev + delta));
      if (trackId != null) setStoredOffset(trackId, next);
      return next;
    });
  }, [trackId]);

  const resetOffset = useCallback(() => {
    setOffset(0);
    if (trackId != null) setStoredOffset(trackId, 0);
  }, [trackId]);

  const currentLineIndex = useMemo(() => {
    if (parsedLyrics.length === 0) return -1;
    const currentTimeMs = currentTime * 1000 + offset;

    let lo = 0, hi = parsedLyrics.length - 1, result = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      if (parsedLyrics[mid].time <= currentTimeMs) {
        result = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return result;
  }, [parsedLyrics, currentTime, offset]);

  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const [copiedLineIndex, setCopiedLineIndex] = useState<number | null>(null);
  const isUserScrollingRef = useRef(false);
  const isProgrammaticScrollRef = useRef(false);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onScroll = () => {
      if (isProgrammaticScrollRef.current) return;
      isUserScrollingRef.current = true;
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = setTimeout(() => {
        isUserScrollingRef.current = false;
      }, 3000);
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', onScroll);
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (
      currentLineIndex >= 0 &&
      activeLineRef.current &&
      containerRef.current &&
      !isUserScrollingRef.current
    ) {
      const container = containerRef.current;
      const lineEl = activeLineRef.current;
      const containerHeight = container.clientHeight;
      const lineTop = lineEl.offsetTop;

      isProgrammaticScrollRef.current = true;
      container.scrollTo({
        top: lineTop - containerHeight / 2 + lineEl.offsetHeight / 2,
        behavior: 'smooth',
      });
      requestAnimationFrame(() => {
        isProgrammaticScrollRef.current = false;
      });
    }
  }, [currentLineIndex]);

  const handleLineClick = useCallback(
    (line: LyricLine) => {
      if (onSeek) {
        onSeek(line.time / 1000);
      }
    },
    [onSeek]
  );

  const copyLine = useCallback(
    async (text: string, index: number) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopiedLineIndex(index);
        toast.success('已复制歌词');
        setTimeout(() => setCopiedLineIndex(null), 1500);
      } catch {
        toast.error('复制失败');
      }
    },
    []
  );

  if (!lyrics || !lyrics.trim()) {
    return (
      <div
        className={`flex flex-col items-center justify-center ${className}`}
        style={{ height }}
      >
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-3"
        >
          <FileText
            className="w-12 h-12"
            style={{ color: 'var(--muted-foreground)', opacity: 0.4 }}
          />
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            暂无歌词
          </p>
        </motion.div>
      </div>
    );
  }

  if (parsedLyrics.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center ${className}`}
        style={{ height }}
      >
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-3 px-6 text-center"
        >
          <FileText
            className="w-12 h-12"
            style={{ color: 'var(--muted-foreground)', opacity: 0.4 }}
          />
          <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            无法解析歌词格式
          </p>
          <p className="text-xs max-w-xs" style={{ color: 'var(--muted-foreground)' }}>
            请确保歌词为标准 LRC 格式：每行以 [分:秒.毫秒] 时间标签开头
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative" style={{ height }}>
      <div
        ref={containerRef}
        className={`absolute inset-0 overflow-y-auto overflow-x-hidden scrollbar-thin ${className}`}
        style={{
          WebkitOverflowScrolling: 'touch',
          maskImage:
            'linear-gradient(to bottom, black 0%, black 90%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to bottom, black 0%, black 90%, transparent 100%)',
        }}
        role="list"
        aria-label="歌词显示"
      >
        <div style={{ height: 8 }} aria-hidden="true" />
        {parsedLyrics.map((line, index) => {
          const isActive = index === currentLineIndex;
          const isPast = index < currentLineIndex;

          return (
            <div
              key={index}
              ref={isActive ? activeLineRef : undefined}
              onClick={() => handleLineClick(line)}
              onDoubleClick={() => copyLine(line.text, index)}
              className="group relative py-1.5 px-4 mx-auto cursor-pointer rounded-lg hover:bg-white/[0.04] dark:hover:bg-white/[0.03]"
              role="listitem"
              aria-label={`${line.text}${isActive ? ' (正在播放)' : ''}`}
              style={{
                maxWidth: '85%',
                textAlign: 'center',
                lineHeight: 1.8,
                transition: 'color 0.3s ease, font-size 0.3s ease, font-weight 0.3s ease, background 0.3s ease, transform 0.3s ease',
                fontWeight: isActive ? 600 : 400,
                fontSize: isActive ? '17px' : isPast ? '15px' : '16px',
                color: isActive
                  ? 'var(--primary)'
                  : isPast
                    ? 'rgba(128,128,128,0.6)'
                    : 'var(--foreground)',
                background: isActive
                  ? 'linear-gradient(90deg, transparent, rgba(193,95,60,0.06), transparent)'
                  : 'transparent',
                transform: isActive ? 'scale(1.04)' : 'scale(1)',
                transformOrigin: 'center',
              }}
            >
              {isActive && (
                <div
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full"
                  style={{
                    backgroundColor: 'var(--primary)',
                    transition: 'opacity 0.3s ease',
                  }}
                />
              )}

              <span className="relative z-10">{line.text || '--'}</span>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  copyLine(line.text, index);
                }}
                className="absolute right-0 top-1/2 -translate-y-1/2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity bg-[var(--card)] border border-[var(--border)] shadow-sm"
                title="复制这行歌词"
                aria-label={`复制歌词: ${line.text}`}
              >
                {copiedLineIndex === index ? (
                  <Check className="w-3 h-3 text-green-500" />
                ) : (
                  <Copy className="w-3 h-3" style={{ color: 'var(--muted-foreground)' }} />
                )}
              </button>
            </div>
          );
        })}
        <div style={{ height: height * 0.45 }} aria-hidden="true" />

        {currentTime > 0 && (
          <div className="sticky bottom-2 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
            <span
              className="inline-block px-3 py-1 rounded-full text-xs backdrop-blur-sm"
              style={{
                backgroundColor: 'rgba(0,0,0,0.4)',
                color: 'rgba(255,255,255,0.7)',
              }}
            >
              {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, '0')}
            </span>
          </div>
        )}
      </div>

      <div
        className="absolute bottom-3 right-3 z-20 flex items-center gap-1 rounded-full px-2 py-1 backdrop-blur-md"
        style={{
          backgroundColor: 'rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <button
          onClick={() => adjustOffset(-OFFSET_STEP)}
          className="p-1 rounded-full transition-colors hover:bg-white/10"
          style={{ color: 'rgba(255,255,255,0.7)' }}
          title="歌词提前0.5秒"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={resetOffset}
          className="px-1.5 py-0.5 rounded text-[10px] tabular-nums transition-colors hover:bg-white/10 min-w-[42px] text-center"
          style={{ color: offset === 0 ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.9)' }}
          title="重置偏移"
        >
          {offset === 0 ? '0s' : `${offset > 0 ? '+' : ''}${(offset / 1000).toFixed(1)}s`}
        </button>
        <button
          onClick={() => adjustOffset(OFFSET_STEP)}
          className="p-1 rounded-full transition-colors hover:bg-white/10"
          style={{ color: 'rgba(255,255,255,0.7)' }}
          title="歌词延后0.5秒"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
        {offset !== 0 && (
          <button
            onClick={resetOffset}
            className="p-1 rounded-full transition-colors hover:bg-white/10"
            style={{ color: 'rgba(255,255,255,0.5)' }}
            title="重置"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

export { parseLrc };
export type { LyricLine };

export default LyricsDisplay;
