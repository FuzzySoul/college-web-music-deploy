'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Mic,
  User,
  ChevronDown,
  Mail,
  Clock,
  Palette,
  ChevronLeft
} from 'lucide-react';
import { useBackButtonStore } from './stores/useBackButtonStore';

interface TopBarProps {
  onSearch?: (query: string) => void;
  searchQuery?: string;
  setSearchQuery?: (query: string) => void;
  currentUser?: {
    name: string;
    avatar: string;
  } | null;
  isDark?: boolean;
  onToggleTheme?: () => void;
  onLogout?: () => void;
}

export function TopBar({
  onSearch,
  searchQuery = '',
  setSearchQuery,
  currentUser = null,
  isDark = false,
  onToggleTheme,
  onLogout
}: TopBarProps) {
  const router = useRouter();
  const [isFocused, setIsFocused] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { show: showBack, onBack: backHandler } = useBackButtonStore();

  // 点击外部关闭用户菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserMenu]);

  // 处理搜索输入（仅更新输入框状态，不触发搜索）
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery?.(value);
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSearch?.(searchQuery);
    }
  };

  return (
    <header className="fixed top-0 left-64 right-0 h-16 z-40 flex items-center justify-between px-6">
      {/* 左侧区域 - 返回按钮 + 搜索框 */}
      <div className="flex items-center flex-1 max-w-xl gap-2">
        {/* 详情页返回按钮（歌单/榜单详情时显示） */}
        {showBack && (
          <button
            onClick={backHandler}
            aria-label="返回"
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-300 ease-out hover:scale-[1.05] active:scale-[0.95]"
            style={{
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.06)',
              color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.55)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = isDark ? 'rgba(249, 115, 22, 0.12)' : 'rgba(249, 115, 22, 0.08)';
              e.currentTarget.style.color = '#F97316';
              e.currentTarget.style.borderColor = 'rgba(249, 115, 22, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
              e.currentTarget.style.color = isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.55)';
              e.currentTarget.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
            }}
          >
            <ChevronLeft className="w-5 h-5" strokeWidth={2} />
          </button>
        )}

        {/* 搜索框 */}
        <div className={`relative flex items-center flex-1 transition-all duration-300 ease-out ${
          isFocused ? 'scale-[1.01]' : ''
        }`}
        style={{
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
          borderRadius: '10px',
          border: isFocused
            ? (isDark ? '1px solid rgba(249, 115, 22, 0.3)' : '1px solid rgba(249, 115, 22, 0.2)')
            : (isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)'),
          boxShadow: isFocused
            ? '0 4px 20px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 0 0 1px rgba(249, 115, 22, 0.08)'
            : '0 2px 10px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.02)'
        }}>
          {/* 搜索图标 */}
          <Search
            className="absolute left-3.5 w-4 h-4 transition-colors duration-300 pointer-events-none"
            style={{
              color: isFocused ? '#F97316' : (isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.3)')
            }}
            strokeWidth={2}
          />

          {/* 输入框 */}
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={handleInputChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            onKeyDown={handleKeyDown}
            placeholder="合辑·王瑞鹤"
            className="w-full pl-11 pr-11 py-2 bg-transparent outline-none text-sm tracking-tight placeholder:text-opacity-50 transition-colors duration-300"
            style={{
              color: isDark ? 'rgba(255, 255, 255, 0.95)' : 'rgba(0, 0, 0, 0.85)'
            }}
          />

          {/* 麦克风图标 */}
          <button
            className="absolute right-3 p-1.5 rounded-md transition-all duration-300 ease-out hover:scale-[1.1] active:scale-[0.95]"
            style={{
              color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.35)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#F97316';
              e.currentTarget.style.backgroundColor = 'rgba(249, 115, 22, 0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.35)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            aria-label="语音搜索"
          >
            <Mic className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* 右侧区域 - 用户信息和功能图标 */}
      <div className="flex items-center gap-2">
        {/* 用户信息区域 */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition-all duration-300 ease-out group hover:scale-[1.02] active:scale-[0.98]"
            style={{
              backgroundColor: showUserMenu
                ? (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)')
                : 'transparent'
            }}
          >
            {/* 用户头像 */}
            <div className="relative">
              <div
                className="w-9 h-9 rounded-full overflow-hidden ring-2 transition-all duration-300"
                style={{
                  boxShadow: `0 0 0 2px ${showUserMenu ? 'rgba(249, 115, 22, 0.4)' : (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)')}`
                }}
              >
                {currentUser?.avatar ? (
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name || '用户头像'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center"
                    style={{ backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)' }}
                  >
                    <User className="w-5 h-5" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.3)' }} />
                  </div>
                )}
              </div>
            </div>

            {/* 用户名 + 下拉箭头 */}
            <div className="flex items-center gap-1.5">
              <span
                className="text-sm font-medium max-w-[100px] truncate transition-colors duration-300"
                style={{
                  color: isDark ? 'rgba(255, 255, 255, 0.95)' : 'rgba(0, 0, 0, 0.85)'
                }}
              >
                {currentUser?.name || '未登录'}
              </span>

              {/* 下拉箭头 */}
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-300 ${showUserMenu ? 'rotate-180' : ''}`}
                style={{
                  color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.4)'
                }}
              />
            </div>
          </button>

          {/* 用户下拉菜单 */}
          {showUserMenu && (
            <div
              className="absolute top-full right-0 mt-2 w-56 py-2 origin-top-right animate-in fade-in-0 slide-in-from-top-2 duration-200"
              style={{
                backgroundColor: isDark ? 'rgba(30, 30, 30, 0.98)' : 'rgba(255, 255, 255, 0.98)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderRadius: '14px',
                border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'}`,
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.02)'
              }}
            >
              {/* 菜单项示例 */}
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  router.push('/home/profile');
                }}
                className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 transition-all duration-200 hover:bg-black/5 dark:hover:bg-white/5"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.75)' }}
              >
                <User className="w-4 h-4" />
                个人中心
              </button>
              <div style={{ height: 1, backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)', margin: '4px 12px' }} />
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  onLogout?.();
                }}
                className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 transition-all duration-200 hover:bg-black/5 dark:hover:bg-white/5"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.75)' }}
              >
                退出登录
              </button>
            </div>
          )}
        </div>

        {/* 分隔线 */}
        <div
          className="w-px h-6 mx-1"
          style={{ backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)' }}
        />

        {/* 功能图标组 */}
        <div className="flex items-center gap-1">
          {/* 消息通知 */}
          <IconButton
            icon={<Mail className="w-[18px] h-[18px]" />}
            ariaLabel="消息"
            isDark={isDark}
            hasNotification={true}
          />

          {/* 历史记录 */}
          <IconButton
            icon={<Clock className="w-[18px] h-[18px]" />}
            ariaLabel="历史记录"
            isDark={isDark}
          />

          {/* 主题切换 */}
          <IconButton
            icon={<Palette className="w-[18px] h-[18px]" />}
            ariaLabel="皮肤主题"
            isDark={isDark}
            onClick={onToggleTheme}
          />
        </div>
      </div>
    </header>
  );
}

// 图标按钮子组件
interface IconButtonProps {
  icon: React.ReactNode;
  ariaLabel: string;
  isDark: boolean;
  onClick?: () => void;
  hasNotification?: boolean;
}

function IconButton({ icon, ariaLabel, isDark, onClick, hasNotification = false }: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      className="relative p-2 rounded-lg transition-all duration-300 ease-out group hover:scale-[1.08] active:scale-[0.95]"
      style={{
        color: isDark ? 'rgba(255, 255, 255, 0.55)' : 'rgba(0, 0, 0, 0.45)'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = '#F97316';
        e.currentTarget.style.backgroundColor = 'rgba(249, 115, 22, 0.06)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = isDark ? 'rgba(255, 255, 255, 0.55)' : 'rgba(0, 0, 0, 0.45)';
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
      aria-label={ariaLabel}
    >
      {icon}
      {/* 通知红点 */}
      {hasNotification && (
        <span
          className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full animate-pulse"
          style={{
            backgroundColor: '#F97316',
            boxShadow: '0 0 0 2px rgba(249, 115, 22, 0.2)'
          }}
        />
      )}
    </button>
  );
}
