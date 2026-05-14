import React, { useState } from 'react';
import {
  Camera,
  CheckCircle2,
  ArrowLeft,
  Info,
  Package,
  MapPin,
  Truck,
  Printer
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, subDays } from 'date-fns';
import { ja } from 'date-fns/locale';
import { MOCK_BRANCHES } from '@/src/mockData';
import { useT } from '@/src/stores/i18nStore';

interface CollectorReportProps {
  onBack: () => void;
  initialTab?: 'report' | 'history';
}

export function CollectorReport({ onBack, initialTab = 'report' }: CollectorReportProps) {
  const t = useT();
  const [activeTab, setActiveTab] = useState<'report' | 'history'>(initialTab);
  const [step, setStep] = useState(1);
  const [photoTaken, setPhotoTaken] = useState(false);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [receiptIssued, setReceiptIssued] = useState(false);

  const today = new Date();
  const todayLabel = format(today, 'yyyy-MM-dd');
  const todayJp = format(today, 'yyyy年M月d日(E)', { locale: ja });
  const collectionNo = `C-${format(today, 'yyyyMMdd')}-002`;
  const hq = MOCK_BRANCHES[0]; // 先頭支店を本社窓口として参照

  const mockHistory = [
    { id: 'ch1', date: format(subDays(today, 1), 'yyyy-MM-dd'), client: '佐藤 健一', location: '東京都杉並区...', items: 3, status: 'approved' },
    { id: 'ch2', date: format(subDays(today, 1), 'yyyy-MM-dd'), client: '株式会社オート', location: '埼玉県さいたま市...', items: 12, status: 'pending' },
    { id: 'ch3', date: format(subDays(today, 2), 'yyyy-MM-dd'), client: '鈴木 恵子', location: '神奈川県横浜市...', items: 2, status: 'approved' },
  ];

  const handleComplete = () => {
    toast.success(editingReportId ? t('creport.reportEdited') : t('creport.reportSent'), {
      description: t('creport.completionDesc'),
    });
    onBack();
  };

  const handleEdit = (id: string) => {
    setEditingReportId(id);
    setActiveTab('report');
    setStep(2);
  };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
      {/* Header */}
      <div className="bg-white px-6 py-3 border-b sticky top-0 z-10 flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="text-[#64748b]">
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <h2 className="font-bold text-lg text-[#1e293b]">
            {activeTab === 'report' ? (editingReportId ? t('creport.editTitle') : t('creport.title')) : t('creport.historyTitle')}
          </h2>
        </div>
        
        {!editingReportId && (
          <div className="flex p-1 bg-slate-100 rounded-lg">
            <button 
              onClick={() => setActiveTab('report')}
              className={cn(
                "flex-1 py-2 text-xs font-bold rounded-md transition-all",
                activeTab === 'report' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
              )}
            >
              {t('creport.newReport')}
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={cn(
                "flex-1 py-2 text-xs font-bold rounded-md transition-all",
                activeTab === 'history' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
              )}
            >
              {t('creport.history')}
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'report' ? (
          <div className="p-6 space-y-8">
            {/* Step Indicator */}
            {!editingReportId && (
              <div className="flex items-center justify-between px-4 relative">
                {[1, 2, 3].map((s) => (
                  <div key={s} className="flex flex-col items-center gap-2 relative z-10">
                    <div className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all",
                      step === s ? "bg-[#2563eb] text-white shadow-lg shadow-blue-200" : 
                      step > s ? "bg-[#10b981] text-white" : "bg-[#e2e8f0] text-[#64748b]"
                    )}>
                      {step > s ? <CheckCircle2 className="w-5 h-5" /> : s}
                    </div>
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-wider",
                      step === s ? "text-[#2563eb]" : "text-[#64748b]"
                    )}>
                      {s === 1 ? t('creport.arriveSite') : s === 2 ? t('creport.checkContent') : t('creport.completionReport')}
                    </span>
                  </div>
                ))}
                <div className="absolute left-12 right-12 top-[18px] h-0.5 bg-[#e2e8f0] -z-0"></div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4">
                <Card className="border-[#e2e8f0] shadow-none rounded-lg">
                  <CardContent className="p-6 space-y-5">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-50 rounded-lg text-[#2563eb]">
                        <Truck className="w-8 h-8" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-[#1e293b]">佐藤 健一 様</h3>
                        <p className="text-sm text-[#64748b]">{t('creport.collectionNo')}: {collectionNo}</p>
                      </div>
                    </div>
                    <Separator className="bg-[#e2e8f0]" />
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                      <p className="text-xs text-slate-600 leading-relaxed font-medium">
                        東京都杉並区阿佐谷南 1-2-3<br/>阿佐谷マンション 201号室
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <div className="bg-blue-50 border border-blue-100 rounded-lg p-5 flex gap-4">
                  <Info className="w-5 h-5 text-blue-600 shrink-0" />
                  <p className="text-xs text-blue-800 leading-relaxed font-medium">
                    {t('creport.arriveTip')}
                  </p>
                </div>

                <Button 
                  className="w-full h-14 bg-[#2563eb] hover:bg-[#1e40af] rounded-lg font-bold text-lg border-none"
                  onClick={() => setStep(2)}
                >
                  {t('creport.startReport')}
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4">
                <div className="space-y-3">
                  <h3 className="font-bold text-[#1e293b] text-base">{t('creport.itemList')}</h3>
                  <div className="space-y-3">
                    {[
                      { name: 'エンジン (プリウス)', qty: 1 },
                      { name: 'ドアミラー (アクア)', qty: 2 }
                    ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-5 bg-white rounded-lg border border-[#e2e8f0]">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          <span className="text-sm font-bold text-[#1e293b]">{item.name}</span>
                        </div>
                        <span className="text-xs font-bold text-slate-500">x{item.qty}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="font-bold text-[#1e293b] text-base">{t('creport.transportFee')}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">{t('creport.feeCategory')}</label>
                      <Select defaultValue="paid">
                        <SelectTrigger className="h-12 bg-white rounded-lg border-[#e2e8f0]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free">{t('creport.feeFree')}</SelectItem>
                          <SelectItem value="paid">{t('creport.feePaid')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">{t('creport.actualFee')}</label>
                      <Input type="number" defaultValue={3000} className="h-12 bg-white rounded-lg border-[#e2e8f0]" />
                    </div>
                  </div>
                  <Input placeholder={t('creport.specialNotes')} className="h-12 bg-white rounded-lg border-[#e2e8f0]" />
                </div>

                <Button 
                  className="w-full h-14 bg-[#2563eb] hover:bg-[#1e40af] rounded-lg font-bold text-lg border-none"
                  onClick={() => setStep(3)}
                >
                  {editingReportId ? t('creport.saveContent') : t('creport.inspectDone')}
                </Button>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-[#1e293b] text-base">{t('creport.loadingPhoto')}</h3>
                  </div>
                  <button 
                    onClick={() => setPhotoTaken(true)}
                    className={cn(
                      "w-full aspect-video rounded-lg flex flex-col items-center justify-center gap-4 border-2 border-dashed transition-all",
                      photoTaken ? "bg-emerald-50 border-[#10b981] text-[#10b981]" : "bg-white border-[#e2e8f0] text-[#64748b]"
                    )}
                  >
                    {photoTaken ? (
                      <>
                        <CheckCircle2 className="w-12 h-12" />
                        <p className="font-bold">{t('creport.photoTaken')}</p>
                      </>
                    ) : (
                      <>
                        <Camera className="w-12 h-12" />
                        <p className="font-bold">{t('creport.tapPhotoLoad')}</p>
                      </>
                    )}
                  </button>
                </div>

                <div className="space-y-4">
                   <h3 className="font-bold text-[#1e293b] text-base">{t('creport.receiptIssue')}</h3>
                   <Button 
                    variant={receiptIssued ? "outline" : "secondary"}
                    className={cn(
                      "w-full h-14 gap-2 font-bold text-lg rounded-xl",
                      !receiptIssued && "bg-slate-100 text-slate-900 hover:bg-slate-200"
                    )}
                    onClick={() => setIsPreviewOpen(true)}
                  >
                    <Printer className="w-5 h-5" /> 
                    {receiptIssued ? t('creport.receiptShow') : t('creport.receiptIssueAction')}
                  </Button>
                  {receiptIssued && (
                    <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> {t('creport.receiptIssued')}
                    </p>
                  )}
                </div>

                <Card className="border-none shadow-none bg-blue-50 rounded-lg">
                  <CardContent className="p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-[#2563eb] rounded-lg text-white">
                        <Truck className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-[#2563eb] uppercase tracking-wider">{t('creport.completedItems')}</p>
                        <p className="text-2xl font-black text-[#2563eb]">3 <span className="text-sm font-normal">{t('creport.itemsLabel')}</span></p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-blue-400">{t('creport.expectedTime')}</p>
                      <p className="text-[10px] text-blue-400">{t('creport.actualTime')}</p>
                    </div>
                  </CardContent>
                </Card>

                <Button 
                  className="w-full h-14 bg-[#10b981] hover:bg-[#059669] rounded-lg font-bold text-lg border-none"
                  onClick={handleComplete}
                  disabled={!photoTaken || !receiptIssued}
                >
                  {editingReportId ? t('creport.submitEdit') : t('creport.submitDone')}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 space-y-4">
            {mockHistory.map((h) => (
              <Card key={h.id} className="border-none shadow-none rounded-xl bg-white overflow-hidden p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-bold text-[#1e293b]">{h.client}</h4>
                    <p className="text-[10px] text-[#64748b]">{h.date} · {h.location}</p>
                  </div>
                  <Badge className={cn(
                    "border-none text-[10px] font-bold",
                    h.status === 'approved' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                  )}>
                    {h.status === 'approved' ? t('creport.completed') : t('creport.checking')}
                  </Badge>
                </div>
                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
                  <div className="flex gap-4">
                    <div>
                      <p className="text-[9px] text-slate-400 font-bold">{t('creport.itemsField')}</p>
                      <p className="text-sm font-bold text-slate-700">{h.items}{t('collector.points')}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-slate-400 font-bold">{t('creport.transportField')}</p>
                      <p className="text-sm font-bold text-slate-700">¥3,000</p>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 text-[11px] font-bold text-blue-600 border-blue-100 bg-white"
                    onClick={() => handleEdit(h.id)}
                  >
                    {t('creport.editContent')}
                  </Button>
                </div>
              </Card>
            ))}
            {mockHistory.length === 0 && (
              <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3 italic">
                <Truck className="w-12 h-12 opacity-20" />
                <p className="text-xs">{t('creport.noHistory')}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Receipt Preview Modal */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-[95vw] w-full sm:max-w-3xl max-h-[90vh] overflow-y-auto p-0 border-none">
          <div className="bg-white p-6 sm:p-10 font-sans">
            <div className="flex justify-between items-start mb-8">
              <div>
                <div className="w-10 h-10 bg-blue-600 rounded flex items-center justify-center mb-3">
                  <Package className="text-white w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold tracking-widest">{t('creport.receiptHeader')}</h2>
              </div>
              <div className="text-right text-[10px] space-y-0.5 text-slate-500">
                <p>No: {collectionNo}</p>
                <p>{t('creport.dateLabel')}: {todayJp}</p>
              </div>
            </div>

            <div className="flex justify-between items-end border-b-2 border-black pb-2 mb-6">
              <div>
                <p className="text-base font-bold underline underline-offset-4 decoration-1">
                  佐藤 健一 {t('creport.toCustomer')}
                </p>
              </div>
              <div className="text-right text-[9px] space-y-0.5">
                <p className="font-bold">{t('creport.companyHQ')} {hq?.name ?? ''}</p>
                <p>{hq?.address ?? ''}</p>
                <p>TEL: {hq?.phone ?? ''}</p>
              </div>
            </div>

            {/* 受領書には金額を載せない (買取金額は分別作業で確定後、買取明細書に記載) */}

            <div className="border-t border-x mb-6">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow className="h-7">
                    <TableHead className="text-[9px] h-7 border-r px-2">{t('creport.itemNameCol')}</TableHead>
                    <TableHead className="text-[9px] h-7 border-r text-right w-12 px-2">{t('creport.qtyCol')}</TableHead>
                    <TableHead className="text-[9px] h-7 text-right w-16 px-2">{t('creport.weightCol')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { name: 'エンジン (プリウス)', qty: 1, weight: 120 },
                    { name: 'ドアミラー (アクア)', qty: 2, weight: 4 },
                    { name: 'バンパー一式', qty: 1, weight: 8 },
                  ].map((item, idx) => (
                    <TableRow key={idx} className="h-auto border-b">
                      <TableCell className="text-[9px] py-2 border-r px-2">
                        <div className="font-bold">{item.name}</div>
                      </TableCell>
                      <TableCell className="text-[9px] py-2 border-r text-right px-2">{item.qty}</TableCell>
                      <TableCell className="text-[9px] py-2 text-right px-2">
                        {item.weight}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-1 mb-8">
              <p className="text-[9px] font-bold">{t('creport.notesLabel')}</p>
              <div className="border p-2 min-h-[40px] text-[9px] leading-relaxed text-slate-600">
                {t('creport.gratitudeText')}
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-12" onClick={() => setIsPreviewOpen(false)}>
                {t('creport.back')}
              </Button>
              <Button className="flex-1 h-12 bg-blue-600" onClick={() => {
                setReceiptIssued(true);
                setIsPreviewOpen(false);
                toast.success(t('creport.receiptIssuedToast'));
              }}>
                {t('creport.confirmIssue')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
