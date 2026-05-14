/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const STATUS_LABELS: Record<string, string> = {
  pending_collection: '回収前',
  collected: '回収完了',
  received: '受領済 (Received)',
  pending_sorting: '分別待ち (Pending Sorting)',
  sorted: '分別完了',
  in_production: '商品化中',
  completed: '商品化完了',
  unregistered: '未登録（情報不足）',
  listing: '出品中',
  listed: '出品完了',
  sold: '売上完了',
  returned: '返品',
  pending_productization: '商品化待ち',
};

export const QUALITY_RANK_LABELS: Record<string, string> = {
  S: '新品同様',
  A: 'ランクA',
  B: 'ランクB',
  C: 'ランクC',
};

export const BANANA_BAY_STATUS_LABELS: Record<string, string> = {
  not_listed: '未出品',
  listing: '出品中...',
  listed: '出品済み',
  sold: '売却済み',
  error: 'エラー',
  returned: '返品',
};

// スライド25に基づく工程別評価単価
export const EVALUATION_PROCESS_PRICES: Record<string, number> = {
  cleaning: 300,
  inspection: 500,
  photography: 400,
  packing: 300,
  shipping: 200,
};

// スライド25に基づく部品カテゴリ別評価単価
export const EVALUATION_PART_PRICES: Record<string, number> = {
  'エンジン（大型）': 3000,
  'トランスミッション': 2200,
  'ドア・外装パネル': 1000,
  'ヘッドライト・小物': 300,
};

export const TASK_TYPE_LABELS: Record<string, string> = {
  cleaning: '清掃',
  inspection: '検品',
  photography: '写真撮影',
  packing: '梱包',
  shipping: '出荷',
  sorting: '分別作業（3分類）',
};

export const PRIORITY_LABELS: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

export const SORTING_CATEGORIES = [
  { id: 'recycle', label: 'リサイクル品', desc: '資源→リサイクル業者売却→売上' },
  { id: 'reuse', label: 'リユース品', desc: '商品化→再販' },
  { id: 'rebuilt', label: 'リビルト品', desc: '再生コア→リビルド企業へ再販→売上' },
];

export const CATEGORIES = [
  'エンジン',
  'トランスミッション',
  'ドア・外装パネル',
  'ヘッドライト・小物',
  '足回り',
  '電装品',
];

export const BASES = [
  '大阪支店',
  '和歌山支店',
  '滋賀支店',
];

// マスタデータの定義終了
