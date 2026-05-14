import React, { useState } from 'react';
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  Users,
  LogOut,
  Menu,
  X,
  Bell,
  Home,
  Camera,
  Calendar,
  User as UserIcon,
  TrendingUp,
  Clock,
  MapPin,
  ChevronDown,
  ShoppingBag,
  History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup
} from "@/components/ui/dropdown-menu";
import { UserRole } from '@/src/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { MOCK_BRANCHES } from '@/src/mockData';
import { useT } from '@/src/stores/i18nStore';
import { LanguageSwitcher } from './LanguageSwitcher';

interface LayoutProps {
  children: React.ReactNode;
  role: UserRole;
  userName: string;
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  selectedBase?: string;
  onBaseChange?: (base: string) => void;
  onHistoryClick?: () => void;
}

export function Layout({ children, role, userName, onLogout, activeTab, setActiveTab, selectedBase, onBaseChange, onHistoryClick }: LayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // 出退勤・休憩のコントロールは EmployeeHome 側に集約（旧トグルボタンは廃止）

  const t = useT();

  const adminNavItems = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { id: 'collections', label: t('nav.collections'), icon: ClipboardList },
    { id: 'inventory', label: t('nav.inventory'), icon: Package },
    { id: 'tasks', label: t('nav.tasks'), icon: ClipboardList },
    { id: 'banana-bay', label: t('nav.bananaBay'), icon: ShoppingBag },
    { id: 'attendance', label: t('nav.attendance'), icon: Clock },
    { id: 'sales', label: t('nav.sales'), icon: TrendingUp },
    { id: 'workers', label: t('nav.workers'), icon: Users },
  ];

  const workerNavItems = [
    { id: 'home', label: t('nav.workManagement'), icon: Home },
    { id: 'inventory', label: t('nav.inventoryList'), icon: Package },
    { id: 'report', label: t('nav.workReport'), icon: Camera },
    { id: 'schedule', label: t('nav.schedule'), icon: Calendar },
    { id: 'profile', label: t('nav.myPage'), icon: UserIcon },
  ];

  const collectorNavItems = [
    { id: 'home', label: t('nav.collectionWork'), icon: Home },
    { id: 'inventory', label: t('nav.inventoryList'), icon: Package },
    { id: 'report', label: t('nav.collectionReport'), icon: Camera },
    { id: 'schedule', label: t('nav.schedule'), icon: Calendar },
    { id: 'profile', label: t('nav.myPage'), icon: UserIcon },
  ];

  const navItems = role === 'admin' ? adminNavItems : role === 'worker' ? workerNavItems : collectorNavItems;

  if (role === 'worker' || role === 'collector') {
    return (
      <div className="flex flex-col h-screen bg-[#f8fafc]">
        {/* Mobile Header */}
        <header className="bg-white border-b px-4 py-3 flex justify-between items-center sticky top-0 z-10 h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#2563eb] rounded flex items-center justify-center">
              <Package className="text-white w-5 h-5" />
            </div>
            <h1 className="font-bold text-lg text-[#1e293b]">サスティナブルガレージ</h1>
          </div>
          <div className="flex items-center gap-1">
            <LanguageSwitcher />
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-6 h-6 text-[#64748b]" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-[#ef4444] rounded-full border-2 border-white"></span>
            </Button>
            <Button variant="ghost" size="icon" onClick={onLogout} className="text-[#64748b]">
              <LogOut className="w-6 h-6" />
            </Button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto pb-20">
          {children}
        </main>

        {/* Bottom Navigation */}
        <nav className="bg-white border-t flex flex-col fixed bottom-0 w-full z-20 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] safe-area-bottom">
          {(activeTab === 'report' || activeTab === 'schedule') && onHistoryClick && (
            <div className="px-4 py-2 border-b bg-slate-50/90 backdrop-blur-md flex justify-between items-center">
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quick Access</span>
               <button 
                 onClick={onHistoryClick}
                 className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full active:scale-95 transition-all shadow-sm border border-blue-100"
               >
                 <History className="w-3 h-3" />
                 {role === 'collector' ? '回収履歴を確認' : '作業履歴を確認'}
               </button>
            </div>
          )}
          <div className="flex justify-around items-center py-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-1 transition-colors",
                  activeTab === item.id ? "text-blue-600" : "text-slate-400"
                )}
              >
                <item.icon className="w-6 h-6" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-[240px] bg-[#0f172a] text-white shrink-0">
        <div className="p-6 flex items-center gap-3 border-b border-white/10 h-16">
          <div className="w-8 h-8 bg-[#2563eb] rounded flex items-center justify-center">
            <Package className="text-white w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-base leading-tight tracking-wide uppercase">SUSTAINABLE GARAGE</h1>
          </div>
        </div>
        
        <ScrollArea className="flex-1">
          <nav className="py-4">
            {adminNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "flex items-center gap-3 w-full px-6 py-3 text-sm font-medium transition-all border-l-4",
                  activeTab === item.id 
                    ? "bg-white/5 text-white border-[#2563eb]" 
                    : "text-[#94a3b8] border-transparent hover:text-white"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </nav>
        </ScrollArea>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-2 py-3">
            <div className="w-8 h-8 rounded-full bg-[#1e293b] flex items-center justify-center text-xs font-bold">
              {userName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{userName}</p>
              <p className="text-xs text-[#64748b] truncate">管理者</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onLogout} className="text-[#64748b] hover:text-white">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" />}>
                <Menu className="w-6 h-6" />
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-[240px] bg-[#0f172a] text-white border-none">
                {/* Mobile Sidebar Content */}
                <div className="p-6 flex items-center gap-3 border-b border-white/10 h-16">
                  <div className="w-8 h-8 bg-[#2563eb] rounded flex items-center justify-center">
                    <Package className="text-white w-5 h-5" />
                  </div>
                  <h1 className="font-bold text-base tracking-wide uppercase">SUSTAINABLE GARAGE</h1>
                </div>
                <nav className="py-4">
                  {adminNavItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setIsMobileMenuOpen(false);
                      }}
                      className={cn(
                        "flex items-center gap-3 w-full px-6 py-3 text-sm font-medium transition-all border-l-4",
                        activeTab === item.id 
                          ? "bg-white/5 text-white border-[#2563eb]" 
                          : "text-[#94a3b8] border-transparent hover:text-white"
                      )}
                    >
                      <item.icon className="w-4 h-4" />
                      {item.label}
                    </button>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
            <div className="text-sm text-[#64748b]">
              ダッシュボード / {navItems.find(i => i.id === activeTab)?.label}
            </div>
            {role === 'admin' && onBaseChange && (
              <div className="ml-4 flex items-center border-l pl-4 border-slate-200">
                <DropdownMenu>
                  <DropdownMenuTrigger render={
                    <Button variant="outline" size="sm" className="h-8 gap-2 bg-slate-50 border-slate-200 text-slate-700 font-bold hover:bg-slate-100">
                      <MapPin className="w-3.5 h-3.5 text-blue-600" />
                      {selectedBase}
                      <ChevronDown className="w-3 h-3 opacity-50" />
                    </Button>
                  } />
                  <DropdownMenuContent align="start" className="w-48 bg-white shadow-xl border-slate-200">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 py-2">拠点を選択</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {MOCK_BRANCHES.map((branch) => (
                        <DropdownMenuItem
                          key={branch.id}
                          onClick={() => {
                            onBaseChange(branch.name);
                            toast.info(`表示拠点を ${branch.name} に切り替えました`);
                          }}
                          className={cn(
                            "text-xs font-bold px-3 py-2 cursor-pointer transition-colors",
                            selectedBase === branch.name ? "text-blue-600 bg-blue-50" : "text-slate-600 hover:bg-slate-50"
                          )}
                        >
                          {branch.name}
                          {selectedBase === branch.name && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5 text-[#64748b]" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-[#ef4444] rounded-full border-2 border-white"></span>
            </Button>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-[#1e293b]">{userName} ({t('role.admin')})</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-[#e2e8f0] flex items-center justify-center text-[#64748b] font-bold text-xs">
                {userName.charAt(0)}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
