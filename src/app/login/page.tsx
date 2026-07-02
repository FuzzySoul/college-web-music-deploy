'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eye, EyeOff, Music, LogIn, UserPlus, Mail, Lock, AlertCircle } from 'lucide-react';
import { getBrowserClient } from '@/lib/supabase-browser';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const supabase = getBrowserClient();

      if (mode === 'login') {
        const { data: authData, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        if (authData.user) {
          // 等待 session 持久化到 localStorage（关键修复）
          await supabase.auth.getSession();
          await fetch('/api/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'create_user',
              userData: {
                id: authData.user.id,
                email: authData.user.email,
                username: authData.user.email?.split('@')[0]
              }
            })
          });
        }

        router.push('/home');
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        if (data.user) {
          await fetch('/api/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'create_user',
              userData: {
                id: data.user.id,
                email: data.user.email,
                username: data.user.email?.split('@')[0]
              }
            })
          });
        }

        setError('注册成功！请检查邮箱确认登录。');
      }
    } catch (err: any) {
      setError(err.message || '操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('请先输入邮箱地址');
      return;
    }

    setLoading(true);
    try {
      const supabase = getBrowserClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email);

      if (error) throw error;
      setError('密码重置邮件已发送，请检查邮箱');
    } catch (err: any) {
      setError(err.message || '发送失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen paper-texture flex items-center justify-center dark" style={{ backgroundColor: 'var(--background)' }}>
      <Card className="w-full max-w-md border-0 shadow-lg" style={{ backgroundColor: 'var(--card)' }}>
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center shadow-sm" style={{ backgroundColor: 'var(--primary)' }}>
              <Music className="w-7 h-7" style={{ color: 'var(--primary-foreground)' }} />
            </div>
          </div>
          <CardTitle className="text-2xl font-normal artistic-title" style={{ color: 'var(--foreground)' }}>
            学院音乐
          </CardTitle>
          <CardDescription style={{ color: 'var(--muted-foreground)' }}>
            {mode === 'login' ? '登录您的账户' : '创建新账户'}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'login' | 'register')} className="w-full">
            <TabsList className="w-full" style={{ backgroundColor: 'var(--muted)' }}>
              <TabsTrigger value="login" className="flex-1" style={{ color: 'var(--foreground)' }}>
                登录
              </TabsTrigger>
              <TabsTrigger value="register" className="flex-1" style={{ color: 'var(--foreground)' }}>
                注册
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label style={{ color: 'var(--foreground)' }}>邮箱</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  style={{ backgroundColor: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label style={{ color: 'var(--foreground)' }}>密码</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  style={{ backgroundColor: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                />
                <Label htmlFor="remember" className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  记住我
                </Label>
              </div>
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-sm hover:underline"
                  style={{ color: 'var(--primary)' }}
                >
                  忘记密码？
                </button>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg text-sm" style={{ backgroundColor: 'var(--destructive)', color: 'white' }}>
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full font-medium"
              style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  {mode === 'login' ? '登录中...' : '注册中...'}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  {mode === 'login' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                  {mode === 'login' ? '登录' : '注册'}
                </span>
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center">
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            还没有账户？{' '}
            <button
              type="button"
              onClick={() => setMode('register')}
              className="font-semibold hover:underline"
              style={{ color: 'var(--primary)' }}
            >
              立即注册
            </button>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
