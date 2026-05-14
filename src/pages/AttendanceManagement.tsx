import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Users,
  Clock,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  Download,
  AlertCircle,
  CheckCircle2,
  MoreVertical,
  CalendarDays,
  FileText,
  DollarSign,
  Briefcase,
  ClipboardList,
  Inbox,
  Check,
  X as XIcon
} from 'lucide-react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MOCK_USERS,
  MOCK_ATTENDANCE,
  MOCK_SHIFTS,
  MOCK_SALARY_REPORTS
} from '../mockData';
import { cn } from '@/lib/utils';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay, isWeekend } from 'date-fns';
import { ja } from 'date-fns/locale';
import {
  useShiftRequests,
  useShifts,
  approveRequest,
  rejectRequest,
  setHolidayForUser,
  clearHolidayForUser,
  isHolidayForUser,
  setShiftForUser,
  clearShiftForUser,
  getEffectiveHours,
  ShiftRequest,
} from '@/src/stores/shiftsStore';
import { useWorkingHours, getHoursForDate } from '@/src/stores/workingHoursStore';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, CalendarOff, GripVertical, X as XClose } from 'lucide-react';
import { getJapaneseHolidayName } from '@/src/constants/holidaysJP';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  DragOverlay,
  DragEndEvent,
} from '@dnd-kit/core';
import { useT } from '@/src/stores/i18nStore';

interface AttendanceManagementProps {
  selectedBase?: string;
}

export default function AttendanceManagement({ selectedBase }: AttendanceManagementProps) {
  const t = useT();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState('calendar');
  const [searchTerm, setSearchTerm] = useState('');

  // 就業時間マスタ・シフト・申告 ストアの購読（変更時に再描画）
  useWorkingHours();
  useShifts();
  useShiftRequests();

  // 休日追加・解除ダイアログ
  const [holidayDialog, setHolidayDialog] = useState<{ open: boolean; date: Date | null }>({
    open: false,
    date: null,
  });
  const [holidayUserId, setHolidayUserId] = useState<string>('');
  const [holidayNote, setHolidayNote] = useState('');

  // 締め処理期間の算出 (21日〜20日)
  const salaryPeriod = useMemo(() => {
    let start, end;
    if (currentDate.getDate() >= 21) {
      start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 21);
      const nextMonth = addMonths(currentDate, 1);
      end = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 20);
    } else {
      const prevMonth = subMonths(currentDate, 1);
      start = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 21);
      end = new Date(currentDate.getFullYear(), currentDate.getMonth(), 20);
    }
    return { start, end };
  }, [currentDate]);

  const daysInMonth = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // Filter users and attendance data by selectedBase
  const filteredUsers = useMemo(() => 
    MOCK_USERS.filter(u => (!selectedBase || u.base === selectedBase) && u.role !== 'admin'), 
    [selectedBase]
  );
  
  const filteredAttendance = useMemo(() => 
    MOCK_ATTENDANCE.filter(a => MOCK_USERS.find(u => u.id === a.userId)?.base === (selectedBase || MOCK_USERS.find(u => u.id === a.userId)?.base)),
    [selectedBase]
  );

  const filteredShifts = useMemo(() => 
    MOCK_SHIFTS.filter(s => MOCK_USERS.find(u => u.id === s.userId)?.base === (selectedBase || MOCK_USERS.find(u => u.id === s.userId)?.base)),
    [selectedBase]
  );

  const filteredSalaryReports = useMemo(() => 
    MOCK_SALARY_REPORTS.filter(r => MOCK_USERS.find(u => u.id === r.userId)?.base === (selectedBase || MOCK_USERS.find(u => u.id === r.userId)?.base)),
    [selectedBase]
  );

  const stats = useMemo(() => ({
    totalEmployees: filteredUsers.length,
    presentToday: filteredAttendance.filter(a => a.date === format(currentDate, 'yyyy-MM-dd') && a.clockIn).length,
    lateToday: filteredAttendance.filter(a => a.date === format(currentDate, 'yyyy-MM-dd') && a.status === 'late').length,
    absentToday: filteredUsers.length - filteredAttendance.filter(a => a.date === format(currentDate, 'yyyy-MM-dd') && a.clockIn).length,
  }), [filteredUsers, filteredAttendance, currentDate]);

  /**
   * 就業時間マスタ + 承認済シフト + 承認済休業 をマージして、
   * 各日 × 各従業員の「シフト」を再構成する。
   *   - source='leave'  : 休日（管理者設定 or 承認済休業申告）
   *   - source='shift'  : 個別申告で承認されたシフト
   *   - source='master' : 就業時間マスタの通常出勤
   * カレンダーには出勤予定（leave 以外）を従業員名として表示する。
   */
  type DayEntry = {
    user: typeof filteredUsers[number];
    start: string;
    end: string;
    source: 'shift' | 'leave' | 'holiday' | 'master';
    isHoliday: boolean;
    holidayName?: string;
  };
  const dayEntries = useMemo(() => {
    const map = new Map<string, DayEntry[]>();
    daysInMonth.forEach((day) => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const list: DayEntry[] = [];
      filteredUsers.forEach((u) => {
        const eff = getEffectiveHours(u.id, dateStr);
        list.push({
          user: u,
          start: eff.start,
          end: eff.end,
          source: eff.source,
          isHoliday: eff.isHoliday,
          holidayName: eff.holidayName,
        });
      });
      map.set(dateStr, list);
    });
    return map;
  }, [daysInMonth, filteredUsers]);

  // ある日の出勤予定者（休日扱いではない）
  const getActiveEntries = (dateStr: string): DayEntry[] => {
    return (dayEntries.get(dateStr) ?? []).filter((e) => !e.isHoliday);
  };
  // ある日の休日エントリ（休業申告承認 or 国民の祝日）
  const getHolidayEntries = (dateStr: string): DayEntry[] => {
    return (dayEntries.get(dateStr) ?? []).filter((e) => e.source === 'leave' || e.source === 'holiday');
  };

  const openHolidayDialog = (day: Date) => {
    setHolidayDialog({ open: true, date: day });
    setHolidayUserId(filteredUsers[0]?.id ?? '');
    setHolidayNote('');
  };

  const handleAddHoliday = () => {
    if (!holidayDialog.date || !holidayUserId) {
      toast.error('対象の日付・従業員を指定してください');
      return;
    }
    const dateStr = format(holidayDialog.date, 'yyyy-MM-dd');
    const r = setHolidayForUser({
      userId: holidayUserId,
      date: dateStr,
      note: holidayNote || '管理者設定の休日',
      reviewedBy: '管理者',
    });
    const name = filteredUsers.find((u) => u.id === holidayUserId)?.name ?? '';
    if (r) {
      toast.success(`${dateStr} を ${name} の休日に設定しました`);
    } else {
      toast.message('既に休日として設定されています');
    }
    setHolidayDialog({ open: false, date: null });
  };

  const handleRemoveHoliday = (userId: string, dateStr: string) => {
    const ok = clearHolidayForUser(userId, dateStr);
    if (ok) {
      const name = filteredUsers.find((u) => u.id === userId)?.name ?? '';
      toast.success(`${dateStr} の ${name} の休日設定を解除しました`);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('att.title')}</h1>
          <p className="text-slate-500 text-sm">{t('att.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="bg-white border rounded-md px-3 py-1 text-sm font-bold shadow-sm flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-blue-600" />
            {format(currentDate, 'yyyy年 M月', { locale: ja })}
          </div>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm bg-white overflow-hidden group">
          <CardContent className="p-5 flex items-center gap-4 relative">
            <div className="p-3 bg-blue-50 rounded-xl text-blue-600 transition-transform group-hover:scale-110">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t('att.totalEmployees')}</p>
              <h3 className="text-2xl font-black text-slate-800">{stats.totalEmployees} <span className="text-xs font-medium text-slate-400">{t('att.staff')}</span></h3>
            </div>
            <div className="absolute top-0 right-0 w-2 h-full bg-blue-600 opacity-10" />
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-sm bg-white overflow-hidden group">
          <CardContent className="p-5 flex items-center gap-4 relative">
            <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600 transition-transform group-hover:scale-110">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t('att.todayPresent')}</p>
              <h3 className="text-2xl font-black text-slate-800">{stats.presentToday} <span className="text-xs font-medium text-slate-400">{t('att.staff')}</span></h3>
            </div>
            <div className="absolute top-0 right-0 w-2 h-full bg-emerald-600 opacity-10" />
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white overflow-hidden group">
          <CardContent className="p-5 flex items-center gap-4 relative">
            <div className="p-3 bg-amber-50 rounded-xl text-amber-600 transition-transform group-hover:scale-110">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t('att.lateEarly')}</p>
              <h3 className="text-2xl font-black text-slate-800">{stats.lateToday} <span className="text-xs font-medium text-slate-400">{t('admin.cases')}</span></h3>
            </div>
            <div className="absolute top-0 right-0 w-2 h-full bg-amber-600 opacity-10" />
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white overflow-hidden group">
          <CardContent className="p-5 flex items-center gap-4 relative">
            <div className="p-3 bg-rose-50 rounded-xl text-rose-600 transition-transform group-hover:scale-110">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t('att.absentNotPresent')}</p>
              <h3 className="text-2xl font-black text-slate-800">{stats.absentToday} <span className="text-xs font-medium text-slate-400">{t('att.staff')}</span></h3>
            </div>
            <div className="absolute top-0 right-0 w-2 h-full bg-rose-600 opacity-10" />
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm bg-white overflow-hidden">
        <Tabs defaultValue="calendar" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="px-6 pt-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <TabsList className="bg-slate-100 p-1 border-none h-10">
              <TabsTrigger value="calendar" className="data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 text-xs font-bold gap-2 px-4">
                <CalendarDays className="w-3.5 h-3.5" /> {t('att.tabCalendar')}
              </TabsTrigger>
              <TabsTrigger value="shift" className="data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 text-xs font-bold gap-2 px-4">
                <ClipboardList className="w-3.5 h-3.5" /> {t('att.tabShifts')}
              </TabsTrigger>
              <TabsTrigger value="history" className="data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 text-xs font-bold gap-2 px-4">
                <FileText className="w-3.5 h-3.5" /> {t('att.tabHistory')}
              </TabsTrigger>
              <TabsTrigger value="salary" className="data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 text-xs font-bold gap-2 px-4">
                <DollarSign className="w-3.5 h-3.5" /> {t('att.tabPayroll')}
              </TabsTrigger>
            </TabsList>
            
            <div className="flex items-center gap-2 w-full md:w-auto">
              {activeTab !== 'calendar' && (
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    placeholder={t('att.searchName')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-10 bg-slate-50 border-slate-200"
                  />
                </div>
              )}
              <Button variant="outline" size="sm" className="h-10 text-xs font-bold gap-2">
                <Download className="w-3.5 h-3.5" /> {t('att.export')}
              </Button>
            </div>
          </div>

          <CardHeader className="pt-2">
            <CardDescription className="text-[11px] font-bold text-blue-600 bg-blue-50 w-fit px-3 py-1 rounded-full border border-blue-100 transition-all hover:scale-105 cursor-help">
              {t('att.closingPeriod')}: {format(salaryPeriod.start, 'yyyy/MM/21')} 〜 {format(salaryPeriod.end, 'yyyy/MM/20')}
            </CardDescription>
          </CardHeader>

          <CardContent className="px-6 pb-6 pt-0">
            <TabsContent value="calendar" className="mt-0 space-y-4">
              {/* 凡例 */}
              <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-blue-100 border border-blue-200" /> {t('att.legendShift')}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-100 border border-emerald-200" /> {t('att.legendApproved')}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-100 border border-rose-200" /> {t('att.legendHoliday')}
                </span>
                <span className="ml-auto text-slate-400 font-medium italic">{t('att.legendHint')}</span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-3">
                  <div className="grid grid-cols-7 border-t border-l border-slate-100">
                    {['日', '月', '火', '水', '木', '金', '土'].map(d => (
                      <div key={d} className="bg-slate-50 py-2 border-r border-b border-slate-100 text-[10px] font-bold text-slate-500 text-center uppercase tracking-widest">
                        {d}
                      </div>
                    ))}
                    {Array.from({ length: getDay(daysInMonth[0]) }).map((_, i) => (
                      <div key={`empty-${i}`} className="min-h-[120px] bg-slate-50/20 border-r border-b border-slate-100" />
                    ))}
                    {daysInMonth.map(day => {
                      const dayStr = format(day, 'yyyy-MM-dd');
                      const activeEntries = getActiveEntries(dayStr);
                      const holidayEntries = getHolidayEntries(dayStr);
                      const isToday = isSameDay(day, new Date());
                      const jpHoliday = getJapaneseHolidayName(dayStr);

                      return (
                        <div
                          key={dayStr}
                          className={cn(
                            "min-h-[120px] p-2 border-r border-b border-slate-100 group transition-all hover:bg-white cursor-pointer relative",
                            isToday && "bg-blue-50/30 ring-1 ring-inset ring-blue-100",
                            jpHoliday && !isToday && "bg-rose-50/40",
                            !isSameDay(day, currentDate) && "hover:border-blue-400"
                          )}
                          onClick={() => setCurrentDate(day)}
                        >
                          <div className="flex justify-between items-center mb-2">
                            <span className={cn(
                              "w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold transition-all",
                              isToday ? "bg-blue-600 text-white shadow-md scale-110" :
                              jpHoliday ? "text-rose-600" :
                              isWeekend(day) ? "text-rose-500" : "text-slate-500",
                              isSameDay(day, currentDate) && !isToday && "bg-slate-800 text-white"
                            )}>
                              {day.getDate()}
                            </span>
                            <div className="flex items-center gap-1">
                              {activeEntries.length > 0 && (
                                <Badge variant="outline" className="text-[9px] font-black h-4 px-1.5 bg-white border-slate-100">
                                  {activeEntries.length}
                                </Badge>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openHolidayDialog(day);
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity w-4 h-4 rounded-full bg-rose-50 text-rose-500 hover:bg-rose-100 flex items-center justify-center"
                                title={t('att.holidayAdd')}
                              >
                                <Plus className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>
                          {jpHoliday && (
                            <div className="text-[9px] text-rose-600 font-bold mb-1 truncate flex items-center gap-1">
                              <CalendarOff className="w-2.5 h-2.5 shrink-0" />
                              {jpHoliday}
                            </div>
                          )}
                          <div className="space-y-1">
                            {activeEntries.map((e) => (
                              <div
                                key={`act-${e.user.id}`}
                                className={cn(
                                  "text-[9px] p-1 border rounded shadow-sm flex flex-col gap-0.5 leading-tight transition-all",
                                  e.source === 'shift'
                                    ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                                    : "bg-blue-50 border-blue-100 text-blue-700",
                                )}
                              >
                                <span className="font-bold truncate">{e.user.name}</span>
                                <span className="opacity-70 flex items-center gap-0.5 font-mono">
                                  <Clock className="w-2 h-2" /> {e.start}-{e.end}
                                </span>
                              </div>
                            ))}
                            {holidayEntries.map((e) => {
                              const isNationalHoliday = e.source === 'holiday';
                              return (
                                <button
                                  key={`hol-${e.user.id}`}
                                  type="button"
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    if (isNationalHoliday) return; // 祝日は解除不可
                                    if (window.confirm(`${dayStr} の ${e.user.name} の休日設定を解除しますか？`)) {
                                      handleRemoveHoliday(e.user.id, dayStr);
                                    }
                                  }}
                                  disabled={isNationalHoliday}
                                  className={cn(
                                    'w-full text-left text-[9px] p-1 border rounded shadow-sm flex items-center gap-1 leading-tight transition-colors',
                                    isNationalHoliday
                                      ? 'bg-rose-100 border-rose-200 text-rose-700 cursor-default'
                                      : 'bg-rose-50 border-rose-100 text-rose-700 hover:bg-rose-100',
                                  )}
                                  title={
                                    isNationalHoliday
                                      ? `${t('schedule.holidayPrefix')}: ${e.holidayName ?? ''}`
                                      : t('att.holidayRemove')
                                  }
                                >
                                  <CalendarOff className="w-2.5 h-2.5 shrink-0" />
                                  <span className="font-bold truncate">{e.user.name}</span>
                                  <span className="ml-auto text-[8px] font-bold opacity-70 shrink-0">
                                    {isNationalHoliday ? t('att.holidayMark') : t('att.dayOffMark')}
                                  </span>
                                </button>
                              );
                            })}
                            {activeEntries.length === 0 && holidayEntries.length === 0 && (
                              <p className="text-[9px] text-slate-300 italic">{t('att.noShiftPlan')}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="lg:col-span-1 border border-slate-100 rounded-xl bg-slate-50/50 p-4 space-y-4">
                   <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">{t('att.staffTimeline')}</h4>
                      <Badge className="bg-slate-800 text-[9px]">{format(currentDate, 'M/d')}</Badge>
                   </div>

                   <div className="relative h-[400px] border-l-2 border-slate-200 ml-4 pl-4 space-y-6 py-2">
                      {[8, 10, 12, 14, 16, 18, 20, 22].map(hour => (
                        <div key={hour} className="relative">
                          <span className="absolute -left-10 top-0 text-[10px] font-bold text-slate-400">{hour}:00</span>
                          <div className="h-px bg-slate-100 w-full" />
                        </div>
                      ))}

                      <div className="absolute inset-0 pt-2 flex gap-1">
                        {getActiveEntries(format(currentDate, 'yyyy-MM-dd')).map((e, idx) => {
                          const startHour = parseInt(e.start.split(':')[0]);
                          const endHour = parseInt(e.end.split(':')[0]);
                          const startPercent = ((startHour - 8) / 16) * 100;
                          const heightPercent = ((endHour - startHour) / 16) * 100;

                          return (
                            <div
                              key={`tl-${e.user.id}`}
                              className={cn(
                                "flex-1 rounded-lg border shadow-sm p-1 flex flex-col justify-between overflow-hidden transition-all hover:ring-2 hover:ring-offset-1",
                                e.source === 'shift'
                                  ? "bg-emerald-100 border-emerald-300 text-emerald-800 hover:ring-emerald-400"
                                  : "bg-blue-100 border-blue-300 text-blue-800 hover:ring-blue-400",
                              )}
                              style={{
                                marginTop: `${startPercent}%`,
                                height: `${heightPercent}%`,
                                zIndex: idx,
                              }}
                            >
                              <span className="text-[8px] font-black leading-none">
                                {(e.user.name || '').split(' ')[1] || e.user.name || t('att.unknown')}
                              </span>
                              <span className="text-[7px] font-mono opacity-60 text-center">{e.start}</span>
                            </div>
                          );
                        })}
                      </div>
                   </div>

                   <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm space-y-3">
                      {(() => {
                        const dStr = format(currentDate, 'yyyy-MM-dd');
                        const active = getActiveEntries(dStr).length;
                        const off = getHolidayEntries(dStr).length;
                        const total = filteredUsers.length;
                        return (
                          <>
                            <div className="flex justify-between items-center text-[10px] font-bold">
                              <span className="text-slate-400">{t('att.coverageStatus')}</span>
                              <Badge className={cn('text-[9px]', active >= Math.ceil(total * 0.6) ? 'bg-emerald-500' : 'bg-amber-500')}>
                                {active >= Math.ceil(total * 0.6) ? t('att.adequate') : t('att.needsStaff')}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <div
                                  key={i}
                                  className={cn(
                                    'flex-1 h-1.5 rounded-full',
                                    i < Math.min(5, active) ? 'bg-blue-500' : 'bg-slate-100',
                                  )}
                                />
                              ))}
                            </div>
                            <p className="text-[9px] text-slate-500 leading-tight">
                              本日の出勤予定 {active} 名 / 休日 {off} 名（全 {total} 名中）。
                              就業時間マスタを基に自動算出しています。
                            </p>
                          </>
                        );
                      })()}
                   </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="shift" className="mt-0 space-y-6">
              <ShiftEditorCalendar
                selectedBase={selectedBase}
                anchorDate={currentDate}
              />
              <ShiftRequestReviewPanel selectedBase={selectedBase} />
            </TabsContent>

            <TabsContent value="history" className="mt-0">
              <div className="rounded-lg border border-slate-100 overflow-hidden shadow-sm">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="text-[10px] font-bold py-4">{t('att.colDate')}</TableHead>
                      <TableHead className="text-[10px] font-bold py-4">{t('att.colName')}</TableHead>
                      <TableHead className="text-[10px] font-bold py-4 text-center">{t('att.colIn')}</TableHead>
                      <TableHead className="text-[10px] font-bold py-4 text-center">{t('att.colOut')}</TableHead>
                      <TableHead className="text-[10px] font-bold py-4 text-center">{t('att.colBreak')}</TableHead>
                      <TableHead className="text-[10px] font-bold py-4 text-center text-blue-600">{t('att.colWorking')}</TableHead>
                      <TableHead className="text-[10px] font-bold py-4 text-center">{t('att.colState')}</TableHead>
                      <TableHead className="text-[10px] font-bold py-4">{t('att.colNote')}</TableHead>
                      <TableHead className="w-[50px] py-4"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAttendance
                      .filter(a => (a.userName || '').includes(searchTerm))
                      .map((log) => (
                      <TableRow key={log.id} className="hover:bg-slate-50 transition-colors">
                        <TableCell className="text-xs font-mono py-4">{log.date}</TableCell>
                        <TableCell className="text-xs font-bold py-4">{log.userName}</TableCell>
                        <TableCell className="text-xs text-center font-mono py-4">
                          {log.clockIn ? <span className="p-1 px-2 bg-blue-50 text-blue-700 rounded font-bold">{log.clockIn}</span> : '-'}
                        </TableCell>
                        <TableCell className="text-xs text-center font-mono py-4">
                          {log.clockOut ? <span className="p-1 px-2 bg-slate-50 text-slate-700 rounded font-bold">{log.clockOut}</span> : '-'}
                        </TableCell>
                        <TableCell className="text-xs text-center py-4">{log.breakMinutes}</TableCell>
                        <TableCell className="text-xs text-center font-bold text-blue-600 py-4">
                          {Math.floor(log.workingMinutes / 60)}h {log.workingMinutes % 60}m
                        </TableCell>
                        <TableCell className="text-center py-4">
                          <Badge variant="outline" className={cn(
                            "text-[9px] font-bold border-none px-2",
                            log.status === 'present' ? "bg-emerald-50 text-emerald-600" :
                            log.status === 'late' ? "bg-amber-50 text-amber-600" :
                            log.status === 'early_leave' ? "bg-indigo-50 text-indigo-600" : "bg-rose-50 text-rose-600"
                          )}>
                            {log.status === 'present' ? t('att.present') :
                             log.status === 'late' ? t('att.late') :
                             log.status === 'early_leave' ? t('att.earlyLeave') : t('att.absent')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500 py-4 truncate max-w-[150px]">{log.note}</TableCell>
                        <TableCell className="py-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-200">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              }
                            />
                            <DropdownMenuContent align="end" className="bg-white">
                              <DropdownMenuItem className="text-xs font-bold">{t('att.fixRequest')}</DropdownMenuItem>
                              <DropdownMenuItem className="text-xs font-bold">{t('att.adminApprove')}</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="salary" className="mt-0 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 border border-slate-100 shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">{t('att.payrollSummary')}</h3>
                    <Badge className="bg-blue-600 text-white font-mono text-[10px]">TOTAL FOR PERIOD</Badge>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px] font-bold py-4">{t('att.colName')}</TableHead>
                        <TableHead className="text-[10px] font-bold py-4 text-center">{t('att.workDays')}</TableHead>
                        <TableHead className="text-[10px] font-bold py-4 text-center">{t('att.totalHours')}</TableHead>
                        <TableHead className="text-[10px] font-bold py-4 text-center">{t('att.overtime')}</TableHead>
                        <TableHead className="text-[10px] font-bold py-4 text-right">{t('att.basePay')}</TableHead>
                        <TableHead className="text-[10px] font-bold py-4 text-right">{t('att.allowance')}</TableHead>
                        <TableHead className="text-[10px] font-bold py-4 text-right bg-blue-50 text-blue-600">{t('att.totalPay')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSalaryReports
                        .filter(r => (r.userName || '').includes(searchTerm))
                        .map((report) => (
                        <TableRow key={report.userId} className="hover:bg-slate-50 transition-colors">
                          <TableCell className="text-xs font-bold py-5">{report.userName}</TableCell>
                          <TableCell className="text-xs text-center py-5 font-mono">{report.totalWorkingDays}{t('att.daysSuffix')}</TableCell>
                          <TableCell className="text-xs text-center py-5 font-mono">{report.totalWorkingHours}h</TableCell>
                          <TableCell className="text-xs text-center py-5 text-amber-600 font-mono">+{report.totalOvertimeHours}h</TableCell>
                          <TableCell className="text-xs text-right py-5 text-slate-500">¥{report.baseSalary.toLocaleString()}</TableCell>
                          <TableCell className="text-xs text-right py-5 text-slate-500">¥{report.allowances.toLocaleString()}</TableCell>
                          <TableCell className="text-xs text-right py-5 font-black text-blue-700 bg-blue-50/50">¥{report.totalSalary.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>

                <div className="space-y-6">
                  <Card className="border border-slate-100 shadow-sm p-5 bg-white">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">{t('att.laborCostStructure')}</h3>
                    <div className="space-y-4">
                       {filteredSalaryReports.map((report, idx) => (
                         <div key={report.userId} className="space-y-1">
                            <div className="flex justify-between text-[10px] font-bold">
                               <span className="text-slate-700">{report.userName}</span>
                               <span className="text-slate-400">¥{report.totalSalary.toLocaleString()}</span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                               <div 
                                 className={cn(
                                   "h-full rounded-full",
                                   ["bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-indigo-500", "bg-rose-500"][idx % 5]
                                 )} 
                                 style={{ width: `${(report.totalSalary / filteredSalaryReports.reduce((acc, r) => acc + r.totalSalary, 0)) * 100}%` }}
                               />
                            </div>
                         </div>
                       ))}
                       <div className="pt-4 border-t border-slate-100 mt-4">
                          <div className="flex justify-between items-center">
                             <span className="text-xs font-bold text-slate-400">{t('att.totalLaborCost')}</span>
                             <span className="text-lg font-black text-slate-900">¥{filteredSalaryReports.reduce((acc, r) => acc + r.totalSalary, 0).toLocaleString()}</span>
                          </div>
                       </div>
                    </div>
                  </Card>

                  <Card className="border border-slate-100 shadow-sm overflow-hidden h-full">
                    <CardHeader className="bg-slate-900 border-none pb-8">
                      <CardTitle className="text-sm text-white flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-blue-400" /> {t('att.branchEfficiency')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 -mt-4">
                      <div className="bg-white rounded-t-3xl p-6 space-y-6">
                        <div className="space-y-2">
                          <div className="flex justify-between items-end">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('att.avgWorkPerPerson')}</span>
                            <span className="text-lg font-black text-slate-800">156.4 <span className="text-xs font-medium text-slate-400">h</span></span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-600 w-[78%]" />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-end">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">残業発生率</span>
                            <span className="text-lg font-black text-slate-800">4.2 <span className="text-xs font-medium text-slate-400">%</span></span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 w-[15%]" />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-end">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">出勤充足率</span>
                            <span className="text-lg font-black text-slate-800">98.5 <span className="text-xs font-medium text-slate-400">%</span></span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 w-[98.5%]" />
                          </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100">
                          <Button className="w-full bg-slate-900 hover:bg-black font-bold text-xs h-11" variant="default">
                            詳細レポートを表示
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      {/* 休日追加ダイアログ */}
      <Dialog
        open={holidayDialog.open}
        onOpenChange={(open) => setHolidayDialog((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarOff className="w-4 h-4 text-rose-600" />
              休日を追加
            </DialogTitle>
            <DialogDescription className="text-xs">
              {holidayDialog.date
                ? `${format(holidayDialog.date, 'yyyy年M月d日 (E)', { locale: ja })} の休日設定`
                : ''}
              <br />
              選択した従業員のシフトを取り消し、本人のスケジュールに反映します。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-[11px] font-bold mb-1 block">対象従業員</label>
              <select
                value={holidayUserId}
                onChange={(e) => setHolidayUserId(e.target.value)}
                className="w-full h-9 text-xs border border-slate-200 rounded-md px-2 bg-white"
              >
                <option value="">選択してください</option>
                {filteredUsers.map((u) => {
                  const dStr = holidayDialog.date ? format(holidayDialog.date, 'yyyy-MM-dd') : '';
                  const already = dStr ? isHolidayForUser(u.id, dStr) : false;
                  return (
                    <option key={u.id} value={u.id} disabled={already}>
                      {u.name} {already ? '（既に休日設定済）' : ''}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold mb-1 block">理由・メモ（任意）</label>
              <Input
                value={holidayNote}
                onChange={(e) => setHolidayNote(e.target.value)}
                placeholder="例：定休日 / 有給 / 振替休日"
                className="h-9 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setHolidayDialog({ open: false, date: null })}
              className="h-9 text-xs"
            >
              キャンセル
            </Button>
            <Button
              onClick={handleAddHoliday}
              disabled={!holidayUserId}
              className="h-9 text-xs bg-rose-600 hover:bg-rose-700 text-white gap-1"
            >
              <CalendarOff className="w-3.5 h-3.5" /> 休日として登録
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ----------------------------------------------------------------------
 * 申告レビュー・パネル：従業員から提出されたシフト自己申告／休業申告を
 * 一覧表示し、承認／却下できる。pending を上に並べる。
 * --------------------------------------------------------------------*/
function ShiftRequestReviewPanel({ selectedBase }: { selectedBase?: string }) {
  const allRequests = useShiftRequests();
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  const filtered = useMemo(() => {
    return allRequests
      .filter((r) => {
        if (selectedBase) {
          const base = MOCK_USERS.find((u) => u.id === r.userId)?.base;
          if (base !== selectedBase) return false;
        }
        if (statusFilter !== 'all' && r.status !== statusFilter) return false;
        return true;
      })
      .sort((a, b) => {
        // pending を先に、その後新着順
        const sa = a.status === 'pending' ? 0 : 1;
        const sb = b.status === 'pending' ? 0 : 1;
        if (sa !== sb) return sa - sb;
        return (b.submittedAt || '').localeCompare(a.submittedAt || '');
      });
  }, [allRequests, selectedBase, statusFilter]);

  const counts = useMemo(() => {
    const base = (r: ShiftRequest) => {
      if (!selectedBase) return true;
      return MOCK_USERS.find((u) => u.id === r.userId)?.base === selectedBase;
    };
    const list = allRequests.filter(base);
    return {
      pending: list.filter((r) => r.status === 'pending').length,
      approved: list.filter((r) => r.status === 'approved').length,
      rejected: list.filter((r) => r.status === 'rejected').length,
    };
  }, [allRequests, selectedBase]);

  const handleApprove = (r: ShiftRequest) => {
    approveRequest(r.id, '管理者');
    const label =
      r.type === 'shift' ? 'シフト' : r.type === 'paid_leave' ? '有給申請' : '休日申請';
    toast.success(`${r.userName} の ${r.date} ${label} を承認しました`);
  };
  const handleReject = (r: ShiftRequest) => {
    rejectRequest(r.id, '管理者');
    toast.message(`${r.userName} の申告を却下しました`);
  };

  return (
    <Card className="border-[#e2e8f0] shadow-none">
      <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <CardTitle className="text-sm font-bold text-[#1e293b] flex items-center gap-2">
            <Inbox className="w-4 h-4 text-blue-600" />
            休日・有給 申告レビュー
          </CardTitle>
          <CardDescription className="text-xs">
            従業員からの休日申請・有給申請を承認・却下します。承認するとその日の出勤予定が休日として上書きされ、スケジュールに反映されます。
          </CardDescription>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(['pending', 'approved', 'rejected', 'all'] as const).map((s) => {
            const label =
              s === 'pending'
                ? `承認待ち (${counts.pending})`
                : s === 'approved'
                ? `承認済 (${counts.approved})`
                : s === 'rejected'
                ? `却下 (${counts.rejected})`
                : 'すべて';
            return (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? 'default' : 'outline'}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'h-8 text-[11px] font-bold rounded-full px-3',
                  statusFilter === s
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50',
                )}
              >
                {label}
              </Button>
            );
          })}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {filtered.length === 0 ? (
          <div className="px-6 py-10 text-center text-xs text-slate-400">
            該当する申告はありません。
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                <TableHead className="w-[160px]">従業員</TableHead>
                <TableHead className="w-[120px]">対象日</TableHead>
                <TableHead className="w-[110px]">種別</TableHead>
                <TableHead className="w-[160px]">時間</TableHead>
                <TableHead>備考</TableHead>
                <TableHead className="w-[110px] text-center">状態</TableHead>
                <TableHead className="w-[160px] text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id} className="align-top">
                  <TableCell className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs">
                        {r.userName?.[0] || '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-[#1e293b] truncate">
                          {r.userName}
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium truncate">
                          {MOCK_USERS.find((u) => u.id === r.userId)?.base ?? ''}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-xs font-mono">{r.date}</TableCell>
                  <TableCell className="py-3">
                    <Badge
                      className={cn(
                        'text-[10px] font-bold border',
                        r.type === 'paid_leave'
                          ? 'bg-amber-50 text-amber-700 border-amber-100'
                          : r.type === 'leave'
                            ? 'bg-rose-50 text-rose-700 border-rose-100'
                            : 'bg-blue-50 text-blue-700 border-blue-100',
                      )}
                    >
                      {r.type === 'paid_leave' ? '有給申請' : r.type === 'leave' ? '休日申請' : 'シフト申告'}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3 text-xs font-mono text-slate-600">
                    {r.type === 'shift' && r.startTime && r.endTime
                      ? `${r.startTime} 〜 ${r.endTime}`
                      : '-'}
                  </TableCell>
                  <TableCell className="py-3 text-xs text-slate-600 truncate max-w-[260px]">
                    {r.note || <span className="text-slate-300">（なし）</span>}
                  </TableCell>
                  <TableCell className="py-3 text-center">
                    <Badge
                      className={cn(
                        'text-[10px] font-bold border',
                        r.status === 'pending'
                          ? 'bg-amber-50 text-amber-700 border-amber-100'
                          : r.status === 'approved'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          : 'bg-slate-50 text-slate-500 border-slate-100',
                      )}
                    >
                      {r.status === 'pending'
                        ? '承認待ち'
                        : r.status === 'approved'
                        ? '承認済'
                        : '却下'}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3 text-right">
                    {r.status === 'pending' ? (
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject(r)}
                          className="h-8 px-3 text-xs gap-1 border-slate-200 text-slate-600"
                        >
                          <XIcon className="w-3.5 h-3.5" /> 却下
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApprove(r)}
                          className="h-8 px-3 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <Check className="w-3.5 h-3.5" /> 承認
                        </Button>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-mono">
                        {r.reviewedAt ? format(new Date(r.reviewedAt), 'M/d HH:mm') : ''}
                        {r.reviewedBy ? ` / ${r.reviewedBy}` : ''}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/* ----------------------------------------------------------------------
 * シフト編成カレンダー
 * 月単位カレンダーに従業員をドラッグ＆ドロップで割当てる。
 *   - 通常の出勤時間は就業時間マスタから初期値を採用
 *   - 休日（マスタ off / 承認済休業）にドロップすると「休日出勤」として上書き登録
 *   - セル内のシフトをクリックすると削除（休日設定はそのまま残る場合は再度休日として表示される）
 * --------------------------------------------------------------------*/
function ShiftEditorCalendar({
  selectedBase,
  anchorDate,
}: {
  selectedBase?: string;
  anchorDate: Date;
}) {
  // ストアの変更を購読
  useShifts();
  useShiftRequests();
  useWorkingHours();

  const [monthAnchor, setMonthAnchor] = useState<Date>(anchorDate);
  React.useEffect(() => setMonthAnchor(anchorDate), [anchorDate]);

  const monthDays = useMemo(() => {
    const start = startOfMonth(monthAnchor);
    const end = endOfMonth(monthAnchor);
    return eachDayOfInterval({ start, end });
  }, [monthAnchor]);

  const employees = useMemo(
    () =>
      MOCK_USERS.filter(
        (u) => u.role !== 'admin' && (!selectedBase || u.base === selectedBase),
      ),
    [selectedBase],
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [activeUserId, setActiveUserId] = useState<string | null>(null);

  const onDragEnd = (event: DragEndEvent) => {
    setActiveUserId(null);
    const { active, over } = event;
    if (!over) return;
    const userId = String(active.id).replace(/^emp-/, '');
    const dateStr = String(over.id).replace(/^cell-/, '');
    const user = employees.find((u) => u.id === userId);
    if (!user) return;

    const dayObj = new Date(dateStr);
    const wh = getHoursForDate(userId, dayObj);
    const eff = getEffectiveHours(userId, dateStr);
    // すでに同日にシフトがあれば差し替え
    setShiftForUser({
      userId,
      userName: user.name,
      date: dateStr,
      startTime: wh.start,
      endTime: wh.end,
      shiftType: 'regular',
    });

    if (eff.isHoliday) {
      toast.success(`${user.name} を ${dateStr} の休日出勤として登録しました`, {
        description: `${wh.start}〜${wh.end}（休日設定を上書き）`,
      });
    } else {
      toast.success(`${user.name} を ${dateStr} のシフトに追加しました`, {
        description: `${wh.start}〜${wh.end}`,
      });
    }
  };

  const handleClearShift = (userId: string, date: string, userName: string) => {
    const ok = clearShiftForUser(userId, date);
    if (ok) toast.success(`${userName} の ${date} のシフトを削除しました`);
  };

  const activeUser = activeUserId ? employees.find((u) => u.id === activeUserId) : null;

  return (
    <Card className="border-[#e2e8f0] shadow-none">
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-sm font-bold text-[#1e293b] flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-blue-600" />
              シフト編成カレンダー
            </CardTitle>
            <CardDescription className="text-[11px]">
              左の従業員カードを日付セルにドラッグ＆ドロップしてシフトを編成。休日にドロップすると休日出勤として上書きされます。
            </CardDescription>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMonthAnchor(subMonths(monthAnchor, 1))}
              className="h-8"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <span className="text-xs font-bold px-2">
              {format(monthAnchor, 'yyyy年 M月', { locale: ja })}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMonthAnchor(addMonths(monthAnchor, 1))}
              className="h-8"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <DndContext
          sensors={sensors}
          onDragStart={(e) => setActiveUserId(String(e.active.id).replace(/^emp-/, ''))}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveUserId(null)}
        >
          <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-4">
            {/* 左: 従業員プール */}
            <div className="border border-slate-100 rounded-xl bg-slate-50/50 p-3 space-y-2 max-h-[600px] overflow-y-auto">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-1 mb-1">
                従業員プール
              </p>
              {employees.length === 0 ? (
                <div className="py-6 text-center text-[10px] text-slate-400">
                  該当拠点に従業員がいません
                </div>
              ) : (
                employees.map((u) => <DraggableEmployee key={u.id} user={u} />)
              )}
            </div>

            {/* 右: 月次カレンダー */}
            <div>
              <div className="grid grid-cols-7 border-t border-l border-slate-100">
                {['日', '月', '火', '水', '木', '金', '土'].map((d) => (
                  <div
                    key={d}
                    className="bg-slate-50 py-2 border-r border-b border-slate-100 text-[10px] font-bold text-slate-500 text-center uppercase tracking-widest"
                  >
                    {d}
                  </div>
                ))}
                {Array.from({ length: getDay(monthDays[0]) }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="min-h-[110px] bg-slate-50/20 border-r border-b border-slate-100"
                  />
                ))}
                {monthDays.map((day) => {
                  const dayStr = format(day, 'yyyy-MM-dd');
                  return (
                    <DroppableDayCell
                      key={dayStr}
                      day={day}
                      dayStr={dayStr}
                      employees={employees}
                      onClearShift={handleClearShift}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          <DragOverlay>
            {activeUser ? (
              <div className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg shadow-lg ring-2 ring-white text-xs font-bold">
                <GripVertical className="w-3.5 h-3.5 opacity-70" />
                {activeUser.name}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </CardContent>
    </Card>
  );
}

function DraggableEmployee({ user }: { user: typeof MOCK_USERS[number] }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `emp-${user.id}`,
    data: user,
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        'flex items-center gap-2 px-2 py-2 rounded-lg bg-white border border-slate-200 shadow-sm cursor-grab active:cursor-grabbing select-none',
        isDragging && 'opacity-30 ring-2 ring-blue-400',
      )}
    >
      <GripVertical className="w-3.5 h-3.5 text-slate-300 shrink-0" />
      <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 shrink-0">
        {user.name?.[0] ?? '?'}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold text-slate-800 truncate">{user.name}</p>
        <p className="text-[9px] text-slate-400 truncate">
          {user.role === 'collector' ? '回収員' : '作業員'}
          {user.base ? ` ・ ${user.base}` : ''}
        </p>
      </div>
    </div>
  );
}

function DroppableDayCell({
  day,
  dayStr,
  employees,
  onClearShift,
}: {
  day: Date;
  dayStr: string;
  employees: typeof MOCK_USERS;
  onClearShift: (userId: string, date: string, userName: string) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `cell-${dayStr}` });
  const isToday = isSameDay(day, new Date());
  const jpHoliday = getJapaneseHolidayName(dayStr);

  // 各従業員の当日 effective 状態を解決
  const entries = employees
    .map((u) => {
      const eff = getEffectiveHours(u.id, dayStr);
      return { user: u, eff };
    })
    .filter((e) => e.eff.source === 'shift' || (!e.eff.isHoliday && e.eff.source === 'master'));

  // 休日（休業申告 / 国民の祝日）
  const holidays = employees
    .map((u) => ({ user: u, eff: getEffectiveHours(u.id, dayStr) }))
    .filter((e) => e.eff.source === 'leave' || e.eff.source === 'holiday');

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-h-[110px] p-1.5 border-r border-b border-slate-100 transition-colors relative',
        isToday && 'bg-blue-50/30 ring-1 ring-inset ring-blue-100',
        jpHoliday && !isToday && 'bg-rose-50/40',
        isOver && 'bg-emerald-50 ring-2 ring-inset ring-emerald-300',
      )}
    >
      <div className="flex justify-between items-center mb-1">
        <span
          className={cn(
            'w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold',
            isToday
              ? 'bg-blue-600 text-white'
              : isWeekend(day)
                ? 'text-rose-500'
                : 'text-slate-500',
          )}
        >
          {day.getDate()}
        </span>
        {entries.length > 0 && (
          <Badge className="bg-blue-100 text-blue-700 border-none text-[9px] font-bold h-4 px-1.5">
            {entries.length}
          </Badge>
        )}
      </div>
      {jpHoliday && (
        <div className="text-[9px] text-rose-600 font-bold mb-1 truncate flex items-center gap-1">
          <CalendarOff className="w-2.5 h-2.5 shrink-0" />
          {jpHoliday}
        </div>
      )}
      <div className="space-y-1">
        {entries.map((e) => (
          <ShiftEntryChip
            key={`${e.user.id}-${dayStr}`}
            user={e.user}
            start={e.eff.start}
            end={e.eff.end}
            source={e.eff.source}
            dayStr={dayStr}
            onRemove={() => onClearShift(e.user.id, dayStr, e.user.name)}
          />
        ))}
        {holidays.map((e) => (
          <div
            key={`hol-${e.user.id}-${dayStr}`}
            className="text-[9px] px-1 py-0.5 border rounded bg-rose-50 border-rose-100 text-rose-700 flex items-center gap-1"
            title={
              e.eff.source === 'holiday'
                ? `祝日: ${e.eff.holidayName ?? ''}`
                : '休日承認済（管理者設定 or 休業申告）'
            }
          >
            <CalendarOff className="w-2.5 h-2.5 shrink-0" />
            <span className="font-bold truncate">{e.user.name}</span>
            <span className="ml-auto text-[8px] font-bold opacity-70">
              {e.eff.source === 'holiday' ? '祝' : '休'}
            </span>
          </div>
        ))}
        {entries.length === 0 && holidays.length === 0 && (
          <p className="text-[9px] text-slate-300 italic px-1">ドロップで割当</p>
        )}
      </div>
    </div>
  );
}

function ShiftEntryChip({
  user,
  start,
  end,
  source,
  dayStr,
  onRemove,
}: {
  user: typeof MOCK_USERS[number];
  start: string;
  end: string;
  source: 'shift' | 'master' | 'leave';
  dayStr: string;
  onRemove: () => void;
}) {
  // master 由来（マスタの自動シフト）は削除不可、shift 由来（管理者付与）のみ × 表示
  const removable = source === 'shift';
  return (
    <div
      className={cn(
        'group relative text-[9px] p-1 border rounded shadow-sm flex flex-col gap-0.5 leading-tight',
        source === 'shift'
          ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
          : 'bg-blue-50 border-blue-100 text-blue-700',
      )}
      title={`${user.name} ${start}-${end}${removable ? ' / クリックで削除' : ' / 就業時間マスタ由来'}`}
    >
      <div className="flex items-center gap-1">
        <span className="font-bold truncate flex-1">{user.name}</span>
        {removable && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-emerald-700/70 hover:text-rose-600"
            title="シフトを削除"
          >
            <XClose className="w-2.5 h-2.5" />
          </button>
        )}
      </div>
      <span className="opacity-70 flex items-center gap-0.5 font-mono">
        <Clock className="w-2 h-2" /> {start}-{end}
      </span>
    </div>
  );
}
