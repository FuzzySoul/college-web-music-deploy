'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Users,
  Music,
  Disc3,
  HardDrive,
  ListMusic,
  MessageSquare,
  BarChart3,
  LogOut,
  Shield,
  ChevronLeft,
  ChevronRight,
  Sparkles
} from 'lucide-react';

const navGroups = [
  {
    label: '概览',
    items: [
      { id: 'dashboard', path: '/admin', icon: LayoutDashboard, label: '仪表盘' },
    ]
  },
  {
    label: '内容管理',
    items: [
      { id: 'users', path: '/admin/users', icon: Users, label: '用户管理' },
      { id: 'artists', path: '/admin/artists', icon: Music, label: '歌手管理' },
      { id: 'albums', path: '/admin/albums', icon: Disc3, label: '专辑管理' },
      { id: 'tracks', path: '/admin/tracks', icon: Disc3, label: '歌曲管理' },
      { id: 'local-music', path: '/admin/local-music', icon: HardDrive, label: '本地音乐' },
      { id: 'playlists', path: '/admin/playlists', icon: ListMusic, label: '歌单管理' },
    ]
  },
  {
    label: '互动与数据',
    items: [
      { id: 'comments', path: '/admin/comments', icon: MessageSquare, label: '评论管理' },
      { id: 'banners', path: '/admin/banners', icon: Sparkles, label: '轮播图设置' },
      { id: 'stats', path: '/admin/stats', icon: BarChart3, label: '数据统计' },
    ]
  }
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [adminInfo, setAdminInfo] = useState<{ id: string; username: string; role: string } | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (pathname === '/admin/login') return;
    const auth = sessionStorage.getItem('adminAuth');
    if (!auth) {
      router.push('/admin/login');
      return;
    }
    try {
      setAdminInfo(JSON.parse(auth));
    } catch {
      router.push('/admin/login');
    }
  }, [router, pathname]);

  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  if (!mounted || !adminInfo) return null;

  const handleLogout = () => {
    sessionStorage.removeItem('adminAuth');
    router.push('/admin/login');
  };

  const isActive = (path: string) => {
    if (path === '/admin') return pathname === '/admin';
    return pathname.startsWith(path);
  };

  return (
    <>
      <style>{`
        .admin-sidebar-scroll::-webkit-scrollbar { width: 3px; }
        .admin-sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
        .admin-sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 10px; }
        .admin-sidebar-scroll::-webkit-scrollbar-thumb:hover { background: #ff7a00; }
      `}</style>
      <div className="min-h-screen flex">
        <aside
          className={`fixed left-0 top-0 h-full flex flex-col admin-sidebar-scroll overflow-y-auto transition-all duration-300 ${collapsed ? 'w-20' : 'w-64'}`}
          style={{
            background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
            borderRight: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          <div className="px-4 py-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 relative" style={{ background: 'linear-gradient(135deg, #ff7a00, #ff5500)', boxShadow: '0 2px 8px rgba(255,122,0,0.3)' }}>
                <Shield className="w-4.5 h-4.5" style={{ color: '#fff' }} />
                <Sparkles className="w-2.5 h-2.5 absolute -top-0.5 -right-0.5" style={{ color: '#ffd700' }} />
              </div>
              {!collapsed && (
                <div>
                  <h1 className="font-normal text-[15px] leading-[1.6]" style={{ color: '#fff', letterSpacing: '-0.01em', fontWeight: 400 }}>管理后台</h1>
                  <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Admin Panel</p>
                </div>
              )}
            </div>
          </div>

          <div className="mx-3 my-1" style={{ height: '1px', background: 'rgba(255, 255, 255, 0.08)' }} />

          <div className="px-2 py-1 flex-1 flex flex-col gap-1">
            {navGroups.map((group) => (
              <div key={group.label}>
                <div className="text-[11px] font-normal px-3.5 py-2 uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 300 }}>
                  {collapsed ? '···' : group.label}
                </div>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  return (
                    <Link
                      key={item.id}
                      href={item.path}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg cursor-pointer transition-all duration-200 mb-1 ${active ? '' : 'hover:bg-white/[0.05]'}`}
                      style={active ? {
                        background: 'linear-gradient(135deg, #ff7a00, #ff5500)',
                        boxShadow: '0 2px 8px rgba(255,122,0,0.25), inset 0 1px 2px rgba(0,0,0,0.2)',
                      } : {}}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon className="w-[18px] h-[18px] flex-shrink-0" style={{ color: active ? '#fff' : 'rgba(255,255,255,0.5)' }} />
                      {!collapsed && (
                        <span className="text-[13px] font-normal leading-[1.6] flex-1" style={{
                          color: active ? '#fff' : 'rgba(255,255,255,0.7)',
                          letterSpacing: '-0.01em',
                          fontWeight: active ? 500 : 400
                        }}>{item.label}</span>
                      )}
                      {active && !collapsed && (
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#fff', boxShadow: '0 0 6px rgba(255,255,255,0.5)' }} />
                      )}
                    </Link>
                  );
                })}
                <div className="mx-1 my-1.5" style={{ height: '1px', background: 'rgba(255, 255, 255, 0.06)' }} />
              </div>
            ))}
          </div>

          <div className="px-2 py-1">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="flex items-center justify-center w-full py-2 rounded-lg transition-all duration-200 hover:bg-white/[0.05]"
              style={{ color: 'rgba(255,255,255,0.4)' }}
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          <div className="px-2 py-2.5" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div className="flex items-center gap-2.5 p-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #ff7a00, #ff5500)', boxShadow: '0 2px 6px rgba(255,122,0,0.2)' }}>
                <Shield className="w-4 h-4" style={{ color: '#fff' }} />
              </div>
              {!collapsed && (
                <>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-normal truncate" style={{ color: '#fff', fontWeight: 400 }}>{adminInfo.username}</div>
                    <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 300 }}>{adminInfo.role === 'admin' ? '超级管理员' : '管理员'}</div>
                  </div>
                  <button onClick={handleLogout} className="flex-shrink-0 p-1.5 rounded-md transition-all duration-200 hover:bg-white/[0.08]" style={{ color: 'rgba(255,255,255,0.4)' }} title="退出登录">
                    <LogOut className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        </aside>

        <div className={`flex-1 min-h-screen transition-all duration-300 dark ${collapsed ? 'ml-20' : 'ml-64'}`} style={{ background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
          <div className="p-6 lg:p-8">
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
