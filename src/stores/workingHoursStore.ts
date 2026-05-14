/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 就業時間マスタ。各従業員ごとに平日・土曜・日曜の稼働時間と
 * 休日（土曜/日曜）を通常出勤として扱うかを保持する。
 * TaskAssignment（管理者）でガントの稼働バンド表示や月ビュー、
 * 休日でも作業割当可能とする機能の判定に利用する。
 */

import { useSyncExternalStore } from 'react';
import { MOCK_USERS } from '@/src/mockData';

export interface WorkingHours {
  /** User.id と同じ */
  workerId: string;
  /** 平日の開始時刻 "HH:mm" */
  weekdayStart: string;
  /** 平日の終了時刻 "HH:mm" */
  weekdayEnd: string;
  /** 土曜を通常出勤として扱うか（false なら休日扱い） */
  saturdayEnabled: boolean;
  saturdayStart: string;
  saturdayEnd: string;
  /** 日曜を通常出勤として扱うか（false なら休日扱い） */
  sundayEnabled: boolean;
  sundayStart: string;
  sundayEnd: string;
}

const DEFAULT_WEEKDAY: { start: string; end: string } = {
  start: '09:00',
  end: '18:00',
};

const DEFAULT_WEEKEND: { start: string; end: string } = {
  start: '10:00',
  end: '17:00',
};

/** 既定値（管理者・作業員・回収員すべて 平日09:00-18:00、土日休み） */
function makeDefault(workerId: string): WorkingHours {
  return {
    workerId,
    weekdayStart: DEFAULT_WEEKDAY.start,
    weekdayEnd: DEFAULT_WEEKDAY.end,
    saturdayEnabled: false,
    saturdayStart: DEFAULT_WEEKEND.start,
    saturdayEnd: DEFAULT_WEEKEND.end,
    sundayEnabled: false,
    sundayStart: DEFAULT_WEEKEND.start,
    sundayEnd: DEFAULT_WEEKEND.end,
  };
}

let workingHours: WorkingHours[] = MOCK_USERS.map((u) => makeDefault(u.id));

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const getSnapshot = () => workingHours;

export function useWorkingHours(): WorkingHours[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function getWorkingHours(): WorkingHours[] {
  return workingHours;
}

/** 指定ワーカーの設定を取得（無ければ既定値を返す） */
export function getWorkingHoursFor(workerId: string): WorkingHours {
  return workingHours.find((w) => w.workerId === workerId) ?? makeDefault(workerId);
}

/** 設定を upsert する */
export function upsertWorkingHours(next: WorkingHours) {
  const idx = workingHours.findIndex((w) => w.workerId === next.workerId);
  if (idx === -1) workingHours = [...workingHours, next];
  else workingHours = workingHours.map((w, i) => (i === idx ? next : w));
  emit();
}

/** 設定を部分更新する */
export function updateWorkingHours(workerId: string, patch: Partial<WorkingHours>) {
  const current = getWorkingHoursFor(workerId);
  upsertWorkingHours({ ...current, ...patch, workerId });
}

/** Date オブジェクトに対する曜日種別を返す */
function dayKindOf(date: Date): 'weekday' | 'saturday' | 'sunday' {
  const d = date.getDay();
  if (d === 0) return 'sunday';
  if (d === 6) return 'saturday';
  return 'weekday';
}

/** 指定ワーカー × 指定日（Date）に対する稼働時間帯を返す。
 *  休日扱いの場合 isHoliday: true、ただし開始/終了時刻は土日設定をフォールバックとして返す。*/
export function getHoursForDate(
  workerId: string,
  date: Date,
): { start: string; end: string; isHoliday: boolean } {
  const wh = getWorkingHoursFor(workerId);
  const kind = dayKindOf(date);
  if (kind === 'weekday') {
    return { start: wh.weekdayStart, end: wh.weekdayEnd, isHoliday: false };
  }
  if (kind === 'saturday') {
    return {
      start: wh.saturdayStart,
      end: wh.saturdayEnd,
      isHoliday: !wh.saturdayEnabled,
    };
  }
  return {
    start: wh.sundayStart,
    end: wh.sundayEnd,
    isHoliday: !wh.sundayEnabled,
  };
}

/** "HH:mm" → 整数 hour (8.5 形式ではなく端数切捨て & 切上げ用に分単位を別途使う) */
export function hourFloor(hhmm: string): number {
  const [h] = hhmm.split(':');
  return Number(h) || 0;
}

export function hourCeil(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((v) => Number(v) || 0);
  return m > 0 ? h + 1 : h;
}

/** 全ワーカーの平日／土日設定から、ガント表示用の hour レンジ [startHour, endHourExclusive] を導出 */
export function getDayGridRange(workers: { id: string }[]): {
  startHour: number;
  endHourExclusive: number;
} {
  if (workers.length === 0) return { startHour: 8, endHourExclusive: 19 };
  let minStart = 24;
  let maxEnd = 0;
  workers.forEach((w) => {
    const wh = getWorkingHoursFor(w.id);
    minStart = Math.min(minStart, hourFloor(wh.weekdayStart));
    maxEnd = Math.max(maxEnd, hourCeil(wh.weekdayEnd));
    if (wh.saturdayEnabled) {
      minStart = Math.min(minStart, hourFloor(wh.saturdayStart));
      maxEnd = Math.max(maxEnd, hourCeil(wh.saturdayEnd));
    }
    if (wh.sundayEnabled) {
      minStart = Math.min(minStart, hourFloor(wh.sundayStart));
      maxEnd = Math.max(maxEnd, hourCeil(wh.sundayEnd));
    }
  });
  // 最低でも 1 時間幅は確保
  if (maxEnd <= minStart) {
    return { startHour: minStart, endHourExclusive: minStart + 1 };
  }
  return { startHour: minStart, endHourExclusive: maxEnd };
}
