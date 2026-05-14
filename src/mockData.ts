import {
  InventoryItem,
  Task,
  Attendance,
  User,
  Collection,
  CollectionItem,
  TaskMaster,
  BranchMaster,
  PositionMaster,
  ShelfMaster,
  CategoryMaster,
  QualityRankMaster,
  EvaluationMaster,
  Quote,
  Order,
  Invoice,
  Shift,
  SalaryReport,
  MonthlySales,
  Sale,
  BananaBayListing,
  InventoryStatus,
  BananaBayStatus,
  TaskStatus,
  Customer,
  ShippingCarrier,
  DeliveryStatus,
} from './types';
import { addDays, format, subDays, subMonths } from 'date-fns';

// ============================================================
// Time helpers — anchor everything to "today" so data stays fresh
// ============================================================
const TODAY = new Date();
const fmtDate = (d: Date) => format(d, 'yyyy-MM-dd');
const fmtDateTime = (d: Date) => format(d, 'yyyy-MM-dd HH:mm:ss');
const daysAgo = (n: number) => subDays(TODAY, n);
const dateAgo = (n: number) => fmtDate(daysAgo(n));
const dateTimeAgo = (n: number, hour = 10, minute = 30) =>
  fmtDateTime(new Date(daysAgo(n).setHours(hour, minute, 0, 0)));

// ============================================================
// Master data: bases, users, categories
// ============================================================
const BASE_NAMES = ['大阪支店', '和歌山支店', '滋賀支店'] as const;
const CATEGORIES = ['エンジン', 'トランスミッション', '外装', '電装', '内装'];

export const MOCK_USERS: User[] = [
  { id: 'u1', name: '管理者 太郎', email: 'admin@example.com', role: 'admin', base: '大阪支店' },
  { id: 'u2', name: '作業員 一郎', email: 'worker1@example.com', role: 'worker',    base: '大阪支店',   avatar: 'https://i.pravatar.cc/150?u=u2' },
  { id: 'u3', name: '作業員 二郎', email: 'worker2@example.com', role: 'worker',    base: '大阪支店',   avatar: 'https://i.pravatar.cc/150?u=u3' },
  { id: 'u4', name: '回収員 三郎', email: 'collector1@example.com', role: 'collector', base: '大阪支店',   avatar: 'https://i.pravatar.cc/150?u=u4' },
  { id: 'u5', name: '作業員 四郎', email: 'worker3@example.com', role: 'worker',    base: '和歌山支店', avatar: 'https://i.pravatar.cc/150?u=u5' },
  { id: 'u6', name: '回収員 五郎', email: 'collector2@example.com', role: 'collector', base: '和歌山支店', avatar: 'https://i.pravatar.cc/150?u=u6' },
  { id: 'u7', name: '作業員 六郎', email: 'worker4@example.com', role: 'worker',    base: '滋賀支店',   avatar: 'https://i.pravatar.cc/150?u=u7' },
  { id: 'u8', name: '回収員 七郎', email: 'collector3@example.com', role: 'collector', base: '滋賀支店',   avatar: 'https://i.pravatar.cc/150?u=u8' },
  // 動作確認用：実在ユーザー
  { id: 'u9', name: '小田 ヘルレン', email: 'herlen0976@banana-official.com', role: 'worker', base: '大阪支店', avatar: 'https://i.pravatar.cc/150?u=u9' },
];

const BASE_TEAMS: Record<string, { workers: string[]; collectors: string[] }> = {
  '大阪支店':   { workers: ['u2', 'u3', 'u9'], collectors: ['u4'] },
  '和歌山支店': { workers: ['u5'], collectors: ['u6'] },
  '滋賀支店':   { workers: ['u7'], collectors: ['u8'] },
};

export const MOCK_BRANCHES: BranchMaster[] = [
  { id: 'b1', name: '大阪支店',   address: '〒567-0865 大阪府茨木市横江1-17-6', phone: '072-655-0001', managerId: 'u1', email: 'osaka@example.com',     businessHours: '平日 9:00-18:00' },
  { id: 'b2', name: '和歌山支店', address: '和歌山県海南市舟尾378-1',           phone: '073-484-0002', managerId: 'u1', email: 'wakayama@example.com', businessHours: '平日 9:00-18:00' },
  { id: 'b3', name: '滋賀支店',   address: '滋賀県（編集してください）',          phone: '077-000-0003', managerId: 'u1', email: 'shiga@example.com',    businessHours: '平日 9:00-18:00' },
];

// ============================================================
// Customer pool — realistic Japanese auto industry customers
// Each customer carries the base name in address so the
// CollectionManagement filter `address.includes(base)` works.
// ============================================================
type CustomerSeed = {
  name: string;
  address: string;
  phone: string;
  lat: number;
  lng: number;
  /** 引取送料あり=true / なし=false */
  shippingFeeApplicable: boolean;
  /** デフォルト引取送料（円）。shippingFeeApplicable=true のときだけ意味あり */
  defaultShippingFee?: number;
  email?: string;
};

// 業務フロー PDF より:
// 引取送料なし: OTG, ネッツトヨタ福井, 石川トヨペットカローラ, 京都トヨペット, ネッツゾナ神戸, 栃木トヨペット, ウイルプラスモトーレン, シュテルン, 大阪トヨタ
// 引取送料あり: ネッツトヨタ大阪, ニューリー北大阪, フォーシーズンズ, 和歌山トヨタ
const CUSTOMERS_BY_BASE: Record<string, CustomerSeed[]> = {
  '大阪支店': [
    { name: '株式会社北摂自動車整備',     address: '大阪府茨木市西中条町1-15（大阪支店管轄）',          phone: '072-622-2210', lat: 34.8159, lng: 135.5687, shippingFeeApplicable: false,                            email: 'reception@hokusetsu-auto.co.jp' },
    { name: '大阪トヨタ自動車（株）',      address: '大阪府吹田市豊津町12-1（大阪支店管轄）',             phone: '06-6190-2200', lat: 34.7651, lng: 135.5174, shippingFeeApplicable: false,                            email: 'parts@osakatoyota.co.jp' },
    { name: 'ネッツトヨタ大阪（株）',      address: '大阪府東大阪市御厨南1-1-22（大阪支店管轄）',          phone: '06-6789-3411', lat: 34.6680, lng: 135.5763, shippingFeeApplicable: true,  defaultShippingFee: 3500, email: 'parts@nz-osaka.co.jp' },
    { name: 'ニューリー北大阪（株）',      address: '大阪府摂津市鳥飼上3-12-7（大阪支店管轄）',           phone: '072-654-3300', lat: 34.7714, lng: 135.5710, shippingFeeApplicable: true,  defaultShippingFee: 3000, email: 'k.parts@newly.co.jp' },
    { name: '京都トヨペット（株）大阪営業所', address: '大阪府高槻市八丁畷町2-4-12（大阪支店管轄）',       phone: '072-672-1408', lat: 34.8500, lng: 135.6173, shippingFeeApplicable: false,                            email: 'osaka@kyoto-toyopet.co.jp' },
  ],
  '和歌山支店': [
    { name: '和歌山トヨタ自動車（株）',     address: '和歌山県和歌山市湊1-5-22（和歌山支店管轄）',         phone: '073-432-7220', lat: 34.2304, lng: 135.1655, shippingFeeApplicable: true,  defaultShippingFee: 4500, email: 'parts@wakayama-toyota.co.jp' },
    { name: 'フォーシーズンズ（株）有田営業所', address: '和歌山県有田市箕島220-3（和歌山支店管轄）',       phone: '0737-82-5050', lat: 34.0826, lng: 135.1271, shippingFeeApplicable: true,  defaultShippingFee: 3800, email: 'arida@4seasons.co.jp' },
    { name: '紀北自動車解体センター',      address: '和歌山県橋本市岸上401-2（和歌山支店管轄）',          phone: '0736-32-1190', lat: 34.3145, lng: 135.6042, shippingFeeApplicable: false,                            email: 'recycle@kihoku-auto.jp' },
    { name: 'OTG株式会社 海南支店',       address: '和歌山県海南市船尾295（和歌山支店管轄）',             phone: '073-484-1212', lat: 34.1545, lng: 135.2099, shippingFeeApplicable: false,                            email: 'kainan@otg.co.jp' },
  ],
  '滋賀支店': [
    { name: 'ネッツトヨタ福井（株）大津営業所', address: '滋賀県大津市馬場3-1-15（滋賀支店管轄）',        phone: '077-525-0303', lat: 35.0044, lng: 135.8626, shippingFeeApplicable: false,                            email: 'parts@nz-fukui.co.jp' },
    { name: '石川トヨペットカローラ（株）',  address: '滋賀県草津市矢橋町1444（滋賀支店管轄）',           phone: '077-562-2100', lat: 35.0231, lng: 135.9619, shippingFeeApplicable: false,                            email: 'parts@ishikawa-toyopet.co.jp' },
    { name: 'シュテルン滋賀（株）',        address: '滋賀県彦根市鳥居本町2480-1（滋賀支店管轄）',          phone: '0749-22-9912', lat: 35.2840, lng: 136.2716, shippingFeeApplicable: false,                            email: 'shiga@stern-mb.co.jp' },
    { name: 'ウイルプラスモトーレン（株）守山店', address: '滋賀県守山市古高町180-2（滋賀支店管轄）',     phone: '077-583-7766', lat: 35.0498, lng: 135.9905, shippingFeeApplicable: false,                            email: 'moriyama@willplus.co.jp' },
  ],
};

// ============================================================
// Part templates — realistic Japanese auto parts per category
// ============================================================
type PartTemplate = {
  category: string;
  name: string;
  carMaker: string;
  carName: string;
  carYear: string;
  carModelNumber: string;
  partNumberPrefix: string;
  rank: 'S' | 'A' | 'B' | 'C';
  newPrice: number;       // 新品価格
  basePurchase: number;   // 原価1（買取）
  baseShipping: number;   // 原価2（回収送料）
  baseLabor: number;      // 原価3（作業評価額）
  basePrice: number;      // 販売予定価格
  image: string;
  partType: string;
  mileage?: string;
};

const PARTS: PartTemplate[] = [
  // エンジン
  {
    category: 'エンジン', name: '1NZ-FXE エンジンAssy', carMaker: 'トヨタ', carName: 'プリウス', carYear: '2015',
    carModelNumber: 'ZVW30', partNumberPrefix: 'ENG-1NZ', rank: 'A', newPrice: 280000, basePurchase: 35000,
    baseShipping: 4000, baseLabor: 6500, basePrice: 88000,
    image: 'https://images.unsplash.com/photo-1597734833215-6ac32422776c?q=80&w=600&h=450&fit=crop',
    partType: 'engine_assy', mileage: '78,400',
  },
  {
    category: 'エンジン', name: 'L15B エンジンAssy', carMaker: 'ホンダ', carName: 'フィット', carYear: '2017',
    carModelNumber: 'GK3', partNumberPrefix: 'ENG-L15B', rank: 'B', newPrice: 240000, basePurchase: 28000,
    baseShipping: 3500, baseLabor: 5500, basePrice: 72000,
    image: 'https://images.unsplash.com/photo-1486006396193-471068589dca?q=80&w=600&h=450&fit=crop',
    partType: 'engine_assy', mileage: '102,000',
  },
  {
    category: 'エンジン', name: 'MR20DE エンジンAssy', carMaker: '日産', carName: 'セレナ', carYear: '2014',
    carModelNumber: 'C26', partNumberPrefix: 'ENG-MR20', rank: 'A', newPrice: 320000, basePurchase: 42000,
    baseShipping: 4500, baseLabor: 7000, basePrice: 98000,
    image: 'https://images.unsplash.com/photo-1597734833215-6ac32422776c?q=80&w=600&h=450&fit=crop',
    partType: 'engine_assy', mileage: '92,500',
  },
  // トランスミッション
  {
    category: 'トランスミッション', name: 'CVT トランスミッションAssy', carMaker: 'ホンダ', carName: 'フィット', carYear: '2018',
    carModelNumber: 'GK3', partNumberPrefix: 'TRM-CVT', rank: 'A', newPrice: 220000, basePurchase: 32000,
    baseShipping: 3500, baseLabor: 5000, basePrice: 75000,
    image: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?q=80&w=600&h=450&fit=crop',
    partType: 'transmission', mileage: '64,200',
  },
  {
    category: 'トランスミッション', name: 'CVT トランスミッションAssy', carMaker: 'トヨタ', carName: 'アクア', carYear: '2016',
    carModelNumber: 'NHP10', partNumberPrefix: 'TRM-K310', rank: 'B', newPrice: 180000, basePurchase: 24000,
    baseShipping: 3200, baseLabor: 4500, basePrice: 58000,
    image: 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?q=80&w=600&h=450&fit=crop',
    partType: 'transmission', mileage: '85,000',
  },
  // 外装
  {
    category: '外装', name: 'フロントバンパー', carMaker: 'トヨタ', carName: 'プリウス', carYear: '2017',
    carModelNumber: 'ZVW50', partNumberPrefix: 'EXT-FBP', rank: 'A', newPrice: 58000, basePurchase: 6000,
    baseShipping: 1800, baseLabor: 2500, basePrice: 19500,
    image: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=600&h=450&fit=crop',
    partType: 'exterior',
  },
  {
    category: '外装', name: 'リアドア（左）', carMaker: 'ダイハツ', carName: 'タント', carYear: '2019',
    carModelNumber: 'LA600S', partNumberPrefix: 'EXT-RDL', rank: 'B', newPrice: 72000, basePurchase: 7500,
    baseShipping: 2000, baseLabor: 2800, basePrice: 22500,
    image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=600&h=450&fit=crop',
    partType: 'exterior',
  },
  {
    category: '外装', name: 'ボンネット', carMaker: '日産', carName: 'セレナ', carYear: '2018',
    carModelNumber: 'C27', partNumberPrefix: 'EXT-BNT', rank: 'C', newPrice: 65000, basePurchase: 5500,
    baseShipping: 2200, baseLabor: 2300, basePrice: 16800,
    image: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=600&h=450&fit=crop',
    partType: 'exterior',
  },
  // 電装
  {
    category: '電装', name: 'ヘッドライトAssy（左）', carMaker: 'ホンダ', carName: 'ステップワゴン', carYear: '2018',
    carModelNumber: 'RP3', partNumberPrefix: 'ELE-HLL', rank: 'A', newPrice: 86000, basePurchase: 9500,
    baseShipping: 1500, baseLabor: 2200, basePrice: 28500,
    image: 'https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?q=80&w=600&h=450&fit=crop',
    partType: 'electrical',
  },
  {
    category: '電装', name: 'オルタネーター', carMaker: 'トヨタ', carName: 'プリウス', carYear: '2014',
    carModelNumber: 'ZVW30', partNumberPrefix: 'ELE-ALT', rank: 'B', newPrice: 42000, basePurchase: 4500,
    baseShipping: 1200, baseLabor: 1800, basePrice: 13500,
    image: 'https://images.unsplash.com/photo-1555854816-808ca484f930?q=80&w=600&h=450&fit=crop',
    partType: 'electrical',
  },
  {
    category: '電装', name: 'ECU（エンジン制御）', carMaker: '日産', carName: 'セレナ', carYear: '2016',
    carModelNumber: 'C26', partNumberPrefix: 'ELE-ECU', rank: 'A', newPrice: 95000, basePurchase: 12000,
    baseShipping: 1000, baseLabor: 2000, basePrice: 32000,
    image: 'https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?q=80&w=600&h=450&fit=crop',
    partType: 'electrical',
  },
  // 内装
  {
    category: '内装', name: '運転席シート', carMaker: 'ダイハツ', carName: 'タント', carYear: '2018',
    carModelNumber: 'LA600S', partNumberPrefix: 'INT-DST', rank: 'B', newPrice: 48000, basePurchase: 4500,
    baseShipping: 1800, baseLabor: 2000, basePrice: 14800,
    image: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?q=80&w=600&h=450&fit=crop',
    partType: 'interior',
  },
  {
    category: '内装', name: 'カーナビゲーションシステム', carMaker: 'トヨタ', carName: 'アクア', carYear: '2017',
    carModelNumber: 'NHP10', partNumberPrefix: 'INT-NAV', rank: 'A', newPrice: 86000, basePurchase: 10500,
    baseShipping: 1000, baseLabor: 1800, basePrice: 26500,
    image: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?q=80&w=600&h=450&fit=crop',
    partType: 'interior',
  },
];

// ============================================================
// Lifecycle plan — realistic funnel distribution per base
// Each entry tells the generator: status, how many days ago
// the status changed, and which sortingCategory to assign.
// ============================================================
type LifecycleStage = {
  status: InventoryStatus;
  bananaBayStatus: BananaBayStatus;
  daysAtStage: number; // how long the item has been in this status
  arrivalDaysAgo: number;
  soldDaysAgo?: number; // only for sold/returned
  productionDaysAgo?: number;
  listedDaysAgo?: number;
  sortingCategory?: 'recycle' | 'reuse' | 'rebuilt';
  hasReceipt: boolean; // whether a receipt was issued at collection
};

// Per base, define the items we want by lifecycle stage.
// 21 items per base × 3 = 63 items, with realistic stage distribution.
const STAGE_PLAN: LifecycleStage[] = [
  // 回収フェーズ — まだ拠点に届いていない
  { status: 'pending_collection', bananaBayStatus: 'not_listed', daysAtStage: 0, arrivalDaysAgo: 0, sortingCategory: 'reuse', hasReceipt: false },
  { status: 'collected',          bananaBayStatus: 'not_listed', daysAtStage: 1, arrivalDaysAgo: 0, sortingCategory: 'reuse', hasReceipt: true  },

  // 受領・登録フェーズ — 拠点到着後、未登録/分別待ち
  { status: 'received',           bananaBayStatus: 'not_listed', daysAtStage: 1, arrivalDaysAgo: 1, sortingCategory: 'reuse', hasReceipt: true  },
  { status: 'unregistered',       bananaBayStatus: 'not_listed', daysAtStage: 6, arrivalDaysAgo: 6, sortingCategory: 'reuse', hasReceipt: true  }, // 滞留アラート
  { status: 'pending_sorting',    bananaBayStatus: 'not_listed', daysAtStage: 2, arrivalDaysAgo: 2, sortingCategory: 'reuse', hasReceipt: true  },
  { status: 'pending_sorting',    bananaBayStatus: 'not_listed', daysAtStage: 5, arrivalDaysAgo: 5, sortingCategory: 'recycle', hasReceipt: true }, // 滞留アラート

  // 商品化フェーズ
  { status: 'sorted',             bananaBayStatus: 'not_listed', daysAtStage: 1, arrivalDaysAgo: 4, sortingCategory: 'reuse', hasReceipt: true  },
  { status: 'pending_productization', bananaBayStatus: 'not_listed', daysAtStage: 2, arrivalDaysAgo: 6, sortingCategory: 'reuse', hasReceipt: true },
  { status: 'in_production',      bananaBayStatus: 'not_listed', daysAtStage: 1, arrivalDaysAgo: 5, sortingCategory: 'reuse', hasReceipt: true  },
  { status: 'in_production',      bananaBayStatus: 'not_listed', daysAtStage: 2, arrivalDaysAgo: 7, sortingCategory: 'rebuilt', hasReceipt: true},
  { status: 'completed',          bananaBayStatus: 'not_listed', daysAtStage: 1, arrivalDaysAgo: 8, sortingCategory: 'reuse', hasReceipt: true  },

  // 在庫・出品フェーズ
  { status: 'in_stock',           bananaBayStatus: 'not_listed', daysAtStage: 3, arrivalDaysAgo: 12, sortingCategory: 'reuse', hasReceipt: true },
  { status: 'in_stock',           bananaBayStatus: 'listed',     daysAtStage: 4, arrivalDaysAgo: 14, sortingCategory: 'reuse', hasReceipt: true,
    productionDaysAgo: 6, listedDaysAgo: 4 },
  { status: 'listing',            bananaBayStatus: 'listing',    daysAtStage: 0, arrivalDaysAgo: 10, sortingCategory: 'reuse', hasReceipt: true,
    productionDaysAgo: 3 },
  { status: 'listed',             bananaBayStatus: 'listed',     daysAtStage: 5, arrivalDaysAgo: 15, sortingCategory: 'reuse', hasReceipt: true,
    productionDaysAgo: 8, listedDaysAgo: 5 },
  { status: 'listed',             bananaBayStatus: 'listed',     daysAtStage: 7, arrivalDaysAgo: 18, sortingCategory: 'reuse', hasReceipt: true,
    productionDaysAgo: 10, listedDaysAgo: 7 },

  // 売上フェーズ
  { status: 'sold',               bananaBayStatus: 'sold',       daysAtStage: 1, arrivalDaysAgo: 18, sortingCategory: 'reuse', hasReceipt: true,
    productionDaysAgo: 12, listedDaysAgo: 9, soldDaysAgo: 1 },
  { status: 'sold',               bananaBayStatus: 'sold',       daysAtStage: 6, arrivalDaysAgo: 28, sortingCategory: 'reuse', hasReceipt: true,
    productionDaysAgo: 22, listedDaysAgo: 14, soldDaysAgo: 6 },
  { status: 'sold',               bananaBayStatus: 'sold',       daysAtStage: 18, arrivalDaysAgo: 40, sortingCategory: 'reuse', hasReceipt: true,
    productionDaysAgo: 32, listedDaysAgo: 24, soldDaysAgo: 18 },
  { status: 'sold',               bananaBayStatus: 'sold',       daysAtStage: 38, arrivalDaysAgo: 60, sortingCategory: 'reuse', hasReceipt: true,
    productionDaysAgo: 50, listedDaysAgo: 42, soldDaysAgo: 38 },
  { status: 'returned',           bananaBayStatus: 'returned',   daysAtStage: 4, arrivalDaysAgo: 32, sortingCategory: 'reuse', hasReceipt: true,
    productionDaysAgo: 24, listedDaysAgo: 16, soldDaysAgo: 8 },
];

// ============================================================
// Build the world: inventory + collections + tasks + sales + listings
// ============================================================
type Built = {
  inventory: InventoryItem[];
  collections: Collection[];
  tasks: Task[];
  sales: Sale[];
  bananaListings: BananaBayListing[];
};

function buildWorld(): Built {
  const inventory: InventoryItem[] = [];
  const collections: Collection[] = [];
  const tasks: Task[] = [];
  const sales: Sale[] = [];
  const bananaListings: BananaBayListing[] = [];

  let invCounter = 0;
  let colCounter = 0;
  let taskCounter = 0;
  let listingCounter = 0;
  let saleCounter = 0;

  BASE_NAMES.forEach((base, baseIdx) => {
    const team = BASE_TEAMS[base];
    const customers = CUSTOMERS_BY_BASE[base];
    const baseLetter = String.fromCharCode(65 + baseIdx); // A / B / C

    // ============================================================
    // 業務フロー 一気通貫テスト用サンプル
    //   "回収指示 → 回収 → 受領書発行 → 分別 → 在庫登録 → 商品化待ち"
    //   を 1 顧客 / 1 Collection 上でシームレスに体験できるサンプル。
    //
    //   - 取引先 [0] = 同日訪問・新規回収 (買取金額: 分別作業で確定)
    //     ├ 出張回収タスク tm7 (回収員 担当) ← Step 1〜2
    //     └ 分別作業タスク tm6 (作業員 担当) ← Step 3〜4
    //
    //   - 取引先 [1] = 受領済・拠点搬入済の分別待ち (任意の単独テスト用)
    //     └ 分別作業タスク tm6 (作業員 担当)
    //
    // 共通: 全品目とも finalPrice 未入力。分別作業の 1→N 分解で配分し、
    //       設定された金額が在庫の purchaseAmount として連携される。
    // ============================================================
    customers.forEach((cust, custIdx) => {
      // ① 一気通貫テスト用サンプル（取引先 [0]）
      //    回収指示〜受領〜分別〜在庫登録までを 1 Collection で再現する。
      if (custIdx === 0) {
        const colId = `c-${++colCounter}`;
        const collectorId = team.collectors[0];
        const workerId = team.workers[0];
        const customerId = `cust-${baseLetter}-${(custIdx + 1).toString().padStart(2, '0')}`;
        const items: CollectionItem[] = [PARTS[1], PARTS[5], PARTS[9]].map((p, k) => ({
          id: `${colId}-i${k}`,
          partNumber: `${p.partNumberPrefix}-${(1000 + invCounter + k).toString()}`,
          name: p.name,
          category: p.category,
          quantity: 1,
          newPrice: p.newPrice,
          // finalPrice: 未入力（分別作業の 1→N 分解で配分入力）
          shippingFee: p.baseShipping,
          collectionType: 'paid',
          carMaker: p.carMaker,
          carName: p.carName,
          carModelNumber: p.carModelNumber,
          carYear: p.carYear,
          carModel: `${p.carName} (${p.carYear})`,
          mileage: p.mileage,
          color: 'パールホワイト',
          condition: '中古良好',
          notes: '【テストフロー】回収→分別で在庫化',
          images: [p.image],
        }));
        collections.push({
          id: colId,
          collectionNumber: `COL-${dateAgo(0).replace(/-/g, '')}-${baseLetter}${(custIdx + 1).toString().padStart(2, '0')}`,
          customerId,
          customerName: cust.name,
          customerAddress: cust.address,
          customerPhone: cust.phone,
          customerEmail: cust.email,
          shippingFeeApplicable: cust.shippingFeeApplicable,
          shippingFeeAmount: cust.shippingFeeApplicable ? cust.defaultShippingFee : undefined,
          latitude: cust.lat,
          longitude: cust.lng,
          status: 'pending',
          items,
          collectionDate: dateAgo(0),
          totalAmount: 0, // 金額は分別工程で確定
          notes: '【一気通貫テスト】回収指示→回収完了→受領書発行→分別→在庫化',
          receiptIssued: false,
          purchaseDetailIssued: false,
          assignedCollectorId: collectorId,
        });

        // Step 1〜2: 出張回収タスク (tm7) — 回収員 担当
        tasks.push({
          id: `t-${++taskCounter}`,
          taskMasterId: 'tm7',
          status: 'assigned',
          priority: 'high',
          targetType: 'collection',
          targetId: colId,
          targetName: `${cust.name} (① 出張回収)`,
          assigneeId: collectorId,
          quantity: items.length,
          scheduledDate: dateAgo(0),
        });

        // Step 3〜4: 分別作業タスク (tm6) — 作業員 担当
        // 同 Collection に対して分別タスクをあらかじめ用意しておくことで、
        // 受領書発行 (status='received') 後に作業員が引き継いで
        // 1→N 分解 → 在庫登録 → 商品化待ちリストへ反映 まで一気通貫で確認できる。
        tasks.push({
          id: `t-${++taskCounter}`,
          taskMasterId: 'tm6',
          status: 'assigned',
          priority: 'medium',
          targetType: 'collection',
          targetId: colId,
          targetName: `${cust.name} (② 分別・買取金額確定)`,
          assigneeId: workerId,
          quantity: items.length,
          scheduledDate: dateAgo(0),
        });
      }

      // ② 補足サンプル: 受領済 / 分別工程の単独テスト用 (取引先 [1])
      if (custIdx === 1) {
        const colId = `c-${++colCounter}`;
        const collectorId = team.collectors[0];
        const workerId = team.workers[0];
        const customerId = `cust-${baseLetter}-${(custIdx + 1).toString().padStart(2, '0')}`;
        const partsForDemo = [PARTS[2], PARTS[6], PARTS[10]];
        const items: CollectionItem[] = partsForDemo.map((p, k) => ({
          id: `${colId}-i${k}`,
          partNumber: `${p.partNumberPrefix}-${(2000 + invCounter + k).toString()}`,
          name: p.name,
          category: p.category,
          quantity: 1 + (k % 2),
          newPrice: p.newPrice,
          // finalPrice: 未入力（分別作業で配分入力）
          shippingFee: p.baseShipping,
          collectionType: 'paid',
          carMaker: p.carMaker,
          carName: p.carName,
          carModelNumber: p.carModelNumber,
          carYear: p.carYear,
          carModel: `${p.carName} (${p.carYear})`,
          mileage: p.mileage,
          color: ['パールホワイト', 'スーパーブラック', 'ボルドーマイカ'][k % 3],
          condition: '中古良好',
          notes: '受領済 / 分別作業で買取金額を確定',
          images: [p.image],
        }));
        collections.push({
          id: colId,
          collectionNumber: `COL-${dateAgo(2).replace(/-/g, '')}-${baseLetter}${(custIdx + 1).toString().padStart(2, '0')}`,
          customerId,
          customerName: cust.name,
          customerAddress: cust.address,
          customerPhone: cust.phone,
          customerEmail: cust.email,
          shippingFeeApplicable: cust.shippingFeeApplicable,
          shippingFeeAmount: cust.shippingFeeApplicable ? cust.defaultShippingFee : undefined,
          latitude: cust.lat,
          longitude: cust.lng,
          status: 'received',
          items,
          collectionDate: dateAgo(2),
          totalAmount: 0,
          notes: '受領書発行済 / 拠点搬入済 / 分別作業待ち',
          receiptIssued: true,
          purchaseDetailIssued: false,
          assignedCollectorId: collectorId,
        });

        tasks.push({
          id: `t-${++taskCounter}`,
          taskMasterId: 'tm6',
          status: 'assigned',
          priority: 'medium',
          targetType: 'collection',
          targetId: colId,
          targetName: `${cust.name} (分別作業)`,
          assigneeId: workerId,
          quantity: items.length,
          scheduledDate: dateAgo(0),
        });
      }
    });

    // For each lifecycle stage, instantiate one inventory item using a part template
    STAGE_PLAN.forEach((stage, stageIdx) => {
      const part = PARTS[(invCounter + stageIdx) % PARTS.length];
      const customer = customers[stageIdx % customers.length];
      const idxStr = invCounter.toString().padStart(3, '0');
      const itemId = `i-${++invCounter}`;
      const mgmtNumber = `SG-${baseLetter}-${idxStr}`;

      const arrival = daysAgo(stage.arrivalDaysAgo);
      const statusChanged = daysAgo(stage.daysAtStage);

      const baseInventory: InventoryItem = {
        id: itemId,
        managementNumber: mgmtNumber,
        partNumber: `${part.partNumberPrefix}-${(10000 + invCounter).toString()}`,
        name: part.name,
        carModel: `${part.carName} (${part.carYear})`,
        carName: part.carName,
        carMaker: part.carMaker,
        carYear: part.carYear,
        carModelNumber: part.carModelNumber,
        partCategory: part.category,
        category: part.category,
        baseName: base,
        status: stage.status,
        bananaBayStatus: stage.bananaBayStatus,
        rank: part.rank,
        sortingCategory: stage.sortingCategory,
        arrivalDate: fmtDate(arrival),
        statusChangedAt: fmtDateTime(statusChanged),
        stayDays: stage.daysAtStage,
        location: `${baseLetter}-${(100 + stageIdx).toString()}`,
        price: part.basePrice,
        newPrice: part.newPrice,
        purchaseAmount: part.basePurchase,
        collectionShippingFee: part.baseShipping,
        laborEvaluationAmount: part.baseLabor,
        shippingFee: 1500,
        mileage: part.mileage,
        seller: customer.name,
        condition: '中古良好',
        cleaningDone: ['completed', 'in_stock', 'listing', 'listed', 'sold', 'returned'].includes(stage.status),
        inspected: ['completed', 'in_stock', 'listing', 'listed', 'sold', 'returned'].includes(stage.status),
        images: [part.image],
        productionDate: stage.productionDaysAgo !== undefined ? dateAgo(stage.productionDaysAgo) : undefined,
        listedDate: stage.listedDaysAgo !== undefined ? dateAgo(stage.listedDaysAgo) : undefined,
        soldDate: stage.soldDaysAgo !== undefined ? dateAgo(stage.soldDaysAgo) : undefined,
      };

      // Recycle items get extra metadata
      if (stage.sortingCategory === 'recycle') {
        baseInventory.recycleWeight = 18.5;
        baseInventory.recycleQuantity = 1;
        baseInventory.materialType = '鉄スクラップ';
      }

      inventory.push(baseInventory);

      // ---- Linked historical collection (the source of this inventory item) ----
      // Skip for items whose status is still in the collection phase (handled above)
      if (!['pending_collection', 'collected'].includes(stage.status)) {
        const colId = `c-${++colCounter}`;
        const collectorId = team.collectors[0];
        const collectionDate = stage.arrivalDaysAgo;
        const custIdx = stageIdx % customers.length;
        const linkedCustomerId = `cust-${baseLetter}-${(custIdx + 1).toString().padStart(2, '0')}`;
        collections.push({
          id: colId,
          collectionNumber: `COL-${fmtDate(arrival).replace(/-/g, '')}-${baseLetter}${idxStr}`,
          customerId: linkedCustomerId,
          customerName: customer.name,
          customerAddress: customer.address,
          customerPhone: customer.phone,
          customerEmail: customer.email,
          shippingFeeApplicable: customer.shippingFeeApplicable,
          shippingFeeAmount: customer.shippingFeeApplicable ? customer.defaultShippingFee : undefined,
          latitude: customer.lat,
          longitude: customer.lng,
          status: 'completed',
          items: [{
            id: `${colId}-i0`,
            partNumber: baseInventory.partNumber,
            name: part.name,
            category: part.category,
            quantity: 1,
            newPrice: part.newPrice,
            finalPrice: part.basePurchase,
            shippingFee: part.baseShipping,
            collectionType: 'paid',
            carMaker: part.carMaker,
            carName: part.carName,
            carModelNumber: part.carModelNumber,
            carYear: part.carYear,
            carModel: `${part.carName} (${part.carYear})`,
            mileage: part.mileage,
            color: 'パールホワイト',
            condition: '中古良好',
            images: [part.image],
          }],
          collectionDate: dateAgo(collectionDate),
          totalAmount: part.basePurchase,
          receiptIssued: stage.hasReceipt,
          purchaseDetailIssued: stage.hasReceipt,
          assignedCollectorId: collectorId,
        });
      }

      // ---- Tasks linked to inventory at the appropriate workflow stage ----
      // ユーザー要件:
      //   従業員側で表示される作業サンプルは「商品化 (tm8)」だけに絞る。
      //   その他の検品(tm1)・洗浄(tm2)・撮影(tm3)・梱包(tm4)・分別(tm6) は出さない。
      //   分別 (tm6) は customers ループで Collection 紐付きの 1 件だけ用意する。
      const workerId = team.workers[invCounter % team.workers.length];

      if (stage.status === 'pending_productization') {
        tasks.push({
          id: `t-${++taskCounter}`,
          taskMasterId: 'tm8', // 商品化
          status: 'assigned',
          priority: 'medium',
          targetType: 'inventory',
          targetId: itemId,
          targetName: `${part.carName} ${part.name}（商品化）`,
          assigneeId: workerId,
          quantity: 1,
          scheduledDate: dateAgo(0),
        });
      }

      // ---- Sale record for sold items ----
      if (stage.status === 'sold' && stage.soldDaysAgo !== undefined) {
        const grossProfit = part.basePrice - part.basePurchase - part.baseShipping - part.baseLabor;
        sales.push({
          id: `s-${++saleCounter}`,
          inventoryId: itemId,
          managementNumber: mgmtNumber,
          itemName: part.name,
          saleDate: dateAgo(stage.soldDaysAgo),
          salePrice: part.basePrice,
          salePlatform: 'banana_bay',
          purchaseAmount: part.basePurchase,
          collectionShippingFee: part.baseShipping,
          laborEvaluationAmount: part.baseLabor,
          grossProfit,
        });
      }

      // ---- Banana Bay listing ----
      if (['listing', 'listed', 'sold', 'returned'].includes(stage.status)) {
        const buyerNames = ['田中 一彦', '佐藤 真理子', '高橋 浩二', '鈴木 沙織', '渡辺 健'];
        const buyerAddresses = [
          '東京都新宿区西新宿2-8-1',
          '神奈川県横浜市西区高島1-1-1',
          '愛知県名古屋市中村区名駅1-1-4',
          '大阪府大阪市北区梅田3-1-3',
          '福岡県福岡市博多区博多駅前2-1-1',
        ];
        const buyerPhones = ['03-1234-5678', '045-234-7890', '052-345-6789', '06-4567-8901', '092-555-3344'];
        const carriers: ShippingCarrier[] = ['yamato', 'sagawa', 'jp_post'];
        const buyerIdx = (invCounter + stageIdx) % buyerNames.length;
        const carrier = carriers[(invCounter + stageIdx) % carriers.length];
        const trackingPattern = (c: ShippingCarrier, seed: number) => {
          // 業者ごとの実フォーマットに似せた番号を生成
          if (c === 'yamato') return `${1234 + seed}-${5670 + seed}-${(1000 + seed).toString().padStart(4, '0')}`;
          if (c === 'sagawa') return `${(123456789012 + seed).toString().padStart(12, '0')}`;
          return `${(112233445566 + seed).toString().padStart(13, '0')}`;
        };

        // 出荷管理フィールド：sold は配達完了、shipping は発送済（配達中）と仮定
        const isSold = stage.status === 'sold';
        const isReturned = stage.status === 'returned';
        const shippingDaysOffset = stage.daysAtStage;
        bananaListings.push({
          id: `bl-${++listingCounter}`,
          inventoryId: itemId,
          managementNumber: mgmtNumber,
          itemName: part.name,
          price: part.basePrice,
          status: stage.bananaBayStatus,
          listingDate: stage.listedDaysAgo !== undefined ? dateAgo(stage.listedDaysAgo) : dateAgo(stage.daysAtStage),
          updateDate: dateAgo(stage.daysAtStage),
          shippingNoticeSent: isSold || isReturned,
          paymentConfirmed: isSold,
          buyerName: ['sold', 'returned', 'listed'].includes(stage.status)
            ? buyerNames[buyerIdx]
            : undefined,
          orderId: ['sold', 'returned'].includes(stage.status)
            ? `BB-ORD-${(2024000 + invCounter).toString()}`
            : undefined,
          returnRequested: isReturned,
          returnReason: isReturned ? '商品の状態が説明と異なる' : undefined,
          // ---- 出荷管理データ（sold/returned のみ） ----
          ...(isSold || isReturned
            ? (() => {
                const ds: DeliveryStatus = isReturned
                  ? 'undeliverable'
                  : shippingDaysOffset >= 4
                    ? 'delivered'
                    : shippingDaysOffset >= 2
                      ? 'in_transit'
                      : 'preparing';
                const isShipped = ds === 'in_transit' || ds === 'delivered' || ds === 'undeliverable';
                return {
                  // 出荷待ちは受取人住所のみ事前にセット、追跡番号・配送業者は worker の入力で確定
                  shippingCarrier: isShipped ? carrier : undefined,
                  trackingNumber: isShipped ? trackingPattern(carrier, invCounter * 7 + stageIdx) : undefined,
                  shippedDate: isShipped ? dateAgo(shippingDaysOffset + 2) : undefined,
                  estimatedDeliveryDate: dateAgo(Math.max(0, shippingDaysOffset - 1)),
                  deliveredDate: ds === 'delivered' ? dateAgo(shippingDaysOffset) : undefined,
                  shippingAddress: buyerAddresses[buyerIdx],
                  recipientName: buyerNames[buyerIdx],
                  recipientPhone: buyerPhones[buyerIdx],
                  deliveryStatus: ds,
                  shippingNotes: isReturned ? '受取拒否のため返送' : undefined,
                };
              })()
            : {}),
        });
      }
    });
  });

  return { inventory, collections, tasks, sales, bananaListings };
}

const built = buildWorld();

// ============================================================
// Exported mock collections
// ============================================================
export const MOCK_INVENTORY: InventoryItem[] = built.inventory;

// ============================================================
// 動作確認用ユーザー u9（小田 ヘルレン）専用のデモ「出張回収」案件 3 件
// 大阪支店から関西エリアの実在の取引先住所を 3 か所セットし、
// Google Maps ルート案内で多店舗回収のフローを確認できるようにする。
// ============================================================
const u9DemoCollections: Collection[] = (() => {
  const today = dateAgo(0);
  const stops: Array<{
    customerName: string;
    customerAddress: string;
    customerPhone: string;
    customerEmail?: string;
    latitude: number;
    longitude: number;
    items: { name: string; category: string; carName: string; carYear: string; quantity: number; partNumber: string; image: string }[];
    notes: string;
  }> = [
    {
      customerName: '大阪トヨタ自動車（株）吹田営業所',
      customerAddress: '大阪府吹田市豊津町12-1',
      customerPhone: '06-6190-2200',
      customerEmail: 'parts@osakatoyota.co.jp',
      latitude: 34.7651,
      longitude: 135.5174,
      items: [
        { name: '1NZ-FXE エンジンAssy',          category: 'エンジン',           carName: 'プリウス', carYear: '2015', quantity: 1, partNumber: 'ENG-1NZ-2034', image: 'https://images.unsplash.com/photo-1597734833215-6ac32422776c?q=80&w=600&h=450&fit=crop' },
        { name: 'CVT トランスミッションAssy',     category: 'トランスミッション', carName: 'アクア',   carYear: '2016', quantity: 1, partNumber: 'TRM-K310-2210', image: 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?q=80&w=600&h=450&fit=crop' },
      ],
      notes: '【ルート①】吹田 → 茨木 → 東大阪 の3店舗回収デモ。受領書発行 → 拠点搬入 → 分別作業 まで一気通貫で確認可能。',
    },
    {
      customerName: '株式会社北摂自動車整備',
      customerAddress: '大阪府茨木市西中条町1-15',
      customerPhone: '072-622-2210',
      customerEmail: 'reception@hokusetsu-auto.co.jp',
      latitude: 34.8159,
      longitude: 135.5687,
      items: [
        { name: 'フロントバンパー',           category: '外装', carName: 'プリウス', carYear: '2017', quantity: 1, partNumber: 'EXT-FBP-7821', image: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=600&h=450&fit=crop' },
        { name: 'ヘッドライトAssy（左）',     category: '電装', carName: 'ステップワゴン', carYear: '2018', quantity: 1, partNumber: 'ELE-HLL-1142', image: 'https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?q=80&w=600&h=450&fit=crop' },
        { name: 'リアドア（左）',             category: '外装', carName: 'タント',   carYear: '2019', quantity: 1, partNumber: 'EXT-RDL-4490', image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=600&h=450&fit=crop' },
      ],
      notes: '【ルート②】中規模回収。3 品目をまとめて引き取り、車載で次の店舗へ移動。',
    },
    {
      customerName: 'ネッツトヨタ大阪（株）東大阪本店',
      customerAddress: '大阪府東大阪市御厨南1-1-22',
      customerPhone: '06-6789-3411',
      customerEmail: 'parts@nz-osaka.co.jp',
      latitude: 34.6680,
      longitude: 135.5763,
      items: [
        { name: 'L15B エンジンAssy',  category: 'エンジン', carName: 'フィット', carYear: '2017', quantity: 1, partNumber: 'ENG-L15B-3055', image: 'https://images.unsplash.com/photo-1486006396193-471068589dca?q=80&w=600&h=450&fit=crop' },
        { name: 'ボンネット',         category: '外装',     carName: 'セレナ',   carYear: '2018', quantity: 1, partNumber: 'EXT-BNT-2341', image: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=600&h=450&fit=crop' },
      ],
      notes: '【ルート③】最終回収先。引取送料あり。受領書を発行して拠点へ帰着、当日内に分別工程へ引継ぎ。',
    },
  ];

  return stops.map((s, idx) => ({
    id: `c-u9-${idx + 1}`,
    collectionNumber: `COL-${today.replace(/-/g, '')}-U9${(idx + 1).toString().padStart(2, '0')}`,
    customerId: `cust-A-${(idx + 1).toString().padStart(2, '0')}`,
    customerName: s.customerName,
    customerAddress: s.customerAddress,
    customerPhone: s.customerPhone,
    customerEmail: s.customerEmail,
    shippingFeeApplicable: idx === 2,
    shippingFeeAmount: idx === 2 ? 3500 : undefined,
    latitude: s.latitude,
    longitude: s.longitude,
    status: 'pending' as const,
    items: s.items.map((it, k) => ({
      id: `c-u9-${idx + 1}-i${k}`,
      partNumber: it.partNumber,
      name: it.name,
      category: it.category,
      quantity: it.quantity,
      collectionType: 'paid' as const,
      carName: it.carName,
      carYear: it.carYear,
      carModel: `${it.carName} (${it.carYear})`,
      condition: '中古良好',
      notes: '',
      images: [it.image],
    })),
    collectionDate: today,
    totalAmount: 0,
    notes: s.notes,
    receiptIssued: false,
    purchaseDetailIssued: false,
    assignedCollectorId: 'u9',
  }));
})();

// ============================================================
// 作業員 一郎 (u2) 用の出張回収デモ案件 3 件（吹田南／高槻／東大阪のルート）
// ============================================================
const u2DemoCollections: Collection[] = (() => {
  const today = dateAgo(0);
  const stops: Array<{
    customerName: string;
    customerAddress: string;
    customerPhone: string;
    customerEmail?: string;
    latitude: number;
    longitude: number;
    items: { name: string; category: string; carName: string; carYear: string; quantity: number; partNumber: string; image: string }[];
    notes: string;
    fee?: number;
  }> = [
    {
      customerName: 'ニューリー北大阪（株）摂津営業所',
      customerAddress: '大阪府摂津市鳥飼上3-12-7',
      customerPhone: '072-654-3300',
      customerEmail: 'k.parts@newly.co.jp',
      latitude: 34.7714,
      longitude: 135.5710,
      fee: 3000,
      items: [
        { name: '1NZ-FXE エンジンAssy', category: 'エンジン', carName: 'プリウス', carYear: '2014', quantity: 1, partNumber: 'ENG-1NZ-9921', image: 'https://images.unsplash.com/photo-1597734833215-6ac32422776c?q=80&w=600&h=450&fit=crop' },
        { name: 'オルタネーター',       category: '電装',     carName: 'プリウス', carYear: '2014', quantity: 1, partNumber: 'ELE-ALT-3340', image: 'https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?q=80&w=600&h=450&fit=crop' },
      ],
      notes: '【一郎ルート①】摂津 → 高槻 → 東大阪 のルート。送料あり。',
    },
    {
      customerName: '京都トヨペット（株）大阪営業所',
      customerAddress: '大阪府高槻市八丁畷町2-4-12',
      customerPhone: '072-672-1408',
      customerEmail: 'osaka@kyoto-toyopet.co.jp',
      latitude: 34.8500,
      longitude: 135.6173,
      items: [
        { name: 'CVT トランスミッションAssy', category: 'トランスミッション', carName: 'フィット', carYear: '2018', quantity: 1, partNumber: 'TRM-CVT-7711', image: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?q=80&w=600&h=450&fit=crop' },
        { name: 'ヘッドライトAssy（左）',     category: '電装',               carName: 'ステップワゴン', carYear: '2018', quantity: 1, partNumber: 'ELE-HLL-2240', image: 'https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?q=80&w=600&h=450&fit=crop' },
        { name: 'ボンネット',                 category: '外装',               carName: 'セレナ',   carYear: '2018', quantity: 1, partNumber: 'EXT-BNT-9810', image: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=600&h=450&fit=crop' },
      ],
      notes: '【一郎ルート②】3 品目をまとめて引き取り、車載で次の店舗へ移動。',
    },
    {
      customerName: 'ネッツトヨタ大阪（株）東大阪本店',
      customerAddress: '大阪府東大阪市御厨南1-1-22',
      customerPhone: '06-6789-3411',
      customerEmail: 'parts@nz-osaka.co.jp',
      latitude: 34.6680,
      longitude: 135.5763,
      fee: 3500,
      items: [
        { name: 'リアドア（左）',     category: '外装', carName: 'タント',     carYear: '2019', quantity: 1, partNumber: 'EXT-RDL-5560', image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=600&h=450&fit=crop' },
        { name: 'フロントバンパー',   category: '外装', carName: 'プリウス',   carYear: '2017', quantity: 1, partNumber: 'EXT-FBP-1230', image: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=600&h=450&fit=crop' },
      ],
      notes: '【一郎ルート③】最終回収先。受領書発行 → 拠点搬入 → 分別工程へ引継ぎ。',
    },
  ];

  return stops.map((s, idx) => ({
    id: `c-u2-${idx + 1}`,
    collectionNumber: `COL-${today.replace(/-/g, '')}-U2${(idx + 1).toString().padStart(2, '0')}`,
    customerId: `cust-A-u2-${(idx + 1).toString().padStart(2, '0')}`,
    customerName: s.customerName,
    customerAddress: s.customerAddress,
    customerPhone: s.customerPhone,
    customerEmail: s.customerEmail,
    shippingFeeApplicable: Boolean(s.fee),
    shippingFeeAmount: s.fee,
    latitude: s.latitude,
    longitude: s.longitude,
    status: 'pending' as const,
    items: s.items.map((it, k) => ({
      id: `c-u2-${idx + 1}-i${k}`,
      partNumber: it.partNumber,
      name: it.name,
      category: it.category,
      quantity: it.quantity,
      collectionType: 'paid' as const,
      carName: it.carName,
      carYear: it.carYear,
      carModel: `${it.carName} (${it.carYear})`,
      condition: '中古良好',
      notes: '',
      images: [it.image],
    })),
    collectionDate: today,
    totalAmount: 0,
    notes: s.notes,
    receiptIssued: false,
    purchaseDetailIssued: false,
    assignedCollectorId: 'u2',
  }));
})();

// ============================================================
// 回収員 三郎 (u4) 用の出張回収デモ案件 5 件（北摂エリア多店舗ルート）
// ============================================================
const u4DemoCollections: Collection[] = (() => {
  const today = dateAgo(0);
  const stops: Array<{
    customerName: string;
    customerAddress: string;
    customerPhone: string;
    customerEmail?: string;
    latitude: number;
    longitude: number;
    items: { name: string; category: string; carName: string; carYear: string; quantity: number; partNumber: string; image: string }[];
    notes: string;
    fee?: number;
  }> = [
    {
      customerName: '大阪トヨタ自動車（株）吹田営業所',
      customerAddress: '大阪府吹田市豊津町12-1',
      customerPhone: '06-6190-2200',
      customerEmail: 'parts@osakatoyota.co.jp',
      latitude: 34.7651,
      longitude: 135.5174,
      items: [
        { name: '1NZ-FXE エンジンAssy', category: 'エンジン', carName: 'プリウス', carYear: '2015', quantity: 1, partNumber: 'ENG-1NZ-1101', image: 'https://images.unsplash.com/photo-1597734833215-6ac32422776c?q=80&w=600&h=450&fit=crop' },
      ],
      notes: '【三郎ルート①】吹田スタート。1 品目のみ、軽快に積込み。',
    },
    {
      customerName: '株式会社北摂自動車整備',
      customerAddress: '大阪府茨木市西中条町1-15',
      customerPhone: '072-622-2210',
      customerEmail: 'reception@hokusetsu-auto.co.jp',
      latitude: 34.8159,
      longitude: 135.5687,
      items: [
        { name: 'CVT トランスミッションAssy', category: 'トランスミッション', carName: 'アクア', carYear: '2016', quantity: 1, partNumber: 'TRM-K310-3320', image: 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?q=80&w=600&h=450&fit=crop' },
        { name: 'ボンネット',                 category: '外装',               carName: 'セレナ', carYear: '2018', quantity: 1, partNumber: 'EXT-BNT-1520', image: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=600&h=450&fit=crop' },
      ],
      notes: '【三郎ルート②】茨木：2 品目。',
    },
    {
      customerName: 'ニューリー北大阪（株）摂津営業所',
      customerAddress: '大阪府摂津市鳥飼上3-12-7',
      customerPhone: '072-654-3300',
      customerEmail: 'k.parts@newly.co.jp',
      latitude: 34.7714,
      longitude: 135.5710,
      fee: 3000,
      items: [
        { name: 'フロントバンパー', category: '外装', carName: 'プリウス',  carYear: '2017', quantity: 1, partNumber: 'EXT-FBP-7400', image: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=600&h=450&fit=crop' },
        { name: 'ヘッドライトAssy（左）', category: '電装', carName: 'ステップワゴン', carYear: '2018', quantity: 1, partNumber: 'ELE-HLL-9912', image: 'https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?q=80&w=600&h=450&fit=crop' },
      ],
      notes: '【三郎ルート③】摂津：送料あり。',
    },
    {
      customerName: '京都トヨペット（株）大阪営業所',
      customerAddress: '大阪府高槻市八丁畷町2-4-12',
      customerPhone: '072-672-1408',
      customerEmail: 'osaka@kyoto-toyopet.co.jp',
      latitude: 34.8500,
      longitude: 135.6173,
      items: [
        { name: 'L15B エンジンAssy', category: 'エンジン', carName: 'フィット', carYear: '2017', quantity: 1, partNumber: 'ENG-L15B-2002', image: 'https://images.unsplash.com/photo-1486006396193-471068589dca?q=80&w=600&h=450&fit=crop' },
      ],
      notes: '【三郎ルート④】高槻：単品エンジン。',
    },
    {
      customerName: 'ネッツトヨタ大阪（株）東大阪本店',
      customerAddress: '大阪府東大阪市御厨南1-1-22',
      customerPhone: '06-6789-3411',
      customerEmail: 'parts@nz-osaka.co.jp',
      latitude: 34.6680,
      longitude: 135.5763,
      fee: 3500,
      items: [
        { name: 'リアドア（左）', category: '外装', carName: 'タント', carYear: '2019', quantity: 1, partNumber: 'EXT-RDL-7821', image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=600&h=450&fit=crop' },
        { name: 'オルタネーター', category: '電装', carName: 'プリウス', carYear: '2014', quantity: 1, partNumber: 'ELE-ALT-2210', image: 'https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?q=80&w=600&h=450&fit=crop' },
        { name: 'CVT トランスミッションAssy', category: 'トランスミッション', carName: 'フィット', carYear: '2018', quantity: 1, partNumber: 'TRM-CVT-4501', image: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?q=80&w=600&h=450&fit=crop' },
      ],
      notes: '【三郎ルート⑤】東大阪：3 品目で大型回収。送料あり。',
    },
  ];

  return stops.map((s, idx) => ({
    id: `c-u4-${idx + 1}`,
    collectionNumber: `COL-${today.replace(/-/g, '')}-U4${(idx + 1).toString().padStart(2, '0')}`,
    customerId: `cust-A-u4-${(idx + 1).toString().padStart(2, '0')}`,
    customerName: s.customerName,
    customerAddress: s.customerAddress,
    customerPhone: s.customerPhone,
    customerEmail: s.customerEmail,
    shippingFeeApplicable: Boolean(s.fee),
    shippingFeeAmount: s.fee,
    latitude: s.latitude,
    longitude: s.longitude,
    status: 'pending' as const,
    items: s.items.map((it, k) => ({
      id: `c-u4-${idx + 1}-i${k}`,
      partNumber: it.partNumber,
      name: it.name,
      category: it.category,
      quantity: it.quantity,
      collectionType: 'paid' as const,
      carName: it.carName,
      carYear: it.carYear,
      carModel: `${it.carName} (${it.carYear})`,
      condition: '中古良好',
      notes: '',
      images: [it.image],
    })),
    collectionDate: today,
    totalAmount: 0,
    notes: s.notes,
    receiptIssued: false,
    purchaseDetailIssued: false,
    assignedCollectorId: 'u4',
  }));
})();

export const MOCK_COLLECTIONS: Collection[] = [
  ...u9DemoCollections,
  ...u2DemoCollections,
  ...u4DemoCollections,
  ...built.collections,
];
// ============================================================
// 動作確認用ユーザー u9（小田 ヘルレン）に明示的なデモ作業指示を割り当てる。
// 作業マスタ（出張回収×3 / 分別 / 商品化 / 出荷）
// を網羅し、本日のスケジュールに連続配置することでフルフローの確認が可能。
// 出張回収は 3 件の取引先を回るルート案内サンプルとして時刻分割。
// ============================================================
const u9DemoTasks: Task[] = (() => {
  const today = dateAgo(0);
  const baseName = '大阪支店';
  const baseInventory = built.inventory.filter((i) => i.baseName === baseName);

  // 与えられた status から該当する在庫を 1 件返す（無ければ任意の在庫にフォールバック）
  const pickInventory = (statuses: string[]): typeof baseInventory[number] | undefined => {
    for (const s of statuses) {
      const hit = baseInventory.find((i) => i.status === s);
      if (hit) return hit;
    }
    return baseInventory[0];
  };

  type PlanEntry =
    | {
        masterId: string;
        label: string;
        priority: 'high' | 'medium' | 'low';
        target: 'inventory';
        statuses: string[];
        duration: number;
        start: string;
      }
    | {
        masterId: string;
        label: string;
        priority: 'high' | 'medium' | 'low';
        target: 'collection';
        collectionId: string;
        duration: number;
        start: string;
      };

  // タスクマスタ ID → ターゲット情報のマッピング
  // 業務工程は「出張回収 → 分別 → 商品化 → 出荷」の 4 段階に集約
  const plan: PlanEntry[] = [
    // 出張回収 3 連続（ルート案内サンプル）
    { masterId: 'tm7', label: '出張回収①',     priority: 'high',   target: 'collection', collectionId: 'c-u9-1', duration: 50, start: '09:00' },
    { masterId: 'tm7', label: '出張回収②',     priority: 'high',   target: 'collection', collectionId: 'c-u9-2', duration: 45, start: '10:00' },
    { masterId: 'tm7', label: '出張回収③',     priority: 'high',   target: 'collection', collectionId: 'c-u9-3', duration: 50, start: '11:00' },
    { masterId: 'tm6', label: '荷下・3分類',    priority: 'medium', target: 'inventory', statuses: ['pending_sorting', 'received'], duration: 60, start: '13:00' },
    { masterId: 'tm8', label: '商品化',         priority: 'medium', target: 'inventory', statuses: ['pending_productization'],      duration: 80, start: '14:10' },
    { masterId: 'tm9', label: '出荷業務',       priority: 'high',   target: 'inventory', statuses: ['sold', 'listed'],              duration: 30, start: '15:35' },
  ];

  const usedInventoryIds = new Set<string>();
  const tasks: Task[] = [];

  plan.forEach((p, idx) => {
    let targetType: 'inventory' | 'collection' = p.target;
    let targetId = '';
    let targetName = '';

    if (p.target === 'collection') {
      const col = u9DemoCollections.find((c) => c.id === p.collectionId);
      if (col) {
        targetId = col.id;
        targetName = `${col.customerName ?? ''} (${p.label})`.trim();
      } else {
        // フォールバック: collection が無ければ inventory に切替
        targetType = 'inventory';
        const it = pickInventory(['received', 'collected']);
        if (it) {
          targetId = it.id;
          targetName = `${it.carName ?? ''} ${it.name}（${p.label}）`.trim();
          usedInventoryIds.add(it.id);
        }
      }
    } else {
      // 既に使った在庫を避けて 1 件確保
      const candidates = (p.statuses || []).flatMap((s) => baseInventory.filter((i) => i.status === s));
      const it = candidates.find((c) => !usedInventoryIds.has(c.id)) || candidates[0] || baseInventory[idx % baseInventory.length];
      if (it) {
        targetId = it.id;
        targetName = `${it.carName ?? ''} ${it.name}（${p.label}）`.trim();
        usedInventoryIds.add(it.id);
      }
    }
    if (!targetId) return; // 念のため

    // 開始時刻 + duration から終了時刻を計算
    const [sh, sm] = p.start.split(':').map(Number);
    const startMin = sh * 60 + sm;
    const endMin = startMin + p.duration;
    const endTime = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;

    tasks.push({
      id: `t-u9-${idx + 1}`,
      taskMasterId: p.masterId,
      status: 'assigned' as const,
      priority: p.priority,
      targetType,
      targetId,
      targetName,
      assigneeId: 'u9',
      quantity: 1,
      scheduledDate: today,
      scheduledStartTime: p.start,
      scheduledEndTime: endTime,
      durationMinutes: p.duration,
      dispatched: true,
      dispatchedAt: new Date().toISOString(),
    });
  });

  return tasks;
})();

// ============================================================
// 作業員 一郎 (u2) のデモタスク（小田と同じ 9 件構成）
// ============================================================
const u2DemoTasks: Task[] = (() => {
  const today = dateAgo(0);
  const baseInventory = built.inventory.filter((i) => i.baseName === '大阪支店');
  const used = new Set<string>();
  const pickInv = (statuses: string[]): typeof baseInventory[number] | undefined => {
    for (const s of statuses) {
      const list = baseInventory.filter((i) => i.status === s && !used.has(i.id));
      if (list.length > 0) return list[0];
    }
    return baseInventory.find((i) => !used.has(i.id));
  };

  type PE =
    | { masterId: string; label: string; priority: 'high' | 'medium' | 'low'; target: 'inventory'; statuses: string[]; duration: number; start: string }
    | { masterId: string; label: string; priority: 'high' | 'medium' | 'low'; target: 'collection'; collectionId: string; duration: number; start: string };

  const plan: PE[] = [
    { masterId: 'tm7', label: '出張回収①',     priority: 'high',   target: 'collection', collectionId: 'c-u2-1', duration: 50, start: '09:00' },
    { masterId: 'tm7', label: '出張回収②',     priority: 'high',   target: 'collection', collectionId: 'c-u2-2', duration: 45, start: '10:00' },
    { masterId: 'tm7', label: '出張回収③',     priority: 'high',   target: 'collection', collectionId: 'c-u2-3', duration: 50, start: '11:00' },
    { masterId: 'tm6', label: '荷下・3分類',    priority: 'medium', target: 'inventory', statuses: ['pending_sorting', 'received'], duration: 60, start: '13:00' },
    { masterId: 'tm8', label: '商品化',         priority: 'medium', target: 'inventory', statuses: ['pending_productization'],      duration: 80, start: '14:10' },
    { masterId: 'tm9', label: '出荷業務',       priority: 'high',   target: 'inventory', statuses: ['sold', 'listed'],              duration: 30, start: '15:35' },
  ];

  const tasks: Task[] = [];
  plan.forEach((p, idx) => {
    let targetType: 'inventory' | 'collection' = p.target;
    let targetId = '';
    let targetName = '';
    if (p.target === 'collection') {
      const col = u2DemoCollections.find((c) => c.id === p.collectionId);
      if (col) {
        targetId = col.id;
        targetName = `${col.customerName} (${p.label})`;
      } else {
        return;
      }
    } else {
      const it = pickInv(p.statuses);
      if (it) {
        targetId = it.id;
        targetName = `${it.carName ?? ''} ${it.name}（${p.label}）`.trim();
        used.add(it.id);
      } else {
        return;
      }
    }
    const [sh, sm] = p.start.split(':').map(Number);
    const startMin = sh * 60 + sm;
    const endMin = startMin + p.duration;
    const endTime = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
    tasks.push({
      id: `t-u2-${idx + 1}`,
      taskMasterId: p.masterId,
      status: 'assigned',
      priority: p.priority,
      targetType,
      targetId,
      targetName,
      assigneeId: 'u2',
      quantity: 1,
      scheduledDate: today,
      scheduledStartTime: p.start,
      scheduledEndTime: endTime,
      durationMinutes: p.duration,
      dispatched: true,
      dispatchedAt: new Date().toISOString(),
    });
  });
  return tasks;
})();

// ============================================================
// 回収員 三郎 (u4) のデモタスク：5 連続出張回収＋分別＋商品撮影
// ============================================================
const u4DemoTasks: Task[] = (() => {
  const today = dateAgo(0);
  const baseInventory = built.inventory.filter((i) => i.baseName === '大阪支店');
  const used = new Set<string>();
  const pickInv = (statuses: string[]): typeof baseInventory[number] | undefined => {
    for (const s of statuses) {
      const list = baseInventory.filter((i) => i.status === s && !used.has(i.id));
      if (list.length > 0) return list[0];
    }
    return baseInventory.find((i) => !used.has(i.id));
  };

  type PE =
    | { masterId: string; label: string; priority: 'high' | 'medium' | 'low'; target: 'inventory'; statuses: string[]; duration: number; start: string }
    | { masterId: string; label: string; priority: 'high' | 'medium' | 'low'; target: 'collection'; collectionId: string; duration: number; start: string };

  const plan: PE[] = [
    { masterId: 'tm7', label: '出張回収①', priority: 'high',   target: 'collection', collectionId: 'c-u4-1', duration: 45, start: '09:00' },
    { masterId: 'tm7', label: '出張回収②', priority: 'high',   target: 'collection', collectionId: 'c-u4-2', duration: 50, start: '09:55' },
    { masterId: 'tm7', label: '出張回収③', priority: 'high',   target: 'collection', collectionId: 'c-u4-3', duration: 50, start: '10:55' },
    { masterId: 'tm7', label: '出張回収④', priority: 'medium', target: 'collection', collectionId: 'c-u4-4', duration: 45, start: '13:00' },
    { masterId: 'tm7', label: '出張回収⑤', priority: 'high',   target: 'collection', collectionId: 'c-u4-5', duration: 60, start: '13:55' },
    { masterId: 'tm6', label: '荷下・3分類', priority: 'medium', target: 'inventory', statuses: ['pending_sorting', 'received'], duration: 60, start: '15:05' },
  ];

  const tasks: Task[] = [];
  plan.forEach((p, idx) => {
    let targetType: 'inventory' | 'collection' = p.target;
    let targetId = '';
    let targetName = '';
    if (p.target === 'collection') {
      const col = u4DemoCollections.find((c) => c.id === p.collectionId);
      if (col) {
        targetId = col.id;
        targetName = `${col.customerName} (${p.label})`;
      } else {
        return;
      }
    } else {
      const it = pickInv(p.statuses);
      if (it) {
        targetId = it.id;
        targetName = `${it.carName ?? ''} ${it.name}（${p.label}）`.trim();
        used.add(it.id);
      } else {
        return;
      }
    }
    const [sh, sm] = p.start.split(':').map(Number);
    const startMin = sh * 60 + sm;
    const endMin = startMin + p.duration;
    const endTime = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
    tasks.push({
      id: `t-u4-${idx + 1}`,
      taskMasterId: p.masterId,
      status: 'assigned',
      priority: p.priority,
      targetType,
      targetId,
      targetName,
      assigneeId: 'u4',
      quantity: 1,
      scheduledDate: today,
      scheduledStartTime: p.start,
      scheduledEndTime: endTime,
      durationMinutes: p.duration,
      dispatched: true,
      dispatchedAt: new Date().toISOString(),
    });
  });
  return tasks;
})();

// ============================================================
// 発送業務（tm9）の未割当サンプル — 各拠点から 1 件ずつ
// 担当未設定で TASK SELECTION POOL の「発送」フィルタに公開され、
// 管理者がドラッグ＆ドロップで作業員に割当可能。
// ============================================================
const unassignedShippingDemoTasks: Task[] = (() => {
  const tasks: Task[] = [];
  let counter = 0;
  for (const baseName of BASE_NAMES) {
    // 各拠点で sold な在庫を最後尾から 1 件ピック（u2/u9/u4 のデモ計画が前方の sold を使う想定）
    const soldItems = built.inventory.filter(
      (i) =>
        i.baseName === baseName &&
        i.status === 'sold' &&
        i.bananaBayStatus === 'sold',
    );
    if (soldItems.length === 0) continue;
    const item = soldItems[soldItems.length - 1];

    // BananaBay 出品レコードから受取人情報を取得（あれば）
    const listing = built.bananaListings.find((bl) => bl.inventoryId === item.id);
    const recipient = listing?.recipientName ?? listing?.buyerName ?? '受取人未設定';

    tasks.push({
      id: `t-ship-demo-${++counter}`,
      taskMasterId: 'tm9',
      status: 'pending', // 未割当（assigneeId なし）→ プール表示
      priority: 'high',
      targetType: 'inventory',
      targetId: item.id,
      targetName: `${item.name}（${recipient} 様）`,
      // assigneeId 意図的に未設定
      quantity: 1,
      scheduledDate: '',
      dispatched: false,
    });
  }
  return tasks;
})();

export const MOCK_TASKS: Task[] = [
  ...u9DemoTasks,
  ...u2DemoTasks,
  ...u4DemoTasks,
  ...unassignedShippingDemoTasks,
  ...built.tasks,
];
export const MOCK_SALES: Sale[] = built.sales;
export const MOCK_BANANA_LISTINGS: BananaBayListing[] = built.bananaListings;

// 取引先マスタ — CUSTOMERS_BY_BASE から派生。
// 業務フロー PDF より: 引取送料あり/なしで2系統あり、月末締め買取明細書のテンプレートを切り替える。
export const MOCK_CUSTOMERS: Customer[] = (() => {
  const list: Customer[] = [];
  Object.entries(CUSTOMERS_BY_BASE).forEach(([base, seeds], baseIdx) => {
    const baseLetter = String.fromCharCode(65 + baseIdx);
    seeds.forEach((s, custIdx) => {
      list.push({
        id: `cust-${baseLetter}-${(custIdx + 1).toString().padStart(2, '0')}`,
        name: s.name,
        email: s.email,
        phone: s.phone,
        address: s.address,
        shippingFeeApplicable: s.shippingFeeApplicable,
        defaultShippingFee: s.defaultShippingFee,
        notes: `${base} 管轄`,
      });
    });
  });
  return list;
})();

// ============================================================
// Task masters
// ============================================================
export const MOCK_TASK_MASTER: TaskMaster[] = [
  // 作業マスタは「回収・分別・商品化・出荷」の 4 工程に集約。
  // 旧 tm1-tm5（検品/洗浄/撮影/梱包/解体）は商品化フロー (tm8) に内包されるため削除済み。
  { id: 'tm6', name: '荷下・3分類（分別作業）', type: 'sorting',    description: 'リサイクル・リユース・リビルドへの仕分け', estimatedTime: 45, basePrice: 3000 },
  { id: 'tm7', name: '出張回収業務',       type: 'collection',     description: 'お客様宅/業者への出張回収',             estimatedTime: 120, basePrice: 8000 },
  { id: 'tm8', name: '商品化',             type: 'productization', description: '検査・清掃・撮影・梱包の全工程',         estimatedTime: 80, basePrice: 4500 },
  { id: 'tm9', name: '出荷業務',           type: 'shipping',       description: '売却商品の梱包・配送ラベル発行・追跡番号登録',  estimatedTime: 30, basePrice: 1200 },
];

// ============================================================
// Attendance — last 14 days for all on-site workers/collectors
// (anchored to today, so dates always look fresh)
// ============================================================
function buildAttendance(): Attendance[] {
  const result: Attendance[] = [];
  const onsite = MOCK_USERS.filter((u) => u.role === 'worker' || u.role === 'collector');
  // Build records for last 14 days
  for (let d = 13; d >= 0; d--) {
    const date = dateAgo(d);
    const dayOfWeek = daysAgo(d).getDay(); // 0=Sun, 6=Sat
    onsite.forEach((u, idx) => {
      // Sundays = holiday for everyone
      if (dayOfWeek === 0) {
        result.push({
          id: `att-${u.id}-${d}`,
          userId: u.id,
          userName: u.name,
          date,
          status: 'holiday',
          note: '定休日',
        });
        return;
      }
      // Today: in progress (clockIn but no clockOut for some)
      if (d === 0) {
        result.push({
          id: `att-${u.id}-${d}`,
          userId: u.id,
          userName: u.name,
          date,
          clockIn: idx % 2 === 0 ? '08:55' : '09:02',
          clockOut: undefined,
          breakMinutes: 0,
          workingMinutes: 0,
          status: 'working',
          note: '稼働中',
        });
        return;
      }
      // Sprinkle in some lateness/absence/overtime
      const variant = (d + idx) % 7;
      if (variant === 0) {
        result.push({
          id: `att-${u.id}-${d}`,
          userId: u.id,
          userName: u.name,
          date,
          clockIn: '09:18',
          clockOut: '18:00',
          breakMinutes: 60,
          workingMinutes: 462,
          status: 'late',
          note: '電車遅延',
        });
      } else if (variant === 6 && d > 5) {
        result.push({
          id: `att-${u.id}-${d}`,
          userId: u.id,
          userName: u.name,
          date,
          status: 'holiday',
          note: '有給休暇',
        });
      } else if (variant === 3) {
        result.push({
          id: `att-${u.id}-${d}`,
          userId: u.id,
          userName: u.name,
          date,
          clockIn: '08:50',
          clockOut: '19:45',
          breakMinutes: 60,
          workingMinutes: 595,
          status: 'present',
          note: '残業対応',
        });
      } else {
        result.push({
          id: `att-${u.id}-${d}`,
          userId: u.id,
          userName: u.name,
          date,
          clockIn: '08:55',
          clockOut: '18:05',
          breakMinutes: 60,
          workingMinutes: 490,
          status: 'present',
          note: '通常勤務',
        });
      }
    });
  }
  return result;
}

export const MOCK_ATTENDANCE: Attendance[] = buildAttendance();

// ============================================================
// Shifts — this week + next week
// ============================================================
function buildShifts(): Shift[] {
  const result: Shift[] = [];
  const onsite = MOCK_USERS.filter((u) => u.role === 'worker' || u.role === 'collector');
  for (let d = 0; d < 14; d++) {
    const date = fmtDate(addDays(TODAY, d));
    const dayOfWeek = addDays(TODAY, d).getDay();
    if (dayOfWeek === 0) continue; // skip Sundays
    onsite.forEach((u) => {
      result.push({
        id: `sh-${u.id}-${d}`,
        userId: u.id,
        userName: u.name,
        date,
        startTime: u.role === 'collector' ? '08:30' : '09:00',
        endTime: u.role === 'collector' ? '17:30' : '18:00',
        shiftType: 'regular',
      });
    });
  }
  return result;
}

export const MOCK_SHIFTS: Shift[] = buildShifts();

// ============================================================
// Salary reports — periodEnd is last 20th, periodStart is prior 21st
// ============================================================
function buildSalaryReports(): SalaryReport[] {
  // Most recent closed period: previous 20th -> previous-previous 21st
  const today = TODAY;
  const day = today.getDate();
  let periodEnd: Date;
  if (day > 20) {
    periodEnd = new Date(today.getFullYear(), today.getMonth(), 20);
  } else {
    periodEnd = new Date(today.getFullYear(), today.getMonth() - 1, 20);
  }
  const periodStart = new Date(periodEnd.getFullYear(), periodEnd.getMonth() - 1, 21);

  const baseSalaryByRole: Record<string, number> = {
    worker: 250000,
    collector: 260000,
  };
  return MOCK_USERS.filter((u) => u.role !== 'admin').map((u, i) => ({
    userId: u.id,
    userName: u.name,
    periodStart: fmtDate(periodStart),
    periodEnd: fmtDate(periodEnd),
    totalWorkingDays: 19 + (i % 3),
    totalWorkingHours: 152 + (i % 3) * 8,
    totalOvertimeHours: i % 4 === 0 ? 12 : i % 3,
    totalNightHours: i === 1 ? 14 : 0,
    baseSalary: baseSalaryByRole[u.role] ?? 250000,
    allowances: 8000 + (i % 4) * 4000,
    totalSalary: (baseSalaryByRole[u.role] ?? 250000) + 8000 + (i % 4) * 4000 + (i % 4 === 0 ? 18000 : (i % 3) * 2500),
  }));
}

export const MOCK_SALARY_REPORTS: SalaryReport[] = buildSalaryReports();

// ============================================================
// Monthly sales reports — last 6 months ending current month
// Driven by actual MOCK_SALES so totals stay consistent.
// ============================================================
function buildMonthlyReports(): MonthlySales[] {
  const result: MonthlySales[] = [];
  for (let i = 5; i >= 0; i--) {
    const monthDate = subMonths(TODAY, i);
    const monthStr = format(monthDate, 'yyyy-MM');
    const monthSales = MOCK_SALES.filter((s) => s.saleDate.startsWith(monthStr));
    if (monthSales.length === 0) {
      // Use plausible figures so the chart still looks good for older months
      result.push({
        month: monthStr,
        totalRevenue: 2_400_000 + i * 180_000,
        totalCost: 1_350_000 + i * 90_000,
        totalProfit: 1_050_000 + i * 90_000,
        itemsSoldCount: 62 + i * 4,
      });
    } else {
      const totalRevenue = monthSales.reduce((s, x) => s + x.salePrice, 0);
      const totalCost = monthSales.reduce(
        (s, x) => s + x.purchaseAmount + x.collectionShippingFee + x.laborEvaluationAmount,
        0,
      );
      result.push({
        month: monthStr,
        totalRevenue,
        totalCost,
        totalProfit: totalRevenue - totalCost,
        itemsSoldCount: monthSales.length,
      });
    }
  }
  return result;
}

export const MOCK_MONTHLY_REPORTS: MonthlySales[] = buildMonthlyReports();

// ============================================================
// Other masters (kept simple — pages that use them tolerate empty)
// ============================================================
export const MOCK_POSITIONS: PositionMaster[] = [
  { id: 'p1', name: '一般作業員', level: 1 },
  { id: 'p2', name: 'リーダー',   level: 2 },
  { id: 'p3', name: 'マネージャー', level: 3 },
];

export const MOCK_SHELVES: ShelfMaster[] = [
  { id: 'sh-A', branchId: 'b1', code: 'A-100', category: 'エンジン' },
  { id: 'sh-B', branchId: 'b2', code: 'B-100', category: '外装' },
  { id: 'sh-C', branchId: 'b3', code: 'C-100', category: '電装' },
];

export const MOCK_CATEGORIES: CategoryMaster[] = CATEGORIES.map((name, i) => ({
  id: `cat-${i + 1}`,
  name,
}));

export const MOCK_QUALITY_RANKS: QualityRankMaster[] = [
  { id: 'qr-S', rank: 'S', description: '新品同様' },
  { id: 'qr-A', rank: 'A', description: '使用感少ない美品' },
  { id: 'qr-B', rank: 'B', description: '通常の中古品' },
  { id: 'qr-C', rank: 'C', description: '傷・劣化あり' },
];

export const MOCK_EVALUATION_MASTERS: EvaluationMaster[] = [
  { id: 'em-1', name: 'ミスゼロ',     score: 5, description: '不良ゼロ・遅延なし' },
  { id: 'em-2', name: '高効率',       score: 4, description: '標準より20%以上速い' },
  { id: 'em-3', name: '通常',         score: 3, description: '標準的なパフォーマンス' },
  { id: 'em-4', name: '要改善',       score: 2, description: '不良または遅延あり' },
];

export const MOCK_QUOTES: Quote[] = [];
export const MOCK_ORDERS: Order[] = [];
export const MOCK_INVOICES: Invoice[] = [];
