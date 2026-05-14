import React, { useState, useMemo } from 'react';
import { 
  ShoppingBag, 
  Search, 
  Filter, 
  ExternalLink, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  MoreVertical,
  X,
  RefreshCcw,
  Truck,
  Undo2,
  Package,
  TrendingUp,
  Ban,
  Check,
  ChevronDown,
  Info,
  Settings2,
  Printer
} from 'lucide-react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup
} from '@/components/ui/dropdown-menu';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Truck as TruckIcon, ExternalLink as ExternalLinkIcon, PackageCheck, Package as PackageIcon } from 'lucide-react';
import type { ShippingCarrier, DeliveryStatus } from '@/src/types';
import { useInventory } from '@/src/stores/inventoryStore';
import {
  useBananaListings,
  updateBananaListing,
  markListingAsSold,
  simulateBananaBayApiSync,
} from '@/src/stores/bananaListingsStore';
import { BananaBayListing, BananaBayStatus } from '@/src/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { BANANA_BAY_STATUS_LABELS } from '@/src/constants';
import { useT } from '@/src/stores/i18nStore';

const PERFORMANCE_DATA = [
  { date: '04/14', listings: 12, sales: 5 },
  { date: '04/15', listings: 18, sales: 8 },
  { date: '04/16', listings: 15, sales: 12 },
  { date: '04/17', listings: 25, sales: 10 },
  { date: '04/18', listings: 20, sales: 15 },
  { date: '04/19', listings: 32, sales: 18 },
  { date: '04/20', listings: 28, sales: 22 },
];

export function BananaBayManagement({ selectedBase }: { selectedBase?: string }) {
  const t = useT();
  const inventory = useInventory();
  const listings = useBananaListings();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showChart, setShowChart] = useState(true);
  
  // Item Detail & Return Process State
  const [selectedListing, setSelectedListing] = useState<BananaBayListing | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isRegisterReturnModalOpen, setIsRegisterReturnModalOpen] = useState(false);
  const [returnStep, setReturnStep] = useState(1);
  const [returnNotes, setReturnNotes] = useState('');
  const [returnReason, setReturnReason] = useState('defect');
  const [trackingNumber, setTrackingNumber] = useState('');

  const filteredListings = useMemo(() => {
    return listings.filter(item => {
      const inventoryItem = inventory.find(inv => inv.id === item.inventoryId);
      const matchesBase = !selectedBase || inventoryItem?.baseName === selectedBase;
      const matchesSearch = 
        item.listingId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.managementNumber.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      
      return matchesBase && matchesSearch && matchesStatus;
    });
  }, [listings, searchTerm, statusFilter, selectedBase]);

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredListings.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredListings.map(l => l.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const batchAction = (action: string) => {
    toast.success(`${selectedIds.length} ${t('bb.batchSuccess')}「${action}」`);
    setSelectedIds([]);
  };

  const getStatusBadge = (status: BananaBayStatus) => {
    switch (status) {
      case 'listed':
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">{t('bb.statusListed')}</Badge>;
      case 'listing':
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200">{t('bb.statusListing')}</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-700 border-red-200">{t('bb.statusError')}</Badge>;
      case 'sold':
        return <Badge className="bg-slate-100 text-slate-700 border-slate-200">{t('bb.statusSold')}</Badge>;
      case 'shipping':
        return <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">{t('bb.statusShipping')}</Badge>;
      case 'returned':
        return (
          <div className="flex flex-col gap-1">
            <Badge className="bg-rose-100 text-rose-700 border-rose-200 w-fit">{t('bb.statusReturned')}</Badge>
            <span className="text-[9px] text-rose-400 font-bold px-1 flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" /> {t('bb.daysAgo2')}
            </span>
          </div>
        );
      default:
        return <Badge variant="outline">{t('bb.statusNotListed')}</Badge>;
    }
  };

  const handleSync = () => {
    toast.promise(
      // 1.2 秒の擬似ネットワーク遅延 → API レスポンス想定で落札取込みを実行
      new Promise<{ count: number; sample?: string }>((resolve) => {
        setTimeout(() => {
          const result = simulateBananaBayApiSync(2);
          resolve({
            count: result.count,
            sample: result.newSales[0]?.itemName,
          });
        }, 1200);
      }),
      {
        loading: 'BANANA BAY APIと同期中...（落札情報を取得しています）',
        success: ({ count, sample }) =>
          count === 0
            ? '同期完了：新規の落札はありませんでした'
            : `${count} 件の落札を取り込みました${sample ? `（例: ${sample}）` : ''}。発送先情報と出荷タスクを自動生成しました。`,
        error: t('bb.syncFailed'),
      },
    );
  };

  const handleAction = (id: string, action: string) => {
    toast.success(`${action} ${t('bb.actionDone')} (${id})`);
  };

  return (
    <div className="space-y-6">
      {/* Mini Dashboard / Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-none shadow-sm h-[200px] overflow-hidden">
          <CardHeader className="py-3 px-5 border-b flex flex-row items-center justify-between bg-white">
            <div>
              <CardTitle className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                {t('bb.salesTrend')}
              </CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowChart(!showChart)} className="h-7 text-[10px]">
              {showChart ? t('bb.hideChart') : t('bb.showChart')}
            </Button>
          </CardHeader>
          <CardContent className={cn("p-0 transition-all", showChart ? "h-[150px]" : "h-0")}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={PERFORMANCE_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '11px' }}
                />
                <Area type="monotone" dataKey="listings" stroke="#94a3b8" strokeWidth={2} fill="transparent" />
                <Area type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3 h-[200px] auto-rows-fr">
          <Card className="border-none shadow-sm py-0 overflow-hidden">
            <div className="h-full p-3 flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-xl text-blue-600 shrink-0">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">{t('bb.kpiListed')}</p>
                <h3 className="text-2xl font-black text-slate-800 leading-tight">
                  {filteredListings.filter(l => l.status === 'listed').length}
                </h3>
              </div>
            </div>
          </Card>
          <Card className="border-none shadow-sm py-0 overflow-hidden">
            <div className="h-full p-3 flex items-center gap-3">
              <div className="p-2 bg-red-50 rounded-xl text-red-600 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">{t('bb.kpiError')}</p>
                <h3 className="text-2xl font-black text-red-600 leading-tight">
                  {filteredListings.filter(l => l.status === 'error').length}
                </h3>
              </div>
            </div>
          </Card>
          <Card className="border-none shadow-sm py-0 overflow-hidden">
            <div className="h-full p-3 flex items-center gap-3">
              <div className="p-2 bg-rose-50 rounded-xl text-rose-600 shrink-0">
                <Undo2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">{t('bb.kpiReturn')}</p>
                <h3 className="text-2xl font-black text-slate-800 leading-tight">
                  {filteredListings.filter(l => l.status === 'returned').length}
                </h3>
              </div>
            </div>
          </Card>
          <Card className="border-none shadow-sm py-0 overflow-hidden">
            <div className="h-full p-3 flex items-center gap-3">
              <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600 shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">{t('bb.kpiTotalRevenue')}</p>
                <h3 className="text-lg font-black text-slate-800 leading-tight tabular-nums">
                  ¥{(filteredListings.filter(l => l.status === 'sold').reduce((acc, curr) => acc + (curr.price || 0), 0) / 1000).toFixed(0)}K
                </h3>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* メインタブ：出品管理 / 出荷管理 */}
      <Tabs defaultValue="listings" className="w-full">
        <TabsList className="bg-white border border-slate-200 rounded-xl p-1 h-11 shadow-sm">
          <TabsTrigger value="listings" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 rounded-lg px-5 text-sm font-bold gap-2">
            <PackageIcon className="w-4 h-4" /> {t('bb.tabListings')}
          </TabsTrigger>
          <TabsTrigger value="shipping" className="data-[state=active]:bg-amber-50 data-[state=active]:text-amber-700 rounded-lg px-5 text-sm font-bold gap-2">
            <TruckIcon className="w-4 h-4" /> {t('bb.tabShipping')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="listings" className="mt-4 space-y-6">
      {/* Filters & Actions Bar */}
      <div className="flex flex-col gap-4 bg-white p-5 rounded-xl border shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-col gap-3 w-full md:w-[500px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder={t('bb.searchPlaceholder')}
                className="pl-10 bg-slate-50 border-slate-200 h-10 text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {['all', 'listed', 'error', 'returned', 'sold'].map((s) => (
                <Button
                  key={s}
                  variant={statusFilter === s ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter(s)}
                  className="h-8 px-4 text-[11px] rounded-full shrink-0 border-slate-200"
                >
                  {s === 'all' ? t('common.all') : s === 'listed' ? t('bb.statusListed') : s === 'error' ? t('bb.statusError') : s === 'returned' ? t('bb.statusReturned') : t('bb.statusSold')}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            {selectedIds.length > 0 ? (
              <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 animate-in fade-in slide-in-from-right-2">
                <span className="text-xs font-bold text-blue-700">{selectedIds.length} {t('admin.cases')}</span>
                <div className="w-px h-4 bg-blue-200 mx-1" />
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button size="sm" className="bg-blue-600 h-7 text-[10px] gap-1 px-2">
                        {t('bb.batchAction')} <ChevronDown className="w-3 h-3" />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => batchAction(t('bb.bulkSync'))}>
                      <RefreshCcw className="w-3 h-3 mr-2" /> {t('bb.bulkSync')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => batchAction(t('bb.stopListing'))}>
                      <Ban className="w-3 h-3 mr-2" /> {t('bb.stopListing')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setSelectedIds([])} className="text-red-600">
                      <X className="w-3 h-3 mr-2" /> {t('bb.unselect')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="outline" className="gap-2 h-10 px-4 border-slate-200 text-sm font-bold" onClick={handleSync}>
                  <RefreshCcw className="w-4 h-4" /> {t('bb.apiSync')}
                </Button>
                <Button className="bg-orange-600 hover:bg-orange-700 text-white gap-2 h-10 px-6 font-bold shadow-lg shadow-orange-100 text-sm">
                  <ShoppingBag className="w-4 h-4" /> {t('bb.newBulkListing')}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Listings Table */}
      <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow>
              <TableHead className="w-[50px] text-center">
                <div 
                  className={cn(
                    "w-4 h-4 mx-auto rounded border cursor-pointer flex items-center justify-center transition-colors",
                    selectedIds.length === filteredListings.length && filteredListings.length > 0
                      ? "bg-blue-600 border-blue-600" 
                      : "bg-white border-slate-300"
                  )}
                  onClick={toggleSelectAll}
                >
                  <Check className={cn("w-3 h-3 text-white", selectedIds.length === filteredListings.length ? "block" : "hidden")} />
                </div>
              </TableHead>
              <TableHead className="w-[180px] font-bold text-slate-500 text-[11px] uppercase tracking-wider">{t('bb.colId')}</TableHead>
              <TableHead className="font-bold text-slate-500 text-[11px] uppercase tracking-wider">{t('bb.colItem')}</TableHead>
              <TableHead className="font-bold text-slate-500 text-[11px] uppercase tracking-wider">{t('bb.colStatus')}</TableHead>
              <TableHead className="font-bold text-slate-500 text-[11px] uppercase tracking-wider text-right">{t('bb.colPrice')}</TableHead>
              <TableHead className="font-bold text-slate-500 text-[11px] uppercase tracking-wider">{t('bb.colUpdated')}</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredListings.length > 0 ? filteredListings.map((listing) => {
              const invItem = inventory.find(i => i.id === listing.inventoryId);
              return (
                <TableRow 
                  key={listing.id} 
                  className={cn("hover:bg-slate-50 transition-colors cursor-pointer", selectedIds.includes(listing.id) && "bg-blue-50/30")}
                  onClick={() => {
                    setSelectedListing(listing);
                    setIsDetailModalOpen(true);
                  }}
                >
                  <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                    <div 
                      className={cn(
                        "w-4 h-4 mx-auto rounded border cursor-pointer flex items-center justify-center transition-colors",
                        selectedIds.includes(listing.id) ? "bg-blue-600 border-blue-600" : "bg-white border-slate-300 hover:border-blue-400"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(listing.id);
                      }}
                    >
                      <Check className={cn("w-3 h-3 text-white", selectedIds.includes(listing.id) ? "block" : "hidden")} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono text-[11px] font-black text-blue-600 leading-none">{listing.listingId || `BL-${listing.id.split("-").pop()}`}</span>
                      <span className="font-mono text-[10px] text-slate-400">{listing.managementNumber}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200 overflow-hidden">
                        {invItem?.images && invItem.images.length > 0 ? (
                          <img 
                            src={invItem.images[0]} 
                            alt="" 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <ImageIcon className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-sm text-slate-900 truncate">{listing.itemName}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 rounded uppercase font-bold tracking-tight">
                            {invItem?.category || listing.category}
                          </span>
                          <span className="text-[10px] text-slate-400 flex items-center gap-0.5 border-l pl-2">
                            <Clock className="w-3 h-3" />
                            {listing.listingDate}
                          </span>
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(listing.status)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col">
                      <span className="font-black text-slate-800 text-sm">¥{(listing.price || 0).toLocaleString()}</span>
                      <span className="text-[9px] text-[#10b981] font-bold uppercase tracking-wider">FREE SHIPPING</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-600 font-medium">{listing.lastSyncAt || listing.updateDate}</span>
                      <span className="text-[9px] text-slate-400 flex items-center gap-1 group">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" /> API Validated
                      </span>
                    </div>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-200/50 rounded-full">
                            <MoreVertical className="w-4 h-4 text-slate-500" />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuGroup>
                          <DropdownMenuLabel className="text-[10px] text-slate-400 font-bold uppercase py-2">{t('bb.colActions')}</DropdownMenuLabel>
                          <DropdownMenuItem className="gap-3 py-2.5" onClick={() => {
                            setSelectedListing(listing);
                            setIsDetailModalOpen(true);
                          }}>
                            <div className="p-1.5 bg-slate-100 text-slate-600 rounded">
                              <Info className="w-3.5 h-3.5" />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-xs">商品詳細</span>
                              <span className="text-[9px] text-slate-400">登録内容を確認</span>
                            </div>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-3 py-2.5" onClick={() => window.open('#', '_blank')}>
                            <div className="p-1.5 bg-blue-50 text-blue-600 rounded">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-xs">サイトで見る</span>
                              <span className="text-[9px] text-slate-400">外部ブラウザで開く</span>
                            </div>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-3 py-2.5" onClick={() => handleSync()}>
                            <div className="p-1.5 bg-slate-50 text-slate-600 rounded">
                              <RefreshCcw className="w-3.5 h-3.5" />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-xs">個別同期</span>
                              <span className="text-[9px] text-slate-400">最新情報を取得</span>
                            </div>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {listing.status === 'listed' && (
                            <>
                              <DropdownMenuItem
                                className="gap-3 py-2.5 text-emerald-600"
                                onClick={() => {
                                  // API レスポンスと同じ形式で発送先情報を生成
                                  const fakeBuyers = [
                                    { name: '山本 浩司',   address: '東京都港区赤坂9-7-1',           phone: '03-3479-2400' },
                                    { name: '中村 美咲',   address: '神奈川県川崎市中原区小杉町1-403', phone: '044-722-1156' },
                                    { name: '小林 達也',   address: '埼玉県さいたま市大宮区桜木町1-7-5',phone: '048-642-3300' },
                                  ];
                                  const buyer = fakeBuyers[Math.floor(Math.random() * fakeBuyers.length)];
                                  const eta = new Date();
                                  eta.setDate(eta.getDate() + 3);
                                  markListingAsSold(listing.id, {
                                    buyerName: buyer.name,
                                    recipientName: buyer.name,
                                    shippingAddress: buyer.address,
                                    recipientPhone: buyer.phone,
                                    orderId: `BB-ORD-${Date.now().toString().slice(-7)}`,
                                    estimatedDeliveryDate: eta.toISOString().slice(0, 10),
                                  });
                                  toast.success(`${listing.itemName} の落札処理を完了しました`, {
                                    description: `${buyer.name} 様の発送先情報と出荷業務タスクを自動生成しました（${buyer.address.split('（')[0].slice(0, 18)}…）`,
                                  });
                                }}
                              >
                                <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-bold text-xs text-emerald-600">落札処理</span>
                                  <span className="text-[9px] text-emerald-400">発送先取込み + 出荷タスク自動生成</span>
                                </div>
                              </DropdownMenuItem>
                              <DropdownMenuItem className="gap-3 py-2.5 text-red-600" onClick={() => handleAction(listing.id, '出品停止')}>
                                <div className="p-1.5 bg-red-50 text-red-600 rounded">
                                  <Ban className="w-3.5 h-3.5" />
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-bold text-xs text-red-600">出品停止</span>
                                  <span className="text-[9px] text-red-400">サイト上から非表示</span>
                                </div>
                              </DropdownMenuItem>
                            </>
                          )}
                          {listing.status === 'error' && (
                            <DropdownMenuItem className="gap-3 py-2.5 text-blue-600" onClick={() => handleAction(listing.id, 'エラー修正')}>
                              <div className="p-1.5 bg-blue-50 text-blue-600 rounded">
                                <AlertCircle className="w-3.5 h-3.5" />
                              </div>
                              <div className="flex flex-col">
                                <span className="font-bold text-xs">修正して再出品</span>
                                <span className="text-[9px] text-blue-400">エラーをクリア</span>
                              </div>
                            </DropdownMenuItem>
                          )}
                          {listing.status === 'sold' && (
                            <>
                              <DropdownMenuItem className="gap-3 py-2.5 text-indigo-600" onClick={() => handleAction(listing.id, '発送準備')}>
                                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded">
                                  <Truck className="w-3.5 h-3.5" />
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-bold text-xs">発送通知</span>
                                  <span className="text-[9px] text-indigo-400">追跡番号を登録</span>
                                </div>
                              </DropdownMenuItem>
                              <DropdownMenuItem className="gap-3 py-2.5 text-rose-600" onClick={() => {
                                setSelectedListing(listing);
                                setIsRegisterReturnModalOpen(true);
                              }}>
                                <div className="p-1.5 bg-rose-50 text-rose-600 rounded">
                                  <Undo2 className="w-3.5 h-3.5" />
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-bold text-xs">返品を受け付ける</span>
                                  <span className="text-[9px] text-rose-400">返品リクエストを登録</span>
                                </div>
                              </DropdownMenuItem>
                            </>
                          )}
                          {listing.status === 'returned' && (
                            <DropdownMenuItem className="gap-3 py-2.5 text-rose-600 font-bold" onClick={() => {
                              setSelectedListing(listing);
                              setReturnStep(1);
                              setIsReturnModalOpen(true);
                            }}>
                              <div className="p-1.5 bg-rose-50 text-rose-600 rounded">
                                <Undo2 className="w-3.5 h-3.5" />
                              </div>
                              <div className="flex flex-col">
                                <span className="font-bold text-xs">返品処理を進める</span>
                                <span className="text-[9px] text-rose-400">返品確定・在庫戻し</span>
                              </div>
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            }) : (
              <TableRow>
                <TableCell colSpan={7} className="h-64 text-center">
                  <div className="flex flex-col items-center justify-center text-slate-400 gap-4">
                    <div className="p-4 bg-slate-50 rounded-full">
                      <Search className="w-8 h-8 opacity-20" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-bold">{t('bb.noResults')}</p>
                      <p className="text-xs">{t('bb.changeFilters')}</p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
        </TabsContent>

        {/* ===== 出荷管理タブ ===== */}
        <TabsContent value="shipping" className="mt-4 space-y-6">
          <ShippingManagementPanel
            listings={listings}
            inventory={inventory}
            selectedBase={selectedBase}
            onUpdate={(id, patch) => updateBananaListing(id, patch)}
          />
        </TabsContent>
      </Tabs>

      {/* API Status & Health */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Card className="flex-1 border-none shadow-sm bg-blue-600 text-white p-6 relative overflow-hidden">
          <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="text-sm font-bold opacity-80 mb-1">API接続ステータス</h4>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,1)]" />
                  <span className="text-xl font-black">STABLE</span>
                </div>
              </div>
              <RefreshCcw className="w-6 h-6 opacity-20" />
            </div>
            <p className="text-[11px] font-medium opacity-60 leading-relaxed">
              BANANA BAY ERP-Link v2.4 経由で接続中。<br />
              最終データ整合性チェック: 5分前
            </p>
          </div>
          <ShoppingBag className="absolute -bottom-6 -right-6 w-32 h-32 opacity-10 rotate-12" />
        </Card>

        <Card className="flex-1 border-none shadow-sm flex flex-col p-6 gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
              <Info className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-800">重要なお知らせ</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                4/21 02:00より、BANANA BAY側のシステムメンテナンスが予定されています。
                この期間、新規出品の反映に最大2時間の遅延が発生する可能性があります。
              </p>
            </div>
          </div>
          <Button variant="outline" className="w-full text-xs font-bold h-9">詳細を確認</Button>
        </Card>
      </div>
      {/* Item Detail Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-600" />
              出品商品詳細
            </DialogTitle>
          </DialogHeader>
          
          {selectedListing && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Images */}
                <div className="space-y-3">
                  <div className="aspect-square bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
                    {inventory.find(i => i.id === selectedListing.inventoryId)?.images?.[0] ? (
                      <img
                        src={inventory.find(i => i.id === selectedListing.inventoryId)!.images![0]}
                        alt=""
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag className="w-12 h-12 text-slate-300" />
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {inventory.find(i => i.id === selectedListing.inventoryId)?.images?.slice(1).map((img, idx) => (
                      <div key={idx} className="aspect-square rounded border overflow-hidden">
                        <img src={img} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-black text-slate-900">{selectedListing.itemName}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-100">{selectedListing.category}</Badge>
                      <span className="text-xs text-slate-400 font-mono">{selectedListing.managementNumber}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">出品ID</p>
                      <p className="text-sm font-mono font-bold text-blue-600">{selectedListing.listingId || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">現在のステータス</p>
                      {getStatusBadge(selectedListing.status)}
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">販売価格</p>
                      <p className="text-lg font-black text-slate-900">¥{(selectedListing.price || 0).toLocaleString()}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">最終更新</p>
                      <p className="text-sm text-slate-600">{selectedListing.updateDate}</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase">BANANA BAY 出品設定</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs py-1 border-b border-dashed">
                        <span className="text-slate-500">配送料負担</span>
                        <span className="font-medium">出品者負担</span>
                      </div>
                      <div className="flex justify-between text-xs py-1 border-b border-dashed">
                        <span className="text-slate-500">発送までの日数</span>
                        <span className="font-medium">1〜2日で発送</span>
                      </div>
                      <div className="flex justify-between text-xs py-1 border-b border-dashed">
                        <span className="text-slate-500">API連携状況</span>
                        <span className="font-medium text-emerald-600">正常</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailModalOpen(false)}>閉じる</Button>
            {selectedListing?.status === 'error' && (
              <Button className="bg-blue-600" onClick={() => {
                handleAction(selectedListing.id, 'エラー修正');
                setIsDetailModalOpen(false);
              }}>エラーを修正して再出品</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Registration Modal */}
      <Dialog open={isRegisterReturnModalOpen} onOpenChange={setIsRegisterReturnModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-600" />
              返品受付の登録
            </DialogTitle>
            <DialogDescription>
              売却済み商品の返品対応を開始します。内容を入力してください。
            </DialogDescription>
          </DialogHeader>

          {selectedListing && (
            <div className="py-4 space-y-4">
              <div className="bg-slate-50 p-3 rounded border border-slate-200 flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-white border flex items-center justify-center shrink-0">
                  <ShoppingBag className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">{selectedListing.itemName}</p>
                  <p className="text-[10px] text-slate-500">{selectedListing.listingId}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-slate-500 uppercase">返品理由</Label>
                  <Select value={returnReason} onValueChange={setReturnReason}>
                    <SelectTrigger className="text-xs h-9">
                      <SelectValue placeholder="理由を選択してください" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="defect">商品不具合・破損</SelectItem>
                      <SelectItem value="wrong_item">注文と異なる商品</SelectItem>
                      <SelectItem value="not_as_described">記載内容と実物の相違</SelectItem>
                      <SelectItem value="customer_mind">お客様都合</SelectItem>
                      <SelectItem value="other">その他</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-slate-500 uppercase">対応メモ</Label>
                  <Textarea 
                    placeholder="状況、お客様とのやり取りなどを入力..." 
                    className="text-xs min-h-[80px]"
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRegisterReturnModalOpen(false)}>キャンセル</Button>
            <Button className="bg-rose-600" onClick={() => {
              handleAction(selectedListing?.id || '', '返品受付済み');
              setIsRegisterReturnModalOpen(false);
              toast.success('返品リクエストを登録しました');
            }}>
              返品受付を確定する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Processing Modal */}
      <Dialog open={isReturnModalOpen} onOpenChange={setIsReturnModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Undo2 className="w-5 h-5 text-rose-600" />
              返品処理フロー
            </DialogTitle>
            <DialogDescription>
              返品商品の状況を確認し、在庫への戻し処理を行います。
            </DialogDescription>
          </DialogHeader>

          {selectedListing && (
            <div className="py-4 space-y-6">
              {/* Stepper */}
              <div className="flex items-center justify-between px-2 relative">
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 -z-10 -translate-y-1/2"></div>
                {[1, 2, 3].map((step) => (
                  <div key={step} className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300",
                    returnStep >= step ? "bg-rose-600 text-white shadow-lg" : "bg-white border-2 border-slate-200 text-slate-400"
                  )}>
                    {returnStep > step ? <Check className="w-4 h-4" /> : step}
                  </div>
                ))}
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                {returnStep === 1 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-black text-sm text-slate-800">Step 1: 返品理由の確認</h4>
                      <Badge className="bg-rose-100 text-rose-700 border-none text-[10px]">受付完了</Badge>
                    </div>
                    <div className="p-3 bg-white border border-slate-100 rounded-lg text-[11px] text-slate-600 space-y-1.5 shadow-sm">
                      <p className="flex justify-between">
                        <span className="font-bold text-slate-400">理由タイプ:</span>
                        <span className="font-bold text-rose-600">
                          {returnReason === 'defect' ? '商品不具合・破損' : 
                           returnReason === 'wrong_item' ? '注文と異なる商品' : 
                           returnReason === 'not_as_described' ? '記載内容と実物の相違' : 'その他'}
                        </span>
                      </p>
                      <Separator className="my-1 opacity-50" />
                      <p className="font-medium">
                        {returnNotes || '特記事項なし'}
                      </p>
                    </div>
                    <div className="space-y-2 pt-2">
                      <Label className="text-[10px] font-bold text-slate-400 uppercase">返送情報の登録 (任意)</Label>
                      <div className="flex gap-2">
                        <Input 
                          placeholder="返送時の追跡番号" 
                          className="h-9 text-xs" 
                          value={trackingNumber}
                          onChange={(e) => setTrackingNumber(e.target.value)}
                        />
                        <Button variant="outline" size="sm" className="h-9 text-[10px] font-bold">保存</Button>
                      </div>
                      <Button variant="ghost" className="w-full text-[10px] h-8 text-blue-600 gap-2 border border-blue-100 bg-blue-50/30">
                        <Printer className="w-3.5 h-3.5" /> 返品用着払い伝票を印字
                      </Button>
                    </div>
                  </div>
                )}

                {returnStep === 2 && (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <h4 className="font-black text-sm text-slate-800">Step 2: 商品受取・検品</h4>
                      <div className="flex items-center gap-1 text-blue-600 font-bold text-[10px]">
                        <Clock className="w-3.5 h-3.5 animate-spin-slow" /> 入荷待ち
                      </div>
                    </div>
                    <div className="text-center py-4 bg-white border border-slate-100 rounded-lg shadow-sm space-y-3">
                      <Package className="w-12 h-12 text-blue-600 mx-auto opacity-20" />
                      <div className="px-6 space-y-1">
                        <p className="text-xs font-bold text-slate-800">商品到着後に検品を行ってください</p>
                        <p className="text-[10px] text-slate-500 leading-relaxed">
                          重大な損傷がない場合は「再販可能」として在庫に戻すことができます。
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-blue-50/50 rounded-lg">
                      <CheckCircle2 className="w-4 h-4 text-blue-600" />
                      <span className="text-[10px] font-bold text-blue-700">検品ステータスを「完了」に設定</span>
                    </div>
                  </div>
                )}

                {returnStep === 3 && (
                  <div className="space-y-5 text-center">
                    <h4 className="font-black text-sm text-slate-800">Step 3: 処理の完結</h4>
                    <div className="py-6 bg-emerald-50 border border-emerald-100 rounded-xl space-y-4">
                      <div className="relative w-16 h-16 mx-auto">
                        <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-20" />
                        <div className="relative z-10 w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center text-white">
                          <Check className="w-8 h-8" />
                        </div>
                      </div>
                      <div className="space-y-1 px-6 text-center">
                        <p className="text-sm font-bold text-emerald-900">在庫復帰の準備が整いました</p>
                        <p className="text-[10px] text-emerald-700/70 leading-relaxed">
                          BANANA BAYの出品は自動的に「取引キャンセル」として処理され、元の在庫番号で販売可能になります。
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 p-3 bg-white border border-slate-200 rounded-lg text-left">
                      <p className="text-[10px] font-black text-slate-400 uppercase underline decoration-emerald-500 underline-offset-4">最終チェックリスト</p>
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-600 pl-1 py-1">
                        <Check className="w-3.5 h-3.5 text-emerald-500" /> 返金ステータス確認済み
                      </div>
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-600 pl-1 py-1">
                        <Check className="w-3.5 h-3.5 text-emerald-500" /> 在庫位置の再確認済み
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReturnModalOpen(false)}>閉じる</Button>
            {returnStep < 3 ? (
              <Button className="bg-rose-600 font-bold" onClick={() => setReturnStep(prev => prev + 1)}>
                次へ進む
              </Button>
            ) : (
              <Button className="bg-emerald-600 font-bold shadow-lg shadow-emerald-200" onClick={() => {
                handleAction(selectedListing?.id || '', '返品完結・在庫戻し');
                setIsReturnModalOpen(false);
                setReturnStep(1);
                toast.success('在庫戻し処理が完了しました');
              }}>
                在庫戻しを確定して完結
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ----------------------------------------------------------------------
 * 出荷管理パネル
 * - sold / returned 商品の配送業者・追跡番号・配達ステータスを管理
 * - 配送業者ごとの追跡サイトへ直接ジャンプできる
 * - 編集ダイアログから配送情報を更新／発送登録／配達完了を記録
 * --------------------------------------------------------------------*/
const CARRIER_LABELS: Record<ShippingCarrier, string> = {
  yamato: 'ヤマト運輸',
  sagawa: '佐川急便',
  jp_post: '日本郵便',
  other: 'その他',
};

const buildTrackingUrl = (carrier: ShippingCarrier | undefined, tn: string): string | undefined => {
  if (!carrier || !tn) return undefined;
  if (carrier === 'yamato') return `https://toi.kuronekoyamato.co.jp/cgi-bin/tneko?init=1&number00=1&number01=${encodeURIComponent(tn)}`;
  if (carrier === 'sagawa') return `https://k2k.sagawa-exp.co.jp/p/sagawa/web/okurijoinput.jsp?okurijoNo=${encodeURIComponent(tn)}`;
  if (carrier === 'jp_post') return `https://trackings.post.japanpost.jp/services/srv/search/direct?reqCodeNo1=${encodeURIComponent(tn)}&searchKind=S004`;
  return undefined;
};

const DELIVERY_STATUS_META: Record<DeliveryStatus, { label: string; cls: string }> = {
  preparing: { label: '発送準備中', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  shipped: { label: '発送済', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  in_transit: { label: '配送中', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  delivered: { label: '配達完了', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  undeliverable: { label: '配達不可', cls: 'bg-rose-100 text-rose-700 border-rose-200' },
};

function ShippingManagementPanel({
  listings,
  inventory,
  selectedBase,
  onUpdate,
}: {
  listings: BananaBayListing[];
  inventory: ReturnType<typeof useInventory>;
  selectedBase?: string;
  onUpdate: (id: string, patch: Partial<BananaBayListing>) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<'all' | DeliveryStatus>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<BananaBayListing | null>(null);
  const [draft, setDraft] = useState<Partial<BananaBayListing>>({});

  // 出荷対象 = sold / returned のみ
  const shippingItems = listings.filter((l) => {
    if (l.status !== 'sold' && l.status !== 'returned') return false;
    if (selectedBase) {
      const inv = inventory.find((i) => i.id === l.inventoryId);
      if (inv?.baseName !== selectedBase) return false;
    }
    return true;
  });

  const filtered = shippingItems.filter((l) => {
    if (statusFilter !== 'all' && l.deliveryStatus !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.itemName.toLowerCase().includes(q) ||
      (l.recipientName || '').toLowerCase().includes(q) ||
      (l.trackingNumber || '').toLowerCase().includes(q) ||
      (l.orderId || '').toLowerCase().includes(q)
    );
  });

  const counts = {
    all: shippingItems.length,
    preparing: shippingItems.filter((l) => l.deliveryStatus === 'preparing').length,
    shipped: shippingItems.filter((l) => l.deliveryStatus === 'shipped').length,
    in_transit: shippingItems.filter((l) => l.deliveryStatus === 'in_transit').length,
    delivered: shippingItems.filter((l) => l.deliveryStatus === 'delivered').length,
    undeliverable: shippingItems.filter((l) => l.deliveryStatus === 'undeliverable').length,
  };

  const openEdit = (l: BananaBayListing) => {
    setEditing(l);
    setDraft({ ...l });
  };
  const saveEdit = () => {
    if (!editing) return;
    onUpdate(editing.id, {
      shippingCarrier: draft.shippingCarrier,
      trackingNumber: draft.trackingNumber,
      shippedDate: draft.shippedDate,
      estimatedDeliveryDate: draft.estimatedDeliveryDate,
      deliveredDate: draft.deliveredDate,
      shippingAddress: draft.shippingAddress,
      recipientName: draft.recipientName,
      recipientPhone: draft.recipientPhone,
      deliveryStatus: draft.deliveryStatus,
      shippingNotes: draft.shippingNotes,
    });
    toast.success('出荷情報を更新しました');
    setEditing(null);
  };
  const markShipped = (l: BananaBayListing) => {
    const today = new Date().toISOString().slice(0, 10);
    onUpdate(l.id, {
      deliveryStatus: 'shipped',
      shippedDate: l.shippedDate || today,
      shippingNoticeSent: true,
    });
    toast.success(`${l.itemName} を発送登録しました`);
  };
  const markDelivered = (l: BananaBayListing) => {
    const today = new Date().toISOString().slice(0, 10);
    onUpdate(l.id, {
      deliveryStatus: 'delivered',
      deliveredDate: today,
    });
    toast.success(`${l.itemName} を配達完了として記録しました`);
  };

  return (
    <div className="space-y-4">
      {/* KPI 行 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {([
          { key: 'all', label: '全件', icon: PackageIcon, color: 'slate', value: counts.all },
          { key: 'preparing', label: '発送準備', icon: PackageIcon, color: 'slate', value: counts.preparing },
          { key: 'shipped', label: '発送済', icon: TruckIcon, color: 'blue', value: counts.shipped },
          { key: 'in_transit', label: '配送中', icon: TruckIcon, color: 'amber', value: counts.in_transit },
          { key: 'delivered', label: '配達完了', icon: PackageCheck, color: 'emerald', value: counts.delivered },
        ] as const).map((card) => (
          <button
            key={card.key}
            onClick={() => setStatusFilter(card.key as 'all' | DeliveryStatus)}
            className={cn(
              'p-3 rounded-xl border bg-white transition-all text-left',
              statusFilter === card.key
                ? 'ring-2 ring-amber-400 border-amber-200 shadow-md'
                : 'border-slate-200 hover:border-slate-300',
            )}
          >
            <div className="flex items-center gap-2">
              <div className={cn(
                'p-1.5 rounded-lg shrink-0',
                card.color === 'slate' && 'bg-slate-50 text-slate-600',
                card.color === 'blue' && 'bg-blue-50 text-blue-600',
                card.color === 'amber' && 'bg-amber-50 text-amber-600',
                card.color === 'emerald' && 'bg-emerald-50 text-emerald-600',
              )}>
                <card.icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase truncate">{card.label}</p>
                <h3 className="text-lg font-black text-slate-800 tabular-nums leading-tight">
                  {card.value}
                </h3>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* 検索バー */}
      <div className="flex flex-col md:flex-row gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="商品名・受取人・追跡番号・注文IDで検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 text-sm bg-slate-50 border-slate-200"
          />
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
            {filtered.length} 件
          </Badge>
        </div>
      </div>

      {/* 出荷一覧テーブル */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="text-[10px] font-bold uppercase pl-6 w-[280px]">商品 / 注文ID</TableHead>
              <TableHead className="text-[10px] font-bold uppercase w-[180px]">受取人</TableHead>
              <TableHead className="text-[10px] font-bold uppercase w-[140px]">配送業者</TableHead>
              <TableHead className="text-[10px] font-bold uppercase">追跡番号</TableHead>
              <TableHead className="text-[10px] font-bold uppercase w-[110px]">発送日</TableHead>
              <TableHead className="text-[10px] font-bold uppercase w-[120px] text-center">配達状況</TableHead>
              <TableHead className="w-[180px] pr-6 text-right text-[10px] font-bold uppercase">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-xs text-slate-400">
                  {shippingItems.length === 0
                    ? '出荷対象の商品はまだありません'
                    : '該当する出荷案件は見つかりませんでした'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((l) => {
                const ds = l.deliveryStatus ?? 'preparing';
                const meta = DELIVERY_STATUS_META[ds];
                const trackUrl = buildTrackingUrl(l.shippingCarrier, l.trackingNumber || '');
                return (
                  <TableRow key={l.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="pl-6 py-3 align-top">
                      <p className="font-bold text-sm text-slate-800 truncate max-w-[260px]">{l.itemName}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {l.orderId ?? l.managementNumber}
                      </p>
                    </TableCell>
                    <TableCell className="py-3 align-top text-xs">
                      <p className="font-bold text-slate-700">
                        {l.recipientName || l.buyerName || <span className="text-slate-300">未設定</span>}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate max-w-[180px] mt-0.5">
                        {l.shippingAddress || ''}
                      </p>
                    </TableCell>
                    <TableCell className="py-3 align-top">
                      {l.shippingCarrier ? (
                        <Badge className="bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-bold">
                          {CARRIER_LABELS[l.shippingCarrier]}
                        </Badge>
                      ) : (
                        <span className="text-[10px] text-slate-300">未設定</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3 align-top text-xs">
                      {l.trackingNumber ? (
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-slate-700 truncate max-w-[160px]">{l.trackingNumber}</span>
                          {trackUrl && (
                            <a
                              href={trackUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5 text-blue-600 hover:text-blue-800 text-[10px] font-bold"
                              title={`${CARRIER_LABELS[l.shippingCarrier!]} で追跡`}
                            >
                              追跡 <ExternalLinkIcon className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300 text-[10px]">未登録</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3 align-top text-xs font-mono text-slate-600">
                      {l.shippedDate ?? '-'}
                    </TableCell>
                    <TableCell className="py-3 align-top text-center">
                      <Badge className={cn('text-[10px] font-bold border', meta.cls)}>
                        {meta.label}
                      </Badge>
                      {l.deliveredDate && (
                        <p className="text-[9px] text-slate-400 font-mono mt-0.5">{l.deliveredDate}</p>
                      )}
                    </TableCell>
                    <TableCell className="pr-6 py-3 align-top text-right">
                      <div className="flex justify-end gap-1.5">
                        {ds === 'preparing' && (
                          <Button
                            size="sm"
                            onClick={() => markShipped(l)}
                            className="h-7 px-2 text-[10px] gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            <TruckIcon className="w-3 h-3" /> 発送登録
                          </Button>
                        )}
                        {(ds === 'shipped' || ds === 'in_transit') && (
                          <Button
                            size="sm"
                            onClick={() => markDelivered(l)}
                            className="h-7 px-2 text-[10px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            <PackageCheck className="w-3 h-3" /> 配達完了
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEdit(l)}
                          className="h-7 px-2 text-[10px] gap-1 border-slate-200 text-slate-600"
                        >
                          編集
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* 出荷情報 編集ダイアログ */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TruckIcon className="w-4 h-4 text-amber-600" />
              出荷情報を編集
            </DialogTitle>
            <DialogDescription className="text-xs">
              {editing?.itemName} ／ 注文ID: {editing?.orderId || editing?.managementNumber}
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-2">
              <div>
                <Label className="text-[11px] font-bold">配送業者</Label>
                <Select
                  value={draft.shippingCarrier ?? ''}
                  onValueChange={(v) => setDraft({ ...draft, shippingCarrier: v as ShippingCarrier })}
                >
                  <SelectTrigger className="mt-1 h-9 text-sm">
                    <SelectValue placeholder="選択..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(['yamato', 'sagawa', 'jp_post', 'other'] as ShippingCarrier[]).map((c) => (
                      <SelectItem key={c} value={c} className="text-sm">
                        {CARRIER_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] font-bold">追跡番号</Label>
                <Input
                  value={draft.trackingNumber || ''}
                  onChange={(e) => setDraft({ ...draft, trackingNumber: e.target.value })}
                  placeholder="例: 1234-5670-1000"
                  className="mt-1 h-9 text-sm font-mono"
                />
              </div>
              <div>
                <Label className="text-[11px] font-bold">発送日</Label>
                <Input
                  type="date"
                  value={draft.shippedDate || ''}
                  onChange={(e) => setDraft({ ...draft, shippedDate: e.target.value })}
                  className="mt-1 h-9 text-sm"
                />
              </div>
              <div>
                <Label className="text-[11px] font-bold">配達予定日</Label>
                <Input
                  type="date"
                  value={draft.estimatedDeliveryDate || ''}
                  onChange={(e) => setDraft({ ...draft, estimatedDeliveryDate: e.target.value })}
                  className="mt-1 h-9 text-sm"
                />
              </div>
              <div>
                <Label className="text-[11px] font-bold">配達完了日</Label>
                <Input
                  type="date"
                  value={draft.deliveredDate || ''}
                  onChange={(e) => setDraft({ ...draft, deliveredDate: e.target.value })}
                  className="mt-1 h-9 text-sm"
                />
              </div>
              <div>
                <Label className="text-[11px] font-bold">配達ステータス</Label>
                <Select
                  value={draft.deliveryStatus ?? 'preparing'}
                  onValueChange={(v) => setDraft({ ...draft, deliveryStatus: v as DeliveryStatus })}
                >
                  <SelectTrigger className="mt-1 h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(['preparing', 'shipped', 'in_transit', 'delivered', 'undeliverable'] as DeliveryStatus[]).map((s) => (
                      <SelectItem key={s} value={s} className="text-sm">
                        {DELIVERY_STATUS_META[s].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label className="text-[11px] font-bold">受取人氏名</Label>
                <Input
                  value={draft.recipientName || ''}
                  onChange={(e) => setDraft({ ...draft, recipientName: e.target.value })}
                  className="mt-1 h-9 text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <Label className="text-[11px] font-bold">配送先住所</Label>
                <Input
                  value={draft.shippingAddress || ''}
                  onChange={(e) => setDraft({ ...draft, shippingAddress: e.target.value })}
                  className="mt-1 h-9 text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <Label className="text-[11px] font-bold">配送先電話番号</Label>
                <Input
                  value={draft.recipientPhone || ''}
                  onChange={(e) => setDraft({ ...draft, recipientPhone: e.target.value })}
                  className="mt-1 h-9 text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <Label className="text-[11px] font-bold">配送メモ・特記事項</Label>
                <Textarea
                  value={draft.shippingNotes || ''}
                  onChange={(e) => setDraft({ ...draft, shippingNotes: e.target.value })}
                  className="mt-1 text-sm min-h-[64px]"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} className="h-9 text-xs">
              キャンセル
            </Button>
            <Button
              onClick={saveEdit}
              className="h-9 text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1"
            >
              <TruckIcon className="w-3.5 h-3.5" /> 保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const ImageIcon = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
    <circle cx="9" cy="9" r="2"/>
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
  </svg>
);
