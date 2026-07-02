'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  FileAudio,
  Music,
  Image as ImageIcon,
  Film,
  FileText,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  ClipboardPaste,
  Download,
  Trash2,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import type { UploadStep, UploadFormData } from './types';

// 步骤配置
const STEPS: { key: UploadStep; label: string; description: string }[] = [
  { key: 'select', label: '选择音频', description: '上传音乐文件' },
  { key: 'metadata', label: '填写信息', description: '编辑歌曲信息' },
  { key: 'mv', label: 'MV视频', description: '可选上传MV' },
  { key: 'lyrics', label: '歌词', description: '添加LRC歌词' },
  { key: 'confirm', label: '确认', description: '检查并上传' },
];

const SUPPORTED_AUDIO_FORMATS = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/flac',
  'audio/aac',
  'audio/ogg',
  'audio/x-m4a',
];

const SUPPORTED_VIDEO_FORMATS = ['video/mp4', 'video/webm'];

interface LocalMusicUploaderProps {
  onUploadComplete?: () => void;
  onCancel?: () => void;
}

/**
 * 本地音乐上传组件
 * 支持分步向导：选择音频 -> 填写元信息 -> 上传MV(可选) -> 添加歌词(可选) -> 确认上传
 */
export function LocalMusicUploader({
  onUploadComplete,
  onCancel,
}: LocalMusicUploaderProps) {
  // 当前步骤
  const [currentStep, setCurrentStep] = useState<UploadStep>('select');
  const stepIndex = STEPS.findIndex((s) => s.key === currentStep);

  // 表单数据
  const [formData, setFormData] = useState<UploadFormData>({
    audioFile: null,
    title: '',
    artist: '',
    album: '',
    coverFile: null,
    coverPreview: null,
    mvFile: null,
    mvPreview: null,
    lyrics: '',
    storageType: 'supabase',
  });

  // 上传状态
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [audioDuration, setAudioDuration] = useState<number>(0);

  // 文件输入引用
  const audioInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const mvInputRef = useRef<HTMLInputElement>(null);

  // 获取音频时长
  const getAudioDuration = useCallback((file: File): Promise<number> => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const audio = new Audio();
      audio.src = url;
      audio.onloadedmetadata = () => {
        setAudioDuration(audio.duration);
        URL.revokeObjectURL(url);
        resolve(audio.duration);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(0);
      };
    });
  }, []);

  // 处理音频文件选择
  const handleAudioFileSelect = useCallback(
    async (file: File) => {
      if (!SUPPORTED_AUDIO_FORMATS.includes(file.type) && !/\.(mp3|wav|flac|aac|ogg|m4a)$/i.test(file.name)) {
        toast.error('不支持的音频格式');
        return;
      }

      // 自动从文件名提取标题
      const fileName = file.name.replace(/\.[^/.]+$/, '');
      const duration = await getAudioDuration(file);

      setFormData((prev) => ({
        ...prev,
        audioFile: file,
        title: prev.title || fileName,
        artist: prev.artist || '未知歌手',
        album: prev.album || '本地音乐',
      }));
      setAudioDuration(duration);
    },
    [getAudioDuration]
  );

  // 处理拖拽
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
    const file = e.dataTransfer.files[0];
    if (file) handleAudioFileSelect(file);
  };

  // 处理封面文件
  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      return;
    }
    const preview = URL.createObjectURL(file);
    setFormData((prev) => ({ ...prev, coverFile: file, coverPreview: preview }));
  };

  // 处理MV文件
  const handleMvSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!SUPPORTED_VIDEO_FORMATS.includes(file.type)) {
      toast.error('仅支持 MP4 或 WebM 格式');
      return;
    }
    const preview = URL.createObjectURL(file);
    setFormData((prev) => ({ ...prev, mvFile: file, mvPreview: preview }));
  };

  // 从剪贴板粘贴歌词
  const handlePasteLyrics = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setFormData((prev) => ({ ...prev, lyrics: text }));
      toast.success('已粘贴歌词内容');
    } catch {
      toast.error('无法读取剪贴板，请手动粘贴');
    }
  };

  // 导入LRC文件
  const importLrcFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setFormData((prev) => ({ ...prev, lyrics: text }));
      toast.success('歌词文件导入成功');
    };
    reader.readAsText(file);
  };

  // 导出LRC文件
  const exportLrcFile = () => {
    if (!formData.lyrics.trim()) {
      toast.warning('没有可导出的歌词内容');
      return;
    }
    const blob = new Blob([formData.lyrics], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${formData.title || 'lyrics'}.lrc`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('歌词文件已导出');
  };

  // 清空歌词
  const clearLyrics = () => {
    setFormData((prev) => ({ ...prev, lyrics: '' }));
  };

  // 步骤导航
  const goNext = () => {
    const nextIndex = stepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].key);
    }
  };

  const goPrev = () => {
    const prevIndex = stepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].key);
    }
  };

  // 验证当前步骤
  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 'select':
        return formData.audioFile !== null;
      case 'metadata':
        return formData.title.trim().length > 0 && formData.artist.trim().length > 0;
      default:
        return true;
    }
  }, [currentStep, formData.audioFile, formData.title, formData.artist]);

  // 执行上传
  const handleUpload = async () => {
    if (!formData.audioFile) {
      toast.error('请先选择音频文件');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      let trackId: number | null = null;

      // Step 1: 上传音频
      const audioData = new FormData();
      audioData.append('file', formData.audioFile);
      audioData.append('title', formData.title);
      audioData.append('artist', formData.artist);
      audioData.append('album', formData.album);
      audioData.append('storage', formData.storageType);
      if (audioDuration > 0) {
        audioData.append('duration', String(Math.round(audioDuration)));
      }

      if (formData.coverFile) {
        audioData.append('cover', formData.coverFile);
      }

      setUploadProgress(10);
      const audioResponse = await fetch('/api/music/local-tracks/upload/audio', {
        method: 'POST',
        body: audioData,
      });
      const audioResult = await audioResponse.json();

      if (!audioResult.success) {
        throw new Error(audioResult.error || '音频上传失败');
      }

      trackId = audioResult.track?.id || audioResult.data?.id;
      if (!trackId) throw new Error('未获取到曲目ID');

      setUploadProgress(50);

      // Step 2: 上传MV（如果有）
      if (formData.mvFile && trackId) {
        const mvData = new FormData();
        mvData.append('file', formData.mvFile);
        mvData.append('track_id', String(trackId));
        mvData.append('storage', formData.storageType);

        const mvResponse = await fetch('/api/music/local-tracks/upload/mv', {
          method: 'POST',
          body: mvData,
        });
        const mvResult = await mvResponse.json();

        if (!mvResult.success) {
          console.warn('MV上传失败:', mvResult.error);
          toast.warning(`音频已上传，但MV失败: ${mvResult.error}`);
        }
      }

      setUploadProgress(80);

      // Step 3: 保存歌词（如果有）
      if (formData.lyrics.trim() && trackId) {
        const lyricsData = new FormData();
        lyricsData.append('track_id', String(trackId));
        lyricsData.append('lyrics', formData.lyrics);

        const lyricsResponse = await fetch('/api/music/local-tracks/upload/lyrics', {
          method: 'PUT',
          body: lyricsData,
        });
        const lyricsResult = await lyricsResponse.json();

        if (!lyricsResult.success) {
          console.warn('歌词保存失败:', lyricsResult.error);
          toast.warning(`歌词保存失败: ${lyricsResult.error}`);
        }
      }

      setUploadProgress(100);
      toast.success(`"${formData.title}" 上传成功！`);
      onUploadComplete?.();

      // 清理预览URL
      if (formData.coverPreview) URL.revokeObjectURL(formData.coverPreview);
      if (formData.mvPreview) URL.revokeObjectURL(formData.mvPreview);
    } catch (error) {
      console.error('上传出错:', error);
      toast.error('网络错误，上传失败');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // 格式化时长
  const formatDuration = (seconds: number): string => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 渲染步骤指示器
  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {STEPS.map((step, idx) => (
        <div key={step.key} className="flex items-center">
          {/* 步骤圆圈 */}
          <motion.div
            className={`flex items-center justify-center w-9 h-9 rounded-full text-sm font-medium border-2 transition-all duration-300 ${
              idx === stepIndex
                ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)] scale-110'
                : idx < stepIndex
                  ? 'border-green-500 bg-green-500 text-white'
                  : 'border-[var(--border)] bg-transparent text-[var(--muted-foreground)]'
            }`}
            whileHover={{ scale: idx <= stepIndex ? 1.05 : 1 }}
            whileTap={{ scale: 0.95 }}
          >
            {idx < stepIndex ? (
              <Check className="w-4 h-4" />
            ) : (
              idx + 1
            )}
          </motion.div>

          {/* 步骤标签 */}
          {idx < STEPS.length - 1 && (
            <div
              className={`w-12 sm:w-20 h-0.5 mx-2 transition-colors duration-300 ${
                idx < stepIndex ? 'bg-green-500' : 'bg-[var(--border)]'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );

  // 渲染 Step 1: 选择音频
  const renderSelectStep = () => (
    <div className="space-y-6">
      <div
        className={`relative border-2 border-dashed rounded-2xl p-10 sm:p-16 text-center transition-all duration-300 cursor-pointer ${
          isDragging
            ? 'border-[var(--primary)] bg-[var(--primary)]/5 scale-[1.02]'
            : formData.audioFile
              ? 'border-green-500/40 bg-green-500/5'
              : 'border-[var(--border)] hover:border-[var(--primary)]/50'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => audioInputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="点击或拖拽上传音频文件"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') audioInputRef.current?.click();
        }}
      >
        <input
          ref={audioInputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.flac,.aac,.ogg,.m4a"
          onChange={(e) => e.target.files?.[0] && handleAudioFileSelect(e.target.files[0])}
          className="hidden"
        />

        <AnimatePresence mode="wait">
          {formData.audioFile ? (
            <motion.div
              key="selected"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="space-y-4"
            >
              <div
                className="w-20 h-20 mx-auto rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: 'rgba(var(--primary-rgb), 0.1)' }}
              >
                <Music className="w-10 h-10" style={{ color: 'var(--primary)' }} />
              </div>
              <div>
                <p className="font-medium" style={{ color: 'var(--foreground)' }}>
                  {formData.audioFile.name}
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
                  {(formData.audioFile.size / 1024 / 1024).toFixed(2)} MB{' '}
                  {audioDuration && `· ${formatDuration(audioDuration)}`}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setFormData((prev) => ({ ...prev, audioFile: null }));
                  setAudioDuration(0);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg hover:bg-red-500/10 text-red-500 transition-colors"
              >
                <X className="w-3 h-3" /> 重新选择
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div
                className="w-20 h-20 mx-auto rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <Upload
                  className="w-10 h-10"
                  style={{ color: 'var(--muted-foreground)' }}
                />
              </div>
              <div>
                <h3
                  className="text-lg font-medium"
                  style={{ color: 'var(--foreground)' }}
                >
                  拖拽音频文件到这里
                </h3>
                <p
                  className="text-sm mt-2"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  支持 MP3、WAV、FLAC、AAC、OGG、M4A 格式
                </p>
              </div>
              <button
                className="btn-primary inline-flex items-center gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  audioInputRef.current?.click();
                }}
              >
                <FileAudio className="w-4 h-4" />
                选择文件
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 存储方式选择 */}
      <div className="flex items-center gap-6">
        <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
          存储方式:
        </span>
        <label className="flex items-center gap-2 cursor-pointer group">
          <input
            type="radio"
            name="storageType"
            value="supabase"
            checked={formData.storageType === 'supabase'}
            onChange={() =>
              setFormData((prev) => ({ ...prev, storageType: 'supabase' }))
            }
            className="w-4 h-4 accent-[var(--primary)]"
          />
          <span className="text-sm group-hover:text-[var(--primary)] transition-colors" style={{ color: 'var(--muted-foreground)' }}>
            Supabase 云端
          </span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer group">
          <input
            type="radio"
            name="storageType"
            value="local"
            checked={formData.storageType === 'local'}
            onChange={() =>
              setFormData((prev) => ({ ...prev, storageType: 'local' }))
            }
            className="w-4 h-4 accent-[var(--primary)]"
          />
          <span className="text-sm group-hover:text-[var(--primary)] transition-colors" style={{ color: 'var(--muted-foreground)' }}>
            本地存储
          </span>
        </label>
      </div>
    </div>
  );

  // 渲染 Step 2: 填写元信息
  const renderMetadataStep = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* 左侧：表单 */}
      <div className="space-y-5">
        <div>
          <label
            className="block text-sm font-medium mb-2"
            style={{ color: 'var(--foreground)' }}
          >
            歌曲标题 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, title: e.target.value }))
            }
            placeholder="输入歌曲名称"
            className="w-full px-4 py-2.5 text-sm rounded-xl border transition-all duration-200 focus:outline-none focus:ring-2"
            style={{
              backgroundColor: 'var(--card)',
              borderColor: 'var(--border)',
              color: 'var(--foreground)',
              '--tw-ring-color': 'rgba(193, 95, 60, 0.3)',
            } as React.CSSProperties}
          />
        </div>

        <div>
          <label
            className="block text-sm font-medium mb-2"
            style={{ color: 'var(--foreground)' }}
          >
            歌手名称 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.artist}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, artist: e.target.value }))
            }
            placeholder="输入歌手名称"
            className="w-full px-4 py-2.5 text-sm rounded-xl border transition-all duration-200 focus:outline-none focus:ring-2"
            style={{
              backgroundColor: 'var(--card)',
              borderColor: 'var(--border)',
              color: 'var(--foreground)',
              '--tw-ring-color': 'rgba(193, 95, 60, 0.3)',
            } as React.CSSProperties}
          />
        </div>

        <div>
          <label
            className="block text-sm font-medium mb-2"
            style={{ color: 'var(--foreground)' }}
          >
            专辑名称
          </label>
          <input
            type="text"
            value={formData.album}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, album: e.target.value }))
            }
            placeholder="输入专辑名称（可选）"
            className="w-full px-4 py-2.5 text-sm rounded-xl border transition-all duration-200 focus:outline-none focus:ring-2"
            style={{
              backgroundColor: 'var(--card)',
              borderColor: 'var(--border)',
              color: 'var(--foreground)',
              '--tw-ring-color': 'rgba(193, 95, 60, 0.3)',
            } as React.CSSProperties}
          />
        </div>

        {/* 封面上传 */}
        <div>
          <label
            className="block text-sm font-medium mb-2"
            style={{ color: 'var(--foreground)' }}
          >
            专辑封面
          </label>
          <div
            className="flex items-center gap-4 p-4 rounded-xl border border-dashed cursor-pointer hover:border-[var(--primary)]/50 transition-colors"
            style={{ borderColor: 'var(--border)' }}
            onClick={() => coverInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') coverInputRef.current?.click();
            }}
          >
            {formData.coverPreview ? (
              <img
                src={formData.coverPreview}
                alt="封面预览"
                className="w-16 h-16 rounded-lg object-cover"
              />
            ) : (
              <div
                className="w-16 h-16 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <ImageIcon
                  className="w-6 h-6"
                  style={{ color: 'var(--muted-foreground)' }}
                />
              </div>
            )}
            <div className="flex-1">
              <p className="text-sm" style={{ color: 'var(--foreground)' }}>
                {formData.coverFile ? formData.coverFile.name : '点击选择封面图片'}
              </p>
              <p
                className="text-xs mt-0.5"
                style={{ color: 'var(--muted-foreground)' }}
              >
                支持 JPG、PNG、WebP 格式
              </p>
            </div>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              onChange={handleCoverSelect}
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* 右侧：预览 */}
      <div className="flex flex-col items-center justify-start pt-4">
        <p
          className="text-sm font-medium mb-4"
          style={{ color: 'var(--muted-foreground)' }}
        >
          预览效果
        </p>
        <motion.div
          layout
          className="w-full max-w-[280px] rounded-2xl overflow-hidden shadow-lg"
          style={{
            backgroundColor: 'var(--card)',
            border: '1px solid var(--border)',
          }}
        >
          {/* 封面区域 */}
          <div className="aspect-square relative overflow-hidden">
            {formData.coverPreview ? (
              <img
                src={formData.coverPreview}
                alt="封面预览"
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <Music
                  className="w-20 h-20"
                  style={{ color: 'var(--muted-foreground)', opacity: 0.3 }}
                />
              </div>
            )}
          </div>
          {/* 信息区域 */}
          <div className="p-4 space-y-1">
            <p className="font-semibold text-base truncate" style={{ color: 'var(--foreground)' }}>
              {formData.title || '歌曲标题'}
            </p>
            <p className="text-sm truncate" style={{ color: 'var(--muted-foreground)' }}>
              {formData.artist || '歌手名称'}
            </p>
            {(formData.album || audioDuration) && (
              <div
                className="flex items-center justify-between text-xs pt-2 border-t"
                style={{
                  color: 'var(--muted-foreground)',
                  borderColor: 'var(--border)',
                }}
              >
                <span>{formData.album || '-'}</span>
                <span>{formatDuration(audioDuration)}</span>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );

  // 渲染 Step 3: MV视频
  const renderMvStep = () => (
    <div className="space-y-6">
      <div
        className="p-6 rounded-xl border border-dashed cursor-pointer hover:border-[var(--primary)]/50 transition-all duration-200"
        style={{ borderColor: 'var(--border)' }}
        onClick={() => mvInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter') mvInputRef.current?.click();
        }}
      >
        <input
          ref={mvInputRef}
          type="file"
          accept="video/mp4,video/webm"
          onChange={handleMvSelect}
          className="hidden"
        />

        {formData.mvPreview ? (
          <div className="space-y-4">
            <video
              src={formData.mvPreview}
              className="w-full max-h-[240px] rounded-lg object-contain bg-black"
              controls
            />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>
                  {formData.mvFile?.name}
                </p>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  {(formData.mvFile?.size ? formData.mvFile.size / 1024 / 1024 : 0).toFixed(2)} MB
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (formData.mvPreview) URL.revokeObjectURL(formData.mvPreview);
                  setFormData((prev) => ({
                    ...prev,
                    mvFile: null,
                    mvPreview: null,
                  }));
                }}
                className="p-2 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-6">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <Film
                className="w-7 h-7"
                style={{ color: 'var(--muted-foreground)' }}
              />
            </div>
            <div className="text-center">
              <p className="font-medium" style={{ color: 'var(--foreground)' }}>
                上传 MV 视频（可选）
              </p>
              <p
                className="text-sm mt-1"
                style={{ color: 'var(--muted-foreground)' }}
              >
                支持 MP4、WebM 格式，建议 1080p 以下
              </p>
            </div>
          </div>
        )}
      </div>

      <p
        className="text-xs text-center"
        style={{ color: 'var(--muted-foreground)' }}
      >
        此步骤为可选，跳过将直接进入下一步
      </p>
    </div>
  );

  // 渲染 Step 4: 歌词
  const renderLyricsStep = () => (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept='.lrc,.txt';
            input.onchange = (e) => importLrcFile(e as unknown as React.ChangeEvent<HTMLInputElement>);
            input.click();
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors hover:bg-[var(--accent)]"
          style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
        >
          <FileText className="w-3.5 h-3.5" /> 导入 .lrc
        </button>
        <button
          onClick={exportLrcFile}
          disabled={!formData.lyrics.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors hover:bg-[var(--accent)] disabled:opacity-50"
          style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
        >
          <Download className="w-3.5 h-3.5" /> 导出 .lrc
        </button>
        <button
          onClick={handlePasteLyrics}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors hover:bg-[var(--accent)]"
          style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
        >
          <ClipboardPaste className="w-3.5 h-3.5" /> 粘贴
        </button>
        <button
          onClick={clearLyrics}
          disabled={!formData.lyrics.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
        >
          <Trash2 className="w-3.5 h-3.5" /> 清空
        </button>
        <div className="ml-auto text-xs" style={{ color: 'var(--muted-foreground)' }}>
          {formData.lyrics.split('\n').filter(Boolean).length} 行 ·{' '}
          {formData.lyrics.length} 字符
        </div>
      </div>

      {/* LRC 编辑区 */}
      <textarea
        value={formData.lyrics}
        onChange={(e) =>
          setFormData((prev) => ({ ...prev, lyrics: e.target.value }))
        }
        placeholder="[00:00.00] 在这里粘贴或输入 LRC 格式歌词...&#10;&#10;格式示例：&#10;[00:12.34] 第一行歌词&#10;[00:18.56] 第二行歌词&#10;[00:24.78] 第三行歌词"
        rows={12}
        className="w-full px-4 py-3 text-sm rounded-xl border font-mono leading-relaxed resize-y transition-all duration-200 focus:outline-none focus:ring-2"
        spellCheck={false}
        style={{
          backgroundColor: 'var(--card)',
          borderColor: 'var(--border)',
          color: 'var(--foreground)',
          '--tw-ring-color': 'rgba(193, 95, 60, 0.3)',
        } as React.CSSProperties}
      />

      {/* LRC 格式提示 */}
      <div
        className="flex items-start gap-2 p-3 rounded-lg text-xs"
        style={{ backgroundColor: 'rgba(var(--primary-rgb), 0.05)', color: 'var(--muted-foreground)' }}
      >
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div>
          <p>LRC 格式说明：每行以 [分:秒.毫秒] 时间标签开头，后跟歌词文本</p>
          <p className="mt-1">示例：[03:24.50] 这是一行歌词文本</p>
        </div>
      </div>
    </div>
  );

  // 渲染 Step 5: 确认
  const renderConfirmStep = () => (
    <div className="space-y-6">
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          backgroundColor: 'var(--card)',
          border: '1px solid var(--border)',
        }}
      >
        {/* 确认卡片头部 - 封面+基本信息 */}
        <div className="flex flex-col sm:flex-row gap-4 p-6">
          {/* 封面 */}
          <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-xl overflow-hidden flex-shrink-0">
            {formData.coverPreview ? (
              <img
                src={formData.coverPreview}
                alt="封面"
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <Music
                  className="w-12 h-12"
                  style={{ color: 'var(--muted-foreground)', opacity: 0.3 }}
                />
              </div>
            )}
          </div>

          {/* 基本信息 */}
          <div className="flex-1 space-y-2 min-w-0">
            <h3
              className="text-xl font-semibold truncate"
              style={{ color: 'var(--foreground)' }}
            >
              {formData.title || '(未命名)'}
            </h3>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {formData.artist || '未知歌手'}
            </p>
            {formData.album && (
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                专辑：{formData.album}
              </p>
            )}

            <div className="flex flex-wrap gap-3 pt-2">
              {formData.audioFile && (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs"
                  style={{
                    backgroundColor: 'rgba(var(--primary-rgb), 0.1)',
                    color: 'var(--primary)',
                  }}
                >
                  <Music className="w-3 h-3" />
                  {formData.audioFile.name}
                  {' '}
                  {audioDuration && `(${formatDuration(audioDuration)})`}
                </span>
              )}
              {formData.mvFile && (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs"
                  style={{
                    backgroundColor: 'rgba(234, 179, 8, 0.1)',
                    color: '#EAB308',
                  }}
                >
                  <Film className="w-3 h-3" />
                  MV 视频
                </span>
              )}
              {formData.lyrics.trim() && (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs"
                  style={{
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    color: '#22C55E',
                  }}
                >
                  <FileText className="w-3 h-3" />
                  {formData.lyrics.split('\n').filter(Boolean).length} 行歌词
                </span>
              )}
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--muted-foreground)',
                }}
              >
                {formData.storageType === 'supabase' ? '云端存储' : '本地存储'}
              </span>
            </div>
          </div>
        </div>

        {/* 分隔线 */}
        <div style={{ height: 1, backgroundColor: 'var(--border)' }} />

        {/* 详细信息列表 */}
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {[
            { label: '音频文件', value: formData.audioFile?.name || '-', icon: Music },
            { label: '文件大小', value: formData.audioFile ? `${(formData.audioFile.size / 1024 / 1024).toFixed(2)} MB` : '-', icon: null },
            { label: 'MV视频', value: formData.mvFile?.name || '未上传', icon: Film },
            { label: '歌词', value: formData.lyrics.trim() ? `${formData.lyrics.split('\n').filter(Boolean).length} 行` : '无', icon: FileText },
            { label: '存储方式', value: formData.storageType === 'supabase' ? 'Supabase 云端' : '本地文件系统', icon: null },
          ].map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="flex items-center gap-3 px-6 py-3"
            >
              {Icon && (
                <Icon
                  className="w-4 h-4 flex-shrink-0"
                  style={{ color: 'var(--muted-foreground)' }}
                />
              )}
              {!Icon && <span className="w-4" />}
              <span
                className="text-sm w-20 flex-shrink-0"
                style={{ color: 'var(--muted-foreground)' }}
              >
                {label}
              </span>
              <span
                className="text-sm font-medium"
                style={{ color: 'var(--foreground)' }}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 上传进度条 */}
      {isUploading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
              <Loader2 className="w-4 h-4 animate-spin" />
              正在上传...
            </span>
            <span style={{ color: 'var(--muted-foreground)' }}>
              {Math.round(uploadProgress)}%
            </span>
          </div>
          <div
            className="w-full h-2 rounded-full overflow-hidden"
            style={{ backgroundColor: 'var(--muted)' }}
          >
            <motion.div
              className="h-full rounded-full progress-glow"
              style={{ backgroundColor: 'var(--primary)' }}
              initial={{ width: 0 }}
              animate={{ width: `${uploadProgress}%` }}
              transition={{ ease: 'easeOut', duration: 0.3 }}
            />
          </div>
        </div>
      )}
    </div>
  );

  // 根据当前步骤渲染内容
  const renderStepContent = () => {
    switch (currentStep) {
      case 'select':
        return renderSelectStep();
      case 'metadata':
        return renderMetadataStep();
      case 'mv':
        return renderMvStep();
      case 'lyrics':
        return renderLyricsStep();
      case 'confirm':
        return renderConfirmStep();
      default:
        return null;
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      {/* 步骤指示器 */}
      {renderStepIndicator()}

      {/* 当前步骤标题 */}
      <div className="text-center mb-6">
        <motion.h2
          key={currentStep}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xl font-semibold"
          style={{ color: 'var(--foreground)', fontFamily: "'Instrument Serif', serif" }}
        >
          {STEPS[stepIndex]?.label}
        </motion.h2>
        <motion.p
          key={`${currentStep}-desc`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-sm mt-1"
          style={{ color: 'var(--muted-foreground)' }}
        >
          {STEPS[stepIndex]?.description}
        </motion.p>
      </div>

      {/* 步骤内容区域 - 带切换动画 */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        >
          {renderStepContent()}
        </motion.div>
      </AnimatePresence>

      {/* 底部导航按钮 */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3">
          {stepIndex > 0 && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={goPrev}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm rounded-xl border transition-all duration-200 hover:bg-[var(--accent)]"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              <ChevronLeft className="w-4 h-4" />
              上一步
            </motion.button>
          )}
          {onCancel && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onCancel}
              className="px-5 py-2.5 text-sm rounded-xl transition-colors hover:bg-[var(--accent)]"
              style={{ color: 'var(--muted-foreground)' }}
            >
              取消
            </motion.button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {currentStep === 'confirm' ? (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleUpload}
              disabled={isUploading || !canProceed}
              className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  上传中...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  开始上传
                </>
              )}
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={goNext}
              disabled={!canProceed}
              className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
            >
              下一步
              <ChevronRight className="w-4 h-4" />
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}

export default LocalMusicUploader;
