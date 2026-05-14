/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 月次買取明細書 - 月末締めで各引取企業へ買取明細書を発行・メール送付するフロー。
 * 1. 月（YYYY-MM）を選択
 * 2. その月に回収完了した案件を 顧客（取引先）単位 で集計
 * 3. 全品目の買取金額が確定済みの顧客のみ「明細書発行 + メール送付」可能
 * 4. 一括メール送付ボタンで未送付の対象に PDF 添付メールを送信（モック）
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { format, isSameMonth, parseISO } from 'date-fns';
import { ja } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  Mail,
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  Send,
  FileText,
  Filter,
  Printer,
  Search,
  Building2,
  X,
  FileSpreadsheet,
  Download,
  Banknote,
  Stamp,
  Pencil,
  Check,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import {
  useCollections,
  isPurchaseFinalized,
  updateCollection,
  updateCollectionItem,
  setCollectionItemBreakdowns,
} from '@/src/stores/collectionsStore';
import { Collection, CollectionItemBreakdown } from '@/src/types';
import { MOCK_BRANCHES } from '@/src/mockData';
import { useT } from '@/src/stores/i18nStore';

interface MonthlyPurchaseBillingProps {
  selectedBase?: string;
}

interface CustomerGroup {
  customerName: string;
  customerEmail?: string;
  collections: Collection[];
  /** 買取金額の合計 (税抜) */
  totalAmount: number;
  /** 引取送料の合計（送料あり取引先のみ加算） */
  shippingFeeTotal: number;
  /** 取引先が「送料あり」かどうか（案件のうち1件でも送料あり=true） */
  shippingFeeApplicable: boolean;
  /** 差引額 = totalAmount - shippingFeeTotal */
  netAmount: number;
  /** 差引額がマイナスなら請求書モード */
  isInvoiceMode: boolean;
  totalItems: number;
  totalWeight: number;
  allFinalized: boolean;
  allSent: boolean;
  anySent: boolean;
}

/**
 * 案件の買取金額合計を計算。breakdowns があればその allocatedPurchaseAmount 合計、
 * 無ければ items の finalPrice * quantity を集計。
 */
function calcCollectionAmount(c: Collection): number {
  return c.items.reduce((sum, it) => {
    if (it.breakdowns && it.breakdowns.length > 0) {
      return (
        sum +
        it.breakdowns.reduce(
          (s, b) => s + (Number(b.allocatedPurchaseAmount) || 0),
          0,
        )
      );
    }
    return sum + (it.finalPrice || 0) * (it.quantity || 1);
  }, 0);
}

const formatYM = (d: Date) => format(d, 'yyyy-MM');

/**
 * 1セル分の価格入力。Enter/Blur で onCommit を呼ぶ。
 * displayValue は表示用フォーマット（カンマ区切り）に整形される。
 */
function PriceInlineInput({
  initialValue,
  onCommit,
  className,
}: {
  initialValue: number;
  onCommit: (raw: string) => void;
  className?: string;
}) {
  const [val, setVal] = useState<string>(String(initialValue || ''));
  useEffect(() => {
    setVal(String(initialValue || ''));
  }, [initialValue]);
  return (
    <input
      type="text"
      inputMode="numeric"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => {
        if (Number(val) !== initialValue) onCommit(val);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={cn(
        'w-full text-right tabular-nums font-bold bg-amber-50 border border-amber-300 rounded px-1 py-0.5 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-300',
        className,
      )}
      placeholder="0"
    />
  );
}

export function MonthlyPurchaseBilling({ selectedBase: _selectedBase }: MonthlyPurchaseBillingProps) {
  const t = useT();
  const collections = useCollections();
  const today = new Date();

  const [targetMonth, setTargetMonth] = useState<string>(formatYM(today));
  const [searchKeyword, setSearchKeyword] = useState('');
  const [previewCustomerName, setPreviewCustomerName] = useState<string | null>(null);
  const [editEmailFor, setEditEmailFor] = useState<string | null>(null);
  const [editEmailValue, setEditEmailValue] = useState('');
  const [showTaxBreakdown, setShowTaxBreakdown] = useState(true);
  const [editPriceMode, setEditPriceMode] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // ---- 価格編集ヘルパー ----
  /** 親アイテム（分解なし）の単価を更新 */
  const handleUpdateItemPrice = (
    collectionId: string,
    itemId: string,
    rawValue: string,
  ) => {
    const value = Number(rawValue.replace(/[^\d.-]/g, ''));
    if (!Number.isFinite(value) || value < 0) {
      toast.error('正しい金額を入力してください');
      return;
    }
    updateCollectionItem(collectionId, itemId, { finalPrice: Math.round(value) });
  };

  /** breakdown 行の allocatedPurchaseAmount を更新 → アイテム全体の breakdowns を再保存 */
  const handleUpdateBreakdownPrice = (
    collectionId: string,
    itemId: string,
    breakdownId: string,
    rawValue: string,
  ) => {
    const value = Number(rawValue.replace(/[^\d.-]/g, ''));
    if (!Number.isFinite(value) || value < 0) {
      toast.error('正しい金額を入力してください');
      return;
    }
    const target = collections.find((c) => c.id === collectionId);
    if (!target) return;
    const item = target.items.find((it) => it.id === itemId);
    if (!item || !item.breakdowns) return;
    const next: CollectionItemBreakdown[] = item.breakdowns.map((b) =>
      b.id === breakdownId ? { ...b, allocatedPurchaseAmount: Math.round(value) } : b,
    );
    setCollectionItemBreakdowns(collectionId, itemId, next);
  };

  // 消費税率（軽減税率非対応・10%固定）
  const TAX_RATE = 0.1;
  // 振込先（モック）
  const BANK_INFO = {
    bank: '三菱UFJ銀行',
    branch: '茨木支店（普通）',
    accountNumber: '1234567',
    accountHolder: '株式会社サスティナブルガレージ',
    invoiceRegNo: 'T1-2345-6789-0123',
  } as const;

  // Filter collections by selected month
  const monthCollections = useMemo(() => {
    return collections.filter((c) => {
      try {
        const d = parseISO(c.collectionDate);
        const targetDate = parseISO(`${targetMonth}-01`);
        return isSameMonth(d, targetDate) && c.status !== 'cancelled';
      } catch {
        return false;
      }
    });
  }, [collections, targetMonth]);

  // Group by customer
  const customerGroups: CustomerGroup[] = useMemo(() => {
    const map = new Map<string, CustomerGroup>();
    for (const c of monthCollections) {
      const key = c.customerName;
      if (!map.has(key)) {
        map.set(key, {
          customerName: c.customerName,
          customerEmail: c.customerEmail,
          collections: [],
          totalAmount: 0,
          shippingFeeTotal: 0,
          shippingFeeApplicable: false,
          netAmount: 0,
          isInvoiceMode: false,
          totalItems: 0,
          totalWeight: 0,
          allFinalized: true,
          allSent: true,
          anySent: false,
        });
      }
      const g = map.get(key)!;
      g.collections.push(c);
      g.totalAmount += calcCollectionAmount(c);
      // 引取送料あり/なし
      if (c.shippingFeeApplicable) {
        g.shippingFeeApplicable = true;
        g.shippingFeeTotal += Number(c.shippingFeeAmount) || 0;
      }
      g.totalItems += c.items.length;
      g.totalWeight += c.items.reduce((sum, it) => sum + (it.weight || 0), 0);
      if (!isPurchaseFinalized(c)) g.allFinalized = false;
      if (!c.purchaseDetailSentAt) g.allSent = false;
      if (c.purchaseDetailSentAt) g.anySent = true;
      if (!g.customerEmail && c.customerEmail) g.customerEmail = c.customerEmail;
    }
    // 差引額 / 請求書モードを最後に確定
    for (const g of map.values()) {
      g.netAmount = g.totalAmount - g.shippingFeeTotal;
      g.isInvoiceMode = g.shippingFeeApplicable && g.netAmount < 0;
    }
    let arr = Array.from(map.values());
    if (searchKeyword.trim()) {
      const kw = searchKeyword.trim().toLowerCase();
      arr = arr.filter(
        (g) =>
          g.customerName.toLowerCase().includes(kw) ||
          (g.customerEmail || '').toLowerCase().includes(kw),
      );
    }
    return arr.sort((a, b) => b.totalAmount - a.totalAmount);
  }, [monthCollections, searchKeyword]);

  // プレビュー対象は顧客名で保持し、 customerGroups から都度導出（store変更後も同期する）
  const previewGroup =
    previewCustomerName === null
      ? null
      : customerGroups.find((g) => g.customerName === previewCustomerName) || null;

  // プレビューを開いた時、未確定なら自動で編集モードに入る
  useEffect(() => {
    if (previewGroup && !previewGroup.allFinalized) {
      setEditPriceMode(true);
    }
  }, [previewCustomerName]); // eslint-disable-line react-hooks/exhaustive-deps

  const summary = useMemo(() => {
    const totalRevenue = customerGroups.reduce((s, g) => s + g.totalAmount, 0);
    const totalShipping = customerGroups.reduce((s, g) => s + g.shippingFeeTotal, 0);
    const totalNet = customerGroups.reduce((s, g) => s + g.netAmount, 0);
    const finalizedCount = customerGroups.filter((g) => g.allFinalized).length;
    const sentCount = customerGroups.filter((g) => g.allSent && g.collections.length > 0).length;
    const pendingSend = customerGroups.filter(
      (g) => g.allFinalized && !g.allSent,
    ).length;
    const invoiceCount = customerGroups.filter((g) => g.isInvoiceMode).length;
    return {
      customerCount: customerGroups.length,
      totalRevenue,
      totalShipping,
      totalNet,
      finalizedCount,
      sentCount,
      pendingSend,
      invoiceCount,
    };
  }, [customerGroups]);

  const handleSetEmail = (customerName: string) => {
    const target = customerGroups.find((g) => g.customerName === customerName);
    setEditEmailFor(customerName);
    setEditEmailValue(target?.customerEmail || '');
  };

  const handleSaveEmail = () => {
    if (!editEmailFor) return;
    const value = editEmailValue.trim();
    if (!value || !/^\S+@\S+\.\S+$/.test(value)) {
      toast.error('正しいメールアドレスを入力してください');
      return;
    }
    // Update all collections for this customer (within month)
    const target = customerGroups.find((g) => g.customerName === editEmailFor);
    if (!target) return;
    target.collections.forEach((c) => updateCollection(c.id, { customerEmail: value }));
    toast.success(`${editEmailFor} のメールアドレスを設定しました`);
    setEditEmailFor(null);
    setEditEmailValue('');
  };

  const handleSendOne = (group: CustomerGroup) => {
    if (!group.allFinalized) {
      toast.error('買取金額が未確定の品目があります', {
        description: '分別作業で全品目の買取金額を入力してください。',
      });
      return;
    }
    if (!group.customerEmail) {
      toast.error('メールアドレスが未設定です', {
        description: '送付先メールを入力してから再度お試しください。',
      });
      handleSetEmail(group.customerName);
      return;
    }
    const now = new Date().toISOString();
    group.collections.forEach((c) =>
      updateCollection(c.id, {
        purchaseDetailIssued: true,
        purchaseDetailSentAt: now,
      }),
    );
    const docLabel = group.isInvoiceMode ? 'ご請求書' : '買取明細書';
    toast.success(`${group.customerName} へ${docLabel}をメール送付しました`, {
      description: `送付先: ${group.customerEmail} / ${
        group.isInvoiceMode ? 'ご請求' : 'お支払'
      }額 ¥${Math.abs(group.netAmount).toLocaleString()}`,
    });
  };

  const handleSendAll = () => {
    const targets = customerGroups.filter((g) => g.allFinalized && !g.allSent);
    if (targets.length === 0) {
      toast.info('送付対象がありません');
      return;
    }
    const missingEmail = targets.filter((g) => !g.customerEmail);
    if (missingEmail.length > 0) {
      toast.error(`${missingEmail.length} 件の取引先にメールアドレスが未設定です`, {
        description: missingEmail.map((g) => g.customerName).join(', '),
      });
      return;
    }
    const now = new Date().toISOString();
    targets.forEach((g) =>
      g.collections.forEach((c) =>
        updateCollection(c.id, {
          purchaseDetailIssued: true,
          purchaseDetailSentAt: now,
        }),
      ),
    );
    toast.success(`${targets.length} 件の取引先に買取明細書を一括送付しました`, {
      description: `合計 ¥${targets
        .reduce((s, g) => s + g.totalAmount, 0)
        .toLocaleString()}`,
    });
  };

  const monthLabel = format(parseISO(`${targetMonth}-01`), 'yyyy年M月', { locale: ja });
  const hq = MOCK_BRANCHES[0];

  // ============================================================
  // Excel / CSV / PDF 出力ヘルパー
  // ============================================================
  /** 1取引先分の明細を [品目行..., 集計行] の配列で生成 */
  const buildGroupRows = (g: CustomerGroup) => {
    const rows: Array<Record<string, string | number>> = [];
    g.collections.forEach((c) => {
      c.items.forEach((item) => {
        if (item.breakdowns && item.breakdowns.length > 0) {
          item.breakdowns.forEach((b) => {
            const catLabel =
              b.category === 'reuse' ? 'リユース' : b.category === 'rebuilt' ? 'リビルド' : '資源';
            rows.push({
              回収日: c.collectionDate,
              回収番号: c.collectionNumber,
              品名: b.name,
              元品目: item.name,
              区分: catLabel,
              数量: b.quantity,
              重量Kg: b.weight ?? '',
              買取金額: Number(b.allocatedPurchaseAmount) || 0,
            });
          });
        } else {
          const catLabel =
            item.sortingCategory === 'reuse'
              ? 'リユース'
              : item.sortingCategory === 'rebuilt'
                ? 'リビルド'
                : item.sortingCategory === 'recycle'
                  ? '資源'
                  : '';
          rows.push({
            回収日: c.collectionDate,
            回収番号: c.collectionNumber,
            品名: item.name,
            元品目: '',
            区分: catLabel,
            数量: item.quantity,
            重量Kg: item.weight ?? '',
            買取金額: (item.finalPrice || 0) * (item.quantity || 1),
          });
        }
      });
    });
    return rows;
  };

  /** 取引先1社分のExcel出力（ヘッダ・明細・集計を1シートに収める） */
  const handleExportExcelOne = (g: CustomerGroup) => {
    const wb = XLSX.utils.book_new();
    const docTitle = g.isInvoiceMode ? 'ご請求書' : '買取明細書';

    // ヘッダ・取引先情報
    const headerAOA: (string | number)[][] = [
      [docTitle],
      [],
      [`発行日`, format(today, 'yyyy/MM/dd'), '', '対象月', monthLabel],
      [`取引先`, g.customerName, '', 'メール', g.customerEmail || ''],
      [`発行元`, `株式会社サスティナブルガレージ ${hq?.name ?? ''}`],
      [`所在地`, hq?.address ?? ''],
      [`TEL`, hq?.phone ?? '', '', 'Email', hq?.email ?? ''],
      [`登録番号`, BANK_INFO.invoiceRegNo],
      [],
      ['【明細】'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(headerAOA);

    // 明細を続けて書き込み
    const rows = buildGroupRows(g);
    XLSX.utils.sheet_add_json(ws, rows, {
      origin: -1,
      header: ['回収日', '回収番号', '品名', '元品目', '区分', '数量', '重量Kg', '買取金額'],
    });

    // 集計（消費税内訳含む）
    const taxIncluded = Math.round(g.totalAmount * TAX_RATE);
    const summaryAOA: (string | number)[][] = [
      [],
      ['', '', '', '', '', '', '買取金額合計（税抜）', g.totalAmount],
      ['', '', '', '', '', '', '消費税(10%)', taxIncluded],
      ['', '', '', '', '', '', '買取金額合計（税込）', g.totalAmount + taxIncluded],
    ];
    if (g.shippingFeeApplicable) {
      summaryAOA.push(['', '', '', '', '', '', '引取送料（差引）', -g.shippingFeeTotal]);
    }
    summaryAOA.push([
      '',
      '',
      '',
      '',
      '',
      '',
      g.isInvoiceMode ? 'ご請求金額' : 'お支払額（差引）',
      Math.abs(g.netAmount),
    ]);
    if (g.isInvoiceMode) {
      summaryAOA.push([], ['【振込先】'], ['銀行', BANK_INFO.bank], ['支店', BANK_INFO.branch], [
        '口座番号',
        BANK_INFO.accountNumber,
      ], ['口座名義', BANK_INFO.accountHolder]);
    }
    XLSX.utils.sheet_add_aoa(ws, summaryAOA, { origin: -1 });

    // 列幅
    ws['!cols'] = [
      { wch: 12 },
      { wch: 14 },
      { wch: 22 },
      { wch: 18 },
      { wch: 8 },
      { wch: 8 },
      { wch: 22 },
      { wch: 14 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, docTitle);
    const fname = `${targetMonth}_${docTitle}_${g.customerName}.xlsx`.replace(/[\\/:*?"<>|]/g, '_');
    XLSX.writeFile(wb, fname);
    toast.success(`${fname} をダウンロードしました`);
  };

  /** 当月分・全取引先のサマリ＋各社明細をまとめてExcel出力 */
  const handleExportExcelMonthly = () => {
    if (customerGroups.length === 0) {
      toast.info('対象データがありません');
      return;
    }
    const wb = XLSX.utils.book_new();

    // サマリシート
    const summaryRows = customerGroups.map((g) => ({
      取引先: g.customerName,
      メール: g.customerEmail || '',
      案件数: g.collections.length,
      品目数: g.totalItems,
      重量Kg: g.totalWeight,
      買取金額: g.totalAmount,
      引取送料: g.shippingFeeTotal,
      差引: g.netAmount,
      消費税10pct: Math.round(g.totalAmount * TAX_RATE),
      税込: g.totalAmount + Math.round(g.totalAmount * TAX_RATE),
      区分: g.isInvoiceMode ? '請求書' : '買取明細書',
      確定: g.allFinalized ? '済' : '未',
      送付: g.allSent ? '済' : '未',
    }));
    const summaryWs = XLSX.utils.json_to_sheet(summaryRows);
    summaryWs['!cols'] = [
      { wch: 24 },
      { wch: 26 },
      { wch: 6 },
      { wch: 6 },
      { wch: 8 },
      { wch: 12 },
      { wch: 10 },
      { wch: 12 },
      { wch: 10 },
      { wch: 12 },
      { wch: 10 },
      { wch: 6 },
      { wch: 6 },
    ];
    XLSX.utils.book_append_sheet(wb, summaryWs, `${targetMonth} サマリ`);

    // 各取引先の明細シート
    customerGroups.forEach((g) => {
      const rows = buildGroupRows(g);
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [
        { wch: 12 },
        { wch: 14 },
        { wch: 22 },
        { wch: 18 },
        { wch: 8 },
        { wch: 8 },
        { wch: 8 },
        { wch: 14 },
      ];
      // シート名は最大31文字 / 不正文字を除去
      const safe = g.customerName.replace(/[\\/:*?"\[\]]/g, '_').slice(0, 28);
      XLSX.utils.book_append_sheet(wb, ws, safe);
    });

    const fname = `${targetMonth}_買取明細書_全社.xlsx`;
    XLSX.writeFile(wb, fname);
    toast.success(`${fname} をダウンロードしました`, {
      description: `${customerGroups.length} 社分のシートを含みます`,
    });
  };

  /** 1取引先分のCSV出力 */
  const handleExportCsvOne = (g: CustomerGroup) => {
    const rows = buildGroupRows(g);
    const ws = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(ws);
    // BOM付きUTF-8でExcel互換
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${targetMonth}_${g.customerName}.csv`.replace(/[\\/:*?"<>|]/g, '_');
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSVをダウンロードしました');
  };

  /** プレビュー領域をPDF化してダウンロード */
  const handleDownloadPdf = async (g: CustomerGroup) => {
    if (!previewRef.current) {
      toast.error('プレビューが表示されていません');
      return;
    }
    const docTitle = g.isInvoiceMode ? 'ご請求書' : '買取明細書';
    try {
      const canvas = await html2canvas(previewRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      const ratio = canvas.width / canvas.height;
      let imgW = pdfW - 20;
      let imgH = imgW / ratio;
      if (imgH > pdfH - 20) {
        imgH = pdfH - 20;
        imgW = imgH * ratio;
      }
      pdf.addImage(imgData, 'PNG', (pdfW - imgW) / 2, 10, imgW, imgH);
      const fname = `${targetMonth}_${docTitle}_${g.customerName}.pdf`.replace(
        /[\\/:*?"<>|]/g,
        '_',
      );
      pdf.save(fname);
      toast.success('PDFをダウンロードしました');
    } catch (err) {
      console.error(err);
      toast.error('PDF出力に失敗しました');
    }
  };

  return (
    <div className="p-6 space-y-6 bg-[#f8fafc] min-h-full print:bg-white">
      {/* Print stylesheet — hide chrome, show only the receipt itself */}
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body * { visibility: hidden !important; }
          [data-print-target], [data-print-target] * { visibility: visible !important; }
          [data-print-target] { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">
            Monthly Purchase Billing
          </p>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {t('bill.title')}
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            {t('bill.subtitle')}
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] font-black text-slate-400 uppercase">対象月</Label>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="month"
                value={targetMonth}
                onChange={(e) => setTargetMonth(e.target.value)}
                className="h-11 pl-10 w-44 font-bold tabular-nums"
              />
            </div>
          </div>
          <Button
            variant="outline"
            className="h-11 font-bold gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            onClick={handleExportExcelMonthly}
            disabled={summary.customerCount === 0}
          >
            <FileSpreadsheet className="w-4 h-4" />
            {t('col.exportExcel')}
          </Button>
          <Button
            className="h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 shadow-lg shadow-blue-100"
            onClick={handleSendAll}
            disabled={summary.pendingSend === 0}
          >
            <Send className="w-4 h-4" />
            {t('bill.bulkSend')} ({summary.pendingSend})
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-none shadow-sm rounded-2xl">
          <CardContent className="p-5 space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{t('bill.totalCustomers')}</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-slate-900 tabular-nums">
                {summary.customerCount}
              </span>
              <span className="text-[10px] text-slate-400 font-bold">社</span>
            </div>
            <p className="text-[10px] text-slate-400">
              {monthLabel} 対象
              {summary.invoiceCount > 0 && (
                <span className="ml-1 text-red-600 font-bold">
                  / 請求書 {summary.invoiceCount} 社
                </span>
              )}
            </p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm rounded-2xl">
          <CardContent className="p-5 space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">買取合計</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-slate-900 tabular-nums">
                ¥{summary.totalRevenue.toLocaleString()}
              </span>
            </div>
            {summary.totalShipping > 0 ? (
              <p className="text-[10px] text-amber-700 font-bold">
                引取送料 -¥{summary.totalShipping.toLocaleString()}
              </p>
            ) : (
              <p className="text-[10px] text-emerald-600 font-bold">税抜・確定金額ベース</p>
            )}
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm rounded-2xl">
          <CardContent className="p-5 space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">差引お支払額</p>
            <div className="flex items-baseline gap-1">
              <span
                className={cn(
                  'text-2xl font-black tabular-nums',
                  summary.totalNet < 0 ? 'text-red-600' : 'text-emerald-600',
                )}
              >
                ¥{summary.totalNet.toLocaleString()}
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              確定済 {summary.finalizedCount} / {summary.customerCount} 社
            </p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm rounded-2xl">
          <CardContent className="p-5 space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">送付済</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-blue-600 tabular-nums">
                {summary.sentCount}
              </span>
              <span className="text-[10px] text-slate-400 font-bold">/ {summary.customerCount}</span>
            </div>
            <p className="text-[10px] text-amber-700 font-bold">
              未送付: {summary.pendingSend} 件
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="取引先名・メールで検索..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="h-10 pl-9"
          />
        </div>
        <Badge variant="outline" className="text-[10px] font-bold gap-1 px-3 h-10 border-slate-200">
          <Filter className="w-3 h-3" />
          {customerGroups.length} 件表示
        </Badge>
      </div>

      {/* Customer table */}
      <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="text-[11px] font-black text-slate-500 uppercase">取引先</TableHead>
                <TableHead className="text-[11px] font-black text-slate-500 uppercase">メール</TableHead>
                <TableHead className="text-[11px] font-black text-slate-500 uppercase text-right">案件数</TableHead>
                <TableHead className="text-[11px] font-black text-slate-500 uppercase text-right">品目数</TableHead>
                <TableHead className="text-[11px] font-black text-slate-500 uppercase text-right">重量</TableHead>
                <TableHead className="text-[11px] font-black text-slate-500 uppercase text-right">買取合計</TableHead>
                <TableHead className="text-[11px] font-black text-slate-500 uppercase">状態</TableHead>
                <TableHead className="text-[11px] font-black text-slate-500 uppercase text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customerGroups.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-slate-400 text-sm">
                    {monthLabel} に該当する回収案件はありません
                  </TableCell>
                </TableRow>
              )}
              {customerGroups.map((g) => (
                <TableRow key={g.customerName} className="hover:bg-slate-50/60">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{g.customerName}</p>
                        <p className="text-[10px] text-slate-400">
                          {g.collections.map((c) => c.collectionNumber).join(', ')}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {g.customerEmail ? (
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-mono text-slate-700 truncate max-w-[180px]">
                          {g.customerEmail}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-slate-400"
                          onClick={() => handleSetEmail(g.customerName)}
                        >
                          <FileText className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[10px] font-bold text-amber-700 border-amber-200 bg-amber-50 gap-1"
                        onClick={() => handleSetEmail(g.customerName)}
                      >
                        <Mail className="w-3 h-3" /> 設定
                      </Button>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm font-bold text-slate-700">
                    {g.collections.length}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm font-bold text-slate-700">
                    {g.totalItems}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm text-slate-600">
                    {g.totalWeight.toLocaleString()} kg
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    <div className="flex flex-col items-end leading-tight">
                      <span className="font-black text-slate-900">
                        ¥{g.totalAmount.toLocaleString()}
                      </span>
                      {g.shippingFeeApplicable && g.shippingFeeTotal > 0 && (
                        <span className="text-[9px] text-amber-700 font-bold">
                          送料 -¥{g.shippingFeeTotal.toLocaleString()}
                        </span>
                      )}
                      {g.shippingFeeApplicable && (
                        <span
                          className={cn(
                            'text-[10px] font-black',
                            g.netAmount < 0 ? 'text-red-600' : 'text-emerald-600',
                          )}
                        >
                          差引 ¥{g.netAmount.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {g.isInvoiceMode && (
                        <Badge className="bg-red-50 text-red-700 border-none text-[10px] gap-1">
                          <AlertCircle className="w-3 h-3" /> 請求書モード
                        </Badge>
                      )}
                      {g.allSent ? (
                        <Badge className="bg-blue-50 text-blue-700 border-none text-[10px] gap-1">
                          <CheckCircle2 className="w-3 h-3" /> 送付済
                        </Badge>
                      ) : g.allFinalized ? (
                        <Badge className="bg-amber-50 text-amber-700 border-none text-[10px] gap-1">
                          <Send className="w-3 h-3" /> 送付待
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-500 border-none text-[10px] gap-1">
                          <AlertCircle className="w-3 h-3" /> 金額未確定
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          'h-8 text-[10px] font-bold gap-1',
                          !g.allFinalized && 'border-amber-300 text-amber-700 hover:bg-amber-50',
                        )}
                        onClick={() => setPreviewCustomerName(g.customerName)}
                        title={
                          g.allFinalized
                            ? 'プレビュー'
                            : '未確定の品目があります。プレビュー画面で金額を入力できます。'
                        }
                      >
                        {g.allFinalized ? (
                          <>
                            <FileText className="w-3 h-3" /> プレビュー
                          </>
                        ) : (
                          <>
                            <Pencil className="w-3 h-3" /> 価格入力
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-[10px] font-bold gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                        onClick={() => handleExportExcelOne(g)}
                        disabled={!g.allFinalized}
                        title="Excelダウンロード"
                      >
                        <FileSpreadsheet className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        className={cn(
                          'h-8 text-[10px] font-black gap-1',
                          g.allSent
                            ? 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                            : 'bg-blue-600 hover:bg-blue-700 text-white',
                        )}
                        disabled={!g.allFinalized}
                        onClick={() => handleSendOne(g)}
                      >
                        <Send className="w-3 h-3" /> {g.allSent ? '再送' : '送付'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Preview dialog */}
      <Dialog
        open={!!previewGroup}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewCustomerName(null);
            setEditPriceMode(false);
          }
        }}
      >
        <DialogContent className="w-[95vw] sm:max-w-[95vw] md:max-w-3xl lg:max-w-4xl p-0 overflow-hidden bg-white border-none rounded-3xl shadow-2xl">
          {previewGroup && (
            <div className="flex flex-col max-h-[90vh]">
              <div className="bg-slate-900 text-white p-6 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                  <Printer
                    className={cn(
                      'w-5 h-5',
                      previewGroup.isInvoiceMode ? 'text-red-400' : 'text-blue-400',
                    )}
                  />
                  <h3 className="font-black tracking-tight">
                    {monthLabel} {previewGroup.isInvoiceMode ? 'ご請求書' : '買取明細書'}プレビュー
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={editPriceMode ? 'default' : 'outline'}
                    className={cn(
                      'h-8 text-[11px] font-bold gap-1',
                      editPriceMode
                        ? 'bg-amber-400 hover:bg-amber-500 text-slate-900 border-0'
                        : 'bg-transparent border-white/30 text-white/80 hover:bg-white/10 hover:text-white',
                    )}
                    onClick={() => setEditPriceMode((v) => !v)}
                    title="買取金額をその場で編集する"
                  >
                    {editPriceMode ? (
                      <>
                        <Check className="w-3 h-3" /> 編集中（クリックで終了）
                      </>
                    ) : (
                      <>
                        <Pencil className="w-3 h-3" /> 価格を編集
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white/40 hover:text-white"
                    onClick={() => {
                      setEditPriceMode(false);
                      setPreviewCustomerName(null);
                    }}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 bg-slate-100/50">
                <div
                  ref={previewRef}
                  data-print-target
                  className="bg-white p-6 sm:p-8 shadow-sm border border-slate-200 w-full max-w-3xl mx-auto font-sans print:shadow-none print:border-0 print:p-4"
                >
                  <div className="flex justify-between items-start gap-4 mb-8">
                    <div>
                      <div
                        className={cn(
                          'w-10 h-10 rounded flex items-center justify-center mb-4',
                          previewGroup.isInvoiceMode ? 'bg-red-600' : 'bg-blue-600',
                        )}
                      >
                        <FileText className="text-white w-6 h-6" />
                      </div>
                      <h2 className="text-2xl font-bold tracking-widest">
                        {previewGroup.isInvoiceMode ? 'ご請求書' : '買取明細書'}
                      </h2>
                      <p className="text-[10px] text-slate-500 mt-1">
                        {monthLabel} 締め
                        {previewGroup.shippingFeeApplicable && (
                          <span className="ml-2 text-amber-700 font-bold">
                            （引取送料あり）
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="text-right text-[10px] space-y-0.5">
                      <p>発行日: {format(today, 'yyyy/MM/dd')}</p>
                      <p>取引先: {previewGroup.customerName}</p>
                    </div>
                  </div>

                  <div className="flex justify-between items-end border-b-2 border-black pb-2 mb-6">
                    <p className="text-lg font-bold underline underline-offset-4 decoration-1">
                      {previewGroup.customerName} 御中
                    </p>
                    <div className="text-right text-[9px] space-y-0.5">
                      <p className="font-bold">株式会社サスティナブルガレージ {hq?.name ?? ''}</p>
                      <p>{hq?.address ?? ''}</p>
                      <p>TEL: {hq?.phone ?? ''}</p>
                      {hq?.email && <p>Email: {hq.email}</p>}
                    </div>
                  </div>

                  <div
                    className={cn(
                      'p-4 border flex justify-between items-center mb-6',
                      previewGroup.isInvoiceMode ? 'bg-red-50' : 'bg-slate-50',
                    )}
                  >
                    <span className="text-sm font-bold">
                      {previewGroup.isInvoiceMode ? 'ご請求金額' : 'お支払額'}
                    </span>
                    <span className="text-2xl font-bold tabular-nums">
                      ¥{Math.abs(previewGroup.netAmount).toLocaleString()}-
                    </span>
                  </div>

                  {editPriceMode && (
                    <div className="mb-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 flex items-center gap-2 text-[10px] text-amber-800">
                      <Pencil className="w-3 h-3 shrink-0" />
                      <span>
                        買取金額を直接入力できます。値を編集後、Enter または欄の外をクリックで保存します。集計と税抜・税込の表示は自動更新されます。
                      </span>
                    </div>
                  )}
                  <div className="border overflow-hidden rounded-sm mb-4">
                    <table className="w-full border-collapse text-[10px]">
                      <thead>
                        <tr className="bg-slate-50 border-b">
                          <th className="h-8 border-r px-2 text-left">回収日</th>
                          <th className="h-8 border-r px-2 text-left">回収番号</th>
                          <th className="h-8 border-r px-2 text-left">品名</th>
                          <th className="h-8 border-r px-2 text-left w-16">区分</th>
                          <th className="h-8 border-r px-2 text-right w-12">数量</th>
                          <th className="h-8 border-r px-2 text-right w-14">重量Kg</th>
                          <th className="h-8 px-2 text-right w-24">買取金額</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewGroup.collections.flatMap((c) =>
                          c.items.flatMap((item, itemIdx) => {
                            // breakdowns があれば子行を出す。なければ親行のみ。
                            if (item.breakdowns && item.breakdowns.length > 0) {
                              return item.breakdowns.map((b, bdIdx) => {
                                const catLabel =
                                  b.category === 'reuse'
                                    ? 'リユース'
                                    : b.category === 'rebuilt'
                                      ? 'リビルド'
                                      : '資源';
                                const bdEmpty =
                                  !Number(b.allocatedPurchaseAmount) ||
                                  Number(b.allocatedPurchaseAmount) <= 0;
                                return (
                                  <tr
                                    key={`${c.id}-${item.id}-bd-${b.id}-${bdIdx}`}
                                    className={cn(
                                      'border-b',
                                      editPriceMode && bdEmpty && 'bg-amber-50/40',
                                    )}
                                  >
                                    <td className="py-1.5 border-r px-2">{c.collectionDate}</td>
                                    <td className="py-1.5 border-r px-2 font-mono">{c.collectionNumber}</td>
                                    <td className="py-1.5 border-r px-2">
                                      <span className="font-bold">{b.name}</span>
                                      <span className="text-slate-400 ml-1 text-[9px]">
                                        ({item.name})
                                      </span>
                                    </td>
                                    <td className="py-1.5 border-r px-2 text-[9px] text-slate-600">
                                      {catLabel}
                                    </td>
                                    <td className="py-1.5 border-r px-2 text-right tabular-nums">
                                      {b.quantity}
                                    </td>
                                    <td className="py-1.5 border-r px-2 text-right tabular-nums">
                                      {b.weight ? b.weight.toLocaleString() : '-'}
                                    </td>
                                    <td className="py-1.5 px-2 text-right tabular-nums font-bold">
                                      {editPriceMode ? (
                                        <PriceInlineInput
                                          initialValue={Number(b.allocatedPurchaseAmount) || 0}
                                          onCommit={(raw) =>
                                            handleUpdateBreakdownPrice(c.id, item.id, b.id, raw)
                                          }
                                        />
                                      ) : (
                                        <>¥{(Number(b.allocatedPurchaseAmount) || 0).toLocaleString()}</>
                                      )}
                                    </td>
                                  </tr>
                                );
                              });
                            }
                            // 分解なし: 親アイテム1行
                            const itemEmpty = !item.finalPrice || item.finalPrice <= 0;
                            return [
                              <tr
                                key={`${c.id}-${item.id}-${itemIdx}`}
                                className={cn(
                                  'border-b',
                                  editPriceMode && itemEmpty && 'bg-amber-50/40',
                                )}
                              >
                                <td className="py-1.5 border-r px-2">{c.collectionDate}</td>
                                <td className="py-1.5 border-r px-2 font-mono">{c.collectionNumber}</td>
                                <td className="py-1.5 border-r px-2 font-bold">{item.name}</td>
                                <td className="py-1.5 border-r px-2 text-[9px] text-slate-600">
                                  {item.sortingCategory === 'reuse'
                                    ? 'リユース'
                                    : item.sortingCategory === 'rebuilt'
                                      ? 'リビルド'
                                      : item.sortingCategory === 'recycle'
                                        ? '資源'
                                        : '-'}
                                </td>
                                <td className="py-1.5 border-r px-2 text-right tabular-nums">
                                  {item.quantity}
                                </td>
                                <td className="py-1.5 border-r px-2 text-right tabular-nums">
                                  {item.weight ? item.weight.toLocaleString() : '-'}
                                </td>
                                <td className="py-1.5 px-2 text-right tabular-nums font-bold">
                                  {editPriceMode ? (
                                    <div className="flex flex-col items-end gap-0.5">
                                      <PriceInlineInput
                                        initialValue={item.finalPrice || 0}
                                        onCommit={(raw) =>
                                          handleUpdateItemPrice(c.id, item.id, raw)
                                        }
                                      />
                                      <span className="text-[8px] text-slate-400">
                                        単価 × {item.quantity || 1} = ¥
                                        {((item.finalPrice || 0) * (item.quantity || 1)).toLocaleString()}
                                      </span>
                                    </div>
                                  ) : (
                                    <>
                                      ¥{((item.finalPrice || 0) * (item.quantity || 1)).toLocaleString()}
                                    </>
                                  )}
                                </td>
                              </tr>,
                            ];
                          }),
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* 集計 */}
                  <div className="border rounded-sm overflow-hidden mb-4">
                    <table className="w-full border-collapse text-[11px]">
                      <tbody>
                        <tr className="border-b">
                          <td className="py-2 px-3 bg-slate-50 font-bold w-1/2">
                            買取金額合計（税抜）
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums font-bold">
                            ¥{previewGroup.totalAmount.toLocaleString()}
                          </td>
                        </tr>
                        {showTaxBreakdown && (
                          <>
                            <tr className="border-b">
                              <td className="py-2 px-3 bg-slate-50/50 font-bold w-1/2 text-slate-600">
                                消費税（10%）
                              </td>
                              <td className="py-2 px-3 text-right tabular-nums font-bold text-slate-600">
                                ¥{Math.round(previewGroup.totalAmount * TAX_RATE).toLocaleString()}
                              </td>
                            </tr>
                            <tr className="border-b">
                              <td className="py-2 px-3 bg-slate-50/50 font-bold w-1/2 text-slate-600">
                                買取金額合計（税込）
                              </td>
                              <td className="py-2 px-3 text-right tabular-nums font-bold text-slate-600">
                                ¥
                                {(
                                  previewGroup.totalAmount +
                                  Math.round(previewGroup.totalAmount * TAX_RATE)
                                ).toLocaleString()}
                              </td>
                            </tr>
                          </>
                        )}
                        {previewGroup.shippingFeeApplicable && (
                          <tr className="border-b">
                            <td className="py-2 px-3 bg-amber-50 font-bold w-1/2 text-amber-800">
                              引取送料 (差引)
                            </td>
                            <td className="py-2 px-3 text-right tabular-nums font-bold text-amber-800">
                              -¥{previewGroup.shippingFeeTotal.toLocaleString()}
                            </td>
                          </tr>
                        )}
                        <tr
                          className={cn(
                            'border-t-2',
                            previewGroup.isInvoiceMode ? 'bg-red-50' : 'bg-emerald-50',
                          )}
                        >
                          <td className="py-2.5 px-3 font-black w-1/2">
                            {previewGroup.isInvoiceMode ? 'ご請求金額' : 'お支払額（差引）'}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums font-black text-base">
                            ¥{Math.abs(previewGroup.netAmount).toLocaleString()}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* 振込先（請求書モードのみ） */}
                  {previewGroup.isInvoiceMode && (
                    <div className="border-2 border-red-200 rounded-sm p-3 mb-4 bg-red-50/40">
                      <p className="text-[10px] font-black text-red-700 mb-2 flex items-center gap-1">
                        <Banknote className="w-3 h-3" /> 振込先
                      </p>
                      <table className="w-full text-[10px]">
                        <tbody>
                          <tr>
                            <td className="py-0.5 text-slate-500 w-20">銀行名</td>
                            <td className="py-0.5 font-bold">{BANK_INFO.bank}</td>
                          </tr>
                          <tr>
                            <td className="py-0.5 text-slate-500">支店</td>
                            <td className="py-0.5 font-bold">{BANK_INFO.branch}</td>
                          </tr>
                          <tr>
                            <td className="py-0.5 text-slate-500">口座番号</td>
                            <td className="py-0.5 font-bold tabular-nums">
                              {BANK_INFO.accountNumber}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-0.5 text-slate-500">口座名義</td>
                            <td className="py-0.5 font-bold">{BANK_INFO.accountHolder}</td>
                          </tr>
                        </tbody>
                      </table>
                      <p className="text-[9px] text-red-600 mt-2">
                        ※ 振込手数料はお客様にてご負担ください。
                      </p>
                    </div>
                  )}

                  <div className="flex justify-between items-end gap-4">
                    <div className="space-y-1 flex-1">
                      <p className="text-[9px] font-bold">【備考】</p>
                      <div className="border p-2 min-h-[60px] text-[9px] leading-relaxed text-slate-600">
                        {previewGroup.isInvoiceMode
                          ? `下記の通り、${monthLabel} 分の引取送料が買取金額を上回ったため、差額をご請求いたします。`
                          : `下記の通り、${monthLabel} 分の回収品をお買い取りさせていただきました。`}
                        <br />
                        ※ 適格請求書発行事業者登録番号: {BANK_INFO.invoiceRegNo}
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <div className="w-16 h-16 rounded-full border-2 border-red-400 flex items-center justify-center text-red-500 text-[9px] font-black">
                        <Stamp className="w-5 h-5" />
                      </div>
                      <p className="text-[8px] text-slate-400">印</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-white border-t border-slate-100 flex flex-col gap-3 shrink-0">
                <div className="flex items-center gap-3 text-[10px] text-slate-500">
                  <label className="inline-flex items-center gap-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showTaxBreakdown}
                      onChange={(e) => setShowTaxBreakdown(e.target.checked)}
                      className="accent-blue-600"
                    />
                    消費税内訳を表示
                  </label>
                  <span className="text-slate-300">|</span>
                  <span>※ 出力形式: Excel / CSV / PDF / 印刷</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <Button
                    variant="outline"
                    className="h-11 rounded-xl font-bold gap-1 text-[11px] border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    onClick={() => handleExportExcelOne(previewGroup)}
                  >
                    <FileSpreadsheet className="w-4 h-4" /> Excel
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 rounded-xl font-bold gap-1 text-[11px]"
                    onClick={() => handleExportCsvOne(previewGroup)}
                  >
                    <Download className="w-4 h-4" /> CSV
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 rounded-xl font-bold gap-1 text-[11px]"
                    onClick={() => handleDownloadPdf(previewGroup)}
                  >
                    <FileText className="w-4 h-4" /> PDF
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 rounded-xl font-bold gap-1 text-[11px]"
                    onClick={() => window.print()}
                  >
                    <Printer className="w-4 h-4" /> 印刷
                  </Button>
                  <Button
                    className={cn(
                      'h-11 text-white rounded-xl font-black gap-1 text-[11px]',
                      previewGroup.isInvoiceMode
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-blue-600 hover:bg-blue-700',
                    )}
                    onClick={() => {
                      handleSendOne(previewGroup);
                      setPreviewCustomerName(null);
                      setEditPriceMode(false);
                    }}
                  >
                    <Send className="w-4 h-4" />
                    {previewGroup.isInvoiceMode ? '請求書送付' : 'メール送付'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit email dialog */}
      <Dialog open={!!editEmailFor} onOpenChange={(open) => !open && setEditEmailFor(null)}>
        <DialogContent className="w-[95vw] sm:max-w-[95vw] md:max-w-md p-0 overflow-hidden bg-white border-none rounded-3xl shadow-2xl">
          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-600" />
                送付先メール設定
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full text-slate-400"
                onClick={() => setEditEmailFor(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-slate-500 uppercase">取引先</Label>
              <p className="text-sm font-bold text-slate-800">{editEmailFor}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-slate-500 uppercase">メールアドレス *</Label>
              <Input
                type="email"
                value={editEmailValue}
                onChange={(e) => setEditEmailValue(e.target.value)}
                placeholder="example@company.co.jp"
                className="h-11"
                autoFocus
              />
              <p className="text-[10px] text-slate-400">
                ※ 当月の全案件に同じメールアドレスが反映されます。
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                variant="ghost"
                className="flex-1 h-11 rounded-xl text-slate-500 font-bold"
                onClick={() => setEditEmailFor(null)}
              >
                キャンセル
              </Button>
              <Button
                className="flex-[2] h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black"
                onClick={handleSaveEmail}
              >
                保存
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default MonthlyPurchaseBilling;
