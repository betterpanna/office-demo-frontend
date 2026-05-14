/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'admin' | 'worker' | 'collector';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  base: string;
  branchId?: string;
  positionId?: string;
  avatar?: string;
}

// Master Data Types
export interface BranchMaster {
  id: string;
  name: string;
  address: string;
  phone: string;
  managerId: string;
  email?: string;
  businessHours?: string;
  notes?: string;
}

export interface EmployeeMaster {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  base: string;
  joinDate: string;
  status: 'active' | 'inactive' | 'on_leave';
  phone?: string;
  address?: string;
  emergencyContact?: string;
}

export interface PositionMaster {
  id: string;
  name: string;
  level: number;
}

export interface ShelfMaster {
  id: string;
  branchId: string;
  code: string;
  category?: string;
}

export interface CategoryMaster {
  id: string;
  name: string;
  parentCategoryId?: string;
}

export interface QualityRankMaster {
  id: string;
  rank: QualityRank;
  description: string;
}

export interface EvaluationMaster {
  id: string;
  name: string;
  score: number;
  description: string;
}

// Sales Management Types
export interface Quote {
  id: string;
  quoteNumber: string;
  customerId: string;
  customerName: string;
  items: Array<{
    inventoryId: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  totalAmount: number;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  quoteId?: string;
  customerId: string;
  customerName: string;
  items: Array<{
    inventoryId: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  totalAmount: number;
  status: 'pending' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  orderId: string;
  customerId: string;
  customerName: string;
  amount: number;
  dueDate: string;
  status: 'unpaid' | 'paid' | 'overdue';
  createdAt: string;
}

export type InventoryStatus = 
  | 'pending_collection' // 回収待ち
  | 'collected'          // 回収完了
  | 'received'           // 受領済 (拠点到着)
  | 'unregistered'       // 未登録
  | 'pending_sorting'    // 分別待ち
  | 'sorted'             // 分別完了
  | 'pending_productization' // 商品化待ち
  | 'in_production'      // 商品化中
  | 'completed'          // 商品化完了 (検品清掃後)
  | 'in_stock'           // 在庫あり
  | 'listing'            // 出品中 (BANANA BAY連携)
  | 'listed'             // 出品完了
  | 'sold'               // 売却済み
  | 'returned';          // 返品

export type QualityRank = 'S' | 'A' | 'B' | 'C' | 'Mint';

export type BananaBayStatus = 'not_listed' | 'listing' | 'listed' | 'sold' | 'error' | 'returned' | 'shipping';

export interface InventoryItem {
  id: string;
  managementNumber: string; // 管理番号 (QR/Barcode)
  partNumber?: string; // 部品番号
  shelfCode?: string; // 棚割りコード
  name: string;
  status: InventoryStatus;
  bananaBayStatus?: BananaBayStatus; // BANANA BAY 出品状況
  rank?: QualityRank;
  carModel?: string; // 車種
  carYear?: string; // 年式
  category: string;
  location?: string; // 保管棚番号
  baseName?: string; // 拠点名
  arrivalDate: string;
  sortingCategory?: 'recycle' | 'reuse' | 'rebuilt'; // 分別カテゴリ (資源/商品化/リビルド)
  statusChangedAt?: string; // ステータス変更日時
  productionDate?: string;
  listedDate?: string;
  soldDate?: string;
  price?: number;
  newPrice?: number; // 新品価格
  shippingFee?: number; // 販売時送料
  
  // Recycling/Rebuild tracking
  recycleWeight?: number; // 資源重量 (kg)
  recycleQuantity?: number; // 資源数量
  materialType?: string; // 金属種類など
  rebuildBatchId?: string; // リビルド引渡用バッチID
  
  // Stay Days Tracking (Computed visually, but stored for reference)
  stayDays?: number;
  
  // Cost Estimation Fields
  purchaseAmount?: number; // 買取明細 (原価1)
  collectionShippingFee?: number; // 回収送料 (原価2)
  laborEvaluationAmount?: number; // 作業評価額 (原価3)
  
  assignedWorkerId?: string;
  notes?: string;
  images?: string[];
  
  // New fields from OCR
  partCategory?: string;
  seller?: string;
  carMaker?: string;
  partMaker?: string;
  country?: string;
  deliveryCategory?: string;
  nowOnSale?: number;
  isInStock?: number;
  isDiscontinued?: number;
  mileage?: string;
  newArrivalAt?: string;
  productType?: string;
  partName?: string;
  repairPartsCategory?: string;
  condition?: string;
  carName?: string;
  carModelNumber?: string;
  vinNumber?: string;
  color?: string;
  aliasType?: string;
  engineType?: string;
  engineSpecification?: string;
  size?: string;
  pitchSize?: string;
  originalId?: string;
  cleaningDone?: boolean;
  inspected?: boolean;

  // Linkage back to the source 回収案件 / 品目 — enables cost basis derivation
  sourceCollectionId?: string;
  sourceCollectionItemId?: string;
}

export interface Sale {
  id: string;
  inventoryId: string;
  managementNumber: string;
  itemName: string;
  saleDate: string;
  salePrice: number;
  salePlatform: 'banana_bay' | 'other';
  purchaseAmount: number;
  collectionShippingFee: number;
  laborEvaluationAmount: number;
  grossProfit: number;
}

/** 配送業者 */
export type ShippingCarrier = 'yamato' | 'sagawa' | 'jp_post' | 'other';

/** 配達ステータス（出荷管理セクション内のサブステータス） */
export type DeliveryStatus = 'preparing' | 'shipped' | 'in_transit' | 'delivered' | 'undeliverable';

export interface BananaBayListing {
  id: string;
  inventoryId: string;
  managementNumber: string;
  itemName: string;
  price: number;
  status: BananaBayStatus;
  listingDate: string;
  updateDate: string;
  errorNote?: string;
  shippingNoticeSent: boolean;
  paymentConfirmed: boolean;
  orderId?: string;
  buyerName?: string;
  returnRequested?: boolean;
  returnReason?: string;
  /* ---- 出荷管理フィールド ---- */
  /** 配送業者（'yamato' / 'sagawa' / 'jp_post' / 'other'） */
  shippingCarrier?: ShippingCarrier;
  /** 追跡番号（業者によって桁数フォーマットが異なる） */
  trackingNumber?: string;
  /** 発送日 (YYYY-MM-DD) */
  shippedDate?: string;
  /** 配達予定日 (YYYY-MM-DD) */
  estimatedDeliveryDate?: string;
  /** 配達完了日 (YYYY-MM-DD) */
  deliveredDate?: string;
  /** 配送先住所 */
  shippingAddress?: string;
  /** 受取人名（buyerName と異なる場合に使用） */
  recipientName?: string;
  /** 配送先電話番号 */
  recipientPhone?: string;
  /** 配達ステータス（出荷管理タブ用） */
  deliveryStatus?: DeliveryStatus;
  /** 配送メモ・特記事項 */
  shippingNotes?: string;
}

export interface MonthlySales {
  month: string; // YYYY-MM
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  itemsSoldCount: number;
}

export type TaskType = 'cleaning' | 'inspection' | 'photography' | 'packing' | 'shipping' | 'repair' | 'dismantling' | 'sorting' | 'collection' | 'productization';
/**
 * タスクのステータス遷移:
 *   pending(プール) → assigned(割当済) → in_progress(作業中) → completed(完了)
 */
export type TaskStatus = 'pending' | 'assigned' | 'in_progress' | 'completed';
export type TaskPriority = 'high' | 'medium' | 'low';

export interface TaskMaster {
  id: string;
  name: string;
  type: TaskType;
  description: string;
  estimatedTime: number; // minutes
  basePrice?: number; // 標準単価
}

export interface Task {
  id: string;
  taskMasterId: string;
  status: TaskStatus;
  priority: TaskPriority;
  targetType: 'inventory' | 'collection' | 'custom';
  /** inventoryId / collectionItemId / 自由タスクの場合は "free-..." の合成ID */
  targetId: string;
  targetName: string;
  assigneeId?: string;
  quantity: number;
  scheduledDate: string;
  /** 予定開始時刻 (HH:mm) — スケジュールボードでドロップされた時刻 */
  scheduledStartTime?: string;
  /** 予定終了時刻 (HH:mm) — start + durationMinutes */
  scheduledEndTime?: string;
  /** 作業マスターの estimatedTime から算出した所要分 */
  durationMinutes?: number;
  /** 作業指示が従業員側へ送出されたかどうか */
  dispatched?: boolean;
  dispatchedAt?: string;
  completedDate?: string;
  notes?: string;
}

export interface Attendance {
  id: string;
  userId: string;
  userName?: string;
  date: string;
  clockIn?: string;
  clockOut?: string;
  breakMinutes?: number;
  workingMinutes?: number;
  status: 'working' | 'break' | 'finished' | 'present' | 'late' | 'early_leave' | 'absent' | 'holiday';
  note?: string;
}

export interface Shift {
  id: string;
  userId: string;
  userName: string;
  date: string;
  startTime: string;
  endTime: string;
  shiftType: 'regular' | 'morning' | 'night' | 'part_time';
}

export interface SalaryReport {
  userId: string;
  userName: string;
  periodStart: string; // YYYY-MM-21
  periodEnd: string;   // YYYY-MM-20
  totalWorkingDays: number;
  totalWorkingHours: number;
  totalOvertimeHours: number;
  totalNightHours: number;
  baseSalary: number;
  allowances: number;
  totalSalary: number;
}

export interface Evaluation {
  id: string;
  userId: string;
  date: string;
  amount: number; // 評価額
  taskCount: number;
  qualityScore: number; // ミス率などに基づくスコア
}

export interface BaseKPI {
  baseName: string;
  operatingRate: number;
  taskEfficiency: number;
  inventoryTurnover: number;
  unregisteredRate: number;
  errorRate: number;
  salesContribution: number;
}

export type CollectionStatus = 'pending' | 'received' | 'completed' | 'cancelled';

/**
 * 取引先マスタ — 引取送料あり/なしを永続化。
 * 新規回収登録時に customerId を選択すると customerName / customerAddress / shippingFeeApplicable
 * が自動でコピーされる。
 */
export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  /** 引取送料あり = true (買取金額から送料を差し引かない or 別途請求) / なし = false (回収無料) */
  shippingFeeApplicable: boolean;
  /** 標準の送料（円）。shippingFeeApplicable=false の場合は使用しない */
  defaultShippingFee?: number;
  notes?: string;
  /** 月次買取明細書送付の連絡先（email と同じなら省略） */
  billingContactName?: string;
}

/**
 * 回収品目を分別作業中に分解（資源/リユース/リビルド）した結果の子レコード。
 * 1 つの CollectionItem に対して N 個 breakdown が作られる。
 * - 資源 (recycle): 在庫化されず、重量のみ記録
 * - リユース (reuse) / リビルド (rebuilt): 在庫レコードを作成、allocatedPurchaseAmount を原価1とする
 */
export interface CollectionItemBreakdown {
  id: string;
  /** 親 CollectionItem.id */
  parentItemId: string;
  /** 分解後の部品名 (例: ピストン, クランクシャフト) */
  name: string;
  /** 分別区分 */
  category: 'recycle' | 'reuse' | 'rebuilt';
  /** 分解後の数量（在庫品の個数） */
  quantity: number;
  /** 分解後の重量（kg） */
  weight?: number;
  /** 親 finalPrice から手動で配分した買取金額（合計） */
  allocatedPurchaseAmount: number;
  /** リユース/リビルドの場合に作成された在庫レコード ID */
  inventoryItemId?: string;
  /** 棚コード（在庫化時に使用） */
  shelfCode?: string;
  notes?: string;
}

export interface CollectionItem {
  id: string;
  partNumber?: string; // 部品番号
  name: string;
  category: string;
  quantity: number;
  weight?: number; // 重量 (kg)
  vinNumber?: string; // 車体番号
  estimatedPrice?: number;
  finalPrice?: number;
  newPrice?: number; // 新品価格
  shippingFee?: number; // 送料
  collectionType: 'free' | 'paid'; // 回収区分 (無料/有料)
  sortingCategory?: 'recycle' | 'reuse' | 'rebuilt'; // 分別カテゴリ（親レベル — 単一分解時の便宜用）
  /** 分解結果（1→N）。empty ならまだ未分解 */
  breakdowns?: CollectionItemBreakdown[];
  carModel?: string; // 車種
  carYear?: string; // 年式
  carMaker?: string; // メーカー
  carName?: string; // 車種名
  carModelNumber?: string; // 型式・型番
  partCategory?: string; // パーツカテゴリ
  mileage?: string; // 走行距離
  engineType?: string; // エンジン型式
  color?: string; // カラー
  condition: string;
  notes?: string; // 備考
  images?: string[]; // 添付画像
}

/**
 * 電子受領書（Electronic Receipt）。
 * 回収員が現場で発行 → ストア経由で管理者画面 (CollectionManagement) で確認できる。
 */
export interface CollectionReceipt {
  id: string;
  collectionId: string;
  collectionNumber: string;
  customerName: string;
  customerAddress?: string;
  collectorId?: string;
  collectorName?: string;
  branchName?: string;
  issuedAt: string; // ISO datetime
  signatureData?: string; // 'signed' or dataURL
  signatureName?: string; // 顧客側署名者氏名
  itemsSnapshot: Array<{
    id: string;
    name: string;
    category?: string;
    quantity: number;
    weight?: number;
    notes?: string;
  }>;
  totalQuantity: number;
  totalWeight: number;
  photoUrls: string[];
  notes?: string;
}

export interface Collection {
  id: string;
  collectionNumber: string; // 回収番号
  /** 取引先マスタへのリンク。customerName 等のスナップショットは履歴として保持 */
  customerId?: string;
  customerName: string;
  customerAddress?: string;
  customerPhone?: string;
  customerEmail?: string; // 月次買取明細書のメール送付先
  /** この案件の引取送料あり/なし。customerId 選択時はマスタからコピー、変更可能 */
  shippingFeeApplicable?: boolean;
  /** 引取送料額（円）。shippingFeeApplicable=true の場合のみ意味を持つ */
  shippingFeeAmount?: number;
  latitude?: number;
  longitude?: number;
  status: CollectionStatus;
  items: CollectionItem[];
  collectionDate: string;
  totalAmount?: number;
  notes?: string;
  receiptIssued: boolean;
  purchaseDetailIssued: boolean;
  purchaseDetailSentAt?: string; // 買取明細書メール送付日時
  assignedCollectorId?: string;
}
