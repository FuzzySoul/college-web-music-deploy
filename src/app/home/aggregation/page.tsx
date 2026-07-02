'use client';

import { MusicAggregationSection } from '@/components/music/MusicAggregationSection';

export default function AggregationPage() {
  return (
    <div className="fade-in">
      <h2 className="text-2xl font-normal artistic-title mb-6">歌单聚合</h2>
      <p className="text-muted-foreground mb-6">登录网易云音乐或QQ音乐，导入你的歌单</p>
      <MusicAggregationSection />
    </div>
  );
}
