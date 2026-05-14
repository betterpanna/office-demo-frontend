import React, { useState, useMemo } from 'react';
import { 
  ClipboardList, 
  Search, 
  Plus, 
  User as UserIcon, 
  Clock, 
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Package,
  Truck,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  Filter,
  MoreVertical,
  Mail,
  BarChart3,
  Calendar as CalendarIcon,
  LayoutGrid,
  Wand2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  MOCK_USERS,
} from '@/src/mockData';
import {
  useTaskMasters,
  getTaskMasters,
} from '@/src/stores/taskMastersStore';
import { useCollections } from '@/src/stores/collectionsStore';
import { useInventory } from '@/src/stores/inventoryStore';
import { useBananaListings } from '@/src/stores/bananaListingsStore';
import {
  useTasks,
  scheduleTask,
  getEstimatedMinutes,
  updateTask,
  unassignTask,
  addTask,
} from '@/src/stores/tasksStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Trash2, Save, X as XIcon } from 'lucide-react';
import { Task, TaskPriority, User } from '@/src/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  format,
  addHours,
  startOfDay,
  eachHourOfInterval,
  isSameDay,
  addDays,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from 'date-fns';
import {
  useWorkingHours,
  getDayGridRange,
} from '@/src/stores/workingHoursStore';
import {
  useShiftRequests,
  getEffectiveHours,
} from '@/src/stores/shiftsStore';
import { ja } from 'date-fns/locale';
import { useT } from '@/src/stores/i18nStore';
import { 
  DndContext, 
  DragOverlay, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  DragStartEvent, 
  DragEndEvent,
  useDraggable,
  useDroppable,
  DragOverEvent
} from '@dnd-kit/core';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

// --- Draggable Task Component ---
function DraggableTask({ task, index }: { task: Task; index: number; key?: string }) {
  const t = useT();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: task
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  const tm = getTaskMasters().find(m => m.id === task.taskMasterId);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "p-3 mb-2 bg-white border border-slate-200 rounded-lg shadow-sm cursor-grab active:cursor-grabbing hover:border-blue-300 transition-colors group",
        isDragging && "opacity-50 ring-2 ring-blue-500"
      )}
      {...listeners}
      {...attributes}
    >
      <div className="flex justify-between items-start mb-2">
        <Badge variant="outline" className={cn(
          "text-[10px] px-1 py-0 h-4 border-none",
          task.priority === 'high' ? "bg-red-50 text-red-600" : 
          task.priority === 'medium' ? "bg-blue-50 text-blue-600" : "bg-slate-50 text-slate-500"
        )}>
          {task.priority === 'high' ? t('col.priorityHigh') : task.priority === 'medium' ? t('col.priorityMid') : t('col.priorityLow')}
        </Badge>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical className="w-3 h-3 text-slate-300" />
        </div>
      </div>
      <div className="font-bold text-xs text-[#1e293b] mb-1 truncate">{tm?.name}</div>
      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-2">
        <Package className="w-3 h-3" />
        <span className="truncate">{task.targetName}</span>
      </div>
      <div className="flex justify-between items-center text-[10px]">
        <div className="flex items-center gap-1 text-slate-400">
          <Clock className="w-3 h-3" />
          <span>{tm?.estimatedTime}{t('tassign.minutes')}</span>
        </div>
        <div className="font-bold text-[#1e293b]">{t('schedule.quantity')}: {task.quantity}</div>
      </div>
    </div>
  );
}

// --- Droppable Slot Component (空セル) ---
function TimeSlot({
  workerId,
  time,
}: {
  workerId: string;
  time: string;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `slot-${workerId}-${time}`,
    data: { workerId, time }
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "h-16 border-r border-slate-100 transition-colors",
        isOver ? "bg-blue-50/70 ring-1 ring-inset ring-blue-300" : "hover:bg-slate-50/50"
      )}
    />
  );
}

// 開始時刻 (HH:mm) を base hour 起点のミニッツに変換
const minutesFromBase = (hhmm: string | undefined, baseHour: number): number => {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(':').map((v) => Number(v) || 0);
  return (h - baseHour) * 60 + m;
};

// --- Day View: ガントチャート風タスクブロック ---
// 既に割り当て済みのタスクもクリックで編集／ドラッグで別の枠に移動できるようにする。
// PointerSensor の activationConstraint(distance: 5) によって、
// 5px 以下の動きはクリック扱い、それ以上はドラッグ扱いになる。
function ScheduledTaskBlock({
  task,
  baseHour,
  totalHours,
  onEdit,
}: {
  task: Task;
  baseHour: number;
  totalHours: number;
  onEdit?: (task: Task) => void;
}) {
  const t = useT();
  const tm = getTaskMasters().find((m) => m.id === task.taskMasterId);
  const duration = task.durationMinutes || tm?.estimatedTime || 30;
  const startMin = minutesFromBase(task.scheduledStartTime, baseHour);
  const totalMin = totalHours * 60;
  const leftPct = Math.max(0, Math.min(100, (startMin / totalMin) * 100));
  const widthPct = Math.max(2, Math.min(100 - leftPct, (duration / totalMin) * 100));
  // 発送業務 (tm9) は常に緑系で表示し、それ以外は priority で色分け
  const isShipping = task.taskMasterId === 'tm9';
  const colorByPriority = isShipping
    ? 'from-emerald-500 to-green-600 ring-emerald-400'
    : task.priority === 'high'
      ? 'from-red-500 to-rose-600 ring-red-400'
      : task.priority === 'medium'
        ? 'from-blue-500 to-indigo-600 ring-blue-400'
        : 'from-emerald-500 to-teal-600 ring-emerald-400';
  const completed = task.status === 'completed';

  // 完了済みは移動不可
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: task,
    disabled: completed,
  });

  const dragStyle: React.CSSProperties = {
    left: `${leftPct}%`,
    width: `${widthPct}%`,
    ...(transform
      ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
      : null),
  };

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        // ドラッグ確定後の click は dnd-kit が抑制してくれる
        onEdit?.(task);
      }}
      {...listeners}
      {...attributes}
      className={cn(
        "absolute top-1 bottom-1 rounded-lg text-white text-[9px] font-bold overflow-hidden shadow-sm ring-1 px-2 py-1 flex flex-col justify-center bg-gradient-to-br pointer-events-auto text-left transition-all",
        colorByPriority,
        completed
          ? "opacity-60 saturate-50 cursor-default"
          : "cursor-grab active:cursor-grabbing hover:brightness-110 hover:ring-2 active:scale-[0.98]",
        isDragging && "opacity-40 ring-2 ring-white shadow-lg",
      )}
      style={dragStyle}
      title={
        completed
          ? `${tm?.name ?? ''} / ${task.scheduledStartTime}〜${task.scheduledEndTime}（${duration}${t('tassign.minutes')}） — ${t('tassign.completedDuration')}`
          : `${tm?.name ?? ''} / ${task.scheduledStartTime}〜${task.scheduledEndTime}（${duration}${t('tassign.minutes')}） — ${t('tassign.editClick')}`
      }
    >
      <div className="flex items-center justify-between gap-1">
        <span className="truncate">{tm?.name}{completed ? ' ✓' : ''}</span>
        <span className="tabular-nums opacity-90 shrink-0">{duration}{t('tassign.minutes')}</span>
      </div>
      <span className="opacity-90 truncate">{task.targetName}</span>
    </button>
  );
}

interface TaskAssignmentProps {
  selectedBase?: string;
}

export function TaskAssignment({ selectedBase }: TaskAssignmentProps) {
  const t = useT();
  const collections = useCollections();
  const inventory = useInventory();
  const bananaListings = useBananaListings();
  const tasks = useTasks();
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activePoolTab, setActivePoolTab] = useState<'all' | 'collection' | 'unregistered' | 'production' | 'shipping'>('all');

  // --- 割当済みタスクの編集ダイアログ ---
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [editForm, setEditForm] = useState<{
    assigneeId: string;
    scheduledDate: string;
    scheduledStartTime: string;
    priority: TaskPriority;
    quantity: number;
    /** 所要時間（分）。空文字ならマスターの標準時間を使用 */
    durationMinutes: string;
  } | null>(null);

  const openEditDialog = (task: Task) => {
    setEditTask(task);
    setEditForm({
      assigneeId: task.assigneeId ?? '',
      scheduledDate: task.scheduledDate || format(new Date(), 'yyyy-MM-dd'),
      scheduledStartTime: task.scheduledStartTime ?? '09:00',
      priority: task.priority,
      quantity: task.quantity,
      durationMinutes:
        task.durationMinutes != null
          ? String(task.durationMinutes)
          : String(getEstimatedMinutes(task.taskMasterId)),
    });
  };

  const closeEditDialog = () => {
    setEditTask(null);
    setEditForm(null);
  };

  const handleSaveEdit = () => {
    if (!editTask || !editForm) return;

    // 所要分の最終値（5分以上、空欄ならマスター標準時間）
    const masterEstimate = getEstimatedMinutes(editTask.taskMasterId);
    const parsedDuration = parseInt(editForm.durationMinutes, 10);
    const durationMinutes = Number.isFinite(parsedDuration) && parsedDuration > 0
      ? Math.max(5, parsedDuration)
      : masterEstimate;

    // 担当者・日付・開始時刻・所要分のいずれかが変わった場合は再算出
    const currentDuration = editTask.durationMinutes ?? masterEstimate;
    const scheduleChanged =
      editForm.assigneeId !== editTask.assigneeId ||
      editForm.scheduledDate !== editTask.scheduledDate ||
      editForm.scheduledStartTime !== (editTask.scheduledStartTime ?? '') ||
      durationMinutes !== currentDuration;

    // 実際にスケジュールが確定した開始時刻（前作業の終わりに自動追従される場合がある）
    let appliedStart = editForm.scheduledStartTime;
    let appliedEnd: string | undefined;

    if (scheduleChanged) {
      // scheduleTask は標準時間を使うため、所要分カスタム時は updateTask で上書き
      const scheduled = scheduleTask({
        task: { ...editTask, priority: editForm.priority, quantity: editForm.quantity },
        assigneeId: editForm.assigneeId,
        scheduledDate: editForm.scheduledDate,
        scheduledStartTime: editForm.scheduledStartTime,
      });
      appliedStart = scheduled.scheduledStartTime || editForm.scheduledStartTime;
      appliedEnd = scheduled.scheduledEndTime;
      if (durationMinutes !== masterEstimate) {
        // 所要分を上書きし、終了時刻も再計算（実際に確定した開始時刻基準で計算）
        const [hStr, mStr] = appliedStart.split(':');
        const total = (Number(hStr) || 0) * 60 + (Number(mStr) || 0) + durationMinutes;
        const endHour = Math.min(23, Math.floor(total / 60));
        const endMin = total % 60;
        const endStr =
          total >= 24 * 60
            ? '23:59'
            : `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;
        appliedEnd = endStr;
        updateTask(scheduled.id, {
          durationMinutes,
          scheduledEndTime: endStr,
        });
      }
    } else {
      updateTask(editTask.id, {
        priority: editForm.priority,
        quantity: editForm.quantity,
      });
    }

    const tm = getTaskMasters().find((m) => m.id === editTask.taskMasterId);
    const workerName = MOCK_USERS.find((u) => u.id === editForm.assigneeId)?.name || '担当未設定';
    const bumped = scheduleChanged && appliedStart !== editForm.scheduledStartTime;
    toast.success(t('tassign.toastUpdateSuccess'), {
      description: `${tm?.name ?? ''} / ${workerName} / ${editForm.scheduledDate} ${appliedStart}〜${appliedEnd ?? ''}（${durationMinutes}分）${bumped ? ' ※前作業の終了に続けて配置' : ''}`,
    });
    closeEditDialog();
  };

  const handleUnassign = () => {
    if (!editTask) return;
    unassignTask(editTask.id);
    toast.success(t('tassign.toastUnassignSuccess'), {
      description: t('tassign.toastUnassignDesc'),
    });
    closeEditDialog();
  };

  // --- 自由タスク追加ダイアログ ---
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<{
    name: string;
    taskMasterId: string;
    priority: TaskPriority;
    quantity: number;
    notes: string;
    /** 紐付ける在庫 ID。空文字なら custom（在庫無し）として扱う */
    inventoryId: string;
    // 任意で即割当する場合のみ使用
    assignNow: boolean;
    assigneeId: string;
    scheduledDate: string;
    scheduledStartTime: string;
  }>({
    name: '',
    taskMasterId: 'tm6',
    priority: 'medium',
    quantity: 1,
    notes: '',
    inventoryId: '',
    assignNow: false,
    assigneeId: '',
    scheduledDate: format(new Date(), 'yyyy-MM-dd'),
    scheduledStartTime: '09:00',
  });

  const openCreateDialog = () => {
    setCreateForm({
      name: '',
      taskMasterId: 'tm6',
      priority: 'medium',
      quantity: 1,
      notes: '',
      inventoryId: '',
      assignNow: false,
      assigneeId: workers[0]?.id ?? '',
      scheduledDate: format(currentDate, 'yyyy-MM-dd'),
      scheduledStartTime: '09:00',
    });
    setCreateOpen(true);
  };

  // 在庫候補（拠点フィルタ・販売済みは除外）
  const selectableInventory = useMemo(
    () =>
      inventory
        .filter((i) => !selectedBase || i.baseName === selectedBase)
        .filter((i) => i.status !== 'sold' && i.status !== 'returned')
        .slice(0, 200),
    [inventory, selectedBase],
  );

  const handleCreateFreeTask = () => {
    const trimmed = createForm.name.trim();
    const linkedInv = createForm.inventoryId
      ? inventory.find((i) => i.id === createForm.inventoryId)
      : null;
    // 在庫を選択した場合はそちらを優先して targetName とする
    const finalName = linkedInv ? `${linkedInv.name}${trimmed ? `（${trimmed}）` : ''}` : trimmed;
    if (!finalName) {
      toast.error('作業内容を入力するか、対象在庫を選択してください');
      return;
    }
    if (createForm.assignNow && !createForm.assigneeId) {
      toast.error(t('tassign.errorSelectWorker'));
      return;
    }

    const newId = `free-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newTask: Task = {
      id: newId,
      taskMasterId: createForm.taskMasterId,
      status: 'pending',
      priority: createForm.priority,
      targetType: linkedInv ? 'inventory' : 'custom',
      targetId: linkedInv ? linkedInv.id : newId,
      targetName: finalName,
      quantity: createForm.quantity,
      scheduledDate: '',
      notes: createForm.notes.trim() || undefined,
    };

    if (createForm.assignNow) {
      // 担当者・日時を指定 → そのまま指示として送出（durationMinutes 自動換算）
      const scheduled = scheduleTask({
        task: newTask,
        assigneeId: createForm.assigneeId,
        scheduledDate: createForm.scheduledDate,
        scheduledStartTime: createForm.scheduledStartTime,
      });
      const tm = getTaskMasters().find((m) => m.id === createForm.taskMasterId);
      const workerName = MOCK_USERS.find((u) => u.id === createForm.assigneeId)?.name || '担当者';
      toast.success(`${workerName} へ自由タスクを送信しました`, {
        description: `${tm?.name ?? ''}：${trimmed} / ${scheduled.scheduledStartTime}〜${scheduled.scheduledEndTime}（${scheduled.durationMinutes}分）`,
      });
    } else {
      // 未割当プールへ追加（後でドラッグ＆ドロップ可能）
      addTask(newTask);
      const tm = getTaskMasters().find((m) => m.id === createForm.taskMasterId);
      toast.success(t('tassign.toastAddSuccess'), {
        description: `${tm?.name ?? ''}：${trimmed}（プールから割り当て可）`,
      });
    }
    setCreateOpen(false);
  };
  
  // Sensors for DND
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const workers = useMemo(() =>
    MOCK_USERS.filter(u => (!selectedBase || u.base === selectedBase) && u.role === 'worker'),
    [selectedBase]
  );

  // 就業時間マスタの変更を購読して再描画する
  const allWorkingHours = useWorkingHours();
  // シフト/休業申告の変更（承認/却下）を購読して稼働バンドを再計算させる
  // 値そのものは getEffectiveHours が内部状態から取り直すため未使用扱いで OK
  useShiftRequests();
  // 作業マスタの変更（追加・編集・削除）を購読して再描画するため
  // ※ 値そのものは getTaskMasters() で参照する
  useTaskMasters();

  // 指定ワーカー × Date における「実効稼働時間」を返す。
  // 承認済シフト > 承認済休業 > 就業時間マスタ の優先順位で解決する。
  const getEffectiveHoursForDate = (
    workerId: string,
    date: Date,
  ): { start: string; end: string; isHoliday: boolean } => {
    const ymd = format(date, 'yyyy-MM-dd');
    const eff = getEffectiveHours(workerId, ymd);
    return { start: eff.start, end: eff.end, isHoliday: eff.isHoliday };
  };

  // Time intervals for Day View — 就業時間マスタから全ワーカー分の最小～最大を採用
  // allWorkingHours を依存に含めることで、マスタ変更時にレンジを再計算する
  const dayRange = useMemo(
    () => getDayGridRange(workers),
    [workers, allWorkingHours],
  );
  const dayBaseHour = dayRange.startHour;
  const timeHours = useMemo(() => {
    const len = Math.max(1, dayRange.endHourExclusive - dayRange.startHour);
    return Array.from({ length: len }, (_, i) =>
      `${(i + dayRange.startHour).toString().padStart(2, '0')}:00`,
    );
  }, [dayRange]);

  // Days for Week View
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { locale: ja });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  // Days for Month View（月初〜月末を全日列挙）
  const monthDays = useMemo(() => {
    const s = startOfMonth(currentDate);
    const e = endOfMonth(currentDate);
    return eachDayOfInterval({ start: s, end: e });
  }, [currentDate]);

  // Derive "Virtual Tasks" from different sources
  const poolTasks = useMemo(() => {
    // 1. Existing Unassigned Tasks from tasksStore
    //    自由タスク（targetType: 'custom'）は拠点紐付けなしのため selectedBase 関係なく表示
    const unassigned = tasks.filter(t => {
      if (t.assigneeId) return false;
      if (t.targetType === 'custom') return true;
      const invItem = inventory.find(i => i.id === t.targetId);
      return !selectedBase || invItem?.baseName === selectedBase;
    });

    // 仮想タスク id のうち、既に割り当て済（tasksStore に取り込まれて assigneeId 付き）のものを除外するための集合
    // また割当済の同 inventoryId / 同 collectionItemId についても仮想タスクとして再生成しない
    const assignedVirtualIds = new Set(
      tasks.filter((t) => t.assigneeId && t.id.startsWith('v-')).map((t) => t.id),
    );
    const assignedTaskMasterByTarget = new Map<string, Set<string>>();
    tasks
      .filter((t) => t.assigneeId && t.status !== 'completed' && t.targetId)
      .forEach((t) => {
        const set = assignedTaskMasterByTarget.get(t.taskMasterId) ?? new Set<string>();
        set.add(t.targetId);
        assignedTaskMasterByTarget.set(t.taskMasterId, set);
      });
    const isAssigned = (taskMasterId: string, virtualId: string, targetId: string): boolean => {
      if (assignedVirtualIds.has(virtualId)) return true;
      return assignedTaskMasterByTarget.get(taskMasterId)?.has(targetId) ?? false;
    };

    // 2. Collection Items that need sorting
    const fromCollections: Task[] = collections
      .filter(c => c.status === 'completed' && (!selectedBase || (c.customerAddress ?? '').includes(selectedBase)))
      .flatMap(c => c.items
        .filter(item => !isAssigned('tm6', `v-col-${item.id}`, item.id))
        .map(item => ({
          id: `v-col-${item.id}`,
          taskMasterId: 'tm6', // 荷下・3分類
          targetType: 'collection' as const,
          targetId: item.id,
          targetName: `${item.name} (${c.customerName})`,
          priority: 'high' as const,
          quantity: item.quantity,
          status: 'pending' as const,
          scheduledDate: ''
        })));

    // 3. Unregistered Inventory that needs sorting/classification
    const fromUnregistered: Task[] = inventory
      .filter(i => i.status === 'unregistered' && (!selectedBase || i.baseName === selectedBase))
      .filter(i => !isAssigned('tm6', `v-unreg-${i.id}`, i.id))
      .map(item => ({
        id: `v-unreg-${item.id}`,
        taskMasterId: 'tm6', // 分別作業
        targetType: 'inventory' as const,
        targetId: item.id,
        targetName: item.name,
        priority: 'medium' as const,
        quantity: 1,
        status: 'pending' as const,
        scheduledDate: ''
      }));

    // 4. Items in production that might need further action
    const fromProduction: Task[] = inventory
      .filter(i => (i.status === 'in_production' || i.status === 'pending_productization') && (!selectedBase || i.baseName === selectedBase))
      .filter(i => !isAssigned('tm8', `v-prod-${i.id}`, i.id))
      .map(item => ({
        id: `v-prod-${item.id}`,
        taskMasterId: 'tm8', // 商品化
        targetType: 'inventory' as const,
        targetId: item.id,
        targetName: item.name,
        priority: 'low' as const,
        quantity: 1,
        status: 'pending' as const,
        scheduledDate: ''
      }));

    // 5. 発送（出荷タスク = tm9）
    //    a) 既存の未割当 tm9 タスク
    //    b) sold + deliveryStatus='preparing' で未割当の listing から仮想生成
    //    auto-assigned (assigneeId 付き) のタスクは表示しない
    const assignedTm9InventoryIds = new Set(
      tasks
        .filter((t) => t.taskMasterId === 'tm9' && t.assigneeId && t.status !== 'completed' && t.targetType === 'inventory')
        .map((t) => t.targetId),
    );
    const realUnassignedShipping = unassigned.filter((t) => t.taskMasterId === 'tm9');
    const realUnassignedShipInventoryIds = new Set(
      realUnassignedShipping.filter((t) => t.targetType === 'inventory').map((t) => t.targetId),
    );
    const virtualShipping: Task[] = bananaListings
      .filter((l) => l.status === 'sold' && l.deliveryStatus === 'preparing')
      .filter((l) => !assignedTm9InventoryIds.has(l.inventoryId) && !realUnassignedShipInventoryIds.has(l.inventoryId))
      .filter((l) => {
        if (!selectedBase) return true;
        const inv = inventory.find((i) => i.id === l.inventoryId);
        return inv?.baseName === selectedBase;
      })
      .map((l) => ({
        id: `v-ship-${l.id}`,
        taskMasterId: 'tm9', // 出荷業務
        targetType: 'inventory' as const,
        targetId: l.inventoryId,
        targetName: `${l.itemName}（${l.recipientName ?? l.buyerName ?? '受取人未設定'} 様）`,
        priority: 'high' as const,
        quantity: 1,
        status: 'pending' as const,
        scheduledDate: '',
      }));
    const fromShipping: Task[] = [...realUnassignedShipping, ...virtualShipping];

    return {
      all: [...unassigned, ...fromCollections, ...fromUnregistered, ...fromProduction, ...virtualShipping].sort((a,b) => (a.priority === 'high' ? -1 : 1)),
      collection: fromCollections,
      unregistered: fromUnregistered,
      production: fromProduction,
      shipping: fromShipping,
    };
  }, [tasks, collections, inventory, bananaListings, selectedBase]);

  const currentPoolTasks = useMemo(() => {
    return poolTasks[activePoolTab] || [];
  }, [poolTasks, activePoolTab]);

  /**
   * 未割当タスクプールの全タスクを各従業員に自動割当する。
   *
   * 戦略:
   *   1) 優先度順 (high → medium → low) で割当 (緊急タスクを早めに着手)
   *   2) ロール判定:
   *      - 出張回収 (tm7) → role='collector' の従業員へ
   *      - その他 (商品化/分別/出荷など) → role='worker' の従業員へ
   *      - 該当ロールがいなければフォールバックで他ロール (休日でない者) へ
   *   3) 負荷分散: 候補の中で、その日の予定総作業分が最も少ない者に割当
   *   4) 休日 (isHoliday=true) の従業員は除外
   *   5) scheduleTask が "全タスクの最終終了時刻に続けて配置" を自動で行うので、
   *      開始時刻はその従業員の業務開始時刻 (フォールバック '09:00') を渡せば十分
   */
  const handleAutoAssign = () => {
    const pool = poolTasks.all;
    if (pool.length === 0) {
      toast.info(t('tassign.autoAssignEmpty'));
      return;
    }

    const scheduledDateStr = format(currentDate, 'yyyy-MM-dd');

    // 拠点でフィルタした全従業員 (admin除く)
    const allMembers = MOCK_USERS.filter(
      (u) => u.role !== 'admin' && (!selectedBase || u.base === selectedBase),
    );

    // 当日休日でない稼働可能メンバーのみ対象
    const workingMembers = allMembers.filter((m) => {
      const hours = getEffectiveHoursForDate(m.id, currentDate);
      return !hours.isHoliday;
    });

    if (workingMembers.length === 0) {
      toast.error(t('tassign.autoAssignNoWorkers'));
      return;
    }

    // 現在の各メンバーの予定総作業分 (分単位)
    const loadMap = new Map<string, number>();
    for (const m of workingMembers) {
      const total = tasks
        .filter(
          (x) =>
            x.assigneeId === m.id &&
            x.scheduledDate === scheduledDateStr &&
            x.status !== 'completed',
        )
        .reduce(
          (sum, x) => sum + (x.durationMinutes || getEstimatedMinutes(x.taskMasterId)),
          0,
        );
      loadMap.set(m.id, total);
    }

    // 優先度順にソート (high → medium → low)
    const priorityRank = (p: TaskPriority | undefined) =>
      p === 'high' ? 0 : p === 'low' ? 2 : 1;
    const sortedTasks = [...pool].sort(
      (a, b) => priorityRank(a.priority) - priorityRank(b.priority),
    );

    let assignedCount = 0;
    const summary = new Map<string, number>();

    for (const task of sortedTasks) {
      // ロール判定: 出張回収 (tm7) は回収員専任、それ以外は作業員
      const isCollectionTask = task.taskMasterId === 'tm7';
      const preferredRole = isCollectionTask ? 'collector' : 'worker';
      let eligible = workingMembers.filter((m) => m.role === preferredRole);
      if (eligible.length === 0) {
        // 該当ロールが居なければ全稼働メンバーから選ぶ (フォールバック)
        eligible = workingMembers;
      }
      if (eligible.length === 0) continue;

      // 負荷の少ない順にソートして先頭を採用
      eligible.sort((a, b) => (loadMap.get(a.id) ?? 0) - (loadMap.get(b.id) ?? 0));
      const target = eligible[0];

      const hours = getEffectiveHoursForDate(target.id, currentDate);
      const startTime = hours.start || '09:00';

      scheduleTask({
        task,
        assigneeId: target.id,
        scheduledDate: scheduledDateStr,
        scheduledStartTime: startTime,
      });

      // 負荷マップを更新 (このタスクの所要分を加算)
      const duration = task.durationMinutes || getEstimatedMinutes(task.taskMasterId);
      loadMap.set(target.id, (loadMap.get(target.id) ?? 0) + duration);
      summary.set(target.name, (summary.get(target.name) ?? 0) + 1);
      assignedCount++;
    }

    if (assignedCount === 0) {
      toast.warning(t('tassign.autoAssignEmpty'));
      return;
    }

    const summaryText = Array.from(summary.entries())
      .map(([name, count]) => `${name}: ${count}${t('tassign.cases')}`)
      .join(' / ');
    toast.success(`${assignedCount}${t('tassign.autoAssignDone')}`, {
      description: summaryText,
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const task = event.active.data.current as Task;
    setActiveTask(task);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (over && over.id.toString().startsWith('slot-')) {
      const task = active.data.current as Task;
      const { workerId, time } = over.data.current as { workerId: string; time: string };

      // 週/月ビューでは time が yyyy-MM-dd、日ビューでは HH:mm
      const isDateSlot = /^\d{4}-\d{2}-\d{2}$/.test(time);
      const scheduledDate = isDateSlot ? time : format(currentDate, 'yyyy-MM-dd');

      // 日付スロットでは、その日の実効稼働時間（承認シフト > 承認休業 > マスタ）の開始時刻を初期値に
      // 日ビューでも稼働時間の floor (業務開始時刻) を取得して、それ以前にはスナップさせない
      let dropDayHours: { start: string; end: string; isHoliday: boolean } | null = null;
      if (isDateSlot) {
        const [yy, mm, dd] = time.split('-').map((v) => Number(v));
        dropDayHours = getEffectiveHoursForDate(workerId, new Date(yy, mm - 1, dd));
      } else {
        dropDayHours = getEffectiveHoursForDate(workerId, currentDate);
      }

      // --- 日ビューの場合はドロップした x 座標から分単位（5分刻み）の開始時刻を算出 ---
      let scheduledStartTime = isDateSlot ? dropDayHours?.start || '09:00' : time;
      if (!isDateSlot) {
        const overRect = over.rect;
        const activeRect = active.rect.current.translated;
        if (overRect && activeRect) {
          // タスクブロックの「左端」x 座標で開始時刻を決定する（中心ではなく左端基準）。
          // 中心基準だと、タスクの横幅がスロット幅より広い場合に
          // 視覚的にスロットの先頭へ揃えても中心が次スロットに侵入し、
          // 例えば 09:00 ジャストに置けず 09:30 などに後ろ倒しになる不具合があった。
          const dropLeftX = activeRect.left;
          const xInSlot = dropLeftX - overRect.left;
          const fraction = Math.max(0, Math.min(0.999, xInSlot / overRect.width));
          // 60 分を 5 分刻みでスナップ（0,5,10,...,55）
          const minutes = Math.min(55, Math.round((fraction * 60) / 5) * 5);
          const [hStr] = time.split(':');
          scheduledStartTime = `${hStr}:${String(minutes).padStart(2, '0')}`;
        }

        // 業務開始時刻のフロア — 計算結果が労働開始前ならスナップ
        if (dropDayHours?.start && scheduledStartTime < dropDayHours.start) {
          scheduledStartTime = dropDayHours.start;
        }
      }

      const next = scheduleTask({
        task,
        assigneeId: workerId,
        scheduledDate,
        scheduledStartTime,
      });

      const tm = getTaskMasters().find((m) => m.id === task.taskMasterId);
      const workerName = MOCK_USERS.find((u) => u.id === workerId)?.name || workerId;
      // scheduleTask 側で前の作業に続けて自動配置されるため、
      // 表示は実際に確定した開始時刻 (next.scheduledStartTime) を使う
      const bumped =
        !isDateSlot &&
        next.scheduledStartTime &&
        next.scheduledStartTime !== scheduledStartTime;
      const onHoliday = dropDayHours?.isHoliday;
      toast.success(`${workerName} に作業指示を送信しました`, {
        description: `${tm?.name ?? ''} / ${isDateSlot ? `${scheduledDate} ` : ''}${next.scheduledStartTime}〜${next.scheduledEndTime}（${next.durationMinutes}分）${bumped ? ' ※前作業の終了に続けて配置' : ''}${onHoliday ? ' ※休日出勤として割当' : ''}`,
      });
    }
  };

  // Forecast charts data
  const forecastData = useMemo(() => {
    return timeHours.map(hour => ({
      name: hour,
      planned: Math.floor(Math.random() * 5) + 3,
      actual: Math.floor(Math.random() * 4) + 2
    }));
  }, [timeHours]);

  const totalPlanned = forecastData.reduce((acc, curr) => acc + curr.planned, 0);
  const totalActual = forecastData.reduce((acc, curr) => acc + curr.actual, 0);
  const completionRate = (totalActual / totalPlanned) * 100;

  const getStatusColor = (rate: number) => {
    if (rate >= 80) return "#10b981"; // Success
    if (rate >= 60) return "#f59e0b"; // Warning
    return "#ef4444"; // Delay
  };

  const getStatusLabel = (rate: number) => {
    if (rate >= 80) return t('tassign.onTrack');
    if (rate >= 60) return t('tassign.alert');
    return t('tassign.delayed');
  };

  return (
    <DndContext 
      sensors={sensors} 
      onDragStart={handleDragStart} 
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6 max-w-[1600px] mx-auto">
        {/* Header Summary & KPI */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <Card className="border-[#e2e8f0] shadow-none bg-white">
            <CardContent className="p-4 flex flex-col justify-between h-full">
              <div className="flex justify-between items-start mb-2">
                <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">{t('tassign.progressTitle')} ({viewMode === 'day' ? t('tassign.dayView') : viewMode === 'week' ? t('tassign.weekView') : t('tassign.monthView')})</p>
                <Badge variant="outline" style={{ 
                  backgroundColor: `${getStatusColor(completionRate)}20`, 
                  color: getStatusColor(completionRate),
                  borderColor: `${getStatusColor(completionRate)}40`
                }} className="text-[10px] font-bold">
                  {getStatusLabel(completionRate)}
                </Badge>
              </div>
              <div className="flex items-end justify-between gap-2">
                <div>
                  <h3 className="text-2xl font-bold text-[#1e293b]">{completionRate.toFixed(1)}%</h3>
                  <p className="text-[10px] text-slate-400 mt-1">完了 {totalActual} / 計画 {totalPlanned}</p>
                </div>
                <div className="w-16 h-16">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[{v: completionRate}]}>
                      <Bar dataKey="v" fill={getStatusColor(completionRate)} radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <Progress value={completionRate} className="h-1 mt-3" style={{ '--progress-fill': getStatusColor(completionRate) } as any} />
            </CardContent>
          </Card>

          <Card className="border-[#e2e8f0] shadow-none bg-white">
            <CardContent className="p-4 flex flex-col justify-between h-full">
              <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-2">{t('tassign.unassignedPool')}</p>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-[#1e293b]">{poolTasks.all.length} <span className="text-sm font-normal text-slate-400 ml-1">{t('tassign.cases')}</span></h3>
                  <div className="flex gap-2 mt-2">
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      <span className="text-[10px] text-slate-500 font-medium">{poolTasks.all.filter(task => task.priority === 'high').length} {t('tassign.urgent')}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      <span className="text-[10px] text-slate-500 font-medium">{poolTasks.all.length} {t('tassign.total')}</span>
                    </div>
                  </div>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg">
                  <ClipboardList className="w-5 h-5 text-slate-400" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1 text-[10px] text-amber-600 font-bold">
                <AlertCircle className="w-3 h-3" />
                <span>{t('tassign.staleAlert')}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#e2e8f0] shadow-none bg-white md:col-span-1 lg:col-span-2">
            <CardContent className="p-4">
              <div className="flex justify-between items-center mb-2">
                <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">{t('tassign.forecastTitle')}</p>
                <div className="flex gap-4">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-slate-200" />
                    <span className="text-[10px] font-medium text-slate-500">{t('tassign.target')}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-blue-600" />
                    <span className="text-[10px] font-medium text-slate-500">{t('tassign.actual')}</span>
                  </div>
                </div>
              </div>
              <div className="h-20 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={forecastData}>
                    <Bar dataKey="planned" fill="#e2e8f0" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="actual" fill="#2563eb" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex justify-between items-center">
                <div className="text-[10px] text-red-500 font-bold flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>{t('tassign.delayPredict')}</span>
                </div>
                <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-blue-600 font-bold">
                  {t('tassign.analysisDetail')} <ArrowRight className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Scheduler UI */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          
          {/* Left Panel: Task Pool */}
          <Card className="lg:col-span-1 border-slate-200 shadow-sm bg-white overflow-hidden flex flex-col h-[700px]">
            <CardHeader className="bg-slate-50/80 border-b border-slate-200 p-4 shrink-0 space-y-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2 italic">
                  TASK SELECTION POOL
                </CardTitle>
                <div className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {currentPoolTasks.length}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex gap-1 p-1 bg-slate-200/50 rounded-lg flex-wrap">
                  <button
                    onClick={() => setActivePoolTab('all')}
                    className={cn(
                      "flex-1 min-w-[48px] py-1 px-2 text-[9px] font-bold rounded transition-all flex items-center justify-center gap-1",
                      activePoolTab === 'all' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
                    )}
                  >
                    {t('tassign.allTab')}
                    <span className={cn(
                      "text-[8px] font-black px-1 rounded",
                      activePoolTab === 'all' ? "bg-blue-100 text-blue-700" : "bg-slate-300 text-slate-600"
                    )}>
                      {poolTasks.all.length}
                    </span>
                  </button>
                  <button
                    onClick={() => setActivePoolTab('collection')}
                    className={cn(
                      "flex-1 min-w-[48px] py-1 px-2 text-[9px] font-bold rounded transition-all flex items-center justify-center gap-1",
                      activePoolTab === 'collection' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
                    )}
                  >
                    {t('tassign.collectionTab')}
                    <span className={cn(
                      "text-[8px] font-black px-1 rounded",
                      activePoolTab === 'collection' ? "bg-blue-100 text-blue-700" : "bg-slate-300 text-slate-600"
                    )}>
                      {poolTasks.collection.length}
                    </span>
                  </button>
                  <button
                    onClick={() => setActivePoolTab('unregistered')}
                    className={cn(
                      "flex-1 min-w-[48px] py-1 px-2 text-[9px] font-bold rounded transition-all flex items-center justify-center gap-1",
                      activePoolTab === 'unregistered' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
                    )}
                  >
                    {t('tassign.unregisteredTab')}
                    <span className={cn(
                      "text-[8px] font-black px-1 rounded",
                      activePoolTab === 'unregistered' ? "bg-blue-100 text-blue-700" : "bg-slate-300 text-slate-600"
                    )}>
                      {poolTasks.unregistered.length}
                    </span>
                  </button>
                  <button
                    onClick={() => setActivePoolTab('production')}
                    className={cn(
                      "flex-1 min-w-[48px] py-1 px-2 text-[9px] font-bold rounded transition-all flex items-center justify-center gap-1",
                      activePoolTab === 'production' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
                    )}
                  >
                    {t('tassign.productionTab')}
                    <span className={cn(
                      "text-[8px] font-black px-1 rounded",
                      activePoolTab === 'production' ? "bg-blue-100 text-blue-700" : "bg-slate-300 text-slate-600"
                    )}>
                      {poolTasks.production.length}
                    </span>
                  </button>
                  <button
                    onClick={() => setActivePoolTab('shipping')}
                    className={cn(
                      "flex-1 min-w-[48px] py-1 px-2 text-[9px] font-bold rounded transition-all flex items-center justify-center gap-1",
                      activePoolTab === 'shipping' ? "bg-white text-amber-700 shadow-sm" : "text-slate-500"
                    )}
                  >
                    {t('tassign.shippingTab')}
                    <span className={cn(
                      "text-[8px] font-black px-1 rounded",
                      activePoolTab === 'shipping' ? "bg-amber-100 text-amber-700" : poolTasks.shipping.length > 0 ? "bg-amber-100 text-amber-700" : "bg-slate-300 text-slate-600"
                    )}>
                      {poolTasks.shipping.length}
                    </span>
                  </button>
                </div>
                
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <Input placeholder={t('tassign.searchTask')} className="h-8 pl-9 bg-white text-xs border-slate-200" />
                </div>
              </div>
            </CardHeader>
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50/30">
              {currentPoolTasks.map((task, idx) => (
                <DraggableTask key={task.id} task={task} index={idx} />
              ))}
              {currentPoolTasks.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2 opacity-50 italic">
                  <CheckCircle2 className="w-8 h-8" />
                  <p className="text-xs">{t('tassign.noTasks')}</p>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-200 bg-white shrink-0 space-y-2">
              <Button
                onClick={handleAutoAssign}
                disabled={poolTasks.all.length === 0}
                className="w-full h-9 gap-2 bg-purple-600 hover:bg-purple-700 text-xs font-bold shadow-sm shadow-purple-100 disabled:opacity-50"
              >
                <Wand2 className="w-4 h-4" /> {t('tassign.autoAssign')}
              </Button>
              <Button
                onClick={openCreateDialog}
                variant="outline"
                className="w-full h-9 gap-2 text-xs font-bold border-slate-200"
              >
                <Plus className="w-4 h-4" /> {t('tassign.addCustomTask')}
              </Button>
            </div>
          </Card>

          {/* Right Panel: Gantt Schedule Board */}
          <Card className="lg:col-span-3 border-slate-200 shadow-sm bg-white overflow-hidden flex flex-col h-[700px]">
            <CardHeader className="border-b border-slate-200 p-0 shrink-0">
              <div className="flex flex-col sm:flex-row items-center justify-between p-4 gap-4">
                <div className="flex items-center gap-4">
                  <h2 className="text-lg font-bold text-[#1e293b] flex items-center gap-3">
                    <CalendarIcon className="w-5 h-5 text-blue-600" />
                    {t('tassign.scheduleBoard')}
                  </h2>
                  <div className="flex items-center bg-slate-100 p-1 rounded-lg">
                    <Button 
                      variant={viewMode === 'day' ? 'outline' : 'ghost'} 
                      size="sm" 
                      onClick={() => setViewMode('day')}
                      className={cn("h-7 px-3 text-[11px] font-bold transition-all", viewMode === 'day' && "bg-white shadow-sm")}
                    >
                      Day
                    </Button>
                    <Button 
                      variant={viewMode === 'week' ? 'outline' : 'ghost'} 
                      size="sm" 
                      onClick={() => setViewMode('week')}
                      className={cn("h-7 px-3 text-[11px] font-bold transition-all", viewMode === 'week' && "bg-white shadow-sm")}
                    >
                      Week
                    </Button>
                    <Button 
                      variant={viewMode === 'month' ? 'outline' : 'ghost'} 
                      size="sm" 
                      onClick={() => setViewMode('month')}
                      className={cn("h-7 px-3 text-[11px] font-bold transition-all", viewMode === 'month' && "bg-white shadow-sm")}
                    >
                      Month
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 mr-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-slate-900 border border-slate-200"
                      onClick={() => {
                        const step = viewMode === 'day' ? -1 : viewMode === 'week' ? -7 : -30;
                        setCurrentDate((d) => addDays(d, step));
                      }}
                      title={t('tassign.prev')}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <button
                      type="button"
                      className="px-4 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-[#1e293b] min-w-[140px] text-center hover:bg-slate-100 transition-colors"
                      onClick={() => setCurrentDate(new Date())}
                      title={t('tassign.today')}
                    >
                      {viewMode === 'day' ? format(currentDate, 'yyyy年MM月dd日 (E)', { locale: ja }) :
                       viewMode === 'week' ? `${format(weekDays[0], 'MM/dd')} - ${format(weekDays[6], 'MM/dd')}` :
                       format(currentDate, 'yyyy年MM月')}
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-slate-900 border border-slate-200"
                      onClick={() => {
                        const step = viewMode === 'day' ? 1 : viewMode === 'week' ? 7 : 30;
                        setCurrentDate((d) => addDays(d, step));
                      }}
                      title={t('tassign.next')}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                  <Button variant="outline" size="sm" className="h-9 gap-2 text-xs font-bold border-slate-200">
                    <Mail className="w-4 h-4" /> {t('tassign.notifySend')}
                  </Button>
                  <Button variant="outline" size="sm" className="h-9 gap-2 text-xs font-bold border-slate-200">
                    <BarChart3 className="w-4 h-4" /> {t('tassign.exportAnalysis')}
                  </Button>
                </div>
              </div>
              
              {/* Timeline Header Row */}
              <div className="flex bg-slate-50/50 border-t border-slate-200 overflow-x-auto scrollbar-hide">
                <div className="w-[180px] p-4 font-bold text-[10px] text-slate-500 uppercase border-r border-slate-200 sticky left-0 bg-slate-50 z-10">
                  PERSONNEL / STAFF
                </div>
                {viewMode === 'day' ? (
                  timeHours.map(hour => (
                    <div key={hour} className="min-w-[100px] flex-1 p-3 text-center border-r border-slate-200 text-[10px] font-bold text-slate-400">
                      {hour}
                    </div>
                  ))
                ) : viewMode === 'week' ? (
                  weekDays.map(day => {
                    const wd = day.getDay();
                    return (
                      <div
                        key={day.toString()}
                        className={cn(
                          'min-w-[140px] flex-1 p-3 text-center border-r border-slate-200 text-[10px] font-bold',
                          wd === 0
                            ? 'text-rose-400 bg-rose-50/40'
                            : wd === 6
                              ? 'text-blue-400 bg-blue-50/40'
                              : 'text-slate-400',
                        )}
                      >
                        {format(day, 'MM/dd (E)', { locale: ja })}
                      </div>
                    );
                  })
                ) : (
                  monthDays.map(day => {
                    const wd = day.getDay();
                    return (
                      <div
                        key={day.toString()}
                        className={cn(
                          'min-w-[60px] flex-1 p-2 text-center border-r border-slate-200 text-[9px] font-bold',
                          wd === 0
                            ? 'text-rose-400 bg-rose-50/40'
                            : wd === 6
                              ? 'text-blue-400 bg-blue-50/40'
                              : 'text-slate-400',
                        )}
                      >
                        {format(day, 'd(E)', { locale: ja })}
                      </div>
                    );
                  })
                )}
              </div>
            </CardHeader>

            <div className="flex-1 overflow-y-auto">
              {workers.map((worker) => (
                <div key={worker.id} className="flex border-b border-slate-100 last:border-0 group">
                  {/* Worker Info Column */}
                  <div className="w-[180px] p-4 border-r border-slate-200 flex items-center gap-3 sticky left-0 bg-white z-10 group-hover:bg-slate-50 transition-colors">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-600 text-sm">
                        {worker.name?.[0] || '?'}
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-xs text-[#1e293b] truncate shrink-0">{worker.name}</p>
                      {(() => {
                        const hours = getEffectiveHoursForDate(worker.id, currentDate);
                        return (
                          <p className="text-[9px] text-slate-400 font-medium truncate">
                            {hours.start}-{hours.end}
                            {hours.isHoliday && (
                              <span className="ml-1 px-1 rounded bg-rose-100 text-rose-600">{t('tassign.holidayMark')}</span>
                            )}
                          </p>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Timeline Slots */}
                  {viewMode === 'day' ? (
                    (() => {
                      const todayStr = format(currentDate, 'yyyy-MM-dd');
                      const workerTasks = tasks.filter(
                        (t) => t.assigneeId === worker.id && t.scheduledDate === todayStr && t.scheduledStartTime,
                      );
                      const hours = getEffectiveHoursForDate(worker.id, currentDate);
                      // 稼働バンド計算（dayBaseHour 起点の % 位置）
                      const totalMin = timeHours.length * 60;
                      const startMin = minutesFromBase(hours.start, dayBaseHour);
                      const endMin = minutesFromBase(hours.end, dayBaseHour);
                      const bandLeft = Math.max(0, (startMin / totalMin) * 100);
                      const bandWidth = Math.max(
                        0,
                        Math.min(100 - bandLeft, ((endMin - startMin) / totalMin) * 100),
                      );
                      return (
                        <div
                          className={cn(
                            'flex-1 flex relative',
                            hours.isHoliday && 'bg-rose-50/30',
                          )}
                        >
                          {/* 稼働時間バンド（背景） */}
                          {bandWidth > 0 && (
                            <div
                              className={cn(
                                'absolute top-0 bottom-0 pointer-events-none',
                                hours.isHoliday
                                  ? 'bg-rose-100/40 border-x border-dashed border-rose-200'
                                  : 'bg-blue-50/50 border-x border-blue-100',
                              )}
                              style={{ left: `${bandLeft}%`, width: `${bandWidth}%` }}
                              title={
                                hours.isHoliday
                                  ? `休日（${hours.start}-${hours.end}） — D&D で休日出勤として割当可能`
                                  : `稼働時間 ${hours.start}-${hours.end}`
                              }
                            />
                          )}
                          {timeHours.map((hour) => (
                            <div key={hour} className="min-w-[100px] flex-1">
                              <TimeSlot workerId={worker.id} time={hour} />
                            </div>
                          ))}
                          {/* タスクブロックのガント風オーバーレイ */}
                          <div className="absolute inset-0 pointer-events-none">
                            {workerTasks.map((t) => (
                              <ScheduledTaskBlock
                                key={t.id}
                                task={t}
                                baseHour={dayBaseHour}
                                totalHours={timeHours.length}
                                onEdit={openEditDialog}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })()
                  ) : viewMode === 'week' ? (
                    weekDays.map((day) => {
                      const dayStr = format(day, 'yyyy-MM-dd');
                      const dayTasks = tasks.filter(
                        (t) => t.assigneeId === worker.id && t.scheduledDate === dayStr,
                      );
                      const totalMin = dayTasks.reduce(
                        (sum, t) => sum + (t.durationMinutes || getEstimatedMinutes(t.taskMasterId)),
                        0,
                      );
                      const hours = getEffectiveHoursForDate(worker.id, day);
                      return (
                        <div
                          key={day.toString()}
                          className={cn(
                            'min-w-[140px] flex-1 relative',
                            hours.isHoliday && 'bg-rose-50/30',
                          )}
                        >
                          <TimeSlot workerId={worker.id} time={dayStr} />
                          {hours.isHoliday && dayTasks.length === 0 && (
                            <span className="absolute top-1 right-1 text-[8px] font-bold text-rose-500 bg-white/70 px-1 rounded pointer-events-none">
                              休
                            </span>
                          )}
                          {dayTasks.length > 0 && (() => {
                            const allShipping = dayTasks.every((t) => t.taskMasterId === 'tm9');
                            return (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditDialog(dayTasks[0]);
                                }}
                                className={cn(
                                  'absolute inset-1 p-1 rounded-lg text-white text-[9px] font-bold overflow-hidden shadow-sm flex flex-col justify-center text-left pointer-events-auto cursor-pointer hover:brightness-110 hover:ring-2 hover:ring-blue-300 active:scale-[0.98] transition-all',
                                  hours.isHoliday
                                    ? 'bg-gradient-to-br from-rose-500 to-rose-600 ring-1 ring-rose-300'
                                    : allShipping
                                      ? 'bg-gradient-to-br from-emerald-500 to-green-600'
                                      : 'bg-gradient-to-br from-blue-500 to-indigo-600',
                                )}
                                title={`${dayTasks.length}件 / ${totalMin}分${hours.isHoliday ? ' （休日出勤）' : ''} — クリックで編集`}
                              >
                                <span className="truncate">
                                  {dayTasks.length}件 / {totalMin}分{hours.isHoliday ? ' 休' : ''}
                                </span>
                                <span className="opacity-80 truncate">
                                  {getTaskMasters().find((m) => m.id === dayTasks[0].taskMasterId)?.name}
                                </span>
                              </button>
                            );
                          })()}
                        </div>
                      );
                    })
                  ) : (
                    // --- Month View ---
                    monthDays.map((day) => {
                      const dayStr = format(day, 'yyyy-MM-dd');
                      const dayTasks = tasks.filter(
                        (t) => t.assigneeId === worker.id && t.scheduledDate === dayStr,
                      );
                      const totalMin = dayTasks.reduce(
                        (sum, t) => sum + (t.durationMinutes || getEstimatedMinutes(t.taskMasterId)),
                        0,
                      );
                      const hours = getEffectiveHoursForDate(worker.id, day);
                      return (
                        <div
                          key={day.toString()}
                          className={cn(
                            'min-w-[60px] flex-1 relative h-12',
                            hours.isHoliday && 'bg-rose-50/30',
                          )}
                        >
                          <TimeSlot workerId={worker.id} time={dayStr} />
                          {hours.isHoliday && dayTasks.length === 0 && (
                            <span className="absolute top-0.5 right-0.5 text-[7px] font-bold text-rose-500 pointer-events-none">
                              休
                            </span>
                          )}
                          {dayTasks.length > 0 && (() => {
                            const allShipping = dayTasks.every((t) => t.taskMasterId === 'tm9');
                            return (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditDialog(dayTasks[0]);
                                }}
                                className={cn(
                                  'absolute inset-0.5 rounded text-white text-[8px] font-bold overflow-hidden shadow-sm flex items-center justify-center text-center pointer-events-auto cursor-pointer hover:brightness-110 active:scale-[0.97] transition-all leading-tight',
                                  hours.isHoliday
                                    ? 'bg-gradient-to-br from-rose-500 to-rose-600'
                                    : allShipping
                                      ? 'bg-gradient-to-br from-emerald-500 to-green-600'
                                      : 'bg-gradient-to-br from-blue-500 to-indigo-600',
                                )}
                                title={`${format(day, 'MM/dd')} ${dayTasks.length}件 / ${totalMin}分${hours.isHoliday ? ' （休日出勤）' : ''} — クリックで編集`}
                              >
                                <span className="truncate">
                                  {dayTasks.length}件
                                </span>
                              </button>
                            );
                          })()}
                        </div>
                      );
                    })
                  )}
                </div>
              ))}
            </div>

            <CardHeader className="bg-slate-50 border-t border-slate-200 p-3 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded bg-blue-600" />
                    <span className="text-[10px] font-bold text-slate-500">割当済み</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded bg-emerald-500" />
                    <span className="text-[10px] font-bold text-slate-500">発送</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded bg-blue-100 border border-blue-200" />
                    <span className="text-[10px] font-bold text-slate-500">稼働時間</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded bg-rose-100 border border-dashed border-rose-300" />
                    <span className="text-[10px] font-bold text-slate-500">休日（D&Dで休日出勤可）</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded bg-slate-200" />
                    <span className="text-[10px] font-bold text-slate-500">空き枠</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                  <Clock className="w-3 h-3" />
                  作業時間は作業マスターの標準時間に従って自動確保／ドロップで作業指示を従業員へ送信
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* 割当ログ（メッセージ機能はダッシュボードへ移設） */}
        <div className="grid grid-cols-1 gap-6">
          <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
             <CardHeader className="p-4 border-b border-slate-100">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-600" />
                最近の割当ログ・Excelエクスポート
              </CardTitle>
            </CardHeader>
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="text-[10px] font-bold px-4">日時</TableHead>
                  <TableHead className="text-[10px] font-bold px-4">担当</TableHead>
                  <TableHead className="text-[10px] font-bold px-4">操作</TableHead>
                  <TableHead className="text-right text-[10px] font-bold px-4">詳細</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { time: '12:50', user: '管理者', action: 'タスク割当', detail: '一郎 -> 荷下・分別(田中自動車)' },
                  { time: '12:44', user: '管理者', action: 'タスク割当', detail: '三郎 -> エンジン(E-102)' },
                  { time: '12:40', user: '管理者', action: '予定変更', detail: '二郎 -> 清掃(C-92)を15時に変更' },
                  { time: '12:15', user: '管理者', action: '通知送信', detail: '全作業員へ進捗連絡' },
                ].map((log, i) => (
                  <TableRow key={i} className="hover:bg-slate-50 border-b last:border-0 h-10">
                    <TableCell className="text-[11px] px-4">{log.time}</TableCell>
                    <TableCell className="text-[11px] font-bold px-4">{log.user}</TableCell>
                    <TableCell className="px-4">
                      <Badge variant="outline" className="text-[9px] font-bold h-4">{log.action}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-[10px] text-slate-500 px-4">{log.detail}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-slate-50/50">
              <p className="text-[10px] text-slate-400">最新30件のログを表示しています</p>
              <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold text-blue-600">
                 EXCEL 出力 <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* 割当済みタスクの編集ダイアログ */}
      <Dialog open={!!editTask} onOpenChange={(open) => !open && closeEditDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-blue-600" />
              作業指示の編集
            </DialogTitle>
            <DialogDescription>
              {editTask && (
                <>
                  {getTaskMasters().find((m) => m.id === editTask.taskMasterId)?.name} ／ {editTask.targetName}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {editForm && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-slate-500">担当者</Label>
                <Select
                  value={editForm.assigneeId}
                  onValueChange={(v) => setEditForm({ ...editForm, assigneeId: v })}
                >
                  <SelectTrigger className="h-10 bg-white text-sm">
                    <SelectValue placeholder="担当者を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {workers.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}（{w.base ?? '-'}）
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-slate-500">日付</Label>
                  <Input
                    type="date"
                    value={editForm.scheduledDate}
                    onChange={(e) => setEditForm({ ...editForm, scheduledDate: e.target.value })}
                    className="h-10 bg-white text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-slate-500">開始時刻</Label>
                  <Input
                    type="time"
                    value={editForm.scheduledStartTime}
                    onChange={(e) => setEditForm({ ...editForm, scheduledStartTime: e.target.value })}
                    className="h-10 bg-white text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-slate-500">優先度</Label>
                  <Select
                    value={editForm.priority}
                    onValueChange={(v) => setEditForm({ ...editForm, priority: v as TaskPriority })}
                  >
                    <SelectTrigger className="h-10 bg-white text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">高</SelectItem>
                      <SelectItem value="medium">中</SelectItem>
                      <SelectItem value="low">低</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-slate-500">数量</Label>
                  <Input
                    type="number"
                    min={1}
                    value={editForm.quantity}
                    onChange={(e) => setEditForm({ ...editForm, quantity: Math.max(1, Number(e.target.value) || 1) })}
                    className="h-10 bg-white text-sm tabular-nums"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-slate-500">所要(分)</Label>
                  <Input
                    type="number"
                    min={5}
                    step={5}
                    value={editForm.durationMinutes}
                    onChange={(e) =>
                      setEditForm({ ...editForm, durationMinutes: e.target.value })
                    }
                    placeholder={String(getEstimatedMinutes(editTask?.taskMasterId ?? ''))}
                    className="h-10 bg-white text-sm tabular-nums"
                  />
                </div>
              </div>

              {editTask && (
                <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 text-[11px] text-slate-500 space-y-1">
                  <div className="flex justify-between">
                    <span className="font-bold uppercase tracking-wider">標準作業時間</span>
                    <span className="tabular-nums font-bold text-slate-700">
                      {getEstimatedMinutes(editTask.taskMasterId)} 分
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold uppercase tracking-wider">現在ステータス</span>
                    <span className="font-bold text-slate-700">
                      {editTask.status === 'completed' ? '完了'
                        : editTask.status === 'in_progress' ? '作業中'
                        : editTask.status === 'assigned' ? '割当済'
                        : editTask.dispatched ? '指示送信済' : '未指示'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between">
            <Button
              variant="outline"
              className="h-10 gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 font-bold"
              onClick={handleUnassign}
            >
              <Trash2 className="w-4 h-4" /> 割り当てを解除
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" className="h-10 gap-1 font-bold" onClick={closeEditDialog}>
                <XIcon className="w-4 h-4" /> キャンセル
              </Button>
              <Button className="h-10 gap-1 bg-blue-600 hover:bg-blue-700 font-bold" onClick={handleSaveEdit}>
                <Save className="w-4 h-4" /> 保存
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 自由タスク追加ダイアログ */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-600" />
              自由タスクを追加
            </DialogTitle>
            <DialogDescription>
              作業マスターに紐づかない臨時の作業を追加します。担当者を指定すれば即指示として送信、未指定ならプールに追加されます。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-500">
                作業内容
                {!createForm.inventoryId && <span className="text-red-500"> *必須</span>}
              </Label>
              <Input
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder={
                  createForm.inventoryId
                    ? '対象在庫名を使用します（任意で補足を追記）'
                    : '例：第2倉庫の整理整頓 / 緊急ピックアップ など'
                }
                className="h-10 bg-white text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-500">
                該当在庫（任意・選択するとタスクが在庫に紐付きます）
              </Label>
              <Select
                value={createForm.inventoryId || '__none__'}
                onValueChange={(v) =>
                  setCreateForm({ ...createForm, inventoryId: v === '__none__' ? '' : v })
                }
              >
                <SelectTrigger className="h-10 bg-white text-sm">
                  <SelectValue placeholder="在庫なし（自由タスク）" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="__none__">在庫なし（自由タスク）</SelectItem>
                  {selectableInventory.length === 0 ? (
                    <SelectItem value="__empty__" disabled>
                      対象拠点の在庫がありません
                    </SelectItem>
                  ) : (
                    selectableInventory.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.managementNumber || i.id} ／ {i.name}
                        {i.baseName ? `（${i.baseName}）` : ''}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {createForm.inventoryId && (() => {
                const linked = inventory.find((i) => i.id === createForm.inventoryId);
                if (!linked) return null;
                return (
                  <div className="rounded-md bg-blue-50 border border-blue-100 px-3 py-2 text-[11px] text-blue-700 flex items-center gap-2">
                    <Package className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                      {linked.managementNumber || linked.id} ／ {linked.name}
                      {linked.shelfCode ? ` ／ 棚: ${linked.shelfCode}` : ''}
                      {linked.status ? ` ／ 状態: ${linked.status}` : ''}
                    </span>
                  </div>
                );
              })()}
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-500">
                作業マスター（標準時間／単価の参照元）
              </Label>
              <Select
                value={createForm.taskMasterId}
                onValueChange={(v) => setCreateForm({ ...createForm, taskMasterId: v })}
              >
                <SelectTrigger className="h-10 bg-white text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getTaskMasters().map((tm) => (
                    <SelectItem key={tm.id} value={tm.id}>
                      {tm.name}（{tm.estimatedTime}分）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-slate-500">優先度</Label>
                <Select
                  value={createForm.priority}
                  onValueChange={(v) => setCreateForm({ ...createForm, priority: v as TaskPriority })}
                >
                  <SelectTrigger className="h-10 bg-white text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">高（緊急）</SelectItem>
                    <SelectItem value="medium">中（通常）</SelectItem>
                    <SelectItem value="low">低</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-slate-500">数量</Label>
                <Input
                  type="number"
                  min={1}
                  value={createForm.quantity}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      quantity: Math.max(1, Number(e.target.value) || 1),
                    })
                  }
                  className="h-10 bg-white text-sm tabular-nums"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-500">備考（任意）</Label>
              <textarea
                value={createForm.notes}
                onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                placeholder="作業者向けの補足事項があれば入力"
                rows={2}
                className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
              />
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createForm.assignNow}
                  onChange={(e) => setCreateForm({ ...createForm, assignNow: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs font-bold text-slate-700">
                  この場で担当者・日時を指定して即指示する
                </span>
              </label>

              {createForm.assignNow && (
                <div className="space-y-3 pt-1">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-slate-500">担当者</Label>
                    <Select
                      value={createForm.assigneeId}
                      onValueChange={(v) => setCreateForm({ ...createForm, assigneeId: v })}
                    >
                      <SelectTrigger className="h-10 bg-white text-sm">
                        <SelectValue placeholder="担当者を選択" />
                      </SelectTrigger>
                      <SelectContent>
                        {workers.length === 0 ? (
                          <SelectItem value="" disabled>
                            この拠点に作業員が登録されていません
                          </SelectItem>
                        ) : (
                          workers.map((w) => (
                            <SelectItem key={w.id} value={w.id}>
                              {w.name}（{w.base ?? '-'}）
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-slate-500">日付</Label>
                      <Input
                        type="date"
                        value={createForm.scheduledDate}
                        onChange={(e) =>
                          setCreateForm({ ...createForm, scheduledDate: e.target.value })
                        }
                        className="h-10 bg-white text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-slate-500">開始時刻</Label>
                      <Input
                        type="time"
                        value={createForm.scheduledStartTime}
                        onChange={(e) =>
                          setCreateForm({ ...createForm, scheduledStartTime: e.target.value })
                        }
                        className="h-10 bg-white text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" className="h-10 font-bold" onClick={() => setCreateOpen(false)}>
              <XIcon className="w-4 h-4 mr-1" /> キャンセル
            </Button>
            <Button
              className="h-10 gap-1 bg-blue-600 hover:bg-blue-700 font-bold"
              onClick={handleCreateFreeTask}
            >
              <Plus className="w-4 h-4" />
              {createForm.assignNow ? '作成して指示送信' : 'プールに追加'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Drag Overlay to show the task while dragging */}
      <DragOverlay>
        {activeTask ? (
          <div className="p-3 bg-white border-2 border-blue-600 rounded-lg shadow-xl w-64 opacity-90 cursor-grabbing pointer-events-none">
            <div className="flex justify-between items-start mb-2">
              <Badge className="text-[10px] bg-blue-100 text-blue-600 border-none">{activeTask.priority === 'high' ? '高' : '中'}</Badge>
            </div>
            <div className="font-bold text-xs text-[#1e293b] mb-1">{getTaskMasters().find(m => m.id === activeTask.taskMasterId)?.name}</div>
            <div className="text-[10px] text-slate-500 truncate">{activeTask.targetName}</div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
