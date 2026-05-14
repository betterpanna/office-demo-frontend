/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 取引先マスタストア。
 * 引取送料あり/なし、デフォルト送料、月次買取明細書のメール送付先を保持し、
 * 新規回収登録時に自動引き当てを行う。
 */

import { useSyncExternalStore } from 'react';
import { Customer } from '@/src/types';
import { MOCK_CUSTOMERS } from '@/src/mockData';

let customers: Customer[] = [...MOCK_CUSTOMERS];
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => customers;

export function useCustomers(): Customer[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function getCustomers(): Customer[] {
  return customers;
}

export function getCustomerById(id: string | undefined): Customer | undefined {
  if (!id) return undefined;
  return customers.find((c) => c.id === id);
}

export function addCustomer(customer: Customer) {
  customers = [customer, ...customers];
  emit();
}

export function updateCustomer(id: string, patch: Partial<Customer>) {
  customers = customers.map((c) => (c.id === id ? { ...c, ...patch } : c));
  emit();
}

export function removeCustomer(id: string) {
  customers = customers.filter((c) => c.id !== id);
  emit();
}

/**
 * 新規取引先 ID を生成。
 */
export function nextCustomerId(): string {
  const max = customers
    .map((c) => parseInt((c.id.match(/-(\d+)$/) || ['', '0'])[1], 10))
    .reduce((a, b) => Math.max(a, b), 0);
  return `cust-NEW-${(max + 1).toString().padStart(3, '0')}`;
}
