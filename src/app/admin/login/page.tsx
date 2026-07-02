'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff, Shield, LogIn, AlertCircle } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, action: 'login' })
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        setError(data.error || '登录失败');
        return;
      }

      sessionStorage.setItem('adminAuth', JSON.stringify(data.admin));
      router.push('/admin');
    } catch (err) {
      setError('登录失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen paper-texture flex items-center justify-center dark" style={{ backgroundColor: 'var(--background)' }}>
      <Card className="w-full max-w-md border-0 shadow-lg" style={{ backgroundColor: 'var(--card)' }}>
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center shadow-sm" style={{ backgroundColor: 'var(--gold)' }}>
              <Shield className="w-7 h-7 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-normal artistic-title" style={{ color: 'var(--foreground)' }}>
            管理员后台
          </CardTitle>
          <CardDescription style={{ color: 'var(--muted-foreground)' }}>
            请输入管理员账户信息
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label style={{ color: 'var(--foreground)' }}>用户名</Label>
              <Input
                type="text"
                placeholder="请输入用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className=""
                style={{ backgroundColor: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                required
              />
            </div>

            <div className="space-y-2">
              <Label style={{ color: 'var(--foreground)' }}>密码</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
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
              style={{ backgroundColor: 'var(--gold)', color: 'white' }}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  登录中...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn className="w-4 h-4" />
                  登录
                </span>
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center">
          <a href="/" className="text-sm hover:underline" style={{ color: 'var(--primary)' }}>
            返回登录选择
          </a>
        </CardFooter>
      </Card>
    </div>
  );
}
