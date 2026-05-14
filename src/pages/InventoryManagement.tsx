import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Download, 
  Plus, 
  MoreVertical,
  QrCode,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  Truck,
  X,
  QrCode as QrCodeIcon,
  ShoppingBag,
  Package,
  Printer,
  Settings2,
  Clock
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
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import {
  useInventory,
  resolvePurchaseAmount,
  resolveTotalCost,
  updateInventoryItem,
  addInventoryItem,
} from '@/src/stores/inventoryStore';
import { useCollections } from '@/src/stores/collectionsStore';
import { STATUS_LABELS, BANANA_BAY_STATUS_LABELS } from '@/src/constants';
import { cn } from '@/lib/utils';
import { InventoryItem, UserRole } from '@/src/types';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { differenceInDays } from 'date-fns';
import { useT } from '@/src/stores/i18nStore';

const ALL_COLUMNS = [
  { id: 'managementNumber', label: '管理番号' },
  { id: 'partNumber', label: '部品番号' },
  { id: 'name', label: '商品名' },
  { id: 'partCategory', label: 'パーツカテゴリ' },
  { id: 'carMaker', label: 'メーカー' },
  { id: 'carName', label: '車種名' },
  { id: 'carModelNumber', label: '型式' },
  { id: 'location', label: '棚割り番号' },
  { id: 'baseName', label: '拠点名' },
  { id: 'status', label: 'ステータス' },
  { id: 'sortingCategory', label: '在庫分類' },
  { id: 'dwellTime', label: '滞留日数' },
  { id: 'bananaBayStatus', label: 'BANANA BAY' },
  { id: 'rank', label: 'ランク' },
  { id: 'price', label: '中古価格' },
  { id: 'newPrice', label: '新品価格' },
  { id: 'shippingFee', label: '送料' },
  { id: 'purchaseAmount', label: '買取金額(原価)' },
  { id: 'totalCost', label: '原価合計' },
  { id: 'condition', label: '状態' },
  { id: 'mileage', label: '走行距離' },
  { id: 'engineType', label: 'エンジン型式' },
  { id: 'color', label: 'カラー' },
  { id: 'note', label: '備考' },
];

const DEFAULT_VISIBLE_COLUMNS = [
  'managementNumber',
  'partNumber',
  'name',
  'location',
  'baseName',
  'status',
  'sortingCategory',
  'dwellTime',
  'bananaBayStatus',
  'rank',
  'price',
  'purchaseAmount',
];

export function InventoryManagement({ role = 'admin', selectedBase }: { role?: UserRole, selectedBase?: string }) {
  const t = useT();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeBananaBayFilter, setActiveBananaBayFilter] = useState<'all' | 'listed' | 'error' | 'sold'>('all');
  const [sortingFilter, setSortingFilter] = useState<'all' | 'reuse' | 'recycle' | 'rebuilt'>('all');
  const [rankFilter, setRankFilter] = useState<string>('all');
  const [dwellFilter, setDwellFilter] = useState<'all' | 'over3' | 'over5' | 'over7'>('all');
  const [partCategoryFilter, setPartCategoryFilter] = useState<string>('all');
  const [makerFilter, setMakerFilter] = useState<string>('all');
  const [baseFilter, setBaseFilter] = useState<string>('all');
  // Live inventory store (買取金額が分別作業で確定すると自動反映)
  const inventory = useInventory();
  const collections = useCollections();
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [isLabelPreviewOpen, setIsLabelPreviewOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_VISIBLE_COLUMNS);

  // Derive unique values for filter dropdowns
  const uniquePartCategories = useMemo(
    () => Array.from(new Set(inventory.map(i => i.partCategory).filter(Boolean))) as string[],
    [inventory]
  );
  const uniqueMakers = useMemo(
    () => Array.from(new Set(inventory.map(i => i.carMaker).filter(Boolean))) as string[],
    [inventory]
  );
  const uniqueBases = useMemo(
    () => Array.from(new Set(inventory.map(i => i.baseName).filter(Boolean))) as string[],
    [inventory]
  );

  const [isProductizationModalOpen, setIsProductizationModalOpen] = useState(false);
  const [productizationStep, setProductizationStep] = useState(1);
  const [productizationData, setProductizationData] = useState({
    cleaningDone: false,
    inspected: false,
    rank: '',
    shelf: '',
    photos: [] as string[],
    sortingCategory: '' as any
  });

  const handleRegister = (item: InventoryItem) => {
    setSelectedItem(item);
    setProductizationStep(1);
    setProductizationData({
      cleaningDone: !!item.cleaningDone,
      inspected: !!item.inspected,
      rank: item.rank || '',
      shelf: item.location || '',
      photos: item.images || [],
      sortingCategory: item.sortingCategory || ''
    });
    setIsProductizationModalOpen(true);
  };

  const toggleColumn = (columnId: string) => {
    setVisibleColumns(prev => 
      prev.includes(columnId) 
        ? prev.filter(id => id !== columnId)
        : [...prev, columnId]
    );
  };

  const isDataIncomplete = (item: InventoryItem) => {
    return !item.partNumber || !item.carMaker || !item.images || item.images.length === 0;
  };

  const handleProductizationComplete = () => {
    if (!selectedItem) return;
    
    updateInventoryItem(selectedItem.id, {
      status: selectedItem.sortingCategory === 'reuse' ? 'listed' : 'sold',
      bananaBayStatus: selectedItem.sortingCategory === 'reuse' ? 'listed' : 'not_listed',
      statusChangedAt: new Date().toISOString(),
      stayDays: 0,
      ...productizationData,
    });
    
    const message = selectedItem.status === 'pending_sorting' 
      ? '分別が完了しました。' 
      : '商品化作業が完了し、BANANA BAYに出品されました';
    toast.success(message);
    setIsProductizationModalOpen(false);
  };

  const handleMarkAsSold = (item: InventoryItem) => {
    updateInventoryItem(item.id, {
      status: 'sold',
      bananaBayStatus: 'sold',
      statusChangedAt: new Date().toISOString(),
      soldDate: new Date().toISOString().split('T')[0],
    });
    toast.success('売上確定処理が完了しました', { description: 'ステータスが「売上完了」に更新されました。' });
  };

  const filteredInventory = inventory.filter(item => {
    const matchesSearch =
      item.managementNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.partNumber && item.partNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.carName && item.carName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.carModelNumber && item.carModelNumber.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;

    const matchesBase =
      (!selectedBase || item.baseName === selectedBase) &&
      (baseFilter === 'all' || item.baseName === baseFilter);

    let matchesBananaBay = true;
    if (activeBananaBayFilter === 'listed') {
      matchesBananaBay = item.bananaBayStatus === 'listed' || item.bananaBayStatus === 'listing';
    } else if (activeBananaBayFilter === 'error') {
      matchesBananaBay = item.bananaBayStatus === 'error';
    } else if (activeBananaBayFilter === 'sold') {
      matchesBananaBay = item.bananaBayStatus === 'sold';
    }

    const matchesSorting = sortingFilter === 'all' || item.sortingCategory === sortingFilter;
    const matchesRank = rankFilter === 'all' || item.rank === rankFilter;
    const matchesPartCategory = partCategoryFilter === 'all' || item.partCategory === partCategoryFilter;
    const matchesMaker = makerFilter === 'all' || item.carMaker === makerFilter;

    let matchesDwell = true;
    if (dwellFilter !== 'all') {
      if (!item.statusChangedAt) {
        matchesDwell = false;
      } else {
        const days = differenceInDays(new Date(), new Date(item.statusChangedAt));
        if (dwellFilter === 'over3') matchesDwell = days >= 3;
        else if (dwellFilter === 'over5') matchesDwell = days >= 5;
        else if (dwellFilter === 'over7') matchesDwell = days >= 7;
      }
    }

    return matchesSearch && matchesStatus && matchesBase && matchesBananaBay
      && matchesSorting && matchesRank && matchesPartCategory && matchesMaker && matchesDwell;
  });

  // Active filter management
  const activeFilters: { key: string; label: string; clear: () => void }[] = [];
  if (searchTerm) activeFilters.push({ key: 'search', label: `検索: ${searchTerm}`, clear: () => setSearchTerm('') });
  if (statusFilter !== 'all') activeFilters.push({ key: 'status', label: `ステータス: ${STATUS_LABELS[statusFilter as keyof typeof STATUS_LABELS] || statusFilter}`, clear: () => setStatusFilter('all') });
  if (activeBananaBayFilter !== 'all') {
    const labelMap: Record<string, string> = { listed: 'BANANA BAY 出品中', error: '出品エラー', sold: '売却済み' };
    activeFilters.push({ key: 'bananaBay', label: labelMap[activeBananaBayFilter] || activeBananaBayFilter, clear: () => setActiveBananaBayFilter('all') });
  }
  if (sortingFilter !== 'all') {
    const labelMap: Record<string, string> = { reuse: '在庫分類: リユース', recycle: '在庫分類: 資源', rebuilt: '在庫分類: リビルド' };
    activeFilters.push({ key: 'sorting', label: labelMap[sortingFilter], clear: () => setSortingFilter('all') });
  }
  if (rankFilter !== 'all') activeFilters.push({ key: 'rank', label: `ランク: ${rankFilter}`, clear: () => setRankFilter('all') });
  if (partCategoryFilter !== 'all') activeFilters.push({ key: 'partCategory', label: `カテゴリ: ${partCategoryFilter}`, clear: () => setPartCategoryFilter('all') });
  if (makerFilter !== 'all') activeFilters.push({ key: 'maker', label: `メーカー: ${makerFilter}`, clear: () => setMakerFilter('all') });
  if (baseFilter !== 'all' && !selectedBase) activeFilters.push({ key: 'base', label: `拠点: ${baseFilter}`, clear: () => setBaseFilter('all') });
  if (dwellFilter !== 'all') {
    const labelMap: Record<string, string> = { over3: '滞留3日以上', over5: '滞留5日以上', over7: '滞留7日以上' };
    activeFilters.push({ key: 'dwell', label: labelMap[dwellFilter], clear: () => setDwellFilter('all') });
  }

  const clearAllFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setActiveBananaBayFilter('all');
    setSortingFilter('all');
    setRankFilter('all');
    setPartCategoryFilter('all');
    setMakerFilter('all');
    setBaseFilter('all');
    setDwellFilter('all');
  };

  const handlePrintLabel = (item: InventoryItem) => {
    setSelectedItem(item);
    setIsLabelPreviewOpen(true);
  };

  const handleExportExcel = () => {
    const exportData = inventory.map(item => ({
      '管理番号': item.managementNumber,
      '部品番号': item.partNumber,
      '商品名': item.name,
      'カテゴリ': item.category,
      'パーツカテゴリ': item.partCategory || '-',
      'メーカー': item.carMaker || '-',
      '車種名': item.carName || '-',
      '型式': item.carModelNumber || '-',
      '棚割り番号': item.location || '-',
      '拠点名': item.baseName || '-',
      'ステータス': STATUS_LABELS[item.status],
      'BANANA BAYステータス': BANANA_BAY_STATUS_LABELS[item.bananaBayStatus || 'not_listed'],
      'ランク': item.rank || '-',
      '新品価格': item.newPrice || 0,
      '中古価格': item.price || 0,
      '送料': item.shippingFee || 0,
      '状態': item.condition || '-',
      '走行距離': item.mileage || '-',
      'エンジン型式': item.engineType || '-',
      'カラー': item.color || '-',
      '入荷日': item.arrivalDate,
      '備考': item.notes || '-'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory");
    XLSX.writeFile(workbook, `Inventory_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Excelファイルをダウンロードしました');
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        const newItems = jsonData.map((row, index) => ({
          id: `imported-${Date.now()}-${index}`,
          managementNumber: row['管理番号'] || `IMP-${Date.now()}-${index}`,
          partNumber: row['部品番号'] || 'UNKNOWN',
          name: row['商品名'] || '名称未設定',
          category: row['カテゴリ'] || 'その他',
          partCategory: row['パーツカテゴリ'] || '',
          carMaker: row['メーカー'] || '',
          carName: row['車種名'] || '',
          carModelNumber: row['型式'] || '',
          location: row['棚割り番号'] || '',
          baseName: row['拠点名'] || '',
          status: 'unregistered' as const,
          rank: row['ランク'] === '-' ? undefined : row['ランク'],
          newPrice: Number(row['新品価格']) || 0,
          price: Number(row['中古価格']) || 0,
          shippingFee: Number(row['送料']) || 0,
          condition: row['状態'] || '',
          mileage: row['走行距離'] || '',
          engineType: row['エンジン型式'] || '',
          color: row['カラー'] || '',
          arrivalDate: row['入荷日'] || new Date().toISOString().split('T')[0],
          notes: row['備考'] || '',
        }));

        newItems.forEach((item: InventoryItem) => addInventoryItem(item));
        toast.success(`${newItems.length}件のデータをインポートしました`);
      } catch (error) {
        toast.error('ファイルの読み込みに失敗しました。フォーマットを確認してください。');
        console.error(error);
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset input
    event.target.value = '';
  };

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-[#e2e8f0] shadow-none">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-blue-50 rounded-lg text-[#2563eb]">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-[#64748b] font-medium uppercase">{t('admin.totalInventory')}</p>
              <h3 className="text-xl font-bold">{inventory.length} {t('admin.points')}</h3>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={cn(
            "border-[#e2e8f0] shadow-none cursor-pointer transition-all hover:border-orange-300",
            activeBananaBayFilter === 'listed' && "border-orange-500 ring-1 ring-orange-500 bg-orange-50/30"
          )}
          onClick={() => setActiveBananaBayFilter(activeBananaBayFilter === 'listed' ? 'all' : 'listed')}
        >
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-orange-50 rounded-lg text-orange-600">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-[#64748b] font-medium uppercase">BANANA BAY {t('admin.listed')}</p>
              <h3 className="text-xl font-bold">
                {inventory.filter(i => i.bananaBayStatus === 'listed' || i.bananaBayStatus === 'listing').length} {t('admin.points')}
              </h3>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={cn(
            "border-[#e2e8f0] shadow-none cursor-pointer transition-all hover:border-red-300",
            statusFilter === 'unregistered' && "border-red-500 ring-1 ring-red-500 bg-red-50/30"
          )}
          onClick={() => setStatusFilter(statusFilter === 'unregistered' ? 'all' : 'unregistered')}
        >
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-red-50 rounded-lg text-red-600">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-[#64748b] font-medium uppercase">{t('admin.statusUnregistered')}</p>
              <h3 className="text-xl font-bold">
                {inventory.filter(i => i.status === 'unregistered' || isDataIncomplete(i)).length} {t('admin.points')}
              </h3>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={cn(
            "border-[#e2e8f0] shadow-none cursor-pointer transition-all hover:border-emerald-300",
            activeBananaBayFilter === 'sold' && "border-emerald-500 ring-1 ring-emerald-500 bg-emerald-50/30"
          )}
          onClick={() => setActiveBananaBayFilter(activeBananaBayFilter === 'sold' ? 'all' : 'sold')}
        >
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-[#64748b] font-medium uppercase">{t('admin.statusSold2')}</p>
              <h3 className="text-xl font-bold">
                {inventory.filter(i => i.bananaBayStatus === 'sold').length} {t('admin.points')}
              </h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col gap-3 bg-white p-5 rounded-lg border border-[#e2e8f0] shadow-none">
        {/* Row 1: Search + Action buttons */}
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
          <div className="relative flex-1 max-w-2xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b]" />
            <Input
              placeholder={t('inv.search')}
              className="pl-10 bg-[#f8fafc] border-[#e2e8f0] rounded h-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label="検索クリア"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="sm" className="gap-2 h-10 px-3 border-[#e2e8f0] font-medium">
                    <Settings2 className="w-4 h-4" /> 表示項目
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-56 max-h-[400px] overflow-y-auto">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>表示・非表示設定</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {ALL_COLUMNS.map(col => (
                    <DropdownMenuCheckboxItem
                      key={col.id}
                      checked={visibleColumns.includes(col.id)}
                      onCheckedChange={() => toggleColumn(col.id)}
                    >
                      {col.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            {role === 'admin' && (
              <>
                <div className="relative">
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                    onChange={handleFileUpload}
                  />
                  <Button size="sm" className="gap-2 bg-[#1d6f42] hover:bg-[#165a35] text-white h-10 px-3 border-none font-medium">
                    <Download className="w-4 h-4" /> {t('admin.exportCsv')}
                  </Button>
                </div>
                <Button
                  onClick={handleExportExcel}
                  size="sm"
                  className="gap-2 bg-[#2563eb] hover:bg-[#1e40af] text-white h-10 px-3 border-none font-medium"
                >
                  <Download className="w-4 h-4" /> Excel
                </Button>
                <Button size="sm" className="gap-2 bg-[#2563eb] hover:bg-[#1e40af] text-white h-10 px-3 border-none font-medium">
                  <Plus className="w-4 h-4" /> {t('inv.add')}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Row 2: Status chip filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <Button
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('all')}
            className={cn(
              "h-8 shrink-0 text-[11px] px-3 border-[#e2e8f0] rounded-full",
              statusFilter === 'all' && "bg-[#1e293b] hover:bg-[#0f172a]"
            )}
          >
{t('common.all')} ({inventory.length})
          </Button>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <Button
              key={value}
              variant={statusFilter === value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(value as any)}
              className={cn(
                "h-8 shrink-0 text-[11px] px-3 font-medium border-[#e2e8f0] rounded-full",
                statusFilter === value && value === 'unregistered' && "bg-red-600 hover:bg-red-700",
                statusFilter === value && value === 'in_production' && "bg-amber-600 hover:bg-amber-700",
                statusFilter === value && value === 'in_stock' && "bg-blue-600 hover:bg-blue-700",
                statusFilter !== value && "text-slate-600 hover:text-slate-900"
              )}
            >
              {label} ({inventory.filter(i => i.status === value).length})
            </Button>
          ))}
        </div>

        {/* Row 3: Secondary filter dropdowns */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
          <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3" /> {t('common.filter')}
          </span>

          <Select value={activeBananaBayFilter} onValueChange={(v) => setActiveBananaBayFilter(v as any)}>
            <SelectTrigger className="h-8 w-auto min-w-[150px] text-xs bg-white border-[#e2e8f0]">
              <SelectValue placeholder="BANANA BAY" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">BANANA BAY: すべて</SelectItem>
              <SelectItem value="listed">出品中</SelectItem>
              <SelectItem value="error">出品エラー</SelectItem>
              <SelectItem value="sold">売却済み</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortingFilter} onValueChange={(v) => setSortingFilter(v as any)}>
            <SelectTrigger className="h-8 w-auto min-w-[140px] text-xs bg-white border-[#e2e8f0]">
              <SelectValue placeholder="在庫分類" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">在庫分類: すべて</SelectItem>
              <SelectItem value="reuse">リユース</SelectItem>
              <SelectItem value="recycle">資源</SelectItem>
              <SelectItem value="rebuilt">リビルド</SelectItem>
            </SelectContent>
          </Select>

          <Select value={rankFilter} onValueChange={setRankFilter}>
            <SelectTrigger className="h-8 w-auto min-w-[110px] text-xs bg-white border-[#e2e8f0]">
              <SelectValue placeholder="ランク" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ランク: すべて</SelectItem>
              {['S', 'A', 'B', 'C', 'D', 'J'].map(r => (
                <SelectItem key={r} value={r}>ランク {r}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={dwellFilter} onValueChange={(v) => setDwellFilter(v as any)}>
            <SelectTrigger className="h-8 w-auto min-w-[130px] text-xs bg-white border-[#e2e8f0]">
              <SelectValue placeholder="滞留日数" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">滞留日数: すべて</SelectItem>
              <SelectItem value="over3">3日以上</SelectItem>
              <SelectItem value="over5">5日以上</SelectItem>
              <SelectItem value="over7">7日以上</SelectItem>
            </SelectContent>
          </Select>

          {uniquePartCategories.length > 0 && (
            <Select value={partCategoryFilter} onValueChange={setPartCategoryFilter}>
              <SelectTrigger className="h-8 w-auto min-w-[140px] text-xs bg-white border-[#e2e8f0]">
                <SelectValue placeholder="カテゴリ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">カテゴリ: すべて</SelectItem>
                {uniquePartCategories.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {uniqueMakers.length > 0 && (
            <Select value={makerFilter} onValueChange={setMakerFilter}>
              <SelectTrigger className="h-8 w-auto min-w-[120px] text-xs bg-white border-[#e2e8f0]">
                <SelectValue placeholder="メーカー" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">メーカー: すべて</SelectItem>
                {uniqueMakers.map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {!selectedBase && uniqueBases.length > 0 && (
            <Select value={baseFilter} onValueChange={setBaseFilter}>
              <SelectTrigger className="h-8 w-auto min-w-[120px] text-xs bg-white border-[#e2e8f0]">
                <SelectValue placeholder="拠点" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">拠点: すべて</SelectItem>
                {uniqueBases.map(b => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11px] text-slate-500 font-medium">
              <span className="font-bold text-slate-700">{filteredInventory.length}</span>
              <span className="mx-1">/</span>
              <span>{inventory.length}</span>
              <span className="ml-1">件表示</span>
            </span>
            {activeFilters.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="h-7 px-2 text-[11px] text-slate-500 hover:text-slate-900"
              >
                <X className="w-3 h-3 mr-1" /> 全てクリア
              </Button>
            )}
          </div>
        </div>

        {/* Row 4: Active filter chips */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">適用中</span>
            {activeFilters.map(f => (
              <Badge
                key={f.key}
                variant="secondary"
                className="gap-1 px-2 py-0.5 text-[10px] bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 font-medium"
              >
                {f.label}
                <X className="w-3 h-3 cursor-pointer hover:text-blue-900" onClick={f.clear} />
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-[#e2e8f0] shadow-none overflow-hidden">
        <div className="p-5 border-b border-[#e2e8f0]">
          <h2 className="text-lg font-bold text-[#1e293b]">商品データ一覧</h2>
        </div>
        <Table>
          <TableHeader className="bg-[#f8fafc]">
            <TableRow className="hover:bg-transparent border-b border-[#e2e8f0]">
              {visibleColumns.includes('managementNumber') && <TableHead className="w-[150px] text-[12px] text-[#64748b] uppercase font-bold px-5">管理番号</TableHead>}
              {visibleColumns.includes('partNumber') && <TableHead className="w-[150px] text-[12px] text-[#64748b] uppercase font-bold px-5">部品番号</TableHead>}
              {visibleColumns.includes('name') && <TableHead className="text-[12px] text-[#64748b] uppercase font-bold px-5">商品名</TableHead>}
              {visibleColumns.includes('partCategory') && <TableHead className="text-[12px] text-[#64748b] uppercase font-bold px-5">パーツカテゴリ</TableHead>}
              {visibleColumns.includes('carMaker') && <TableHead className="text-[12px] text-[#64748b] uppercase font-bold px-5">メーカー</TableHead>}
              {visibleColumns.includes('carName') && <TableHead className="text-[12px] text-[#64748b] uppercase font-bold px-5">車種名</TableHead>}
              {visibleColumns.includes('carModelNumber') && <TableHead className="text-[12px] text-[#64748b] uppercase font-bold px-5">型式</TableHead>}
              {visibleColumns.includes('location') && <TableHead className="text-[12px] text-[#64748b] uppercase font-bold px-5">棚割り番号</TableHead>}
              {visibleColumns.includes('baseName') && <TableHead className="text-[12px] text-[#64748b] uppercase font-bold px-5">拠点名</TableHead>}
              {visibleColumns.includes('status') && <TableHead className="text-[12px] text-[#64748b] uppercase font-bold px-5">ステータス</TableHead>}
              {visibleColumns.includes('sortingCategory') && <TableHead className="text-[12px] text-[#64748b] uppercase font-bold px-5">在庫分類</TableHead>}
              {visibleColumns.includes('bananaBayStatus') && <TableHead className="text-[12px] text-[#64748b] uppercase font-bold px-5">BANANA BAY</TableHead>}
              {visibleColumns.includes('rank') && <TableHead className="text-[12px] text-[#64748b] uppercase font-bold px-5">ランク</TableHead>}
              {visibleColumns.includes('price') && <TableHead className="text-right text-[12px] text-[#64748b] uppercase font-bold px-5">中古価格</TableHead>}
              {visibleColumns.includes('newPrice') && <TableHead className="text-right text-[12px] text-[#64748b] uppercase font-bold px-5">新品価格</TableHead>}
              {visibleColumns.includes('shippingFee') && <TableHead className="text-right text-[12px] text-[#64748b] uppercase font-bold px-5">送料</TableHead>}
              {visibleColumns.includes('purchaseAmount') && <TableHead className="text-right text-[12px] text-[#64748b] uppercase font-bold px-5">買取金額</TableHead>}
              {visibleColumns.includes('totalCost') && <TableHead className="text-right text-[12px] text-[#64748b] uppercase font-bold px-5">原価合計</TableHead>}
              {visibleColumns.includes('condition') && <TableHead className="text-[12px] text-[#64748b] uppercase font-bold px-5">状態</TableHead>}
              {visibleColumns.includes('mileage') && <TableHead className="text-[12px] text-[#64748b] uppercase font-bold px-5">走行距離</TableHead>}
              {visibleColumns.includes('engineType') && <TableHead className="text-[12px] text-[#64748b] uppercase font-bold px-5">エンジン型式</TableHead>}
              {visibleColumns.includes('color') && <TableHead className="text-[12px] text-[#64748b] uppercase font-bold px-5">カラー</TableHead>}
              {visibleColumns.includes('note') && <TableHead className="text-[12px] text-[#64748b] uppercase font-bold px-5">備考</TableHead>}
              <TableHead className="w-[50px] px-5"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInventory.slice(0, 100).map((item) => (
              <TableRow key={item.id} className="hover:bg-[#f8fafc] transition-colors border-b border-[#e2e8f0] last:border-0">
                {visibleColumns.includes('managementNumber') && (
                  <TableCell className="font-mono text-xs font-bold text-[#2563eb] px-5">
                    <div className="flex items-center gap-2">
                      <QrCode className="w-3 h-3 text-[#64748b]" />
                      {item.managementNumber}
                    </div>
                  </TableCell>
                )}
                {visibleColumns.includes('partNumber') && (
                  <TableCell className="font-mono text-xs text-[#1e293b] px-5">
                    {item.partNumber || <span className="text-red-400 italic">未入力</span>}
                  </TableCell>
                )}
                {visibleColumns.includes('name') && (
                  <TableCell className="font-medium text-[#1e293b] px-5">
                    <div className="flex items-center gap-2">
                      {item.images && item.images.length > 0 ? (
                        <img 
                          src={item.images[0]} 
                          alt={item.name} 
                          className="w-8 h-8 rounded object-cover border border-slate-200"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center border border-slate-200">
                          <ImageIcon className="w-4 h-4 text-slate-400" />
                        </div>
                      )}
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="truncate max-w-[180px] font-bold text-[#1e293b]">{item.name}</span>
                          {(item.status === 'unregistered' || isDataIncomplete(item)) && (
                            <div className="flex items-center gap-1 group relative flex-shrink-0">
                              <AlertCircle className="w-3.5 h-3.5 text-red-500 fill-red-50" />
                              <span className="hidden group-hover:block absolute left-full ml-2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-50">
                                情報登録不足
                              </span>
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {item.carModel} {item.carYear}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                )}
                {visibleColumns.includes('partCategory') && (
                  <TableCell className="px-5 text-sm text-slate-600">
                    {item.partCategory || '-'}
                  </TableCell>
                )}
                {visibleColumns.includes('carMaker') && (
                  <TableCell className="px-5 text-sm text-slate-600">
                    {item.carMaker || '-'}
                  </TableCell>
                )}
                {visibleColumns.includes('carName') && (
                  <TableCell className="px-5 text-sm text-slate-600">
                    {item.carName || '-'}
                  </TableCell>
                )}
                {visibleColumns.includes('carModelNumber') && (
                  <TableCell className="px-5 text-sm font-mono text-slate-600">
                    {item.carModelNumber || '-'}
                  </TableCell>
                )}
                {visibleColumns.includes('location') && (
                  <TableCell className="px-5">
                    <span className="text-sm font-mono text-slate-600">{item.location || '-'}</span>
                  </TableCell>
                )}
                {visibleColumns.includes('baseName') && (
                  <TableCell className="px-5">
                    <span className="text-sm text-slate-600">{item.baseName || '-'}</span>
                  </TableCell>
                )}
                {visibleColumns.includes('status') && (
                  <TableCell className="px-5">
                    <div className="flex flex-col gap-1">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold w-fit border",
                        item.status === 'pending_collection' ? "bg-slate-100 text-slate-600 border-slate-200" :
                        item.status === 'collected' ? "bg-blue-50 text-blue-600 border-blue-100" :
                        item.status === 'pending_sorting' ? "bg-amber-50 text-amber-600 border-amber-100" :
                        item.status === 'sorted' ? "bg-amber-100 text-amber-700 border-amber-200" :
                        item.status === 'in_production' ? "bg-blue-100 text-blue-700 border-blue-200" :
                        item.status === 'completed' ? "bg-indigo-100 text-indigo-700 border-indigo-200" :
                        item.status === 'unregistered' ? "bg-red-100 text-red-700 border-red-200" :
                        item.status === 'in_stock' ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                        "bg-slate-50 text-slate-400 border-slate-100"
                      )}>
                        {STATUS_LABELS[item.status]}
                      </span>
                    </div>
                  </TableCell>
                )}
                {visibleColumns.includes('sortingCategory') && (
                  <TableCell className="px-5">
                    <Badge variant="outline" className={cn(
                      "text-[10px] font-bold border-none",
                      item.sortingCategory === 'recycle' ? "bg-emerald-50 text-emerald-600" :
                      item.sortingCategory === 'reuse' ? "bg-blue-50 text-blue-600" :
                      item.sortingCategory === 'rebuilt' ? "bg-purple-50 text-purple-600" : "bg-slate-50 text-slate-400"
                    )}>
                      {item.sortingCategory === 'recycle' ? '資源' :
                       item.sortingCategory === 'reuse' ? 'リユース' :
                       item.sortingCategory === 'rebuilt' ? 'リビルド' : '-'}
                    </Badge>
                  </TableCell>
                )}
                {visibleColumns.includes('dwellTime') && (
                  <TableCell className="px-5">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span className={cn(
                        "text-sm font-medium",
                        item.statusChangedAt && differenceInDays(new Date(), new Date(item.statusChangedAt)) >= 5 ? "text-red-600" : 
                        item.statusChangedAt && differenceInDays(new Date(), new Date(item.statusChangedAt)) >= 3 ? "text-amber-600" : "text-slate-600"
                      )}>
                        {item.statusChangedAt ? `${differenceInDays(new Date(), new Date(item.statusChangedAt))}日` : '-'}
                      </span>
                    </div>
                  </TableCell>
                )}
                {visibleColumns.includes('bananaBayStatus') && (
                  <TableCell className="px-5">
                    <div className="flex flex-col gap-1">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold w-fit",
                        item.bananaBayStatus === 'listed' ? "bg-orange-100 text-orange-700 border border-orange-200" :
                        item.bananaBayStatus === 'listing' ? "bg-blue-50 text-blue-600 border-blue-100" :
                        item.bananaBayStatus === 'error' ? "bg-rose-100 text-rose-700 border border-rose-200" :
                        item.bananaBayStatus === 'sold' ? "bg-slate-100 text-slate-600 border border-slate-200" :
                        "bg-slate-50 text-slate-400 border border-slate-100"
                      )}>
                        {BANANA_BAY_STATUS_LABELS[item.bananaBayStatus || 'not_listed']}
                      </span>
                    </div>
                  </TableCell>
                )}
                {visibleColumns.includes('rank') && (
                  <TableCell className="px-5">
                    <div className={cn(
                      "w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold",
                      item.rank === 'S' ? "bg-yellow-100 text-yellow-700" :
                      item.rank === 'A' ? "bg-blue-100 text-blue-700" :
                      "bg-[#f1f5f9] text-[#64748b]"
                    )}>
                      {item.rank || '-'}
                    </div>
                  </TableCell>
                )}
                {visibleColumns.includes('price') && (
                  <TableCell className="text-right font-bold text-[#1e293b] px-5">
                    {item.price ? `¥${item.price.toLocaleString()}` : '-'}
                  </TableCell>
                )}
                {visibleColumns.includes('newPrice') && (
                  <TableCell className="text-right text-sm text-[#64748b] px-5">
                    {item.newPrice ? `¥${item.newPrice.toLocaleString()}` : '-'}
                  </TableCell>
                )}
                {visibleColumns.includes('shippingFee') && (
                  <TableCell className="text-right text-sm text-[#64748b] px-5">
                    <div className="flex items-center justify-end gap-1">
                      <Truck className="w-3 h-3" />
                      {item.shippingFee ? `¥${item.shippingFee.toLocaleString()}` : '込'}
                    </div>
                  </TableCell>
                )}
                {visibleColumns.includes('purchaseAmount') && (
                  <TableCell className="text-right text-sm font-bold text-amber-700 px-5 tabular-nums">
                    {(() => {
                      const v = resolvePurchaseAmount(item, collections);
                      return v > 0 ? `¥${v.toLocaleString()}` : '-';
                    })()}
                  </TableCell>
                )}
                {visibleColumns.includes('totalCost') && (
                  <TableCell className="text-right text-sm font-bold text-slate-700 px-5 tabular-nums">
                    {(() => {
                      const v = resolveTotalCost(item, collections);
                      return v > 0 ? `¥${v.toLocaleString()}` : '-';
                    })()}
                  </TableCell>
                )}
                {visibleColumns.includes('condition') && (
                  <TableCell className="px-5 text-sm text-slate-600">
                    {item.condition || '-'}
                  </TableCell>
                )}
                {visibleColumns.includes('mileage') && (
                  <TableCell className="px-5 text-sm text-slate-600">
                    {item.mileage || '-'}
                  </TableCell>
                )}
                {visibleColumns.includes('engineType') && (
                  <TableCell className="px-5 text-sm text-slate-600">
                    {item.engineType || '-'}
                  </TableCell>
                )}
                {visibleColumns.includes('color') && (
                  <TableCell className="px-5 text-sm text-slate-600">
                    {item.color || '-'}
                  </TableCell>
                )}
                {visibleColumns.includes('note') && (
                  <TableCell className="px-5 text-sm text-slate-600">
                    <span className="truncate max-w-[150px] block">{item.notes || '-'}</span>
                  </TableCell>
                )}
                <TableCell className="px-5">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem className="gap-2 font-bold text-emerald-600" onClick={() => handleMarkAsSold(item)}>
                        <ShoppingBag className="w-4 h-4" /> 売上確定
                      </DropdownMenuItem>
                      {item.status === 'pending_sorting' && (
                        <DropdownMenuItem className="gap-2 font-bold text-amber-600" onClick={() => handleRegister(item)}>
                          <Settings2 className="w-4 h-4" /> 分別作業を開始
                        </DropdownMenuItem>
                      )}
                      {(item.status === 'unregistered' || item.status === 'in_production' || item.status === 'pending_productization') && (
                        <DropdownMenuItem className="gap-2 font-bold text-blue-600" onClick={() => handleRegister(item)}>
                          <CheckCircle2 className="w-4 h-4" /> 商品化作業を行う
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem className="gap-2" onClick={() => setSelectedItem(item)}>
                        <ExternalLink className="w-4 h-4" /> 詳細を見る
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2 text-blue-600" onClick={() => handlePrintLabel(item)}>
                        <QrCode className="w-4 h-4" /> ラベル印刷
                      </DropdownMenuItem>
                      {role === 'admin' && (
                        <DropdownMenuItem className="gap-2 text-red-600">
                          削除
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Label Preview Modal */}
      {/* Productization Modal */}
      <Dialog open={isProductizationModalOpen} onOpenChange={setIsProductizationModalOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <DialogHeader className="p-6 bg-slate-50 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-blue-600" />
              {selectedItem?.status === 'pending_sorting' ? '分別作業' : '商品化作業'} - {selectedItem?.managementNumber}
            </DialogTitle>
          </DialogHeader>

          <div className="p-0 flex flex-col md:flex-row h-[600px]">
            {/* Sidebar Steps */}
            <div className="w-full md:w-64 bg-slate-50 border-r p-6 space-y-6">
              {[
                { step: 1, label: selectedItem?.status === 'pending_sorting' ? '分別カテゴリ選択' : 'クリーニング' },
                { step: 2, label: '点検・動作確認' },
                { step: 3, label: '状態ランク・価格設定' },
                { step: 4, label: '商品撮影' },
                { step: 5, label: '梱包・棚割り当て' }
              ].map((s) => (
                <div key={s.step} className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                    productizationStep === s.step ? "bg-blue-600 text-white" : 
                    productizationStep > s.step ? "bg-emerald-100 text-emerald-600" : "bg-slate-200 text-slate-500"
                  )}>
                    {productizationStep > s.step ? <CheckCircle2 className="w-4 h-4" /> : s.step}
                  </div>
                  <span className={cn(
                    "text-sm font-medium",
                    productizationStep === s.step ? "text-blue-600" : "text-slate-500"
                  )}>{s.label}</span>
                </div>
              ))}
            </div>

            {/* Step Content */}
            <div className="flex-1 p-8 overflow-y-auto">
              {productizationStep === 1 && (
                <div className="space-y-6">
                  {selectedItem?.status === 'pending_sorting' ? (
                    <>
                      <h3 className="text-lg font-bold">分別カテゴリを選択してください</h3>
                      <div className="grid grid-cols-1 gap-4">
                        {[
                          { id: 'reuse', label: 'リユース (商品化へ)', icon: ShoppingBag, color: 'text-blue-600 bg-blue-50' },
                          { id: 'recycle', label: '資源 (リサイクル業者へ)', icon: Truck, color: 'text-emerald-600 bg-emerald-50' },
                          { id: 'rebuilt', label: 'リビルド (再生業者へ)', icon: Settings2, color: 'text-purple-600 bg-purple-50' }
                        ].map((cat) => (
                          <button
                            key={cat.id}
                            onClick={() => setProductizationData({...productizationData, sortingCategory: cat.id as any})}
                            className={cn(
                              "flex items-center gap-4 p-5 rounded-xl border-2 transition-all text-left",
                              productizationData.sortingCategory === cat.id ? "border-blue-600 bg-blue-50/50" : "border-slate-100 hover:border-slate-200"
                            )}
                          >
                            <div className={cn("p-3 rounded-lg", cat.color)}>
                              <cat.icon className="w-6 h-6" />
                            </div>
                            <div>
                              <p className="font-bold">{cat.label}</p>
                              <p className="text-xs text-slate-500">
                                {cat.id === 'reuse' ? '国内・海外販売向けに清掃・点検を行います' : 
                                 cat.id === 'recycle' ? '素材ごとに分類し、量り売りで収益化します' : 'コアパーツとして再生業者に売却します'}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <h3 className="text-lg font-bold">クリーニングを完了しましたか？</h3>
                      <div className="flex items-center gap-4 p-6 bg-slate-50 rounded-xl border border-slate-100">
                        <input
                          type="checkbox"
                          id="cleaning"
                          checked={productizationData.cleaningDone}
                          onChange={(e) => setProductizationData({...productizationData, cleaningDone: e.target.checked})}
                          className="w-5 h-5"
                        />
                        <Label htmlFor="cleaning" className="text-base cursor-pointer font-medium">
                          クリーニング・清掃作業を完了した
                        </Label>
                      </div>
                    </>
                  )}
                </div>
              )}

              {productizationStep === 2 && (
                <div className="space-y-6">
                  <h3 className="text-lg font-bold">点検・動作確認項目</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <input
                        type="checkbox"
                        id="inspected"
                        checked={productizationData.inspected}
                        onChange={(e) => setProductizationData({...productizationData, inspected: e.target.checked})}
                        className="w-5 h-5"
                      />
                      <Label htmlFor="inspected" className="text-sm cursor-pointer font-medium">動作に不具合がないことを確認した</Label>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 border rounded-lg space-y-2">
                        <p className="text-[10px] font-bold text-slate-400">主要部品の状態</p>
                        <Select>
                          <SelectTrigger className="bg-white"><SelectValue placeholder="選択してください" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="good">良好</SelectItem>
                            <SelectItem value="fair">普通</SelectItem>
                            <SelectItem value="needs_care">要修理</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="p-4 border rounded-lg space-y-2">
                        <p className="text-[10px] font-bold text-slate-400">サビ・腐食</p>
                        <Select>
                          <SelectTrigger className="bg-white"><SelectValue placeholder="選択してください" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">なし</SelectItem>
                            <SelectItem value="minor">少々あり</SelectItem>
                            <SelectItem value="major">激しい</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {productizationStep === 3 && (
                <div className="space-y-6">
                  <h3 className="text-lg font-bold">品質ランクと価格設定</h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>品質ランク</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {['S', 'A', 'B', 'C', 'D', 'J'].map((r) => (
                          <Button
                            key={r}
                            variant={productizationData.rank === r ? 'default' : 'outline'}
                            onClick={() => setProductizationData({...productizationData, rank: r as any})}
                            className="h-12 font-bold"
                          >
                            {r}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>中古販売予定価格 (税込)</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">¥</span>
                          <Input type="number" className="pl-8" placeholder="0" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>送料目安</Label>
                        <Select>
                          <SelectTrigger><SelectValue placeholder="サイズを選択" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="s">Sサイズ (¥800)</SelectItem>
                            <SelectItem value="m">Mサイズ (¥1,500)</SelectItem>
                            <SelectItem value="l">Lサイズ (¥3,000)</SelectItem>
                            <SelectItem value="fixed">一律 (¥1,000)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {productizationStep === 4 && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold">商品撮影 (3枚以上必須)</h3>
                    <Button variant="outline" className="gap-2">
                      <ImageIcon className="w-4 h-4" /> カメラを起動
                    </Button>
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="aspect-square border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-slate-400 hover:bg-slate-50 cursor-pointer">
                      <Plus className="w-6 h-6" />
                      <span className="text-[10px] font-bold">正面</span>
                    </div>
                    <div className="aspect-square border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-slate-400 hover:bg-slate-50 cursor-pointer">
                      <Plus className="w-6 h-6" />
                      <span className="text-[10px] font-bold">裏面</span>
                    </div>
                    <div className="aspect-square border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-slate-400 hover:bg-slate-50 cursor-pointer">
                      <Plus className="w-6 h-6" />
                      <span className="text-[10px] font-bold">シリアル</span>
                    </div>
                    <div className="aspect-square border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-slate-400 hover:bg-slate-50 cursor-pointer">
                      <Plus className="w-6 h-6" />
                      <span className="text-[10px] font-bold">その他</span>
                    </div>
                  </div>
                </div>
              )}

              {productizationStep === 5 && (
                <div className="space-y-6">
                  <h3 className="text-lg font-bold">最終確認と保管場所の指定</h3>
                  <div className="space-y-6">
                    <div className="p-4 bg-slate-50 rounded-xl space-y-4">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-blue-600" />
                        <span className="font-bold text-sm">梱包情報を入力</span>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <Input placeholder="幅 (cm)" type="number" />
                        <Input placeholder="奥行 (cm)" type="number" />
                        <Input placeholder="高さ (cm)" type="number" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>保管棚番号 (スキャンまたは選択)</Label>
                      <div className="flex gap-2">
                        <Input 
                          placeholder="A-1-4" 
                          value={productizationData.shelf} 
                          onChange={(e) => setProductizationData({...productizationData, shelf: e.target.value})}
                        />
                        <Button variant="outline" className="gap-2">
                          <QrCodeIcon className="w-4 h-4" /> スキャン
                        </Button>
                      </div>
                    </div>

                    <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                      <p className="text-xs text-amber-700 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        作業完了後、自動的にBANANA BAYへ出品リクエストが送信されます。
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="p-6 bg-slate-50 border-t">
            <Button variant="outline" onClick={() => setIsProductizationModalOpen(false)}>一時保存して閉じる</Button>
            <div className="flex gap-2">
              {productizationStep > 1 && (
                <Button variant="outline" onClick={() => setProductizationStep(prev => prev - 1)}>戻る</Button>
              )}
              {productizationStep < 5 ? (
                <Button onClick={() => setProductizationStep(prev => prev + 1)}>次へ進む</Button>
              ) : (
                <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleProductizationComplete}>
                  作業完了・BANANA BAYへ出品
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isLabelPreviewOpen} onOpenChange={setIsLabelPreviewOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-slate-100">
          <DialogHeader className="p-6 bg-white border-b">
            <DialogTitle className="flex items-center gap-2">
              <QrCodeIcon className="w-5 h-5 text-blue-600" />
              商品ラベルプレビュー
            </DialogTitle>
          </DialogHeader>
          
          <div className="p-10 flex justify-center">
            {selectedItem && (
              <div className="w-[300px] bg-white p-6 rounded shadow-lg border-2 border-black flex flex-col items-center gap-4 font-mono">
                <div className="w-full border-b-2 border-black pb-2 mb-2 text-center">
                  <p className="text-xs font-bold uppercase tracking-tighter">Sustainable Garage</p>
                </div>
                
                <div className="w-40 h-40 bg-slate-100 flex items-center justify-center border-2 border-slate-200 relative">
                  <QrCodeIcon className="w-32 h-32 text-black" />
                  <div className="absolute bottom-1 right-1 bg-white px-1 text-[8px] border border-black font-bold">
                    {selectedItem.managementNumber.split('-').pop()}
                  </div>
                </div>
                
                <div className="w-full space-y-1 text-center">
                  <p className="text-sm font-bold truncate">{selectedItem.name}</p>
                  <p className="text-[10px] font-medium text-slate-600">{selectedItem.partNumber || 'No Part Number'}</p>
                </div>
                
                <div className="w-full grid grid-cols-2 gap-2 mt-2 pt-2 border-t-2 border-dashed border-slate-300">
                  <div className="text-center">
                    <p className="text-[8px] text-slate-400">棚番</p>
                    <p className="text-xs font-bold">{selectedItem.location || '-'}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[8px] text-slate-400">拠点</p>
                    <p className="text-xs font-bold">{selectedItem.baseName || '-'}</p>
                  </div>
                </div>
                
                <div className="mt-4 text-[10px] font-bold bg-black text-white px-4 py-1 rounded-full">
                  {selectedItem.managementNumber}
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter className="p-6 bg-white border-t gap-2">
            <Button variant="outline" onClick={() => setIsLabelPreviewOpen(false)}>閉じる</Button>
            <Button className="bg-blue-600 hover:bg-blue-700 gap-2" onClick={() => {
              toast.success('印刷ジョブを送信しました');
              setIsLabelPreviewOpen(false);
            }}>
              <Printer className="w-4 h-4" /> ラベルを印刷
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail View Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl bg-white shadow-2xl border-none">
            <CardHeader className="flex flex-row items-center justify-between border-b bg-slate-50">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <QrCodeIcon className="w-5 h-5 text-blue-600" />
                  {selectedItem.managementNumber}
                </CardTitle>
                <p className="text-sm text-slate-500">{selectedItem.name}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedItem(null)}>
                <X className="w-5 h-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase">基本情報</h4>
                    <div className="mt-2 space-y-2">
                      <p className="text-sm flex justify-between">
                        <span className="text-slate-500">部品番号:</span>
                        <span className="font-mono font-bold">{selectedItem.partNumber || '未入力'}</span>
                      </p>
                      <p className="text-sm flex justify-between">
                        <span className="text-slate-500">パーツカテゴリ:</span>
                        <span className="font-bold">{selectedItem.partCategory || '-'}</span>
                      </p>
                      <p className="text-sm flex justify-between">
                        <span className="text-slate-500">メーカー:</span>
                        <span className="font-bold">{selectedItem.carMaker || '-'}</span>
                      </p>
                      <p className="text-sm flex justify-between">
                        <span className="text-slate-500">車種名:</span>
                        <span className="font-bold">{selectedItem.carName || '-'}</span>
                      </p>
                      <p className="text-sm flex justify-between">
                        <span className="text-slate-500">型式:</span>
                        <span className="font-mono">{selectedItem.carModelNumber || '-'}</span>
                      </p>
                      <p className="text-sm flex justify-between">
                        <span className="text-slate-500">年式:</span>
                        <span>{selectedItem.carYear || '-'}</span>
                      </p>
                      <p className="text-sm flex justify-between">
                        <span className="text-slate-500">カテゴリ:</span>
                        <span>{selectedItem.category}</span>
                      </p>
                      <p className="text-sm flex justify-between">
                        <span className="text-slate-500">ステータス:</span>
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100">
                          {STATUS_LABELS[selectedItem.status]}
                        </Badge>
                      </p>
                      <p className="text-sm flex justify-between">
                        <span className="text-slate-500">BANANA BAY:</span>
                        <span className={cn(
                          "text-xs font-bold",
                          selectedItem.bananaBayStatus === 'listed' ? "text-green-600" :
                          selectedItem.bananaBayStatus === 'error' ? "text-red-600" :
                          "text-slate-500"
                        )}>
                          {BANANA_BAY_STATUS_LABELS[selectedItem.bananaBayStatus || 'not_listed']}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase">車両・状態詳細</h4>
                    <div className="mt-2 space-y-2">
                      <p className="text-sm flex justify-between">
                        <span className="text-slate-500">状態:</span>
                        <span>{selectedItem.condition || '-'}</span>
                      </p>
                      <p className="text-sm flex justify-between">
                        <span className="text-slate-500">走行距離:</span>
                        <span>{selectedItem.mileage || '-'}</span>
                      </p>
                      <p className="text-sm flex justify-between">
                        <span className="text-slate-500">エンジン型式:</span>
                        <span>{selectedItem.engineType || '-'}</span>
                      </p>
                      <p className="text-sm flex justify-between">
                        <span className="text-slate-500">カラー:</span>
                        <span>{selectedItem.color || '-'}</span>
                      </p>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase">価格・物流</h4>
                    <div className="mt-2 space-y-2">
                      <p className="text-sm flex justify-between">
                        <span className="text-slate-500">中古販売価格:</span>
                        <span className="font-bold text-blue-600">¥{selectedItem.price?.toLocaleString() || '-'}</span>
                      </p>
                      <p className="text-sm flex justify-between">
                        <span className="text-slate-500">新品参考価格:</span>
                        <span>¥{selectedItem.newPrice?.toLocaleString() || '-'}</span>
                      </p>
                      <p className="text-sm flex justify-between">
                        <span className="text-slate-500">送料区分:</span>
                        <span className="flex items-center gap-1">
                          <Truck className="w-3 h-3" />
                          ¥{selectedItem.shippingFee?.toLocaleString() || '込'}
                        </span>
                      </p>
                      <p className="text-sm flex justify-between">
                        <span className="text-slate-500">棚割り番号:</span>
                        <span className="font-mono">{selectedItem.location || '-'}</span>
                      </p>
                      <p className="text-sm flex justify-between">
                        <span className="text-slate-500">拠点名:</span>
                        <span>{selectedItem.baseName || '-'}</span>
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase">添付画像 ({selectedItem.images?.length || 0})</h4>
                  <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-2">
                    {selectedItem.images?.map((img, idx) => (
                      <div key={idx} className="aspect-square rounded-lg overflow-hidden border border-slate-200">
                        <img src={img} alt="inventory" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                    ))}
                    {(!selectedItem.images || selectedItem.images.length === 0) && (
                      <div className="col-span-2 aspect-video bg-slate-50 rounded-lg flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200">
                        <ImageIcon className="w-8 h-8 mb-2 opacity-20" />
                        <p className="text-xs">画像がありません</p>
                      </div>
                    )}
                  </div>
                  <div className="pt-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase">備考</h4>
                    <div className="mt-2 p-3 bg-slate-50 rounded border text-sm text-slate-600 min-h-[100px]">
                      {selectedItem.notes || '備考なし'}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" className="gap-2" onClick={() => toast.success('ラベルを印刷しました')}>
                  <QrCodeIcon className="w-4 h-4" /> ラベル印刷
                </Button>
                {role === 'admin' && (
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                    データを編集する
                  </Button>
                )}
              </div>
            </CardContent>
            <CardFooter className="border-t bg-slate-50 p-4 flex justify-end gap-3">
              <Button variant="outline" className="gap-2" onClick={() => toast.success('ラベルを印刷しました')}>
                <QrCodeIcon className="w-4 h-4" /> ラベル印刷
              </Button>
              {role === 'admin' && (
                <Button className="bg-orange-500 hover:bg-orange-600 text-white gap-2 font-bold" onClick={() => toast.success('Banana Bayに出品しました')}>
                  <ShoppingBag className="w-4 h-4" /> Banana Bayに出品
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
