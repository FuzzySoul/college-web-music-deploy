'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Music, Shield, ArrowRight } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen paper-texture flex items-center justify-center dark" style={{ backgroundColor: 'var(--background)' }}>
      <div className="w-full max-w-4xl px-4">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-md" style={{ backgroundColor: 'var(--primary)' }}>
              <Music className="w-10 h-10" style={{ color: 'var(--primary-foreground)' }} />
            </div>
          </div>
          <h1 className="text-4xl font-normal mb-2 artistic-title" style={{ color: 'var(--foreground)' }}>
            学院音乐
          </h1>
          <p style={{ color: 'var(--muted-foreground)' }}>选择您的登录方式</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          <Card className="cursor-pointer hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-0" style={{ backgroundColor: 'var(--card)' }}>
            <CardHeader className="text-center pb-4">
              <div className="w-14 h-14 mx-auto rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: 'var(--primary)' }}>
                <Music className="w-7 h-7" style={{ color: 'var(--primary-foreground)' }} />
              </div>
              <CardTitle className="text-xl font-normal artistic-title" style={{ color: 'var(--foreground)' }}>
                用户登录
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p style={{ color: 'var(--muted-foreground)', fontSize: '14px' }}>
                登录您的账户，享受个性化音乐服务
              </p>
              <Button 
                onClick={() => router.push('/login')}
                className="w-full font-medium"
                style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
              >
                进入用户登录
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-0" style={{ backgroundColor: 'var(--card)' }}>
            <CardHeader className="text-center pb-4">
              <div className="w-14 h-14 mx-auto rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: 'var(--gold)' }}>
                <Shield className="w-7 h-7 text-white" />
              </div>
              <CardTitle className="text-xl font-normal artistic-title" style={{ color: 'var(--foreground)' }}>
                管理员登录
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p style={{ color: 'var(--muted-foreground)', fontSize: '14px' }}>
                管理用户、歌手、歌曲和歌单内容
              </p>
              <Button 
                onClick={() => router.push('/admin/login')}
                className="w-full font-medium"
                style={{ backgroundColor: 'var(--gold)', color: 'white' }}
              >
                进入管理员登录
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
