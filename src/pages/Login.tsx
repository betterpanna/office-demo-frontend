import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { UserRole } from '../types';
import { KeyRound, Mail, Lock, ArrowRight, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import { auth } from '../firebase';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { findUserByEmail, setCurrentUser } from '@/src/stores/currentUserStore';
import { useT } from '@/src/stores/i18nStore';
import { LanguageSwitcher } from '@/src/components/LanguageSwitcher';

interface LoginProps {
  onLogin: (role: UserRole) => void;
}

export function Login({ onLogin }: LoginProps) {
  const t = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [view, setView] = useState<'login' | 'reset'>('login');
  const [resetEmail, setResetEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const finalizeLogin = (loginEmail: string) => {
    const matched = findUserByEmail(loginEmail);
    if (matched) {
      setCurrentUser(matched);
      onLogin(matched.role);
      toast.success(`ようこそ ${matched.name} さん`);
      return;
    }
    // フォールバック: メールアドレスから役割を推定
    let role: UserRole = 'worker';
    if (loginEmail.includes('admin')) role = 'admin';
    if (loginEmail.includes('collector')) role = 'collector';
    setCurrentUser(null);
    onLogin(role);
    toast.success('ログインしました');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      finalizeLogin(email);
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error('ログインに失敗しました: ' + (error.message || '不明なエラー'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = (demoEmail: string) => {
    setEmail(demoEmail);
    finalizeLogin(demoEmail);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      toast.success('パスワード再設定用のメールを送信しました');
      setView('login');
    } catch (error: any) {
      toast.error('送信に失敗しました: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (view === 'reset') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-4 font-sans relative">
        <div className="absolute top-4 right-4">
          <LanguageSwitcher variant="standalone" />
        </div>
        <Card className="max-w-md w-full border-none shadow-2xl rounded-2xl overflow-hidden">
          <div className="h-2 bg-blue-600" />
          <CardHeader className="space-y-1 pt-8">
            <CardTitle className="text-2xl font-bold text-center">{t('login.resetTitle')}</CardTitle>
            <CardDescription className="text-center">
              {t('login.resetDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">{t('login.email')}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="name@example.com"
                    className="pl-10 h-12"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full h-12 bg-blue-600 hover:bg-blue-700 font-bold gap-2" disabled={isLoading}>
                <RefreshCcw className={cn("w-4 h-4", isLoading && "animate-spin")} /> {isLoading ? t('login.processing') : t('login.resetSubmit')}
              </Button>
            </form>
          </CardContent>
          <CardFooter>
            <Button variant="ghost" className="w-full" onClick={() => setView('login')}>
              {t('login.backToLogin')}
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-4 font-sans relative">
      {/* 言語スイッチャー（画面右上に固定） */}
      <div className="absolute top-4 right-4">
        <LanguageSwitcher variant="standalone" />
      </div>

      <Card className="max-w-md w-full border-none shadow-2xl rounded-2xl overflow-hidden">
        <div className="h-2 bg-blue-600" />
        <CardHeader className="space-y-1 pt-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
              <KeyRound className="text-white w-8 h-8" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold text-center text-slate-900">{t('login.title')}</CardTitle>
          <CardDescription className="text-center text-slate-500 font-medium">
            {t('login.subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('login.email')}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  className="pl-10 h-12"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t('login.password')}</Label>
                <button
                  type="button"
                  onClick={() => setView('reset')}
                  className="text-xs text-blue-600 hover:underline font-medium"
                >
                  {t('login.forgotPassword')}
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="pl-10 h-12"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full h-12 bg-blue-600 hover:bg-blue-700 font-bold text-lg gap-2 mt-2" disabled={isLoading}>
              {isLoading ? t('login.processing') : t('login.submit')} <ArrowRight className="w-5 h-5" />
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4 pb-8">
          <div className="relative w-full">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-slate-400 font-medium">DEMO</span>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 w-full">
            <p className="text-[10px] text-slate-400 text-center leading-relaxed">
              {t('login.demoHint')}
            </p>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 text-[10px] font-bold border-slate-200"
                onClick={() => handleQuickLogin('admin@example.com')}
              >
                {t('login.adminLogin')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 text-[10px] font-bold border-slate-200"
                onClick={() => handleQuickLogin('worker1@example.com')}
              >
                {t('login.workerLogin')}
              </Button>
            </div>
            <Button
              type="button"
              size="sm"
              className="h-10 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md mt-1"
              onClick={() => handleQuickLogin('herlen0976@banana-official.com')}
            >
              {t('login.odaLogin')}
            </Button>
          </div>
          <p className="text-center text-[10px] text-slate-300">
            © {new Date().getFullYear()} SL Corporation. All rights reserved.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
