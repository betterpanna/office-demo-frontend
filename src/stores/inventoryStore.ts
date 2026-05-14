/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 在庫グローバルストア。
 * 分別作業（リユース/リビルド）で確定した品目を在庫に登録し、
 * 買取金額（finalPrice）を原価 (purchaseAmount) として連携する。
 */

import { useSyncExternalStore } from 'react';
import { Collection, CollectionItemBreakdown, InventoryItem } from '@/src/types';
import { MOCK_INVENTORY } from '@/src/mockData';
import { getCollections } from '@/src/stores/collectionsStore';

let inventory: InventoryItem[] = [...MOCK_INVENTORY];
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

const getSnapshot = () => inventory;

export function useInventory(): InventoryItem[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function getInventory(): InventoryItem[] {
  return inventory;
}

export function addInventoryItem(item: InventoryItem) {
  inventory = [item, ...inventory];
  emit();
}

export function updateInventoryItem(id: string, patch: Partial<InventoryItem>) {
  inventory = inventory.map((i) => (i.id === id ? { ...i, ...patch } : i));
  emit();
}

export function removeInventoryItem(id: string) {
  inventory = inventory.filter((i) => i.id !== id);
  emit();
}

/**
 * 既に同じ source からの在庫が存在する場合は更新、無ければ新規登録。
 * 買取金額 (finalPrice) を purchaseAmount に反映する。
 */
export function upsertInventoryFromCollectionItem(args: {
  collectionId: string;
  collectionItemId: string;
  branchName?: string;
  category: 'reuse' | 'rebuilt' | 'recycle';
  shelfCode?: string;
}): InventoryItem | null {
  const { collectionId, collectionItemId, branchName, category, shelfCode } = args;
  const collections = getCollections();
  const c = collections.find((x) => x.id === collectionId);
  if (!c) return null;
  const it = c.items.find((x) => x.id === collectionItemId);
  if (!it) return null;

  const existingIdx = inventory.findIndex(
    (i) => i.sourceCollectionId === collectionId && i.sourceCollectionItemId === collectionItemId,
  );

  const status: InventoryItem['status'] =
    category === 'recycle'
      ? 'sorted'
      : category === 'rebuilt'
        ? 'pending_productization'
        : 'pending_productization';

  const next: InventoryItem = {
    id: existingIdx >= 0 ? inventory[existingIdx].id : `inv-${collectionItemId}`,
    managementNumber:
      existingIdx >= 0
        ? inventory[existingIdx].managementNumber
        : `SG-${c.collectionNumber}-${(it.id || '').slice(-4).toUpperCase()}`,
    name: it.name,
    status,
    sortingCategory: category,
    rank: 'B',
    carModel: it.carModel,
    carYear: it.carYear,
    category: it.category || 'その他',
    shelfCode: shelfCode || (existingIdx >= 0 ? inventory[existingIdx].shelfCode : undefined),
    location: shelfCode || (existingIdx >= 0 ? inventory[existingIdx].location : undefined),
    baseName: branchName || (existingIdx >= 0 ? inventory[existingIdx].baseName : undefined),
    arrivalDate: c.collectionDate,
    statusChangedAt: new Date().toISOString(),
    partNumber: it.partNumber,
    vinNumber: it.vinNumber,
    carName: it.carName,
    carMaker: it.carMaker,
    carModelNumber: it.carModelNumber,
    notes: it.notes,
    // 原価1: 買取金額 (finalPrice * quantity)
    purchaseAmount: (it.finalPrice || 0) * (it.quantity || 1),
    // Linkage
    sourceCollectionId: collectionId,
    sourceCollectionItemId: collectionItemId,
  };

  if (existingIdx >= 0) {
    const merged = { ...inventory[existingIdx], ...next };
    inventory = inventory.map((x, i) => (i === existingIdx ? merged : x));
  } else {
    inventory = [next, ...inventory];
  }
  emit();
  return next;
}

/**
 * 分解レコード (CollectionItemBreakdown) から在庫を作成/更新する。
 * 1 つの breakdown が 1 つの在庫レコードに対応する。
 * - recycle カテゴリは在庫不要 → null を返す
 * - リユース／リビルドは在庫を作成し、allocatedPurchaseAmount を原価1とする
 */
export function upsertInventoryFromBreakdown(args: {
  collectionId: string;
  parentItem: { id: string; name: string; carModel?: string; carYear?: string; category?: string; carName?: string; carMaker?: string; carModelNumber?: string; partNumber?: string; vinNumber?: string };
  breakdown: CollectionItemBreakdown;
  branchName?: string;
  collectionNumber: string;
  collectionDate: string;
}): InventoryItem | null {
  const { collectionId, parentItem, breakdown, branchName, collectionNumber, collectionDate } = args;

  // 資源は在庫化しない
  if (breakdown.category === 'recycle') {
    // 既に作成済みの在庫があれば削除する
    const existingIdx = inventory.findIndex((i) => i.id === breakdown.inventoryItemId);
    if (existingIdx >= 0) {
      inventory = inventory.filter((_, i) => i !== existingIdx);
      emit();
    }
    return null;
  }

  const status: InventoryItem['status'] = 'pending_productization';
  const existingIdx = inventory.findIndex(
    (i) => i.id === (breakdown.inventoryItemId || `inv-bd-${breakdown.id}`),
  );

  const id = breakdown.inventoryItemId || `inv-bd-${breakdown.id}`;
  const next: InventoryItem = {
    id,
    managementNumber:
      existingIdx >= 0
        ? inventory[existingIdx].managementNumber
        : `SG-${collectionNumber}-${breakdown.id.slice(-4).toUpperCase()}`,
    name: breakdown.name,
    status,
    sortingCategory: breakdown.category,
    rank: 'B',
    carModel: parentItem.carModel,
    carYear: parentItem.carYear,
    category: parentItem.category || 'その他',
    shelfCode: breakdown.shelfCode || (existingIdx >= 0 ? inventory[existingIdx].shelfCode : undefined),
    location: breakdown.shelfCode || (existingIdx >= 0 ? inventory[existingIdx].location : undefined),
    baseName: branchName || (existingIdx >= 0 ? inventory[existingIdx].baseName : undefined),
    arrivalDate: collectionDate,
    statusChangedAt: new Date().toISOString(),
    partNumber: parentItem.partNumber,
    vinNumber: parentItem.vinNumber,
    carName: parentItem.carName,
    carMaker: parentItem.carMaker,
    carModelNumber: parentItem.carModelNumber,
    notes: breakdown.notes,
    // 原価1: 配分された買取金額
    purchaseAmount: Number(breakdown.allocatedPurchaseAmount) || 0,
    // Linkage
    sourceCollectionId: collectionId,
    sourceCollectionItemId: breakdown.parentItemId,
  };

  if (existingIdx >= 0) {
    const merged = { ...inventory[existingIdx], ...next };
    inventory = inventory.map((x, i) => (i === existingIdx ? merged : x));
  } else {
    inventory = [next, ...inventory];
  }
  emit();
  return next;
}

/**
 * 親 CollectionItem に紐付く全在庫を一括で削除（再分解前のクリーンアップ用）。
 */
export function removeInventoryByCollectionItem(collectionItemId: string) {
  const before = inventory.length;
  inventory = inventory.filter((i) => i.sourceCollectionItemId !== collectionItemId);
  if (inventory.length !== before) emit();
}

/**
 * 在庫アイテムの実効的な原価（買取金額ベース）を返す。
 * sourceCollectionItemId が設定されていれば最新の finalPrice を使用、
 * 無ければ inventory.purchaseAmount を使用。
 */
export function resolvePurchaseAmount(
  item: InventoryItem,
  collections?: Collection[],
): number {
  if (item.sourceCollectionId && item.sourceCollectionItemId) {
    const list = collections || getCollections();
    const c = list.find((x) => x.id === item.sourceCollectionId);
    const it = c?.items.find((x) => x.id === item.sourceCollectionItemId);
    if (it) {
      // 分解 (breakdown) 由来の在庫なら、対応する breakdown.allocatedPurchaseAmount を使用
      if (it.breakdowns && it.breakdowns.length > 0) {
        const bd = it.breakdowns.find(
          (b) => b.inventoryItemId === item.id || `inv-bd-${b.id}` === item.id,
        );
        if (bd && Number.isFinite(Number(bd.allocatedPurchaseAmount))) {
          return Number(bd.allocatedPurchaseAmount) || 0;
        }
      }
      // 1:1 の従来パスは finalPrice * quantity
      if (typeof it.finalPrice === 'number' && it.finalPrice > 0) {
        return it.finalPrice * (it.quantity || 1);
      }
    }
  }
  return item.purchaseAmount || 0;
}

/**
 * 在庫の総原価（原価1+2+3）を返す。
 */
export function resolveTotalCost(item: InventoryItem, collections?: Collection[]): number {
  return (
    resolvePurchaseAmount(item, collections) +
    (item.collectionShippingFee || 0) +
    (item.laborEvaluationAmount || 0)
  );
}
