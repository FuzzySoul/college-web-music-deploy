'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ImagePlus, Upload, Link2, Music2, Loader2, Check } from 'lucide-react';

/* ============================================================
   类型定义
   ============================================================ */
export interface PlaylistFormDialogProps {
  /** 对话框是否打开 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 表单模式：创建或编辑 */
  mode: 'create' | 'edit';
  /** 编辑模式的初始数据 */
  initialData?: {
    id?: string;
    name?: string;
    description?: string;
    cover?: string | null;
  };
  /** 提交回调（异步，支持 loading） */
  onSubmit: (data: {
    name: string;
    description?: string;
    cover?: string;
  }) => Promise<void>;
  /** 提交中状态 */
  isLoading?: boolean;
}

/** 封面输入方式类型 */
type CoverInputMode = 'url' | 'upload';

/* ============================================================
   常量配置
   ============================================================ */
const NAME_MAX_LENGTH = 100;
const DESC_MAX_LENGTH = 500;

/* ============================================================
   主组件
   ============================================================ */
export function PlaylistFormDialog({
  open,
  onClose,
  mode,
  initialData,
  onSubmit,
  isLoading = false,
}: PlaylistFormDialogProps) {

  /* ---------- 状态管理 ---------- */
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [coverMode, setCoverMode] = useState<CoverInputMode>('url');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* Refs */
  const nameInputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ---------- 初始化表单数据 ---------- */
  useEffect(() => {
    if (open && initialData) {
      setName(initialData.name || '');
      setDescription(initialData.description || '');
      setCoverUrl(initialData.cover || '');
    } else if (open && mode === 'create') {
      // 创建模式重置表单
      setName('');
      setDescription('');
      setCoverUrl('');
      setErrors({});
    }
  }, [open, initialData, mode]);

  /* ---------- 自动聚焦 ---------- */
  useEffect(() => {
    if (open) {
      // 使用 setTimeout 确保 DOM 已渲染
      const timer = setTimeout(() => {
        nameInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

  /* ---------- ESC 键关闭 ---------- */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !isSubmitting && !isLoading) {
      onClose();
    }
  }, [onClose, isSubmitting, isLoading]);

  /* ---------- 遮罩层点击关闭 ---------- */
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    // 只有点击遮罩本身才关闭，不冒泡
    if (e.target === overlayRef.current && !isSubmitting && !isLoading) {
      onClose();
    }
  }, [onClose, isSubmitting, isLoading]);

  /* ---------- 表单验证 ---------- */
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // 名称验证
    const trimmedName = name.trim();
    if (!trimmedName) {
      newErrors.name = '请输入歌单名称';
    } else if (trimmedName.length > NAME_MAX_LENGTH) {
      newErrors.name = `名称不能超过 ${NAME_MAX_LENGTH} 个字符`;
    }

    // 描述验证（可选字段，只检查长度）
    if (description.length > DESC_MAX_LENGTH) {
      newErrors.description = `描述不能超过 ${DESC_MAX_LENGTH} 个字符`;
    }

    // URL 格式验证（如果填写了）
    if (coverUrl.trim()) {
      try {
        new URL(coverUrl.trim());
      } catch {
        newErrors.cover = '请输入有效的图片 URL 地址';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /* ---------- 提交处理 ---------- */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || isSubmitting || isLoading) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        cover: coverUrl.trim() || undefined,
      });
      // 成功后由父组件关闭对话框
    } catch (error) {
      console.error('[PlaylistFormDialog] 提交失败:', error);
      setErrors({ submit: '提交失败，请稍后重试' });
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ---------- 清除封面 ---------- */
  const handleClearCover = () => {
    setCoverUrl('');
    setErrors(prev => {
      const next = { ...prev };
      delete next.cover;
      return next;
    });
  };

  /* ---------- 文件选择和转换（Base64 Data URL） ---------- */
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      setErrors(prev => ({ ...prev, cover: '仅支持 JPG、PNG、WebP、GIF 格式的图片' }));
      return;
    }

    // 验证文件大小（最大 5MB）
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setErrors(prev => ({ ...prev, cover: '图片大小不能超过 5MB' }));
      return;
    }

    // 使用 FileReader 转换为 Base64 Data URL
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result && result.startsWith('data:')) {
        setCoverUrl(result);
        setCoverMode('url'); // 切换回 url 模式以显示预览
        if (errors.cover) {
          setErrors(prev => {
            const next = { ...prev };
            delete next.cover;
            return next;
          });
        }
        console.log('[PlaylistFormDialog] Image loaded, size:', Math.round(result.length / 1024), 'KB');
      } else {
        setErrors(prev => ({ ...prev, cover: '图片加载失败' }));
      }
    };
    reader.onerror = () => {
      setErrors(prev => ({ ...prev, cover: '图片读取失败，请重试' }));
    };

    reader.readAsDataURL(file);

    // 重置 input 以便再次选择同一文件
    event.target.value = '';
  }, [errors.cover]);

  /* ---------- 计算属性 ---------- */
  const isFormValid = name.trim().length > 0 && name.trim().length <= NAME_MAX_LENGTH;
  const displayName = mode === 'create' ? '创建歌单' : '编辑歌单';

  /* ---------- 客户端挂载检测（修复 Portal 不显示的核心） ---------- */
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 服务端/未挂载时：open=true 显示 fallback，否则返回 null
  if (!mounted || typeof window === 'undefined') {
    return open ? (
      <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: 'var(--card)', padding: '40px', borderRadius: '16px', color: 'var(--foreground)' }}>
          加载中...
        </div>
      </div>
    ) : null;
  }

  // 核心：createPortal 移到最外层，AnimatePresence 内部处理条件渲染
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={overlayRef}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          onClick={handleOverlayClick}
          onKeyDown={handleKeyDown}
        >
          {/* 背景遮罩 */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            aria-hidden="true"
          />

          {/* 对话框主体 - 保持所有现有内容不变 */}
          <motion.div
            className="relative w-full max-w-lg overflow-hidden rounded-2xl"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              boxShadow:
                '0 24px 48px rgba(0,0,0,0.18), 0 8px 16px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.06)',
            }}
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label={displayName}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ====== 头部区域 ====== */}
            <div
              className="flex items-center justify-between px-6 py-5 border-b"
              style={{ borderColor: 'var(--border)' }}
            >
              <div>
                <h2
                  className="text-xl font-normal"
                  style={{
                    color: 'var(--foreground)',
                    fontFamily: 'var(--font-display)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {displayName}
                </h2>
                <p
                  className="text-xs mt-1"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  {mode === 'create' ? '填写信息以创建新的音乐歌单' : '修改歌单的基本信息'}
                </p>
              </div>

              {/* 关闭按钮 */}
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting || isLoading}
                className="flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200 ease-out hover:scale-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  color: 'var(--muted-foreground)',
                  background: 'transparent',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--accent)';
                  e.currentTarget.style.color = 'var(--foreground)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--muted-foreground)';
                }}
                aria-label="关闭"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ====== 表单内容 ====== */}
            <form onSubmit={handleSubmit} noValidate>
              <div className="px-6 py-5 space-y-5 max-h-[calc(80vh-140px)] overflow-y-auto">
                {/* ---- 封面图片区域 ---- */}
                <div className="space-y-3">
                  <label
                    className="block text-sm font-medium"
                    style={{ color: 'var(--foreground)' }}
                  >
                    封面图片
                    <span className="ml-1.5 text-xs font-normal" style={{ color: 'var(--muted-foreground)' }}>
                      （可选）
                    </span>
                  </label>

                  {/* 封面预览 */}
                  <div className="relative group">
                    <div
                      className="relative w-full aspect-video max-h-[200px] rounded-xl overflow-hidden flex items-center justify-center transition-all duration-300 ease-out"
                      style={{
                        background: coverUrl
                          ? 'transparent'
                          : 'linear-gradient(135deg, var(--muted) 0%, var(--accent) 100%)',
                        border: `1px solid ${errors.cover ? 'var(--destructive)' : 'var(--border)'}`,
                      }}
                    >
                      {coverUrl ? (
                        <>
                          <img
                            src={coverUrl}
                            alt="封面预览"
                            className="w-full h-full object-cover"
                            onError={() => {
                              setErrors(prev => ({ ...prev, cover: '图片加载失败，请检查 URL' }));
                              setCoverUrl('');
                            }}
                          />
                          {/* 清除按钮 */}
                          <button
                            type="button"
                            onClick={handleClearCover}
                            className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-lg bg-black/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-black/80 hover:scale-110 active:scale-95"
                            style={{ color: '#ffffff' }}
                            aria-label="清除封面"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <Music2
                            className="w-10 h-10 opacity-30"
                            style={{ color: 'var(--muted-foreground)' }}
                          />
                          <span
                            className="text-xs opacity-50"
                            style={{ color: 'var(--muted-foreground)' }}
                          >
                            无封面预览
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 输入方式切换 Tab */}
                  <div
                    className="inline-flex rounded-lg p-1"
                    style={{
                      background: 'var(--muted)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setCoverMode('url')}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ease-out ${
                        coverMode === 'url'
                          ? 'shadow-sm'
                          : 'hover:opacity-70'
                      }`}
                      style={{
                        background: coverMode === 'url' ? 'var(--card)' : 'transparent',
                        color: coverMode === 'url' ? 'var(--foreground)' : 'var(--muted-foreground)',
                        border: coverMode === 'url' ? '1px solid var(--border)' : 'none',
                      }}
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      URL 链接
                    </button>
                    <button
                      type="button"
                      onClick={() => setCoverMode('upload')}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ease-out ${
                        coverMode === 'upload'
                          ? 'shadow-sm'
                          : 'hover:opacity-70'
                      }`}
                      style={{
                        background: coverMode === 'upload' ? 'var(--card)' : 'transparent',
                        color: coverMode === 'upload' ? 'var(--foreground)' : 'var(--muted-foreground)',
                        border: coverMode === 'upload' ? '1px solid var(--border)' : 'none',
                      }}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      本地上传
                    </button>
                  </div>

                  {/* URL 输入框 */}
                  {coverMode === 'url' && (
                    <div className="relative">
                      <input
                        type="text"
                        value={coverUrl}
                        onChange={(e) => {
                          setCoverUrl(e.target.value);
                          if (errors.cover) {
                            setErrors(prev => {
                              const next = { ...prev };
                              delete next.cover;
                              return next;
                            });
                          }
                        }}
                        placeholder="粘贴图片 URL 地址..."
                        className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all duration-200 ease-out"
                        style={{
                          background: 'var(--input)',
                          border: `1px solid ${errors.cover ? 'var(--destructive)' : 'var(--border)'}`,
                          color: 'var(--foreground)',
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = 'var(--primary)';
                          e.target.style.boxShadow = '0 0 0 3px rgba(193, 95, 60, 0.1)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = errors.cover ? 'var(--destructive)' : 'var(--border)';
                          e.target.style.boxShadow = 'none';
                        }}
                      />
                      <Link2
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4"
                        style={{ color: 'var(--muted-foreground)', opacity: 0.5 }}
                      />
                    </div>
                  )}

                  {/* 本地上传区域（完整实现） */}
                  {coverMode === 'upload' && (
                    <>
                      {/* 隐藏的文件 input */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={handleFileSelect}
                        className="hidden"
                        aria-label="选择封面图片文件"
                      />

                      {/* 上传区域 UI */}
                      <div
                        className="flex flex-col items-center justify-center gap-2 py-6 rounded-lg border-2 border-dashed cursor-pointer transition-all duration-200 ease-out hover:border-[var(--primary)]/50 hover:bg-[var(--accent)]/50 group"
                        style={{
                          borderColor: errors.cover ? 'var(--destructive)' : 'var(--border)',
                          color: 'var(--muted-foreground)',
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          e.currentTarget.style.borderColor = 'var(--primary)';
                          e.currentTarget.style.background = 'rgba(var(--primary), 0.05)';
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          e.currentTarget.style.borderColor = errors.cover ? 'var(--destructive)' : 'var(--border)';
                          e.currentTarget.style.background = 'transparent';
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          e.currentTarget.style.borderColor = errors.cover ? 'var(--destructive)' : 'var(--border)';
                          e.currentTarget.style.background = 'transparent';

                          const files = e.dataTransfer.files;
                          if (files.length > 0 && fileInputRef.current) {
                            // 触发 handleFileSelect
                            const syntheticEvent = {
                              target: { files: files, value: '' }
                            } as React.ChangeEvent<HTMLInputElement>;
                            handleFileSelect(syntheticEvent);
                          }
                        }}
                      >
                        <div className="w-12 h-12 rounded-full flex items-center justify-center transition-transform duration-200 ease-out group-hover:scale-110" style={{ background: 'var(--muted)' }}>
                          <Upload className="w-6 h-6 opacity-50" />
                        </div>
                        <p className="text-sm font-medium mt-1">点击或拖拽上传图片</p>
                        <p className="text-xs opacity-60">支持 JPG、PNG、WebP、GIF · 最大 5MB</p>
                      </div>
                    </>
                  )}

                  {/* 错误提示 */}
                  {errors.cover && (
                    <p className="text-xs flex items-center gap-1" style={{ color: 'var(--destructive)' }}>
                      {errors.cover}
                    </p>
                  )}
                </div>

                {/* ---- 歌单名称 ---- */}
                <div className="space-y-2">
                  <label
                    htmlFor="playlist-name"
                    className="flex items-center justify-between text-sm font-medium"
                    style={{ color: 'var(--foreground)' }}
                  >
                    <span>
                      歌单名称
                      <span className="ml-1" style={{ color: 'var(--destructive)' }}>*</span>
                    </span>
                    <span
                      className="text-xs font-normal tabular-nums"
                      style={{
                        color: name.length > NAME_MAX_LENGTH
                          ? 'var(--destructive)'
                          : 'var(--muted-foreground)',
                      }}
                    >
                      {name.length} / {NAME_MAX_LENGTH}
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      ref={nameInputRef}
                      id="playlist-name"
                      type="text"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value.slice(0, NAME_MAX_LENGTH));
                        if (errors.name) {
                          setErrors(prev => {
                            const next = { ...prev };
                            delete next.name;
                            return next;
                          });
                        }
                      }}
                      placeholder="输入歌单名称"
                      maxLength={NAME_MAX_LENGTH}
                      disabled={isSubmitting || isLoading}
                      autoComplete="off"
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200 ease-out disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        background: 'var(--input)',
                        border: `1px solid ${errors.name ? 'var(--destructive)' : 'var(--border)'}`,
                        color: 'var(--foreground)',
                        boxShadow: errors.name ? '0 0 0 3px rgba(220, 38, 38, 0.1)' : 'none',
                      }}
                      onFocus={(e) => {
                        if (!errors.name) {
                          e.target.style.borderColor = 'var(--primary)';
                          e.target.style.boxShadow = '0 0 0 3px rgba(193, 95, 60, 0.1)';
                        }
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = errors.name ? 'var(--destructive)' : 'var(--border)';
                        e.target.style.boxShadow = errors.name ? '0 0 0 3px rgba(220, 38, 38, 0.1)' : 'none';
                      }}
                    />
                  </div>
                  {errors.name && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xs flex items-center gap-1"
                      style={{ color: 'var(--destructive)' }}
                    >
                      {errors.name}
                    </motion.p>
                  )}
                </div>

                {/* ---- 歌单描述 ---- */}
                <div className="space-y-2">
                  <label
                    htmlFor="playlist-desc"
                    className="flex items-center justify-between text-sm font-medium"
                    style={{ color: 'var(--foreground)' }}
                  >
                    <span>描述</span>
                    <span
                      className="text-xs font-normal tabular-nums"
                      style={{
                        color: description.length > DESC_MAX_LENGTH
                          ? 'var(--destructive)'
                          : 'var(--muted-foreground)',
                      }}
                    >
                      {description.length} / {DESC_MAX_LENGTH}
                    </span>
                  </label>
                  <textarea
                    id="playlist-desc"
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value.slice(0, DESC_MAX_LENGTH));
                      if (errors.description) {
                        setErrors(prev => {
                          const next = { ...prev };
                          delete next.description;
                          return next;
                        });
                      }
                    }}
                    placeholder="添加描述（可选）"
                    maxLength={DESC_MAX_LENGTH}
                    rows={3}
                    disabled={isSubmitting || isLoading}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none transition-all duration-200 ease-out disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: 'var(--input)',
                      border: `1px solid ${errors.description ? 'var(--destructive)' : 'var(--border)'}`,
                      color: 'var(--foreground)',
                      lineHeight: '1.6',
                    }}
                    onFocus={(e) => {
                      if (!errors.description) {
                        e.target.style.borderColor = 'var(--primary)';
                        e.target.style.boxShadow = '0 0 0 3px rgba(193, 95, 60, 0.1)';
                      }
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = errors.description ? 'var(--destructive)' : 'var(--border)';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                  {errors.description && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xs"
                      style={{ color: 'var(--destructive)' }}
                    >
                      {errors.description}
                    </motion.p>
                  )}
                </div>

                {/* 全局提交错误 */}
                {errors.submit && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 px-4 py-3 rounded-lg"
                    style={{
                      background: 'rgba(220, 38, 38, 0.08)',
                      border: '1px solid rgba(220, 38, 38, 0.2)',
                      color: 'var(--destructive)',
                    }}
                  >
                    <X className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs">{errors.submit}</span>
                  </motion.div>
                )}
              </div>

              {/* ====== 底部操作栏 ====== */}
              <div
                className="flex items-center justify-end gap-3 px-6 py-4 border-t"
                style={{
                  borderColor: 'var(--border)',
                  background: 'rgba(var(--background), 0.3)',
                }}
              >
                {/* 取消按钮 */}
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting || isLoading}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: 'transparent',
                    color: 'var(--foreground)',
                    border: '1px solid var(--border)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--accent)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  取消
                </button>

                {/* 提交按钮 */}
                <button
                  type="submit"
                  disabled={!isFormValid || isSubmitting || isLoading}
                  className="relative inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium transition-all duration-250 ease-out disabled:cursor-not-allowed overflow-hidden"
                  style={{
                    background: isFormValid && !isSubmitting && !isLoading
                      ? 'var(--primary)'
                      : 'var(--muted)',
                    color: isFormValid && !isSubmitting && !isLoading
                      ? 'var(--primary-foreground)'
                      : 'var(--muted-foreground)',
                    boxShadow: isFormValid && !isSubmitting && !isLoading
                      ? '0 2px 10px rgba(193, 95, 60, 0.25), inset 0 1px 0 rgba(255,255,255,0.15)'
                      : 'none',
                    opacity: (!isFormValid || isSubmitting || isLoading) ? 0.55 : 1,
                    transform: (!isFormValid || isSubmitting || isLoading) ? 'none' : undefined,
                  }}
                  onMouseEnter={(e) => {
                    if (isFormValid && !isSubmitting && !isLoading) {
                      e.currentTarget.style.transform = 'translateY(-1px) scale(1.02)';
                      e.currentTarget.style.boxShadow =
                        '0 6px 20px rgba(193, 95, 60, 0.35), inset 0 1px 0 rgba(255,255,255,0.15)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (isFormValid && !isSubmitting && !isLoading) {
                      e.currentTarget.style.transform = 'translateY(0) scale(1)';
                      e.currentTarget.style.boxShadow =
                        '0 2px 10px rgba(193, 95, 60, 0.25), inset 0 1px 0 rgba(255,255,255,0.15)';
                    }
                  }}
                >
                  {(isSubmitting || isLoading) ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>保存中...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{mode === 'create' ? '创建歌单' : '保存修改'}</span>
                    </>
                  )}

                  {/* 按钮光泽效果 */}
                  {(isFormValid && !isSubmitting && !isLoading) && (
                    <div
                      className="absolute inset-0 pointer-events-none opacity-0 hover:opacity-100 transition-opacity duration-500"
                      style={{
                        background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 45%, rgba(255,255,255,0.1) 50%, transparent 55%)',
                        backgroundSize: '200% 100%',
                      }}
                    />
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/* ============================================================
   默认导出
   ============================================================ */
export default PlaylistFormDialog;
