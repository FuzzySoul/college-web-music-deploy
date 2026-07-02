'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Upload,
  Download,
  ClipboardPaste,
  Trash2,
  Save,
  X,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Code,
} from 'lucide-react';
import { toast } from 'sonner';
import type { LyricsEditorProps } from './types';

/**
 * LRC 格式化工具
 * 检测并修正常见的时间轴对齐问题
 */
function formatLrc(rawText: string): string {
  if (!rawText.trim()) return rawText;

  const lines = rawText.split('\n');
  const formattedLines: string[] = [];
  // 时间标签正则
  const timeRegex = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
  let lastValidTime = 0; // 用于检测时间倒退

  for (const line of lines) {
    let formattedLine = line.trim();
    if (!formattedLine) {
      formattedLines.push('');
      continue;
    }

    // 检查是否包含有效时间标签
    timeRegex.lastIndex = 0;
    const hasTimeTag = timeRegex.test(formattedLine);
    timeRegex.lastIndex = 0;

    if (hasTimeTag) {
      // 标准化毫秒格式：确保都是3位
      formattedLine = formattedLine.replace(
        /(\[\d{1,2}:\d{2})[.:](\d{1,3})(\])/g,
        (_match, prefix, ms, suffix) => {
          const msNum = parseInt(ms, 10);
          return `${prefix}.${msNum.toString().padStart(3, '0')}${suffix}`;
        }
      );

      // 提取并验证时间
      const times: number[] = [];
      let match: RegExpExecArray | null;
      while ((match = timeRegex.exec(formattedLine)) !== null) {
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        const msStr = match[3] || '0';
        const ms =
          msStr.length <= 1
            ? parseInt(msStr || '0', 10) * 100
            : msStr.length === 2
              ? parseInt(msStr, 10) * 10
              : parseInt(msStr, 10);
        const totalMs = minutes * 60 * 1000 + seconds * 1000 + ms;
        times.push(totalMs);
      }

      // 检查是否有异常大的时间间隔（可能是格式错误）
      if (
        times.length > 0 &&
        lastValidTime > 0 &&
        Math.min(...times) - lastValidTime > 60000
      ) {
        // 时间跳跃超过60秒，标记但不修改
        console.warn(
          `歌词行时间跳转过大: ${lastValidTime}ms -> ${Math.min(...times)}ms`
        );
      }

      if (times.length > 0) {
        lastValidTime = Math.max(...times);
      }
    }

    formattedLines.push(formattedLine);
  }

  return formattedLines.join('\n');
}

/**
 * LRC 错误检测器
 * 检测常见的 LRC 格式问题并返回警告列表
 */
function validateLrc(lrcText: string): { type: 'error' | 'warning'; message: string }[] {
  const issues: { type: 'error' | 'warning'; message: string }[] = [];
  if (!lrcText.trim()) return issues;

  const lines = lrcText.split('\n').filter((l) => l.trim());
  const timeTagRegex = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

  // 统计有/无时间标签的行
  let timedLines = 0;
  let untimedLines = 0;
  const allTimes: number[] = [];

  for (const line of lines) {
    timeTagRegex.lastIndex = 0;
    const hasTime = timeTagRegex.test(line);
    timeTagRegex.lastIndex = 0;

    if (hasTime) {
      timedLines++;
      let match: RegExpExecArray | null;
      while ((match = timeTagRegex.exec(line)) !== null) {
        const min = parseInt(match[1], 10);
        const sec = parseInt(match[2], 10);
        const msStr = match[3] || '0';
        const ms =
          msStr.length <= 1
            ? parseInt(msStr || '0', 10) * 100
            : msStr.length === 2
              ? parseInt(msStr, 10) * 10
              : parseInt(msStr, 10);
        allTimes.push(min * 60000 + sec * 1000 + ms);
      }
    } else if (line.trim() && !line.startsWith('[')) {
      // 排除元数据标签行（如 [ti:] [ar:] 等）
      untimedLines++;
    }
  }

  // 检测问题
  if (lines.length > 0 && timedLines === 0) {
    issues.push({
      type: 'error',
      message: '未找到任何有效的时间标签，请使用 LRC 格式',
    });
  }

  if (untimedLines > 0 && timedLines > 0) {
    issues.push({
      type: 'warning',
      message: `${untimedLines} 行没有时间标签，将无法同步显示`,
    });
  }

  // 检测时间顺序问题
  for (let i = 1; i < allTimes.length; i++) {
    if (allTimes[i] < allTimes[i - 1] - 500) {
      // 允许500ms误差
      issues.push({
        type: 'warning',
        message: `第 ${i + 1} 个时间点 (${formatMs(allTimes[i])}) 早于前一个时间点 (${formatMs(allTimes[i - 1])})，可能导致显示混乱`,
      });
      break; // 只报告一次
    }
  }

  // 检测过长的单行文本
  for (const line of lines) {
    if (line.replace(/\[.*?\]/g, '').length > 50) {
      issues.push({
        type: 'warning',
        message: '部分歌词行过长，可能影响显示效果',
      });
      break;
    }
  }

  return issues;
}

// 辅助函数：将毫秒格式化为可读字符串
function formatMs(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  return `${m}:${s.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
}

/**
 * 歌词编辑器组件
 * 支持LRC语法高亮、实时预览、导入导出、格式化和错误检测
 */
export function LyricsEditor({
  initialLyrics = '',
  trackId,
  onSave,
  onCancel,
}: LyricsEditorProps) {
  // 编辑内容
  const [content, setContent] = useState(initialLyrics);
  // 视图模式：编辑 | 预览
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  // 保存状态
  const [isSaving, setIsSaving] = useState(false);
  // 错误/警告列表
  const issues = useMemo(() => validateLrc(content), [content]);

  // 编辑区引用
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 字符和行数统计
  const stats = useMemo(() => {
    const lines = content.split('\n');
    const nonEmptyLines = lines.filter((l) => l.trim()).length;
    return {
      chars: content.length,
      lines: lines.length,
      nonEmptyLines,
    };
  }, [content]);

  // 导入 .lrc 文件
  const importFile = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.lrc,.txt';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        setContent(text);
        toast.success(`已导入文件: ${file.name}`);
      } catch {
        toast.error('文件读取失败');
      }
    };
    input.click();
  }, []);

  // 导出 .lrc 文件
  const exportFile = useCallback(() => {
    if (!content.trim()) {
      toast.warning('没有可导出的内容');
      return;
    }
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lyrics_${trackId}.lrc`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('歌词文件已导出');
  }, [content, trackId]);

  // 从剪贴板粘贴
  const pasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setContent(text);
      toast.success('已从剪贴板粘贴');
    } catch {
      toast.error('无法读取剪贴板，请手动粘贴');
    }
  }, []);

  // 清空
  const clearContent = useCallback(() => {
    setContent('');
    toast.info('已清空编辑内容');
  }, []);

  // 格式化
  const handleFormat = useCallback(() => {
    const formatted = formatLrc(content);
    setContent(formatted);
    toast.success('格式化完成');
  }, [content]);

  // 保存
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await onSave(content);
      toast.success('歌词保存成功');
    } catch (err) {
      console.error('保存失败:', err);
      toast.error('保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  }, [content, onSave]);

  // Tab键处理（在textarea中插入空格而非切换焦点）
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const textarea = e.currentTarget;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newValue =
          content.substring(0, start) + '  ' + content.substring(end);
        setContent(newValue);
        // 恢复光标位置
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        });
      }
    },
    [content]
  );

  // LRC 语法高亮渲染（用于预览模式）
  const renderHighlightedContent = useMemo(() => {
    if (!content.trim()) return null;

    return content.split('\n').map((line, lineIdx) => {
      // 高亮时间标签部分
      const parts = line.split(/(\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\])/g);

      return (
        <div key={lineIdx} className="leading-relaxed">
          {parts.map((part, partIdx) => {
            // 匹配时间标签
            if (/^\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]$/.test(part)) {
              return (
                <span
                  key={partIdx}
                  className="font-mono"
                  style={{ color: '#7C3AED' }} // 紫色时间标签
                >
                  {part}
                </span>
              );
            }
            // 歌词文本
            return (
              <span key={partIdx} style={{ color: 'var(--foreground)' }}>
                {part || '\u00A0'}
              </span>
            );
          })}
        </div>
      );
    });
  }, [content]);

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
        {/* 左侧工具按钮 */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <ToolbarButton onClick={importFile} icon={<Upload className="w-3.5 h-3.5" />} label="导入" />
          <ToolbarButton onClick={exportFile} icon={<Download className="w-3.5 h-3.5" />} label="导出" />
          <ToolbarButton onClick={pasteFromClipboard} icon={<ClipboardPaste className="w-3.5 h-3.5" />} label="粘贴" />
          <ToolbarButton onClick={clearContent} icon={<Trash2 className="w-3.5 h-3.5" />} label="清空" variant="danger" />
          <div className="w-px h-5 mx-1" style={{ backgroundColor: 'var(--border)' }} />
          <ToolbarButton onClick={handleFormat} icon={<Code className="w-3.5 h-3.5" />} label="格式化" />
        </div>

        {/* 右侧：视图切换 + 统计 + 操作按钮 */}
        <div className="ml-auto flex items-center gap-3">
          {/* 视图切换 */}
          <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => setViewMode('edit')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'edit'
                  ? 'text-[var(--primary)] bg-[var(--primary)]/10'
                  : 'hover:bg-[var(--accent)]'
              }`}
              style={{ color: viewMode === 'edit' ? undefined : 'var(--muted-foreground)' }}
            >
              <Code className="w-3.5 h-3.5 inline mr-1" /> 编辑
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'preview'
                  ? 'text-[var(--primary)] bg-[var(--primary)]/10'
                  : 'hover:bg-[var(--accent)]'
              }`}
              style={{ color: viewMode === 'preview' ? undefined : 'var(--muted-foreground)' }}
            >
              <Eye className="w-3.5 h-3.5 inline mr-1" /> 预览
            </button>
          </div>

          {/* 统计信息 */}
          <span className="hidden sm:inline-flex items-center gap-2 text-xs px-2 py-1 rounded-md" style={{ backgroundColor: 'var(--accent)', color: 'var(--muted-foreground)' }}>
            {stats.nonEmptyLines} 行 · {stats.chars} 字符
          </span>

          {/* 取消 & 保存 */}
          <button
            onClick={onCancel}
            className="px-4 py-1.5 text-sm rounded-lg border transition-colors hover:bg-[var(--accent)]"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            取消
          </button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSave}
            disabled={isSaving}
            className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                />
                保存中...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                保存歌词
              </>
            )}
          </motion.button>
        </div>
      </div>

      {/* 主编辑区域 - 响应式左右分栏 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 左侧：编辑区 */}
        <AnimatePresence mode="wait">
          {(viewMode === 'edit' || typeof window !== 'undefined' && window.innerWidth < 1024) && (
            <motion.div
              key="editor"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="relative"
            >
              <label
                className="block text-xs font-medium mb-2 uppercase tracking-wider"
                style={{ color: 'var(--muted-foreground)' }}
              >
                编辑区
              </label>
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="[00:00.00] 在这里输入 LRC 格式歌词...&#10;&#10;示例：&#10;[ti:歌曲名称]&#10;[ar:歌手名称]&#10;[al:专辑名称]&#10;&#10;[00:12.34] 第一行歌词&#10;[00:18.56] 第二行歌词&#10;[00:24.78] 第三行歌词"
                rows={16}
                spellCheck={false}
                className="w-full px-4 py-3 text-sm rounded-xl border font-mono leading-relaxed resize-y focus:outline-none focus:ring-2 transition-all duration-200"
                style={{
                  backgroundColor: 'var(--card)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                  minHeight: '320px',
                  '--tw-ring-color': 'rgba(193, 95, 60, 0.25)',
                } as React.CSSProperties}
                aria-label="歌词编辑区域"
              />

              {/* 行号指示器（可选装饰） */}
              <div
                className="absolute left-2 top-10 bottom-3 w-6 flex flex-col items-end pr-2 pointer-events-none select-none overflow-hidden text-right opacity-30"
                style={{ fontSize: '12px', fontFamily: 'monospace', lineHeight: '1.65', color: 'var(--muted-foreground)' }}
              >
                {Array.from({ length: Math.min(stats.lines, 20) }).map((_, i) => (
                  <span key={i}>{i + 1}</span>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 右侧：预览区（桌面端） */}
        {typeof window === 'undefined' || window.innerWidth >= 1024 ? (
          <AnimatePresence mode="wait">
            <motion.div
              key="preview"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
              className="lg:block hidden"
            >
              <label
                className="block text-xs font-medium mb-2 uppercase tracking-wider"
                style={{ color: 'var(--muted-foreground)' }}
              >
                实时预览
              </label>
              <div
                className="rounded-xl border overflow-auto p-4"
                style={{
                  backgroundColor: '#0a0a0a',
                  borderColor: 'var(--border)',
                  minHeight: '320px',
                  maxHeight: '480px',
                  fontSize: '14px',
                  lineHeight: 1.8,
                }}
              >
                {renderHighlightedContent || (
                  <div
                    className="flex flex-col items-center justify-center h-full text-center py-12"
                    style={{ color: 'rgba(255,255,255,0.3)' }}
                  >
                    <FileText className="w-10 h-10 mb-2 opacity-40" />
                    <p className="text-sm">开始输入以查看预览</p>
                    <p className="text-xs mt-1">时间标签将以紫色高亮显示</p>
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        ) : null}
      </div>

      {/* 错误/警告提示栏 */}
      <AnimatePresence>
        {issues.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div
              className="rounded-xl p-4 space-y-2"
              style={{
                backgroundColor:
                  issues.some((i) => i.type === 'error')
                    ? 'rgba(239, 68, 68, 0.06)'
                    : 'rgba(234, 179, 8, 0.06)',
                border: `1px solid ${
                  issues.some((i) => i.type === 'error')
                    ? 'rgba(239, 68, 68, 0.15)'
                    : 'rgba(234, 179, 8, 0.15)'
                }`,
              }}
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                {issues.some((i) => i.type === 'error') ? (
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-yellow-500" />
                )}
                <span
                  style={{
                    color: issues.some((i) => i.type === 'error')
                      ? '#EF4444'
                      : '#EAB308',
                  }}
                >
                  发现 {issues.filter((i) => i.type === 'error').length} 个错误、
                  {issues.filter((i) => i.type === 'warning').length} 个警告
                </span>
              </div>
              <ul className="space-y-1 ml-6">
                {issues.map((issue, idx) => (
                  <li
                    key={idx}
                    className="text-xs list-disc"
                    style={{
                      color:
                        issue.type === 'error'
                          ? 'rgba(239, 68, 68, 0.85)'
                          : 'rgba(234, 179, 8, 0.85)',
                    }}
                  >
                    {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LRC 格式参考（底部折叠提示） */}
      <details className="group">
        <summary
          className="cursor-pointer text-xs font-medium py-2 hover:text-[var(--primary)] transition-colors list-none flex items-center gap-1"
          style={{ color: 'var(--muted-foreground)' }}
        >
          <FileText className="w-3.5 h-3.5" />
          LRC 格式参考
          <span className="ml-1 group-open:rotate-90 transition-transform">›</span>
        </summary>
        <div
          className="mt-2 p-4 rounded-xl text-xs space-y-2 font-mono"
          style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <p style={{ color: 'var(--muted-foreground)' }}>
            基本结构：
          </p>
          <pre className="p-3 rounded-lg overflow-x-auto" style={{ backgroundColor: 'var(--accent)', color: 'var(--foreground)' }}>{`[ti:歌曲名]
[ar:歌手名]
[al:专辑名]
[by:制作者]

[00:00.00] 作曲/作词信息
[00:12.34] 第一行歌词
[00:18.56] 第二行歌词
[01:05.00] 副歌部分`}</pre>
          <p style={{ color: 'var(--muted-foreground)' }}>
            时间格式：<span style={{ color: '#7C3AED' }}>[分:秒.毫秒]</span>，毫秒支持1-3位数字
          </p>
        </div>
      </details>
    </div>
  );
}

/** 小型工具栏按钮组件 */
function ToolbarButton({
  onClick,
  icon,
  label,
  variant = 'default',
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  variant?: 'default' | 'danger';
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
        variant === 'danger'
          ? 'border-red-500/25 text-red-500 hover:bg-red-500/8'
          : 'border-[var(--border)] hover:bg-[var(--accent)]'
      }`}
      style={
        variant === 'default'
          ? { color: 'var(--foreground)' }
          : undefined
      }
      title={label}
      aria-label={label}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

// 导出工具函数供外部使用
export { formatLrc, validateLrc };

export default LyricsEditor;
