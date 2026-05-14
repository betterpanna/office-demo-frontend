/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * BANANA BAY 出品リストア。
 * 管理者の BananaBayManagement と従業員側の出荷業務フローで共有することで、
 * 一方の更新（追跡番号入力・配達完了など）が即時に他方の画面へ反映される。
 */

import { useSyncExternalStore } from 'react';
import { BananaBayListing, ShippingCarrier, DeliveryStatus, Task } from '@/src/types';
import { MOCK_BANANA_LISTINGS, MOCK_USERS } from '@/src/mockData';
import { getTasks, addTask, addMinutesToTime, getLastEndTime } from '@/src/stores/tasksStore';
import { getInventory, updateInventoryItem } from '@/src/stores/inventoryStore';

let listings: BananaBayListing[] = [...MOCK_BANANA_LISTINGS];
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const getSnapshot = () => listings;

export function useBananaListings(): BananaBayListing[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function getBananaListings(): BananaBayListing[] {
  return listings;
}

/** inventoryId から該当する出品レコードを取得 */
export function getBananaListingByInventoryId(inventoryId: string): BananaBayListing | undefined {
  return listings.find((l) => l.inventoryId === inventoryId);
}

/** 部分更新（status='sold' に遷移したら出荷タスクを自動生成） */
export function updateBananaListing(id: string, patch: Partial<BananaBayListing>) {
  const before = listings.find((l) => l.id === id);
  listings = listings.map((l) => (l.id === id ? { ...l, ...patch } : l));
  emit();

  // 落札（status='sold' への遷移）を検知 → 出荷タスクを自動生成
  const after = listings.find((l) => l.id === id);
  if (after && before && before.status !== 'sold' && after.status === 'sold') {
    ensureShippingTaskForListing(after);
  }
}

/**
 * 指定 listing に対する tm9（出荷業務）タスクが存在しなければ自動生成する。
 * - 既に同 inventoryId をターゲットとする tm9 タスクがあれば作らない
 * - 拠点(baseName) の作業員(role='worker') から最も担当数の少ない人をラウンドロビンで選択
 * - 当日の最終タスク終了時刻に詰めて配置（無ければ 09:00 から）
 */
export function ensureShippingTaskForListing(listing: BananaBayListing): Task | null {
  // 既存タスクがあるかチェック
  const existing = getTasks().find(
    (t) =>
      t.taskMasterId === 'tm9' &&
      t.targetType === 'inventory' &&
      t.targetId === listing.inventoryId &&
      t.status !== 'completed',
  );
  if (existing) return existing;

  // 在庫から拠点を解決
  const inv = getInventory().find((i) => i.id === listing.inventoryId);
  const baseName = inv?.baseName;

  // 拠点の作業員を抽出（無ければ任意の worker）
  const workers = MOCK_USERS.filter(
    (u) => u.role === 'worker' && (!baseName || u.base === baseName),
  );
  if (workers.length === 0) return null;

  // 既存 tm9 タスクの担当割当数で最少者を選択
  const allTasks = getTasks();
  const counts = new Map<string, number>();
  workers.forEach((w) => counts.set(w.id, 0));
  allTasks
    .filter((t) => t.taskMasterId === 'tm9' && t.assigneeId && counts.has(t.assigneeId))
    .forEach((t) => counts.set(t.assigneeId!, (counts.get(t.assigneeId!) ?? 0) + 1));
  const assignee = workers.reduce((min, w) =>
    (counts.get(w.id) ?? 0) < (counts.get(min.id) ?? 0) ? w : min,
  );

  // 本日の最終タスク終了時刻に詰める
  const today = new Date().toISOString().slice(0, 10);
  const lastEnd = getLastEndTime(assignee.id, today);
  const startTime = lastEnd ?? '09:00';
  const duration = 30;
  const endTime = addMinutesToTime(startTime, duration);

  const newTask: Task = {
    id: `t-ship-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    taskMasterId: 'tm9',
    status: 'assigned',
    priority: 'high',
    targetType: 'inventory',
    targetId: listing.inventoryId,
    targetName: `${listing.itemName}（出荷業務）`,
    assigneeId: assignee.id,
    quantity: 1,
    scheduledDate: today,
    scheduledStartTime: startTime,
    scheduledEndTime: endTime,
    durationMinutes: duration,
    dispatched: true,
    dispatchedAt: new Date().toISOString(),
  };
  addTask(newTask);
  return newTask;
}

/**
 * 落札処理：listing を sold に更新し、API 経由で取得した発送先情報を保存。
 * 副作用として出荷タスク (tm9) が自動生成される。
 *
 * @param id           BananaBayListing.id
 * @param args         API から取得した落札・発送情報
 *                       - buyerName       : 買い手氏名
 *                       - recipientName   : 受取人氏名（買い手と異なる場合あり）
 *                       - shippingAddress : 配送先住所
 *                       - recipientPhone  : 配送先電話番号
 *                       - orderId         : BANANA BAY 注文ID
 *                       - estimatedDeliveryDate : 配達希望日（業者の標準リードタイムから算出）
 */
export function markListingAsSold(
  id: string,
  args: {
    buyerName?: string;
    recipientName?: string;
    shippingAddress?: string;
    recipientPhone?: string;
    orderId?: string;
    estimatedDeliveryDate?: string;
  } = {},
) {
  const today = new Date().toISOString().slice(0, 10);
  updateBananaListing(id, {
    status: 'sold',
    paymentConfirmed: true,
    deliveryStatus: 'preparing' as DeliveryStatus,
    updateDate: today,
    buyerName: args.buyerName,
    recipientName: args.recipientName ?? args.buyerName,
    shippingAddress: args.shippingAddress,
    recipientPhone: args.recipientPhone,
    orderId: args.orderId,
    estimatedDeliveryDate: args.estimatedDeliveryDate,
    shippingNoticeSent: false,
  });
  // 在庫側も「売却済」に同期 — 在庫管理・ダッシュボードの集計を整合
  const listing = listings.find((l) => l.id === id);
  if (listing?.inventoryId) {
    updateInventoryItem(listing.inventoryId, {
      status: 'sold',
      bananaBayStatus: 'sold',
      statusChangedAt: new Date().toISOString(),
    });
  }
}

/** 出荷登録（worker 側で梱包→追跡番号入力→発送完了 の最終ステップから呼ぶ） */
export function markListingAsShipped(args: {
  id: string;
  shippingCarrier: ShippingCarrier;
  trackingNumber: string;
  shippedDate?: string;
  shippingNotes?: string;
}): void {
  const today = new Date().toISOString().slice(0, 10);
  updateBananaListing(args.id, {
    shippingCarrier: args.shippingCarrier,
    trackingNumber: args.trackingNumber,
    shippedDate: args.shippedDate ?? today,
    deliveryStatus: 'shipped' as DeliveryStatus,
    shippingNoticeSent: true,
    shippingNotes: args.shippingNotes ?? undefined,
  });
  // 在庫側にも発送状態を反映 — bananaBayStatus を 'shipping' へ
  const listing = listings.find((l) => l.id === args.id);
  if (listing?.inventoryId) {
    updateInventoryItem(listing.inventoryId, {
      bananaBayStatus: 'shipping',
      statusChangedAt: new Date().toISOString(),
    });
  }
}

/** 配達完了をマーク（在庫側にも反映：bananaBayStatus='sold' で確定） */
export function markListingAsDelivered(id: string, deliveredDate?: string): void {
  const today = new Date().toISOString().slice(0, 10);
  updateBananaListing(id, {
    deliveryStatus: 'delivered',
    deliveredDate: deliveredDate ?? today,
  });
  const listing = listings.find((l) => l.id === id);
  if (listing?.inventoryId) {
    updateInventoryItem(listing.inventoryId, {
      bananaBayStatus: 'sold',
      statusChangedAt: new Date().toISOString(),
    });
  }
}

/**
 * 起動時に既存の sold listing で出荷タスクが無いものを補填する。
 * 既存 tm9 タスクとの重複は ensureShippingTaskForListing 側でチェック済。
 * deliveryStatus='preparing' のもの（=未発送）のみが対象。
 */
function backfillShippingTasksOnInit(): void {
  // 同期的に呼ぶと inventoryStore / tasksStore が初期化前の場合があるので
  // microtask で 1 tick 遅らせて確実に他ストアが準備できた後に実行する
  Promise.resolve().then(() => {
    listings
      .filter((l) => l.status === 'sold' && l.deliveryStatus === 'preparing')
      .forEach((l) => {
        ensureShippingTaskForListing(l);
      });
  });
}
backfillShippingTasksOnInit();

/* ----------------------------------------------------------------------
 * BANANA BAY 落札 API 同期シミュレータ
 *  - 出品中(listed)の listing からランダムに 1〜3 件を落札済みに変換
 *  - API レスポンス相当の発送先情報を生成して markListingAsSold に渡す
 *  - 副作用：出荷業務タスクが自動生成される
 * --------------------------------------------------------------------*/

// API レスポンスを模倣する買い手プール（実在しない架空のデータ）
const FAKE_BUYERS = [
  { name: '山本 浩司',   address: '東京都港区赤坂9-7-1',           phone: '03-3479-2400' },
  { name: '中村 美咲',   address: '神奈川県川崎市中原区小杉町1-403', phone: '044-722-1156' },
  { name: '小林 達也',   address: '埼玉県さいたま市大宮区桜木町1-7-5',phone: '048-642-3300' },
  { name: '伊藤 由紀子', address: '千葉県千葉市美浜区中瀬1-3',       phone: '043-298-2611' },
  { name: '加藤 健一',   address: '愛知県名古屋市中区栄3-29-1',     phone: '052-262-3110' },
  { name: '吉田 真由美', address: '京都府京都市下京区烏丸通塩小路下る東塩小路町901', phone: '075-365-0001' },
  { name: '森田 拓海',   address: '兵庫県神戸市中央区東川崎町1-3-3', phone: '078-360-3499' },
  { name: '清水 友香',   address: '広島県広島市中区基町10-44',       phone: '082-228-7300' },
  { name: '橋本 翔',     address: '宮城県仙台市青葉区中央3-7-1',     phone: '022-722-2400' },
  { name: '岡田 麻里',   address: '北海道札幌市中央区北5条西2-5',    phone: '011-209-5101' },
];

export interface BananaBayApiSyncResult {
  count: number;
  newSales: BananaBayListing[];
}

/**
 * BANANA BAY 落札 API 同期（シミュレーション）。
 * @param maxCount 取り込む最大件数（既定: 2 件）
 * @returns 取り込んだ件数と更新された listing 一覧
 *
 * 実際の運用では BANANA BAY API から落札通知 + 配送先情報を取得し、
 * markListingAsSold に渡すフローを想定。本シミュレーションは listed の
 * 出品からランダムに 1〜maxCount 件を選び、FAKE_BUYERS から発送先を
 * 割り当てる。
 */
export function simulateBananaBayApiSync(maxCount: number = 2): BananaBayApiSyncResult {
  const candidates = listings.filter((l) => l.status === 'listed');
  if (candidates.length === 0) {
    return { count: 0, newSales: [] };
  }

  const targetCount = Math.min(
    candidates.length,
    Math.max(1, Math.floor(Math.random() * maxCount) + 1),
  );

  // 重複なく選ぶ
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, targetCount);

  const newSales: BananaBayListing[] = [];
  picked.forEach((l, idx) => {
    const buyer = FAKE_BUYERS[Math.floor(Math.random() * FAKE_BUYERS.length)];
    const orderId = `BB-ORD-${Date.now().toString().slice(-7)}-${idx + 1}`;
    // 配達希望日 = 3 営業日後想定
    const eta = new Date();
    eta.setDate(eta.getDate() + 3);
    const estimatedDeliveryDate = eta.toISOString().slice(0, 10);

    markListingAsSold(l.id, {
      buyerName: buyer.name,
      recipientName: buyer.name,
      shippingAddress: buyer.address,
      recipientPhone: buyer.phone,
      orderId,
      estimatedDeliveryDate,
    });
    const after = listings.find((x) => x.id === l.id);
    if (after) newSales.push(after);
  });

  return { count: newSales.length, newSales };
}
