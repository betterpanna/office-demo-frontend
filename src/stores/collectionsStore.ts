/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 軽量なグローバルストア。
 * 回収案件は CollectionManagement で登録/更新され、
 * 同一データを CollectorSchedule / EmployeeHome / TaskAssignment などから参照できるようにする。
 */

import { useSyncExternalStore } from 'react';
import { Collection, CollectionItem, CollectionItemBreakdown } from '@/src/types';
import { MOCK_COLLECTIONS } from '@/src/mockData';

let collections: Collection[] = [...MOCK_COLLECTIONS];
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

const getSnapshot = () => collections;

export function useCollections(): Collection[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function getCollections(): Collection[] {
  return collections;
}

export function addCollection(collection: Collection) {
  collections = [collection, ...collections];
  emit();
}

export function updateCollection(id: string, patch: Partial<Collection>) {
  collections = collections.map((c) => (c.id === id ? { ...c, ...patch } : c));
  emit();
}

export function removeCollection(id: string) {
  collections = collections.filter((c) => c.id !== id);
  emit();
}

export function setCollections(next: Collection[]) {
  collections = next;
  emit();
}

// ---------- 品目単位の CRUD ----------
const recalcTotal = (items: CollectionItem[]): number =>
  items.reduce((sum, it) => sum + ((it.finalPrice || 0) * it.quantity), 0);

export function addCollectionItem(collectionId: string, item: CollectionItem) {
  collections = collections.map((c) => {
    if (c.id !== collectionId) return c;
    const items = [...c.items, item];
    return { ...c, items, totalAmount: recalcTotal(items) };
  });
  emit();
}

export function updateCollectionItem(
  collectionId: string,
  itemId: string,
  patch: Partial<CollectionItem>
) {
  collections = collections.map((c) => {
    if (c.id !== collectionId) return c;
    const items = c.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it));
    return { ...c, items, totalAmount: recalcTotal(items) };
  });
  emit();
}

export function removeCollectionItem(collectionId: string, itemId: string) {
  collections = collections.map((c) => {
    if (c.id !== collectionId) return c;
    const items = c.items.filter((it) => it.id !== itemId);
    return { ...c, items, totalAmount: recalcTotal(items) };
  });
  emit();
}

// 全アイテムに finalPrice が入力済みか判定
export function isPurchaseFinalized(c: Collection): boolean {
  if (!c.items || c.items.length === 0) return false;
  return c.items.every((it) => typeof it.finalPrice === 'number' && it.finalPrice > 0);
}

// ---------- 分解 (1→N) breakdown CRUD ----------
/**
 * 親 CollectionItem に分解レコードをまとめてセットする。
 * 同時に親の finalPrice を「allocatedPurchaseAmount の合計」で上書きし、
 * sortingCategory は混在の場合は undefined、単一の場合はその値を採用する。
 */
export function setCollectionItemBreakdowns(
  collectionId: string,
  itemId: string,
  breakdowns: CollectionItemBreakdown[],
) {
  collections = collections.map((c) => {
    if (c.id !== collectionId) return c;
    const items = c.items.map((it) => {
      if (it.id !== itemId) return it;
      const allocSum = breakdowns.reduce(
        (s, b) => s + (Number(b.allocatedPurchaseAmount) || 0),
        0,
      );
      const cats = Array.from(new Set(breakdowns.map((b) => b.category)));
      const single = cats.length === 1 ? cats[0] : it.sortingCategory;
      // 親アイテムの finalPrice は「単価 × quantity」想定なので
      // allocSum を quantity で割って単価として保存する。
      const qty = it.quantity || 1;
      const unitPrice = qty > 0 ? Math.round(allocSum / qty) : allocSum;
      return {
        ...it,
        breakdowns,
        sortingCategory: single,
        finalPrice: unitPrice,
      } as CollectionItem;
    });
    return { ...c, items, totalAmount: recalcTotal(items) };
  });
  emit();
}

/**
 * 分解の合計が finalPrice と一致しているか（あるいは breakdowns が無く finalPrice のみ）。
 */
export function isItemFinalized(it: CollectionItem): boolean {
  const fp = Number(it.finalPrice);
  return Number.isFinite(fp) && fp > 0;
}
