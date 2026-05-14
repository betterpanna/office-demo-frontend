/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 作業マスタ（TaskMaster）ストア。
 * 各画面で MOCK_TASK_MASTER を直接参照していた処理を、ここを通すことで
 * 管理者が「従業員・拠点管理」画面から作業マスタを追加・編集・削除した結果が
 * すべての画面（作業スケジュール、業務管理、ダッシュボード等）に即座に反映される。
 */

import { useSyncExternalStore } from 'react';
import { TaskMaster, TaskType } from '@/src/types';
import { MOCK_TASK_MASTER } from '@/src/mockData';

let taskMasters: TaskMaster[] = [...MOCK_TASK_MASTER];

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const getSnapshot = () => taskMasters;

export function useTaskMasters(): TaskMaster[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** 非フック文脈（store / 関数）から最新の作業マスタを参照する */
export function getTaskMasters(): TaskMaster[] {
  return taskMasters;
}

/** id 検索ヘルパー */
export function getTaskMasterById(id: string): TaskMaster | undefined {
  return taskMasters.find((t) => t.id === id);
}

function newId() {
  return `tm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** 新規作成 */
export function addTaskMaster(args: {
  name: string;
  type: TaskType;
  description?: string;
  estimatedTime: number;
  basePrice?: number;
}): TaskMaster {
  const tm: TaskMaster = {
    id: newId(),
    name: args.name.trim(),
    type: args.type,
    description: (args.description ?? '').trim(),
    estimatedTime: Math.max(1, Math.round(args.estimatedTime)),
    basePrice: args.basePrice !== undefined ? Math.max(0, Math.round(args.basePrice)) : undefined,
  };
  taskMasters = [...taskMasters, tm];
  emit();
  return tm;
}

/** 部分更新 */
export function updateTaskMaster(id: string, patch: Partial<Omit<TaskMaster, 'id'>>) {
  const next = taskMasters.map((t) => {
    if (t.id !== id) return t;
    return {
      ...t,
      ...patch,
      name: patch.name !== undefined ? patch.name.trim() : t.name,
      description:
        patch.description !== undefined ? patch.description.trim() : t.description,
      estimatedTime:
        patch.estimatedTime !== undefined
          ? Math.max(1, Math.round(patch.estimatedTime))
          : t.estimatedTime,
      basePrice:
        patch.basePrice !== undefined
          ? Math.max(0, Math.round(patch.basePrice))
          : t.basePrice,
    };
  });
  taskMasters = next;
  emit();
}

/** 削除 */
export function deleteTaskMaster(id: string) {
  taskMasters = taskMasters.filter((t) => t.id !== id);
  emit();
}

/** TaskType の表示用ラベル
 *  業務工程は「回収・分別・商品化・出荷」の 4 種類に集約。
 *  旧 cleaning/inspection/photography/packing/dismantling は productization (tm8) に内包。
 *  type は後方互換のため残しているが、新規作成では使用しない。
 */
export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  collection: '回収',
  sorting: '分別',
  productization: '商品化',
  shipping: '発送',
  // 以下は使用停止（後方互換のためラベルのみ残置）
  cleaning: '洗浄',
  inspection: '検品',
  photography: '撮影',
  packing: '梱包',
  repair: '修理',
  dismantling: '解体',
};

export const TASK_TYPES: TaskType[] = [
  'collection',
  'sorting',
  'productization',
  'shipping',
];
