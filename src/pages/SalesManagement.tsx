import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  FileText, 
  Download, 
  ChevronRight,
  Building2,
  Calendar,
  CreditCard,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  PieChart as PieChartIcon,
  ShoppingBag,
  ExternalLink
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  MOCK_QUOTES,
  MOCK_ORDERS,
  MOCK_INVOICES,
  MOCK_SALES,
  MOCK_MONTHLY_REPORTS,
} from '../mockData';
import { useInventory, resolvePurchaseAmount, resolveTotalCost } from '@/src/stores/inventoryStore';
import { useCollections } from '@/src/stores/collectionsStore';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  Legend
} from 'recharts';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { useT } from '@/src/stores/i18nStore';

interface SalesManagementProps {
  selectedBase?: string;
}

export function SalesManagement({ selectedBase }: SalesManagementProps) {
  const t = useT();
  const [activeTab, setActiveTab] = useState('quotes');
  const [isRecordingSale, setIsRecordingSale] = useState(false);
  const [selectedInventoryId, setSelectedInventoryId] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [salePlatform, setSalePlatform] = useState<"banana_bay" | "other">("banana_bay");
  const [itemSearchQuery, setItemSearchQuery] = useState("");
  const [itemCategoryFilter, setItemCategoryFilter] = useState<'all' | 'recycle' | 'reuse' | 'rebuilt'>('all');

  // Live inventory + collections (買取金額が分別作業で確定した時点で原価に反映)
  const inventory = useInventory();
  const collections = useCollections();

  const filteredInventoryItems = useMemo(() => {
    return inventory.filter(item => {
      if (item.status === 'sold') return false;
      
      const matchesBase = !selectedBase || item.baseName === selectedBase;
      if (!matchesBase) return false;

      const matchesSearch = 
        item.name.toLowerCase().includes(itemSearchQuery.toLowerCase()) || 
        item.managementNumber.toLowerCase().includes(itemSearchQuery.toLowerCase()) ||
        item.partNumber?.toLowerCase().includes(itemSearchQuery.toLowerCase());
        
      const matchesCategory = 
        itemCategoryFilter === 'all' || 
        item.sortingCategory === itemCategoryFilter;
        
      return matchesSearch && matchesCategory;
    });
  }, [inventory, itemSearchQuery, itemCategoryFilter]);

  const selectedItem = useMemo(() =>
    inventory.find(i => i.id === selectedInventoryId),
    [inventory, selectedInventoryId]
  );

  // 原価1 (買取金額) は分別作業で確定した finalPrice をリアルタイム参照
  const calculateCost = (item: any) => resolveTotalCost(item, collections);
  const calculatePurchase = (item: any) => resolvePurchaseAmount(item, collections);

  const handleRecordSale = () => {
    if (!selectedItem || !salePrice) return;
    
    toast.success("売上を記録しました", {
      description: `${selectedItem.name} を ¥${Number(salePrice).toLocaleString()} で販売登録しました。`,
    });
    setIsRecordingSale(false);
    setSelectedInventoryId("");
    setSalePrice("");
  };

  const salesByMonth = MOCK_MONTHLY_REPORTS;

  const exportMonthlyReport = (data?: any[]) => {
    const reportData = data || salesByMonth;
    const worksheet = XLSX.utils.json_to_sheet(reportData.map(r => ({
      '対象期間': r.month,
      '売上高合計': r.totalRevenue,
      '推定原価合計': r.totalCost,
      '売上総利益': r.totalProfit,
      '利益率': `${Math.round((r.totalProfit / r.totalRevenue) * 100)}%`,
      '販売点数': r.itemsSoldCount
    })));
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "月次決算報告");
    XLSX.writeFile(workbook, `Monthly_Sales_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Excelファイルを出力しました");
  };

  const [isMarginReportOpen, setIsMarginReportOpen] = useState(false);
  
  const filteredSales = useMemo(() =>
    MOCK_SALES.filter(sale => !selectedBase || inventory.find(i => i.id === sale.inventoryId)?.baseName === selectedBase),
    [inventory, selectedBase]
  );

  const categoryAnalysis = useMemo(() => {
    const analysis: Record<string, { revenue: number, profit: number, count: number }> = {};

    filteredSales.forEach(sale => {
      const invItem = inventory.find(i => i.id === sale.inventoryId);
      const category = invItem?.partCategory || 'その他';
      
      if (!analysis[category]) {
        analysis[category] = { revenue: 0, profit: 0, count: 0 };
      }
      
      analysis[category].revenue += sale.salePrice;
      analysis[category].profit += sale.grossProfit;
      analysis[category].count += 1;
    });
    
    return Object.entries(analysis)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales]);

  const highMarginItems = useMemo(() => {
    return [...filteredSales]
      .map(sale => {
        // Mock platform fee calculation (10% if Banana Bay)
        const platformFee = sale.salePlatform === 'banana_bay' ? sale.salePrice * 0.1 : 0;
        const adjustedProfit = sale.grossProfit - platformFee;
        return {
          ...sale,
          platformFee,
          adjustedProfit,
          marginPercent: (adjustedProfit / sale.salePrice) * 100
        };
      })
      .sort((a, b) => b.marginPercent - a.marginPercent);
  }, [filteredSales]);

  const channelAnalysis = useMemo(() => {
    const channels: Record<string, { revenue: number, count: number }> = {
      'banana_bay': { revenue: 0, count: 0 },
      'other': { revenue: 0, count: 0 }
    };
    
    filteredSales.forEach(sale => {
      if (channels[sale.salePlatform]) {
        channels[sale.salePlatform].revenue += sale.salePrice;
        channels[sale.salePlatform].count += 1;
      }
    });

    return [
      { name: 'BANANA BAY', ...channels.banana_bay, color: '#3b82f6' },
      { name: 'その他', ...channels.other, color: '#94a3b8' }
    ];
  }, [filteredSales]);
  
  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('sales.title')}</h1>
          <p className="text-slate-500 text-sm">{t('sales.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => exportMonthlyReport()}>
            <Download className="w-4 h-4" /> {t('att.export')}
          </Button>
          <Dialog open={isRecordingSale} onOpenChange={setIsRecordingSale}>
            <DialogTrigger
              render={
                <Button className="bg-blue-600 hover:bg-blue-700 gap-2">
                  <ShoppingBag className="w-4 h-4" /> 売上を記録
                </Button>
              }
            />
            <DialogContent className="max-w-2xl bg-white max-h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>販売履歴の登録</DialogTitle>
                <CardDescription>在庫商品から販売品を選択し、実績を登録します。</CardDescription>
              </DialogHeader>
              
              <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-1">
                <div className="flex flex-col gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input 
                        placeholder="管理番号・品名・部品番号で検索..." 
                        value={itemSearchQuery}
                        onChange={(e) => setItemSearchQuery(e.target.value)}
                        className="pl-9 h-10 bg-white border-slate-200" 
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase mr-1">在庫分類:</span>
                    <div className="flex gap-1">
                      {[
                        { id: 'all', label: '全部' },
                        { id: 'recycle', label: '資源' },
                        { id: 'reuse', label: 'リユース' },
                        { id: 'rebuilt', label: 'リビルド' }
                      ].map((cat) => (
                        <Button
                          key={cat.id}
                          variant={itemCategoryFilter === cat.id ? "default" : "outline"}
                          size="sm"
                          onClick={() => setItemCategoryFilter(cat.id as any)}
                          className={cn(
                            "h-7 text-[10px] font-bold px-3",
                            itemCategoryFilter === cat.id ? "bg-blue-600" : "bg-white text-slate-500 border-slate-200"
                          )}
                        >
                          {cat.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden min-h-[200px] max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="text-[10px] font-bold py-2">管理番号 / 品名</TableHead>
                        <TableHead className="text-[10px] font-bold py-2">分類</TableHead>
                        <TableHead className="w-[80px] py-2"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInventoryItems.map((item) => (
                        <TableRow 
                          key={item.id} 
                          className={cn(
                            "hover:bg-blue-50/50 cursor-pointer transition-colors",
                            selectedInventoryId === item.id && "bg-blue-50 shadow-inner"
                          )}
                          onClick={() => setSelectedInventoryId(item.id)}
                        >
                          <TableCell className="py-2">
                            <p className="text-[10px] font-mono text-blue-600 font-bold">{item.managementNumber}</p>
                            <p className="text-xs font-bold text-slate-700 truncate max-w-[250px]">{item.name}</p>
                          </TableCell>
                          <TableCell className="py-2">
                            <Badge variant="outline" className={cn(
                              "text-[9px] font-bold border-none",
                              item.sortingCategory === 'recycle' ? "bg-emerald-50 text-emerald-600" :
                              item.sortingCategory === 'reuse' ? "bg-blue-50 text-blue-600" :
                              item.sortingCategory === 'rebuilt' ? "bg-purple-50 text-purple-600" : "bg-slate-100 text-slate-500"
                            )}>
                              {item.sortingCategory === 'recycle' ? '資源' :
                               item.sortingCategory === 'reuse' ? 'リユース' :
                               item.sortingCategory === 'rebuilt' ? 'リビルド' : '未分類'}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2">
                            <div className={cn(
                              "w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center",
                              selectedInventoryId === item.id && "bg-blue-600 border-blue-600"
                            )}>
                              {selectedInventoryId === item.id && <CheckCircle2 className="w-3 h-3 text-white" />}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredInventoryItems.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="h-24 text-center text-slate-400 italic text-xs">
                            該当する在庫が見つかりません
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {selectedItem && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex justify-between items-center shadow-sm">
                      <div className="space-y-1">
                        <p className="text-[10px] text-blue-500 font-bold uppercase tracking-wider">選択中の商品: 推定原価合計</p>
                        <p className="text-2xl font-bold text-blue-700">¥{calculateCost(selectedItem).toLocaleString()}</p>
                      </div>
                      <div className="text-right space-y-0.5">
                        <p className="text-[10px] text-blue-400 font-bold">買取: ¥{calculatePurchase(selectedItem).toLocaleString()}</p>
                        <p className="text-[10px] text-blue-400 font-bold">送料: ¥{(selectedItem.collectionShippingFee || 0).toLocaleString()}</p>
                        <p className="text-[10px] text-blue-400 font-bold">評価: ¥{(selectedItem.laborEvaluationAmount || 0).toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500">販売価格 (¥)</label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <Input 
                            type="number" 
                            placeholder="0" 
                            value={salePrice}
                            onChange={(e) => setSalePrice(e.target.value)}
                            className="h-11 pl-9 bg-slate-50 border-slate-200 font-bold text-lg" 
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500">販売チャネル</label>
                        <Select onValueChange={(v: any) => setSalePlatform(v)} defaultValue="banana_bay">
                          <SelectTrigger className="w-full h-11 bg-slate-50 border-slate-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-white">
                            <SelectItem value="banana_bay">BANANA BAY</SelectItem>
                            <SelectItem value="other">他プラットフォーム</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter className="bg-slate-50 -mx-6 -mb-6 p-4 border-t border-slate-200 rounded-b-lg shrink-0">
                <Button variant="ghost" onClick={() => setIsRecordingSale(false)}>キャンセル</Button>
                <Button onClick={handleRecordSale} className="bg-blue-600 hover:bg-blue-700 px-8" disabled={!selectedInventoryId || !salePrice}>
                  売上実績として登録
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t('sales.thisMonth')} {t('sales.salesAmount')}</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-xl font-bold">¥4,250,000</h3>
                <span className="text-[10px] text-emerald-500 font-bold flex items-center">
                  <ArrowUpRight className="w-3 h-3" /> 12%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t('sales.thisMonth')} {t('sales.profit')}</p>
              <h3 className="text-xl font-bold">¥1,400,000</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">未入金合計</p>
              <h3 className="text-xl font-bold">¥850,000</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-slate-50 rounded-xl text-slate-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">販売済み点数</p>
              <h3 className="text-xl font-bold">124 点</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="analysis" className="w-full" onValueChange={setActiveTab}>
        <div className="flex items-center justify-between mb-4 bg-white p-2 rounded-xl shadow-sm">
          <TabsList className="bg-transparent border-none">
            <TabsTrigger value="analysis" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 rounded-lg px-6">利益・推移分析</TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 rounded-lg px-6">販売履歴</TabsTrigger>
            <TabsTrigger value="quotes" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 rounded-lg px-6">見積・請求</TabsTrigger>
          </TabsList>
          <div className="relative w-64 mr-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="検索..." className="pl-9 h-9 bg-slate-50 border-none rounded-lg text-sm" />
          </div>
        </div>

        <TabsContent value="analysis" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 border-none shadow-sm bg-white overflow-hidden">
              <CardHeader className="p-6 pb-0 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold">売上・利益推移 (月次)</CardTitle>
                  <CardDescription className="text-xs">過去4ヶ月の推移</CardDescription>
                </div>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-600 rounded-sm" />
                    <span className="text-[10px] font-bold text-slate-500">売上</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-emerald-500 rounded-sm" />
                    <span className="text-[10px] font-bold text-slate-500">利益</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 pt-10">
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salesByMonth}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="month" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fontSize: 11, fill: '#64748b'}}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fontSize: 10, fill: '#94a3b8'}}
                        tickFormatter={(v) => `¥${v/10000}万`}
                      />
                      <Tooltip 
                        cursor={{fill: '#f8fafc'}}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Bar dataKey="totalRevenue" name="売上" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={40} />
                      <Bar dataKey="totalProfit" name="利益" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-1 border-none shadow-sm bg-white overflow-hidden">
               <CardHeader className="p-6 border-b border-slate-50">
                <CardTitle className="text-base font-bold">売上上位カテゴリー</CardTitle>
                <CardDescription className="text-xs">カテゴリ別の売上構成比</CardDescription>
              </CardHeader>
              <CardContent className="p-4 flex flex-col h-[350px]">
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryAnalysis.slice(0, 5)} layout="vertical">
                      <XAxis type="number" hide />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fontSize: 10, fontWeight: 'bold', fill: '#64748b'}}
                        width={80}
                      />
                      <Tooltip 
                        cursor={{fill: 'transparent'}}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: number) => `¥${value.toLocaleString()}`}
                      />
                      <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={12} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 space-y-2 overflow-y-auto">
                  {categoryAnalysis.slice(0, 3).map((item, idx) => (
                    <div key={item.name} className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] w-4 h-4 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">{idx + 1}</span>
                        <span className="text-xs font-bold text-slate-700">{item.name}</span>
                      </div>
                      <span className="text-xs font-black text-slate-800">¥{(item.revenue / 1000).toFixed(0)}K</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            <Card className="lg:col-span-1 border-none shadow-sm bg-white overflow-hidden">
               <CardHeader className="p-6 border-b border-slate-50">
                <CardTitle className="text-base font-bold">利益率上位アイテム</CardTitle>
                <CardDescription className="text-xs">手数料控除後の純利益率</CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {highMarginItems.slice(0, 3).map((sale) => (
                  <div key={sale.id} className="p-4 rounded-xl bg-slate-50 flex justify-between items-center">
                    <div>
                      <p className="text-xs font-bold text-slate-800 truncate max-w-[120px]">{sale.itemName}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{sale.managementNumber}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-emerald-600">¥{sale.adjustedProfit.toLocaleString()}</p>
                      <div className="flex items-center gap-1 mt-1 justify-end">
                        <TrendingUp className="w-2.5 h-2.5 text-emerald-500" />
                        <span className="text-[10px] text-emerald-500 font-bold">{Math.round(sale.marginPercent)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
                <Button 
                  variant="ghost" 
                  className="w-full h-10 text-xs text-blue-600 font-bold gap-2"
                  onClick={() => setIsMarginReportOpen(true)}
                >
                  詳細レポートを表示 <ChevronRight className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>

            <Card className="lg:col-span-1 border-none shadow-sm bg-white overflow-hidden">
               <CardHeader className="p-6 border-b border-slate-50">
                <CardTitle className="text-base font-bold">販路別売上構成</CardTitle>
                <CardDescription className="text-xs">プラットフォーム別の実績</CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-6">
                <div className="flex items-center justify-between">
                   {channelAnalysis.map(channel => (
                     <div key={channel.name} className="text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">{channel.name}</p>
                        <p className="text-lg font-black text-slate-800">¥{(channel.revenue / 10000).toFixed(0)}万</p>
                        <p className="text-[10px] font-bold text-slate-500">{channel.count} 件</p>
                     </div>
                   ))}
                </div>
                <div className="h-4 bg-slate-100 rounded-full overflow-hidden flex">
                  {channelAnalysis.map(channel => (
                    <div 
                      key={channel.name}
                      className="h-full" 
                      style={{ 
                        width: `${(channel.revenue / (channelAnalysis[0].revenue + channelAnalysis[1].revenue)) * 100}%`,
                        backgroundColor: channel.color 
                      }} 
                    />
                  ))}
                </div>
                <div className="space-y-2">
                   <div className="flex justify-between items-center text-[10px] font-bold">
                     <div className="flex items-center gap-1.5 text-blue-600">
                        <div className="w-2 h-2 rounded-full bg-blue-600" /> BANANA BAY
                     </div>
                     <span>{Math.round((channelAnalysis[0].revenue / (channelAnalysis[0].revenue + channelAnalysis[1].revenue)) * 100)}%</span>
                   </div>
                   <div className="flex justify-between items-center text-[10px] font-bold">
                     <div className="flex items-center gap-1.5 text-slate-400">
                        <div className="w-2 h-2 rounded-full bg-slate-400" /> その他
                     </div>
                     <span>{Math.round((channelAnalysis[1].revenue / (channelAnalysis[0].revenue + channelAnalysis[1].revenue)) * 100)}%</span>
                   </div>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-1 border-none shadow-sm bg-white overflow-hidden">
               <CardHeader className="p-6 border-b border-slate-50">
                <CardTitle className="text-base font-bold">売上上位カテゴリー</CardTitle>
                <CardDescription className="text-xs">カテゴリ別の売上状況</CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                 {categoryAnalysis.slice(0, 4).map((cat, idx) => (
                   <div key={idx} className="flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-700">{cat.name}</span>
                        <span className="text-[10px] text-slate-400">{cat.count}件の販売</span>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black text-slate-900">¥{cat.revenue.toLocaleString()}</p>
                        <p className="text-[9px] text-blue-600 font-bold">利益 ¥{cat.profit.toLocaleString()}</p>
                      </div>
                   </div>
                 ))}
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6 border-none shadow-sm bg-white">
            <CardHeader className="p-6 border-b border-slate-50">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-base font-bold">月次決算報告書</CardTitle>
                  <CardDescription className="text-xs">月次/年次での収益推計</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-8 text-[11px] font-bold">{new Date().getFullYear()}年度を表示</Button>
                  <Button variant="ghost" size="sm" className="h-8 text-[11px] font-bold text-emerald-600 gap-1" onClick={() => exportMonthlyReport()}>
                    <Download className="w-3.5 h-3.5" /> Excel一括出力
                  </Button>
                </div>
              </div>
            </CardHeader>
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="px-6 text-[10px] font-bold">対象期間</TableHead>
                  <TableHead className="px-6 text-[10px] font-bold text-right">売上高合計</TableHead>
                  <TableHead className="px-6 text-[10px] font-bold text-right">売上総利益</TableHead>
                  <TableHead className="px-6 text-[10px] font-bold text-right">利益率</TableHead>
                  <TableHead className="px-6 text-[10px] font-bold text-right">販売点数</TableHead>
                  <TableHead className="w-[40px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salesByMonth.map((report) => (
                  <TableRow key={report.month} className="hover:bg-slate-50">
                    <TableCell className="px-6 font-bold">{report.month}</TableCell>
                    <TableCell className="px-6 text-right font-bold font-mono">¥{report.totalRevenue.toLocaleString()}</TableCell>
                    <TableCell className="px-6 text-right font-bold text-blue-600 font-mono">¥{report.totalProfit.toLocaleString()}</TableCell>
                    <TableCell className="px-6 text-right">
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-none font-bold">
                        {Math.round((report.totalProfit / report.totalRevenue) * 100)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="px-6 text-right font-bold">{report.itemsSoldCount} 点</TableCell>
                    <TableCell className="px-4">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-emerald-600" onClick={() => exportMonthlyReport([report])}>
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-0">
          <Card className="border-none shadow-sm overflow-hidden">
             <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="px-6 text-[10px] font-bold">販売日</TableHead>
                  <TableHead className="px-6 text-[10px] font-bold">商品情報</TableHead>
                  <TableHead className="px-6 text-[10px] font-bold text-right">販売単価</TableHead>
                  <TableHead className="px-6 text-[10px] font-bold text-right">計算原価 (試算)</TableHead>
                  <TableHead className="px-6 text-[10px] font-bold text-right">利益</TableHead>
                  <TableHead className="px-6 text-[10px] font-bold text-center">販路</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSales.map((sale) => {
                  const platformFee = sale.salePlatform === 'banana_bay' ? sale.salePrice * 0.1 : 0;
                  const netProfit = sale.grossProfit - platformFee;

                  return (
                    <TableRow key={sale.id} className="hover:bg-slate-50">
                      <TableCell className="px-6 text-sm">{sale.saleDate}</TableCell>
                      <TableCell className="px-6">
                        <p className="font-bold text-slate-700">{sale.itemName}</p>
                        <p className="text-[10px] text-slate-400">{sale.managementNumber}</p>
                      </TableCell>
                      <TableCell className="px-6 text-right font-bold text-slate-700">¥{sale.salePrice.toLocaleString()}</TableCell>
                      <TableCell className="px-6 text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-xs text-slate-600 font-medium">¥{(sale.purchaseAmount + sale.collectionShippingFee + sale.laborEvaluationAmount).toLocaleString()}</span>
                          <div className="flex gap-2 text-[9px] text-slate-400">
                            <span>買:¥{sale.purchaseAmount.toLocaleString()}</span>
                            <span>送:¥{sale.collectionShippingFee.toLocaleString()}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 text-right font-bold">
                        <div className="flex flex-col items-end">
                          <span className="text-emerald-600">¥{netProfit.toLocaleString()}</span>
                          {platformFee > 0 && <span className="text-[9px] text-rose-400">手数料: -¥{platformFee.toLocaleString()}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="px-6 text-center">
                        <Badge variant="outline" className={cn(
                          "text-[10px] font-bold",
                          sale.salePlatform === 'banana_bay' ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-slate-100 text-slate-600 border-slate-200"
                        )}>
                          {sale.salePlatform === 'banana_bay' ? 'BANANA BAY' : 'その他'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="quotes" className="mt-0">
          <Card className="border-none shadow-sm overflow-hidden p-8 text-center space-y-4">
             <FileText className="w-12 h-12 text-slate-200 mx-auto" />
             <div className="space-y-1">
               <h3 className="font-bold text-slate-900">見積・請求管理システム</h3>
               <p className="text-sm text-slate-500">既存の受発注管理機能は、個別の注文フローで処理してください。</p>
             </div>
             <Button variant="outline" onClick={() => setActiveTab('analysis')}>分析ダッシュボードへ戻る</Button>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Profit Margin Detailed Report Modal */}
      <Dialog open={isMarginReportOpen} onOpenChange={setIsMarginReportOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              利益率分析 詳細レポート
            </DialogTitle>
            <CardDescription>
              収益性の高い順にソートされた全販売商品の詳細一覧。
            </CardDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto mt-4 px-1">
            <Table>
              <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm transition-all duration-300">
                <TableRow>
                  <TableHead className="text-[10px] font-bold">販売日</TableHead>
                  <TableHead className="text-[10px] font-bold">管理番号 / 商品名</TableHead>
                  <TableHead className="text-[10px] font-bold text-right">販売単価</TableHead>
                  <TableHead className="text-[10px] font-bold text-right">原価(推定)</TableHead>
                  <TableHead className="text-[10px] font-bold text-right">手数料(10%)</TableHead>
                  <TableHead className="text-[10px] font-bold text-right">利益額</TableHead>
                  <TableHead className="text-[10px] font-bold text-right">利益率</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {highMarginItems.map((sale) => (
                  <TableRow key={sale.id} className="hover:bg-slate-50 border-b border-slate-100">
                    <TableCell className="text-xs text-slate-500 whitespace-nowrap">{sale.saleDate}</TableCell>
                    <TableCell>
                      <p className="text-[10px] font-mono text-blue-600 font-bold">{sale.managementNumber}</p>
                      <p className="text-xs font-bold text-slate-800 truncate max-w-[200px]">{sale.itemName}</p>
                    </TableCell>
                    <TableCell className="text-right font-black text-slate-900 text-xs">¥{sale.salePrice.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-slate-400 text-xs">¥{(sale.salePrice - sale.grossProfit).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-rose-500 text-xs font-bold">-¥{sale.platformFee.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-black text-emerald-600 text-xs">¥{sale.adjustedProfit.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Badge className={cn(
                        "text-[10px] font-black border-none px-2",
                        sale.marginPercent > 40 ? "bg-emerald-100 text-emerald-700" : 
                        sale.marginPercent > 20 ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"
                      )}>
                        {Math.round(sale.marginPercent)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter className="bg-slate-50 -mx-6 -mb-6 p-4 border-t border-slate-200 mt-4 rounded-b-lg shrink-0">
             <Button className="w-full bg-blue-600 hover:bg-blue-700 font-bold" onClick={() => setIsMarginReportOpen(false)}>
               レポートを閉じる
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
