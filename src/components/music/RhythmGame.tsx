'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw,
  Music,
  Loader2,
  ArrowLeft
} from 'lucide-react';

import { Track } from '@/lib/music-service';

interface Note {
  id: number;
  time: number;
  lane: number;
  hit: boolean;
  missed: boolean;
}

interface ChartData {
  track_id: number;
  difficulty: string;
  note_speed: number;
  judgment_window: number;
  notes: { time: number; lane: number }[];
}

type GameState = 'select' | 'difficulty' | 'playing';

const CONFIG = {
  LANES: 4,
  LANE_COLORS: ['#E91E63', '#2196F3', '#4CAF50', '#FF9800'],
  KEYS: { 'd': 0, 'f': 1, 'j': 2, 'k': 3 },
  DIFFICULTY_CONFIG: {
    easy: { label: 'Easy', color: '#4CAF50' },
    normal: { label: 'Normal', color: '#2196F3' },
    hard: { label: 'Hard', color: '#FF9800' },
    expert: { label: 'Expert', color: '#E91E63' }
  }
};

interface RhythmGameProps {
  allTracks: Track[];
}

export function RhythmGame({ allTracks }: RhythmGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const [gameState, setGameState] = useState<GameState>('select');
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('normal');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [chart, setChart] = useState<Note[]>([]);
  
  const [noteSpeed, setNoteSpeed] = useState(500);
  const [judgmentWindow, setJudgmentWindow] = useState(50);
  const [volume, setVolume] = useState(80);
  
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [perfect, setPerfect] = useState(0);
  const [great, setGreat] = useState(0);
  const [good, setGood] = useState(0);
  const [miss, setMiss] = useState(0);
  
  const [startTime, setStartTime] = useState(0);
  const [pauseTime, setPauseTime] = useState(0);
  const [activeNotes, setActiveNotes] = useState<number[]>([]);
  
  const [judgment, setJudgment] = useState<{text: string; className: string} | null>(null);
  const [progress, setProgress] = useState(0);

  const canvasWidth = 600;
  const canvasHeight = 600;
  const laneWidth = canvasWidth / CONFIG.LANES;
  const hitLineY = canvasHeight - 100;

  const fetchChart = async (trackId: number, difficulty: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/rhythm/charts?track_id=${trackId}&difficulty=${difficulty}`);
      if (!response.ok) throw new Error('获取谱面数据失败');
      const data: ChartData = await response.json();
      
      setNoteSpeed(data.note_speed || 500);
      setJudgmentWindow(data.judgment_window || 50);
      
      const newChart: Note[] = data.notes.map((n, i) => ({
        id: i,
        time: n.time,
        lane: n.lane,
        hit: false,
        missed: false
      }));
      
      setChart(newChart);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取谱面数据失败');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const selectDifficulty = async (difficulty: string) => {
    if (!selectedTrack) return;
    
    if (!selectedTrack.play_url) {
      setError('该曲目没有可播放的音频源');
      return;
    }
    
    setSelectedDifficulty(difficulty);
    const success = await fetchChart(selectedTrack.id, difficulty);
    
    if (success) {
      loadAudio(selectedTrack.play_url);
      setGameState('playing');
    }
  };

  const loadAudio = (url: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    if (!url) {
      setError('音频URL无效');
      return;
    }
    
    try {
      const audio = new Audio(url);
      audio.volume = volume / 100;
      audioRef.current = audio;
      
      audio.onerror = () => {
        setError('音频加载失败，请检查音频源');
      };
      
      audio.onended = () => {
        setIsPlaying(false);
        setIsPaused(false);
      };
    } catch (err) {
      setError('音频初始化失败');
    }
  };

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
    gradient.addColorStop(0, '#1a1816');
    gradient.addColorStop(1, '#2d2926');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    ctx.strokeStyle = 'rgba(166, 124, 82, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvasHeight; i += 40) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(canvasWidth, i);
      ctx.stroke();
    }
    
    for (let i = 0; i < CONFIG.LANES; i++) {
      const x = i * laneWidth;
      const laneGradient = ctx.createLinearGradient(x, 0, x + laneWidth, 0);
      laneGradient.addColorStop(0, 'rgba(166, 124, 82, 0.05)');
      laneGradient.addColorStop(0.5, 'rgba(166, 124, 82, 0.1)');
      laneGradient.addColorStop(1, 'rgba(166, 124, 82, 0.05)');
      ctx.fillStyle = laneGradient;
      ctx.fillRect(x, 0, laneWidth, canvasHeight);
      
      ctx.strokeStyle = 'rgba(166, 124, 82, 0.2)';
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasHeight);
      ctx.stroke();
    }
    
    const hitGradient = ctx.createLinearGradient(0, hitLineY - 20, 0, hitLineY + 20);
    hitGradient.addColorStop(0, 'transparent');
    hitGradient.addColorStop(0.5, 'rgba(166, 124, 82, 0.8)');
    hitGradient.addColorStop(1, 'transparent');
    
    ctx.shadowColor = '#A67C52';
    ctx.shadowBlur = 20;
    ctx.fillStyle = hitGradient;
    ctx.fillRect(0, hitLineY - 20, canvasWidth, 40);
    ctx.shadowBlur = 0;
    
    ctx.fillStyle = '#A67C52';
    ctx.fillRect(0, hitLineY - 2, canvasWidth, 4);
    
    if (!isPlaying && !isPaused) {
      const keys = ['D', 'F', 'J', 'K'];
      keys.forEach((key, i) => {
        const x = i * laneWidth + laneWidth / 2;
        ctx.beginPath();
        ctx.arc(x, hitLineY + 40, 25, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(166, 124, 82, 0.3)';
        ctx.fill();
        
        ctx.fillStyle = 'rgba(166, 124, 82, 0.8)';
        ctx.font = 'bold 14px DM Sans, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(key, x, hitLineY + 40);
      });
      return;
    }
    
    const audio = audioRef.current;
    const currentTime = isPlaying && audio ? 
      (audio.currentTime - startTime) : 
      pauseTime;
    
    const visibleTime = noteSpeed / 1000;
    
    chart.forEach(note => {
      if (note.hit || note.missed) return;
      
      const timeDiff = note.time - currentTime;
      if (timeDiff < -0.5 || timeDiff > visibleTime) return;
      
      const y = hitLineY - (timeDiff / visibleTime) * hitLineY;
      const x = note.lane * laneWidth + laneWidth / 2;
      const radius = laneWidth * 0.35;
      
      const color = CONFIG.LANE_COLORS[note.lane];
      
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 15;
      ctx.fill();
      ctx.shadowBlur = 0;
      
      ctx.beginPath();
      ctx.arc(x, y, radius * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fill();
    });
    
    const keys = ['D', 'F', 'J', 'K'];
    keys.forEach((key, i) => {
      const x = i * laneWidth + laneWidth / 2;
      const isPressed = activeNotes.includes(i);
      
      ctx.beginPath();
      ctx.arc(x, hitLineY + 40, 25, 0, Math.PI * 2);
      ctx.fillStyle = isPressed ? CONFIG.LANE_COLORS[i] : 'rgba(166, 124, 82, 0.3)';
      ctx.fill();
      
      ctx.fillStyle = isPressed ? '#fff' : 'rgba(166, 124, 82, 0.8)';
      ctx.font = 'bold 14px DM Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(key, x, hitLineY + 40);
    });
    
    if (audio && isPlaying) {
      const progressPercent = (currentTime / audio.duration) * 100;
      setProgress(Math.min(progressPercent, 100));
    }
    
    if (isPlaying || isPaused) {
      animationRef.current = requestAnimationFrame(render);
    }
  }, [chart, isPlaying, isPaused, activeNotes, startTime, pauseTime, noteSpeed]);

  useEffect(() => {
    render();
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [render]);

  useEffect(() => {
    if (!isPlaying || !audioRef.current) return;
    
    const checkMissed = setInterval(() => {
      const audio = audioRef.current;
      if (!audio) return;
      
      const currentTime = audio.currentTime - startTime;
      
      setChart(prev => prev.map(note => {
        if (note.hit || note.missed || note.time > currentTime) return note;
        if (currentTime - note.time > 0.2) {
          setMiss(m => m + 1);
          setCombo(0);
          setJudgment({ text: 'MISS', className: 'text-pink-500' });
          return { ...note, missed: true };
        }
        return note;
      }));
    }, 100);
    
    return () => clearInterval(checkMissed);
  }, [isPlaying, startTime]);

  const startGame = () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    audio.currentTime = 0;
    audio.play();
    
    setStartTime(audio.currentTime);
    setIsPlaying(true);
    setIsPaused(false);
    
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setPerfect(0);
    setGreat(0);
    setGood(0);
    setMiss(0);
    
    setChart(prev => prev.map(n => ({ ...n, hit: false, missed: false })));
  };

  const pauseGame = () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    audio.pause();
    setPauseTime(audio.currentTime - startTime);
    setIsPlaying(false);
    setIsPaused(true);
  };

  const resumeGame = () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    audio.play();
    setStartTime(audio.currentTime - pauseTime);
    setIsPlaying(true);
    setIsPaused(false);
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.repeat) return;
    
    const key = e.key.toLowerCase();
    if (CONFIG.KEYS.hasOwnProperty(key as keyof typeof CONFIG.KEYS)) {
      const lane = CONFIG.KEYS[key as keyof typeof CONFIG.KEYS];
      
      if (!activeNotes.includes(lane)) {
        setActiveNotes(prev => [...prev, lane]);
      }
      
      if (isPlaying && audioRef.current) {
        const audio = audioRef.current;
        const currentTime = audio.currentTime - startTime;
        
        let closestNote: Note | null = null;
        let closestDiff = Infinity;
        
        chart.forEach(note => {
          if (note.lane !== lane || note.hit || note.missed) return;
          const diff = Math.abs(note.time - currentTime);
          if (diff < closestDiff) {
            closestDiff = diff;
            closestNote = note;
          }
        });
        
        if (closestNote && closestDiff <= judgmentWindow / 1000) {
          setChart(prev => prev.map(n => 
            n.id === closestNote!.id ? { ...n, hit: true } : n
          ));
          
          let judgmentText: string, judgmentClass: string, points: number;
          if (closestDiff <= 0.05) {
            judgmentText = 'PERFECT';
            judgmentClass = 'text-yellow-400';
            points = 300 + combo * 10;
            setPerfect(p => p + 1);
          } else if (closestDiff <= 0.08) {
            judgmentText = 'GREAT';
            judgmentClass = 'text-green-400';
            points = 200 + combo * 5;
            setGreat(g => g + 1);
          } else {
            judgmentText = 'GOOD';
            judgmentClass = 'text-blue-400';
            points = 100;
            setGood(g => g + 1);
          }
          
          setCombo(c => {
            const newCombo = c + 1;
            if (newCombo > maxCombo) setMaxCombo(newCombo);
            return newCombo;
          });
          setScore(s => s + points);
          setJudgment({ text: judgmentText, className: judgmentClass });
        }
      }
    }
    
    if (e.key === ' ' && (isPlaying || isPaused)) {
      e.preventDefault();
      if (isPlaying) pauseGame();
      else resumeGame();
    }
  }, [isPlaying, isPaused, startTime, chart, judgmentWindow, combo, maxCombo, activeNotes]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    if (CONFIG.KEYS.hasOwnProperty(key)) {
      const lane = CONFIG.KEYS[key as keyof typeof CONFIG.KEYS];
      setActiveNotes(prev => prev.filter(l => l !== lane));
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  const goBack = () => {
    if (gameState === 'difficulty') {
      setGameState('select');
      setSelectedTrack(null);
    } else if (gameState === 'playing') {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
      setIsPaused(false);
      setGameState('difficulty');
    }
  };

  const getAccuracy = () => {
    const total = perfect + great + good + miss;
    if (total === 0) return 0;
    return Math.round(((perfect * 100 + great * 80 + good * 50) / (total * 100)) * 100);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (gameState === 'select') {
    return (
      <div className="fade-in">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-normal artistic-title">音游</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              选择曲目开始游戏
            </p>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--primary)' }} />
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl text-center" style={{ backgroundColor: 'var(--card)', color: 'var(--destructive)' }}>
            {error}
            <button onClick={() => window.location.reload()} className="ml-4 underline">刷新页面</button>
          </div>
        )}

        {!isLoading && !error && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {allTracks.map(track => (
              <div
                key={track.id}
                onClick={() => {
                  setSelectedTrack(track);
                  setGameState('difficulty');
                }}
                className="group cursor-pointer rounded-xl overflow-hidden border border-transparent hover:border-[var(--primary)]/30 transition-all duration-300"
                style={{ backgroundColor: 'var(--card)' }}
              >
                <div className="relative aspect-square">
                  <img
                    src={track.cover || 'https://picsum.photos/seed/default/400/400'}
                    alt={track.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--primary)' }}>
                      <Play className="w-6 h-6 ml-1 text-white" />
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-medium truncate group-hover:text-[var(--primary)] transition-colors">
                    {track.title}
                  </h3>
                  <p className="text-sm truncate mt-1" style={{ color: 'var(--muted-foreground)' }}>
                    {track.artist}
                  </p>
                  <div className="flex items-center justify-between mt-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    <span>{track.album || '未知专辑'}</span>
                    <span>{formatDuration(track.duration)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {allTracks.length === 0 && !isLoading && !error && (
          <div className="text-center py-20" style={{ color: 'var(--muted-foreground)' }}>
            <Music className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>暂无曲目</p>
            <p className="text-sm mt-2">请先在音乐库中添加音乐</p>
          </div>
        )}
      </div>
    );
  }

  if (gameState === 'difficulty') {
    return (
      <div className="fade-in">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={goBack} className="p-2 rounded-lg hover:bg-[var(--accent)] transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-2xl font-normal artistic-title">选择难度</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              {selectedTrack?.title} - {selectedTrack?.artist}
            </p>
          </div>
        </div>

        <div className="flex gap-6 mb-8">
          <div className="w-48 h-48 rounded-xl overflow-hidden flex-shrink-0">
            <img
              src={selectedTrack?.cover || 'https://picsum.photos/seed/default/400/400'}
              alt={selectedTrack?.title}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-medium mb-2">{selectedTrack?.title}</h3>
            <p style={{ color: 'var(--muted-foreground)' }}>{selectedTrack?.artist}</p>
            <div className="flex gap-4 mt-4 text-sm" style={{ color: 'var(--muted-foreground)' }}>
              <span>{selectedTrack?.album || '未知专辑'}</span>
              <span>{formatDuration(selectedTrack?.duration || 0)}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(CONFIG.DIFFICULTY_CONFIG).map(([key, config]) => (
            <button
              key={key}
              onClick={() => selectDifficulty(key)}
              disabled={isLoading}
              className="p-6 rounded-xl border-2 border-transparent hover:border-[var(--primary)] transition-all duration-300 disabled:opacity-50"
              style={{ backgroundColor: 'var(--card)' }}
            >
              <div
                className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: config.color }}
              >
                {config.label.charAt(0)}
              </div>
              <div className="font-medium text-center">{config.label}</div>
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center mt-8">
            <Loader2 className="w-6 h-6 animate-spin mr-2" style={{ color: 'var(--primary)' }} />
            <span style={{ color: 'var(--muted-foreground)' }}>加载中...</span>
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 rounded-xl text-center" style={{ backgroundColor: 'var(--card)', color: 'var(--destructive)' }}>
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={goBack} className="p-2 rounded-lg hover:bg-[var(--accent)] transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-2xl font-normal artistic-title">{selectedTrack?.title}</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              {selectedTrack?.artist} · {CONFIG.DIFFICULTY_CONFIG[selectedDifficulty as keyof typeof CONFIG.DIFFICULTY_CONFIG]?.label}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="relative rounded-xl overflow-hidden" style={{ backgroundColor: '#1a1816' }}>
            <canvas
              ref={canvasRef}
              width={canvasWidth}
              height={canvasHeight}
              className="w-full max-w-full"
              style={{ aspectRatio: '1/1' }}
            />
            
            {judgment && (
              <div className="absolute top-1/3 left-1/2 -translate-x-1/2 text-4xl font-bold animate-pulse">
                <span className={judgment.className}>{judgment.text}</span>
              </div>
            )}
            
            {combo > 0 && (
              <div className="absolute top-1/2 right-8 text-right">
                <div className="text-5xl font-bold" style={{ color: 'var(--primary)' }}>{combo}</div>
                <div className="text-xs uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>Combo</div>
              </div>
            )}
            
            <div className="absolute bottom-0 left-0 right-0 h-1" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
              <div className="h-full transition-all duration-100" style={{ 
                width: `${progress}%`,
                background: 'linear-gradient(90deg, var(--primary), var(--accent))'
              }} />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--card)' }}>
            <div className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--muted-foreground)' }}>当前曲目</div>
            {selectedTrack && (
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg overflow-hidden">
                  <img src={selectedTrack.cover || 'https://picsum.photos/seed/default/400/400'} alt={selectedTrack.title} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{selectedTrack.title}</div>
                  <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    {formatDuration(selectedTrack.duration)}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--card)' }}>
            <div className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--muted-foreground)' }}>难度</div>
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                style={{ backgroundColor: CONFIG.DIFFICULTY_CONFIG[selectedDifficulty as keyof typeof CONFIG.DIFFICULTY_CONFIG]?.color }}
              >
                {selectedDifficulty.charAt(0).toUpperCase()}
              </div>
              <span className="font-medium">{CONFIG.DIFFICULTY_CONFIG[selectedDifficulty as keyof typeof CONFIG.DIFFICULTY_CONFIG]?.label}</span>
            </div>
          </div>

          <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--card)' }}>
            <div className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--muted-foreground)' }}>设置</div>
            
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>下落速度</span>
                  <span style={{ color: 'var(--primary)' }}>{noteSpeed}</span>
                </div>
                <input
                  type="range"
                  min="200"
                  max="1000"
                  value={noteSpeed}
                  onChange={(e) => setNoteSpeed(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>判定区间</span>
                  <span style={{ color: 'var(--primary)' }}>±{judgmentWindow}ms</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="100"
                  value={judgmentWindow}
                  onChange={(e) => setJudgmentWindow(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>音量</span>
                  <span style={{ color: 'var(--primary)' }}>{volume}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(e) => {
                    const vol = parseInt(e.target.value);
                    setVolume(vol);
                    if (audioRef.current) audioRef.current.volume = vol / 100;
                  }}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--card)' }}>
            <div className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--muted-foreground)' }}>统计</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 rounded-lg" style={{ backgroundColor: 'var(--accent)' }}>
                <div className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>{score}</div>
                <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Score</div>
              </div>
              <div className="text-center p-3 rounded-lg" style={{ backgroundColor: 'var(--accent)' }}>
                <div className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>{maxCombo}</div>
                <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Max Combo</div>
              </div>
              <div className="text-center p-3 rounded-lg" style={{ backgroundColor: 'var(--accent)' }}>
                <div className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>{getAccuracy()}%</div>
                <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Accuracy</div>
              </div>
              <div className="text-center p-3 rounded-lg" style={{ backgroundColor: 'var(--accent)' }}>
                <div className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>{chart.length}</div>
                <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Notes</div>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => isPlaying ? pauseGame() : isPaused ? resumeGame() : startGame()}
              className="flex-1 btn btn-primary"
            >
              {isPlaying ? <><Pause className="w-4 h-4" /> 暂停</> : <><Play className="w-4 h-4" /> {isPaused ? '继续' : '开始'}</>}
            </button>
            <button onClick={startGame} className="btn">
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
