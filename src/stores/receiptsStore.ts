/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 電子受領書ストア。
 * 回収員が現場で発行した受領書を保持し、管理者画面 (CollectionManagement) から
 * 同じデータを参照・プレビューできるようにする。
 */

import { useSyncExternalStore } from 'react';
import { CollectionReceipt } from '@/src/types';

let receipts: CollectionReceipt[] = [];
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => receipts;

export function useReceipts(): CollectionReceipt[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function getReceipts(): CollectionReceipt[] {
  return receipts;
}

export function getReceiptsByCollectionId(collectionId: string): CollectionReceipt[] {
  return receipts.filter((r) => r.collectionId === collectionId);
}

export function addReceipt(receipt: CollectionReceipt) {
  receipts = [receipt, ...receipts];
  emit();
}

export function updateReceipt(id: string, patch: Partial<CollectionReceipt>) {
  receipts = receipts.map((r) => (r.id === id ? { ...r, ...patch } : r));
  emit();
}

export function removeReceipt(id: string) {
  receipts = receipts.filter((r) => r.id !== id);
  emit();
}
