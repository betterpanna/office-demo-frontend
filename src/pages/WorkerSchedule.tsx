import React, { useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Package,
  MapPin,
  MoreVertical,
  CalendarPlus,
  CalendarOff,
  Send,
  Trash2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  isSameMonth,
} from 'date-fns';
import { ja } from 'date-fns/locale';
import { useTaskMasters } from '@/src/stores/taskMastersStore';
import { useTasks } from '@/src/stores/tasksStore';
import { useCurrentUser } from '@/src/stores/currentUserStore';
import { getJapaneseHolidayName } from '@/src/constants/holidaysJP';
import { useT } from '@/src/stores/i18nStore';
import {
  submitLeaveRequest,
  submitPaidLeaveRequest,
  withdrawRequest,
  useShiftRequests,
  useShifts,
  getEffectiveHours,
  ShiftRequest,
} from '@/src/stores/shiftsStore';
import { toast } from 'sonner';

export function WorkerSchedule() {
  const t = useT();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const allTasks = useTasks();
  const taskMasters = useTaskMasters();
  const currentUser = useCurrentUser();
  const myId = currentUser?.id ?? 'u2';
  const myName = currentUser?.name ?? '作業員';

  // 自分の申告（シフト・休日変更を購読）
  const myRequests = useShiftRequests().filter((r) => r.userId === myId);
  useShifts();

  // 申告ダイアログ（休日申請 / 有給申請）
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [paidLeaveDialogOpen, setPaidLeaveDialogOpen] = useState(false);
  const [reqDate, setReqDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reqNote, setReqNote] = useState('');

  const openLeaveDialog = (date: Date = selectedDate) => {
    setReqDate(format(date, 'yyyy-MM-dd'));
    setReqNote('');
    setLeaveDialogOpen(true);
  };
  const openPaidLeaveDialog = (date: Date = selectedDate) => {
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
      userId: myId,
      userName: myName,
      date: reqDate,
      note: reqNote || undefined,
    });
    toast.success(`${reqDate} の休日を申請しました（承認待ち）`);
    setLeaveDialogOpen(false);
  };
  const submitPaidLeave = () => {
    if (!reqDate) {
      toast.error('対象日を入力してください');
      return;
    }
    submitPaidLeaveRequest({
      userId: myId,
      userName: myName,
      date: reqDate,
      note: reqNote || undefined,
    });
    toast.success(`${reqDate} の有給を申請しました（承認待ち）`);
    setPaidLeaveDialogOpen(false);
  };
  const cancelRequest = (r: ShiftRequest) => {
    withdrawRequest(r.id);
    toast.message(`${r.date} の申告を取り下げました`);
  };

  const start = startOfWeek(currentDate, { locale: ja });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  const monthDays = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate)
  });

  const dailyTasks = allTasks.filter(t =>
    t.assigneeId === myId &&
    isSameDay(new Date(t.scheduledDate), selectedDate)
  );

  const prevMonth = () => setCurrentDate(addDays(startOfMonth(currentDate), -1));
  const nextMonth = () => setCurrentDate(addDays(endOfMonth(currentDate), 1));

  return (
    <div className="p-4 space-y-6 pb-24 h-full overflow-y-auto bg-slate-50">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#1e293b]">{t('schedule.todaySchedule')}</h2>
          <div className="flex items-center bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('week')}
              className={cn(
                "px-3 py-1.5 text-[10px] font-bold rounded-md transition-all",
                viewMode === 'week' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
              )}
            >
              {t('schedule.weekView')}
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={cn(
                "px-3 py-1.5 text-[10px] font-bold rounded-md transition-all",
                viewMode === 'month' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
              )}
            >
              {t('schedule.monthView')}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs font-bold">{format(currentDate, 'yyyy年MM月', { locale: ja })}</span>
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
            const eff = getEffectiveHours(myId, dStr);
            const isHoliday = eff.isHoliday;
            const jpName = eff.holidayName ?? getJapaneseHolidayName(dStr);
            const isJpHoliday = eff.source === 'holiday' || Boolean(jpName);
            return (
              <button
                key={i}
                onClick={() => setSelectedDate(day)}
                title={jpName ?? undefined}
                className={cn(
                  "flex flex-col items-center gap-1.5 w-10 py-2 rounded-xl transition-all",
                  isSelected
                    ? "bg-blue-600 text-white shadow-md shadow-blue-100"
                    : isHoliday
                      ? "bg-rose-50 hover:bg-rose-100"
                      : "hover:bg-slate-50",
                )}
              >
                <span className={cn(
                  "text-[10px] font-bold uppercase",
                  isSelected ? "text-blue-100" : isHoliday ? "text-rose-500" : "text-slate-400",
                )}>
                  {format(day, 'E', { locale: ja })}
                </span>
                <span className={cn("text-sm font-bold", !isSelected && isHoliday && "text-rose-500")}>
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
          {['日', '月', '火', '水', '木', '金', '土'].map(d => (
            <div key={d} className="text-center text-[9px] font-bold text-slate-400 py-1">{d}</div>
          ))}
          {monthDays.map((day, i) => {
            const isSelected = isSameDay(day, selectedDate);
            const isToday = isSameDay(day, new Date());
            const hasTasks = allTasks.some(t => t.assigneeId === myId && isSameDay(new Date(t.scheduledDate), day));
            const dStr = format(day, 'yyyy-MM-dd');
            const eff = getEffectiveHours(myId, dStr);
            const isHoliday = eff.isHoliday;
            const isJpHoliday = eff.source === 'holiday' || Boolean(getJapaneseHolidayName(dStr));

            return (
              <button
                key={i}
                onClick={() => setSelectedDate(day)}
                title={isJpHoliday ? (eff.holidayName ?? getJapaneseHolidayName(dStr) ?? '') : undefined}
                className={cn(
                  "aspect-square flex flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] relative transition-all",
                  isSelected ? "bg-blue-600 text-white z-10 scale-105 shadow-md" :
                  !isSameMonth(day, currentDate) ? "text-slate-200" :
                  isHoliday ? "bg-rose-50 text-rose-500 hover:bg-rose-100" : "hover:bg-slate-50 text-slate-700",
                )}
              >
                <span>{format(day, 'd')}</span>
                {hasTasks && <div className={cn("w-1 h-1 rounded-full", isSelected ? "bg-white" : "bg-blue-400")} />}
                {!isSelected && isSameMonth(day, currentDate) && isHoliday && !hasTasks && (
                  <span className="text-[7px] font-black opacity-70">{isJpHoliday ? t('schedule.holidayMark') : t('schedule.dayOffMark')}</span>
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

      {/* 当日の出勤ステータス（就業時間マスタ＋承認シフト＋承認休業＋祝日） */}
      {(() => {
        const eff = getEffectiveHours(myId, format(selectedDate, 'yyyy-MM-dd'));
        const sourceLabel =
          eff.source === 'shift'
            ? t('schedule.shiftApproved')
            : eff.source === 'leave'
              ? t('schedule.holidayApproved')
              : eff.source === 'holiday'
                ? `${t('schedule.holidayPrefix')}: ${eff.holidayName ?? ''}`
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
              {eff.isHoliday ? <CalendarOff className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                {sourceLabel}
              </p>
              <p className={cn(
                'text-sm font-bold',
                eff.isHoliday ? 'text-rose-700' : 'text-slate-800',
              )}>
                {eff.isHoliday ? t('schedule.holiday') : `${eff.start} 〜 ${eff.end} ${t('schedule.scheduledFromTo')}`}
              </p>
            </div>
          </Card>
        );
      })()}

      {/* Daily Tasks */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-sm">
            {format(selectedDate, 'MM月dd日 (E)', { locale: ja })} {t('schedule.daySchedule')}
          </h3>
          <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none px-2 py-0.5 text-[10px]">
            {dailyTasks.length}{t('schedule.numTasksWord')}
          </Badge>
        </div>

        {dailyTasks.length > 0 ? (
          dailyTasks.map((task, idx) => {
            const tm = taskMasters.find(m => m.id === task.taskMasterId);
            return (
              <Card key={idx} className="border-none shadow-sm rounded-2xl overflow-hidden">
                <div className="flex">
                  <div className={cn(
                    "w-1.5",
                    task.priority === 'high' ? "bg-red-500" : 
                    task.priority === 'medium' ? "bg-blue-500" : "bg-slate-300"
                  )} />
                  <CardContent className="p-4 flex-1">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold text-slate-900">{tm?.name}</h4>
                          {task.priority === 'high' && (
                            <Badge className="bg-red-50 text-red-600 border-none text-[8px] h-4 px-1">{t('schedule.urgent')}</Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {t('schedule.locationSample')}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-50">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span className="tabular-nums">
                            {task.scheduledStartTime
                              ? `${task.scheduledStartTime}〜${task.scheduledEndTime ?? ''}`
                              : t('schedule.timeNotSet')}
                          </span>
                          {task.durationMinutes && (
                            <span className="text-[10px] text-slate-400">({task.durationMinutes}{t('schedule.minShort')})</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <Package className="w-3.5 h-3.5 text-slate-400" />
                          <span>{t('schedule.quantity')}: {task.quantity}</span>
                        </div>
                      </div>
                      <Button size="sm" className="bg-blue-600 hover:bg-blue-700 h-8 rounded-lg text-[10px] px-3 font-bold">
                        {t('schedule.viewDetail')}
                      </Button>
                    </div>
                  </CardContent>
                </div>
              </Card>
            );
          })
        ) : (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-3 italic">
            <CalendarIcon className="w-12 h-12 opacity-20" />
            <p className="text-xs">{t('schedule.noScheduled')}</p>
          </div>
        )}
      </div>

      {/* Resource Stats / Summary */}
      {(() => {
        const totalMinutes = dailyTasks.reduce(
          (sum, t) => sum + (t.durationMinutes || taskMasters.find((m) => m.id === t.taskMasterId)?.estimatedTime || 0),
          0,
        );
        const totalReward = dailyTasks.reduce(
          (sum, t) => sum + (taskMasters.find((m) => m.id === t.taskMasterId)?.basePrice || 0),
          0,
        );
        return (
          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-sky-50 border-none shadow-none rounded-2xl p-4">
              <p className="text-[10px] font-bold text-sky-600 uppercase mb-1">{t('schedule.totalEstTime')}</p>
              <div className="flex items-end gap-1">
                <span className="text-xl font-black text-sky-900 tabular-nums">{totalMinutes}</span>
                <span className="text-[10px] text-sky-700 mb-1">{t('schedule.minutes')}</span>
              </div>
            </Card>
            <Card className="bg-emerald-50 border-none shadow-none rounded-2xl p-4">
              <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1">{t('schedule.estReward')}</p>
              <div className="flex items-end gap-1">
                <span className="text-xl font-black text-emerald-900 tabular-nums">¥{totalReward.toLocaleString()}</span>
              </div>
            </Card>
          </div>
        );
      })()}

      {/* 申告履歴 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-sm">{t('request.historyTitle')}</h3>
          <Badge
            variant="secondary"
            className="bg-slate-100 text-slate-600 border-none px-2 py-0.5 text-[10px]"
          >
            {myRequests.length}
          </Badge>
        </div>
        {myRequests.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 py-8 text-center text-[11px] text-slate-400">
            {t('request.empty')}
          </div>
        ) : (
          <div className="space-y-2">
            {myRequests.slice(0, 8).map((r) => (
              <Card
                key={r.id}
                className="border-none shadow-sm rounded-xl p-3 flex items-center justify-between gap-3"
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
        )}
      </div>

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
              <Label htmlFor="leave-date" className="text-[11px] font-bold">{t('request.targetDate')}</Label>
              <Input
                id="leave-date"
                type="date"
                value={reqDate}
                onChange={(e) => setReqDate(e.target.value)}
                className="mt-1 h-9 text-xs"
              />
            </div>
            <div>
              <Label htmlFor="leave-note" className="text-[11px] font-bold">{t('request.reasonOptional')}</Label>
              <Textarea
                id="leave-note"
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
              <Label htmlFor="paid-leave-date" className="text-[11px] font-bold">{t('request.targetDate')}</Label>
              <Input
                id="paid-leave-date"
                type="date"
                value={reqDate}
                onChange={(e) => setReqDate(e.target.value)}
                className="mt-1 h-9 text-xs"
              />
            </div>
            <div>
              <Label htmlFor="paid-leave-note" className="text-[11px] font-bold">{t('request.reasonOptional')}</Label>
              <Textarea
                id="paid-leave-note"
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
