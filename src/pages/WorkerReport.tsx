import React, { useState } from 'react';
import {
  Camera,
  CheckCircle2,
  ArrowLeft,
  Info,
  Package,
  Award,
  Truck,
  Boxes,
  ClipboardList,
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SORTING_CATEGORIES } from '@/src/constants';
import { format, subDays } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useT } from '@/src/stores/i18nStore';

interface WorkerReportProps {
  onBack: () => void;
  initialTab?: 'report' | 'history';
}

export function WorkerReport({ onBack, initialTab = 'report' }: WorkerReportProps) {
  const t = useT();
  const [activeTab, setActiveTab] = useState<'report' | 'history'>(initialTab);
  const [step, setStep] = useState(1);
  const [photoTaken, setPhotoTaken] = useState(false);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [currentTaskType, setCurrentTaskType] = useState<'collection' | 'sorting' | 'production'>('production'); 
  const [sortingCategory, setSortingCategory] = useState<string>('');
  const [buybackAmount, setBuybackAmount] = useState<string>('');
  const [weightQty, setWeightQty] = useState<string>('');
  const [shelfLocation, setShelfLocation] = useState<string>('');
  const [qualityRank, setQualityRank] = useState<string>('B');
  const [customerName, setCustomerName] = useState<string>('');
  const [pickupFee, setPickupFee] = useState<string>('3000');
  const [checks, setChecks] = useState<Record<string, boolean>>({
    cleaning: false,
    inspection: false,
    photography: false,
    packing: false,
  });

  const mockHistory = [
    { id: 'h1', date: format(new Date(), 'yyyy-MM-dd'), task: '商品化作業', target: 'プリウス エンジン', qty: 1, type: 'production', status: 'approved' },
    { id: 'h2', date: format(new Date(), 'yyyy-MM-dd'), task: '荷下・分別作業', target: '田中自動車 回収品', qty: 4, type: 'sorting', status: 'pending' },
    { id: 'h3', date: format(subDays(new Date(), 1), 'yyyy-MM-dd'), task: '回収業務', target: '佐藤 健一 様', qty: 3, type: 'collection', status: 'approved' },
  ];

  const handleComplete = () => {
    toast.success(editingReportId ? t('report.reportEdited') : t('report.reportSent'), {
      description: currentTaskType === 'production'
        ? t('report.productizeDone')
        : t('report.sortingDone'),
    });
    onBack();
  };

  const handleEdit = (id: string) => {
    const report = mockHistory.find(h => h.id === id);
    if (report) {
      setEditingReportId(id);
      setCurrentTaskType(report.type as any);
      setActiveTab('report');
      setStep(2);
      setPhotoTaken(true);
      // Mock populating some fields based on type
      if (report.type === 'sorting') {
        setSortingCategory('reuse');
        setBuybackAmount('5000');
        setWeightQty('1');
      } else {
        setShelfLocation('B-201');
        setQualityRank('A');
        setChecks({
          cleaning: true,
          inspection: true,
          photography: true,
          packing: false,
        });
      }
    }
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
            {activeTab === 'report' ? (editingReportId ? t('report.editReport') : t('report.workReport')) : t('report.history')}
          </h2>
        </div>
        
        {!editingReportId && (
          <div className="flex gap-2">
            <Button 
              variant={activeTab === 'report' ? 'default' : 'outline'}
              className={cn(
                "flex-1 h-11 rounded-xl font-bold transition-all gap-2",
                activeTab === 'report' ? "bg-blue-600 shadow-md shadow-blue-100" : "text-slate-500 border-slate-200"
              )}
              onClick={() => setActiveTab('report')}
            >
              <ClipboardList className="w-4 h-4" />
              {t('report.newReport')}
            </Button>
            <Button 
              variant={activeTab === 'history' ? 'default' : 'outline'}
              className={cn(
                "flex-1 h-11 rounded-xl font-bold transition-all gap-2",
                activeTab === 'history' ? "bg-slate-800 text-white" : "text-slate-500 border-slate-200"
              )}
              onClick={() => setActiveTab('history')}
            >
              <Settings className="w-4 h-4" />
              {t('report.checkHistory')}
            </Button>
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
                      {s === 1 ? t('report.startCheck') : s === 2 ? t('report.actualWork') : t('report.completionReport')}
                    </span>
                  </div>
                ))}
                {/* Connecting Lines */}
                <div className="absolute left-12 right-12 top-[18px] h-0.5 bg-[#e2e8f0] -z-0"></div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-700">{t('report.selectTaskType')}</h3>
                  <div className="grid grid-cols-3 gap-2">
                    <button 
                      onClick={() => setCurrentTaskType('collection')}
                      className={cn(
                        "p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all h-28",
                        currentTaskType === 'collection' ? "border-amber-600 bg-amber-50" : "border-slate-100 bg-white"
                      )}
                    >
                      <Truck className={cn("w-6 h-6", currentTaskType === 'collection' ? "text-amber-600" : "text-slate-400")} />
                      <span className="text-[10px] font-bold">{t('report.collectionWork')}</span>
                    </button>
                    <button 
                      onClick={() => setCurrentTaskType('sorting')}
                      className={cn(
                        "p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all h-28",
                        currentTaskType === 'sorting' ? "border-purple-600 bg-purple-50" : "border-slate-100 bg-white"
                      )}
                    >
                      <Boxes className={cn("w-6 h-6", currentTaskType === 'sorting' ? "text-purple-600" : "text-slate-400")} />
                      <span className="text-[10px] font-bold">{t('report.unloadingSorting')}</span>
                    </button>
                    <button 
                      onClick={() => setCurrentTaskType('production')}
                      className={cn(
                        "p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all h-28",
                        currentTaskType === 'production' ? "border-blue-600 bg-blue-50" : "border-slate-100 bg-white"
                      )}
                    >
                      <Award className={cn("w-6 h-6", currentTaskType === 'production' ? "text-blue-600" : "text-slate-400")} />
                      <span className="text-[10px] font-bold">{t('report.productizationWork')}</span>
                    </button>
                  </div>
                </div>

                <Card className="border-[#e2e8f0] shadow-none rounded-lg">
                  <CardContent className="p-6 space-y-5">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-50 rounded-lg text-[#2563eb]">
                        <Package className="w-8 h-8" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-[#1e293b]">トヨタ プリウス エンジン</h3>
                        <p className="text-sm text-[#64748b]">管理番号: GP-{format(new Date(), 'yyyyMMdd')}-001</p>
                      </div>
                    </div>
                    <Separator className="bg-[#e2e8f0]" />
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-2 font-medium">{t('report.workContent')}</p>
                        <Badge className="bg-blue-50 text-[#2563eb] border-none font-bold">
                          {currentTaskType === 'sorting' ? t('report.unloadingSorting') : t('report.productizationWork')}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-2 font-medium">{t('report.priority')}</p>
                        <Badge className="bg-red-50 text-[#ef4444] border-none font-bold">{t('report.urgent')}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="bg-amber-50 border border-amber-100 rounded-lg p-5 flex gap-4">
                  <Info className="w-5 h-5 text-amber-600 shrink-0" />
                  <p className="text-xs text-amber-800 leading-relaxed font-medium">
                    {t('report.startWorkConfirm')}
                  </p>
                </div>

                <Button
                  className="w-full h-14 bg-[#2563eb] hover:bg-[#1e40af] rounded-lg font-bold text-lg border-none"
                  onClick={() => setStep(2)}
                >
                  {t('report.startWork')}
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4">
                {currentTaskType === 'collection' ? (
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <h3 className="font-bold text-[#1e293b] text-base">{t('report.customerInfo')} <span className="text-red-500 text-xs">{t('report.required')}</span></h3>
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('report.customerName')}</label>
                          <Input
                            placeholder="例: 佐藤 健一 様"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            className="h-12 bg-white rounded-lg border-[#e2e8f0]"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('report.pickupFee')}</label>
                            <Input
                              type="number"
                              value={pickupFee}
                              onChange={(e) => setPickupFee(e.target.value)}
                              className="h-12 bg-white rounded-lg border-[#e2e8f0]"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('report.itemCount')}</label>
                            <Input
                              type="number"
                              value={weightQty}
                              onChange={(e) => setWeightQty(e.target.value)}
                              className="h-12 bg-white rounded-lg border-[#e2e8f0]"
                            />
                          </div>
                        </div>
                        <Input placeholder={t('report.locationDetail')} className="h-12 bg-white rounded-lg border-[#e2e8f0]" />
                      </div>
                    </div>
                  </div>
                ) : currentTaskType === 'sorting' ? (
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <h3 className="font-bold text-[#1e293b] text-base">{t('report.threeCategory')} <span className="text-red-500 text-xs">{t('report.required')}</span></h3>
                      <div className="grid grid-cols-1 gap-3">
                        {SORTING_CATEGORIES.map((cat) => (
                          <button
                            key={cat.id}
                            onClick={() => setSortingCategory(cat.id)}
                            className={cn(
                              "p-4 rounded-xl border-2 text-left transition-all",
                              sortingCategory === cat.id 
                                ? "border-blue-600 bg-blue-50/50 shadow-sm" 
                                : "border-[#e2e8f0] bg-white hover:border-blue-200"
                            )}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-sm text-[#1e293b]">{cat.label}</span>
                              {sortingCategory === cat.id && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                            </div>
                            <p className="text-[10px] text-slate-500">{cat.desc}</p>
                            {sortingCategory === 'reuse' && cat.id === 'reuse' && (
                              <div className="mt-2 text-[8px] bg-blue-100 text-blue-700 px-2 py-1 rounded-sm font-bold flex items-center gap-1">
                                <Info className="w-2.5 h-2.5" /> {t('report.productizeWaiting')}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h3 className="font-bold text-[#1e293b] text-base">{t('report.productInfo')} <span className="text-red-500 text-xs">{t('report.required')}</span></h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('report.buybackAmount')}</label>
                          <Input 
                            type="number" 
                            placeholder="0" 
                            value={buybackAmount}
                            onChange={(e) => setBuybackAmount(e.target.value)}
                            className="h-12 bg-white rounded-lg border-[#e2e8f0]" 
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('report.qtyOrWeight')}</label>
                          <div className="flex gap-2">
                            <Input 
                              type="number" 
                              placeholder="0" 
                              value={weightQty}
                              onChange={(e) => setWeightQty(e.target.value)}
                              className="h-12 bg-white rounded-lg border-[#e2e8f0] flex-1" 
                            />
                            <Select defaultValue="qty">
                              <SelectTrigger className="w-16 h-12 bg-white rounded-lg border-[#e2e8f0]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="qty">{t('report.unitPiece')}</SelectItem>
                                <SelectItem value="kg">kg</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                      <Input placeholder={t('report.notesMisc')} className="h-12 bg-white rounded-lg border-[#e2e8f0]" />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <h3 className="font-bold text-[#1e293b] text-base">{t('report.checklist')}</h3>
                      <div className="space-y-2">
                        {[
                          { id: 'cleaning', label: t('report.cleaning') },
                          { id: 'inspection', label: t('report.inspection') },
                          { id: 'photography', label: t('report.photography5') },
                          { id: 'packing', label: t('report.packingDone') },
                        ].map((item) => (
                          <button
                            key={item.id}
                            onClick={() => setChecks(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                            className={cn(
                              "w-full flex items-center justify-between p-4 rounded-xl border transition-all",
                              checks[item.id] ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-white border-slate-200 text-slate-600"
                            )}
                          >
                            <span className="text-sm font-bold">{item.label}</span>
                            <div className={cn(
                              "w-5 h-5 rounded flex items-center justify-center border-2 transition-all",
                              checks[item.id] ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-200"
                            )}>
                              {checks[item.id] && <CheckCircle2 className="w-4 h-4" />}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h3 className="font-bold text-[#1e293b] text-base">{t('report.qualityInfo')} <span className="text-red-500 text-xs">{t('report.required')}</span></h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('report.qualityRank')}</label>
                          <Select value={qualityRank} onValueChange={setQualityRank}>
                            <SelectTrigger className="h-12 bg-white rounded-lg border-[#e2e8f0]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="S">新品同様 (S)</SelectItem>
                              <SelectItem value="A">ランク A</SelectItem>
                              <SelectItem value="B">ランク B</SelectItem>
                              <SelectItem value="C">ランク C</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('report.shelfNumber')}</label>
                          <Input 
                            placeholder="例: A-102" 
                            value={shelfLocation}
                            onChange={(e) => setShelfLocation(e.target.value)}
                            className="h-12 bg-white rounded-lg border-[#e2e8f0]" 
                          />
                        </div>
                      </div>
                      <Input placeholder={t('report.specialNotes')} className="h-12 bg-white rounded-lg border-[#e2e8f0]" />
                    </div>
                  </div>
                )}

                <Button 
                  className="w-full h-14 bg-[#2563eb] hover:bg-[#1e40af] rounded-lg font-bold text-lg border-none"
                  onClick={() => setStep(3)}
                  disabled={
                    (currentTaskType === 'collection' && (!customerName || !weightQty)) ||
                    (currentTaskType === 'sorting' && (!sortingCategory || !buybackAmount || !weightQty)) ||
                    (currentTaskType === 'production' && !shelfLocation)
                  }
                >
                  {editingReportId ? t('report.saveContent') : t('report.completeWork')}
                </Button>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                <div className="space-y-3">
                  <h3 className="font-bold text-[#1e293b] text-base">{t('report.completionPhoto')}</h3>
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
                        <p className="font-bold">{t('report.photoTaken')}</p>
                      </>
                    ) : (
                      <>
                        <Camera className="w-12 h-12" />
                        <p className="font-bold">{t('report.tapToCapture')}</p>
                      </>
                    )}
                  </button>
                </div>

                <Card className="border-none shadow-none bg-blue-50 rounded-lg">
                  <CardContent className="p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-[#2563eb] rounded-lg text-white">
                        <Award className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-[#2563eb] uppercase tracking-wider">{t('report.expectedReward')}</p>
                        <p className="text-2xl font-black text-[#2563eb]">
                          {currentTaskType === 'production' ? '¥800' : '¥500'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-blue-400">{t('report.standardTime')}</p>
                      <p className="text-[10px] text-blue-400">{t('report.actualTime')}</p>
                    </div>
                  </CardContent>
                </Card>

                <Button 
                  className="w-full h-14 bg-[#10b981] hover:bg-[#059669] rounded-lg font-bold text-lg border-none"
                  onClick={handleComplete}
                  disabled={!photoTaken}
                >
                  {editingReportId ? t('report.submitEdit') : t('report.submitDone')}
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
                    <div className="flex items-center gap-2">
                       <h4 className="font-bold text-[#1e293b]">{h.target}</h4>
                       <Badge variant="outline" className="text-[8px] h-4 py-0 border-slate-200 text-slate-500">
                         {h.type === 'production' ? t('report.production') : t('report.sorting')}
                       </Badge>
                    </div>
                    <p className="text-[10px] text-[#64748b]">{h.date} · {h.task}</p>
                  </div>
                  <Badge className={cn(
                    "border-none text-[10px] font-bold",
                    h.status === 'approved' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                  )}>
                    {h.status === 'approved' ? t('report.approved') : t('report.checking')}
                  </Badge>
                </div>
                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
                  <div className="flex gap-4">
                    <div>
                      <p className="text-[9px] text-slate-400 font-bold">{t('report.qty')}</p>
                      <p className="text-sm font-bold text-slate-700">{h.qty}{t('report.unitPiece')}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-slate-400 font-bold">{t('report.reward')}</p>
                      <p className="text-sm font-bold text-slate-700">¥450</p>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 text-[11px] font-bold text-blue-600 border-blue-100 bg-white"
                    onClick={() => handleEdit(h.id)}
                  >
                    {t('report.editContent')}
                  </Button>
                </div>
              </Card>
            ))}
            {mockHistory.length === 0 && (
              <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3 italic">
                <CheckCircle2 className="w-12 h-12 opacity-20" />
                <p className="text-xs">{t('report.noHistory')}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
