import React, { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle2,
  PlayCircle,
  TrendingUp,
  MessageSquare,
  Package,
  Camera,
  X,
  Scan,
  Image as ImageIcon,
  Settings2,
  ThumbsUp,
  FileSearch,
  BadgeJapaneseYen,
  MapPin,
  Navigation,
  Phone,
  Printer,
  Plus,
  Trash2,
  Recycle,
  Boxes,
  Wrench,
  LogOut,
  Download,
  Send,
  Users
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { MOCK_BRANCHES } from '@/src/mockData';
import { useTaskMasters } from '@/src/stores/taskMastersStore';
import { useTasks, completeTask, startTask } from '@/src/stores/tasksStore';
import { useT } from '@/src/stores/i18nStore';
import { useInventory } from '@/src/stores/inventoryStore';
import { useCurrentUser } from '@/src/stores/currentUserStore';
import {
  useMessages,
  sendMessage as sendMessageToStore,
  getThread,
  countMessages,
  type MessageChannel,
} from '@/src/stores/messagesStore';
import {
  useBananaListings,
  getBananaListingByInventoryId,
  markListingAsShipped,
} from '@/src/stores/bananaListingsStore';
import type { ShippingCarrier } from '@/src/types';
import {
  useCollections,
  addCollectionItem,
  updateCollectionItem,
  removeCollectionItem,
  updateCollection,
  setCollectionItemBreakdowns,
} from '@/src/stores/collectionsStore';
import {
  upsertInventoryFromBreakdown,
  removeInventoryByCollectionItem,
  updateInventoryItem,
} from '@/src/stores/inventoryStore';
import { addReceipt } from '@/src/stores/receiptsStore';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { Task, Collection, CollectionItem, CollectionItemBreakdown } from '@/src/types';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/src/firebase';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet icon issue
if (typeof L !== 'undefined' && L.Icon) {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });
}

/** Google Maps スタイルの番号付きピン（タップで作業開始） */
const createGoogleStylePin = (n: number, color: string = '#ea4335') =>
  L.divIcon({
    className: 'gmaps-pin',
    html: `<div style="position:relative;display:flex;align-items:flex-start;justify-content:center;">
      <svg width="32" height="40" viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 0 C7.16 0 0 7.16 0 16 C0 28 16 40 16 40 S32 28 32 16 C32 7.16 24.84 0 16 0 Z" fill="${color}" stroke="#fff" stroke-width="2"/>
        <circle cx="16" cy="16" r="9" fill="#fff"/>
      </svg>
      <span style="position:absolute;top:6px;left:0;right:0;text-align:center;color:${color};font-weight:900;font-size:13px;line-height:20px;font-family:-apple-system,sans-serif;">${n}</span>
    </div>`,
    iconSize: [32, 40],
    iconAnchor: [16, 40],
  });

function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  map.setView(center, 15);
  return null;
}

export function EmployeeHome() {
  const t = useT();
  const collections = useCollections();
  const inventory = useInventory();
  const allTasks = useTasks();
  const taskMasters = useTaskMasters();
  const currentUser = useCurrentUser();

  // メッセージ機能：従業員は「全体」または「管理者」へ送信可能
  // チャネル設計: 'all' = 全体ブロードキャスト / <自分のuserId> = 管理者との DM
  useMessages();
  const myId = currentUser?.id ?? 'u2';
  const myName = currentUser?.name ?? '従業員';
  const myRole: 'worker' | 'collector' = currentUser?.role === 'collector' ? 'collector' : 'worker';
  const [msgChannel, setMsgChannel] = useState<MessageChannel>('all');
  const [msgDraft, setMsgDraft] = useState('');
  const sendMyMessage = () => {
    const sent = sendMessageToStore({
      fromUserId: myId,
      fromName: myName,
      fromRole: myRole,
      channel: msgChannel,
      body: msgDraft,
    });
    if (sent) setMsgDraft('');
  };

  // 勤務ステータス: off=未出勤 / working=作業中 / break=休憩中
  // ログイン直後は未出勤状態。「出勤」ボタンを押下すると working に遷移し
  // 休憩・退勤の 2 ボタン表示に切り替わる。
  const [attendance, setAttendance] = useState<'off' | 'working' | 'break'>('off');
  const [attendanceLog, setAttendanceLog] = useState<{
    clockIn?: string;
    breakStart?: string;
    breakMinutes: number;
  }>({ breakMinutes: 0 });
  const handleClockIn = () => {
    const now = format(new Date(), 'HH:mm');
    setAttendance('working');
    setAttendanceLog({ clockIn: now, breakMinutes: 0 });
    toast.success(`${now} 出勤を記録しました`);
  };
  const handleBreakStart = () => {
    const now = format(new Date(), 'HH:mm');
    setAttendance('break');
    setAttendanceLog((prev) => ({ ...prev, breakStart: now }));
    toast.message(`${now} 休憩開始`);
  };
  const handleBreakEnd = () => {
    const now = new Date();
    const nowStr = format(now, 'HH:mm');
    setAttendance('working');
    setAttendanceLog((prev) => {
      // 休憩時間を加算（分単位）
      let added = 0;
      if (prev.breakStart) {
        const [bh, bm] = prev.breakStart.split(':').map(Number);
        const breakStartedAt = new Date(now);
        breakStartedAt.setHours(bh, bm, 0, 0);
        added = Math.max(0, Math.round((now.getTime() - breakStartedAt.getTime()) / 60000));
      }
      return { ...prev, breakStart: undefined, breakMinutes: prev.breakMinutes + added };
    });
    toast.success(`${nowStr} 作業を再開しました`);
  };
  const handleClockOut = () => {
    const now = format(new Date(), 'HH:mm');
    setAttendance('off');
    toast.success(`${now} 退勤を記録しました（休憩 ${attendanceLog.breakMinutes} 分）`);
  };
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [workflowStep, setWorkflowStep] = useState(0); // 0: Start, 1: Check, 2: Action, 3: Photo, 4: Finish
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [activeView, setActiveView] = useState<'list' | 'map'>('list');

  // BANANA BAY 出品の購読（出荷ワークフローで参照）
  useBananaListings();
  // 出荷ワークフロー用 state（追跡番号入力 etc.）
  const [shippingDraft, setShippingDraft] = useState<{
    carrier: ShippingCarrier;
    trackingNumber: string;
    notes: string;
  }>({ carrier: 'yamato', trackingNumber: '', notes: '' });

  // Unified Work History (Simulated)
  const [todayStats] = useState({
    completed: 8,
    target: 12,
    earnings: 4200,
    nextTarget: 6000
  });

  // Collection Specific State
  const [activeCollection, setActiveCollection] = useState<Collection | null>(null);
  const [collectionStep, setCollectionStep] = useState(0); // 0: Navigation, 1: Arrival/Check, 2: Photos, 3: Finish
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [newItem, setNewItem] = useState<Partial<CollectionItem>>({
    name: '', category: 'その他', quantity: 1, condition: '中程度', collectionType: 'paid'
  });
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<Partial<CollectionItem>>({});
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // Sorting Specific State
  const [sortingItems, setSortingItems] = useState<CollectionItem[]>([]);
  const [currentSortingIdx, setCurrentSortingIdx] = useState(0);
  const [sortingStep, setSortingStep] = useState(0); // 0: List, 1: Decomposition (1→N)
  // 分解レコードのドラフト（親 CollectionItem に対応する N 行）
  const [breakdownDraft, setBreakdownDraft] = useState<CollectionItemBreakdown[]>([]);
  const [breakdownBudget, setBreakdownBudget] = useState<number | ''>(''); // 親 finalPrice の目安（任意）

  // Production Meta State
  const [productionMeta, setProductionMeta] = useState({
    shelfCode: '',
    partName: '',
    partNumber: ''
  });

  // ログイン中の本人に割り当てられた "未完了" タスクのみ表示
  // フォールバック: 未ログイン状態では従来の u2/u4 を表示してデモ動作を維持
  const employeeTasks = (currentUser
    ? allTasks.filter((t) => t.assigneeId === currentUser.id)
    : allTasks.filter((t) => t.assigneeId === 'u2' || t.assigneeId === 'u4')
  ).filter((t) => t.status !== 'completed');

  const getTaskSteps = () => {
    const tm = taskMasters.find(m => m.id === activeTask?.taskMasterId);
    
    const baseSteps = [
      { id: 'meta', title: '商品基本情報の入力', desc: '棚割りコード、部品名、部品番号を確認・入力してください。', icon: <Settings2 className="w-5 h-5" /> }
    ];

    let specificSteps: any[] = [];
    // 旧 inspection / cleaning / photography / packing / dismantling は
    // 商品化フロー (productization / tm8) に内包されたため個別ステップは廃止。
    switch (tm?.type) {
      case 'shipping':
        specificSteps = [
          { id: 'order',  title: '注文情報の確認',     desc: '受取人氏名・配送先住所・電話番号を確認してください。',                  icon: <FileSearch className="w-5 h-5" /> },
          { id: 'pack',   title: '梱包作業',           desc: '緩衝材で2重保護し、配送票を貼付してください。',                          icon: <Package className="w-5 h-5" /> },
          { id: 'photo',  title: '梱包完了写真',       desc: '梱包後の状態を撮影し、配送前の証跡として保管します。',                  icon: <Camera className="w-5 h-5" /> },
          { id: 'label',  title: '配送業者・追跡番号', desc: '配送業者を選択し、伝票の追跡番号を入力してください。',                  icon: <Scan className="w-5 h-5" /> },
          { id: 'ship',   title: '発送完了登録',       desc: '発送日時を記録し、買い手へ発送通知を送信します。',                      icon: <CheckCircle2 className="w-5 h-5" /> },
        ];
        break;
      case 'productization':
        specificSteps = [
          { id: 'inspect', title: '動作確認・検品', desc: '部品の機能テストと外観の状態を詳細にチェックしてください。', icon: <FileSearch className="w-5 h-5" /> },
          { id: 'clean', title: '集中清掃・洗浄', desc: '油汚れや泥を完全に除去し、商品価値を高めてください。', icon: <Boxes className="w-5 h-5" /> },
          { id: 'photo', title: '出品用撮影 (6点)', desc: '正面、仕様ラベル、傷箇所など計6点の写真を撮影してください。', icon: <Camera className="w-5 h-5" /> },
          { id: 'pack', title: '最終梱包・棚入れ', desc: '丁寧に梱包し、指定の棚へ保管してください。', icon: <Package className="w-5 h-5" /> }
        ];
        break;
      default:
        specificSteps = [
          { id: '1', title: '現物確認', desc: '管理番号と現物が一致しているか確認してください。', icon: <CheckCircle2 className="w-5 h-5" /> },
          { id: '2', title: '作業実施', desc: 'マニュアルに従って標準作業を行ってください。', icon: <Wrench className="w-5 h-5" /> }
        ];
    }
    return [...baseSteps, ...specificSteps];
  };

  const taskSteps = getTaskSteps();
  const collectionTasks = employeeTasks.filter(t => {
     const tm = taskMasters.find(m => m.id === t.taskMasterId);
     return tm?.type === 'collection';
  });

  const handleStartTask = (task: Task) => {
    // ステータスを「作業中」に遷移（assigned → in_progress）
    if (task.id) startTask(task.id);

    const tm = taskMasters.find(m => m.id === task.taskMasterId);
    if (tm?.type === 'collection') {
      const coll = collections.find(c => c.id === task.targetId);
      if (coll) {
        setActiveCollection(coll);
        setCollectionStep(0);
        setActiveTask({ ...task, status: 'in_progress' });
        return;
      }
    }

    if (tm?.type === 'sorting') {
      const coll = collections.find(c => c.id === task.targetId);
      if (coll) {
        setSortingItems([...coll.items]);
        setCurrentSortingIdx(0);
        setSortingStep(0);
        setBreakdownDraft([]);
        setBreakdownBudget('');
        setActiveTask({ ...task, status: 'in_progress' });
        toast.info('作業開始', { description: 'ステータスが「作業中」になりました。' });
        return;
      }
    }

    setActiveTask({ ...task, status: 'in_progress' });
    setWorkflowStep(1);
    setCapturedPhotos([]);

    // Pre-fill production meta
    const item = inventory.find(i => i.id === task.targetId);
    setProductionMeta({
      shelfCode: item?.shelfCode || '',
      partName: item?.name || task.targetName.split(' (')[0] || '',
      partNumber: item?.partNumber || ''
    });
  };

  const handleArrive = () => {
    if (activeCollection) {
      setActiveCollection({ ...activeCollection, status: 'received' });
      setCollectionStep(1);
      toast.success('現場に到着しました', { description: 'ステータスが「受領済 (Received)」に更新されました。' });
    }
  };

  const handleIssueReceipt = async () => {
    setIsPreviewOpen(true);
    if (!activeCollection) return;

    // 1) 永続化用の電子受領書をストアへ追加（管理者画面でリアルタイムに参照可能）
    const totalQuantity = activeCollection.items.reduce(
      (sum, it) => sum + (it.quantity || 0),
      0,
    );
    const totalWeight = activeCollection.items.reduce(
      (sum, it) => sum + (it.weight || 0) * (it.quantity || 1),
      0,
    );
    const receiptId = `rcpt-${activeCollection.id}-${Date.now()}`;
    addReceipt({
      id: receiptId,
      collectionId: activeCollection.id,
      collectionNumber: activeCollection.collectionNumber,
      customerName: activeCollection.customerName,
      customerAddress: activeCollection.customerAddress,
      collectorId: 'u4',
      collectorName: '回収員 三郎',
      branchName: MOCK_BRANCHES[0]?.name,
      issuedAt: new Date().toISOString(),
      signatureData: signatureData || undefined,
      itemsSnapshot: activeCollection.items.map((it) => ({
        id: it.id,
        name: it.name,
        category: it.category,
        quantity: it.quantity,
        weight: it.weight,
        notes: it.notes,
      })),
      totalQuantity,
      totalWeight,
      photoUrls: [...capturedPhotos],
      notes: activeCollection.notes,
    });

    // 2) Firestore へのバックアップ送信（任意・失敗してもストアには保存済み）
    try {
      const receiptData = {
        id: receiptId,
        collectionId: activeCollection.id,
        customerName: activeCollection.customerName,
        collectorName: '回収員 三郎',
        totalAmount: 0,
        issuedAt: new Date().toISOString(),
        itemsCount: activeCollection.items.length,
        signatureData: signatureData || '',
      };
      await addDoc(collection(db, 'receipts'), receiptData);
    } catch (error) {
      // Firestore 接続失敗時もストアには保存済みなので警告のみ
      console.warn('Firestore receipt sync skipped:', error);
    }
    // Collection.status を 'received' に更新（拠点搬入待ち）
    updateCollection(activeCollection.id, {
      receiptIssued: true,
      status: 'received',
    });
    // 関連する tm7（出張回収）タスクを完了マーク
    if (activeTask?.taskMasterId === 'tm7' && activeTask.id) {
      completeTask(activeTask.id);
    }
    toast.success('電子受領書を発行しました', {
      description: '管理者画面の回収業務に保存されました。',
    });
  };

  const handleDownloadPDF = async () => {
    const receiptElement = document.getElementById('receipt-content');
    if (!receiptElement) return;

    try {
      const canvas = await html2canvas(receiptElement, {
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`receipt_${activeCollection?.id || 'export'}.pdf`);
      toast.success('受領書をダウンロードしました');
    } catch (error) {
      console.error('PDF Generation failed', error);
      toast.error('PDFの作成に失敗しました');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const confirmIssueReceipt = () => {
    if (activeCollection) {
      // 現場での受領書発行: 受領状態(=拠点搬入待ち) のまま receiptIssued のみ true に更新する。
      // ※ 買取金額が確定するのは拠点側の「分別作業 (tm6)」完了時で、
      //   その時に finishSorting() が status='completed' へ遷移させる。
      const next = {
        ...activeCollection,
        receiptIssued: true,
        status: 'received' as const,
      };
      setActiveCollection(next);
      // ストアにも反映しておく（管理者画面・他画面のリアルタイム同期用）
      updateCollection(activeCollection.id, {
        receiptIssued: true,
        status: 'received',
      });
      setIsPreviewOpen(false);
      toast.success('受領書を発行しました', {
        description: '拠点に搬入後、分別作業で買取金額を確定します。',
      });
    }
  };

  const handleCompleteCollection = () => {
    toast.success('回収作業が完了しました', { description: '拠点で荷下ろしを行うと「受領済」へ移行します。' });
    setActiveTask(null);
    setActiveCollection(null);
  };

  // ----- 回収品目 CRUD -----
  const syncActiveFromStore = (collectionId: string) => {
    // useCollections will trigger re-render, but we keep activeCollection up-to-date too
    const next = collections.find((c) => c.id === collectionId);
    if (next) setActiveCollection(next);
  };

  const handleAddCollectionItem = () => {
    if (!activeCollection) return;
    if (!newItem.name || !newItem.name.trim()) {
      toast.error('商品名を入力してください');
      return;
    }
    const item: CollectionItem = {
      id: `ci-${Date.now()}`,
      name: newItem.name.trim(),
      category: newItem.category || 'その他',
      quantity: Number(newItem.quantity) > 0 ? Number(newItem.quantity) : 1,
      weight: newItem.weight !== undefined && newItem.weight !== null && String(newItem.weight) !== '' ? Number(newItem.weight) : undefined,
      vinNumber: newItem.vinNumber || undefined,
      partNumber: newItem.partNumber || undefined,
      carModel: newItem.carModel || undefined,
      carModelNumber: newItem.carModelNumber || undefined,
      notes: newItem.notes || undefined,
      condition: newItem.condition || '中程度',
      collectionType: newItem.collectionType || 'paid',
    };
    addCollectionItem(activeCollection.id, item);
    // Optimistic local mirror
    setActiveCollection({
      ...activeCollection,
      items: [...activeCollection.items, item],
    });
    setNewItem({
      name: '', category: 'その他', quantity: 1, condition: '中程度', collectionType: 'paid',
    });
    setIsAddItemOpen(false);
    toast.success('品目を追加しました');
  };

  const handleStartEditItem = (item: CollectionItem) => {
    setEditingItemId(item.id);
    setEditingDraft({ ...item });
  };

  const handleCancelEditItem = () => {
    setEditingItemId(null);
    setEditingDraft({});
  };

  const handleSaveEditItem = () => {
    if (!activeCollection || !editingItemId) return;
    if (!editingDraft.name || !String(editingDraft.name).trim()) {
      toast.error('商品名を入力してください');
      return;
    }
    const patch: Partial<CollectionItem> = {
      ...editingDraft,
      quantity: Number(editingDraft.quantity) > 0 ? Number(editingDraft.quantity) : 1,
      weight: editingDraft.weight !== undefined && editingDraft.weight !== null && String(editingDraft.weight) !== ''
        ? Number(editingDraft.weight)
        : undefined,
    };
    updateCollectionItem(activeCollection.id, editingItemId, patch);
    setActiveCollection({
      ...activeCollection,
      items: activeCollection.items.map((it) =>
        it.id === editingItemId ? { ...it, ...patch } : it
      ),
    });
    setEditingItemId(null);
    setEditingDraft({});
    toast.success('品目を更新しました');
  };

  const handleDeleteCollectionItem = (itemId: string) => {
    if (!activeCollection) return;
    if (!window.confirm('この品目を削除しますか？')) return;
    removeCollectionItem(activeCollection.id, itemId);
    setActiveCollection({
      ...activeCollection,
      items: activeCollection.items.filter((it) => it.id !== itemId),
    });
    toast.success('品目を削除しました');
  };

  // ----- 1→N 分解 (Decomposition) flow -----

  /**
   * 既存 breakdowns があればそれをドラフトに、なければ「親=1行」で初期化する。
   */
  const openDecomposition = (idx: number) => {
    const item = sortingItems[idx];
    if (!item) return;
    setCurrentSortingIdx(idx);
    setBreakdownBudget(item.finalPrice ?? '');
    if (item.breakdowns && item.breakdowns.length > 0) {
      setBreakdownDraft(item.breakdowns.map((b) => ({ ...b })));
    } else {
      // デフォルト: 親アイテムをそのまま1行に
      setBreakdownDraft([
        {
          id: `bd-${item.id}-1-${Date.now()}`,
          parentItemId: item.id,
          name: item.name,
          category: item.sortingCategory || 'reuse',
          quantity: item.quantity || 1,
          weight: item.weight,
          allocatedPurchaseAmount:
            item.finalPrice !== undefined ? Number(item.finalPrice) * (item.quantity || 1) : 0,
          shelfCode: '',
        },
      ]);
    }
    setSortingStep(1);
  };

  const addBreakdownRow = () => {
    const item = sortingItems[currentSortingIdx];
    if (!item) return;
    setBreakdownDraft((prev) => [
      ...prev,
      {
        id: `bd-${item.id}-${prev.length + 1}-${Date.now()}`,
        parentItemId: item.id,
        name: '',
        category: 'reuse',
        quantity: 1,
        weight: undefined,
        allocatedPurchaseAmount: 0,
        shelfCode: '',
      },
    ]);
  };

  const updateBreakdownRow = (id: string, patch: Partial<CollectionItemBreakdown>) => {
    setBreakdownDraft((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  const removeBreakdownRow = (id: string) => {
    setBreakdownDraft((prev) => prev.filter((b) => b.id !== id));
  };

  /** 配分残額を全行に均等に振り分ける */
  const distributeRemaining = () => {
    const budget = Number(breakdownBudget) || 0;
    if (budget <= 0 || breakdownDraft.length === 0) {
      toast.error('予算（買取金額）を入力してください');
      return;
    }
    const per = Math.floor(budget / breakdownDraft.length);
    const remainder = budget - per * breakdownDraft.length;
    setBreakdownDraft((prev) =>
      prev.map((b, i) => ({
        ...b,
        allocatedPurchaseAmount: per + (i === 0 ? remainder : 0),
      })),
    );
    toast.success(`予算 ¥${budget.toLocaleString()} を ${breakdownDraft.length} 行に均等配分しました`);
  };

  /** ドラフトを確定 → ストア＋在庫に反映 */
  const handleConfirmDecomposition = () => {
    if (!activeTask) return;
    const collectionId = activeTask.targetId;
    const item = sortingItems[currentSortingIdx];
    if (!item) return;

    // バリデーション
    if (breakdownDraft.length === 0) {
      toast.error('分解行が 1 件以上必要です');
      return;
    }
    for (const b of breakdownDraft) {
      if (!b.name || !b.name.trim()) {
        toast.error('全ての行に部品名を入力してください');
        return;
      }
      if ((b.category === 'reuse' || b.category === 'rebuilt') && !b.shelfCode) {
        toast.error(`「${b.name}」の棚割りを入力してください（リユース/リビルド）`);
        return;
      }
      if (!Number.isFinite(Number(b.allocatedPurchaseAmount)) || Number(b.allocatedPurchaseAmount) < 0) {
        toast.error(`「${b.name}」の配分買取金額が不正です`);
        return;
      }
    }
    const total = breakdownDraft.reduce(
      (s, b) => s + (Number(b.allocatedPurchaseAmount) || 0),
      0,
    );
    if (total <= 0) {
      toast.error('配分合計が 0 円です。買取金額を入力してください', {
        description: '買取明細書の発行には買取金額が必要です。',
      });
      return;
    }

    // 旧 1:1 在庫レコードがあればクリーンアップ（再分解対応）
    removeInventoryByCollectionItem(item.id);

    // ストアへ確定
    setCollectionItemBreakdowns(collectionId, item.id, breakdownDraft);

    // 各 breakdown に対応する在庫を作成（資源は無視される）
    const branch = MOCK_BRANCHES[0]?.name;
    const collectionRef = collections.find((c) => c.id === collectionId);
    if (collectionRef) {
      breakdownDraft.forEach((bd) => {
        upsertInventoryFromBreakdown({
          collectionId,
          parentItem: item,
          breakdown: bd,
          branchName: branch,
          collectionNumber: collectionRef.collectionNumber,
          collectionDate: collectionRef.collectionDate,
        });
      });
    }

    // ローカルミラー更新
    const allocSum = total;
    const qty = item.quantity || 1;
    setSortingItems((prev) =>
      prev.map((it) =>
        it.id === item.id
          ? {
              ...it,
              breakdowns: breakdownDraft,
              finalPrice: qty > 0 ? Math.round(allocSum / qty) : allocSum,
              sortingCategory:
                Array.from(new Set(breakdownDraft.map((b) => b.category))).length === 1
                  ? breakdownDraft[0].category
                  : it.sortingCategory,
            }
          : it,
      ),
    );

    toast.success(`「${item.name}」を ${breakdownDraft.length} 件に分解しました`, {
      description: `配分合計 ¥${total.toLocaleString()}`,
    });

    setBreakdownDraft([]);
    setBreakdownBudget('');
    setSortingStep(0);
  };

  const finishSorting = () => {
    if (!activeTask) return;
    const collectionId = activeTask.targetId;
    const allFinalized =
      sortingItems.length > 0 &&
      sortingItems.every(
        (it) => Number.isFinite(Number(it.finalPrice)) && Number(it.finalPrice) > 0,
      );
    if (!allFinalized) {
      toast.error('全品目の買取金額が未確定です', {
        description: '買取明細書を発行するには、すべての品目を分解・配分してください。',
      });
      return;
    }
    // 分別工程の完了 → status:'completed' へ遷移
    //   ・買取明細書: 管理者画面 (CollectionManagement / MonthlyPurchaseBilling) で発行可能に
    //   ・在庫: 各 breakdown が pending_productization で在庫登録済み → 商品化待ちリストに反映
    updateCollection(collectionId, { status: 'completed' });
    // タスクも完了マーク → 従業員ホームから消え、ダッシュボードの完了実績に計上
    if (activeTask?.id) {
      completeTask(activeTask.id);
    }
    const inventoryCount = sortingItems.reduce(
      (sum, it) => sum + (it.breakdowns?.filter((b) => b.category !== 'recycle').length || 0),
      0,
    );
    toast.success('分別作業が完了しました！', {
      description: `買取金額が確定 / 在庫 ${inventoryCount} 件を「商品化待ち」へ登録 / 買取明細書を発行できます`,
    });
    setActiveTask(null);
    setSortingStep(0);
    setSortingItems([]);
    setBreakdownDraft([]);
  };

  const handleFinishStep = () => {
    const tmType = taskMasters.find((m) => m.id === activeTask?.taskMasterId)?.type;

    if (workflowStep === 1) {
      // 商品化フロー時の必須入力チェック
      if (tmType === 'productization' && (!productionMeta.shelfCode || !productionMeta.partName || !productionMeta.partNumber)) {
        toast.error('必須項目（棚割り、部品名、部品番号）を入力してください');
        return;
      }
    }

    // 出荷ワークフロー：「ラベル貼付・追跡番号」ステップ通過時に追跡番号必須チェック
    if (tmType === 'shipping' && taskSteps[workflowStep - 1]?.id === 'label') {
      if (!shippingDraft.trackingNumber.trim()) {
        toast.error('追跡番号を入力してください');
        return;
      }
    }

    if (workflowStep < taskSteps.length) {
      const nextStep = workflowStep + 1;
      setWorkflowStep(nextStep);

      // Auto transition to listing when starting photography
      if (taskSteps[nextStep - 1]?.id === 'photo' && tmType === 'productization') {
         toast.info('出品情報連携中...', { description: 'ステータスを「出品中」に変更しました。' });
      }
    } else {
      // ----- 出荷ワークフロー: BANANA BAY 出品レコードを「発送済」に更新 -----
      if (tmType === 'shipping' && activeTask?.targetType === 'inventory' && activeTask.targetId) {
        const listing = getBananaListingByInventoryId(activeTask.targetId);
        if (listing) {
          markListingAsShipped({
            id: listing.id,
            shippingCarrier: shippingDraft.carrier,
            trackingNumber: shippingDraft.trackingNumber.trim(),
            shippingNotes: shippingDraft.notes || undefined,
          });
          toast.success('発送登録が完了しました', {
            description: `追跡番号: ${shippingDraft.trackingNumber} ／ ${
              shippingDraft.carrier === 'yamato'
                ? 'ヤマト運輸'
                : shippingDraft.carrier === 'sagawa'
                  ? '佐川急便'
                  : shippingDraft.carrier === 'jp_post'
                    ? '日本郵便'
                    : 'その他'
            } で発送`,
          });
        }
      }
      // 商品化フロー: 在庫を「出品中」に更新
      else if (tmType === 'productization' && activeTask?.targetType === 'inventory' && activeTask.targetId) {
        updateInventoryItem(activeTask.targetId, {
          status: 'listing',
          bananaBayStatus: 'listing',
          shelfCode: productionMeta.shelfCode || undefined,
          location: productionMeta.shelfCode || undefined,
          partNumber: productionMeta.partNumber || undefined,
          name: productionMeta.partName || undefined,
          statusChangedAt: new Date().toISOString(),
        });
      }
      // タスクを完了済みにマーク → 従業員側の一覧から消え、ダッシュボードに完了実績が積まれる
      if (activeTask?.id) {
        completeTask(activeTask.id);
      }
      if (tmType !== 'shipping') {
        toast.success('タスクが完了しました！', {
          description: '管理者へ完了通知を送りました。お疲れさまでした。',
        });
      }
      // 最終ステップ完了 → 画面を自動的に閉じる
      setActiveTask(null);
      setWorkflowStep(0);
      setCapturedPhotos([]);
      setProductionMeta({ shelfCode: '', partName: '', partNumber: '' });
      setShippingDraft({ carrier: 'yamato', trackingNumber: '', notes: '' });
    }
  };

  const simulateCapture = () => {
    setIsCapturing(true);
    setTimeout(() => {
      const newPhoto = `https://picsum.photos/seed/${Date.now()}/800/600`;
      setCapturedPhotos(prev => [...prev, newPhoto]);
      setIsCapturing(false);
      toast.success('撮影完了', { duration: 1000 });
    }, 1500);
  };

  const targetItem = activeTask ? inventory.find(i => i.id === activeTask.targetId) : null;
  
  return (
    <div className="min-h-full bg-[#f8fafc] pb-24">
      <AnimatePresence mode="wait">
        {!activeTask && (
          <motion.div 
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col h-full overflow-y-auto"
          >
            <div className="bg-[#0f172a] text-white pt-8 pb-14 px-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-3xl -mr-20 -mt-20 rounded-full" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/10 blur-2xl -ml-10 -mb-10 rounded-full" />
              
              <div className="relative z-10 space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-blue-300 text-[10px] font-black uppercase tracking-[0.2em] mb-1">{t('home.workerDashboard')}</p>
                    <h1 className="text-2xl font-black tracking-tight italic">{t('home.energized')}</h1>
                  </div>
                  <div className="flex flex-col items-end">
                     <span className="text-[10px] text-slate-400 font-bold uppercase mb-1">{t('home.workTime')}</span>
                     <span className="text-lg font-mono font-black tabular-nums">03:42:15</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                    <p className="text-white/40 text-[10px] font-bold uppercase mb-1">{t('home.completedTasks')}</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black">{todayStats.completed}</span>
                      <span className="text-white/40 text-xs">/ {todayStats.target}</span>
                    </div>
                    <Progress value={(todayStats.completed / todayStats.target) * 100} className="h-1 bg-white/10 mt-3" />
                  </div>
                  <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                    <p className="text-white/40 text-[10px] font-bold uppercase mb-1">{t('home.bonusEarned')}</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-black">¥{todayStats.earnings.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-3 text-[9px] text-emerald-400 font-bold">
                       <TrendingUp className="w-3 h-3" />
                       <span>{t('home.targetTo')} ¥{(todayStats.nextTarget - todayStats.earnings).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* 勤務ステータス＋ワンタップ操作 */}
                <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "w-2 h-2 rounded-full shrink-0 shadow",
                          attendance === 'working' && "bg-emerald-400 animate-pulse shadow-emerald-500/50",
                          attendance === 'break' && "bg-amber-400 shadow-amber-500/50",
                          attendance === 'off' && "bg-slate-400",
                        )}
                      />
                      <span className="text-[11px] font-black tracking-widest uppercase text-white/80">
                        {attendance === 'working' && t('attendance.working')}
                        {attendance === 'break' && t('attendance.onBreak')}
                        {attendance === 'off' && t('attendance.off')}
                      </span>
                    </div>
                    {attendanceLog.clockIn && (
                      <span className="text-[10px] text-white/50 font-mono">
                        {attendanceLog.clockIn} 〜
                        {attendanceLog.breakMinutes > 0 && ` 休 ${attendanceLog.breakMinutes}分`}
                      </span>
                    )}
                  </div>

                  {/* 状態に応じたメインアクションのみ表示してシンプル化 */}
                  {attendance === 'off' && (
                    <Button
                      onClick={handleClockIn}
                      className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black gap-2 shadow-lg shadow-emerald-500/20"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      {t('attendance.clockIn')}
                    </Button>
                  )}
                  {attendance === 'working' && (
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        onClick={handleBreakStart}
                        className="h-12 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black gap-2 shadow-lg shadow-amber-500/20"
                      >
                        <Clock className="w-5 h-5" />
                        {t('attendance.break')}
                      </Button>
                      <Button
                        onClick={handleClockOut}
                        variant="ghost"
                        className="h-12 bg-white/10 hover:bg-white/20 text-white/80 rounded-xl font-bold gap-2 border border-white/10"
                      >
                        <LogOut className="w-5 h-5" />
                        {t('attendance.clockOut')}
                      </Button>
                    </div>
                  )}
                  {attendance === 'break' && (
                    <Button
                      onClick={handleBreakEnd}
                      className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black gap-2 shadow-lg shadow-emerald-500/20"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      {t('attendance.resume')}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 -mt-6 relative z-20 space-y-8">
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                   <h3 className="font-black text-slate-900 tracking-tight">{t('home.todayTasks')}</h3>
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{employeeTasks.length} ITEMS REMAINING</p>
                </div>
                <div className="flex bg-white/50 backdrop-blur-sm p-1 rounded-xl shadow-sm border border-slate-200/50">
                   <Button 
                     variant={activeView === 'list' ? 'secondary' : 'ghost'} 
                     size="sm" 
                     className={cn("h-8 px-4 text-[10px] font-black rounded-lg transition-all uppercase tracking-wider", activeView === 'list' && "bg-slate-900 text-white shadow-md shadow-slate-200")}
                     onClick={() => setActiveView('list')}
                   >
                      List
                   </Button>
                   <Button 
                     variant={activeView === 'map' ? 'secondary' : 'ghost'} 
                     size="sm" 
                     className={cn("h-8 px-4 text-[10px] font-black rounded-lg transition-all uppercase tracking-wider", activeView === 'map' && "bg-white text-slate-900 shadow-sm")}
                     onClick={() => setActiveView('map')}
                   >
                      Map
                   </Button>
                </div>
              </div>

              {activeView === 'list' ? (
                <div className="space-y-4">
                  {employeeTasks.length > 0 ? (
                    employeeTasks.map((task) => {
                      const tm = taskMasters.find(m => m.id === task.taskMasterId);
                      const isCollection = tm?.type === 'collection';
                      const isSorting = tm?.type === 'sorting';
                      const duration = task.durationMinutes || tm?.estimatedTime || 0;
                      const reward = tm?.basePrice ? `¥${tm.basePrice.toLocaleString()}` : '';
                      const timeRange = task.scheduledStartTime
                        ? `${task.scheduledStartTime}〜${task.scheduledEndTime ?? ''}`
                        : `${duration}分`;

                      return (
                        <Card key={task.id} className={cn(
                          "border-none shadow-sm rounded-2xl transition-all active:scale-[0.98] overflow-hidden bg-white relative",
                          isCollection ? "ring-1 ring-amber-200" : isSorting ? "ring-1 ring-purple-200" : "ring-1 ring-blue-200"
                        )}>
                          {task.status === 'in_progress' ? (
                            <span className="absolute top-2 right-2 z-10 inline-flex items-center gap-1 bg-blue-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow">
                              作業中
                            </span>
                          ) : task.status === 'assigned' ? (
                            <span className="absolute top-2 right-2 z-10 inline-flex items-center gap-1 bg-emerald-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow">
                              新着指示
                            </span>
                          ) : task.dispatched ? (
                            <span className="absolute top-2 right-2 z-10 inline-flex items-center gap-1 bg-emerald-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow">
                              新着指示
                            </span>
                          ) : null}
                          <CardContent className="p-0">
                            <div className="p-4 flex justify-between items-start">
                              <div className="flex gap-4">
                                <div className={cn(
                                  "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
                                  isCollection ? "bg-amber-50 text-amber-600" : isSorting ? "bg-purple-50 text-purple-600" : "bg-blue-50 text-blue-600"
                                )}>
                                  {isCollection ? <MapPin className="w-6 h-6" /> : isSorting ? <Boxes className="w-6 h-6" /> : <Wrench className="w-6 h-6" />}
                                </div>
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                     <h4 className="font-black text-slate-800 tracking-tight">{tm?.name || '不明な作業'}</h4>
                                     {task.priority === 'high' && <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
                                  </div>
                                  <p className="text-[10px] text-slate-400 font-bold uppercase">Target: {task.targetName}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                 {reward && <span className="text-xs font-black text-slate-900">{reward}</span>}
                                 <p className="text-[9px] text-slate-400 font-bold tabular-nums">{duration}分</p>
                              </div>
                            </div>
                            <div className="px-4 pb-4 flex items-center justify-between">
                               <div className="flex gap-2 text-[10px] items-center text-slate-400 font-bold uppercase">
                                  <Package className="w-3 h-3" /> {task.quantity} / <Clock className="w-3 h-3" /> {timeRange}
                               </div>
                               <Button 
                                size="sm" 
                                className={cn(
                                  "rounded-xl h-10 px-6 text-xs font-black border-none shadow-md transition-all active:scale-95 text-white",
                                  isCollection ? "bg-amber-600 hover:bg-amber-700" : isSorting ? "bg-purple-600 hover:bg-purple-700" : "bg-blue-600 hover:bg-blue-700"
                                )}
                                onClick={() => handleStartTask(task)}
                               >
                                作業開始
                               </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  ) : (
                    <div className="py-20 text-center space-y-4">
                      <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-300">
                        <CheckCircle2 className="w-10 h-10" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{t('home.allCompleted')}</p>
                        <p className="text-xs text-slate-400">{t('home.waitingNew')}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Card className="h-[400px] border-none shadow-sm overflow-hidden rounded-3xl relative">
                   {(() => {
                     // 全ての回収先座標から地図中心を算出（無ければ大阪を fallback）
                     const validColls = collectionTasks
                       .map((t) => collections.find((c) => c.id === t.targetId))
                       .filter((c): c is NonNullable<typeof c> => Boolean(c && Number.isFinite(c.latitude) && Number.isFinite(c.longitude)));
                     const center: [number, number] = validColls.length > 0
                       ? [
                           validColls.reduce((s, c) => s + (c.latitude || 0), 0) / validColls.length,
                           validColls.reduce((s, c) => s + (c.longitude || 0), 0) / validColls.length,
                         ]
                       : [34.7651, 135.5174]; // 大阪 fallback
                     return (
                       <MapContainer
                         center={center}
                         zoom={11}
                         className="h-full w-full"
                         zoomControl
                       >
                          {/* Google Maps タイル（道路地図・日本語） */}
                          <TileLayer
                            url="https://mt1.google.com/vt/lyrs=m&hl=ja&x={x}&y={y}&z={z}"
                            attribution="&copy; Google"
                            maxZoom={20}
                            subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                          />
                          {collectionTasks.map((task, idx) => {
                             const coll = collections.find((c) => c.id === task.targetId);
                             if (!coll) return null;
                             const lat = coll.latitude || 34.7651;
                             const lng = coll.longitude || 135.5174;
                             // 既に開始済（in_progress）は緑、未着手は赤、完了は灰
                             const color =
                               task.status === 'completed' ? '#9ca3af'
                               : task.status === 'in_progress' ? '#10b981'
                               : '#ea4335';
                             return (
                               <Marker
                                 key={task.id}
                                 position={[lat, lng]}
                                 icon={createGoogleStylePin(idx + 1, color)}
                                 eventHandlers={{
                                   // ピンタップ → そのまま作業開始
                                   click: () => {
                                     if (task.status === 'completed') {
                                       toast.info(`${coll.customerName} は完了済みです`);
                                       return;
                                     }
                                     handleStartTask(task);
                                   },
                                 }}
                               >
                                  <Popup className="rounded-2xl p-0">
                                     <div className="p-3 space-y-2 min-w-[180px]">
                                        <p className="font-black text-slate-900 text-sm">{coll.customerName}</p>
                                        <p className="text-[10px] text-slate-500 leading-tight">{coll.customerAddress}</p>
                                        <p className="text-[10px] text-slate-400">
                                          引取 {coll.items.length} 品目
                                          {task.scheduledStartTime ? ` ・ ${task.scheduledStartTime}〜` : ''}
                                        </p>
                                        <Button
                                          size="sm"
                                          className="w-full h-8 text-[10px] bg-blue-600 hover:bg-blue-700 text-white font-bold"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (task.status === 'completed') return;
                                            handleStartTask(task);
                                          }}
                                          disabled={task.status === 'completed'}
                                        >
                                          {task.status === 'in_progress' ? '作業を再開' : task.status === 'completed' ? '完了済み' : '作業開始'}
                                        </Button>
                                     </div>
                                  </Popup>
                               </Marker>
                             );
                          })}
                       </MapContainer>
                     );
                   })()}
                   {/* マップオーバーレイ：使い方の小さいヒント */}
                   <div className="absolute top-3 left-3 z-[1000] bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-sm border border-slate-100 text-[10px] font-bold text-slate-600 flex items-center gap-1.5 pointer-events-none">
                     <MapPin className="w-3 h-3 text-rose-500" />
                     ピンをタップで作業開始
                   </div>
                </Card>
              )}

              {/* メッセージ・業務連絡 */}
              <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-blue-600" />
                    <h3 className="text-sm font-bold text-slate-800">メッセージ</h3>
                  </div>
                  <Badge className="bg-blue-50 text-blue-600 border border-blue-100 text-[10px] font-bold">
                    {countMessages(msgChannel)}件
                  </Badge>
                </div>

                {/* チャネル切替（全体 / 管理者DM） */}
                <div className="grid grid-cols-2 border-b border-slate-100 bg-slate-50/50">
                  <button
                    onClick={() => setMsgChannel('all')}
                    className={cn(
                      'py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors',
                      msgChannel === 'all'
                        ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                        : 'text-slate-500 hover:bg-white/60',
                    )}
                  >
                    <Users className="w-3.5 h-3.5" />
                    全体
                    <Badge className="bg-slate-200 text-slate-600 border-none text-[9px] font-bold ml-1">
                      {countMessages('all')}
                    </Badge>
                  </button>
                  <button
                    onClick={() => setMsgChannel(myId)}
                    className={cn(
                      'py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors',
                      msgChannel !== 'all'
                        ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                        : 'text-slate-500 hover:bg-white/60',
                    )}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    管理者
                    <Badge className="bg-slate-200 text-slate-600 border-none text-[9px] font-bold ml-1">
                      {countMessages(myId)}
                    </Badge>
                  </button>
                </div>

                {/* スレッド */}
                <div className="p-4 max-h-[280px] min-h-[160px] overflow-y-auto space-y-3 bg-slate-50/30">
                  {(() => {
                    const thread = getThread(msgChannel);
                    if (thread.length === 0) {
                      return (
                        <div className="py-6 flex flex-col items-center justify-center text-slate-300 gap-2">
                          <MessageSquare className="w-8 h-8 opacity-40" />
                          <p className="text-[10px] font-black uppercase tracking-widest">No Messages</p>
                        </div>
                      );
                    }
                    return thread.map((m) => {
                      const mine = m.fromUserId === myId;
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

                {/* 入力欄 */}
                <div className="border-t border-slate-100 p-3 bg-white flex gap-2">
                  <Input
                    placeholder={msgChannel === 'all' ? '全体にメッセージ...' : '管理者にメッセージ...'}
                    value={msgDraft}
                    onChange={(e) => setMsgDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMyMessage();
                      }
                    }}
                    className="h-10 text-xs bg-slate-50 border-slate-200"
                  />
                  <Button
                    onClick={sendMyMessage}
                    disabled={!msgDraft.trim()}
                    className="bg-blue-600 hover:bg-blue-700 h-10 px-4 gap-1 text-xs font-bold"
                  >
                    <Send className="w-3.5 h-3.5" /> 送信
                  </Button>
                </div>
              </Card>

              {/* Action Buttons */}
              <div className="pt-4 pb-20">
                <Button className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-lg shadow-xl shadow-blue-200 flex gap-3 transition-transform active:scale-95">
                   <Plus className="w-6 h-6" />
                   新規業務報告を作成
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={!!activeTask} onOpenChange={(open) => !open && (setActiveTask(null), setActiveCollection(null), setSortingItems([]), setWorkflowStep(0), setCollectionStep(0))}>
        <DialogContent className="p-0 overflow-hidden bg-[#f8fafc] border-none max-w-2xl h-[90vh]">
          {activeCollection ? (
            <div className="flex flex-col h-full">
              {/* Collection Flow Header */}
              <div className="bg-white px-6 py-4 flex items-center justify-between border-b border-slate-100 shadow-sm shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-slate-800 tracking-tight">{activeCollection.customerName} 様</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Collection Step {collectionStep + 1} / 4</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="rounded-xl text-slate-400" onClick={() => (setActiveTask(null), setActiveCollection(null))}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Step Progress */}
                <div className="flex gap-2">
                  {[0, 1, 2, 3, 4].map((s) => (
                    <div key={s} className="flex-1 space-y-2">
                      <div className={cn(
                        "h-1.5 rounded-full transition-all duration-500",
                        s <= collectionStep ? "bg-amber-600 shadow-sm shadow-amber-200" : "bg-slate-200"
                      )} />
                    </div>
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  {collectionStep === 0 && (
                    <motion.div 
                      key="nav" 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-6"
                    >
                      <div className="bg-white p-6 rounded-3xl ring-1 ring-slate-100 shadow-xl shadow-slate-200/40 space-y-4">
                        <div className="flex items-center gap-2 text-amber-600">
                          <Navigation className="w-5 h-5" />
                          <h3 className="font-black tracking-tight text-lg">目的地へ移動中</h3>
                        </div>
                        <div className="h-48 rounded-2xl bg-slate-100 overflow-hidden ring-1 ring-slate-200 relative">
                           {(() => {
                             const addr = activeCollection.customerAddress || '';
                             const lat = activeCollection.latitude;
                             const lng = activeCollection.longitude;
                             // 住所優先 / 緯度経度 fallback で Google Maps embed
                             const q = addr
                               ? encodeURIComponent(addr)
                               : (Number.isFinite(lat) && Number.isFinite(lng) ? `${lat},${lng}` : '');
                             const src = q
                               ? `https://www.google.com/maps?q=${q}&z=16&output=embed`
                               : '';
                             return src ? (
                               <iframe
                                 title="引取先マップ"
                                 src={src}
                                 className="w-full h-full border-0"
                                 loading="lazy"
                                 referrerPolicy="no-referrer-when-downgrade"
                                 allowFullScreen
                               />
                             ) : (
                               <div className="flex items-center justify-center h-full text-xs text-slate-400">
                                 住所情報がありません
                               </div>
                             );
                           })()}
                        </div>
                        <div className="p-4 bg-amber-50/50 rounded-2xl space-y-2 border border-amber-100/50">
                           <div className="flex justify-between items-center text-[10px] font-black uppercase text-amber-700">
                              <span>回収住所</span>
                              <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> 電話可能</span>
                           </div>
                           <p className="text-sm font-bold text-slate-700">{activeCollection.customerAddress}</p>
                           {(activeCollection.customerAddress || (activeCollection.latitude && activeCollection.longitude)) && (
                             <a
                               href={
                                 activeCollection.customerAddress
                                   ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(activeCollection.customerAddress)}`
                                   : `https://www.google.com/maps/dir/?api=1&destination=${activeCollection.latitude},${activeCollection.longitude}`
                               }
                               target="_blank"
                               rel="noopener noreferrer"
                               className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-700 bg-white border border-amber-200 hover:bg-amber-50 transition-colors px-3 py-1.5 rounded-full"
                             >
                               <Navigation className="w-3 h-3" />
                               Google Maps でルート案内
                             </a>
                           )}
                        </div>
                        <Button className="w-full h-16 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-black text-lg shadow-xl shadow-amber-200 transition-all active:scale-95" onClick={handleArrive}>
                           現場に到着確認
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {collectionStep === 1 && (
                    <motion.div 
                      key="check" 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-6"
                    >
                      <div className="space-y-4">
                        <div className="flex justify-between items-center px-1">
                          <h3 className="font-black text-slate-800 flex items-center gap-2">
                             <Package className="w-5 h-5 text-amber-600" />
                             回収品目チェック
                          </h3>
                          <Badge variant="outline" className="text-[10px] font-black border-slate-200">{activeCollection.items.length} 点</Badge>
                        </div>
                        <div className="space-y-3">
                          {activeCollection.items.map((item) => {
                            const isEditing = editingItemId === item.id;
                            return (
                              <div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm ring-1 ring-slate-100 transition-all hover:ring-amber-200">
                                {isEditing ? (
                                  <div className="space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                      <div className="col-span-2">
                                        <Label className="text-[10px] font-bold text-slate-500 uppercase">商品名</Label>
                                        <Input value={editingDraft.name || ''} onChange={(e) => setEditingDraft({ ...editingDraft, name: e.target.value })} className="h-9 text-sm" />
                                      </div>
                                      <div>
                                        <Label className="text-[10px] font-bold text-slate-500 uppercase">数量</Label>
                                        <Input type="number" min={1} value={editingDraft.quantity ?? ''} onChange={(e) => setEditingDraft({ ...editingDraft, quantity: Number(e.target.value) })} className="h-9 text-sm" />
                                      </div>
                                      <div>
                                        <Label className="text-[10px] font-bold text-slate-500 uppercase">重量(kg)</Label>
                                        <Input type="number" step="0.1" min={0} value={editingDraft.weight ?? ''} onChange={(e) => setEditingDraft({ ...editingDraft, weight: e.target.value === '' ? undefined : Number(e.target.value) })} className="h-9 text-sm" />
                                      </div>
                                      <div>
                                        <Label className="text-[10px] font-bold text-slate-500 uppercase">車体番号</Label>
                                        <Input value={editingDraft.vinNumber || ''} onChange={(e) => setEditingDraft({ ...editingDraft, vinNumber: e.target.value })} className="h-9 text-sm" />
                                      </div>
                                      <div>
                                        <Label className="text-[10px] font-bold text-slate-500 uppercase">部品番号</Label>
                                        <Input value={editingDraft.partNumber || ''} onChange={(e) => setEditingDraft({ ...editingDraft, partNumber: e.target.value })} className="h-9 text-sm" />
                                      </div>
                                      <div>
                                        <Label className="text-[10px] font-bold text-slate-500 uppercase">車種</Label>
                                        <Input value={editingDraft.carModel || ''} onChange={(e) => setEditingDraft({ ...editingDraft, carModel: e.target.value })} className="h-9 text-sm" />
                                      </div>
                                      <div>
                                        <Label className="text-[10px] font-bold text-slate-500 uppercase">型番</Label>
                                        <Input value={editingDraft.carModelNumber || ''} onChange={(e) => setEditingDraft({ ...editingDraft, carModelNumber: e.target.value })} className="h-9 text-sm" />
                                      </div>
                                      <div className="col-span-2">
                                        <Label className="text-[10px] font-bold text-slate-500 uppercase">備考</Label>
                                        <Input value={editingDraft.notes || ''} onChange={(e) => setEditingDraft({ ...editingDraft, notes: e.target.value })} className="h-9 text-sm" />
                                      </div>
                                    </div>
                                    <div className="flex gap-2 pt-1">
                                      <Button size="sm" className="flex-1 h-9 bg-amber-600 hover:bg-amber-700 text-white font-bold" onClick={handleSaveEditItem}>保存</Button>
                                      <Button size="sm" variant="ghost" className="flex-1 h-9 text-slate-500 font-bold" onClick={handleCancelEditItem}>キャンセル</Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex justify-between items-start gap-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className="font-bold text-slate-800 text-sm truncate">{item.name}</p>
                                        <Badge variant="outline" className="text-[10px] font-black border-slate-200 shrink-0">{item.quantity}個</Badge>
                                      </div>
                                      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1 text-[10px] text-slate-500 font-medium">
                                        {item.weight !== undefined && <span>重量: <span className="text-slate-700">{item.weight}kg</span></span>}
                                        {item.vinNumber && <span className="truncate">車体: <span className="text-slate-700">{item.vinNumber}</span></span>}
                                        {item.partNumber && <span className="truncate">部品: <span className="text-slate-700">{item.partNumber}</span></span>}
                                        {item.carModel && <span className="truncate">車種: <span className="text-slate-700">{item.carModel}</span></span>}
                                        {item.carModelNumber && <span className="truncate">型番: <span className="text-slate-700">{item.carModelNumber}</span></span>}
                                      </div>
                                      {item.notes && <p className="text-[10px] text-slate-400 mt-1 truncate">備考: {item.notes}</p>}
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg text-slate-500 hover:text-amber-600" onClick={() => handleStartEditItem(item)}>
                                        <Settings2 className="w-4 h-4" />
                                      </Button>
                                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg text-slate-400 hover:text-red-600" onClick={() => handleDeleteCollectionItem(item.id)}>
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          <Button variant="outline" className="w-full h-12 border-dashed border-2 rounded-2xl text-slate-500 font-bold text-xs gap-2 hover:border-amber-400 hover:text-amber-600" onClick={() => setIsAddItemOpen(true)}>
                            <Plus className="w-4 h-4" /> 品目を追加
                          </Button>
                        </div>
                        <Button className="w-full h-16 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-black text-lg shadow-xl shadow-amber-200 transition-all active:scale-95" onClick={() => setCollectionStep(2)}>
                           点検完了・次へ
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {collectionStep === 2 && (
                    <motion.div 
                      key="photo" 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-6"
                    >
                      <div className="bg-white p-6 rounded-3xl ring-1 ring-slate-100 shadow-xl shadow-slate-200/40 space-y-6">
                        <div className="flex items-center gap-2 text-amber-600">
                          <Camera className="w-5 h-5" />
                          <h3 className="font-black tracking-tight text-lg">作業前後のエビデンス撮影</h3>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                           {capturedPhotos.length > 0 ? (
                             capturedPhotos.map((p, i) => (
                               <div key={i} className="aspect-square rounded-2xl bg-slate-100 overflow-hidden relative ring-1 ring-slate-200">
                                 <img src={p} alt="Captured" className="w-full h-full object-cover" />
                               </div>
                             ))
                           ) : (
                             <div className="col-span-2 py-10 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-3xl space-y-2 text-slate-300">
                               <ImageIcon className="w-10 h-10" />
                               <p className="text-[10px] font-black uppercase tracking-widest">No Photos Captured</p>
                             </div>
                           )}
                        </div>

                        <Button className="w-full h-24 bg-slate-900 hover:bg-slate-800 text-white rounded-3xl font-black text-lg shadow-xl shadow-slate-200 transition-all active:scale-95 flex flex-col gap-1 items-center justify-center" onClick={simulateCapture}>
                           <Camera className="w-6 h-6" />
                           <span>撮影を開始</span>
                        </Button>

                        <div className="flex gap-3">
                           <Button variant="ghost" className="h-14 flex-1 rounded-2xl text-slate-400 font-bold" onClick={() => setCollectionStep(1)}>戻る</Button>
                           <Button disabled={capturedPhotos.length === 0} className="h-14 flex-[2] bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-black shadow-lg shadow-amber-100 transition-all active:scale-95" onClick={() => setCollectionStep(3)}>
                              撮影完了・次へ
                           </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {collectionStep === 3 && (
                    <motion.div 
                      key="signature" 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="space-y-6"
                    >
                      <div className="bg-white p-6 rounded-3xl ring-1 ring-slate-100 shadow-xl shadow-slate-200/40 space-y-6">
                        <div className="flex items-center gap-2 text-amber-600">
                           <Wrench className="w-5 h-5" />
                           <h3 className="font-black tracking-tight text-lg">電子受領署名</h3>
                        </div>
                        <div 
                          className="h-40 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center relative cursor-crosshair group"
                          onClick={() => setSignatureData('signed')}
                        >
                           {signatureData ? (
                             <p className="font-serif italic text-2xl text-slate-800">S. Tanaka (署名済)</p>
                           ) : (
                             <p className="text-[10px] text-slate-400 font-bold tracking-widest">タップして署名</p>
                           )}
                        </div>
                        <div className="flex gap-3">
                           <Button variant="ghost" className="h-14 flex-1 rounded-2xl text-slate-400 font-bold" onClick={() => setCollectionStep(2)}>戻る</Button>
                           <Button disabled={!signatureData} className="h-14 flex-[2] bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-black shadow-lg shadow-amber-100 transition-all active:scale-95" onClick={() => setCollectionStep(4)}>
                              署名完了
                           </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {collectionStep === 4 && (
                    <motion.div 
                      key="finish" 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-6"
                    >
                      <div className="bg-white p-6 rounded-3xl ring-1 ring-slate-100 shadow-xl shadow-slate-200/40 space-y-6">
                        <div className="flex items-center gap-2 text-emerald-600">
                          <CheckCircle2 className="w-5 h-5" />
                          <h3 className="font-black tracking-tight text-lg">作業報告・受領発行</h3>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-2xl space-y-4">
                           <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400">
                              <span>合計回収品目</span>
                              <span>{activeCollection.items.length} 点</span>
                           </div>
                           <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400">
                              <span>合計重量</span>
                              <span>{activeCollection.items.reduce((sum, it) => sum + (it.weight || 0), 0).toLocaleString()} kg</span>
                           </div>
                           <p className="text-[9px] text-slate-400 leading-relaxed border-t border-slate-100 pt-3">
                              ※ 買取金額は拠点での分別作業完了後に確定し、後日「買取明細書」として発行されます。
                           </p>
                        </div>
                        <div className="space-y-3">
                          <Button variant="outline" className="w-full h-14 border-slate-200 font-bold gap-2 rounded-2xl hover:bg-slate-50" onClick={handleIssueReceipt}>
                            <Printer className="w-5 h-5" /> 受領書を発行
                          </Button>
                          <Button className="w-full h-16 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-lg shadow-xl shadow-emerald-200 transition-all active:scale-95" onClick={handleCompleteCollection}>
                            すべての回収を完了報告
                          </Button>
                        </div>
                        <Button variant="ghost" className="w-full h-10 text-slate-400 font-bold" onClick={() => setCollectionStep(3)}>戻る</Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          ) : sortingItems.length > 0 ? (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Sorting Flow Header */}
              <div className="bg-white px-6 py-4 flex items-center justify-between border-b border-slate-100 shadow-sm shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600">
                    <Boxes className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-slate-800 tracking-tight">分別・仕分け作業</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      {sortingStep === 0 ? 'Item Selection' : 'Decomposition (1→N)'}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="rounded-xl text-slate-400" onClick={() => (setActiveTask(null), setSortingItems([]), setSortingStep(0))}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <AnimatePresence mode="wait">
                  {sortingStep === 0 && (
                    <motion.div
                      key="sorting-list"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="space-y-4"
                    >
                      <div className="flex justify-between items-center">
                        <h3 className="font-black text-slate-800">荷下品目一覧</h3>
                        <Badge className="bg-purple-600 text-white border-none font-bold text-[10px]">
                          {sortingItems.length} ITEMS
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        各品目をタップして「資源 / リユース / リビルド」に分解（1→N）してください。
                      </p>
                      <div className="space-y-3">
                        {sortingItems.map((item, i) => {
                          const bdCount = item.breakdowns?.length || 0;
                          const finalPrice = item.finalPrice ?? null;
                          const allocSum = (item.breakdowns || []).reduce(
                            (s, b) => s + (Number(b.allocatedPurchaseAmount) || 0),
                            0,
                          );
                          const total = bdCount > 0 ? allocSum : (finalPrice || 0) * (item.quantity || 1);
                          const sorted = bdCount > 0 || (Number.isFinite(Number(finalPrice)) && Number(finalPrice) > 0);
                          // 各カテゴリ件数
                          const cats = item.breakdowns?.reduce(
                            (acc, b) => {
                              acc[b.category] = (acc[b.category] || 0) + 1;
                              return acc;
                            },
                            {} as Record<string, number>,
                          ) || {};
                          return (
                            <div
                              key={item.id}
                              className={cn(
                                'bg-white p-4 rounded-2xl shadow-sm ring-1 ring-slate-100 transition-all',
                                sorted ? 'ring-emerald-200 bg-emerald-50/30' : 'hover:ring-purple-200',
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={cn(
                                    'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                                    sorted ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-50 text-slate-400',
                                  )}
                                >
                                  {sorted ? <CheckCircle2 className="w-5 h-5" /> : <Package className="w-4 h-4" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="font-bold text-slate-800 text-sm truncate">{item.name}</p>
                                  <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase mt-0.5 flex-wrap">
                                    <span className="text-slate-400">
                                      {item.category} · {item.quantity}個
                                    </span>
                                    {bdCount > 0 && (
                                      <Badge className="bg-purple-100 text-purple-700 border-none font-black h-4 px-1.5">
                                        分解{bdCount}件
                                      </Badge>
                                    )}
                                    {cats.reuse > 0 && (
                                      <Badge className="bg-blue-100 text-blue-700 border-none font-black h-4 px-1.5">
                                        リユース {cats.reuse}
                                      </Badge>
                                    )}
                                    {cats.rebuilt > 0 && (
                                      <Badge className="bg-amber-100 text-amber-700 border-none font-black h-4 px-1.5">
                                        リビルド {cats.rebuilt}
                                      </Badge>
                                    )}
                                    {cats.recycle > 0 && (
                                      <Badge className="bg-emerald-100 text-emerald-700 border-none font-black h-4 px-1.5">
                                        資源 {cats.recycle}
                                      </Badge>
                                    )}
                                    {total > 0 && (
                                      <Badge className="bg-amber-50 text-amber-700 border-none font-black tabular-nums h-4 px-1.5">
                                        ¥{total.toLocaleString()}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  className={cn(
                                    'rounded-xl font-bold text-[10px] h-8 px-4 shrink-0',
                                    sorted
                                      ? 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                                      : 'bg-purple-600 hover:bg-purple-700 text-white',
                                  )}
                                  onClick={() => openDecomposition(i)}
                                >
                                  {sorted ? '再分解' : '分解'}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* 買取金額サマリ */}
                      {(() => {
                        const finalizedCount = sortingItems.filter(
                          (it) => Number.isFinite(Number(it.finalPrice)) && Number(it.finalPrice) > 0,
                        ).length;
                        const totalAmount = sortingItems.reduce((sum, it) => {
                          // breakdowns があればその合計、なければ finalPrice*qty
                          if (it.breakdowns && it.breakdowns.length > 0) {
                            return (
                              sum +
                              it.breakdowns.reduce(
                                (s, b) => s + (Number(b.allocatedPurchaseAmount) || 0),
                                0,
                              )
                            );
                          }
                          const fp = it.finalPrice ?? 0;
                          return sum + (Number.isFinite(Number(fp)) ? Number(fp) * (it.quantity || 1) : 0);
                        }, 0);
                        const allDone = finalizedCount === sortingItems.length && sortingItems.length > 0;
                        return (
                          <div
                            className={cn(
                              'p-4 rounded-2xl space-y-2',
                              allDone ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'bg-amber-50 ring-1 ring-amber-200',
                            )}
                          >
                            <div className="flex justify-between items-center text-[10px] font-black uppercase">
                              <span className={allDone ? 'text-emerald-700' : 'text-amber-700'}>分解・配分確定</span>
                              <span className={allDone ? 'text-emerald-700' : 'text-amber-700'}>
                                {finalizedCount} / {sortingItems.length}
                              </span>
                            </div>
                            <div className="flex justify-between items-baseline border-t border-white/60 pt-2">
                              <span className="text-[10px] font-bold text-slate-500 uppercase">買取合計</span>
                              <span className="text-xl font-black tabular-nums text-slate-900">
                                ¥{totalAmount.toLocaleString()}
                              </span>
                            </div>
                            {!allDone && (
                              <p className="text-[10px] text-amber-700 font-medium">
                                ※ 全品目を分解・配分すると「買取明細書」を発行できます。
                              </p>
                            )}
                          </div>
                        );
                      })()}

                      <Button
                        disabled={
                          !sortingItems.every(
                            (it) => Number.isFinite(Number(it.finalPrice)) && Number(it.finalPrice) > 0,
                          )
                        }
                        className="w-full h-16 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-2xl font-black text-lg shadow-xl shadow-purple-200 transition-all active:scale-95 mt-2"
                        onClick={finishSorting}
                      >
                        買取金額確定・分別完了
                      </Button>
                    </motion.div>
                  )}

                  {sortingStep === 1 && sortingItems[currentSortingIdx] && (
                    <motion.div
                      key="decomposition"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-4"
                    >
                      {(() => {
                        const parent = sortingItems[currentSortingIdx];
                        const allocSum = breakdownDraft.reduce(
                          (s, b) => s + (Number(b.allocatedPurchaseAmount) || 0),
                          0,
                        );
                        const budget = Number(breakdownBudget) || 0;
                        const remaining = budget - allocSum;
                        const totalQty = breakdownDraft.reduce((s, b) => s + (Number(b.quantity) || 0), 0);
                        return (
                          <>
                            {/* 親アイテム + 予算ヘッダ */}
                            <div className="bg-white p-4 rounded-2xl ring-1 ring-slate-100 shadow-sm space-y-3 sticky top-0 z-10">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="text-[9px] font-black uppercase text-purple-600 mb-1">分解対象</p>
                                  <h3 className="text-lg font-black text-slate-800 truncate">{parent.name}</h3>
                                  <p className="text-[10px] text-slate-400 font-bold">
                                    {parent.category} · 数量 {parent.quantity}{parent.weight ? ` · ${parent.weight}kg` : ''}
                                  </p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="rounded-lg text-slate-400 shrink-0"
                                  onClick={() => {
                                    setBreakdownDraft([]);
                                    setBreakdownBudget('');
                                    setSortingStep(0);
                                  }}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>

                              {/* 予算 (買取金額) — 任意 */}
                              <div className="bg-amber-50 p-3 rounded-xl ring-1 ring-amber-100 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <Label className="text-[9px] font-black uppercase text-amber-700 flex items-center gap-1">
                                    <BadgeJapaneseYen className="w-3 h-3" />
                                    買取金額予算（任意）
                                  </Label>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-[10px] font-bold text-amber-700 hover:bg-amber-100 px-2"
                                    onClick={distributeRemaining}
                                  >
                                    均等配分
                                  </Button>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="relative flex-1">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-amber-600">
                                      ¥
                                    </span>
                                    <Input
                                      type="number"
                                      min={0}
                                      step="100"
                                      value={breakdownBudget}
                                      onChange={(e) =>
                                        setBreakdownBudget(e.target.value === '' ? '' : Number(e.target.value))
                                      }
                                      placeholder="0"
                                      className="h-10 pl-7 rounded-lg bg-white border-none text-sm font-black tabular-nums focus:ring-2 focus:ring-amber-500"
                                    />
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className="text-[8px] font-black uppercase text-amber-600">配分残</p>
                                    <p
                                      className={cn(
                                        'text-sm font-black tabular-nums',
                                        remaining === 0 && budget > 0
                                          ? 'text-emerald-600'
                                          : remaining < 0
                                            ? 'text-red-600'
                                            : 'text-amber-700',
                                      )}
                                    >
                                      ¥{remaining.toLocaleString()}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* 分解行リスト */}
                            <div className="space-y-3">
                              {breakdownDraft.map((b, i) => (
                                <div
                                  key={b.id}
                                  className="bg-white p-3 rounded-2xl ring-1 ring-slate-100 shadow-sm space-y-3"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-black uppercase text-slate-400">
                                      行 {i + 1}
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 rounded-lg text-red-400 hover:bg-red-50"
                                      onClick={() => removeBreakdownRow(b.id)}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>

                                  {/* 区分チップ */}
                                  <div className="grid grid-cols-3 gap-1.5">
                                    {(
                                      [
                                        { key: 'reuse', label: 'リユース', icon: Recycle, color: 'blue' },
                                        { key: 'rebuilt', label: 'リビルド', icon: Wrench, color: 'amber' },
                                        { key: 'recycle', label: '資源', icon: Trash2, color: 'emerald' },
                                      ] as const
                                    ).map((opt) => {
                                      const Icon = opt.icon;
                                      const active = b.category === opt.key;
                                      return (
                                        <button
                                          key={opt.key}
                                          type="button"
                                          onClick={() => updateBreakdownRow(b.id, { category: opt.key })}
                                          className={cn(
                                            'h-9 rounded-lg flex items-center justify-center gap-1 text-[10px] font-black transition-all',
                                            active
                                              ? opt.color === 'blue'
                                                ? 'bg-blue-600 text-white shadow shadow-blue-200'
                                                : opt.color === 'amber'
                                                  ? 'bg-amber-600 text-white shadow shadow-amber-200'
                                                  : 'bg-emerald-600 text-white shadow shadow-emerald-200'
                                              : 'bg-slate-50 text-slate-500 hover:bg-slate-100',
                                          )}
                                        >
                                          <Icon className="w-3 h-3" />
                                          {opt.label}
                                        </button>
                                      );
                                    })}
                                  </div>

                                  {/* 名称 */}
                                  <div className="space-y-1">
                                    <Label className="text-[9px] font-black uppercase text-slate-400 ml-1">
                                      部品名 <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                      value={b.name}
                                      onChange={(e) => updateBreakdownRow(b.id, { name: e.target.value })}
                                      placeholder="例: ピストン / 鉄スクラップ"
                                      className="h-10 rounded-lg bg-slate-50 border-none text-sm font-bold"
                                    />
                                  </div>

                                  {/* 数量 + 重量 + 配分金額（同一行） */}
                                  <div className="grid grid-cols-3 gap-2">
                                    <div className="space-y-1">
                                      <Label className="text-[9px] font-black uppercase text-slate-400 ml-1">
                                        数量
                                      </Label>
                                      <Input
                                        type="number"
                                        min={1}
                                        value={b.quantity}
                                        onChange={(e) =>
                                          updateBreakdownRow(b.id, {
                                            quantity: Number(e.target.value) || 1,
                                          })
                                        }
                                        className="h-10 rounded-lg bg-slate-50 border-none text-sm font-bold tabular-nums"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[9px] font-black uppercase text-slate-400 ml-1">
                                        重量 kg
                                      </Label>
                                      <Input
                                        type="number"
                                        step="0.1"
                                        value={b.weight ?? ''}
                                        onChange={(e) =>
                                          updateBreakdownRow(b.id, {
                                            weight: e.target.value === '' ? undefined : Number(e.target.value),
                                          })
                                        }
                                        placeholder="-"
                                        className="h-10 rounded-lg bg-slate-50 border-none text-sm font-bold tabular-nums"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[9px] font-black uppercase text-amber-700 ml-1">
                                        ¥配分
                                      </Label>
                                      <Input
                                        type="number"
                                        min={0}
                                        step="100"
                                        value={b.allocatedPurchaseAmount}
                                        onChange={(e) =>
                                          updateBreakdownRow(b.id, {
                                            allocatedPurchaseAmount: Number(e.target.value) || 0,
                                          })
                                        }
                                        className="h-10 rounded-lg bg-amber-50 border-none text-sm font-black tabular-nums"
                                      />
                                    </div>
                                  </div>

                                  {/* 棚 — リユース/リビルドのみ */}
                                  {(b.category === 'reuse' || b.category === 'rebuilt') && (
                                    <div className="space-y-1">
                                      <Label className="text-[9px] font-black uppercase text-slate-400 ml-1">
                                        棚割りコード <span className="text-red-500">*</span>
                                      </Label>
                                      <Input
                                        value={b.shelfCode || ''}
                                        onChange={(e) =>
                                          updateBreakdownRow(b.id, { shelfCode: e.target.value })
                                        }
                                        placeholder="例: A-21"
                                        className="h-10 rounded-lg bg-blue-50/50 border-none text-sm font-bold"
                                      />
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>

                            {/* 行追加 */}
                            <Button
                              variant="outline"
                              className="w-full h-12 rounded-2xl border-2 border-dashed border-slate-200 text-slate-500 hover:border-purple-400 hover:text-purple-600 hover:bg-purple-50/30 font-bold gap-2"
                              onClick={addBreakdownRow}
                            >
                              <Plus className="w-4 h-4" />
                              分解行を追加
                            </Button>

                            {/* サマリ + 確定 */}
                            <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-2">
                              <div className="flex justify-between text-[10px] font-black uppercase opacity-70">
                                <span>分解 {breakdownDraft.length} 行 / 合計数量 {totalQty}</span>
                                <span>配分合計</span>
                              </div>
                              <div className="flex justify-between items-baseline">
                                <span className="text-[10px] opacity-50">¥</span>
                                <span className="text-2xl font-black tabular-nums">¥{allocSum.toLocaleString()}</span>
                              </div>
                            </div>

                            <div className="flex gap-3">
                              <Button
                                variant="ghost"
                                className="h-14 flex-1 rounded-2xl text-slate-400 font-bold"
                                onClick={() => {
                                  setBreakdownDraft([]);
                                  setBreakdownBudget('');
                                  setSortingStep(0);
                                }}
                              >
                                戻る
                              </Button>
                              <Button
                                className="h-14 flex-[2] bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-black shadow-lg shadow-purple-100 transition-all active:scale-95"
                                onClick={handleConfirmDecomposition}
                              >
                                分解を確定 ({breakdownDraft.length}件)
                              </Button>
                            </div>
                          </>
                        );
                      })()}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Production Flow Header */}
              <div className="bg-white px-6 py-4 flex items-center justify-between border-b border-slate-100 shadow-sm shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                    <Wrench className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-slate-800 tracking-tight">{activeTask?.targetName}</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Production Flow</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="rounded-xl text-slate-400" onClick={() => (setActiveTask(null), setWorkflowStep(0))}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Step Indicators */}
                <div className="flex gap-2">
                  {taskSteps.map((s, i) => (
                    <div key={s.id} className="flex-1 space-y-2">
                      <div className={cn(
                        "h-1.5 rounded-full transition-all duration-500",
                        i + 1 <= workflowStep ? "bg-blue-600 shadow-sm shadow-blue-200" : "bg-slate-200"
                      )} />
                    </div>
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  {workflowStep > 0 && workflowStep <= taskSteps.length ? (
                    <motion.div 
                      key={`step-${workflowStep}`}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-6"
                    >
                      <div className="bg-white p-6 rounded-3xl ring-1 ring-slate-100 shadow-xl shadow-slate-200/40 space-y-6">
                        <div className="flex items-center gap-2 text-blue-600">
                          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center">
                            {taskSteps[workflowStep - 1].icon}
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">TASK {workflowStep}</p>
                            <h3 className="font-black tracking-tight text-lg">{taskSteps[workflowStep - 1].title}</h3>
                          </div>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-2xl">
                          <p className="text-sm font-bold text-slate-600 leading-relaxed">{taskSteps[workflowStep - 1].desc}</p>
                        </div>

                        {workflowStep === 1 && taskMasters.find(m => m.id === activeTask?.taskMasterId)?.type === 'productization' && (
                          <div className="space-y-4 bg-white p-6 rounded-3xl ring-1 ring-slate-100 shadow-sm">
                             <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">部品名 <span className="text-red-500">*必須</span></Label>
                                <Input
                                   value={productionMeta.partName}
                                   onChange={e => setProductionMeta({...productionMeta, partName: e.target.value})}
                                   className="h-12 rounded-xl bg-slate-50 border-none font-bold"
                                />
                             </div>
                             <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                   <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">部品番号 <span className="text-red-500">*必須</span></Label>
                                   <Input
                                      value={productionMeta.partNumber}
                                      onChange={e => setProductionMeta({...productionMeta, partNumber: e.target.value})}
                                      className="h-12 rounded-xl bg-slate-50 border-none font-bold"
                                      placeholder="例: 123456-789"
                                   />
                                </div>
                                <div className="space-y-2">
                                   <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">棚割りコード <span className="text-red-500">*必須</span></Label>
                                   <Input
                                      value={productionMeta.shelfCode}
                                      onChange={e => setProductionMeta({...productionMeta, shelfCode: e.target.value})}
                                      className="h-12 rounded-xl bg-slate-50 border-none font-bold"
                                      placeholder="例: A-102"
                                   />
                                </div>
                             </div>
                          </div>
                        )}

                        {/* ========== 出荷ワークフロー専用パネル ========== */}
                        {taskMasters.find(m => m.id === activeTask?.taskMasterId)?.type === 'shipping' && (() => {
                          const listing = activeTask?.targetType === 'inventory' && activeTask.targetId
                            ? getBananaListingByInventoryId(activeTask.targetId)
                            : undefined;
                          const stepId = taskSteps[workflowStep - 1]?.id;
                          if (!listing) return (
                            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 text-xs text-amber-800">
                              ※ 該当する BANANA BAY 出品レコードが見つかりません。管理者へ確認してください。
                            </div>
                          );
                          // ----- Step: 注文情報の確認 -----
                          if (stepId === 'order') {
                            return (
                              <div className="space-y-3 p-5 rounded-2xl bg-amber-50/70 border border-amber-100">
                                <div className="flex justify-between items-start">
                                  <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">注文情報</span>
                                  <Badge className="bg-amber-600 text-white text-[10px] font-bold">{listing.orderId ?? listing.managementNumber}</Badge>
                                </div>
                                <div className="space-y-2 text-sm">
                                  <p className="font-black text-slate-800">{listing.itemName}</p>
                                  <div className="border-t border-amber-100 pt-2 space-y-1.5">
                                    <p className="text-xs"><span className="text-slate-400 font-bold mr-2">受取人</span>{listing.recipientName ?? listing.buyerName ?? '-'}</p>
                                    <p className="text-xs"><span className="text-slate-400 font-bold mr-2">電話番号</span>{listing.recipientPhone ?? '-'}</p>
                                    <p className="text-xs"><span className="text-slate-400 font-bold mr-2">配送先</span>{listing.shippingAddress ?? '-'}</p>
                                    <p className="text-xs"><span className="text-slate-400 font-bold mr-2">販売価格</span>¥{listing.price.toLocaleString()}</p>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          // ----- Step: 配送業者・追跡番号入力 -----
                          if (stepId === 'label') {
                            return (
                              <div className="space-y-4 p-5 rounded-2xl bg-white ring-1 ring-slate-100">
                                <div className="space-y-2">
                                  <Label className="text-[10px] font-black uppercase text-slate-400">配送業者</Label>
                                  <div className="grid grid-cols-3 gap-2">
                                    {(['yamato', 'sagawa', 'jp_post'] as ShippingCarrier[]).map((c) => (
                                      <button
                                        key={c}
                                        type="button"
                                        onClick={() => setShippingDraft({ ...shippingDraft, carrier: c })}
                                        className={cn(
                                          'h-12 rounded-xl text-xs font-bold border-2 transition-all',
                                          shippingDraft.carrier === c
                                            ? 'bg-amber-600 text-white border-amber-600 shadow-md'
                                            : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300',
                                        )}
                                      >
                                        {c === 'yamato' ? 'ヤマト運輸' : c === 'sagawa' ? '佐川急便' : '日本郵便'}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-[10px] font-black uppercase text-slate-400">追跡番号 <span className="text-red-500">*必須</span></Label>
                                  <Input
                                    value={shippingDraft.trackingNumber}
                                    onChange={(e) => setShippingDraft({ ...shippingDraft, trackingNumber: e.target.value })}
                                    placeholder={
                                      shippingDraft.carrier === 'yamato' ? '例: 1234-5670-1000'
                                      : shippingDraft.carrier === 'sagawa' ? '例: 123456789012'
                                      : '例: 1122334455667'
                                    }
                                    className="h-12 rounded-xl bg-slate-50 border-none font-bold font-mono text-base"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-[10px] font-black uppercase text-slate-400">メモ（任意）</Label>
                                  <Input
                                    value={shippingDraft.notes}
                                    onChange={(e) => setShippingDraft({ ...shippingDraft, notes: e.target.value })}
                                    placeholder="特記事項（割れ物注意 など）"
                                    className="h-10 rounded-xl bg-slate-50 border-none text-sm"
                                  />
                                </div>
                                <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-[11px] text-blue-700 leading-tight">
                                  💡 配送業者の追跡サイトで追跡番号が有効か事前に確認してから登録してください。
                                </div>
                              </div>
                            );
                          }
                          // ----- Step: 発送完了レビュー -----
                          if (stepId === 'ship') {
                            return (
                              <div className="space-y-3 p-5 rounded-2xl bg-emerald-50 border border-emerald-100">
                                <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">発送内容の最終確認</p>
                                <div className="bg-white rounded-xl p-3 space-y-1.5 text-xs">
                                  <p><span className="text-slate-400 font-bold mr-2">商品</span><span className="font-bold">{listing.itemName}</span></p>
                                  <p><span className="text-slate-400 font-bold mr-2">受取人</span>{listing.recipientName ?? listing.buyerName}</p>
                                  <p><span className="text-slate-400 font-bold mr-2">配送業者</span><span className="font-bold">
                                    {shippingDraft.carrier === 'yamato' ? 'ヤマト運輸' : shippingDraft.carrier === 'sagawa' ? '佐川急便' : '日本郵便'}
                                  </span></p>
                                  <p><span className="text-slate-400 font-bold mr-2">追跡番号</span><span className="font-mono font-bold">{shippingDraft.trackingNumber || '（未入力）'}</span></p>
                                </div>
                                <p className="text-[11px] text-emerald-700 leading-tight">
                                  「発送完了登録」を押すと管理画面に発送通知が送信され、買い手に追跡情報が共有されます。
                                </p>
                              </div>
                            );
                          }
                          return null;
                        })()}

                        {workflowStep === taskSteps.length && (
                          <div className="space-y-4">
                             <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">完了写真のアップロード (必須)</Label>
                             <div className="grid grid-cols-2 gap-3">
                                <Button variant="outline" className="h-32 border-dashed border-2 border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2" onClick={simulateCapture}>
                                   <Camera className="w-6 h-6 text-slate-300" />
                                   <span className="text-[10px] font-black text-slate-400">撮影</span>
                                </Button>
                                {capturedPhotos.length > 0 && (
                                   <div className="h-32 rounded-2xl bg-slate-100 overflow-hidden ring-1 ring-slate-200">
                                      <img src={capturedPhotos[capturedPhotos.length - 1]} className="w-full h-full object-cover" />
                                   </div>
                                )}
                             </div>
                          </div>
                        )}

                        <Button className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-lg shadow-xl shadow-blue-200 transition-all active:scale-95" onClick={handleFinishStep}>
                           {workflowStep === taskSteps.length ? 'すべての工程を完了' : '次のステップへ'}
                        </Button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="finish-screen"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="py-20 text-center space-y-6"
                    >
                      <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-emerald-100 animate-bounce">
                        <ThumbsUp className="w-12 h-12 text-white" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-2xl font-black text-slate-800">Excellent Work!</h3>
                        <p className="text-sm text-slate-400 font-medium">タスクは正常にアーカイブされました。</p>
                      </div>
                      <Button
                        className="w-full h-16 bg-emerald-600 hover:bg-emerald-700 text-white rounded-3xl font-black mt-10 shadow-xl shadow-emerald-200 transition-all active:scale-95"
                        onClick={() => {
                          // タスクを完了済みにマーク → 従業員側の一覧から消え、ダッシュボードに完了実績が積まれる
                          if (activeTask?.id) {
                            completeTask(activeTask.id);
                          }
                          setActiveTask(null);
                          setWorkflowStep(0);
                          setCapturedPhotos([]);
                          setProductionMeta({ shelfCode: '', partName: '', partNumber: '' });
                          toast.success('作業終了報告を送信しました', {
                            description: '管理者へ完了通知を送りました。お疲れさまでした。',
                          });
                        }}
                      >
                        作業終了報告
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[95vw] md:max-w-3xl lg:max-w-4xl p-0 overflow-hidden bg-white border-none rounded-3xl shadow-2xl">
          <div className="flex flex-col h-full max-h-[90vh]">
            <div className="bg-slate-900 text-white p-6 flex justify-between items-center shrink-0">
               <div className="flex items-center gap-2">
                  <Printer className="w-5 h-5 text-blue-400" />
                  <h3 className="font-black tracking-tight">受領書プレビュー</h3>
               </div>
               <Button variant="ghost" size="icon" className="text-white/40 hover:text-white" onClick={() => setIsPreviewOpen(false)}>
                  <X className="w-5 h-5" />
               </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 bg-slate-100/50">
              {activeCollection && (
                <div 
                  id="receipt-content" 
                  className="bg-white p-6 sm:p-8 shadow-sm border border-slate-200 w-full max-w-3xl mx-auto font-sans"
                >
                   {/* Header */}
                   <div className="flex justify-between items-start gap-4 mb-8">
                     <div>
                       <div className="w-10 h-10 bg-blue-600 rounded flex items-center justify-center mb-4">
                         <Package className="text-white w-6 h-6" />
                       </div>
                       <h2 className="text-2xl font-bold tracking-widest">受領書</h2>
                     </div>
                     <div className="text-right text-[10px] space-y-0.5">
                       <p>No: {activeCollection.collectionNumber || 'REF-' + activeCollection.id.toUpperCase()}</p>
                       <p>日付: {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })}</p>
                     </div>
                   </div>

                   {/* Customer Info */}
                   <div className="flex justify-between items-end border-b-2 border-black pb-2 mb-6">
                     <div className="space-y-1">
                       <p className="text-lg font-bold underline underline-offset-4 decoration-1">
                         {activeCollection.customerName} 様
                       </p>
                     </div>
                     <div className="text-right text-[9px] space-y-0.5">
                       <p className="font-bold">株式会社サスティナブルガレージ {MOCK_BRANCHES[0]?.name ?? ''}</p>
                       <p>{MOCK_BRANCHES[0]?.address ?? ''}</p>
                       <p>TEL: {MOCK_BRANCHES[0]?.phone ?? ''}</p>
                      {MOCK_BRANCHES[0]?.email && <p>Email: {MOCK_BRANCHES[0].email}</p>}
                     </div>
                   </div>

                   {/* 受領書には金額を載せない (買取金額は分別作業で確定後、買取明細書に記載) */}

                   {/* Items Table - 紙の様式に合わせた受領書フォーマット */}
                   <div className="border overflow-hidden rounded-sm mb-6">
                     <table className="w-full border-collapse text-[10px]">
                       <thead>
                         <tr className="bg-slate-50 border-b">
                           <th className="h-8 border-r px-2 text-left">商品名</th>
                           <th className="h-8 border-r px-2 text-right w-12">数量</th>
                           <th className="h-8 border-r px-2 text-right w-14">重量Kg</th>
                           <th className="h-8 border-r px-2 text-left w-24">車体番号</th>
                           <th className="h-8 border-r px-2 text-left w-20">部品番号</th>
                           <th className="h-8 border-r px-2 text-left w-20">車種</th>
                           <th className="h-8 border-r px-2 text-left w-16">型番</th>
                           <th className="h-8 px-2 text-left">備考</th>
                         </tr>
                       </thead>
                       <tbody>
                         {activeCollection.items.map((item, idx) => (
                           <tr key={idx} className="border-b">
                             <td className="py-2 border-r px-2 font-bold">{item.name}</td>
                             <td className="py-2 border-r px-2 text-right w-12">{item.quantity}</td>
                             <td className="py-2 border-r px-2 text-right w-14">{item.weight ? item.weight.toLocaleString() : '-'}</td>
                             <td className="py-2 border-r px-2 font-mono w-24 truncate">{item.vinNumber || '-'}</td>
                             <td className="py-2 border-r px-2 font-mono w-20 truncate">{item.partNumber || '-'}</td>
                             <td className="py-2 border-r px-2 w-20 truncate">{item.carName || item.carModel || '-'}</td>
                             <td className="py-2 border-r px-2 font-mono w-16 truncate">{item.carModelNumber || '-'}</td>
                             <td className="py-2 px-2 truncate max-w-[120px]">{item.notes || '-'}</td>
                           </tr>
                         ))}
                         {/* Fill empty rows to make it look formal */}
                         {Array.from({ length: Math.max(0, 5 - activeCollection.items.length) }).map((_, i) => (
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
                       </tbody>
                     </table>
                   </div>

                   {/* Signature Section */}
                   <div className="grid grid-cols-2 gap-8 items-start mb-6">
                      <div className="space-y-2">
                         <p className="text-[9px] text-slate-400 font-bold uppercase">Customer Signature</p>
                         <div className="h-12 border-b border-slate-300 flex items-center justify-center font-serif italic text-base text-slate-800">
                            {signatureData ? 'S. Tanaka' : ''}
                         </div>
                      </div>
                      <div className="pt-4 flex justify-end">
                         <div className="w-16 h-16 border border-red-200 rounded-full flex items-center justify-center text-[8px] text-red-400 border-dashed">
                            (角印)
                         </div>
                      </div>
                   </div>

                   {/* Footer Notes */}
                   <div className="space-y-1">
                     <p className="text-[9px] font-bold">【備考】</p>
                     <div className="border p-2 min-h-[40px] text-[9px] leading-relaxed text-slate-600">
                        毎度ありがとうございます。上記正に受領いたしました。
                     </div>
                   </div>
                </div>
              )}
            </div>

            <div className="p-6 bg-white border-t border-slate-100 flex flex-col gap-3 shrink-0">
               <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" className="h-14 rounded-2xl font-bold gap-2 ring-1 ring-slate-200" onClick={handlePrint}>
                     <Printer className="w-5 h-5 text-slate-400" /> 印刷
                  </Button>
                  <Button className="h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black gap-2 shadow-lg shadow-blue-100" onClick={handleDownloadPDF}>
                     <Download className="w-5 h-5" /> PDF保存
                  </Button>
               </div>
               <Button variant="ghost" className="w-full h-12 text-slate-400 font-bold" onClick={confirmIssueReceipt}>
                  発行完了として閉じる
               </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Collection Item Dialog */}
      <Dialog open={isAddItemOpen} onOpenChange={(open) => { if (!open) { setIsAddItemOpen(false); } }}>
        <DialogContent className="w-[95vw] sm:max-w-[95vw] md:max-w-lg p-0 overflow-hidden bg-white border-none rounded-3xl shadow-2xl">
          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-800 tracking-tight text-lg flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-600" />
                品目を追加
              </h3>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-slate-400" onClick={() => setIsAddItemOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-[10px] font-bold text-slate-500 uppercase">商品名 *</Label>
                <Input value={newItem.name || ''} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} className="h-10" placeholder="例: フロントバンパー" />
              </div>
              <div>
                <Label className="text-[10px] font-bold text-slate-500 uppercase">数量</Label>
                <Input type="number" min={1} value={newItem.quantity ?? 1} onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) })} className="h-10" />
              </div>
              <div>
                <Label className="text-[10px] font-bold text-slate-500 uppercase">重量(kg)</Label>
                <Input type="number" step="0.1" min={0} value={newItem.weight ?? ''} onChange={(e) => setNewItem({ ...newItem, weight: e.target.value === '' ? undefined : Number(e.target.value) })} className="h-10" />
              </div>
              <div>
                <Label className="text-[10px] font-bold text-slate-500 uppercase">車体番号</Label>
                <Input value={newItem.vinNumber || ''} onChange={(e) => setNewItem({ ...newItem, vinNumber: e.target.value })} className="h-10" />
              </div>
              <div>
                <Label className="text-[10px] font-bold text-slate-500 uppercase">部品番号</Label>
                <Input value={newItem.partNumber || ''} onChange={(e) => setNewItem({ ...newItem, partNumber: e.target.value })} className="h-10" />
              </div>
              <div>
                <Label className="text-[10px] font-bold text-slate-500 uppercase">車種</Label>
                <Input value={newItem.carModel || ''} onChange={(e) => setNewItem({ ...newItem, carModel: e.target.value })} className="h-10" />
              </div>
              <div>
                <Label className="text-[10px] font-bold text-slate-500 uppercase">型番</Label>
                <Input value={newItem.carModelNumber || ''} onChange={(e) => setNewItem({ ...newItem, carModelNumber: e.target.value })} className="h-10" />
              </div>
              <div className="col-span-2">
                <Label className="text-[10px] font-bold text-slate-500 uppercase">備考</Label>
                <Input value={newItem.notes || ''} onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })} className="h-10" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="ghost" className="flex-1 h-12 rounded-2xl text-slate-500 font-bold" onClick={() => setIsAddItemOpen(false)}>
                キャンセル
              </Button>
              <Button className="flex-[2] h-12 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-black shadow-lg shadow-amber-100" onClick={handleAddCollectionItem}>
                追加する
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Camera Capture Overlay */}
      <AnimatePresence>
        {isCapturing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center"
          >
             <div className="w-full max-w-sm aspect-[3/4] border-2 border-white/20 rounded-[40px] relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/10 to-transparent animate-scan" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border border-white/30 rounded-full animate-pulse" />
                <img 
                  src="https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=800&q=80" 
                  className="w-full h-full object-cover opacity-60 grayscale" 
                  alt="Camera view"
                />
             </div>
             <div className="mt-12 text-center space-y-4">
                <div className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center">
                   <div className="w-16 h-16 rounded-full bg-white active:scale-90 transition-transform" />
                </div>
                <p className="text-white font-black tracking-widest uppercase text-xs animate-pulse">Capturing Evidence...</p>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
