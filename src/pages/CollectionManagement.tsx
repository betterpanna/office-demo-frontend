import React, { useEffect, useState } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  FileText, 
  Printer, 
  CheckCircle2, 
  Clock, 
  MoreVertical,
  ChevronRight,
  Image as ImageIcon,
  Truck,
  Mail,
  CalendarDays,
  Building2,
  X,
  Package,
  Pencil,
  Trash2,
  Save
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
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MOCK_CATEGORIES, MOCK_USERS, MOCK_BRANCHES } from '@/src/mockData';
import {
  useCollections,
  addCollection,
  isPurchaseFinalized,
  updateCollection,
  updateCollectionItem,
} from '@/src/stores/collectionsStore';
import {
  useCustomers,
  addCustomer,
  updateCustomer,
  removeCustomer,
  nextCustomerId,
} from '@/src/stores/customersStore';
import { useReceipts } from '@/src/stores/receiptsStore';
import { Collection, CollectionStatus, CollectionItem, Customer, User, CollectionReceipt } from '@/src/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { Download } from 'lucide-react';

import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { format, subMonths } from 'date-fns';
import { ja } from 'date-fns/locale';
import { MonthlyPurchaseBilling } from './MonthlyPurchaseBilling';
import { useT } from '@/src/stores/i18nStore';

interface CollectionManagementProps {
  selectedBase?: string;
}

/**
 * 買取明細書プレビュー上で品目単価をインライン編集する入力コンポーネント。
 * - blur / Enter で onCommit(rawString) を発火
 * - 親側で 数値変換と updateCollectionItem への保存を行う
 */
function PurchasePriceInput({
  initialValue,
  quantity,
  onCommit,
}: {
  initialValue: number;
  quantity: number;
  onCommit: (raw: string) => void;
}) {
  const [val, setVal] = useState<string>(String(initialValue || ''));
  useEffect(() => {
    setVal(String(initialValue || ''));
  }, [initialValue]);
  const numericVal = Number(val) || 0;
  return (
    <div className="flex flex-col items-end gap-0.5">
      <div className="flex items-center gap-1">
        <span className="text-slate-400 text-[10px]">¥</span>
        <input
          type="text"
          inputMode="numeric"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={() => {
            if (Number(val) !== initialValue) onCommit(val);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          placeholder="0"
          className="w-20 text-right tabular-nums font-bold bg-amber-50 border border-amber-300 rounded px-1 py-0.5 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-300 text-[10px]"
        />
      </div>
      {quantity > 1 && (
        <span className="text-[9px] text-slate-400 tabular-nums">
          ×{quantity} = ¥{(numericVal * quantity).toLocaleString()}
        </span>
      )}
    </div>
  );
}

export function CollectionManagement({ selectedBase }: CollectionManagementProps) {
  const t = useT();
  const collections = useCollections();
  const customers = useCustomers();
  const receipts = useReceipts();

  // 電子受領書ビューア
  const [activeReceipt, setActiveReceipt] = useState<CollectionReceipt | null>(null);
  const [isReceiptListOpen, setIsReceiptListOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [selectedItem, setSelectedItem] = useState<CollectionItem | null>(null);
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');
  const [activeFilter, setActiveFilter] = useState<'all' | 'scheduled' | 'received' | 'unissued'>('all');
  
  // New Collection Registration State
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newCustomerType, setNewCustomerType] = useState<'existing' | 'new'>('existing');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerAddress, setNewCustomerAddress] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [collectionDate, setCollectionDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [collectionNotes, setCollectionNotes] = useState('');
  const [collectionItems, setCollectionItems] = useState<Partial<CollectionItem>[]>([]);
  const [newAssignedCollectorId, setNewAssignedCollectorId] = useState<string>('');
  
  // Document Preview State
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewDocType, setPreviewDocType] = useState<'receipt' | 'purchase_detail'>('receipt');
  const [previewCollectionId, setPreviewCollectionId] = useState<string | null>(null);
  // ストアから常に最新の Collection を取得する（インライン編集後の再描画用）
  const previewCollection = previewCollectionId
    ? collections.find((c) => c.id === previewCollectionId) || null
    : null;
  // 後方互換 setter — 旧コードが setPreviewCollection(col) を呼んでも動くようにする
  const setPreviewCollection = (col: Collection | null) => {
    setPreviewCollectionId(col?.id ?? null);
  };
  const [docSettings, setDocSettings] = useState({
    showLogo: true,
    includeTax: true,
    notes: '毎度ありがとうございます。上記正に受領いたしました。'
  });

  // 買取明細書のインライン価格編集モード
  const [editPriceMode, setEditPriceMode] = useState(false);
  // 買取明細書を未確定状態で開いた場合は自動的に編集モードを ON
  useEffect(() => {
    if (
      isPreviewModalOpen &&
      previewDocType === 'purchase_detail' &&
      previewCollection &&
      !isPurchaseFinalized(previewCollection)
    ) {
      setEditPriceMode(true);
    } else if (!isPreviewModalOpen) {
      setEditPriceMode(false);
    }
  }, [isPreviewModalOpen, previewDocType, previewCollection]);

  /** 買取明細書プレビュー上で品目の単価を編集 → ストアへ保存 */
  const handleUpdateItemPrice = (collectionId: string, itemId: string, raw: string) => {
    const numeric = Math.max(0, Math.round(Number(String(raw).replace(/[^0-9-]/g, '')) || 0));
    updateCollectionItem(collectionId, itemId, { finalPrice: numeric });
  };

  // 引取送料あり/なし & 取引先マスタ — 新規回収登録モーダル用
  const [newShippingFeeApplicable, setNewShippingFeeApplicable] = useState<boolean>(false);
  const [newShippingFeeAmount, setNewShippingFeeAmount] = useState<string>('');
  const [newCustomerEmail, setNewCustomerEmail] = useState<string>('');

  // 取引先マスタ管理モーダル
  // 取引先マスタは「従業員・マスタ管理」タブに移設済。
  // 新規回収登録モーダルの取引先選択 (selectedCustomerId) のみ参照。

  // 取引先マスタを表示用にコピー（拠点フィルタは住所/notesに含むかで簡易判定）
  const existingCustomers = customers;

  /** 取引先選択時に shippingFeeApplicable / defaultShippingFee / email を引き当て */
  const applyCustomerSelection = (customerId: string) => {
    setSelectedCustomerId(customerId);
    const c = customers.find((x) => x.id === customerId);
    if (!c) return;
    setNewShippingFeeApplicable(c.shippingFeeApplicable);
    setNewShippingFeeAmount(
      c.shippingFeeApplicable && c.defaultShippingFee
        ? c.defaultShippingFee.toString()
        : ''
    );
    setNewCustomerEmail(c.email || '');
    if (c.address) setNewCustomerAddress(c.address);
    if (c.phone) setNewCustomerPhone(c.phone);
  };

  // handleOpenCustomerForm / handleSaveCustomer / handleDeleteCustomer は
  // 従業員・マスタ管理 タブの CustomerMasterPanel に移設しました。

  const handleAddItem = () => {
    setCollectionItems([...collectionItems, { 
      id: `new-item-${Date.now()}`,
      name: '',
      category: MOCK_CATEGORIES[0]?.name || 'その他',
      quantity: 1,
      collectionType: 'paid',
      carMaker: '',
      carName: '',
      carModelNumber: '',
      partNumber: '',
      mileage: '',
      color: '',
      notes: ''
    }]);
  };

  const handleRemoveItem = (idx: number) => {
    setCollectionItems(collectionItems.filter((_, i) => i !== idx));
  };

  const handleUpdateItem = (idx: number, field: keyof CollectionItem, value: any) => {
    const newItems = [...collectionItems];
    newItems[idx] = { ...newItems[idx], [field]: value };
    setCollectionItems(newItems);
  };

  const handleSaveCollection = () => {
    if (newCustomerType === 'new' && !newCustomerName) {
      toast.error(t('col.errorCustomerName'));
      return;
    }
    if (newCustomerType === 'existing' && !selectedCustomerId) {
      toast.error(t('col.errorSelectCustomer'));
      return;
    }
    if (collectionItems.length === 0) {
      toast.error(t('col.errorItems'));
      return;
    }

    const masterCustomer = newCustomerType === 'existing'
      ? existingCustomers.find(c => c.id === selectedCustomerId)
      : undefined;
    const customerName = newCustomerType === 'new'
      ? newCustomerName
      : masterCustomer?.name || '';

    // 既存顧客が選ばれていれば、過去の住所/電話番号を引き継ぐ
    const existingMatch = newCustomerType === 'existing'
      ? collections.find(c => c.customerName === customerName)
      : undefined;

    // CollectionItem の必須項目を補完
    const items: CollectionItem[] = collectionItems.map((it, idx) => ({
      id: it.id || `new-item-${Date.now()}-${idx}`,
      name: it.name || '未入力品目',
      category: it.category || (MOCK_CATEGORIES[0]?.name || 'その他'),
      quantity: typeof it.quantity === 'number' && !isNaN(it.quantity) ? it.quantity : 1,
      weight: typeof it.weight === 'number' && !isNaN(it.weight) ? it.weight : undefined,
      vinNumber: it.vinNumber,
      collectionType: (it.collectionType as 'free' | 'paid') || 'paid',
      partNumber: it.partNumber,
      carMaker: it.carMaker,
      carName: it.carName,
      carModelNumber: it.carModelNumber,
      mileage: it.mileage,
      color: it.color,
      notes: it.notes,
      condition: it.condition || '未確認',
      estimatedPrice: it.estimatedPrice,
      finalPrice: it.finalPrice,
      newPrice: it.newPrice,
    }));

    const today = new Date();
    const dateKey = format(today, 'yyyyMMdd');
    const newId = `col-${Date.now()}`;
    const sequenceLabel = String(collections.filter(c => c.collectionDate === collectionDate).length + 1).padStart(3, '0');
    const collectionNumber = `C-${dateKey}-${sequenceLabel}`;

    const shippingFee = newShippingFeeApplicable && newShippingFeeAmount
      ? Number(newShippingFeeAmount)
      : undefined;

    const newCollection: Collection = {
      id: newId,
      collectionNumber,
      customerId: masterCustomer?.id,
      customerName,
      customerAddress: newCustomerType === 'new'
        ? newCustomerAddress
        : (masterCustomer?.address || existingMatch?.customerAddress || ''),
      customerPhone: newCustomerType === 'new'
        ? newCustomerPhone
        : (masterCustomer?.phone || existingMatch?.customerPhone || ''),
      customerEmail: newCustomerEmail || masterCustomer?.email || undefined,
      shippingFeeApplicable: newShippingFeeApplicable,
      shippingFeeAmount: shippingFee,
      status: 'pending',
      items,
      collectionDate,
      totalAmount: items.reduce((sum, it) => sum + ((it.finalPrice || 0) * it.quantity), 0),
      notes: collectionNotes,
      receiptIssued: false,
      purchaseDetailIssued: false,
      assignedCollectorId: newAssignedCollectorId || undefined,
    };

    addCollection(newCollection);

    toast.success(`${customerName} 様の${t('col.toastSuccess')}${newAssignedCollectorId ? '。回収員に指示を送信しました。' : ''}`);
    setIsNewModalOpen(false);
    // Reset state
    setCollectionItems([]);
    setNewCustomerName('');
    setNewCustomerAddress('');
    setNewCustomerPhone('');
    setSelectedCustomerId('');
    setCollectionDate(format(new Date(), 'yyyy-MM-dd'));
    setCollectionNotes('');
    setNewAssignedCollectorId('');
    setNewShippingFeeApplicable(false);
    setNewShippingFeeAmount('');
    setNewCustomerEmail('');
  };

  const handleDispatchCollection = (collectionId: string, collectorId: string) => {
    const collector = MOCK_USERS.find(u => u.id === collectorId);
    toast.success(`${collector?.name || '担当者'} さんに回収指示を送信しました`);
    // In real app, update assignedCollectorId in DB
  };

  // Email Modal State
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [previewCustomer, setPreviewCustomer] = useState<any>(null);

  // Filter logic
  const filteredCollections = collections.filter(collection => {
    // Base filter
    const matchesBase = !selectedBase || collection.customerAddress.includes(selectedBase);
    if (!matchesBase) return false;

    // Search term filter
    const matchesSearch = 
      collection.collectionNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      collection.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;

    // Status/Category filter
    if (activeFilter === 'scheduled') return collection.status === 'pending';
    if (activeFilter === 'received') return collection.status === 'received' || collection.status === 'completed';
    if (activeFilter === 'unissued') return !collection.purchaseDetailIssued && collection.status !== 'cancelled';
    
    return true;
  });

  const getStatusBadge = (status: CollectionStatus) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200">{t('col.statusPending')}</Badge>;
      case 'received':
        return <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">{t('col.statusReceived2')}</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200">{t('col.statusCompleted2')}</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">{t('col.statusCancelled')}</Badge>;
      default:
        return null;
    }
  };

  const handleIssueReceipt = (collection: Collection) => {
    setPreviewCollection(collection);
    setPreviewDocType('receipt');
    setDocSettings(prev => ({ ...prev, notes: '毎度ありがとうございます。上記正に受領いたしました。' }));
    setIsPreviewModalOpen(true);
  };

  const handleIssuePurchaseDetail = (collection: Collection) => {
    // 価格が未確定でもプレビューを開く（インライン編集で金額を直接入力可能）。
    // 発行ボタンは isPurchaseFinalized() を満たすまで disabled。
    if (!isPurchaseFinalized(collection)) {
      toast.info(t('col.toastUnpaid'), {
        description: t('col.toastEditPrice'),
      });
    }
    setPreviewCollection(collection);
    setPreviewDocType('purchase_detail');
    setDocSettings(prev => ({ ...prev, notes: '下記の通り、お買い取りさせていただきました。内容をご確認ください。' }));
    setIsPreviewModalOpen(true);
  };

  const handleExportExcel = () => {
    const exportData = collections.map(c => ({
      '回収番号': c.collectionNumber,
      '顧客名': c.customerName,
      '回収日': c.collectionDate,
      'ステータス': c.status,
      '品目数': c.items.length,
      '合計金額': c.totalAmount || 0,
      '受領書発行済': c.receiptIssued ? '○' : '×',
      '買取明細発行済': c.purchaseDetailIssued ? '○' : '×'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Collections");
    XLSX.writeFile(workbook, `Collection_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success(t('col.exportSuccess'));
  };

  const handleMarkAsCollected = (collection: Collection) => {
    toast.success(`${collection.collectionNumber} を回収完了として処理しました。受領書がリアルタイムで確認可能です。`);
    // In a real app, we would update the status to 'collected' and set receiptIssued to true
  };

  const handleLinkToInventory = (collection: Collection) => {
    toast.success(`${collection.items.length}件の品目を分別待ち（Awaiting Sorting）として在庫登録しました`);
  };

  const handleSendMonthlyEmail = (customerData: any) => {
    const lastMonth = subMonths(new Date(), 1);
    const monthLabel = format(lastMonth, 'yyyy年M月', { locale: ja });
    const hq = MOCK_BRANCHES[0]; // 先頭支店を本社窓口として扱う
    const subject = `【買取明細のご送付】株式会社サスティナブルガレージ（${monthLabel}分）`;
    const body = `${customerData.customerName} 様

いつも大変お世話になっております。
株式会社サスティナブルガレージ ${hq?.name ?? ''}でございます。

${monthLabel}分の買取明細が確定いたしましたので、
本メールにて送付させていただきます。

添付の明細書をご確認いただけますようお願い申し上げます。

■当月買取総額：¥${customerData.totalAmount.toLocaleString()}
■回収件数：${customerData.collections.length}件

内容にご不明な点がございましたら、
お手数ですが弊社担当までご連絡ください。

今後とも何卒よろしくお願い申し上げます。

--------------------------------------------------
株式会社サスティナブルガレージ ${hq?.name ?? ''}
住所：${hq?.address ?? ''}
電話：${hq?.phone ?? ''}
メール：${hq?.email ?? 'info@example.com'}
--------------------------------------------------`;
    
    setPreviewCustomer(customerData);
    setEmailSubject(subject);
    setEmailBody(body);
    setIsEmailModalOpen(true);
  };

  const confirmSendEmail = () => {
    toast.success(`${previewCustomer.customerName} 様へ買取明細メールを送付しました`);
    setIsEmailModalOpen(false);
  };

  const handleMonthlyClosing = () => {
    toast.success('月末締め処理を完了しました。各社への明細送付準備が整いました。');
  };

  // Group collections by customer for monthly view
  const monthlyData = collections.reduce((acc, curr) => {
    if (!acc[curr.customerName]) {
      acc[curr.customerName] = {
        customerName: curr.customerName,
        collections: [],
        totalAmount: 0,
        itemCount: 0
      };
    }
    acc[curr.customerName].collections.push(curr);
    acc[curr.customerName].totalAmount += curr.totalAmount || 0;
    acc[curr.customerName].itemCount += curr.items.length;
    return acc;
  }, {} as Record<string, any>);

  return (
    <div className="space-y-6">
      {/* View Switcher */}
      <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg w-fit">
        <Button 
          variant={viewMode === 'daily' ? 'default' : 'ghost'} 
          size="sm" 
          onClick={() => setViewMode('daily')}
          className="rounded-md h-8 px-4"
        >
          {t('col.viewDaily')}
        </Button>
        <Button
          variant={viewMode === 'monthly' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setViewMode('monthly')}
          className="rounded-md h-8 px-4"
        >
          {t('col.viewMonthly')}
        </Button>
      </div>

      {viewMode === 'daily' ? (
      <>
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          className={cn(
            "border-[#e2e8f0] shadow-none cursor-pointer transition-all hover:border-blue-300 hover:shadow-sm",
            activeFilter === 'scheduled' && "border-blue-500 ring-1 ring-blue-500 bg-blue-50/30"
          )}
          onClick={() => setActiveFilter(activeFilter === 'scheduled' ? 'all' : 'scheduled')}
        >
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-blue-50 rounded-lg text-[#2563eb]">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-[#64748b] font-medium uppercase">{t('col.todayScheduled')}</p>
              <h3 className="text-xl font-bold">
                {collections.filter(c => c.status === 'pending').length} {t('col.cases')}
              </h3>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={cn(
            "border-[#e2e8f0] shadow-none cursor-pointer transition-all hover:border-emerald-300 hover:shadow-sm",
            activeFilter === 'received' && "border-emerald-500 ring-1 ring-emerald-500 bg-emerald-50/30"
          )}
          onClick={() => setActiveFilter(activeFilter === 'received' ? 'all' : 'received')}
        >
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-emerald-50 rounded-lg text-[#10b981]">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-[#64748b] font-medium uppercase">{t('col.thisMonthReceived')}</p>
              <h3 className="text-xl font-bold">
                {collections.filter(c => c.status === 'received' || c.status === 'completed').length} {t('col.cases')}
              </h3>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={cn(
            "border-[#e2e8f0] shadow-none cursor-pointer transition-all hover:border-amber-300 hover:shadow-sm",
            activeFilter === 'unissued' && "border-amber-500 ring-1 ring-amber-500 bg-amber-50/30"
          )}
          onClick={() => setActiveFilter(activeFilter === 'unissued' ? 'all' : 'unissued')}
        >
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-amber-50 rounded-lg text-[#f59e0b]">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-[#64748b] font-medium uppercase">{t('col.unissued')}</p>
              <h3 className="text-xl font-bold">
                {collections.filter(c => !c.purchaseDetailIssued && c.status !== 'cancelled').length} {t('col.cases')}
              </h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-lg border border-[#e2e8f0]">
        <div className="flex flex-col gap-2 w-full sm:w-96">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b]" />
            <Input
              placeholder={t('col.search')}
              className="pl-10 bg-[#f8fafc] border-[#e2e8f0] rounded h-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {activeFilter !== 'all' && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px] gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 hover:bg-blue-200 border-none">
                {t('col.filtering')}: {
                  activeFilter === 'scheduled' ? t('col.filterScheduled') :
                  activeFilter === 'received' ? t('col.filterReceived') : t('col.filterUnissued')
                }
                <X className="w-3 h-3 cursor-pointer" onClick={() => setActiveFilter('all')} />
              </Badge>
              <button
                onClick={() => setActiveFilter('all')}
                className="text-[10px] text-slate-400 hover:text-slate-600 underline"
              >
                {t('col.clear')}
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {viewMode === 'monthly' && (
            <Button onClick={handleMonthlyClosing} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-10 px-4">
              <CalendarDays className="w-4 h-4" /> {t('col.bulkMonthClose')}
            </Button>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 sm:flex-none gap-2 h-10 px-4 border-[#e2e8f0]"
            onClick={handleExportExcel}
          >
            <Download className="w-4 h-4" /> {t('col.exportExcel')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 sm:flex-none gap-2 h-10 px-4 border-[#e2e8f0]"
            onClick={() => setIsReceiptListOpen(true)}
          >
            <FileText className="w-4 h-4" /> {t('col.eReceipt')} ({receipts.length})
          </Button>
          <Button variant="outline" size="sm" className="flex-1 sm:flex-none gap-2 h-10 px-4 border-[#e2e8f0]">
            <Filter className="w-4 h-4" /> {t('col.filterBtn')}
          </Button>
          <Button 
            size="sm" 
            className="flex-1 sm:flex-none gap-2 bg-[#2563eb] hover:bg-[#1e40af] text-white h-10 px-4"
            onClick={() => {
              setCollectionItems([{ 
                id: `new-item-${Date.now()}`,
                name: '',
                category: MOCK_CATEGORIES[0]?.name || 'その他',
                quantity: 1,
                collectionType: 'paid'
              }]);
              setIsNewModalOpen(true);
            }}
          >
            <Plus className="w-4 h-4" /> {t('col.newCollection')}
          </Button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-lg border border-[#e2e8f0] overflow-hidden">
          <Table>
            <TableHeader className="bg-[#f8fafc]">
              <TableRow className="hover:bg-transparent border-b border-[#e2e8f0]">
                <TableHead className="w-[180px] text-[12px] text-[#64748b] uppercase font-bold px-5">{t('col.collectionNo')}</TableHead>
                <TableHead className="text-[12px] text-[#64748b] uppercase font-bold px-5">{t('col.customerNameCol')}</TableHead>
                <TableHead className="text-[12px] text-[#64748b] uppercase font-bold px-5">{t('col.collectionDate')}</TableHead>
                <TableHead className="text-[12px] text-[#64748b] uppercase font-bold px-5">{t('col.assignedCollector')}</TableHead>
                <TableHead className="text-[12px] text-[#64748b] uppercase font-bold px-5">{t('col.statusHeader')}</TableHead>
                <TableHead className="text-[12px] text-[#64748b] uppercase font-bold px-5">{t('col.eReceipt')}</TableHead>
                <TableHead className="text-right text-[12px] text-[#64748b] uppercase font-bold px-5">{t('col.amount')}</TableHead>
                <TableHead className="w-[50px] px-5"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCollections.map((collection) => {
                const assignedCollector = MOCK_USERS.find(u => u.id === collection.assignedCollectorId);
                const collectionReceipts = receipts.filter(r => r.collectionId === collection.id);
                const hasElectronicReceipt = collectionReceipts.length > 0;
                return (
                  <TableRow key={collection.id} className="hover:bg-[#f8fafc] transition-colors border-b border-[#e2e8f0] last:border-0">
                    <TableCell className="font-mono text-xs font-bold text-[#2563eb] px-5">
                      {collection.collectionNumber}
                    </TableCell>
                    <TableCell className="font-medium text-[#1e293b] px-5">{collection.customerName}</TableCell>
                    <TableCell className="text-[#64748b] text-sm px-5">{collection.collectionDate}</TableCell>
                    <TableCell className="px-5">
                      {assignedCollector ? (
                        <div className="flex items-center gap-2">
                           <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center text-[10px] font-bold text-blue-600">
                              {assignedCollector.name.charAt(0)}
                           </div>
                           <span className="text-xs font-bold text-slate-700">{assignedCollector.name}</span>
                        </div>
                      ) : (
                        <Badge variant="outline" className="bg-slate-50 text-slate-400 border-dashed text-[10px]">未割当</Badge>
                      )}
                    </TableCell>
                    <TableCell className="px-5">{getStatusBadge(collection.status)}</TableCell>
                  <TableCell className="px-5">
                    <div className="flex gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] px-1.5 py-0 cursor-pointer transition-colors",
                          collection.receiptIssued
                            ? "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100"
                            : "bg-slate-50 text-slate-400 border-slate-100 opacity-50"
                        )}
                        onClick={() => collection.receiptIssued && handleIssueReceipt(collection)}
                      >
                        受領書
                      </Badge>
                      {hasElectronicReceipt && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 cursor-pointer bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 flex items-center gap-1"
                          onClick={() => setActiveReceipt(collectionReceipts[0])}
                          title={`電子受領書 ${collectionReceipts.length} 件`}
                        >
                          📱 電子 {collectionReceipts.length > 1 ? `×${collectionReceipts.length}` : ''}
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] px-1.5 py-0 cursor-pointer transition-colors flex items-center gap-1",
                          collection.purchaseDetailIssued
                            ? "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100"
                            : isPurchaseFinalized(collection)
                              ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                              : "bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100"
                        )}
                        onClick={() => {
                          // 価格未確定でもプレビュー (インライン編集モード) を開く
                          handleIssuePurchaseDetail(collection);
                        }}
                        title={
                          collection.purchaseDetailIssued
                            ? '発行済み'
                            : isPurchaseFinalized(collection)
                              ? '発行可能'
                              : '価格未確定 — クリックでインライン編集'
                        }
                      >
                        買取明細
                        {!collection.purchaseDetailIssued && !isPurchaseFinalized(collection) && (
                          <Pencil className="w-2.5 h-2.5" />
                        )}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-bold text-[#1e293b] px-5">
                    {collection.totalAmount ? `¥${collection.totalAmount.toLocaleString()}` : '-'}
                  </TableCell>
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
                          <DropdownMenuItem className="gap-2" onClick={() => setSelectedCollection(collection)}>
                            <ChevronRight className="w-4 h-4" /> 詳細表示
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 text-emerald-600" onClick={() => handleMarkAsCollected(collection)}>
                            <CheckCircle2 className="w-4 h-4" /> 回収完了にする（受領書発行）
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2" onClick={() => handleIssueReceipt(collection)}>
                            <Printer className="w-4 h-4" /> 受領書プレビュー
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2" onClick={() => handleIssuePurchaseDetail(collection)}>
                            <Printer className="w-4 h-4" /> 買取明細発行（在庫連動）
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </>
      ) : (
        <MonthlyPurchaseBilling selectedBase={selectedBase} />
      )}

      {/* Email Preview Modal */}
      <Dialog open={isEmailModalOpen} onOpenChange={setIsEmailModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-600" />
              メール送付の確認
            </DialogTitle>
            <DialogDescription>
              送付内容を確認し、必要に応じて修正してください。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="to">宛先</Label>
              <Input id="to" value={previewCustomer ? `${previewCustomer.customerName} 御中` : ''} disabled className="bg-slate-50" />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="subject">件名</Label>
              <Input 
                id="subject" 
                value={emailSubject} 
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="件名を入力してください"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="body">本文</Label>
              <Textarea 
                id="body" 
                value={emailBody} 
                onChange={(e) => setEmailBody(e.target.value)}
                rows={15}
                className="resize-none font-sans text-sm leading-relaxed"
              />
            </div>

            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs text-blue-700 flex items-center gap-2">
                <FileText className="w-3 h-3" />
                PDF形式の買取明細書が自動的に添付されます。
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsEmailModalOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={confirmSendEmail} className="bg-blue-600 hover:bg-blue-700">
              この内容で送付する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Preview Modal */}
      <Dialog open={isPreviewModalOpen} onOpenChange={setIsPreviewModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[95vw] md:max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-blue-600" />
              {previewDocType === 'receipt' ? t('col.receiptPreview') : t('col.purchaseDetailPreview')}
            </DialogTitle>
            <DialogDescription>
              発行内容を確認し、設定を調整してください。
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 py-4">
            {/* Settings Panel */}
            <div className="space-y-6 lg:col-span-1 bg-slate-50 p-4 rounded-lg border border-slate-200">
              <h3 className="text-sm font-bold text-slate-700 border-b pb-2">発行設定</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-logo" className="cursor-pointer">会社ロゴを表示</Label>
                  <input 
                    type="checkbox" 
                    id="show-logo" 
                    checked={docSettings.showLogo}
                    onChange={(e) => setDocSettings({...docSettings, showLogo: e.target.checked})}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="include-tax" className="cursor-pointer">消費税を表示</Label>
                  <input 
                    type="checkbox" 
                    id="include-tax" 
                    checked={docSettings.includeTax}
                    onChange={(e) => setDocSettings({...docSettings, includeTax: e.target.checked})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="doc-notes">備考・メッセージ</Label>
                  <Textarea 
                    id="doc-notes" 
                    value={docSettings.notes}
                    onChange={(e) => setDocSettings({...docSettings, notes: e.target.value})}
                    rows={4}
                    className="text-xs bg-white"
                  />
                </div>
              </div>

              <div className="pt-4 border-t">
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  ※プレビューは画面表示用です。印刷時はA4縦サイズに最適化されます。
                </p>
              </div>
            </div>

            {/* Preview Panel */}
            <div className="lg:col-span-2 bg-white border shadow-sm rounded-lg p-4 sm:p-8 min-h-[500px] sm:min-h-[600px] font-sans overflow-x-auto">
              <div className="min-w-[300px] sm:min-w-0">
                {previewCollection && (
                  <div className="space-y-6 sm:space-y-8">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                      <div>
                        {docSettings.showLogo && (
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-600 rounded flex items-center justify-center mb-3 sm:mb-4">
                            <Package className="text-white w-6 h-6 sm:w-8 sm:h-8" />
                          </div>
                        )}
                        <h2 className="text-xl sm:text-2xl font-bold tracking-widest">
                          {previewDocType === 'receipt' ? '受領書' : '買取明細書'}
                        </h2>
                      </div>
                      <div className="text-left sm:text-right text-[10px] sm:text-sm space-y-0.5 sm:space-y-1 w-full sm:w-auto">
                        <p>No: {previewCollection.collectionNumber}</p>
                        <p>日付: {previewCollection.collectionDate}</p>
                      </div>
                    </div>

                    {/* Customer Info */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end border-b-2 border-black pb-2 gap-4">
                      <div className="space-y-1 w-full sm:w-auto">
                        <p className="text-base sm:text-lg font-bold underline underline-offset-4 decoration-1">
                          {previewCollection.customerName} 御中
                        </p>
                      </div>
                      <div className="text-left sm:text-right text-[9px] sm:text-xs space-y-0.5 sm:space-y-1 w-full sm:w-auto">
                        <p className="font-bold">株式会社サスティナブルガレージ {MOCK_BRANCHES[0]?.name ?? ''}</p>
                        <p>{MOCK_BRANCHES[0]?.address ?? ''}</p>
                        <p>TEL: {MOCK_BRANCHES[0]?.phone ?? ''}</p>
                        {MOCK_BRANCHES[0]?.email && <p>Email: {MOCK_BRANCHES[0].email}</p>}
                      </div>
                    </div>

                  {/* 買取明細書のみ金額を表示。受領書には金額を載せない */}
                  {previewDocType !== 'receipt' && (
                    <div className="bg-slate-50 p-4 border flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">お買取合計金額</span>
                        {!isPurchaseFinalized(previewCollection) && (
                          <Badge className="bg-amber-100 text-amber-700 border border-amber-300 text-[10px] font-bold">
                            未確定金額あり
                          </Badge>
                        )}
                        <Button
                          variant={editPriceMode ? 'default' : 'outline'}
                          size="sm"
                          className={cn(
                            'h-7 px-2 text-[11px] gap-1 no-print',
                            editPriceMode && 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500',
                          )}
                          onClick={() => setEditPriceMode((v) => !v)}
                        >
                          {editPriceMode ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" /> 編集確定
                            </>
                          ) : (
                            <>
                              <Pencil className="w-3.5 h-3.5" /> 価格を編集
                            </>
                          )}
                        </Button>
                      </div>
                      <span className="text-2xl font-bold">
                        ¥{(previewCollection.totalAmount || 0).toLocaleString()}-
                      </span>
                    </div>
                  )}
                  {previewDocType === 'receipt' && (
                    <div className="bg-slate-50 p-4 border flex justify-between items-center">
                      <span className="text-sm font-bold">合計品目数</span>
                      <span className="text-lg font-bold">
                        {previewCollection.items.length} 点
                        <span className="ml-3 text-sm font-normal text-slate-500">
                          (合計重量 {previewCollection.items.reduce((sum, it) => sum + (it.weight || 0), 0).toLocaleString()} kg)
                        </span>
                      </span>
                    </div>
                  )}

                  {/* Items Table */}
                  <div className="border overflow-hidden rounded-sm mb-6">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow className="h-8">
                          <TableHead className="text-[10px] h-8 border-r px-2 min-w-[110px]">商品名</TableHead>
                          <TableHead className="text-[10px] h-8 border-r text-right w-12 px-2">数量</TableHead>
                          <TableHead className="text-[10px] h-8 border-r text-right w-16 px-2">重量Kg</TableHead>
                          <TableHead className="text-[10px] h-8 border-r px-2 w-28">車体番号</TableHead>
                          <TableHead className="text-[10px] h-8 border-r px-2 w-24">部品番号</TableHead>
                          <TableHead className="text-[10px] h-8 border-r px-2 w-24">車種</TableHead>
                          <TableHead className="text-[10px] h-8 border-r px-2 w-20">型番</TableHead>
                          <TableHead className="text-[10px] h-8 border-r px-2">備考</TableHead>
                          {previewDocType !== 'receipt' && (
                            <TableHead className="text-[10px] h-8 text-right w-20 px-2">小計</TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                          <TableBody>
                            {previewCollection.items.map((item, idx) => (
                              <TableRow key={idx} className="h-auto border-b">
                                <TableCell className="text-[10px] py-2 border-r px-2 font-bold">
                                  {item.name}
                                </TableCell>
                                <TableCell className="text-[10px] py-2 border-r text-right w-12 px-2">{item.quantity}</TableCell>
                                <TableCell className="text-[10px] py-2 border-r text-right w-16 px-2">
                                  {item.weight ? item.weight.toLocaleString() : '-'}
                                </TableCell>
                                <TableCell className="text-[10px] py-2 border-r px-2 font-mono w-28 truncate">
                                  {item.vinNumber || '-'}
                                </TableCell>
                                <TableCell className="text-[10px] py-2 border-r px-2 font-mono w-24 truncate">
                                  {item.partNumber || '-'}
                                </TableCell>
                                <TableCell className="text-[10px] py-2 border-r px-2 w-24 truncate">
                                  {item.carMaker && item.carName ? `${item.carMaker} ${item.carName}` : (item.carName || item.carModel || '-')}
                                </TableCell>
                                <TableCell className="text-[10px] py-2 border-r px-2 font-mono w-20 truncate">
                                  {item.carModelNumber || '-'}
                                </TableCell>
                                <TableCell className="text-[10px] py-2 border-r px-2 truncate max-w-[120px]">
                                  {item.notes || '-'}
                                </TableCell>
                                {previewDocType !== 'receipt' && (
                                  <TableCell className="text-[10px] py-2 text-right w-24 px-2">
                                    {editPriceMode && previewCollection ? (
                                      <PurchasePriceInput
                                        initialValue={Number(item.finalPrice) || 0}
                                        quantity={item.quantity || 1}
                                        onCommit={(raw) =>
                                          handleUpdateItemPrice(previewCollection.id, item.id, raw)
                                        }
                                      />
                                    ) : (
                                      <>¥{((item.finalPrice || 0) * item.quantity).toLocaleString()}</>
                                    )}
                                  </TableCell>
                                )}
                              </TableRow>
                            ))}
                            {/* Fill empty rows */}
                            {Array.from({ length: Math.max(0, 8 - previewCollection.items.length) }).map((_, i) => (
                              <TableRow key={`empty-${i}`} className="h-8 border-b">
                                <TableCell className="border-r h-8"></TableCell>
                                <TableCell className="border-r h-8"></TableCell>
                                <TableCell className="border-r h-8"></TableCell>
                                <TableCell className="border-r h-8"></TableCell>
                                <TableCell className="border-r h-8"></TableCell>
                                <TableCell className="border-r h-8"></TableCell>
                                <TableCell className="border-r h-8"></TableCell>
                                <TableCell className="border-r h-8"></TableCell>
                                {previewDocType !== 'receipt' && <TableCell className="h-8"></TableCell>}
                              </TableRow>
                            ))}
                          </TableBody>
                    </Table>
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold">【備考】</p>
                    <div className="border p-3 min-h-[60px] text-[10px] leading-relaxed">
                      {docSettings.notes}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsPreviewModalOpen(false)}>
              キャンセル
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 gap-2 disabled:opacity-50"
              disabled={
                previewDocType === 'purchase_detail' &&
                !!previewCollection &&
                !isPurchaseFinalized(previewCollection)
              }
              onClick={() => {
                if (previewCollection) {
                  if (previewDocType === 'receipt') {
                    updateCollection(previewCollection.id, { receiptIssued: true });
                  } else {
                    if (!isPurchaseFinalized(previewCollection)) {
                      toast.error('買取金額が未確定の品目があります', {
                        description: '右上の「価格を編集」から金額を入力してください。',
                      });
                      return;
                    }
                    updateCollection(previewCollection.id, { purchaseDetailIssued: true });
                  }
                }
                toast.success(`${previewDocType === 'receipt' ? '受領書' : '買取明細書'}を発行しました`);
                setIsPreviewModalOpen(false);
              }}
            >
              <Printer className="w-4 h-4" /> 印刷・PDF出力
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Collection Registration Modal */}
      <Dialog open={isNewModalOpen} onOpenChange={setIsNewModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[95vw] md:max-w-5xl lg:max-w-6xl xl:max-w-7xl max-h-[92vh] overflow-y-auto p-0">
          <div className="p-6 border-b bg-white sticky top-0 z-10">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Plus className="w-5 h-5 text-blue-600" />
                新規回収案件の登録
              </DialogTitle>
              <DialogDescription>
                引取先情報と品目リストを入力してください。登録後、担当回収員のスケジュールに自動反映されます。
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-6 py-5 space-y-6">
            {/* 上段: 担当者・スケジュール・引取先 (3カラム横並び) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* 担当回収員 */}
              <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-100 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-600 rounded-md text-white">
                    <Truck className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider">担当回収員</h3>
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] text-slate-600">割り当てる回収員</Label>
                  <Select value={newAssignedCollectorId} onValueChange={setNewAssignedCollectorId}>
                    <SelectTrigger className="bg-white border-blue-200 h-10">
                      <SelectValue placeholder="回収員を選択..." />
                    </SelectTrigger>
                    <SelectContent>
                      {MOCK_USERS.filter(u => u.role === 'collector').map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.name}（{u.base}）</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-blue-700/70 leading-relaxed">
                    ※ 選択すると回収員アプリのスケジュールに即時反映されます。
                  </p>
                </div>
              </div>

              {/* 回収スケジュール */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-slate-700 rounded-md text-white">
                    <CalendarDays className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">回収スケジュール</h3>
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] text-slate-600">
                    回収予定日 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="date"
                    value={collectionDate}
                    onChange={(e) => setCollectionDate(e.target.value)}
                    className="bg-white h-10 font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] text-slate-600">業務備考（特記・条件等）</Label>
                  <Input
                    placeholder="入口狭い、フォークリフト要など..."
                    value={collectionNotes}
                    onChange={(e) => setCollectionNotes(e.target.value)}
                    className="bg-white h-10"
                  />
                </div>
              </div>

              {/* 引取先 */}
              <div className="p-4 bg-amber-50/40 rounded-xl border border-amber-100 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-amber-600 rounded-md text-white">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wider">引取先</h3>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="customerType"
                      checked={newCustomerType === 'existing'}
                      onChange={() => setNewCustomerType('existing')}
                    />
                    <span>既存から選択</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="customerType"
                      checked={newCustomerType === 'new'}
                      onChange={() => setNewCustomerType('new')}
                    />
                    <span>新規登録</span>
                  </label>
                </div>

                {newCustomerType === 'existing' ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px] text-slate-600">引取先を選択（マスタから）</Label>
                      <span className="text-[10px] text-slate-400 italic">
                        ※ 取引先の追加は「従業員・マスタ管理」から
                      </span>
                    </div>
                    <Select value={selectedCustomerId} onValueChange={applyCustomerSelection}>
                      <SelectTrigger className="bg-white h-10">
                        <SelectValue placeholder="企業・個人を選択..." />
                      </SelectTrigger>
                      <SelectContent>
                        {existingCustomers.map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            <div className="flex items-center gap-2">
                              <span>{c.name}</span>
                              <Badge variant="secondary" className={cn(
                                "text-[9px] px-1.5 py-0",
                                c.shippingFeeApplicable
                                  ? "bg-rose-100 text-rose-700 border-rose-200"
                                  : "bg-emerald-100 text-emerald-700 border-emerald-200"
                              )}>
                                {c.shippingFeeApplicable ? '送料あり' : '送料なし'}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-slate-600">
                        引取先名 <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        placeholder="例: 田中 自動車"
                        className="bg-white h-10"
                        value={newCustomerName}
                        onChange={(e) => setNewCustomerName(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-slate-600">電話番号</Label>
                        <Input
                          placeholder="例: 06-1234-5678"
                          className="bg-white h-10"
                          value={newCustomerPhone}
                          onChange={(e) => setNewCustomerPhone(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-slate-600">住所</Label>
                        <Input
                          placeholder="例: 大阪府茨木市..."
                          className="bg-white h-10"
                          value={newCustomerAddress}
                          onChange={(e) => setNewCustomerAddress(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-slate-600">月次明細書 メール送付先</Label>
                      <Input
                        type="email"
                        placeholder="例: parts@example.co.jp"
                        className="bg-white h-10"
                        value={newCustomerEmail}
                        onChange={(e) => setNewCustomerEmail(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* 引取送料 */}
                <div className="pt-2 mt-2 border-t border-amber-200/60 space-y-2">
                  <div className="flex items-center gap-2 text-[11px] font-bold text-amber-900">
                    <Truck className="w-3.5 h-3.5" /> 引取送料
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                      <input
                        type="radio"
                        checked={!newShippingFeeApplicable}
                        onChange={() => {
                          setNewShippingFeeApplicable(false);
                          setNewShippingFeeAmount('');
                        }}
                      />
                      <span>なし</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                      <input
                        type="radio"
                        checked={newShippingFeeApplicable}
                        onChange={() => setNewShippingFeeApplicable(true)}
                      />
                      <span>あり</span>
                    </label>
                    {newShippingFeeApplicable && (
                      <div className="flex items-center gap-1 ml-2">
                        <span className="text-xs text-slate-500">¥</span>
                        <Input
                          type="number"
                          inputMode="numeric"
                          placeholder="0"
                          className="bg-white h-8 w-28 text-sm"
                          value={newShippingFeeAmount}
                          onChange={(e) => setNewShippingFeeAmount(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    マスタから選択した取引先のデフォルトが自動でセットされます。再販可能部品（リユース/リビルド）は送料なしで買取します（PDF業務フロー準拠）。
                  </p>
                </div>
              </div>
            </div>

            {/* 下段: 品目リスト */}
            <div className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">引取品目リスト</h3>
                  <p className="text-[11px] text-slate-500">登録した品目数: {collectionItems.length} 件</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddItem}
                  className="gap-1.5 border-2 border-slate-200 font-bold hover:bg-slate-50 h-9"
                >
                  <Plus className="w-4 h-4" /> 品目を追加
                </Button>
              </div>

              {collectionItems.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <Package className="w-8 h-8" />
                  <p className="text-xs">「品目を追加」から引取品目を入力してください</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {collectionItems.map((item, idx) => (
                    <Card
                      key={item.id}
                      className="border-2 border-slate-100 shadow-none overflow-hidden hover:border-blue-200 transition-all"
                    >
                      <div className="px-4 py-2 bg-slate-50 border-b flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-500 tracking-widest">
                          ITEM #{String(idx + 1).padStart(2, '0')}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-400 hover:text-red-500 hover:bg-red-50"
                          onClick={() => handleRemoveItem(idx)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <CardContent className="p-4 space-y-3">
                        {/* 品目名 + 部品番号 */}
                        <div className="grid grid-cols-3 gap-2">
                          <div className="col-span-2 space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500">品目名</Label>
                            <Input
                              placeholder="例: ドアパネル"
                              className="h-9 text-sm"
                              value={item.name || ''}
                              onChange={(e) => handleUpdateItem(idx, 'name', e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500">部品番号</Label>
                            <Input
                              placeholder="P-0000"
                              className="h-9 text-sm font-mono"
                              value={item.partNumber || ''}
                              onChange={(e) => handleUpdateItem(idx, 'partNumber', e.target.value)}
                            />
                          </div>
                        </div>

                        {/* カテゴリ + 数量 + 重量 + 区分 */}
                        <div className="grid grid-cols-4 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500">カテゴリ</Label>
                            <Select
                              value={item.category}
                              onValueChange={(val) => handleUpdateItem(idx, 'category', val)}
                            >
                              <SelectTrigger className="h-9 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {MOCK_CATEGORIES.map(cat => (
                                  <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500">数量</Label>
                            <Input
                              type="number"
                              min={1}
                              className="h-9 text-sm"
                              value={item.quantity ?? 1}
                              onChange={(e) => handleUpdateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500">重量(kg)</Label>
                            <Input
                              type="number"
                              min={0}
                              step="0.1"
                              placeholder="0.0"
                              className="h-9 text-sm"
                              value={item.weight ?? ''}
                              onChange={(e) => handleUpdateItem(idx, 'weight', e.target.value === '' ? undefined : parseFloat(e.target.value))}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500">区分</Label>
                            <Select
                              value={item.collectionType || 'paid'}
                              onValueChange={(val) => handleUpdateItem(idx, 'collectionType', val)}
                            >
                              <SelectTrigger className="h-9 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="paid">有償買取</SelectItem>
                                <SelectItem value="free">無料回収</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* 車体番号 */}
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-slate-500">車体番号</Label>
                          <Input
                            placeholder="例: ABC1234567"
                            className="h-9 text-sm font-mono"
                            value={item.vinNumber || ''}
                            onChange={(e) => handleUpdateItem(idx, 'vinNumber', e.target.value)}
                          />
                        </div>

                        {/* 車種情報 */}
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-slate-500">車種・型番</Label>
                          <div className="grid grid-cols-3 gap-2">
                            <Input
                              placeholder="メーカー"
                              className="h-9 text-xs"
                              value={item.carMaker || ''}
                              onChange={(e) => handleUpdateItem(idx, 'carMaker', e.target.value)}
                            />
                            <Input
                              placeholder="車種"
                              className="h-9 text-xs"
                              value={item.carName || ''}
                              onChange={(e) => handleUpdateItem(idx, 'carName', e.target.value)}
                            />
                            <Input
                              placeholder="型番"
                              className="h-9 text-xs font-mono"
                              value={item.carModelNumber || ''}
                              onChange={(e) => handleUpdateItem(idx, 'carModelNumber', e.target.value)}
                            />
                          </div>
                        </div>

                        {/* 走行距離 + カラー */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500">走行距離</Label>
                            <Input
                              placeholder="例: 50000km"
                              className="h-9 text-xs"
                              value={item.mileage || ''}
                              onChange={(e) => handleUpdateItem(idx, 'mileage', e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500">カラー</Label>
                            <Input
                              placeholder="例: ホワイト"
                              className="h-9 text-xs"
                              value={item.color || ''}
                              onChange={(e) => handleUpdateItem(idx, 'color', e.target.value)}
                            />
                          </div>
                        </div>

                        {/* 備考 */}
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-slate-500">備考</Label>
                          <Input
                            placeholder="傷の有無、欠品パーツなど..."
                            className="h-9 text-xs"
                            value={item.notes || ''}
                            onChange={(e) => handleUpdateItem(idx, 'notes', e.target.value)}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t bg-slate-50/60 sticky bottom-0">
            <Button variant="outline" onClick={() => setIsNewModalOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSaveCollection} className="bg-blue-600 hover:bg-blue-700 gap-2">
              <CheckCircle2 className="w-4 h-4" /> 回収案件を登録する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail View (Mock Modal) */}
      {selectedCollection && (
        <Card className="border-[#2563eb] border-2 shadow-lg">
          <CardHeader className="bg-[#f8fafc] border-b border-[#e2e8f0] flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">回収詳細: {selectedCollection.collectionNumber}</CardTitle>
              <p className="text-sm text-[#64748b]">{selectedCollection.customerName}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedCollection(null)}>閉じる</Button>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <h4 className="text-xs font-bold text-[#64748b] uppercase mb-2">顧客情報</h4>
                  <p className="text-sm font-medium">{selectedCollection.customerName}</p>
                  <p className="text-sm text-[#64748b]">{selectedCollection.customerAddress}</p>
                  <p className="text-sm text-[#64748b]">{selectedCollection.customerPhone}</p>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#64748b] uppercase mb-2">回収情報</h4>
                  <p className="text-sm">回収日: {selectedCollection.collectionDate}</p>
                  <p className="text-sm">ステータス: {selectedCollection.status}</p>
                  <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                     <Label className="text-[10px] font-bold text-slate-500 mb-2 block uppercase">担当回収員</Label>
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                           <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700">
                              {MOCK_USERS.find(u => u.id === selectedCollection.assignedCollectorId)?.name?.[0] || '?'}
                           </div>
                           <span className="text-sm font-bold text-slate-800">
                              {MOCK_USERS.find(u => u.id === selectedCollection.assignedCollectorId)?.name || '未割当'}
                           </span>
                        </div>
                        <Select 
                           value={selectedCollection.assignedCollectorId || ""} 
                           onValueChange={(val) => handleDispatchCollection(selectedCollection.id, val)}
                        >
                           <SelectTrigger className="w-32 h-8 text-[11px] bg-white">
                              <SelectValue placeholder="割当変更" />
                           </SelectTrigger>
                           <SelectContent>
                              {MOCK_USERS.filter(u => u.role === 'collector').map(u => (
                                 <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                     </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-[#64748b] uppercase mb-3">回収品目リスト</h4>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="text-xs">部品番号</TableHead>
                        <TableHead className="text-xs">品目名</TableHead>
                        <TableHead className="text-xs">カテゴリ</TableHead>
                        <TableHead className="text-xs">状態</TableHead>
                        <TableHead className="text-xs text-right">数量</TableHead>
                        <TableHead className="text-xs text-right">新品価格</TableHead>
                        <TableHead className="text-xs text-right">買取単価</TableHead>
                        <TableHead className="text-xs text-right">送料</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedCollection.items.map((item) => (
                        <TableRow 
                          key={item.id} 
                          className="cursor-pointer hover:bg-slate-50 transition-colors"
                          onClick={() => setSelectedItem(item as CollectionItem)}
                        >
                          <TableCell className="text-sm font-mono">
                            {item.partNumber || (
                              <Badge variant="outline" className="bg-red-50 text-red-600 border-red-100 text-[10px]">
                                未入力
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm font-medium">
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                <div className="flex flex-col">
                                  <span className="font-bold">{item.name}</span>
                                  <span className="text-[10px] text-slate-400">
                                    {item.carModel} {item.carYear}
                                  </span>
                                </div>
                                <Badge variant="outline" className={cn(
                                  "text-[10px] px-1.5 py-0",
                                  item.collectionType === 'free' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-blue-50 text-blue-600 border-blue-100"
                                )}>
                                  {item.collectionType === 'free' ? '回収無料' : '有償買取'}
                                </Badge>
                              </div>
                              <div className="flex gap-1 overflow-x-auto pb-1">
                                {item.images?.map((img, idx) => (
                                  <img 
                                    key={idx}
                                    src={img} 
                                    alt={`${item.name}-${idx}`} 
                                    className="w-12 h-12 rounded object-cover border border-slate-200 shrink-0"
                                    referrerPolicy="no-referrer"
                                  />
                                ))}
                                {(!item.images || item.images.length === 0) && (
                                  <div className="w-12 h-12 rounded bg-slate-100 flex items-center justify-center border border-slate-200">
                                    <ImageIcon className="w-4 h-4 text-slate-400" />
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{item.category}</TableCell>
                          <TableCell className="text-sm">{item.condition}</TableCell>
                          <TableCell className="text-sm text-right">{item.quantity}</TableCell>
                          <TableCell className="text-sm text-right text-[#64748b]">
                            ¥{(item.newPrice || 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-sm text-right font-bold">
                            ¥{(item.finalPrice || item.estimatedPrice || 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-sm text-right text-[#64748b]">
                            <div className="flex items-center justify-end gap-1">
                              <Truck className="w-3 h-3" />
                              ¥{(item.shippingFee || 0).toLocaleString()}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" className="gap-2" onClick={() => handleIssueReceipt(selectedCollection)}>
                  <Printer className="w-4 h-4" /> 受領書発行
                </Button>
                <Button variant="outline" className="gap-2" onClick={() => handleIssuePurchaseDetail(selectedCollection)}>
                  <Printer className="w-4 h-4" /> 買取明細発行
                </Button>
                <Button className="bg-[#2563eb] text-white hover:bg-[#1e40af] gap-2" onClick={() => handleLinkToInventory(selectedCollection)}>
                  <CheckCircle2 className="w-4 h-4" /> 在庫登録へ進む
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {/* Item Detail Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              回収品目詳細
            </DialogTitle>
          </DialogHeader>

          {selectedItem && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
              <div className="space-y-4">
                <div className="bg-slate-100 rounded-xl aspect-square overflow-hidden border border-slate-200">
                  {selectedItem.images && selectedItem.images.length > 0 ? (
                    <img 
                      src={selectedItem.images[0]} 
                      alt={selectedItem.name} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                      <ImageIcon className="w-12 h-12" />
                      <span className="text-xs">No Image</span>
                    </div>
                  )}
                </div>
                {selectedItem.images && selectedItem.images.length > 1 && (
                  <div className="grid grid-cols-4 gap-2">
                    {selectedItem.images.slice(1).map((img, idx) => (
                      <img 
                        key={idx} 
                        src={img} 
                        className="w-full aspect-square object-cover rounded-lg border border-slate-200" 
                        referrerPolicy="no-referrer"
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="border-b pb-2">
                  <Badge className="bg-blue-100 text-blue-700 border-none mb-1">{selectedItem.category}</Badge>
                  <h3 className="text-xl font-bold text-slate-900">{selectedItem.name}</h3>
                  <p className="text-xs text-slate-500 font-mono">{selectedItem.partNumber || '部品番号未登録'}</p>
                </div>

                <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">車両情報</p>
                    <p className="font-medium text-slate-700">{selectedItem.carMaker} {selectedItem.carName}</p>
                    <p className="text-xs text-slate-500">{selectedItem.carModelNumber || selectedItem.carModel}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">状態/区分</p>
                    <p className="font-medium text-slate-700">{selectedItem.condition}</p>
                    <p className="text-xs text-slate-500">{selectedItem.collectionType === 'paid' ? '有償買取' : '回収無料'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">走行距離 / カラー</p>
                    <p className="font-medium text-slate-700">{selectedItem.mileage || '-'} KM / {selectedItem.color || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">数量</p>
                    <p className="font-medium text-slate-700">{selectedItem.quantity}点</p>
                  </div>
                </div>

                <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold text-blue-600 uppercase">新品価格</span>
                    <span className="text-xs text-slate-500">¥{(selectedItem.newPrice || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-blue-900">買取/受領単価</span>
                    <span className="text-lg font-black text-blue-600">¥{(selectedItem.finalPrice || selectedItem.estimatedPrice || 0).toLocaleString()}</span>
                  </div>
                </div>

                {selectedItem.notes && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">備考</p>
                    <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">{selectedItem.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button className="w-full" onClick={() => setSelectedItem(null)}>閉じる</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 取引先マスタは「従業員・マスタ管理」タブに移設されました */}

      {/* ============== 電子受領書一覧 ============== */}
      <Dialog open={isReceiptListOpen} onOpenChange={setIsReceiptListOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              電子受領書一覧 ({receipts.length} 件)
            </DialogTitle>
            <DialogDescription>
              回収員が現場で発行した電子受領書の一覧です。クリックで詳細を確認できます。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {receipts.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">まだ電子受領書はありません</p>
                <p className="text-[10px] mt-1">回収員アプリで受領書を発行するとここに表示されます</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-[#f8fafc]">
                  <TableRow>
                    <TableHead className="text-[11px] font-bold uppercase">回収番号</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase">取引先</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase">発行日時</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase">回収員</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase text-right">点数</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receipts.map((r) => (
                    <TableRow key={r.id} className="hover:bg-slate-50">
                      <TableCell className="font-mono text-xs font-bold text-blue-600">
                        {r.collectionNumber}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{r.customerName}</TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {format(new Date(r.issuedAt), 'yyyy/MM/dd HH:mm')}
                      </TableCell>
                      <TableCell className="text-xs">{r.collectorName || '-'}</TableCell>
                      <TableCell className="text-right text-xs">
                        {r.totalQuantity}個 / {r.totalWeight.toFixed(1)}kg
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[10px]"
                          onClick={() => {
                            setActiveReceipt(r);
                            setIsReceiptListOpen(false);
                          }}
                        >
                          表示
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ============== 電子受領書プレビュー ============== */}
      <Dialog open={!!activeReceipt} onOpenChange={(o) => !o && setActiveReceipt(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {activeReceipt && (
            <div>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  電子受領書 - {activeReceipt.collectionNumber}
                </DialogTitle>
              </DialogHeader>
              <div className="bg-white border border-slate-200 rounded-lg p-6 mt-4 space-y-4">
                <div className="text-center border-b border-slate-200 pb-3">
                  <h2 className="text-lg font-black text-slate-800">回 収 受 領 書</h2>
                  <p className="text-[10px] text-slate-500 mt-1">
                    株式会社 サスティナブルガレージ {activeReceipt.branchName || ''}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">取引先</p>
                    <p className="font-bold text-slate-800">{activeReceipt.customerName} 様</p>
                    {activeReceipt.customerAddress && (
                      <p className="text-[10px] text-slate-500">{activeReceipt.customerAddress}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">回収日時</p>
                    <p className="font-bold text-slate-800">
                      {format(new Date(activeReceipt.issuedAt), 'yyyy年MM月dd日 HH:mm', { locale: ja })}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">回収員</p>
                    <p className="font-bold text-slate-800">{activeReceipt.collectorName || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">回収番号</p>
                    <p className="font-mono font-bold text-blue-600">{activeReceipt.collectionNumber}</p>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase mb-2">回収品目</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px] h-8">No.</TableHead>
                        <TableHead className="text-[10px] h-8">品目</TableHead>
                        <TableHead className="text-[10px] h-8">分類</TableHead>
                        <TableHead className="text-[10px] h-8 text-right">数量</TableHead>
                        <TableHead className="text-[10px] h-8 text-right">重量</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeReceipt.itemsSnapshot.map((it, idx) => (
                        <TableRow key={it.id}>
                          <TableCell className="text-xs py-1.5">{idx + 1}</TableCell>
                          <TableCell className="text-xs py-1.5 font-medium">{it.name}</TableCell>
                          <TableCell className="text-xs py-1.5">{it.category || '-'}</TableCell>
                          <TableCell className="text-xs py-1.5 text-right">{it.quantity}</TableCell>
                          <TableCell className="text-xs py-1.5 text-right">
                            {it.weight !== undefined ? `${it.weight}kg` : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex justify-end gap-4 text-xs font-bold text-slate-700 mt-2 px-3">
                    <span>合計: {activeReceipt.totalQuantity} 個</span>
                    <span>{activeReceipt.totalWeight.toFixed(1)} kg</span>
                  </div>
                </div>

                {activeReceipt.photoUrls.length > 0 && (
                  <div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase mb-2">
                      回収品目の写真 ({activeReceipt.photoUrls.length} 枚)
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {activeReceipt.photoUrls.map((url, i) => (
                        <div
                          key={i}
                          className="aspect-square rounded-lg bg-slate-100 overflow-hidden ring-1 ring-slate-200"
                        >
                          <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border-t border-slate-200 pt-3 flex justify-between items-end">
                  <div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">
                      お客様 ご署名
                    </p>
                    {activeReceipt.signatureData ? (
                      <p className="font-serif italic text-xl text-slate-800">
                        {activeReceipt.signatureName || '署名済'} ✓
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 italic">未署名</p>
                    )}
                  </div>
                  <p className="text-[9px] text-slate-400">
                    ※ 買取金額は分別作業完了後に確定します
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-4 justify-end">
                <Button variant="outline" onClick={() => setActiveReceipt(null)}>
                  閉じる
                </Button>
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                  onClick={() => window.print()}
                >
                  <Printer className="w-4 h-4" /> 印刷
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
