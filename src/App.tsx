/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { AdminDashboard } from './pages/AdminDashboard';
import { InventoryManagement } from './pages/InventoryManagement';
import { CollectionManagement } from './pages/CollectionManagement';
import { TaskAssignment } from './pages/TaskAssignment';
import { EmployeeHome } from './pages/EmployeeHome';
import { WorkerReport } from './pages/WorkerReport';
import { Login } from './pages/Login';
import { SalesManagement } from './pages/SalesManagement';
import { EmployeeManagement } from './pages/EmployeeManagement';
import AttendanceManagement from './pages/AttendanceManagement';
import { BananaBayManagement } from './pages/BananaBayManagement';
import { UserRole } from './types';
import { Toaster } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { 
  Camera, 
  Clock, 
  Settings, 
  LogOut, 
  ChevronRight 
} from 'lucide-react';

import { WorkerSchedule } from './pages/WorkerSchedule';
import { CollectorSchedule } from './pages/CollectorSchedule';
import { CollectorReport } from './pages/CollectorReport';
import { MOCK_BRANCHES } from './mockData';
import { useCurrentUser, clearCurrentUser } from './stores/currentUserStore';

export default function App() {
  const [role, setRole] = useState<UserRole>('admin');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedBase, setSelectedBase] = useState(MOCK_BRANCHES[0]?.name ?? '');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportInitialTab, setReportInitialTab] = useState<'report' | 'history'>('report');
  const currentUser = useCurrentUser();

  const handleLogin = (newRole: UserRole) => {
    setRole(newRole);
    setActiveTab(newRole === 'admin' ? 'dashboard' : 'home');
    setIsLoggedIn(true);
  };

  // ログイン直後にユーザー情報があれば selectedBase を本人の拠点に同期
  React.useEffect(() => {
    if (isLoggedIn && currentUser?.base) {
      setSelectedBase(currentUser.base);
    }
  }, [isLoggedIn, currentUser]);

  const handleLogout = () => {
    setIsLoggedIn(false);
    setShowReport(false);
    clearCurrentUser();
  };

  const openHistory = () => {
    setReportInitialTab('history');
    setShowReport(true);
  };

  if (!isLoggedIn) {
    return (
      <>
        <Login onLogin={handleLogin} />
        <Toaster position="top-center" />
      </>
    );
  }

  if (showReport) {
    return (
      <>
        {role === 'worker' ? (
          <WorkerReport onBack={() => setShowReport(false)} initialTab={reportInitialTab} />
        ) : role === 'collector' ? (
          <CollectorReport onBack={() => setShowReport(false)} initialTab={reportInitialTab} />
        ) : null}
        <Toaster position="top-center" />
      </>
    );
  }

  return (
    <Layout
      role={role}
      userName={currentUser?.name ?? (role === 'admin' ? '管理者 太郎' : role === 'collector' ? '回収員 三郎' : '作業員 一郎')}
      onLogout={handleLogout}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      selectedBase={selectedBase}
      onBaseChange={setSelectedBase}
      onHistoryClick={openHistory}
    >
      {role === 'admin' ? (
        <>
          {activeTab === 'dashboard' && <AdminDashboard selectedBase={selectedBase} />}
          {activeTab === 'inventory' && <InventoryManagement role={role} selectedBase={selectedBase} />}
          {activeTab === 'collections' && <CollectionManagement selectedBase={selectedBase} />}
          {activeTab === 'sales' && <SalesManagement selectedBase={selectedBase} />}
          {activeTab === 'banana-bay' && <BananaBayManagement selectedBase={selectedBase} />}
          {activeTab === 'attendance' && <AttendanceManagement selectedBase={selectedBase} />}
          {activeTab === 'tasks' && <TaskAssignment selectedBase={selectedBase} />}
          {activeTab === 'workers' && <EmployeeManagement selectedBase={selectedBase} />}
        </>
      ) : (
        <>
          {activeTab === 'home' && (
            <EmployeeHome />
          )}
          {activeTab === 'inventory' && (
            <div className="p-4">
              <InventoryManagement role={role} selectedBase={MOCK_BRANCHES[role === 'worker' ? 0 : 1]?.name ?? MOCK_BRANCHES[0]?.name ?? ''} />
            </div>
          )}
          {activeTab === 'report' && (
            <div className="flex flex-col h-full bg-[#f8fafc]">
              <div className="p-4 space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold text-[#1e293b]">業務報告・履歴</h2>
                  <Button variant="outline" size="sm" onClick={() => setShowReport(true)} className="rounded-lg h-9 font-bold text-blue-600 border-blue-100">
                    新規作成
                  </Button>
                </div>
                
                <div 
                  onClick={() => setShowReport(true)}
                  className="w-full aspect-[2/1] bg-white rounded-2xl flex flex-col items-center justify-center text-slate-400 gap-3 border-2 border-dashed border-slate-100 shadow-sm transition-all hover:border-blue-200 hover:bg-blue-50/30"
                >
                  <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center">
                    <Camera className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="font-bold text-xs">業務報告を開始</p>
                </div>

                <div className="space-y-4">
                   <h3 className="font-bold text-slate-700 text-sm">最近の実績</h3>
                   <div className="space-y-3">
                     {[
                       { date: '今日', target: role === 'worker' ? 'プリウス エンジン' : '佐藤 健一 様', task: role === 'worker' ? '検品' : '回収', qty: 1, val: role === 'worker' ? '¥500' : '3点' },
                       { date: '昨日', target: role === 'worker' ? 'アクア バンパー' : '（株）オート 様', task: role === 'worker' ? '洗浄' : '回収', qty: 2, val: role === 'worker' ? '¥800' : '12点' }
                     ].map((item, i) => (
                       <div key={i} className="bg-white p-4 rounded-xl shadow-sm border border-slate-50 flex justify-between items-center">
                         <div>
                           <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{item.date} · {item.task}</p>
                           <h4 className="font-bold text-slate-800 text-sm">{item.target}</h4>
                         </div>
                         <div className="text-right">
                           <p className="font-black text-blue-600">{item.val}</p>
                           <p className="text-[10px] text-slate-400 font-bold">完了</p>
                         </div>
                       </div>
                     ))}
                   </div>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'schedule' && (role === 'worker' ? <WorkerSchedule /> : <CollectorSchedule />)}
          {activeTab === 'profile' && (
            <div className="p-6 space-y-6">
              <div className="flex flex-col items-center gap-4 py-6">
                <div className={cn(
                  "w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold overflow-hidden",
                  role === 'worker' ? "bg-blue-100 text-blue-600" : "bg-amber-100 text-amber-600"
                )}>
                  {currentUser?.avatar ? (
                    <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
                  ) : (
                    (currentUser?.name?.charAt(0) ?? (role === 'worker' ? '一' : '三'))
                  )}
                </div>
                <div className="text-center">
                  <h2 className="text-xl font-bold">{currentUser?.name ?? (role === 'worker' ? '作業員 一郎' : '回収員 三郎')}</h2>
                  <p className="text-xs text-slate-400">
                    {currentUser?.email ?? (role === 'worker' ? '商品化チーム · リーダー' : '回収チーム · 専任')}
                  </p>
                  {currentUser?.base && (
                    <p className="text-[10px] text-slate-500 font-bold mt-1">{currentUser.base}</p>
                  )}
                </div>
              </div>
              
              <div className="space-y-3">
                <Card className="p-4 border-none shadow-sm rounded-2xl flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 rounded-lg"><Clock className="w-5 h-5 text-slate-500" /></div>
                    <span className="text-sm font-bold">稼働/エリア設定</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </Card>
                <Card className="p-4 border-none shadow-sm rounded-2xl flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 rounded-lg"><Settings className="w-5 h-5 text-slate-500" /></div>
                    <span className="text-sm font-bold">通知設定</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </Card>
                <Card className="p-4 border-none shadow-sm rounded-2xl flex justify-between items-center text-red-500" onClick={handleLogout}>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-50 rounded-lg"><LogOut className="w-5 h-5" /></div>
                    <span className="text-sm font-bold">ログアウト</span>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </>
      )}
      <Toaster position="top-center" />
    </Layout>
  );
}


