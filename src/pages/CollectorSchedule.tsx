import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Package,
  AlertCircle,
  CheckCircle2,
  MapPin,
  Truck,
  Map as MapIcon,
  List as ListIcon,
  Navigation,
  Camera,
  X,
  Plus,
  Trash2,
  Settings2,
  Phone,
  Printer,
  Image as ImageIcon,
  Wrench,
  Route,
  CalendarPlus,
  CalendarOff,
  Send,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  format,
  startOfWeek,
  addDays,
  isSameDay,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
} from 'date-fns';
import { ja } from 'date-fns/locale';
import {
  useCollections,
  addCollectionItem,
  updateCollectionItem,
  removeCollectionItem,
  updateCollection,
} from '@/src/stores/collectionsStore';
import { addReceipt } from '@/src/stores/receiptsStore';
import { useTasks, completeTask } from '@/src/stores/tasksStore';
import { Collection, CollectionItem } from '@/src/types';
import { MOCK_BRANCHES } from '@/src/mockData';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { useCurrentUser } from '@/src/stores/currentUserStore';
import { getJapaneseHolidayName } from '@/src/constants/holidaysJP';
import {
  submitLeaveRequest,
  submitPaidLeaveRequest,
  withdrawRequest,
  useShiftRequests,
  useShifts,
  getEffectiveHours,
  ShiftRequest,
} from '@/src/stores/shiftsStore';
import { useT } from '@/src/stores/i18nStore';

// Fix Leaflet icon issue
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

// 拠点（出発地）の緯度経度。大阪支店をデフォルトとする
const BASE_LOCATIONS: Record<string, { lat: number; lng: number; address: string }> = {
  大阪支店: { lat: 34.8159, lng: 135.5687, address: '大阪府茨木市横江1-17-6' },
  和歌山支店: { lat: 34.1545, lng: 135.2099, address: '和歌山県海南市舟尾378-1' },
  滋賀支店: { lat: 35.0044, lng: 135.8626, address: '滋賀県大津市馬場3-1-15' },
};

// 番号付きマーカーアイコンを作成
const createNumberedIcon = (n: number, color: string = '#f59e0b') =>
  L.divIcon({
    className: 'numbered-marker',
    html: `<div style="
      background:${color};
      color:#fff;
      width:32px;
      height:32px;
      border-radius:50%;
      display:flex;
      align-items:center;
      justify-content:center;
      font-weight:900;
      font-size:14px;
      box-shadow:0 4px 12px rgba(0,0,0,0.25);
      border:3px solid #fff;
    ">${n}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

const createBaseIcon = () =>
  L.divIcon({
    className: 'base-marker',
    html: `<div style="
      background:#0f172a;
      color:#fff;
      width:34px;
      height:34px;
      border-radius:8px;
      display:flex;
      align-items:center;
      justify-content:center;
      font-weight:900;
      font-size:11px;
      box-shadow:0 4px 12px rgba(0,0,0,0.25);
      border:3px solid #fff;
    ">拠点</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });

// Haversine 距離 (km)
function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const aa =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(aa));
}

// 貪欲法（最近傍）で順序を決定
function optimizeRoute(
  origin: { lat: number; lng: number },
  points: Collection[],
): Collection[] {
  const remaining = points.filter(
    (p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude),
  );
  const result: Collection[] = [];
  let current = origin;
  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const r = remaining[i];
      const d = distanceKm(current, { lat: r.latitude!, lng: r.longitude! });
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const picked = remaining.splice(bestIdx, 1)[0];
    result.push(picked);
    current = { lat: picked.latitude!, lng: picked.longitude! };
  }
  // 緯度経度のないものは最後に追加
  const noLoc = points.filter(
    (p) => !Number.isFinite(p.latitude) || !Number.isFinite(p.longitude),
  );
  return [...result, ...noLoc];
}

function buildGoogleMapsRouteUrl(
  origin: { lat: number; lng: number; address?: string },
  ordered: Collection[],
): string {
  const pts = ordered.filter(
    (c) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude),
  );
  if (pts.length === 0) return '';
  const dest = pts[pts.length - 1];
  const waypoints = pts
    .slice(0, -1)
    .map((c) => `${c.latitude},${c.longitude}`)
    .join('|');
  const params = new URLSearchParams();
  params.set('api', '1');
  params.set('origin', `${origin.lat},${origin.lng}`);
  params.set('destination', `${dest.latitude},${dest.longitude}`);
  if (waypoints) params.set('waypoints', waypoints);
  params.set('travelmode', 'driving');
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function buildGoogleMapsSingleUrl(c: Collection): string {
  if (Number.isFinite(c.latitude) && Number.isFinite(c.longitude)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${c.latitude},${c.longitude}&travelmode=driving`;
  }
  if (c.customerAddress) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      c.customerAddress,
    )}&travelmode=driving`;
  }
  return '';
}

export function CollectorSchedule() {
  const t = useT();
  const collections = useCollections();
  const allTasks = useTasks();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [displayMode, setDisplayMode] = useState<'list' | 'map'>('list');
  const [baseName, setBaseName] = useState<string>('大阪支店');

  // Workflow modal state
  const [activeCollection, setActiveCollection] = useState<Collection | null>(null);
  const [workflowStep, setWorkflowStep] = useState(0); // 0: nav, 1: arrival/items, 2: photos, 3: signature, 4: finish
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signatureName, setSignatureName] = useState('');
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [newItem, setNewItem] = useState<Partial<CollectionItem>>({
    name: '',
    category: 'その他',
    quantity: 1,
    condition: '中程度',
    collectionType: 'paid',
  });
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<Partial<CollectionItem>>({});

  const start = startOfWeek(currentDate, { locale: ja });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  const monthDays = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate),
  });

  const currentUser = useCurrentUser();
  const myCollectorId = currentUser?.id ?? 'u4';
  const myName = currentUser?.name ?? '回収員';

  // 自分の申告（休日 / 有給）
  const myRequests = useShiftRequests().filter((r) => r.userId === myCollectorId);
  useShifts();

  // 申告ダイアログ用 state
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [paidLeaveDialogOpen, setPaidLeaveDialogOpen] = useState(false);
  const [reqDate, setReqDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reqNote, setReqNote] = useState('');

  const openLeaveDialog = (date: Date) => {
    setReqDate(format(date, 'yyyy-MM-dd'));
    setReqNote('');
    setLeaveDialogOpen(true);
  };
  const openPaidLeaveDialog = (date: Date) => {
    setReqDate(format(date, 'yyyy-MM-dd'));
    setReqNote('');
    setPaidLeaveDialogOpen(true);
  };
  const submitLeave = () => {
    if (!reqDate) {
      toast.error('対象日を入力してください');
      return;
    }
    submitLeaveRequest({
      userId: myCollectorId,
      userName: myName,
      date: reqDate,
      note: reqNote || undefined,
    });
    toast.success(`${reqDate} ${t('request.holidayLeave')}`);
    setLeaveDialogOpen(false);
  };
  const submitPaidLeave = () => {
    if (!reqDate) {
      toast.error('対象日を入力してください');
      return;
    }
    submitPaidLeaveRequest({
      userId: myCollectorId,
      userName: myName,
      date: reqDate,
      note: reqNote || undefined,
    });
    toast.success(`${reqDate} ${t('request.paidLeave')}`);
    setPaidLeaveDialogOpen(false);
  };
  const cancelRequest = (r: ShiftRequest) => {
    withdrawRequest(r.id);
    toast.message(`${r.date} ${t('request.cancelTitle')}`);
  };

  // 当日の自分の案件
  const dailyCollectionsRaw = collections.filter(
    (c) =>
      (c.assignedCollectorId === myCollectorId || !c.assignedCollectorId) &&
      isSameDay(new Date(c.collectionDate || new Date()), selectedDate),
  );

  // 拠点の起点
  const origin = BASE_LOCATIONS[baseName] || BASE_LOCATIONS['大阪支店'];

  // 最適ルート順
  const orderedCollections = useMemo(
    () => optimizeRoute(origin, dailyCollectionsRaw),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dailyCollectionsRaw, baseName],
  );

  // 総走行距離 (km)
  const totalDistance = useMemo(() => {
    let cur = origin;
    let d = 0;
    for (const c of orderedCollections) {
      if (!Number.isFinite(c.latitude) || !Number.isFinite(c.longitude)) continue;
      d += distanceKm(cur, { lat: c.latitude!, lng: c.longitude! });
      cur = { lat: c.latitude!, lng: c.longitude! };
    }
    return d;
  }, [orderedCollections, origin]);

  const prevMonth = () => setCurrentDate(addDays(startOfMonth(currentDate), -1));
  const nextMonth = () => setCurrentDate(addDays(endOfMonth(currentDate), 1));

  // ----- Workflow handlers -----
  const openWorkflow = (col: Collection) => {
    setActiveCollection(col);
    setWorkflowStep(0);
    setCapturedPhotos([]);
    setSignatureData(null);
    setSignatureName('');
  };

  const closeWorkflow = () => {
    setActiveCollection(null);
    setWorkflowStep(0);
    setCapturedPhotos([]);
    setSignatureData(null);
    setSignatureName('');
    setEditingItemId(null);
  };

  const handleArrive = () => {
    if (!activeCollection) return;
    updateCollection(activeCollection.id, { status: 'received' });
    setActiveCollection({ ...activeCollection, status: 'received' });
    setWorkflowStep(1);
    toast.success(t('collector.recordArrival'));
  };

  const simulateCapture = () => {
    setIsCapturing(true);
    setTimeout(() => {
      const newPhoto = `https://picsum.photos/seed/${Date.now()}/800/600`;
      setCapturedPhotos((prev) => [...prev, newPhoto]);
      setIsCapturing(false);
      toast.success(t('collector.captureDone'), { duration: 1000 });
    }, 1200);
  };

  const handleAddItem = () => {
    if (!activeCollection) return;
    if (!newItem.name || !String(newItem.name).trim()) {
      toast.error(t('collector.itemNameMissing'));
      return;
    }
    const item: CollectionItem = {
      id: `ci-${Date.now()}`,
      name: String(newItem.name).trim(),
      category: newItem.category || 'その他',
      quantity: Number(newItem.quantity) > 0 ? Number(newItem.quantity) : 1,
      weight:
        newItem.weight !== undefined && newItem.weight !== null && String(newItem.weight) !== ''
          ? Number(newItem.weight)
          : undefined,
      partNumber: newItem.partNumber || undefined,
      vinNumber: newItem.vinNumber || undefined,
      carModel: newItem.carModel || undefined,
      notes: newItem.notes || undefined,
      condition: newItem.condition || '中程度',
      collectionType: newItem.collectionType || 'paid',
    };
    addCollectionItem(activeCollection.id, item);
    setActiveCollection({ ...activeCollection, items: [...activeCollection.items, item] });
    setNewItem({
      name: '',
      category: 'その他',
      quantity: 1,
      condition: '中程度',
      collectionType: 'paid',
    });
    setIsAddItemOpen(false);
    toast.success(t('collector.itemAdded'));
  };

  const handleStartEdit = (it: CollectionItem) => {
    setEditingItemId(it.id);
    setEditingDraft({ ...it });
  };
  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditingDraft({});
  };
  const handleSaveEdit = () => {
    if (!activeCollection || !editingItemId) return;
    if (!editingDraft.name || !String(editingDraft.name).trim()) {
      toast.error(t('collector.itemNameMissing'));
      return;
    }
    const patch: Partial<CollectionItem> = {
      ...editingDraft,
      quantity: Number(editingDraft.quantity) > 0 ? Number(editingDraft.quantity) : 1,
      weight:
        editingDraft.weight !== undefined &&
        editingDraft.weight !== null &&
        String(editingDraft.weight) !== ''
          ? Number(editingDraft.weight)
          : undefined,
    };
    updateCollectionItem(activeCollection.id, editingItemId, patch);
    setActiveCollection({
      ...activeCollection,
      items: activeCollection.items.map((it) =>
        it.id === editingItemId ? { ...it, ...patch } : it,
      ),
    });
    setEditingItemId(null);
    setEditingDraft({});
    toast.success(t('collector.itemUpdated'));
  };
  const handleDeleteItem = (id: string) => {
    if (!activeCollection) return;
    if (!window.confirm(t('collector.itemDeleteConfirm'))) return;
    removeCollectionItem(activeCollection.id, id);
    setActiveCollection({
      ...activeCollection,
      items: activeCollection.items.filter((it) => it.id !== id),
    });
    toast.success(t('collector.itemDeleted'));
  };

  const handleIssueReceipt = () => {
    if (!activeCollection) return;
    if (!signatureData) {
      toast.error(t('collector.signNotCaptured'));
      return;
    }
    const totalQuantity = activeCollection.items.reduce(
      (sum, it) => sum + (it.quantity || 0),
      0,
    );
    const totalWeight = activeCollection.items.reduce(
      (sum, it) => sum + (it.weight || 0) * (it.quantity || 1),
      0,
    );
    addReceipt({
      id: `rcpt-${activeCollection.id}-${Date.now()}`,
      collectionId: activeCollection.id,
      collectionNumber: activeCollection.collectionNumber,
      customerName: activeCollection.customerName,
      customerAddress: activeCollection.customerAddress,
      collectorId: myCollectorId,
      collectorName: '回収員 三郎',
      branchName: baseName,
      issuedAt: new Date().toISOString(),
      signatureData,
      signatureName: signatureName || undefined,
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
    // 現場での受領書発行: 受領状態(=拠点搬入待ち) のまま receiptIssued のみ true に更新する。
    // 買取金額の確定は 拠点側の「分別作業 (tm6)」完了時 (EmployeeHome.finishSorting) で行い、
    // そこで status を 'completed' に遷移させる。
    updateCollection(activeCollection.id, {
      receiptIssued: true,
      status: 'received',
    });
    setActiveCollection({
      ...activeCollection,
      receiptIssued: true,
      status: 'received',
    });
    // 関連する tm7（出張回収）タスクを完了マーク → スケジュールから消える
    const tm7Task = allTasks.find(
      (t) =>
        t.taskMasterId === 'tm7' &&
        t.targetType === 'collection' &&
        t.targetId === activeCollection.id &&
        t.status !== 'completed',
    );
    if (tm7Task) completeTask(tm7Task.id);
    toast.success(t('collector.eReceiptIssued'), {
      description: t('collector.eReceiptDesc'),
    });
    setWorkflowStep(4);
  };

  return (
    <div className="p-4 space-y-6 pb-24 h-full overflow-y-auto bg-slate-50">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#1e293b]">{t('collector.scheduleTitle')}</h2>
          <div className="flex items-center gap-2">
            <select
              value={baseName}
              onChange={(e) => setBaseName(e.target.value)}
              className="text-[10px] font-bold border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700"
            >
              {MOCK_BRANCHES.map((b) => (
                <option key={b.id} value={b.name}>
                  {b.name} {t('collector.baseStart')}
                </option>
              ))}
            </select>
            <div className="flex items-center bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setViewMode('week')}
                className={cn(
                  'px-3 py-1.5 text-[10px] font-bold rounded-md transition-all',
                  viewMode === 'week' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500',
                )}
              >
                {t('collector.weekShort')}
              </button>
              <button
                onClick={() => setViewMode('month')}
                className={cn(
                  'px-3 py-1.5 text-[10px] font-bold rounded-md transition-all',
                  viewMode === 'month' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500',
                )}
              >
                {t('collector.monthShort')}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs font-bold">
            {format(currentDate, 'yyyy年MM月', { locale: ja })}
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {viewMode === 'week' ? (
        <div className="flex justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          {weekDays.map((day, i) => {
            const isSelected = isSameDay(day, selectedDate);
            const isToday = isSameDay(day, new Date());
            const dStr = format(day, 'yyyy-MM-dd');
            const eff = getEffectiveHours(myCollectorId, dStr);
            const isHoliday = eff.isHoliday;
            const jpName = eff.holidayName ?? getJapaneseHolidayName(dStr);
            const isJpHoliday = eff.source === 'holiday' || Boolean(jpName);
            return (
              <button
                key={i}
                onClick={() => setSelectedDate(day)}
                title={jpName ?? undefined}
                className={cn(
                  'flex flex-col items-center gap-1.5 w-10 py-2 rounded-xl transition-all',
                  isSelected
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-100'
                    : isHoliday
                      ? 'bg-rose-50 hover:bg-rose-100'
                      : 'hover:bg-slate-50',
                )}
              >
                <span
                  className={cn(
                    'text-[10px] font-bold uppercase',
                    isSelected ? 'text-blue-100' : isHoliday ? 'text-rose-500' : 'text-slate-400',
                  )}
                >
                  {format(day, 'E', { locale: ja })}
                </span>
                <span className={cn('text-sm font-bold', !isSelected && isHoliday && 'text-rose-500')}>
                  {format(day, 'd')}
                </span>
                {isToday && !isSelected && <div className="w-1 h-1 bg-blue-600 rounded-full" />}
                {!isSelected && isHoliday && (
                  <span className="text-[8px] font-black text-rose-500">
                    {isJpHoliday ? t('schedule.holidayMark') : t('schedule.dayOffMark')}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
          {['日', '月', '火', '水', '木', '金', '土'].map((d) => (
            <div key={d} className="text-center text-[9px] font-bold text-slate-400 py-1">
              {d}
            </div>
          ))}
          {monthDays.map((day, i) => {
            const isSelected = isSameDay(day, selectedDate);
            const isToday = isSameDay(day, new Date());
            const hasTasks = collections.some(
              (c) =>
                (c.assignedCollectorId === myCollectorId || !c.assignedCollectorId) &&
                isSameDay(new Date(c.collectionDate || new Date()), day),
            );
            const dStr = format(day, 'yyyy-MM-dd');
            const eff = getEffectiveHours(myCollectorId, dStr);
            const isHoliday = eff.isHoliday;
            const jpName = eff.holidayName ?? getJapaneseHolidayName(dStr);
            const isJpHoliday = eff.source === 'holiday' || Boolean(jpName);

            return (
              <button
                key={i}
                onClick={() => setSelectedDate(day)}
                title={jpName ?? undefined}
                className={cn(
                  'aspect-square flex flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] relative transition-all',
                  isSelected
                    ? 'bg-blue-600 text-white z-10 scale-105 shadow-md'
                    : !isSameMonth(day, currentDate)
                      ? 'text-slate-200'
                      : isHoliday
                        ? 'bg-rose-50 text-rose-500 hover:bg-rose-100'
                        : 'hover:bg-slate-50 text-slate-700',
                )}
              >
                <span>{format(day, 'd')}</span>
                {hasTasks && (
                  <div
                    className={cn(
                      'w-1 h-1 rounded-full',
                      isSelected ? 'bg-white' : 'bg-blue-400',
                    )}
                  />
                )}
                {!isSelected && isSameMonth(day, currentDate) && isHoliday && !hasTasks && (
                  <span className="text-[7px] font-black opacity-70">
                    {isJpHoliday ? t('schedule.holidayMark') : t('schedule.dayOffMark')}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* 休日申請 / 有給申請 ボタン */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          onClick={() => openLeaveDialog(selectedDate)}
          variant="outline"
          className="h-11 bg-white border-rose-100 text-rose-600 hover:bg-rose-50 text-xs font-bold gap-2 rounded-xl shadow-sm"
        >
          <CalendarOff className="w-4 h-4" />
          {t('request.holidayLeave')}
        </Button>
        <Button
          onClick={() => openPaidLeaveDialog(selectedDate)}
          className="h-11 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold gap-2 rounded-xl shadow-sm"
        >
          <CalendarPlus className="w-4 h-4" />
          {t('request.paidLeave')}
        </Button>
      </div>

      {/* 申告履歴（折りたたまずに直近を表示） */}
      {myRequests.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm">{t('request.historyTitle')}</h3>
            <Badge
              variant="secondary"
              className="bg-slate-100 text-slate-600 border-none px-2 py-0.5 text-[10px]"
            >
              {myRequests.length}
            </Badge>
          </div>
          <div className="space-y-2">
            {myRequests.slice(0, 5).map((r) => (
              <Card
                key={r.id}
                className="border-none shadow-sm rounded-xl p-3 flex items-center justify-between gap-3 bg-white"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge
                      className={cn(
                        'text-[9px] font-bold border',
                        r.type === 'paid_leave'
                          ? 'bg-amber-50 text-amber-700 border-amber-100'
                          : r.type === 'leave'
                            ? 'bg-rose-50 text-rose-700 border-rose-100'
                            : 'bg-blue-50 text-blue-700 border-blue-100',
                      )}
                    >
                      {r.type === 'paid_leave' ? t('request.typePaid') : r.type === 'leave' ? t('request.typeLeave') : t('request.typeShift')}
                    </Badge>
                    <span className="text-xs font-bold text-slate-800 font-mono">{r.date}</span>
                    {r.type === 'shift' && r.startTime && r.endTime && (
                      <span className="text-[10px] text-slate-500 font-mono">
                        {r.startTime}〜{r.endTime}
                      </span>
                    )}
                  </div>
                  {r.note && (
                    <p className="text-[10px] text-slate-500 mt-1 truncate">{r.note}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    className={cn(
                      'text-[9px] font-bold border',
                      r.status === 'pending'
                        ? 'bg-amber-50 text-amber-700 border-amber-100'
                        : r.status === 'approved'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        : 'bg-slate-100 text-slate-500 border-slate-200',
                    )}
                  >
                    {r.status === 'pending'
                      ? t('request.statusPending')
                      : r.status === 'approved'
                      ? t('request.statusApproved')
                      : t('request.statusRejected')}
                  </Badge>
                  {r.status === 'pending' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => cancelRequest(r)}
                      className="h-7 w-7 text-slate-400 hover:text-rose-500"
                      title={t('request.cancelTitle')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 当日の出勤ステータス（祝日 / 休日 を含む実効稼働の表示） */}
      {(() => {
        const dStr = format(selectedDate, 'yyyy-MM-dd');
        const eff = getEffectiveHours(myCollectorId, dStr);
        const jpName = eff.holidayName ?? getJapaneseHolidayName(dStr);
        const sourceLabel =
          eff.source === 'shift'
            ? t('schedule.shiftApproved')
            : eff.source === 'leave'
              ? t('schedule.holidayApproved')
              : eff.source === 'holiday'
                ? `${t('schedule.holidayPrefix')}: ${jpName ?? ''}`
                : t('schedule.normalAttendance');
        return (
          <Card
            className={cn(
              'border-none shadow-sm rounded-2xl p-4 flex items-center gap-3',
              eff.isHoliday
                ? 'bg-rose-50 ring-1 ring-rose-100'
                : eff.source === 'shift'
                  ? 'bg-emerald-50 ring-1 ring-emerald-100'
                  : 'bg-blue-50 ring-1 ring-blue-100',
            )}
          >
            <div
              className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                eff.isHoliday
                  ? 'bg-rose-100 text-rose-600'
                  : eff.source === 'shift'
                    ? 'bg-emerald-100 text-emerald-600'
                    : 'bg-blue-100 text-blue-600',
              )}
            >
              {eff.isHoliday ? <CalendarOff className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                {sourceLabel}
              </p>
              <p className={cn('text-sm font-bold', eff.isHoliday ? 'text-rose-700' : 'text-slate-800')}>
                {eff.isHoliday ? t('schedule.holiday') : `${eff.start} 〜 ${eff.end} ${t('collector.scheduledHours')}`}
              </p>
            </div>
          </Card>
        );
      })()}

      {/* View toggle (List / Map) */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-800 text-sm">
            {format(selectedDate, 'MM月dd日 (E)', { locale: ja })} {t('collector.collectionPlanFor')}
          </h3>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {orderedCollections.length} ・ {t('collector.casesAndDistance')} {totalDistance.toFixed(1)} km
          </p>
        </div>
        <div className="flex items-center bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setDisplayMode('list')}
            className={cn(
              'px-3 py-1.5 text-[10px] font-bold rounded-md transition-all flex items-center gap-1',
              displayMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500',
            )}
          >
            <ListIcon className="w-3 h-3" /> {t('collector.list')}
          </button>
          <button
            onClick={() => setDisplayMode('map')}
            className={cn(
              'px-3 py-1.5 text-[10px] font-bold rounded-md transition-all flex items-center gap-1',
              displayMode === 'map' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500',
            )}
          >
            <MapIcon className="w-3 h-3" /> {t('collector.map')}
          </button>
        </div>
      </div>

      {/* Bulk Google Maps route button */}
      {orderedCollections.length > 0 && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-4 text-white shadow-lg shadow-blue-200">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Route className="w-4 h-4" />
                <p className="text-[10px] font-black uppercase tracking-widest">{t('collector.optimalRoute')}</p>
              </div>
              <p className="text-xs font-bold">
                {baseName} → {orderedCollections.length} {t('collector.routeSummary')} ・ {totalDistance.toFixed(1)} km
              </p>
            </div>
            <a
              href={buildGoogleMapsRouteUrl(origin, orderedCollections)}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white text-blue-700 hover:bg-blue-50 h-10 px-4 rounded-xl font-black text-[10px] flex items-center gap-1.5 shadow-md shrink-0"
            >
              <Navigation className="w-3.5 h-3.5" /> {t('collector.openMapNav')}
            </a>
          </div>
        </div>
      )}

      {/* Map Mode */}
      {displayMode === 'map' && orderedCollections.length > 0 && (
        <div className="h-[400px] rounded-2xl overflow-hidden ring-1 ring-slate-200 shadow-sm bg-white">
          <MapContainer
            center={[origin.lat, origin.lng]}
            zoom={10}
            scrollWheelZoom
            className="h-full w-full"
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="© OpenStreetMap"
            />
            {/* 拠点マーカー */}
            <Marker position={[origin.lat, origin.lng]} icon={createBaseIcon()}>
              <Popup>
                <div className="text-xs">
                  <div className="font-bold">{baseName}（出発地）</div>
                  <div className="text-slate-500">{origin.address}</div>
                </div>
              </Popup>
            </Marker>
            {/* ルート順番号付きマーカー */}
            {orderedCollections
              .filter(
                (c) =>
                  Number.isFinite(c.latitude as number) && Number.isFinite(c.longitude as number),
              )
              .map((c, idx) => (
                <Marker
                  key={c.id}
                  position={[c.latitude!, c.longitude!]}
                  icon={createNumberedIcon(idx + 1, c.status === 'completed' ? '#10b981' : '#f59e0b')}
                >
                  <Popup>
                    <div className="text-xs space-y-1 min-w-[200px]">
                      <div className="font-bold">
                        {idx + 1}. {c.customerName}
                      </div>
                      <div className="text-slate-500">{c.customerAddress}</div>
                      <div className="text-slate-500">{c.items.length} {t('collector.itemsCount')}</div>
                      <div className="flex gap-2 pt-2">
                        <a
                          href={buildGoogleMapsSingleUrl(c)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-blue-600 text-white px-2 py-1 rounded text-[10px] font-bold"
                        >
                          {t('collector.routeNav')}
                        </a>
                        <button
                          onClick={() => openWorkflow(c)}
                          className="bg-amber-600 text-white px-2 py-1 rounded text-[10px] font-bold"
                        >
                          {t('collector.start')}
                        </button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
          </MapContainer>
        </div>
      )}

      {/* List Mode */}
      {displayMode === 'list' && (
        <div className="space-y-4">
          {orderedCollections.length > 0 ? (
            orderedCollections.map((col, idx) => (
              <Card
                key={col.id}
                className="border-none shadow-sm rounded-2xl overflow-hidden bg-white"
              >
                <div className="flex">
                  <div
                    className={cn(
                      'w-1.5',
                      col.status === 'completed'
                        ? 'bg-emerald-400'
                        : col.status === 'received'
                          ? 'bg-blue-400'
                          : 'bg-amber-400',
                    )}
                  />
                  <CardContent className="p-4 flex-1">
                    <div className="flex justify-between items-start mb-3 gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center font-black text-xs shrink-0">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h4 className="font-bold text-slate-900 text-sm">{col.customerName}</h4>
                            <Badge className="bg-slate-50 text-slate-500 border-none text-[8px] h-4 px-1">
                              {col.collectionNumber}
                            </Badge>
                            {col.receiptIssued && (
                              <Badge className="bg-emerald-50 text-emerald-700 border-none text-[8px] h-4 px-1">
                                {t('collector.receiptIssued')}
                              </Badge>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="truncate">{col.customerAddress}</span>
                          </p>
                          {col.customerPhone && (
                            <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3" /> {col.customerPhone}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-50 gap-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-1 text-[10px] text-slate-600 font-medium">
                          <Package className="w-3 h-3 text-slate-400" />
                          <span>{col.items.length} {t('collector.itemsCount')}</span>
                        </div>
                        {col.shippingFeeApplicable && (
                          <Badge
                            variant="outline"
                            className="text-[9px] h-4 px-1 border-amber-200 text-amber-700"
                          >
                            {t('collector.shippingFee')}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={buildGoogleMapsSingleUrl(col)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 h-8 rounded-lg text-[10px] px-2 font-bold flex items-center gap-1"
                        >
                          <Navigation className="w-3 h-3" /> Map
                        </a>
                        <Button
                          size="sm"
                          className="bg-amber-600 hover:bg-amber-700 h-8 rounded-lg text-[10px] px-3 font-bold"
                          onClick={() => openWorkflow(col)}
                        >
                          {t('collector.start')}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </div>
              </Card>
            ))
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3 italic bg-white rounded-2xl shadow-sm border border-slate-50">
              <Truck className="w-12 h-12 opacity-10" />
              <p className="text-xs">{t('collector.noCollections')}</p>
            </div>
          )}
        </div>
      )}

      {/* Summary Footer */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-amber-50 border-none shadow-none rounded-2xl p-4">
          <p className="text-[10px] font-bold text-amber-600 uppercase mb-1">{t('collector.todaysCases')}</p>
          <div className="flex items-end gap-1">
            <span className="text-xl font-black text-amber-900">
              {orderedCollections.length}
            </span>
            <span className="text-[10px] text-amber-700 mb-1">{t('collector.cases')}</span>
          </div>
        </Card>
        <Card className="bg-slate-900 border-none shadow-none rounded-2xl p-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> {t('collector.incomplete')}
          </p>
          <div className="flex items-end gap-1">
            <span className="text-xl font-black text-white">
              {orderedCollections.filter((c) => c.status !== 'completed').length}
            </span>
            <span className="text-[10px] text-slate-400 mb-1">{t('collector.cases')}</span>
          </div>
        </Card>
      </div>

      {/* ============== Workflow Modal ============== */}
      <Dialog open={!!activeCollection} onOpenChange={(o) => !o && closeWorkflow()}>
        <DialogContent className="p-0 overflow-hidden bg-[#f8fafc] border-none max-w-2xl h-[90vh]">
          {activeCollection && (
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="bg-white px-6 py-4 flex items-center justify-between border-b border-slate-100 shadow-sm shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-slate-800 tracking-tight">
                      {activeCollection.customerName} {t('collector.customerSan')}
                    </h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      Step {workflowStep + 1} / 5
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-xl text-slate-400"
                  onClick={closeWorkflow}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Step Progress */}
                <div className="flex gap-2">
                  {[0, 1, 2, 3, 4].map((s) => (
                    <div key={s} className="flex-1">
                      <div
                        className={cn(
                          'h-1.5 rounded-full transition-all duration-500',
                          s <= workflowStep
                            ? 'bg-amber-600 shadow-sm shadow-amber-200'
                            : 'bg-slate-200',
                        )}
                      />
                    </div>
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  {/* Step 0: Navigation */}
                  {workflowStep === 0 && (
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
                          <h3 className="font-black tracking-tight text-lg">{t('collector.navToDest')}</h3>
                        </div>
                        <div className="h-48 rounded-2xl bg-slate-100 overflow-hidden ring-1 ring-slate-200">
                          {(() => {
                            const addr = activeCollection.customerAddress || '';
                            const lat = activeCollection.latitude;
                            const lng = activeCollection.longitude;
                            const q = addr
                              ? encodeURIComponent(addr)
                              : Number.isFinite(lat) && Number.isFinite(lng)
                                ? `${lat},${lng}`
                                : '';
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
                                {t('collector.noAddress')}
                              </div>
                            );
                          })()}
                        </div>
                        <div className="p-4 bg-amber-50/50 rounded-2xl space-y-2 border border-amber-100/50">
                          <div className="flex justify-between items-center text-[10px] font-black uppercase text-amber-700">
                            <span>{t('collector.collectionAddress')}</span>
                            {activeCollection.customerPhone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" /> {activeCollection.customerPhone}
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-bold text-slate-700">
                            {activeCollection.customerAddress}
                          </p>
                        </div>
                        <a
                          href={buildGoogleMapsSingleUrl(activeCollection)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2"
                        >
                          <Navigation className="w-4 h-4" /> {t('collector.openMapNav')}
                        </a>
                        <Button
                          className="w-full h-16 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-black text-lg shadow-xl shadow-amber-200 transition-all active:scale-95"
                          onClick={handleArrive}
                        >
                          {t('collector.confirmArrival')}
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 1: Items / Item CRUD */}
                  {workflowStep === 1 && (
                    <motion.div
                      key="check"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-4"
                    >
                      <div className="flex justify-between items-center px-1">
                        <h3 className="font-black text-slate-800 flex items-center gap-2">
                          <Package className="w-5 h-5 text-amber-600" />
                          {t('collector.itemsCheck')}
                        </h3>
                        <Badge
                          variant="outline"
                          className="text-[10px] font-black border-slate-200"
                        >
                          {activeCollection.items.length} {t('collector.points')}
                        </Badge>
                      </div>
                      <div className="space-y-3">
                        {activeCollection.items.map((it) => {
                          const isEditing = editingItemId === it.id;
                          return (
                            <div
                              key={it.id}
                              className="bg-white p-4 rounded-2xl shadow-sm ring-1 ring-slate-100"
                            >
                              {isEditing ? (
                                <div className="space-y-2">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="col-span-2">
                                      <Label className="text-[10px] font-bold text-slate-500 uppercase">
                                        {t('collector.itemNameRequired').replace(' *', '')}
                                      </Label>
                                      <Input
                                        value={editingDraft.name || ''}
                                        onChange={(e) =>
                                          setEditingDraft({
                                            ...editingDraft,
                                            name: e.target.value,
                                          })
                                        }
                                        className="h-9 text-sm"
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-[10px] font-bold text-slate-500 uppercase">
                                        {t('collector.qty')}
                                      </Label>
                                      <Input
                                        type="number"
                                        min={1}
                                        value={editingDraft.quantity ?? ''}
                                        onChange={(e) =>
                                          setEditingDraft({
                                            ...editingDraft,
                                            quantity: Number(e.target.value),
                                          })
                                        }
                                        className="h-9 text-sm"
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-[10px] font-bold text-slate-500 uppercase">
                                        {t('collector.weightKg')}
                                      </Label>
                                      <Input
                                        type="number"
                                        step="0.1"
                                        min={0}
                                        value={editingDraft.weight ?? ''}
                                        onChange={(e) =>
                                          setEditingDraft({
                                            ...editingDraft,
                                            weight:
                                              e.target.value === ''
                                                ? undefined
                                                : Number(e.target.value),
                                          })
                                        }
                                        className="h-9 text-sm"
                                      />
                                    </div>
                                    <div className="col-span-2">
                                      <Label className="text-[10px] font-bold text-slate-500 uppercase">
                                        {t('collector.note')}
                                      </Label>
                                      <Input
                                        value={editingDraft.notes || ''}
                                        onChange={(e) =>
                                          setEditingDraft({
                                            ...editingDraft,
                                            notes: e.target.value,
                                          })
                                        }
                                        className="h-9 text-sm"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex gap-2 pt-1">
                                    <Button
                                      size="sm"
                                      className="flex-1 h-9 bg-amber-600 hover:bg-amber-700 text-white font-bold"
                                      onClick={handleSaveEdit}
                                    >
                                      {t('collector.save')}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="flex-1 h-9 text-slate-500 font-bold"
                                      onClick={handleCancelEdit}
                                    >
                                      {t('common.cancel')}
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex justify-between items-start gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="font-bold text-slate-800 text-sm truncate">
                                        {it.name}
                                      </p>
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] font-black border-slate-200 shrink-0"
                                      >
                                        {it.quantity}{t('collector.itemQty')}
                                      </Badge>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1 text-[10px] text-slate-500 font-medium">
                                      {it.weight !== undefined && (
                                        <span>
                                          {t('collector.weightLabel')}:{' '}
                                          <span className="text-slate-700">{it.weight}kg</span>
                                        </span>
                                      )}
                                      {it.partNumber && (
                                        <span className="truncate">
                                          {t('collector.partLabel')}:{' '}
                                          <span className="text-slate-700">{it.partNumber}</span>
                                        </span>
                                      )}
                                      {it.carModel && (
                                        <span className="truncate">
                                          {t('collector.carModelLabel')}:{' '}
                                          <span className="text-slate-700">{it.carModel}</span>
                                        </span>
                                      )}
                                    </div>
                                    {it.notes && (
                                      <p className="text-[10px] text-slate-400 mt-1 truncate">
                                        {t('collector.noteLabel')}: {it.notes}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex gap-1 shrink-0">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 w-8 p-0 rounded-lg text-slate-500 hover:text-amber-600"
                                      onClick={() => handleStartEdit(it)}
                                    >
                                      <Settings2 className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 w-8 p-0 rounded-lg text-slate-400 hover:text-red-600"
                                      onClick={() => handleDeleteItem(it.id)}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        <Button
                          variant="outline"
                          className="w-full h-12 border-dashed border-2 rounded-2xl text-slate-500 font-bold text-xs gap-2 hover:border-amber-400 hover:text-amber-600"
                          onClick={() => setIsAddItemOpen(true)}
                        >
                          <Plus className="w-4 h-4" /> {t('collector.addItem')}
                        </Button>
                      </div>
                      <Button
                        className="w-full h-16 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-black text-lg shadow-xl shadow-amber-200 transition-all active:scale-95"
                        onClick={() => setWorkflowStep(2)}
                        disabled={activeCollection.items.length === 0}
                      >
                        {t('collector.checkDoneNext')}
                      </Button>
                    </motion.div>
                  )}

                  {/* Step 2: Photos */}
                  {workflowStep === 2 && (
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
                          <h3 className="font-black tracking-tight text-lg">{t('collector.photoTitle')}</h3>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          {capturedPhotos.length > 0 ? (
                            capturedPhotos.map((p, i) => (
                              <div
                                key={i}
                                className="aspect-square rounded-2xl bg-slate-100 overflow-hidden relative ring-1 ring-slate-200"
                              >
                                <img
                                  src={p}
                                  alt="Captured"
                                  className="w-full h-full object-cover"
                                />
                                <button
                                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px]"
                                  onClick={() =>
                                    setCapturedPhotos((prev) => prev.filter((_, idx) => idx !== i))
                                  }
                                >
                                  ×
                                </button>
                              </div>
                            ))
                          ) : (
                            <div className="col-span-2 py-10 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-3xl space-y-2 text-slate-300">
                              <ImageIcon className="w-10 h-10" />
                              <p className="text-[10px] font-black uppercase tracking-widest">
                                No Photos Captured
                              </p>
                            </div>
                          )}
                        </div>

                        <Button
                          className="w-full h-20 bg-slate-900 hover:bg-slate-800 text-white rounded-3xl font-black text-base shadow-xl shadow-slate-200 transition-all active:scale-95 flex flex-col gap-1 items-center justify-center"
                          onClick={simulateCapture}
                          disabled={isCapturing}
                        >
                          <Camera className="w-6 h-6" />
                          <span>{isCapturing ? t('collector.capturing') : t('collector.startCapture')}</span>
                        </Button>

                        <div className="flex gap-3">
                          <Button
                            variant="ghost"
                            className="h-14 flex-1 rounded-2xl text-slate-400 font-bold"
                            onClick={() => setWorkflowStep(1)}
                          >
                            {t('collector.back')}
                          </Button>
                          <Button
                            disabled={capturedPhotos.length === 0}
                            className="h-14 flex-[2] bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-black shadow-lg shadow-amber-100 transition-all active:scale-95"
                            onClick={() => setWorkflowStep(3)}
                          >
                            {t('collector.captureDoneNext')}
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 3: Signature & Receipt */}
                  {workflowStep === 3 && (
                    <motion.div
                      key="signature"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="space-y-6"
                    >
                      <div className="bg-white p-6 rounded-3xl ring-1 ring-slate-100 shadow-xl shadow-slate-200/40 space-y-4">
                        <div className="flex items-center gap-2 text-amber-600">
                          <Wrench className="w-5 h-5" />
                          <h3 className="font-black tracking-tight text-lg">{t('collector.eReceiptTitle')}</h3>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-2xl space-y-2">
                          <div className="flex justify-between text-[11px] text-slate-500">
                            <span>{t('collector.collectionNo')}</span>
                            <span className="font-mono font-bold text-slate-700">
                              {activeCollection.collectionNumber}
                            </span>
                          </div>
                          <div className="flex justify-between text-[11px] text-slate-500">
                            <span>{t('collector.collectionDateTime')}</span>
                            <span className="font-bold text-slate-700">
                              {format(new Date(), 'yyyy/MM/dd HH:mm', { locale: ja })}
                            </span>
                          </div>
                          <div className="flex justify-between text-[11px] text-slate-500">
                            <span>{t('collector.totalItems')}</span>
                            <span className="font-bold text-slate-700">
                              {activeCollection.items.length} {t('collector.points')} ・{' '}
                              {activeCollection.items
                                .reduce((s, it) => s + (it.quantity || 0), 0)
                                .toLocaleString()}{' '}
                              {t('collector.itemQty')}
                            </span>
                          </div>
                          <div className="flex justify-between text-[11px] text-slate-500">
                            <span>{t('collector.totalWeight')}</span>
                            <span className="font-bold text-slate-700">
                              {activeCollection.items
                                .reduce(
                                  (s, it) => s + (it.weight || 0) * (it.quantity || 1),
                                  0,
                                )
                                .toFixed(1)}{' '}
                              kg
                            </span>
                          </div>
                          <p className="text-[9px] text-slate-400 leading-relaxed border-t border-slate-100 pt-2">
                            {t('collector.priceNote')}
                          </p>
                        </div>

                        <div>
                          <Label className="text-[10px] font-bold text-slate-500 uppercase">
                            {t('collector.customerName')}
                          </Label>
                          <Input
                            placeholder="例: 田中 太郎"
                            value={signatureName}
                            onChange={(e) => setSignatureName(e.target.value)}
                            className="h-9 text-sm"
                          />
                        </div>

                        <div
                          className="h-32 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center cursor-crosshair"
                          onClick={() => setSignatureData('signed')}
                        >
                          {signatureData ? (
                            <p className="font-serif italic text-2xl text-slate-800">
                              {signatureName || 'Signed'} ({t('collector.signed')})
                            </p>
                          ) : (
                            <p className="text-[10px] text-slate-400 font-bold tracking-widest">
                              {t('collector.tapToSign')}
                            </p>
                          )}
                        </div>

                        <div className="flex gap-3">
                          <Button
                            variant="ghost"
                            className="h-14 flex-1 rounded-2xl text-slate-400 font-bold"
                            onClick={() => setWorkflowStep(2)}
                          >
                            {t('collector.back')}
                          </Button>
                          <Button
                            disabled={!signatureData}
                            className="h-14 flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black shadow-lg shadow-emerald-100 transition-all active:scale-95"
                            onClick={handleIssueReceipt}
                          >
                            <Printer className="w-4 h-4 mr-2" /> {t('collector.issueReceipt')}
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 4: Finish */}
                  {workflowStep === 4 && (
                    <motion.div
                      key="finish"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-6"
                    >
                      <div className="bg-white p-6 rounded-3xl ring-1 ring-slate-100 shadow-xl shadow-slate-200/40 space-y-4 text-center">
                        <div className="w-20 h-20 mx-auto bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600">
                          <CheckCircle2 className="w-10 h-10" />
                        </div>
                        <h3 className="font-black text-lg tracking-tight">{t('collector.collectionDone')}</h3>
                        <p className="text-xs text-slate-500">
                          {t('collector.doneDesc1')}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {t('collector.doneDesc2')}
                        </p>
                        <Button
                          className="w-full h-14 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-black"
                          onClick={closeWorkflow}
                        >
                          {t('collector.nextCase')}
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Item Dialog */}
      <Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
        <DialogContent className="max-w-md">
          <h3 className="font-black text-slate-800 mb-4">{t('collector.addItemTitle')}</h3>
          <div className="space-y-3">
            <div>
              <Label className="text-[10px] font-bold text-slate-500 uppercase">{t('collector.itemNameRequired')}</Label>
              <Input
                value={newItem.name || ''}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                className="h-10"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] font-bold text-slate-500 uppercase">{t('collector.qty')}</Label>
                <Input
                  type="number"
                  min={1}
                  value={newItem.quantity ?? 1}
                  onChange={(e) =>
                    setNewItem({ ...newItem, quantity: Number(e.target.value) })
                  }
                  className="h-10"
                />
              </div>
              <div>
                <Label className="text-[10px] font-bold text-slate-500 uppercase">{t('collector.weightKg')}</Label>
                <Input
                  type="number"
                  step="0.1"
                  min={0}
                  value={newItem.weight ?? ''}
                  onChange={(e) =>
                    setNewItem({
                      ...newItem,
                      weight: e.target.value === '' ? undefined : Number(e.target.value),
                    })
                  }
                  className="h-10"
                />
              </div>
              <div>
                <Label className="text-[10px] font-bold text-slate-500 uppercase">{t('collector.partNumber')}</Label>
                <Input
                  value={newItem.partNumber || ''}
                  onChange={(e) => setNewItem({ ...newItem, partNumber: e.target.value })}
                  className="h-10"
                />
              </div>
              <div>
                <Label className="text-[10px] font-bold text-slate-500 uppercase">{t('collector.carModel')}</Label>
                <Input
                  value={newItem.carModel || ''}
                  onChange={(e) => setNewItem({ ...newItem, carModel: e.target.value })}
                  className="h-10"
                />
              </div>
            </div>
            <div>
              <Label className="text-[10px] font-bold text-slate-500 uppercase">{t('collector.note')}</Label>
              <Input
                value={newItem.notes || ''}
                onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
                className="h-10"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="ghost"
                className="flex-1 h-10"
                onClick={() => setIsAddItemOpen(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button
                className="flex-1 h-10 bg-amber-600 hover:bg-amber-700 text-white font-bold"
                onClick={handleAddItem}
              >
                {t('collector.add')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 休日申請ダイアログ */}
      <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarOff className="w-4 h-4 text-rose-600" />
              {t('request.holidayLeave')}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t('request.holidayLeaveDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="cs-leave-date" className="text-[11px] font-bold">{t('request.targetDate')}</Label>
              <Input
                id="cs-leave-date"
                type="date"
                value={reqDate}
                onChange={(e) => setReqDate(e.target.value)}
                className="mt-1 h-9 text-xs"
              />
            </div>
            <div>
              <Label htmlFor="cs-leave-note" className="text-[11px] font-bold">{t('request.reasonOptional')}</Label>
              <Textarea
                id="cs-leave-note"
                value={reqNote}
                onChange={(e) => setReqNote(e.target.value)}
                placeholder={t('request.holidayLeavePlaceholder')}
                className="mt-1 text-xs min-h-[64px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaveDialogOpen(false)} className="h-9 text-xs">
              {t('common.cancel')}
            </Button>
            <Button onClick={submitLeave} className="h-9 text-xs bg-rose-600 hover:bg-rose-700 text-white gap-1">
              <Send className="w-3.5 h-3.5" /> {t('request.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 有給申請ダイアログ */}
      <Dialog open={paidLeaveDialogOpen} onOpenChange={setPaidLeaveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarPlus className="w-4 h-4 text-amber-600" />
              {t('request.paidLeave')}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t('request.paidLeaveDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="cs-paid-leave-date" className="text-[11px] font-bold">{t('request.targetDate')}</Label>
              <Input
                id="cs-paid-leave-date"
                type="date"
                value={reqDate}
                onChange={(e) => setReqDate(e.target.value)}
                className="mt-1 h-9 text-xs"
              />
            </div>
            <div>
              <Label htmlFor="cs-paid-leave-note" className="text-[11px] font-bold">{t('request.reasonOptional')}</Label>
              <Textarea
                id="cs-paid-leave-note"
                value={reqNote}
                onChange={(e) => setReqNote(e.target.value)}
                placeholder={t('request.paidLeavePlaceholder')}
                className="mt-1 text-xs min-h-[64px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaidLeaveDialogOpen(false)} className="h-9 text-xs">
              {t('common.cancel')}
            </Button>
            <Button onClick={submitPaidLeave} className="h-9 text-xs bg-amber-500 hover:bg-amber-600 text-white gap-1">
              <Send className="w-3.5 h-3.5" /> {t('request.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
