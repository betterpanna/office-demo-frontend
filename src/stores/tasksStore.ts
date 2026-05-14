/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * タスク（作業指示）グローバルストア。
 * TaskAssignment（管理者）でドラッグ＆ドロップした作業を保持し、
 * EmployeeHome / WorkerSchedule など従業員側へ伝搬させる。
 */

import { useSyncExternalStore } from 'react';
import { Task } from '@/src/types';
import { MOCK_TASKS } from '@/src/mockData';
import { getTaskMasterById } from '@/src/stores/taskMastersStore';

let tasks: Task[] = [...MOCK_TASKS];
const listeners = new Set<() => void>();

const emit = () => {
  listeners.forEach((l) => l());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => tasks;

export function useTasks(): Task[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function getTasks(): Task[] {
  return tasks;
}

export function setTasks(next: Task[]) {
  tasks = next;
  emit();
}

export function addTask(task: Task) {
  tasks = [task, ...tasks];
  emit();
}

export function updateTask(id: string, patch: Partial<Task>) {
  tasks = tasks.map((t) => (t.id === id ? { ...t, ...patch } : t));
  emit();
}

export function removeTask(id: string) {
  tasks = tasks.filter((t) => t.id !== id);
  emit();
}

/**
 * タスクをスケジュール枠から外し、未割当プールに戻す。
 * 担当者・予定日時・所要分・dispatched フラグをクリアする。
 * 仮想プール由来のタスク（id が "v-" プレフィックス）はストアから完全に削除する。
 */
export function unassignTask(id: string) {
  if (id.startsWith('v-')) {
    // 仮想タスクは元のソース（在庫/回収）から再生成されるため、ストア側エントリを除去
    tasks = tasks.filter((t) => t.id !== id);
  } else {
    tasks = tasks.map((t) =>
      t.id === id
        ? {
            ...t,
            assigneeId: undefined,
            scheduledDate: '',
            scheduledStartTime: undefined,
            scheduledEndTime: undefined,
            durationMinutes: undefined,
            dispatched: false,
            dispatchedAt: undefined,
            status: 'pending',
          }
        : t,
    );
  }
  emit();
}

/**
 * タスクを「作業中」(in_progress) に切り替える。
 * EmployeeHome で従業員が作業を開始したタイミングで呼び出す。
 *   - status: 'in_progress'
 * 既に in_progress / completed のものは何もしない。
 */
export function startTask(id: string) {
  tasks = tasks.map((t) => {
    if (t.id !== id) return t;
    if (t.status === 'in_progress' || t.status === 'completed') return t;
    return { ...t, status: 'in_progress' };
  });
  emit();
}

/**
 * タスクを完了状態にマークする。
 * EmployeeHome の「作業終了報告」ボタンから呼び出す想定。
 *   - status: 'completed'
 *   - completedDate: 現在時刻 (ISO)
 *   - dispatched: false（従業員ホームの "新着指示" バッジから外す）
 * タスク本体は削除せず、AdminDashboard から実績集計できるようにしておく。
 */
export function completeTask(id: string) {
  const now = new Date().toISOString();
  tasks = tasks.map((t) =>
    t.id === id
      ? {
          ...t,
          status: 'completed',
          completedDate: now,
          dispatched: false,
        }
      : t,
  );
  emit();
}

/**
 * "HH:mm" 文字列から始まる時刻に minutes を加算した "HH:mm" を返す
 * 24時を超えた場合は 23:59 に丸める
 */
export function addMinutesToTime(hhmm: string, minutes: number): string {
  const [hStr, mStr] = (hhmm || '00:00').split(':');
  const total = (Number(hStr) || 0) * 60 + (Number(mStr) || 0) + (minutes || 0);
  if (total >= 24 * 60) return '23:59';
  if (total < 0) return '00:00';
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** 作業マスターから estimatedTime（分）を取得する */
export function getEstimatedMinutes(taskMasterId: string): number {
  const tm = getTaskMasterById(taskMasterId);
  return tm?.estimatedTime || 30;
}

/**
 * 指定担当者・指定日付の割当済みタスクを「重なりなく・隙間なく」連続再配置する。
 *
 *   - 完了済み (status === 'completed') タスクはそのまま動かさない（実績保護）。
 *   - 未完了タスクのみを scheduledStartTime 昇順に並べ替え、
 *     最も早いタスクの開始時刻を基準点として、各タスクの durationMinutes を維持しつつ
 *     直列に back-to-back で再配置する。
 *   - 既存の重なり（A.end > B.start）と隙間（A.end < B.start）の両方を解消する。
 *   - 何も更新が必要なければ emit() を呼ばない。
 */
export function compactSchedule(assigneeId: string, scheduledDate: string): void {
  if (!assigneeId || !scheduledDate) return;
  const workerTasks = tasks
    .filter(
      (t) =>
        t.assigneeId === assigneeId &&
        t.scheduledDate === scheduledDate &&
        !!t.scheduledStartTime &&
        !!t.scheduledEndTime &&
        t.status !== 'completed',
    )
    .sort((a, b) => (a.scheduledStartTime || '').localeCompare(b.scheduledStartTime || ''));
  if (workerTasks.length === 0) return;

  // 基準点：最も早いタスクの現在の開始時刻を維持する（全体を勝手に前倒しせずユーザの設定を尊重）
  let cursor = workerTasks[0].scheduledStartTime as string;
  const updates: Record<string, { scheduledStartTime: string; scheduledEndTime: string }> = {};
  for (const t of workerTasks) {
    const duration = t.durationMinutes || getEstimatedMinutes(t.taskMasterId);
    const newStart = cursor;
    const newEnd = addMinutesToTime(newStart, duration);
    if (newStart !== t.scheduledStartTime || newEnd !== t.scheduledEndTime) {
      updates[t.id] = { scheduledStartTime: newStart, scheduledEndTime: newEnd };
    }
    cursor = newEnd;
  }
  if (Object.keys(updates).length === 0) return;
  tasks = tasks.map((t) => {
    const u = updates[t.id];
    return u
      ? { ...t, scheduledStartTime: u.scheduledStartTime, scheduledEndTime: u.scheduledEndTime }
      : t;
  });
  emit();
}

/**
 * 全担当者・全日付に対して compactSchedule を一括実行する。
 * 起動時 / データ取り込み後の一回限りの正規化に使う想定。
 */
export function compactAllAssignedSchedules(): void {
  const pairs = new Set<string>();
  for (const t of tasks) {
    if (t.assigneeId && t.scheduledDate && t.status !== 'completed') {
      pairs.add(`${t.assigneeId}|${t.scheduledDate}`);
    }
  }
  for (const key of pairs) {
    const [assigneeId, scheduledDate] = key.split('|');
    compactSchedule(assigneeId, scheduledDate);
  }
}

// 初期化時に既存タスクの重なり・隙間を一度クリーンアップする
compactAllAssignedSchedules();

/**
 * 同じ担当者・同じ日付に既に割り当てられているタスクの中で、
 * もっとも遅い scheduledEndTime（"HH:mm"）を返す。完了済みは除外。
 * `excludeTaskId` には今スケジュールしようとしているタスク自身の id を渡す。
 * （自分自身を含めてしまうと、自分の旧時刻に追従してしまう）
 */
export function getLastEndTime(
  assigneeId: string,
  scheduledDate: string,
  excludeTaskId?: string,
): string | undefined {
  return tasks
    .filter(
      (t) =>
        t.id !== excludeTaskId &&
        t.assigneeId === assigneeId &&
        t.scheduledDate === scheduledDate &&
        !!t.scheduledEndTime &&
        t.status !== 'completed',
    )
    .map((t) => t.scheduledEndTime as string)
    .sort()
    .pop();
}

/**
 * 同じ担当者・同じ日付の既存タスクの中で、
 * scheduledStartTime ≤ requestedStart のものを「ドロップ位置より前」とみなし、
 * その中での最終終了時刻（"HH:mm"）を返す。
 * これにより、ドロップ位置の直前にある作業の終了時刻にきっちり詰めて配置できる。
 * 該当する作業が無ければ undefined。
 */
export function getTightStartTime(
  assigneeId: string,
  scheduledDate: string,
  requestedStart: string,
  excludeTaskId?: string,
): string | undefined {
  return tasks
    .filter(
      (t) =>
        t.id !== excludeTaskId &&
        t.assigneeId === assigneeId &&
        t.scheduledDate === scheduledDate &&
        !!t.scheduledStartTime &&
        !!t.scheduledEndTime &&
        t.status !== 'completed' &&
        (t.scheduledStartTime as string) <= requestedStart,
    )
    .map((t) => t.scheduledEndTime as string)
    .sort()
    .pop();
}

/**
 * 同じ担当者・同じ日付の既存タスクの中で、
 * scheduledStartTime ≥ targetStart のものを「ドロップ位置より後ろ」とみなし、
 * その中での最も早い scheduledStartTime（"HH:mm"）を返す。
 * 後続タスクの開始時刻にきっちり接するように終了時刻を抑える用途で使う。
 */
export function getNextStartTime(
  assigneeId: string,
  scheduledDate: string,
  targetStart: string,
  excludeTaskId?: string,
): string | undefined {
  return tasks
    .filter(
      (t) =>
        t.id !== excludeTaskId &&
        t.assigneeId === assigneeId &&
        t.scheduledDate === scheduledDate &&
        !!t.scheduledStartTime &&
        t.status !== 'completed' &&
        (t.scheduledStartTime as string) >= targetStart,
    )
    .map((t) => t.scheduledStartTime as string)
    .sort()[0];
}

/**
 * タスクをスケジュール枠にドロップした際の標準処理。
 * 作業マスターの estimatedTime を所要分として確保し、終了時刻を算出する。
 * 既に存在するタスクは更新、無ければ追加する。
 *
 * 「前後にきっちり詰めて」配置するため、次の順序で開始時刻を決める：
 *   1) ドロップ位置より前（startTime ≤ requested）の作業がある場合、
 *      その最終終了時刻にスナップ（前作業の直後に隙間なく接続）。
 *   2) 該当無し（先頭への割当）なら requestedStart をそのまま採用。
 * さらに、後続タスクとの重なりを避けるため、新タスクの終了時刻は
 * 直後タスクの開始時刻でクリップする（後ろもきっちり接続）。
 */
export function scheduleTask(args: {
  task: Task;
  assigneeId: string;
  scheduledDate: string;
  scheduledStartTime: string;
}): Task {
  const { task, assigneeId, scheduledDate, scheduledStartTime: requestedStart } = args;

  // 既存タスクの移動 (relocation) か、新規割当 (initial assignment) かを判定する。
  //   - 既存タスクで scheduledStartTime / scheduledEndTime / durationMinutes を持つもの → 移動扱い
  //   - プールから初めて割り当てられるタスク（時刻情報なし）→ 新規割当
  // 移動の場合は所要時間 (durationMinutes) と、ユーザのドロップ位置をなるべく尊重する。
  const isRelocation = !!task.scheduledStartTime && !!task.scheduledEndTime && !!task.durationMinutes;

  // 所要時間: 既存タスクなら現行 durationMinutes を維持。新規割当は作業マスタの標準時間を採用。
  const duration = isRelocation && task.durationMinutes
    ? task.durationMinutes
    : getEstimatedMinutes(task.taskMasterId);

  // 1) 開始時刻の決定
  //    - 新規割当 (initial): その担当者・その日付に既に割り当てられている "全作業の最終終了時刻"
  //      に続けて配置する（ドロップ位置に関わらず必ず末尾追加）。
  //      既存タスクが無ければユーザのドロップ位置（業務開始時刻フロア適用済）を採用。
  //    - 移動 (relocation): ユーザのドロップ位置をなるべく尊重するが、他のタスクと時間が
  //      重なる場合は重なるタスクの直後にずらして配置する（業務時間は維持）。
  let scheduledStartTime = requestedStart;
  if (!isRelocation) {
    const lastEndTime = getLastEndTime(assigneeId, scheduledDate, task.id);
    if (lastEndTime) {
      scheduledStartTime = lastEndTime;
    }
  }

  // 2) 通常通り duration 分先を終了時刻として算出
  let scheduledEndTime = addMinutesToTime(scheduledStartTime, duration);

  // 3) 重なり検出 & 自動再配置（新規割当 / 移動の両方で適用）
  //    proposedStart〜proposedEnd の時間範囲が同担当者・同日付の他タスクと重なる場合、
  //    最も終了時刻が遅い競合タスクの直後にスタートをずらす。
  //    所要時間 (duration) は維持されるため、業務時間の伸縮は発生しない。
  //    (押し出された結果さらに別タスクと重なる連鎖を解消するため、最大 50 回反復)
  const isOverlapping = (aStart: string, aEnd: string, bStart: string, bEnd: string) =>
    aStart < bEnd && bStart < aEnd;
  let safety = 50;
  while (safety-- > 0) {
    const conflicts = tasks
      .filter(
        (t) =>
          t.id !== task.id &&
          t.assigneeId === assigneeId &&
          t.scheduledDate === scheduledDate &&
          !!t.scheduledStartTime &&
          !!t.scheduledEndTime &&
          t.status !== 'completed' &&
          isOverlapping(
            scheduledStartTime,
            scheduledEndTime,
            t.scheduledStartTime as string,
            t.scheduledEndTime as string,
          ),
      )
      .map((t) => t.scheduledEndTime as string)
      .sort();
    if (conflicts.length === 0) break;
    // 競合の最も遅い終了時刻に開始時刻を合わせる
    scheduledStartTime = conflicts[conflicts.length - 1];
    scheduledEndTime = addMinutesToTime(scheduledStartTime, duration);
  }

  // 終了時刻に合わせて durationMinutes も再計算
  // 移動時は duration がそのまま維持されるためサイズ変動なし。
  // 新規割当でクリップが入った場合のみ短く再計算される。
  const [sH, sM] = scheduledStartTime.split(':').map((v) => Number(v) || 0);
  const [eH, eM] = scheduledEndTime.split(':').map((v) => Number(v) || 0);
  const finalDuration = Math.max(5, eH * 60 + eM - (sH * 60 + sM));

  // 割当時のステータス:
  //   - 未割当(pending) からの割当 → assigned (割当済)
  //   - 既に作業中(in_progress) / 完了(completed) はそのまま維持
  //   - 割当済(assigned) の枠移動はそのまま assigned
  const nextStatus: Task['status'] =
    task.status === 'in_progress' || task.status === 'completed'
      ? task.status
      : 'assigned';

  const next: Task = {
    ...task,
    assigneeId,
    scheduledDate,
    scheduledStartTime,
    scheduledEndTime,
    durationMinutes: finalDuration,
    dispatched: true,
    dispatchedAt: new Date().toISOString(),
    status: nextStatus,
  };
  const exists = tasks.some((t) => t.id === task.id);
  if (exists) {
    tasks = tasks.map((t) => (t.id === task.id ? { ...t, ...next } : t));
  } else {
    tasks = [next, ...tasks];
  }
  emit();

  // 同担当者・同日付の全タスクを「重なりなく・隙間なく」連続再配置する。
  // - 重なり：あれば後ろにずらして解消
  // - 隙間：あれば前のタスクにくっつけて解消
  // 既に scheduleTask 内で重なり解消はしてあるが、移動後に空白が残るケース等を
  // ここで併せて正規化する（completedタスクは保護される）。
  compactSchedule(assigneeId, scheduledDate);

  // compactSchedule で位置が更新されている可能性があるため、最新の値を返す
  const updated = tasks.find((t) => t.id === next.id);
  return updated ?? next;
}
