/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 現在ログイン中のユーザーを保持するシンプルなストア。
 * ログイン時に setCurrentUser、ログアウト時に clearCurrentUser を呼ぶ。
 */

import { useSyncExternalStore } from 'react';
import { User } from '@/src/types';
import { MOCK_USERS } from '@/src/mockData';

let currentUser: User | null = null;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const getSnapshot = () => currentUser;

export function useCurrentUser(): User | null {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function getCurrentUser(): User | null {
  return currentUser;
}

export function setCurrentUser(user: User | null) {
  currentUser = user;
  emit();
}

export function clearCurrentUser() {
  currentUser = null;
  emit();
}

/**
 * メールアドレスから MOCK_USERS のユーザーを検索する。
 * ログイン時に Firebase Auth が成功した後の本人特定に使用。
 */
export function findUserByEmail(email: string): User | null {
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized) return null;
  return MOCK_USERS.find((u) => u.email.toLowerCase() === normalized) || null;
}
