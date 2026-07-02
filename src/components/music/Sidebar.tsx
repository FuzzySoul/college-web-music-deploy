'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { PlaylistFormDialog } from './PlaylistFormDialog';
import { usePlayer } from '@/app/home/context/PlayerContext';
import type { Playlist } from '@/components/music/PlaylistManager';
import {
  Plus, 
  FolderOpen, 
  User,
  ChevronRight,
  ChevronDown,
  Heart,
  Music2,
  MoreHorizontal,
  FolderPlus,
  Compass,
  Layers,
  Disc3
} from 'lucide-react';

interface NavItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  description?: string;
}

interface UserPlaylist {
  id: string;
  name: string;
  cover: string | null;
  trackCount: number;
  source: 'local' | 'external' | 'custom';
  createdAt: string;
}

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isDark?: boolean;
  onToggleTheme?: () => void;
}

const tabToPath: Record<string, string> = {
  'explore-music': '/home/explore',
  'import': '/home/import',
  'local-music': '/home/local-music',
  'favorites': '/home/favorites',
  'playlists': '/home/playlists',
  'artists': '/home/artists',
  'albums': '/home/albums',
  'rhythm-games': '/home/rhythm',
  'music-aggregation': '/home/aggregation',
  'stats': '/home/stats',
};

export function Sidebar({ activeTab, onTabChange, isDark = false, onToggleTheme }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { playlists: contextPlaylists, setPlaylists, currentUser } = usePlayer();
  const [isPlaylistsExpanded, setIsPlaylistsExpanded] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [createSource, setCreateSource] = useState<'local' | 'custom'>('local');
  const createMenuRef = useRef<HTMLDivElement>(null);

  const userPlaylists = useMemo(() => {
    return contextPlaylists.map(p => {
      let source: 'local' | 'external' | 'custom' = 'local';
      if (p.source === 'custom') {
        source = 'custom';
      } else if (p.platformSource === 'netease' || p.platformSource === 'qq' || p.id.startsWith('external-')) {
        source = 'external';
      }
      return {
        id: p.id,
        name: p.name,
        cover: p.cover || null,
        trackCount: p.trackCount || 0,
        source,
        createdAt: p.createdAt || '',
      };
    });
  }, [contextPlaylists]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (createMenuRef.current && !createMenuRef.current.contains(event.target as Node)) {
        setShowCreateMenu(false);
      }
    };
    if (showCreateMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCreateMenu]);

  // M4: 监听网易云聚合导入事件，让侧边栏在用户点击"导入"瞬间就更新（无需等任何 API）
  useEffect(() => {
    const handleImportStart = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const tempPlaylists: any[] = detail.playlists || [];
      if (!Array.isArray(tempPlaylists) || tempPlaylists.length === 0) return;

      setPlaylists((prev: Playlist[]) => {
        // 避免重复添加
        const existingIds = new Set(prev.map(p => p.id));
        const fresh = tempPlaylists.filter(p => !existingIds.has(p.id));
        return [...fresh, ...prev];
      });
    };

    const handleImportComplete = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const tempIds: string[] = detail.tempIds || [];
      const realPlaylists: any[] = detail.realPlaylists || [];
      if (!Array.isArray(tempIds) || tempIds.length === 0) return;

      setPlaylists((prev: Playlist[]) => {
        // 计算要被替换的 temp 歌单对应的 platformPlaylistId（用于去重 prev 里已存在的真实歌单）
        const tempPlatformIds = prev
          .filter(p => tempIds.includes(p.id))
          .map(p => p.platformPlaylistId)
          .filter(Boolean);
        const realPlatformIds = new Set(
          realPlaylists.map(r => r.platformPlaylistId || r.platform_playlist_id).filter(Boolean)
        );

        return prev
          // 1) 先删掉 prev 里与即将到来的 real 歌单 platformPlaylistId 重复的（避免重复 key）
          .filter(p => {
            if (p.id.startsWith('temp-') || p.id.startsWith('temp-netease-')) return true; // 保留 temp，下一步替换
            if (p.platformPlaylistId && realPlatformIds.has(p.platformPlaylistId)) return false; // 删掉重复的真实歌单
            if (p.platformPlaylistId && tempPlatformIds.includes(p.platformPlaylistId)) return false; // 删掉 temp 对应的真实歌单
            return true;
          })
          // 2) 然后把 temp 替换为 real
          .map(p => {
            const idx = tempIds.indexOf(p.id);
            if (idx === -1) return p;
            const real = realPlaylists[idx];
            if (!real) return p;
            return {
              ...p,
              id: real.id?.startsWith('external-') ? real.id : `external-${real.id}`,
              externalPlaylistId: String(real.id),
              platformSource: 'netease',
              trackCount: real.trackCount ?? p.trackCount ?? 0,
              createdAt: real.createdAt || p.createdAt,
            };
          });
      });
    };

    const handleImportFailed = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const tempIds: string[] = detail.tempIds || [];
      if (!Array.isArray(tempIds) || tempIds.length === 0) return;

      setPlaylists((prev: Playlist[]) => prev.filter(p => !tempIds.includes(p.id)));
    };

    window.addEventListener('playlists:netease-import-start', handleImportStart);
    window.addEventListener('playlists:netease-import-complete', handleImportComplete);
    window.addEventListener('playlists:netease-import-failed', handleImportFailed);
    return () => {
      window.removeEventListener('playlists:netease-import-start', handleImportStart);
      window.removeEventListener('playlists:netease-import-complete', handleImportComplete);
      window.removeEventListener('playlists:netease-import-failed', handleImportFailed);
    };
  }, [setPlaylists]);

  const mainNav: NavItem[] = [
    { id: 'explore-music', icon: <Compass className="w-5 h-5" />, label: '探索' },
    { id: 'import', icon: <FolderPlus className="w-5 h-5" />, label: '导入' },
  ];

  const libraryNav: NavItem[] = [
    { id: 'favorites', icon: <Heart className="w-4 h-4" />, label: '我的收藏' },
    { id: 'local-music', icon: <Disc3 className="w-4 h-4" />, label: '本地音乐' },
    { id: 'playlists', icon: <FolderOpen className="w-4 h-4" />, label: '歌单' },
    { id: 'artists', icon: <User className="w-4 h-4" />, label: '歌手' },
    { id: 'albums', icon: <Disc iconClassName="w-4 h-4" />, label: '专辑' },
  ];

  const handleCreatePlaylist = async (data: { name: string; description?: string; cover?: string }, source: 'local' | 'custom' = 'local') => {
    console.log('[Sidebar] handleCreatePlaylist called with:', data, 'source:', source);
    setIsCreating(true);

    const tempId = `temp-${Date.now()}`;
    const now = new Date().toISOString();

    setPlaylists(prev => [{
      id: tempId,
      name: data.name,
      description: data.description || '',
      cover: data.cover || null,
      trackIds: [],
      createdAt: now,
      platformSource: 'local',
      source,
      externalPlaylistId: source === 'custom' ? tempId : '',
      trackCount: 0,
    }, ...prev]);

    setCreateDialogOpen(false);

    try {
      const response = await fetch('/api/music/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, source }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '创建失败');
      }

      const result = await response.json();
      if (result.success && result.data) {
        const newP = result.data;
        setPlaylists(prev =>
          prev.map(p => p.id === tempId ? {
            ...p,
            id: source === 'custom' ? `external-${String(newP.id)}` : String(newP.id),
            externalPlaylistId: source === 'custom' ? String(newP.id) : p.externalPlaylistId,
            createdAt: newP.created_at || p.createdAt,
          } : p)
        );
      }
    } catch (error) {
      console.warn('[Sidebar] 歌单已创建(本地)，同步到服务器失败:', error);
      setPlaylists(prev =>
        prev.map(p => p.id === tempId ? { ...p, _syncFailed: true as boolean } : p)
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleNavClick = (id: string) => {
    if (id === 'settings') {
      onToggleTheme?.();
    } else {
      onTabChange(id);
    }
  };

  const isActive = (id: string) => {
    const path = tabToPath[id];
    return pathname === path || pathname === path + '/';
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');
        * { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
        .sidebar-scroll::-webkit-scrollbar { width: 3px; }
        .sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
        .sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 10px; }
        .sidebar-scroll::-webkit-scrollbar-thumb:hover { background: #ff7a00; }
        .playlist-scroll { -ms-overflow-style: none; scrollbar-width: none; }
        .playlist-scroll::-webkit-scrollbar { display: none; }
      `}</style>
      <aside
        className="fixed left-0 top-0 h-full w-64 flex flex-col sidebar-scroll overflow-y-auto"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.1)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRight: '1px solid rgba(255, 255, 255, 0.1)'
        }}
      >
      <div className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #ff7a00, #ff5500)' }}>
            <Music2 className="w-4.5 h-4.5" style={{ color: '#fff', fill: '#fff' }} />
          </div>
          <div>
            <h1 className="font-normal text-[15px] leading-[1.6]" style={{ color: '#fff', letterSpacing: '-0.01em', fontWeight: 400 }}>音乐空间</h1>
          </div>
        </div>
      </div>

      <div className="px-2 py-1">
        {mainNav.map((item) => (
          <Link
            key={item.id}
            href={tabToPath[item.id] || '/home/explore'}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg cursor-pointer transition-all duration-200 mb-1.5 ${
              isActive(item.id) ? '' : 'hover:bg-white/[0.05]'
            }`}
            style={
              isActive(item.id)
                ? {
                    background: 'linear-gradient(135deg, #ff7a00, #ff5500)',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)',
                  }
                : {}
            }
          >
            <div style={{ color: isActive(item.id) ? '#fff' : '#999', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {item.icon}
            </div>
            <span className="text-[13px] font-normal leading-[1.6] flex-1" style={{ 
              color: isActive(item.id) ? '#fff' : '#e0e0e0', 
              letterSpacing: '-0.01em',
              fontWeight: 400
            }}>{item.label}</span>
          </Link>
        ))}
      </div>

      <div className="mx-3 my-1.5" style={{ height: '1px', background: 'rgba(255, 255, 255, 0.1)' }} />

      <div className="px-2 py-1 flex-1 flex flex-col min-h-0">
        <div className="text-[12px] font-normal px-3.5 py-1.5 uppercase tracking-wider" style={{ color: '#999', lineHeight: '1.6', letterSpacing: '-0.01em', fontWeight: 300 }}>
          我的
        </div>
        {libraryNav.map((item) => (
          <button
            type="button"
            key={item.id}
            onClick={() => handleNavClick(item.id)}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg cursor-pointer transition-all duration-200 mb-1.5 w-full text-left ${
              activeTab === item.id ? '' : 'hover:bg-white/[0.05]'
            }`}
            style={
              activeTab === item.id
                ? {
                    background: 'linear-gradient(135deg, #ff7a00, #ff5500)',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)',
                  }
                : {}
            }
          >
            <div style={{ color: activeTab === item.id ? '#fff' : '#999', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {item.icon}
            </div>
            <span className="text-[13px] font-normal leading-[1.6] flex-1" style={{ 
              color: activeTab === item.id ? '#fff' : '#e0e0e0', 
              letterSpacing: '-0.01em',
              fontWeight: 400 
            }}>{item.label}</span>
          </button>
        ))}

        <div className="mx-3 my-1.5" style={{ height: '1px', background: 'rgba(255, 255, 255, 0.1)' }} />

        <div className="px-2 py-1 flex-1 min-h-0 flex flex-col">
          <div ref={createMenuRef} className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg select-none relative">
            <button
              type="button"
              onClick={() => setIsPlaylistsExpanded(!isPlaylistsExpanded)}
              className="flex items-center gap-2 flex-1 cursor-pointer group transition-all duration-200 hover:bg-white/[0.05] rounded-lg -mx-3.5 -my-2.5 px-3.5 py-2.5"
            >
              <FolderOpen className="w-[18px] h-[18px]" style={{ color: '#999' }} />
              <span className="text-[12px] font-normal uppercase tracking-wider flex-1 text-left" style={{ 
                color: '#999', 
                lineHeight: '1.6', 
                letterSpacing: '-0.01em',
                fontWeight: 300 
              }}>
                创建的歌单
              </span>
              {userPlaylists.length > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-md bg-white/[0.06] text-[11px] font-medium" style={{ color: '#999', border: '1px solid rgba(255,255,255,0.1)' }}>
                  {userPlaylists.length}
                </span>
              )}
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-200 ${isPlaylistsExpanded ? '' : '-rotate-90'}`}
                style={{ color: '#999' }}
              />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowCreateMenu(!showCreateMenu);
              }}
              className="flex-shrink-0 w-[18px] h-[18px] flex items-center justify-center rounded transition-colors hover:bg-white/[0.10]"
              style={{ color: '#999' }}
            >
              <Plus className="w-[18px] h-[18px]" />
            </button>

            {showCreateMenu && (
              <div className="absolute top-full right-4 mt-1 py-1 rounded-lg shadow-lg border z-50 animate-in fade-in slide-in-from-top-2 duration-200"
                style={{
                  backgroundColor: 'rgba(30, 30, 30, 0.98)',
                  borderColor: 'rgba(255, 255, 255, 0.1)'
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateMenu(false);
                    setCreateSource('local');
                    setCreateDialogOpen(true);
                  }}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-md transition-colors hover:bg-white/[0.05]"
                >
                  <Plus className="w-[18px] h-[18px]" style={{ color: '#999' }} />
                  <span className="text-[13px] font-normal" style={{ color: '#fff' }}>创建本地歌单</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateMenu(false);
                    setCreateSource('custom');
                    setCreateDialogOpen(true);
                  }}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-md transition-colors hover:bg-white/[0.05]"
                >
                  <Plus className="w-[18px] h-[18px]" style={{ color: '#6366f1' }} />
                  <span className="text-[13px] font-normal" style={{ color: '#fff' }}>自建爬虫歌单</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateMenu(false);
                    router.push('/home/aggregation');
                  }}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-md transition-colors hover:bg-white/[0.05]"
                >
                  <Layers className="w-[18px] h-[18px]" style={{ color: '#ff7a00' }} />
                  <span className="text-[13px] font-normal" style={{ color: '#fff' }}>网易云歌单聚合</span>
                </button>
              </div>
            )}
          </div>

          {isPlaylistsExpanded && (
            <div className="mt-1 space-y-1 flex-1 min-h-0 overflow-y-auto transition-all duration-200 playlist-scroll">
              {userPlaylists.length === 0 ? (
                <div className="px-4 py-4 text-center">
                  <Music2 className="w-8 h-8 mx-auto mb-2 opacity-30" style={{ color: '#999' }} />
                  <p className="text-[12px] mb-2" style={{ color: '#999' }}>暂无歌单</p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setCreateDialogOpen(true);
                    }}
                    className="text-[12px] inline-flex items-center gap-1 transition-colors"
                    style={{ color: '#ff7a00' }}
                  >
                    创建第一个歌单 <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                userPlaylists.map((playlist) => {
                  const playlistHref = `${tabToPath['playlists'] || '/home/playlists'}?id=${encodeURIComponent(playlist.id)}&source=${encodeURIComponent(playlist.source || 'local')}`;

                  return (
                    <Link
                      key={`${playlist.source}-${playlist.id}`}
                      href={playlistHref}
                      onClick={() => {
                        console.log('[Sidebar] Clicked playlist:', {
                          id: playlist.id,
                          source: playlist.source,
                          name: playlist.name,
                          href: playlistHref
                        });
                      }}
                      className={`flex items-center gap-3 mx-1.5 my-0.5 px-3.5 py-2.5 rounded-lg cursor-pointer transition-all duration-200 hover:bg-white/[0.05] group/item ${
                        pathname?.includes(playlist.id) ? '' : ''
                      }`}
                      style={
                        pathname?.includes(playlist.id)
                          ? {
                              background: 'linear-gradient(135deg, #ff7a00, #ff5500)',
                              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)',
                            }
                          : {}
                      }
                    >
                    <div className="relative w-8 h-8 flex-shrink-0">
                      {playlist.cover ? (
                        <img
                          src={playlist.cover}
                          alt={playlist.name}
                          className="w-full h-full rounded-md object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full rounded-md flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
                          <Music2 className="w-3.5 h-3.5" style={{ color: '#999' }} />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-[14px] font-normal leading-[1.6] truncate transition-colors duration-200" style={{ 
                        color: pathname?.includes(playlist.id) ? '#fff' : '#e0e0e0',
                        letterSpacing: '-0.01em',
                        fontWeight: 400
                      }}>
                        {playlist.name}
                      </div>
                      <div className="text-[12px] truncate mt-0.5 leading-[1.6]" style={{ 
                        color: pathname?.includes(playlist.id) ? 'rgba(255,255,255,0.8)' : '#999',
                        letterSpacing: '-0.01em',
                        fontWeight: 300
                      }}>
                        {playlist.trackCount || 0} 首歌曲
                        {playlist.source === 'local' && ' · 本地'}
                        {playlist.source === 'custom' && ' · 自建'}
                        {playlist.source === 'external' && ' · 网易云'}
                      </div>
                    </div>

                    <ChevronRight className="w-3.5 h-3.5 opacity-0 transition-all duration-200 group-hover/item:opacity-60 group-hover/item:translate-x-0.5" style={{ color: '#999' }} />
                  </Link>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      <div className="px-2 py-2.5" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <div className="flex items-center gap-2.5 p-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #ff7a00, #ff5500)' }}>
            <User className="w-[16px] h-[16px]" style={{ color: '#fff' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-normal truncate leading-[1.6]" style={{ color: '#fff', letterSpacing: '-0.01em', fontWeight: 400 }}>{currentUser?.username || '访客用户'}</div>
            <div className="text-[12px] leading-[1.6]" style={{ color: '#999', letterSpacing: '-0.01em', fontWeight: 300 }}>免费版</div>
          </div>
          <MoreHorizontal className="w-[16px] h-[16px]" style={{ color: '#999' }} />
        </div>
      </div>

      {/* Debug: 验证对话框状态渲染 */}
      {createDialogOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, zIndex: 99999, background: 'red', color: 'white', padding: '4px', fontSize: '12px' }}>
          DIALOG SHOULD BE VISIBLE (debug: open={String(createDialogOpen)})
        </div>
      )}

      <PlaylistFormDialog
        open={createDialogOpen}
        onClose={() => {
          console.log('[Sidebar] Dialog closed via onClose callback');
          setCreateDialogOpen(false);
        }}
        mode="create"
        onSubmit={(data) => handleCreatePlaylist(data, createSource)}
        isLoading={isCreating}
      />
    </aside>
    </>
  );
}

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
