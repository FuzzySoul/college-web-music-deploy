import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Harmony | 音乐发现之旅',
  description: '探索音乐的无限可能 - 一个精致的音乐发现平台',
  keywords: ['音乐', '播放器', '歌单', '发现音乐', '在线音乐'],
  authors: [{ name: 'Music Enthusiast' }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="light">
      <head>
        <link rel="preconnect" href="https://fonts.cdnfonts.com" />
      </head>
      <body className="antialiased min-h-screen bg-background text-foreground overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
