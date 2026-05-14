/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * メッセージストア。
 *
 * 仕様:
 *   - 管理者は「全体」または「特定の従業員」にメッセージを送れる
 *   - 従業員は「全体」または「管理者」にメッセージを送れる
 *
 * チャネル設計:
 *   - 'all'        : 全員が読み書きできる全体ブロードキャスト
 *   - <userId>     : 管理者と当該従業員 (userId) の 1on1 DM
 *                    管理者が従業員 X に送るとき:        channel = X.id
 *                    従業員 X が管理者に送るとき:       channel = X.id
 *                    → 双方向のスレッドが同一 channel に集まる
 *
 * 表示権限:
 *   - 'all' チャネルは全員可視
 *   - DM チャネル <userId> は本人と admin のみ可視
 */

import { useSyncExternalStore } from 'react';
import { User } from '@/src/types';
import { MOCK_USERS } from '@/src/mockData';

export type MessageChannel = 'all' | string; // 'all' か <userId>

export interface Message {
  id: string;
  /** 送信者 userId */
  fromUserId: string;
  /** 送信者名（スナップショット） */
  fromName: string;
  /** 送信者 role */
  fromRole: 'admin' | 'worker' | 'collector';
  /** チャネル: 'all' または対象従業員の userId */
  channel: MessageChannel;
  /** 本文 */
  body: string;
  /** ISO 8601 送信時刻 */
  sentAt: string;
}

const ADMIN_FALLBACK = MOCK_USERS.find((u) => u.role === 'admin');
const ADMIN_NAME = ADMIN_FALLBACK?.name ?? '管理者';

// 動作確認用のシード（管理者→全体、管理者→一郎 DM、二郎→管理者 DM）
const seedAtIso = (offsetMin: number) => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - offsetMin);
  return d.toISOString();
};

let messages: Message[] = [
  {
    id: 'msg-seed-1',
    fromUserId: ADMIN_FALLBACK?.id ?? 'admin',
    fromName: ADMIN_NAME,
    fromRole: 'admin',
    channel: 'all',
    body: '本日 14時から大型入荷予定です。商品化ライン優先で対応をお願いします。',
    sentAt: seedAtIso(95),
  },
  {
    id: 'msg-seed-2',
    fromUserId: 'u2',
    fromName: '作業員 一郎',
    fromRole: 'worker',
    channel: 'all',
    body: '了解しました。検品済みの撮影待ちが現在 5 件です。',
    sentAt: seedAtIso(80),
  },
  {
    id: 'msg-seed-3',
    fromUserId: ADMIN_FALLBACK?.id ?? 'admin',
    fromName: ADMIN_NAME,
    fromRole: 'admin',
    channel: 'u2',
    body: '一郎さん、エンジン E-102 の解体は本日中の完了でお願いします。',
    sentAt: seedAtIso(45),
  },
  {
    id: 'msg-seed-4',
    fromUserId: 'u2',
    fromName: '作業員 一郎',
    fromRole: 'worker',
    channel: 'u2',
    body: '承知しました。15時頃には完了見込みです。',
    sentAt: seedAtIso(40),
  },
];

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const getSnapshot = () => messages;

export function useMessages(): Message[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function getMessages(): Message[] {
  return messages;
}

/**
 * 1メッセージ送信。
 * channel が 'all' の場合は全員可視のブロードキャスト、
 * それ以外は <userId> 形式の管理者⇔従業員 DM。
 */
export function sendMessage(args: {
  fromUserId: string;
  fromName: string;
  fromRole: 'admin' | 'worker' | 'collector';
  channel: MessageChannel;
  body: string;
}): Message | null {
  const body = (args.body || '').trim();
  if (!body) return null;
  const m: Message = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    fromUserId: args.fromUserId,
    fromName: args.fromName,
    fromRole: args.fromRole,
    channel: args.channel,
    body,
    sentAt: new Date().toISOString(),
  };
  messages = [...messages, m];
  emit();
  return m;
}

/**
 * 指定チャネルのメッセージを古い順で返す。
 * （全体は 'all'、個別 DM は employeeId）
 */
export function getThread(channel: MessageChannel): Message[] {
  return messages
    .filter((m) => m.channel === channel)
    .sort((a, b) => a.sentAt.localeCompare(b.sentAt));
}

/**
 * 当該ユーザーが閲覧可能なチャネル一覧を返す。
 *   - admin: 'all' + 全従業員 (各々の userId)
 *   - 従業員: 'all' + 'self'(=自分の userId, 管理者との DM)
 */
export function getChannelsForUser(user: User): MessageChannel[] {
  if (user.role === 'admin') {
    return ['all', ...MOCK_USERS.filter((u) => u.role !== 'admin').map((u) => u.id)];
  }
  return ['all', user.id];
}

/** 指定チャネルの最新メッセージ（プレビュー用） */
export function getLastMessage(channel: MessageChannel): Message | undefined {
  const t = getThread(channel);
  return t[t.length - 1];
}

/** 指定チャネルのメッセージ件数 */
export function countMessages(channel: MessageChannel): number {
  return messages.filter((m) => m.channel === channel).length;
}
