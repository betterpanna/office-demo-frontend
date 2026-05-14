/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 就業時間マスタ画面（管理者用）。
 * 各従業員の平日／土／日の出勤開始・終了時刻を編集できる。
 * 土日は「通常出勤」として扱うかどうかをスイッチで切替可能。
 * ※ 休日扱い（OFF）であっても TaskAssignment 上ではドラッグ＆ドロップで
 *    作業を割り当てられる（休日出勤対応）。
 */

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MOCK_USERS } from '@/src/mockData';
import {
  useWorkingHours,
  upsertWorkingHours,
  getWorkingHoursFor,
  WorkingHours,
} from '@/src/stores/workingHoursStore';
import { Save, Clock, CalendarDays, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useT } from '@/src/stores/i18nStore';

interface WorkingHoursMasterProps {
  selectedBase?: string;
}

export function WorkingHoursMaster({ selectedBase }: WorkingHoursMasterProps) {
  const t = useT();
  const allHours = useWorkingHours();

  const workers = useMemo(
    () =>
      MOCK_USERS.filter(
        (u) => u.role !== 'admin' && (!selectedBase || u.base === selectedBase),
      ),
    [selectedBase],
  );

  // 編集用ローカルバッファ（ワーカー id → 編集中の WorkingHours）
  const [drafts, setDrafts] = useState<Record<string, WorkingHours>>({});

  const getDraft = (workerId: string): WorkingHours => {
    return drafts[workerId] ?? getWorkingHoursFor(workerId);
  };

  const setDraft = (workerId: string, patch: Partial<WorkingHours>) => {
    setDrafts((prev) => ({
      ...prev,
      [workerId]: { ...getDraft(workerId), ...patch, workerId },
    }));
  };

  const isDirty = (workerId: string) => {
    const d = drafts[workerId];
    if (!d) return false;
    const cur = getWorkingHoursFor(workerId);
    return JSON.stringify(d) !== JSON.stringify(cur);
  };

  const saveOne = (workerId: string) => {
    const d = drafts[workerId];
    if (!d) return;
    if (d.weekdayEnd <= d.weekdayStart) {
      toast.error('平日の終了時刻は開始時刻より後にしてください');
      return;
    }
    upsertWorkingHours(d);
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[workerId];
      return next;
    });
    const name = MOCK_USERS.find((u) => u.id === workerId)?.name || workerId;
    toast.success(`${name} の就業時間を保存しました`);
  };

  const resetOne = (workerId: string) => {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[workerId];
      return next;
    });
  };

  const saveAll = () => {
    const ids = Object.keys(drafts);
    let ok = 0;
    ids.forEach((id) => {
      const d = drafts[id];
      if (d.weekdayEnd > d.weekdayStart) {
        upsertWorkingHours(d);
        ok++;
      }
    });
    if (ok > 0) {
      setDrafts({});
      toast.success(`${ok} 件の就業時間設定を保存しました`);
    } else {
      toast.error('保存する変更がありません');
    }
  };

  const dirtyCount = Object.keys(drafts).filter((id) => isDirty(id)).length;

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-black text-[#1e293b] flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            {t('whm.title')}
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            {t('whm.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirtyCount > 0 && (
            <Badge className="bg-amber-100 text-amber-700 border-amber-200">
              {dirtyCount} {t('admin.cases')}
            </Badge>
          )}
          <Button
            onClick={saveAll}
            disabled={dirtyCount === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2"
          >
            <Save className="w-4 h-4" />
            {t('admin.save')}
          </Button>
        </div>
      </div>

      <Card className="border-[#e2e8f0] shadow-none">
        <CardHeader>
          <CardTitle className="text-sm font-bold text-[#1e293b] flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-slate-500" />
            稼働時間 / 休日設定
          </CardTitle>
          <CardDescription className="text-xs">
            休日扱い（OFF）の曜日でも、作業スケジュール画面ではドラッグ＆ドロップで割当可能です（休日出勤対応）。
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                <TableHead className="w-[200px]">{t('whm.empName')}</TableHead>
                <TableHead className="w-[200px]">平日（月～金）</TableHead>
                <TableHead className="w-[260px]">土曜</TableHead>
                <TableHead className="w-[260px]">日曜</TableHead>
                <TableHead className="w-[140px] text-right">{t('whm.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workers.map((worker) => {
                const d = getDraft(worker.id);
                const dirty = isDirty(worker.id);
                return (
                  <TableRow key={worker.id} className={cn(dirty && 'bg-amber-50/40')}>
                    <TableCell className="align-top py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs">
                          {worker.name?.[0] || '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-[#1e293b] truncate">
                            {worker.name}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium">
                            {worker.role === 'collector' ? t('role.collector') : t('role.worker')} / {worker.base}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    {/* 平日 */}
                    <TableCell className="align-top py-4">
                      <div className="flex items-center gap-2">
                        <Input
                          type="time"
                          value={d.weekdayStart}
                          onChange={(e) =>
                            setDraft(worker.id, { weekdayStart: e.target.value })
                          }
                          className="h-8 text-xs"
                        />
                        <span className="text-slate-400 text-xs">〜</span>
                        <Input
                          type="time"
                          value={d.weekdayEnd}
                          onChange={(e) =>
                            setDraft(worker.id, { weekdayEnd: e.target.value })
                          }
                          className="h-8 text-xs"
                        />
                      </div>
                    </TableCell>

                    {/* 土曜 */}
                    <TableCell className="align-top py-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Button
                          type="button"
                          size="sm"
                          variant={d.saturdayEnabled ? 'default' : 'outline'}
                          onClick={() =>
                            setDraft(worker.id, { saturdayEnabled: !d.saturdayEnabled })
                          }
                          className={cn(
                            'h-7 px-3 text-[11px] font-bold rounded-full',
                            d.saturdayEnabled
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200',
                          )}
                        >
                          {d.saturdayEnabled ? t('att.present') : t('schedule.holiday')}
                        </Button>
                      </div>
                      <div
                        className={cn(
                          'flex items-center gap-2',
                          !d.saturdayEnabled && 'opacity-50',
                        )}
                      >
                        <Input
                          type="time"
                          value={d.saturdayStart}
                          onChange={(e) =>
                            setDraft(worker.id, { saturdayStart: e.target.value })
                          }
                          disabled={!d.saturdayEnabled}
                          className="h-8 text-xs"
                        />
                        <span className="text-slate-400 text-xs">〜</span>
                        <Input
                          type="time"
                          value={d.saturdayEnd}
                          onChange={(e) =>
                            setDraft(worker.id, { saturdayEnd: e.target.value })
                          }
                          disabled={!d.saturdayEnabled}
                          className="h-8 text-xs"
                        />
                      </div>
                    </TableCell>

                    {/* 日曜 */}
                    <TableCell className="align-top py-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Button
                          type="button"
                          size="sm"
                          variant={d.sundayEnabled ? 'default' : 'outline'}
                          onClick={() =>
                            setDraft(worker.id, { sundayEnabled: !d.sundayEnabled })
                          }
                          className={cn(
                            'h-7 px-3 text-[11px] font-bold rounded-full',
                            d.sundayEnabled
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200',
                          )}
                        >
                          {d.sundayEnabled ? t('att.present') : t('schedule.holiday')}
                        </Button>
                      </div>
                      <div
                        className={cn(
                          'flex items-center gap-2',
                          !d.sundayEnabled && 'opacity-50',
                        )}
                      >
                        <Input
                          type="time"
                          value={d.sundayStart}
                          onChange={(e) =>
                            setDraft(worker.id, { sundayStart: e.target.value })
                          }
                          disabled={!d.sundayEnabled}
                          className="h-8 text-xs"
                        />
                        <span className="text-slate-400 text-xs">〜</span>
                        <Input
                          type="time"
                          value={d.sundayEnd}
                          onChange={(e) =>
                            setDraft(worker.id, { sundayEnd: e.target.value })
                          }
                          disabled={!d.sundayEnabled}
                          className="h-8 text-xs"
                        />
                      </div>
                    </TableCell>

                    <TableCell className="align-top py-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => resetOne(worker.id)}
                          disabled={!dirty}
                          className="h-8 px-2 text-xs"
                          title={t('admin.cancel')}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => saveOne(worker.id)}
                          disabled={!dirty}
                          className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1"
                        >
                          <Save className="w-3.5 h-3.5" />
                          {t('admin.save')}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default WorkingHoursMaster;
