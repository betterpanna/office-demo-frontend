/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * シフト・休業申告ストア。
 * 従業員側で「シフト自己申告」「休業申告」を作成し、管理者側で承認／却下する。
 * 既存の Shift（types.ts）を承認済シフトの素材として利用しつつ、
 * 申告管理用の ShiftRequest を内部型として保持する。
 *
 * 既定の就業時間（workingHoursStore）と連動：
 *   - 従業員が日付を選ぶと、その曜日の標準勤務時間が初期値として提示される。
 *   - 申告内容で上書き可能。
 *   - 承認された申告は同日のデフォルト稼働を上書きする扱いにする。
 */

import { useSyncExternalStore } from 'react';
import { Shift } from '@/src/types';
import { MOCK_SHIFTS, MOCK_USERS } from '@/src/mockData';
import { getHoursForDate } from '@/src/stores/workingHoursStore';
import { getJapaneseHolidayName } from '@/src/constants/holidaysJP';

/**
 * 申告種別:
 *   - 'shift'      : シフト自己申告（管理者承認後にシフト登録）※現状 UI 削除済
 *   - 'leave'      : 休日申請（無給/通常の休み希望）
 *   - 'paid_leave' : 有給申請（年次有給休暇）
 *  leave / paid_leave はいずれも承認時に当該日を「休日」として扱う。
 */
export type ShiftRequestType = 'shift' | 'leave' | 'paid_leave';
export type ShiftRequestStatus = 'pending' | 'approved' | 'rejected';

export interface ShiftRequest {
  id: string;
  userId: string;
  userName: string;
  /** YYYY-MM-DD */
  date: string;
  type: ShiftRequestType;
  /** type='shift' のみ */
  startTime?: string;
  /** type='shift' のみ */
  endTime?: string;
  /** 任意の備考（type='leave' は休業理由として使う） */
  note?: string;
  /** ISO（申告日時） */
  submittedAt: string;
  status: ShiftRequestStatus;
  /** 承認/却下時のレビュー記録 */
  reviewedAt?: string;
  reviewedBy?: string;
}

// 承認済シフト（マスタ + 従業員申告承認分）
let shifts: Shift[] = [...MOCK_SHIFTS];
// 申告（pending/approved/rejected を全て保持）
let requests: ShiftRequest[] = [];

const shiftListeners = new Set<() => void>();
const reqListeners = new Set<() => void>();

const emitShifts = () => shiftListeners.forEach((l) => l());
const emitRequests = () => reqListeners.forEach((l) => l());

const subShifts = (l: () => void) => {
  shiftListeners.add(l);
  return () => {
    shiftListeners.delete(l);
  };
};
const subReqs = (l: () => void) => {
  reqListeners.add(l);
  return () => {
    reqListeners.delete(l);
  };
};
const getShifts = () => shifts;
const getReqs = () => requests;

export function useShifts(): Shift[] {
  return useSyncExternalStore(subShifts, getShifts, getShifts);
}

export function useShiftRequests(): ShiftRequest[] {
  return useSyncExternalStore(subReqs, getReqs, getReqs);
}

export function getApprovedShifts(): Shift[] {
  return shifts;
}

/** 指定ユーザーの申告一覧を返す（新しい順） */
export function getRequestsByUser(userId: string): ShiftRequest[] {
  return requests
    .filter((r) => r.userId === userId)
    .slice()
    .sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
}

/** 指定日のユーザーシフトを返す（承認済のみ） */
export function getShiftFor(userId: string, date: string): Shift | undefined {
  return shifts.find((s) => s.userId === userId && s.date === date);
}

/** 指定日 × ユーザーの「実効稼働時間」を返す。
 *  優先順位:
 *    1. 承認済シフト（休日出勤含む / 祝日に shift があれば出勤扱い）
 *    2. 承認済休業申告（=休み）
 *    3. 国民の祝日 / 振替休日（=休み, holidayName 付き）
 *    4. 就業時間マスタ（曜日設定）
 */
export function getEffectiveHours(
  userId: string,
  date: string,
): {
  start: string;
  end: string;
  isHoliday: boolean;
  source: 'shift' | 'leave' | 'holiday' | 'master';
  holidayName?: string;
} {
  // 1. 明示的シフト（休日出勤・祝日出勤のオーバーライド含む）
  const sh = getShiftFor(userId, date);
  if (sh) {
    return { start: sh.startTime, end: sh.endTime, isHoliday: false, source: 'shift' };
  }

  // 2. 承認済休日 / 有給
  const approvedLeave = requests.find(
    (r) =>
      r.userId === userId &&
      r.date === date &&
      (r.type === 'leave' || r.type === 'paid_leave') &&
      r.status === 'approved',
  );
  if (approvedLeave) {
    const fb = getHoursForDate(userId, parseDate(date));
    return { start: fb.start, end: fb.end, isHoliday: true, source: 'leave' };
  }

  // 3. 国民の祝日（振替休日含む）
  const holidayName = getJapaneseHolidayName(date);
  if (holidayName) {
    const fb = getHoursForDate(userId, parseDate(date));
    return {
      start: fb.start,
      end: fb.end,
      isHoliday: true,
      source: 'holiday',
      holidayName,
    };
  }

  // 4. 就業時間マスタ（土日 off など）
  const fb = getHoursForDate(userId, parseDate(date));
  return { start: fb.start, end: fb.end, isHoliday: fb.isHoliday, source: 'master' };
}

function parseDate(yyyyMmDd: string): Date {
  const [y, m, d] = yyyyMmDd.split('-').map((v) => Number(v) || 0);
  return new Date(y, (m || 1) - 1, d || 1);
}

function newId(prefix = 'req') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** シフト自己申告を作成 */
export function submitShiftRequest(args: {
  userId: string;
  userName: string;
  date: string;
  startTime: string;
  endTime: string;
  note?: string;
}): ShiftRequest {
  const r: ShiftRequest = {
    id: newId('shr'),
    userId: args.userId,
    userName: args.userName,
    date: args.date,
    type: 'shift',
    startTime: args.startTime,
    endTime: args.endTime,
    note: args.note,
    submittedAt: new Date().toISOString(),
    status: 'pending',
  };
  requests = [r, ...requests];
  emitRequests();
  return r;
}

/** 休日申請を作成 */
export function submitLeaveRequest(args: {
  userId: string;
  userName: string;
  date: string;
  note?: string;
}): ShiftRequest {
  const r: ShiftRequest = {
    id: newId('lvr'),
    userId: args.userId,
    userName: args.userName,
    date: args.date,
    type: 'leave',
    note: args.note,
    submittedAt: new Date().toISOString(),
    status: 'pending',
  };
  requests = [r, ...requests];
  emitRequests();
  return r;
}

/** 有給申請を作成 */
export function submitPaidLeaveRequest(args: {
  userId: string;
  userName: string;
  date: string;
  note?: string;
}): ShiftRequest {
  const r: ShiftRequest = {
    id: newId('plr'),
    userId: args.userId,
    userName: args.userName,
    date: args.date,
    type: 'paid_leave',
    note: args.note,
    submittedAt: new Date().toISOString(),
    status: 'pending',
  };
  requests = [r, ...requests];
  emitRequests();
  return r;
}

/** 申告を承認 */
export function approveRequest(id: string, reviewedBy?: string) {
  const r = requests.find((x) => x.id === id);
  if (!r) return;
  const now = new Date().toISOString();
  requests = requests.map((x) =>
    x.id === id ? { ...x, status: 'approved' as const, reviewedAt: now, reviewedBy } : x,
  );

  // シフト申告は承認時に shifts へも反映（同日の既存シフトは差し替え）
  if (r.type === 'shift' && r.startTime && r.endTime) {
    shifts = [
      // 同一ユーザー・同一日付の既存シフトを排除して新規追加
      ...shifts.filter((s) => !(s.userId === r.userId && s.date === r.date)),
      {
        id: newId('shift'),
        userId: r.userId,
        userName: r.userName,
        date: r.date,
        startTime: r.startTime,
        endTime: r.endTime,
        shiftType: 'regular',
      },
    ];
    emitShifts();
  }

  // 休日申請 / 有給申請 は承認時に同日のシフトを取り除く（あれば）
  if (r.type === 'leave' || r.type === 'paid_leave') {
    const before = shifts.length;
    shifts = shifts.filter((s) => !(s.userId === r.userId && s.date === r.date));
    if (shifts.length !== before) emitShifts();
  }

  emitRequests();
}

/** 申告を却下 */
export function rejectRequest(id: string, reviewedBy?: string) {
  const now = new Date().toISOString();
  requests = requests.map((x) =>
    x.id === id ? { ...x, status: 'rejected' as const, reviewedAt: now, reviewedBy } : x,
  );
  emitRequests();
}

/** 申告を撤回（pending のみ） */
export function withdrawRequest(id: string) {
  const r = requests.find((x) => x.id === id);
  if (!r || r.status !== 'pending') return;
  requests = requests.filter((x) => x.id !== id);
  emitRequests();
}

/** 担当者名取得用ヘルパー */
export function getUserName(userId: string): string {
  return MOCK_USERS.find((u) => u.id === userId)?.name || userId;
}

/**
 * 管理者が直接「休日」をマークする（休業申告の承認済を即時作成）。
 * 既に同日 leave-approved があれば何もしない。
 */
export function setHolidayForUser(args: {
  userId: string;
  userName?: string;
  date: string;
  note?: string;
  reviewedBy?: string;
}): ShiftRequest | null {
  const existing = requests.find(
    (r) =>
      r.userId === args.userId &&
      r.date === args.date &&
      r.type === 'leave' &&
      r.status === 'approved',
  );
  if (existing) return existing;

  const userName =
    args.userName ?? MOCK_USERS.find((u) => u.id === args.userId)?.name ?? args.userId;
  const now = new Date().toISOString();
  const r: ShiftRequest = {
    id: newId('hol'),
    userId: args.userId,
    userName,
    date: args.date,
    type: 'leave',
    note: args.note ?? '管理者設定',
    submittedAt: now,
    status: 'approved',
    reviewedAt: now,
    reviewedBy: args.reviewedBy ?? '管理者',
  };
  requests = [r, ...requests];

  // 同日のシフトがあれば取り除く（休日扱いに）
  const before = shifts.length;
  shifts = shifts.filter((s) => !(s.userId === args.userId && s.date === args.date));
  if (shifts.length !== before) emitShifts();

  emitRequests();
  return r;
}

/** 指定ユーザー × 指定日の休日マーク（承認済 leave / paid_leave）を解除する */
export function clearHolidayForUser(userId: string, date: string): boolean {
  const idx = requests.findIndex(
    (r) =>
      r.userId === userId &&
      r.date === date &&
      (r.type === 'leave' || r.type === 'paid_leave') &&
      r.status === 'approved',
  );
  if (idx === -1) return false;
  requests = requests.filter((_, i) => i !== idx);
  emitRequests();
  return true;
}

/** 指定ユーザー × 指定日が休日扱いか（承認済 leave / paid_leave 有無） */
export function isHolidayForUser(userId: string, date: string): boolean {
  return requests.some(
    (r) =>
      r.userId === userId &&
      r.date === date &&
      (r.type === 'leave' || r.type === 'paid_leave') &&
      r.status === 'approved',
  );
}

/**
 * 管理者がカレンダーから直接シフトを作成 / 上書き。
 *   - 同日のシフトは差し替え
 *   - 休日として登録されていた場合は当該 leave request を取り消し、休日出勤として shift 登録
 *   - shiftType は 'regular' / 'morning' / 'night' / 'part_time' を指定可能
 */
export function setShiftForUser(args: {
  userId: string;
  userName?: string;
  date: string;
  startTime: string;
  endTime: string;
  shiftType?: 'regular' | 'morning' | 'night' | 'part_time';
}): Shift {
  const userName =
    args.userName ?? MOCK_USERS.find((u) => u.id === args.userId)?.name ?? args.userId;
  const next: Shift = {
    id: newId('shift'),
    userId: args.userId,
    userName,
    date: args.date,
    startTime: args.startTime,
    endTime: args.endTime,
    shiftType: args.shiftType ?? 'regular',
  };

  // 同一ユーザー・同一日付のシフトを排除
  shifts = [
    ...shifts.filter((s) => !(s.userId === args.userId && s.date === args.date)),
    next,
  ];

  // 既に同日 leave-approved があれば取り下げ（休日出勤として shift を優先）
  const removedLeave = requests.some(
    (r) =>
      r.userId === args.userId &&
      r.date === args.date &&
      r.type === 'leave' &&
      r.status === 'approved',
  );
  if (removedLeave) {
    requests = requests.filter(
      (r) =>
        !(r.userId === args.userId && r.date === args.date && r.type === 'leave' && r.status === 'approved'),
    );
    emitRequests();
  }

  emitShifts();
  return next;
}

/** 管理者が設定したシフトを削除（同日のシフトを丸ごと取り除く） */
export function clearShiftForUser(userId: string, date: string): boolean {
  const before = shifts.length;
  shifts = shifts.filter((s) => !(s.userId === userId && s.date === date));
  if (shifts.length === before) return false;
  emitShifts();
  return true;
}
