import React, { useState, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line
} from 'recharts';
import {
  TrendingUp,
  Package,
  AlertTriangle,
  CheckCircle2,
  Users,
  Clock,
  Star,
  FileText,
  Bell,
  MessageSquare,
  ChevronRight,
  Send,
  ShoppingBag,
  Banknote,
  CircleAlert,
  Tag,
} from 'lucide-react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion } from 'motion/react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot,
  limit
} from 'firebase/firestore';
import { db } from '@/src/firebase';

import {
  MOCK_BRANCHES,
  MOCK_USERS,
  MOCK_BANANA_LISTINGS,
} from '@/src/mockData';
import { useInventory } from '@/src/stores/inventoryStore';
import { useTasks } from '@/src/stores/tasksStore';
import { useTaskMasters } from '@/src/stores/taskMastersStore';
import {
  useMessages,
  sendMessage as sendMessageToStore,
  getThread,
  getLastMessage,
  countMessages,
  type MessageChannel,
} from '@/src/stores/messagesStore';
import { useCurrentUser } from '@/src/stores/currentUserStore';
import { useT } from '@/src/stores/i18nStore';

import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';

interface AdminDashboardProps {
  selectedBase?: string;
}

// Leaflet のデフォルトアイコンを CDN から取得
if (typeof L !== 'undefined' && L.Icon) {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl:
      'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl:
      'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });
}

// 拠点の緯度経度
const BRANCH_COORDS: Record<string, { lat: number; lng: number }> = {
  大阪支店: { lat: 34.8159, lng: 135.5687 },
  和歌山支店: { lat: 34.1545, lng: 135.2099 },
  滋賀支店: { lat: 35.0044, lng: 135.8626 },
};

// 拠点マーカー（拠点名・色付き）
const createBranchIcon = (label: string, color: string) =>
  L.divIcon({
    className: 'branch-marker',
    html: `<div style="
      background:${color};
      color:#fff;
      padding:6px 10px;
      border-radius:9999px;
      font-weight:900;
      font-size:11px;
      letter-spacing:0.04em;
      box-shadow:0 6px 14px rgba(0,0,0,0.18);
      border:2px solid #fff;
      white-space:nowrap;
    ">${label}</div>`,
    iconSize: [80, 28],
    iconAnchor: [40, 14],
  });

export function AdminDashboard({ selectedBase }: AdminDashboardProps) {
  const t = useT();
  const [realtimeReceipts, setRealtimeReceipts] = useState<any[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const taskMasters = useTaskMasters();

  // 管理者メッセージ・業務連絡（store ベース）
  // - 管理者は「全体」または「特定従業員」へ送信可能
  // - チャネル選択により表示スレッドが切り替わる
  const currentUser = useCurrentUser();
  useMessages(); // 再描画用にストアを購読
  const [activeChannel, setActiveChannel] = useState<MessageChannel>('all');
  const [messageDraft, setMessageDraft] = useState('');
  const adminId = currentUser?.id ?? 'u1';
  const adminName = currentUser?.name ?? '管理者';
  const handleSendMessage = () => {
    const sent = sendMessageToStore({
      fromUserId: adminId,
      fromName: adminName,
      fromRole: 'admin',
      channel: activeChannel,
      body: messageDraft,
    });
    if (sent) setMessageDraft('');
  };

  useEffect(() => {
    const q = query(collection(db, 'receipts'), orderBy('issuedAt', 'desc'), limit(10));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const receipts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRealtimeReceipts(receipts);
    });
    return () => unsubscribe();
  }, []);

  const inventory = useInventory();
  const allTasks = useTasks();
  // Real-time filtering based on selectedBase
  const filteredInventory = inventory.filter(item => !selectedBase || item.baseName === selectedBase);
  const filteredTasks = allTasks.filter(task => {
    const invItem = inventory.find(i => i.id === task.targetId);
    return !selectedBase || invItem?.baseName === selectedBase;
  });
  
  const unregisteredCount = filteredInventory.filter(i => i.status === 'unregistered').length;
  const todayPrefix = new Date().toISOString().slice(0, 10);
  const completedTodayCount = filteredTasks.filter(
    (t) => t.status === 'completed' && (t.completedDate || '').slice(0, 10) === todayPrefix,
  ).length;
  const totalInStock = filteredInventory.length;
  const inStockCount = filteredInventory.filter(i => i.status === 'in_stock').length;
  const listingRate = totalInStock > 0 ? Math.round((filteredInventory.filter(i => i.bananaBayStatus === 'sold' || i.bananaBayStatus === 'listed').length / totalInStock) * 100) : 0;

  const alertingItems = filteredInventory.filter(i => i.stayDays && i.stayDays >= 5 && i.status !== 'sold');

  // Pie chart data calculation
  const getStatusCount = (status: string) => filteredInventory.filter(i => i.status === status).length;
  const dynamicStatusData = [
    { name: '未登録', value: getStatusCount('unregistered'), color: '#ef4444', avgDays: 5.2 },
    { name: '商品化中', value: getStatusCount('in_production'), color: '#3b82f6', avgDays: 3.5 },
    { name: '在庫あり', value: getStatusCount('in_stock'), color: '#10b981', avgDays: 12.4 },
    { name: '販売済み', value: getStatusCount('sold'), color: '#64748b', avgDays: 0.5 },
  ].filter(d => d.value > 0);

  // Category bar chart data
  const categories = Array.from(new Set(inventory.map(i => i.category)));
  const dynamicInventoryData = categories.map(cat => ({
    name: cat,
    stock: filteredInventory.filter(i => i.category === cat).length,
    listed: filteredInventory.filter(i => i.category === cat && (i.bananaBayStatus === 'listed' || i.bananaBayStatus === 'sold')).length
  })).sort((a,b) => b.stock - a.stock).slice(0, 5);

  const progressData = [
    { name: '08:00', value: 10 },
    { name: '10:00', value: 35 },
    { name: '12:00', value: 55 },
    { name: '14:00', value: 75 },
    { name: '16:00', value: 90 },
    { name: '18:00', value: 100 },
  ];

  // 拠点別の効率／モチベーションのサンプル指標（実データ化までの暫定値）
  const baseKpiSamples = [
    { efficiency: 92, inventory: 85, sales: 1200, motivation: 4.5 },
    { efficiency: 88, inventory: 72, sales: 950, motivation: 4.2 },
    { efficiency: 95, inventory: 90, sales: 1100, motivation: 4.8 },
  ];

  // 従業員別の進捗集計（作業員＋回収員）
  // ・selectedBase 指定時はその拠点の従業員のみ
  // ・各従業員に対して allTasks から本人担当の件数をステータス別に集計
  // ・進行中タスクの作業マスター名を "現在の作業" として表示
  const todayStr = new Date().toISOString().slice(0, 10);
  const workerStats = MOCK_USERS
    .filter((u) => u.role !== 'admin')
    .filter((u) => !selectedBase || u.base === selectedBase)
    .map((u) => {
      const myTasks = allTasks.filter((t) => t.assigneeId === u.id);
      // pending（未着手）= 割当済(assigned) + 旧 pending（未割当だが本人保持）扱い
      const pending = myTasks.filter((t) => t.status === 'assigned' || t.status === 'pending').length;
      const inProgress = myTasks.filter((t) => t.status === 'in_progress').length;
      const completed = myTasks.filter((t) => t.status === 'completed').length;
      const completedToday = myTasks.filter(
        (t) => t.status === 'completed' && (t.completedDate || '').slice(0, 10) === todayStr,
      ).length;
      const total = myTasks.length;
      const progressRate = total > 0 ? Math.round((completed / total) * 100) : 0;
      const current = myTasks.find((t) => t.status === 'in_progress')
        ?? myTasks.find((t) => t.status === 'assigned' && t.dispatched);
      const currentMaster = current
        ? taskMasters.find((m) => m.id === current.taskMasterId)
        : null;
      const status: 'working' | 'idle' | 'offline' =
        inProgress > 0 ? 'working' : pending > 0 ? 'idle' : 'offline';
      return {
        id: u.id,
        name: u.name,
        role: u.role,
        avatar: u.avatar,
        base: u.base,
        pending,
        inProgress,
        completed,
        completedToday,
        total,
        progressRate,
        currentTaskName: currentMaster?.name ?? null,
        currentTime: current?.scheduledStartTime ?? null,
        status,
      };
    })
    // 並び順: 作業中 → 待機 → オフライン、その中で進捗率の高い順
    .sort((a, b) => {
      const order = { working: 0, idle: 1, offline: 2 } as const;
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      return b.progressRate - a.progressRate;
    });

  /* ----------------------------------------------------------------
   *  BANANA BAY 販売状況
   *  - selectedBase に応じて inventory 経由でフィルタ
   * --------------------------------------------------------------*/
  const inventoryById = new Map(inventory.map((i) => [i.id, i]));
  const filteredListings = MOCK_BANANA_LISTINGS.filter((l) => {
    if (!selectedBase) return true;
    const inv = inventoryById.get(l.inventoryId);
    return inv?.baseName === selectedBase;
  });
  const bbListedCount = filteredListings.filter((l) => l.status === 'listed' || l.status === 'listing').length;
  const bbSoldCount = filteredListings.filter((l) => l.status === 'sold').length;
  const bbErrorCount = filteredListings.filter((l) => l.status === 'error' || l.status === 'returned').length;
  const bbSoldRevenue = filteredListings
    .filter((l) => l.status === 'sold')
    .reduce((sum, l) => sum + (l.price || 0), 0);
  const bbSoldToday = filteredListings.filter(
    (l) => l.status === 'sold' && (l.updateDate || '').slice(0, 10) === todayStr,
  );
  const bbSoldTodayRevenue = bbSoldToday.reduce((sum, l) => sum + (l.price || 0), 0);

  // 過去7日間の出品／成約トレンド
  const bbTrend = (() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().slice(0, 10);
    });
    return days.map((d) => {
      const listed = filteredListings.filter((l) => (l.listingDate || '').slice(0, 10) === d).length;
      const soldOnDay = filteredListings.filter(
        (l) => l.status === 'sold' && (l.updateDate || '').slice(0, 10) === d,
      );
      const sold = soldOnDay.length;
      const revenue = soldOnDay.reduce((s, l) => s + (l.price || 0), 0);
      return {
        date: d.slice(5).replace('-', '/'),
        listed,
        sold,
        revenue,
      };
    });
  })();

  // ステータス内訳
  const bbStatusData = [
    { name: '出品中', value: bbListedCount, color: '#3b82f6' },
    { name: '売却済', value: bbSoldCount, color: '#10b981' },
    { name: '要対応', value: bbErrorCount, color: '#f43f5e' },
  ].filter((d) => d.value > 0);

  // 最新の販売・出品アクティビティ（updateDate 降順）
  const bbRecentActivity = [...filteredListings]
    .sort((a, b) => (b.updateDate || '').localeCompare(a.updateDate || ''))
    .slice(0, 6);

  /* ----------------------------------------------------------------
   *  拠点別 集計（comparison タブ用）
   *  inventory + tasks + BANANA BAY 出品から拠点ごとの実績を算出
   * --------------------------------------------------------------*/
  const baseColors: Record<string, string> = {
    大阪支店: '#2563eb',
    和歌山支店: '#10b981',
    滋賀支店: '#f59e0b',
  };
  const baseDetailedKpi = MOCK_BRANCHES.map((b, idx) => {
    const baseInventory = inventory.filter((i) => i.baseName === b.name);
    const baseListings = MOCK_BANANA_LISTINGS.filter((l) => {
      const inv = inventoryById.get(l.inventoryId);
      return inv?.baseName === b.name;
    });
    const baseWorkers = MOCK_USERS.filter(
      (u) => u.role !== 'admin' && u.base === b.name,
    );
    const baseWorkingNow = allTasks
      .filter((t) => t.status === 'in_progress')
      .filter((t) => MOCK_USERS.find((u) => u.id === t.assigneeId)?.base === b.name).length;
    const sample = baseKpiSamples[idx] ?? baseKpiSamples[baseKpiSamples.length - 1];
    const soldList = baseListings.filter((l) => l.status === 'sold');
    return {
      id: b.id,
      name: b.name,
      address: b.address,
      phone: b.phone,
      coords: BRANCH_COORDS[b.name],
      color: baseColors[b.name] ?? '#3b82f6',
      // 既存サンプル
      efficiency: sample.efficiency,
      inventoryRate: sample.inventory,
      motivation: sample.motivation,
      // 実データ集計
      inventoryCount: baseInventory.length,
      listedCount: baseListings.filter((l) => l.status === 'listed' || l.status === 'listing').length,
      soldCount: soldList.length,
      soldRevenue: soldList.reduce((s, l) => s + (l.price || 0), 0),
      errorCount: baseListings.filter((l) => l.status === 'error' || l.status === 'returned').length,
      workerCount: baseWorkers.length,
      workingNow: baseWorkingNow,
    };
  });
  const totalInventoryAcrossBases = baseDetailedKpi.reduce((s, b) => s + b.inventoryCount, 0);
  const totalSoldRevenueAcrossBases = baseDetailedKpi.reduce((s, b) => s + b.soldRevenue, 0);
  const totalWorkersAcrossBases = baseDetailedKpi.reduce((s, b) => s + b.workerCount, 0);
  const topBaseByRevenue = [...baseDetailedKpi].sort((a, b) => b.soldRevenue - a.soldRevenue)[0];

  // 地図の中心と zoom（全拠点が収まるよう平均値を採用）
  const validCoords = baseDetailedKpi.filter((b) => b.coords);
  const mapCenter: [number, number] = validCoords.length
    ? [
        validCoords.reduce((s, b) => s + b.coords!.lat, 0) / validCoords.length,
        validCoords.reduce((s, b) => s + b.coords!.lng, 0) / validCoords.length,
      ]
    : [34.8, 135.5];

  return (
    <div className="space-y-6">
      <Tabs defaultValue="overview" className="w-full">
        <div className="flex items-center justify-between mb-4">
          <TabsList className="bg-white p-1 rounded-xl shadow-sm border border-slate-200">
            <TabsTrigger value="overview" className="rounded-lg px-6">{t('dashboard.overview')}</TabsTrigger>
            <TabsTrigger value="comparison" className="rounded-lg px-6">{t('dashboard.comparison')}</TabsTrigger>
          </TabsList>
          {selectedBase && (
            <Badge variant="secondary" className="font-bold text-blue-600 bg-blue-50 border-blue-100">
              {t('admin.displayingBase')}: {selectedBase}
            </Badge>
          )}
        </div>

        <TabsContent value="overview" className="space-y-6 mt-0">
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            <div className="xl:col-span-3 space-y-6">
              {alertingItems.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-red-900">{t('admin.alertStaleItems')} ({alertingItems.length})</h4>
                      <p className="text-xs text-red-700">{t('admin.alertStaleDesc')}</p>
                    </div>
                  </div>
                  <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white font-bold h-9 px-4 shrink-0 shadow-sm" onClick={() => window.location.hash = 'inventory'}>
                    {t('admin.checkTargets')}
                  </Button>
                </div>
              )}
              
              {/* Top Stats - 在庫 / 業務 KPI */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">
                  {t('admin.inventoryKpi')}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-3">
                  <Card className="border-[#e2e8f0] shadow-sm rounded-xl">
                    <CardContent className="p-3">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1 truncate">{t('admin.totalInventory')}</p>
                          <h3 className="text-lg font-black tabular-nums">{totalInStock}<span className="text-[10px] font-medium text-slate-400 ml-1">{t('admin.cases')}</span></h3>
                          <p className="text-[9px] text-slate-400 mt-0.5">{t('admin.inStockListingRate')}: {inStockCount} / {listingRate}%</p>
                        </div>
                        <div className="p-2 bg-slate-50 rounded-lg text-slate-600 shrink-0">
                          <Package className="w-4 h-4" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-[#e2e8f0] shadow-sm rounded-xl">
                    <CardContent className="p-3">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1 truncate">{t('admin.unregisteredInventory')}</p>
                          <h3 className={cn("text-lg font-black tabular-nums", unregisteredCount > 0 ? "text-red-600" : "text-slate-700")}>
                            {unregisteredCount}<span className="text-[10px] font-medium text-slate-400 ml-1">{t('admin.cases')}</span>
                          </h3>
                          <p className="text-[9px] text-slate-400 mt-0.5">{t('admin.awaitingSorting')}</p>
                        </div>
                        <div className="p-2 bg-red-50 rounded-lg text-red-600 shrink-0">
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-[#e2e8f0] shadow-sm rounded-xl">
                    <CardContent className="p-3">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1 truncate">{t('admin.todayCompleted')}</p>
                          <h3 className="text-lg font-black tabular-nums">{completedTodayCount}<span className="text-[10px] font-medium text-slate-400 ml-1">{t('admin.cases')}</span></h3>
                          <p className="text-[9px] text-slate-400 mt-0.5">{workerStats.filter((w) => w.status === 'working').length} {t('admin.workersWorking')}</p>
                        </div>
                        <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600 shrink-0">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* BANANA BAY KPI */}
              <div>
                <div className="flex items-center justify-between mb-2 px-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 flex items-center gap-1.5">
                    <ShoppingBag className="w-3 h-3" /> {t('admin.bbSales')}
                  </p>
                  <button
                    onClick={() => (window.location.hash = 'banana-bay')}
                    className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-0.5"
                  >
                    {t('admin.detail')} <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card className="border-[#e2e8f0] shadow-sm rounded-xl">
                    <CardContent className="p-3">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1 truncate">{t('admin.listed')}</p>
                          <h3 className="text-lg font-black tabular-nums">{bbListedCount}<span className="text-[10px] font-medium text-slate-400 ml-1">{t('admin.points')}</span></h3>
                        </div>
                        <div className="p-2 bg-blue-50 rounded-lg text-blue-600 shrink-0">
                          <Tag className="w-4 h-4" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-[#e2e8f0] shadow-sm rounded-xl">
                    <CardContent className="p-3">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1 truncate">{t('admin.totalSold')}</p>
                          <h3 className="text-lg font-black tabular-nums text-emerald-700">{bbSoldCount}<span className="text-[10px] font-medium text-slate-400 ml-1">{t('admin.points')}</span></h3>
                        </div>
                        <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600 shrink-0">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-[#e2e8f0] shadow-sm rounded-xl">
                    <CardContent className="p-3">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1 truncate">{t('admin.todayRevenue')}</p>
                          <h3 className="text-lg font-black tabular-nums text-amber-700">
                            ¥{bbSoldTodayRevenue.toLocaleString()}
                          </h3>
                          <p className="text-[9px] text-slate-400 mt-0.5">{bbSoldToday.length} {t('admin.salesCount')}</p>
                        </div>
                        <div className="p-2 bg-amber-50 rounded-lg text-amber-600 shrink-0">
                          <Banknote className="w-4 h-4" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-[#e2e8f0] shadow-sm rounded-xl">
                    <CardContent className="p-3">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1 truncate">{t('admin.requireAttention')}</p>
                          <h3 className={cn("text-lg font-black tabular-nums", bbErrorCount > 0 ? "text-rose-600" : "text-slate-700")}>
                            {bbErrorCount}<span className="text-[10px] font-medium text-slate-400 ml-1">{t('admin.points')}</span>
                          </h3>
                          <p className="text-[9px] text-slate-400 mt-0.5">{t('admin.errorReturn')}</p>
                        </div>
                        <div className="p-2 bg-rose-50 rounded-lg text-rose-600 shrink-0">
                          <CircleAlert className="w-4 h-4" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>

            <Card className="xl:col-span-1 border-blue-100 shadow-xl shadow-blue-50/50 rounded-2xl overflow-hidden bg-white flex flex-col">
               <CardHeader className="bg-blue-600 text-white py-4">
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <Bell className="w-4 h-4" />
                        <CardTitle className="text-sm font-black">{t('admin.receiptInfo')}</CardTitle>
                     </div>
                     <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                  </div>
               </CardHeader>
               <CardContent className="p-4 flex-1 overflow-y-auto max-h-[400px] space-y-3">
                  {realtimeReceipts.length > 0 ? (
                    realtimeReceipts.map((receipt) => (
                      <motion.div 
                        key={receipt.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1 relative group hover:bg-blue-50 hover:border-blue-100 transition-colors cursor-pointer"
                        onClick={() => {
                          setSelectedReceipt(receipt);
                          setIsPreviewOpen(true);
                        }}
                      >
                         <div className="flex justify-between items-start">
                            <span className="text-[9px] font-black text-blue-600 uppercase">Received</span>
                            <span className="text-[9px] font-bold text-slate-400">{new Date(receipt.issuedAt).toLocaleTimeString()}</span>
                         </div>
                         <h4 className="text-xs font-black text-slate-800">{receipt.customerName} {t('admin.toCustomerSan')}</h4>
                         <div className="flex justify-between items-center pt-1">
                            <p className="text-[10px] text-slate-500 font-bold">担当: {receipt.collectorName}</p>
                            <p className="text-[10px] text-blue-700 font-black">¥{receipt.totalAmount.toLocaleString()}</p>
                         </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-slate-300 gap-2">
                       <FileText className="w-8 h-8 opacity-20" />
                       <p className="text-[10px] font-black uppercase tracking-widest">No Recent Receipts</p>
                    </div>
                  )}
               </CardContent>
            </Card>
          </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-[#e2e8f0] shadow-none rounded-lg">
          <CardHeader className="flex flex-row items-center justify-between border-b border-[#e2e8f0] py-4">
            <div>
              <CardTitle className="text-base font-bold">{t('admin.todayProgress')}</CardTitle>
            </div>
            <Badge variant="outline" className="bg-blue-50 text-[#2563eb] border-blue-200 text-[10px] uppercase tracking-wider">
              {t('admin.realtime')}
            </Badge>
          </CardHeader>
          <CardContent className="h-[300px] pt-6">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={progressData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '4px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#2563eb" 
                  strokeWidth={2} 
                  dot={{ r: 3, fill: '#2563eb', strokeWidth: 1, stroke: '#fff' }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-[#e2e8f0] shadow-none rounded-lg">
          <CardHeader className="border-b border-[#e2e8f0] py-4">
            <CardTitle className="text-base font-bold">{t('admin.inventoryStatusBreakdown')}</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] flex flex-col justify-center pt-6">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={dynamicStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {dynamicStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-6 space-y-2">
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1 px-1">
                <span>{t('admin.statusLabel')}</span>
                <div className="flex gap-4">
                  <span>{t('admin.countLabel')}</span>
                </div>
              </div>
              {dynamicStatusData.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-xs py-1 border-b border-slate-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-[#64748b]">{item.name}</span>
                  </div>
                  <div className="flex gap-4 items-center">
                    <span className="font-bold text-[#1e293b]">{item.value}{t('admin.cases')}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* BANANA BAY 販売状況 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 7日間トレンド */}
        <Card className="lg:col-span-2 border-[#e2e8f0] shadow-none rounded-lg overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b border-[#e2e8f0] py-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-amber-600" />
                {t('admin.bbTrend')}
              </CardTitle>
              <CardDescription className="text-[11px]">
                {t('admin.totalRevenue')} ¥{bbSoldRevenue.toLocaleString()} / {t('admin.listed')} {bbListedCount} {t('admin.points')}
              </CardDescription>
            </div>
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] uppercase tracking-wider font-bold">
              {bbSoldCount} SOLD
            </Badge>
          </CardHeader>
          <CardContent className="h-[260px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={bbTrend} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '11px' }}
                  formatter={(v: any, name: string) => {
                    if (name === '売上') return [`¥${Number(v).toLocaleString()}`, '売上'];
                    return [v, name];
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="listed"
                  name={t('admin.listingShort')}
                  stroke="#94a3b8"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#94a3b8', strokeWidth: 1, stroke: '#fff' }}
                />
                <Line
                  type="monotone"
                  dataKey="sold"
                  name={t('admin.sold')}
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#10b981', strokeWidth: 1, stroke: '#fff' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
          <div className="px-4 pb-3 flex items-center gap-4 text-[10px] font-bold text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-400" /> {t('admin.listingShort')}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> {t('admin.sold')}
            </span>
          </div>
        </Card>

        {/* 直近の販売・出品アクティビティ */}
        <Card className="border-[#e2e8f0] shadow-none rounded-lg overflow-hidden">
          <CardHeader className="border-b border-[#e2e8f0] py-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              {t('admin.recentActivity')}
            </CardTitle>
            <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-[10px] font-bold">
              {bbRecentActivity.length}
            </Badge>
          </CardHeader>
          <CardContent className="p-0 max-h-[300px] overflow-y-auto">
            {bbRecentActivity.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-300 gap-2">
                <ShoppingBag className="w-8 h-8 opacity-40" />
                <p className="text-[10px] font-black uppercase tracking-widest">No Activity</p>
              </div>
            ) : (
              bbRecentActivity.map((l) => {
                const statusMeta =
                  l.status === 'sold'
                    ? { label: t('admin.bbSoldDone'), cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' }
                    : l.status === 'listed'
                    ? { label: t('admin.bbListed'), cls: 'bg-blue-50 text-blue-700 border-blue-100' }
                    : l.status === 'listing'
                    ? { label: t('admin.bbInProc'), cls: 'bg-slate-50 text-slate-600 border-slate-200' }
                    : l.status === 'error'
                    ? { label: t('admin.bbError'), cls: 'bg-rose-50 text-rose-700 border-rose-100' }
                    : l.status === 'returned'
                    ? { label: t('admin.bbReturned'), cls: 'bg-rose-50 text-rose-700 border-rose-100' }
                    : { label: l.status, cls: 'bg-slate-50 text-slate-600 border-slate-200' };
                return (
                  <div
                    key={l.id}
                    className="px-4 py-2.5 border-b border-slate-50 last:border-0 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge className={cn('text-[9px] font-bold border', statusMeta.cls)}>
                          {statusMeta.label}
                        </Badge>
                        <span className="text-[10px] text-slate-400 font-mono">{l.updateDate}</span>
                      </div>
                      <p className="text-xs font-bold text-slate-800 truncate mt-1">
                        {l.itemName}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {l.managementNumber}
                        {l.buyerName ? ` / ${l.buyerName} ${t('admin.toCustomerSan')}` : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-black text-slate-800 tabular-nums">
                        ¥{l.price.toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
          <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-2 flex justify-between items-center">
            <p className="text-[10px] text-slate-400">{t('admin.lastActivities')}</p>
            <button
              onClick={() => (window.location.hash = 'banana-bay')}
              className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-0.5"
            >
              {t('admin.viewAll')} <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">{t('admin.categoryInventoryStatus')}</CardTitle>
            <CardDescription>{t('admin.categoryDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dynamicInventoryData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  width={80}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="stock" fill="#cbd5e1" radius={[0, 4, 4, 0]} barSize={12} />
                <Bar dataKey="listed" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">{t('admin.workersStatus')}</CardTitle>
              <CardDescription>{t('admin.workersStatusDesc')}</CardDescription>
            </div>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] uppercase tracking-wider font-bold">
              {workerStats.filter((w) => w.status === 'working').length} ACTIVE
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {workerStats.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-300 gap-2">
                  <Users className="w-8 h-8 opacity-40" />
                  <p className="text-[10px] font-black uppercase tracking-widest">No workers in scope</p>
                </div>
              ) : (
                workerStats.map((w) => {
                  const statusLabel =
                    w.status === 'working' ? t('admin.statusWorking')
                    : w.status === 'idle' ? t('admin.statusIdle')
                    : t('admin.statusOff');
                  const badgeClass =
                    w.status === 'working' ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                    : w.status === 'idle' ? 'bg-amber-100 text-amber-700 border-amber-200'
                    : 'bg-slate-100 text-slate-500 border-slate-200';
                  const roleLabel = w.role === 'collector' ? t('role.collector') : t('role.worker');
                  return (
                    <div key={w.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {w.avatar ? (
                            <img src={w.avatar} alt={w.name} className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600">
                              {w.name.charAt(0)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate">{w.name}</p>
                            <p className="text-[10px] text-slate-500 truncate">
                              {roleLabel} · {w.base ?? '-'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <Badge className={cn('mb-1 text-[10px] font-bold', badgeClass)}>
                            {statusLabel}
                          </Badge>
                          <p className="text-[10px] text-slate-400 flex items-center justify-end gap-1">
                            <Clock className="w-3 h-3" />
                            {w.currentTime ?? '-'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                        <span className="truncate">
                          {w.currentTaskName ? `${t('admin.currentTask')}: ${w.currentTaskName}` : `${t('admin.currentTask')}: ${t('admin.noCurrentTask')}`}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-400 font-bold uppercase tracking-wide">{t('admin.progressPercent')} {w.progressRate}%</span>
                          <span className="text-slate-500 font-bold">
                            {w.completed}/{w.total} {t('admin.completedRatio')}
                          </span>
                        </div>
                        <Progress value={w.progressRate} className="h-1.5" />
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-1">
                        <div className="bg-white rounded-lg border border-slate-100 px-2 py-1.5 text-center">
                          <p className="text-[9px] text-slate-400 font-bold uppercase">{t('admin.notStarted')}</p>
                          <p className="text-sm font-black text-slate-700 tabular-nums">{w.pending}</p>
                        </div>
                        <div className="bg-blue-50 rounded-lg border border-blue-100 px-2 py-1.5 text-center">
                          <p className="text-[9px] text-blue-500 font-bold uppercase">{t('admin.inProgress')}</p>
                          <p className="text-sm font-black text-blue-700 tabular-nums">{w.inProgress}</p>
                        </div>
                        <div className="bg-emerald-50 rounded-lg border border-emerald-100 px-2 py-1.5 text-center">
                          <p className="text-[9px] text-emerald-600 font-bold uppercase">{t('admin.todayDone')}</p>
                          <p className="text-sm font-black text-emerald-700 tabular-nums">{w.completedToday}</p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* メッセージ・業務連絡（旧 作業スケジュール画面から移設） */}
      <Card className="border-slate-200 shadow-sm bg-white overflow-hidden" id="dashboard-messaging">
        <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              {t('admin.messages')}
            </CardTitle>
            <CardDescription className="text-[11px]">
              {t('admin.messageBroadcastDesc')}
            </CardDescription>
          </div>
          <Badge className="bg-blue-50 text-blue-600 border border-blue-100 text-[10px] font-bold">
            {countMessages(activeChannel)}件
          </Badge>
        </CardHeader>
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr]">
          {/* 左ペイン: チャネル一覧 */}
          <div className="border-r border-slate-100 max-h-[440px] overflow-y-auto bg-slate-50/40">
            <button
              onClick={() => setActiveChannel('all')}
              className={cn(
                'w-full text-left px-4 py-3 border-b border-slate-100 flex items-center gap-3 transition-colors',
                activeChannel === 'all' ? 'bg-white shadow-sm' : 'hover:bg-white/60',
              )}
            >
              <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-800 truncate">{t('admin.broadcast')}</p>
                <p className="text-[10px] text-slate-400 truncate">
                  {(() => {
                    const last = getLastMessage('all');
                    return last ? `${last.fromName}: ${last.body}` : t('admin.noMessages');
                  })()}
                </p>
              </div>
              <Badge className="bg-slate-200 text-slate-600 border-none text-[9px] font-bold">
                {countMessages('all')}
              </Badge>
            </button>
            {MOCK_USERS.filter((u) => u.role !== 'admin')
              .filter((u) => !selectedBase || u.base === selectedBase)
              .map((u) => {
                const cnt = countMessages(u.id);
                const last = getLastMessage(u.id);
                const active = activeChannel === u.id;
                return (
                  <button
                    key={u.id}
                    onClick={() => setActiveChannel(u.id)}
                    className={cn(
                      'w-full text-left px-4 py-3 border-b border-slate-100 flex items-center gap-3 transition-colors',
                      active ? 'bg-white shadow-sm' : 'hover:bg-white/60',
                    )}
                  >
                    {u.avatar ? (
                      <img src={u.avatar} alt={u.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold shrink-0">
                        {u.name.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800 truncate">{u.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {last ? `${last.fromName}: ${last.body}` : (u.role === 'collector' ? t('role.collector') : t('role.worker'))}
                      </p>
                    </div>
                    {cnt > 0 && (
                      <Badge className="bg-blue-100 text-blue-700 border-none text-[9px] font-bold shrink-0">
                        {cnt}
                      </Badge>
                    )}
                  </button>
                );
              })}
          </div>

          {/* 右ペイン: スレッド + 入力欄 */}
          <div className="flex flex-col">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-2 min-w-0">
                {activeChannel === 'all' ? (
                  <>
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800">{t('admin.broadcast')}</p>
                      <p className="text-[10px] text-slate-400">{t('admin.broadcastHint')}</p>
                    </div>
                  </>
                ) : (
                  (() => {
                    const u = MOCK_USERS.find((x) => x.id === activeChannel);
                    const role = u?.role === 'collector' ? t('role.collector') : t('role.worker');
                    return (
                      <>
                        {u?.avatar ? (
                          <img src={u.avatar} alt={u.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold shrink-0">
                            {u?.name.charAt(0) ?? '?'}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">{u?.name ?? '-'}</p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {role}{u?.base ? ` ・ ${u.base}` : ''}
                          </p>
                        </div>
                      </>
                    );
                  })()
                )}
              </div>
              <Badge className="bg-slate-100 text-slate-600 border-none text-[9px] font-bold shrink-0">
                {activeChannel === 'all' ? t('message.broadcast') : 'DM'}
              </Badge>
            </div>

            <div className="p-4 max-h-[320px] min-h-[200px] overflow-y-auto space-y-3 bg-slate-50/30">
              {(() => {
                const thread = getThread(activeChannel);
                if (thread.length === 0) {
                  return (
                    <div className="py-8 flex flex-col items-center justify-center text-slate-300 gap-2">
                      <MessageSquare className="w-8 h-8 opacity-40" />
                      <p className="text-[10px] font-black uppercase tracking-widest">No Messages</p>
                    </div>
                  );
                }
                return thread.map((m) => {
                  const mine = m.fromUserId === adminId;
                  return (
                    <div
                      key={m.id}
                      className={cn(
                        'flex flex-col gap-1 max-w-[80%]',
                        mine ? 'ml-auto items-end' : 'items-start',
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold text-slate-500">{m.fromName}</span>
                        <span className="text-[9px] text-slate-400">
                          {new Date(m.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div
                        className={cn(
                          'p-3 rounded-2xl text-xs whitespace-pre-wrap break-words',
                          mine
                            ? 'bg-blue-600 text-white rounded-tr-none'
                            : 'bg-white border border-slate-100 text-slate-800 rounded-tl-none',
                        )}
                      >
                        {m.body}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            <div className="border-t border-slate-100 p-4 bg-white flex gap-2">
              <Input
                placeholder={
                  activeChannel === 'all'
                    ? '全体ブロードキャストにメッセージ...'
                    : `${MOCK_USERS.find((u) => u.id === activeChannel)?.name ?? ''} にメッセージ...`
                }
                value={messageDraft}
                onChange={(e) => setMessageDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                className="h-10 text-xs bg-slate-50 border-slate-200"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!messageDraft.trim()}
                className="bg-blue-600 hover:bg-blue-700 h-10 px-4 gap-1 text-xs font-bold"
              >
                <Send className="w-3.5 h-3.5" /> 送信
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </TabsContent>

    <TabsContent value="comparison" className="mt-0 space-y-6">
      {/* クロス拠点 KPI サマリー */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">
          全拠点クロスサマリー
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-[#e2e8f0] shadow-sm rounded-xl">
            <CardContent className="p-3">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1 truncate">拠点数</p>
                  <h3 className="text-lg font-black tabular-nums">
                    {MOCK_BRANCHES.length}
                    <span className="text-[10px] font-medium text-slate-400 ml-1">拠点</span>
                  </h3>
                  <p className="text-[9px] text-slate-400 mt-0.5">関西エリア展開</p>
                </div>
                <div className="p-2 bg-blue-50 rounded-lg text-blue-600 shrink-0">
                  <Package className="w-4 h-4" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#e2e8f0] shadow-sm rounded-xl">
            <CardContent className="p-3">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1 truncate">総在庫数</p>
                  <h3 className="text-lg font-black tabular-nums">
                    {totalInventoryAcrossBases}
                    <span className="text-[10px] font-medium text-slate-400 ml-1">件</span>
                  </h3>
                  <p className="text-[9px] text-slate-400 mt-0.5">3 拠点合算</p>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg text-slate-600 shrink-0">
                  <Package className="w-4 h-4" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#e2e8f0] shadow-sm rounded-xl">
            <CardContent className="p-3">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1 truncate">BB 累計売上</p>
                  <h3 className="text-lg font-black tabular-nums text-amber-700">
                    ¥{totalSoldRevenueAcrossBases.toLocaleString()}
                  </h3>
                  <p className="text-[9px] text-slate-400 mt-0.5">
                    最高: {topBaseByRevenue?.name ?? '-'}
                  </p>
                </div>
                <div className="p-2 bg-amber-50 rounded-lg text-amber-600 shrink-0">
                  <Banknote className="w-4 h-4" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#e2e8f0] shadow-sm rounded-xl">
            <CardContent className="p-3">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1 truncate">総従業員数</p>
                  <h3 className="text-lg font-black tabular-nums">
                    {totalWorkersAcrossBases}
                    <span className="text-[10px] font-medium text-slate-400 ml-1">名</span>
                  </h3>
                  <p className="text-[9px] text-slate-400 mt-0.5">
                    稼働中 {baseDetailedKpi.reduce((s, b) => s + b.workingNow, 0)} 名
                  </p>
                </div>
                <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600 shrink-0">
                  <Users className="w-4 h-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 地図 + 拠点カード */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-[#e2e8f0] shadow-none rounded-lg overflow-hidden">
          <CardHeader className="border-b border-[#e2e8f0] py-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-600" />
                拠点マップ
              </CardTitle>
              <CardDescription className="text-[11px]">
                拠点をクリックすると基本情報・実績を確認できます
              </CardDescription>
            </div>
            <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 text-[10px] uppercase tracking-wider font-bold">
              {validCoords.length} 拠点
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[420px] w-full">
              <MapContainer
                center={mapCenter}
                zoom={9}
                scrollWheelZoom
                className="h-full w-full"
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution="© OpenStreetMap"
                />
                {baseDetailedKpi
                  .filter((b) => b.coords)
                  .map((b) => (
                    <Marker
                      key={b.id}
                      position={[b.coords!.lat, b.coords!.lng]}
                      icon={createBranchIcon(b.name, b.color)}
                    >
                      <Popup>
                        <div className="text-xs space-y-1.5 min-w-[220px]">
                          <div className="font-bold text-sm" style={{ color: b.color }}>
                            {b.name}
                          </div>
                          <div className="text-slate-500 text-[11px]">{b.address}</div>
                          <div className="text-slate-500 text-[11px]">TEL: {b.phone}</div>
                          <div className="grid grid-cols-2 gap-1.5 mt-2 pt-2 border-t border-slate-100">
                            <div className="bg-slate-50 rounded px-2 py-1">
                              <div className="text-[9px] text-slate-400 font-bold uppercase">在庫</div>
                              <div className="text-xs font-black text-slate-800">{b.inventoryCount}件</div>
                            </div>
                            <div className="bg-blue-50 rounded px-2 py-1">
                              <div className="text-[9px] text-blue-500 font-bold uppercase">出品中</div>
                              <div className="text-xs font-black text-blue-700">{b.listedCount}点</div>
                            </div>
                            <div className="bg-emerald-50 rounded px-2 py-1">
                              <div className="text-[9px] text-emerald-600 font-bold uppercase">売却</div>
                              <div className="text-xs font-black text-emerald-700">{b.soldCount}点</div>
                            </div>
                            <div className="bg-amber-50 rounded px-2 py-1">
                              <div className="text-[9px] text-amber-600 font-bold uppercase">売上</div>
                              <div className="text-xs font-black text-amber-700">¥{b.soldRevenue.toLocaleString()}</div>
                            </div>
                          </div>
                          <div className="text-[10px] text-slate-500 pt-1">
                            従業員 {b.workerCount} 名 / 稼働中 {b.workingNow}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
              </MapContainer>
            </div>
          </CardContent>
        </Card>

        {/* 拠点カードリスト（ランキング） */}
        <Card className="border-[#e2e8f0] shadow-none rounded-lg overflow-hidden">
          <CardHeader className="border-b border-[#e2e8f0] py-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              拠点別パフォーマンス
            </CardTitle>
            <CardDescription className="text-[11px]">
              BANANA BAY 売上順
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 space-y-2">
            {[...baseDetailedKpi]
              .sort((a, b) => b.soldRevenue - a.soldRevenue)
              .map((b, idx) => {
                const maxRev = Math.max(...baseDetailedKpi.map((x) => x.soldRevenue), 1);
                const pct = Math.round((b.soldRevenue / maxRev) * 100);
                return (
                  <div
                    key={b.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0"
                          style={{ background: b.color }}
                        >
                          {idx + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{b.name}</p>
                          <p className="text-[10px] text-slate-500 truncate">
                            効率 {b.efficiency}% / モチベ {b.motivation}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-black text-amber-700 tabular-nums">
                          ¥{b.soldRevenue.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-slate-400">{b.soldCount} 件成約</p>
                      </div>
                    </div>
                    <div className="h-1.5 bg-white rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: b.color }}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 pt-1">
                      <div className="bg-white rounded-md border border-slate-100 px-1.5 py-1 text-center">
                        <p className="text-[8px] text-slate-400 font-bold uppercase">在庫</p>
                        <p className="text-[11px] font-black text-slate-700 tabular-nums">{b.inventoryCount}</p>
                      </div>
                      <div className="bg-blue-50 rounded-md border border-blue-100 px-1.5 py-1 text-center">
                        <p className="text-[8px] text-blue-500 font-bold uppercase">出品</p>
                        <p className="text-[11px] font-black text-blue-700 tabular-nums">{b.listedCount}</p>
                      </div>
                      <div className="bg-rose-50 rounded-md border border-rose-100 px-1.5 py-1 text-center">
                        <p className="text-[8px] text-rose-500 font-bold uppercase">要対応</p>
                        <p className="text-[11px] font-black text-rose-700 tabular-nums">{b.errorCount}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
          </CardContent>
        </Card>
      </div>

      {/* 拠点別 BANANA BAY 売上比較 + 効率比較 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-[#e2e8f0] shadow-none rounded-lg">
          <CardHeader className="border-b border-[#e2e8f0] py-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-amber-600" />
              拠点別 BANANA BAY 実績
            </CardTitle>
            <CardDescription className="text-[11px]">
              出品中／売却済の点数を拠点別に比較
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={baseDetailedKpi} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }}
                />
                <Bar dataKey="listedCount" name="出品中" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={24} />
                <Bar dataKey="soldCount" name="売却" fill="#10b981" radius={[4, 4, 0, 0]} barSize={24} />
                <Bar dataKey="errorCount" name="要対応" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
          <div className="px-4 pb-3 flex items-center gap-4 text-[10px] font-bold text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" /> 出品中</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> 売却</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500" /> 要対応</span>
          </div>
        </Card>

        <Card className="border-[#e2e8f0] shadow-none rounded-lg">
          <CardHeader className="border-b border-[#e2e8f0] py-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              拠点別 効率＆モチベーション
            </CardTitle>
            <CardDescription className="text-[11px]">
              作業効率(%) と チームモチベーション(5点満点) の相関
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={baseDetailedKpi} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis yAxisId="left" orientation="left" stroke="#3b82f6" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} domain={[0, 5]} />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }}
                />
                <Bar yAxisId="left" dataKey="efficiency" name="効率%" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar yAxisId="right" dataKey="motivation" name="モチベ" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
          <div className="px-4 pb-3 flex items-center gap-4 text-[10px] font-bold text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" /> 効率(%)</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> モチベーション</span>
          </div>
        </Card>
      </div>

      {/* 拠点詳細KPI一覧 */}
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold">拠点詳細KPI一覧</CardTitle>
          <CardDescription className="text-[11px]">
            在庫・BANANA BAY・人員までを統合した拠点別ダッシュボード
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="text-[10px] font-bold uppercase pl-6">拠点名</TableHead>
                <TableHead className="text-[10px] font-bold uppercase text-right">在庫</TableHead>
                <TableHead className="text-[10px] font-bold uppercase text-right">出品中</TableHead>
                <TableHead className="text-[10px] font-bold uppercase text-right">売却</TableHead>
                <TableHead className="text-[10px] font-bold uppercase text-right">売上 (BB)</TableHead>
                <TableHead className="text-[10px] font-bold uppercase text-right">要対応</TableHead>
                <TableHead className="text-[10px] font-bold uppercase text-right">従業員</TableHead>
                <TableHead className="text-[10px] font-bold uppercase text-right">効率</TableHead>
                <TableHead className="text-[10px] font-bold uppercase text-right">モチベ</TableHead>
                <TableHead className="text-[10px] font-bold uppercase pr-6">状態</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {baseDetailedKpi.map((b) => (
                <TableRow key={b.id} className="hover:bg-slate-50 transition-colors">
                  <TableCell className="pl-6 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: b.color }} />
                      <span className="font-bold text-sm text-slate-800">{b.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-sm font-mono">{b.inventoryCount}</TableCell>
                  <TableCell className="text-right text-sm font-mono text-blue-700">{b.listedCount}</TableCell>
                  <TableCell className="text-right text-sm font-mono text-emerald-700">{b.soldCount}</TableCell>
                  <TableCell className="text-right text-sm font-mono font-bold text-amber-700">
                    ¥{b.soldRevenue.toLocaleString()}
                  </TableCell>
                  <TableCell className={cn("text-right text-sm font-mono", b.errorCount > 0 ? 'text-rose-600 font-bold' : 'text-slate-400')}>
                    {b.errorCount}
                  </TableCell>
                  <TableCell className="text-right text-sm font-mono">
                    {b.workerCount}
                    <span className="text-[10px] text-slate-400 ml-1">({b.workingNow}稼働)</span>
                  </TableCell>
                  <TableCell className="text-right text-sm font-mono">{b.efficiency}%</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                      <span className="text-sm">{b.motivation}</span>
                    </div>
                  </TableCell>
                  <TableCell className="pr-6 py-3">
                    <Badge className={cn(
                      'text-[10px] font-bold border',
                      b.errorCount > 0
                        ? 'bg-rose-50 text-rose-700 border-rose-100'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-100',
                    )}>
                      {b.errorCount > 0 ? '要対応' : '正常稼働'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </TabsContent>
  </Tabs>
  <ReceiptPreview 
    receipt={selectedReceipt} 
    open={isPreviewOpen} 
    onOpenChange={setIsPreviewOpen} 
  />
</div>
  );
}

function ReceiptPreview({ receipt, open, onOpenChange }: { receipt: any, open: boolean, onOpenChange: (open: boolean) => void }) {
  if (!receipt) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[95vw] md:max-w-3xl lg:max-w-4xl max-h-[92vh] overflow-y-auto bg-slate-50 p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            受領書詳細確認
          </DialogTitle>
          <DialogDescription>
            現場で発行された受領書の副本です。
          </DialogDescription>
        </DialogHeader>

        <div className="bg-white p-8 sm:p-10 shadow-sm border border-slate-200 w-full max-w-3xl mx-auto font-sans mt-4">
           {/* Header */}
           <div className="flex justify-between items-start gap-4 mb-6">
             <div>
               <div className="w-10 h-10 bg-blue-600 rounded flex items-center justify-center mb-4">
                 <Package className="text-white w-6 h-6" />
               </div>
               <h2 className="text-2xl font-bold tracking-widest text-slate-900 border-none">受領書</h2>
             </div>
             <div className="text-right text-[10px] space-y-0.5 text-slate-500">
               <p>No: {receipt.id.toUpperCase()}</p>
               <p>日付: {new Date(receipt.issuedAt).toLocaleDateString('ja-JP')}</p>
             </div>
           </div>

           {/* Customer Info */}
           <div className="flex justify-between items-end border-b-2 border-black pb-2 mb-6">
             <div className="space-y-1">
               <p className="text-base font-bold underline underline-offset-4 decoration-1 text-slate-900">
                 {receipt.customerName} 様
               </p>
             </div>
             <div className="text-right text-[9px] space-y-0.5 text-slate-600">
               <p className="font-bold">株式会社サスティナブルガレージ {MOCK_BRANCHES[0]?.name ?? ''}</p>
               <p>{MOCK_BRANCHES[0]?.address ?? ''}</p>
               <p>TEL: {MOCK_BRANCHES[0]?.phone ?? ''}</p>
              {MOCK_BRANCHES[0]?.email && <p>Email: {MOCK_BRANCHES[0].email}</p>}
             </div>
           </div>

           {/* 受領書には金額を載せない (買取金額は分別作業で確定後、買取明細書に記載) */}

           {/* Items Table (paper-style format) */}
           <div className="border overflow-hidden rounded-sm mb-6">
             <table className="w-full border-collapse">
               <thead>
                 <tr className="bg-slate-50 border-b">
                   <th className="text-[10px] h-8 border-r px-2 text-left">商品名</th>
                   <th className="text-[10px] h-8 border-r px-2 text-right w-12">数量</th>
                   <th className="text-[10px] h-8 border-r px-2 text-right w-14">重量Kg</th>
                   <th className="text-[10px] h-8 border-r px-2 text-left w-24">車体番号</th>
                   <th className="text-[10px] h-8 border-r px-2 text-left w-20">部品番号</th>
                   <th className="text-[10px] h-8 border-r px-2 text-left w-20">車種</th>
                   <th className="text-[10px] h-8 border-r px-2 text-left w-16">型番</th>
                   <th className="text-[10px] h-8 px-2 text-left">備考</th>
                 </tr>
               </thead>
               <tbody>
                 {Array.isArray(receipt.items) && receipt.items.length > 0 ? (
                   <>
                     {receipt.items.map((item: any, idx: number) => (
                       <tr key={idx} className="border-b">
                         <td className="text-[10px] py-2 border-r px-2 font-bold">{item.name || '-'}</td>
                         <td className="text-[10px] py-2 border-r px-2 text-right w-12">{item.quantity ?? '-'}</td>
                         <td className="text-[10px] py-2 border-r px-2 text-right w-14">{item.weight ? item.weight.toLocaleString() : '-'}</td>
                         <td className="text-[10px] py-2 border-r px-2 font-mono w-24 truncate">{item.vinNumber || '-'}</td>
                         <td className="text-[10px] py-2 border-r px-2 font-mono w-20 truncate">{item.partNumber || '-'}</td>
                         <td className="text-[10px] py-2 border-r px-2 w-20 truncate">{item.carName || item.carModel || '-'}</td>
                         <td className="text-[10px] py-2 border-r px-2 font-mono w-16 truncate">{item.carModelNumber || '-'}</td>
                         <td className="text-[10px] py-2 px-2 truncate max-w-[120px]">{item.notes || '-'}</td>
                       </tr>
                     ))}
                     {Array.from({ length: Math.max(0, 4 - receipt.items.length) }).map((_, i) => (
                       <tr key={`empty-${i}`} className="h-8 border-b">
                         <td className="border-r h-8"></td>
                         <td className="border-r h-8"></td>
                         <td className="border-r h-8"></td>
                         <td className="border-r h-8"></td>
                         <td className="border-r h-8"></td>
                         <td className="border-r h-8"></td>
                         <td className="border-r h-8"></td>
                         <td className="h-8"></td>
                       </tr>
                     ))}
                   </>
                 ) : (
                   <>
                     <tr className="border-b">
                       <td className="text-[10px] py-2 border-r px-2 font-bold">回収品目一式</td>
                       <td className="text-[10px] py-2 border-r px-2 text-right w-12">-</td>
                       <td className="text-[10px] py-2 border-r px-2 text-right w-14">-</td>
                       <td className="text-[10px] py-2 border-r px-2 w-24">-</td>
                       <td className="text-[10px] py-2 border-r px-2 w-20">-</td>
                       <td className="text-[10px] py-2 border-r px-2 w-20">-</td>
                       <td className="text-[10px] py-2 border-r px-2 w-16">-</td>
                       <td className="text-[10px] py-2 px-2">現場回収担当: {receipt.collectorName}</td>
                     </tr>
                     {[1,2,3].map(i => (
                       <tr key={i} className="h-8 border-b">
                         <td className="border-r h-8"></td>
                         <td className="border-r h-8"></td>
                         <td className="border-r h-8"></td>
                         <td className="border-r h-8"></td>
                         <td className="border-r h-8"></td>
                         <td className="border-r h-8"></td>
                         <td className="border-r h-8"></td>
                         <td className="h-8"></td>
                       </tr>
                     ))}
                   </>
                 )}
               </tbody>
             </table>
           </div>

           {/* Signature Section */}
           <div className="grid grid-cols-2 gap-8 items-start mb-6">
              <div className="space-y-2">
                 <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">Customer Signature</p>
                 <div className="h-10 border-b border-slate-300 flex items-center justify-center font-serif italic text-base text-slate-800">
                    電子署名あり
                 </div>
              </div>
              <div className="pt-2 flex justify-end">
                 <div className="w-12 h-12 border border-red-200 rounded-full flex items-center justify-center text-[7px] text-red-300 border-dashed transform rotate-12">
                    (角印)
                 </div>
              </div>
           </div>

           {/* Footer */}
           <div className="text-[8px] text-slate-400 space-y-1">
              <p>※本受領書は現場にてデジタル発行されたものです。</p>
           </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
