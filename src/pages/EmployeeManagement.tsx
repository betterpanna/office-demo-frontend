import React, { useState } from 'react';
import {
  Users,
  Clock,
  Award,
  Settings,
  Search,
  Plus,
  ChevronRight,
  TrendingUp,
  Calendar,
  MapPin,
  Briefcase,
  Star,
  MessageSquare,
  BarChart3,
  Phone,
  Mail,
  Download,
  Trash2
} from 'lucide-react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogTrigger
} from '@/components/ui/dialog';
import { MOCK_USERS, MOCK_BRANCHES, MOCK_POSITIONS, MOCK_ATTENDANCE } from '../mockData';
import type { BranchMaster, User, TaskMaster, TaskType } from '../types';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { format, isBefore, setDate, startOfMonth } from 'date-fns';
import {
  useTaskMasters,
  addTaskMaster,
  updateTaskMaster,
  deleteTaskMaster,
  TASK_TYPES,
  TASK_TYPE_LABELS,
} from '@/src/stores/taskMastersStore';
import {
  useWorkingHours,
  upsertWorkingHours,
  getWorkingHoursFor,
  WorkingHours,
} from '@/src/stores/workingHoursStore';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ClipboardList, Wrench, Edit3, Truck, Save, Pencil } from 'lucide-react';
import {
  useCustomers,
  addCustomer,
  updateCustomer,
  removeCustomer,
  nextCustomerId,
} from '@/src/stores/customersStore';
import type { Customer } from '@/src/types';
import { useT } from '@/src/stores/i18nStore';

interface EmployeeManagementProps {
  selectedBase?: string;
}

export function EmployeeManagement({ selectedBase }: EmployeeManagementProps) {
  const t = useT();
  const [activeTab, setActiveTab] = useState('employees');
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isBaseModalOpen, setIsBaseModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [editingBase, setEditingBase] = useState<BranchMaster | null>(null);

  // CRUD state for branches & employees (local mock; persists during session)
  const [branches, setBranches] = useState<BranchMaster[]>(MOCK_BRANCHES);
  const [users, setUsers] = useState<User[]>(MOCK_USERS);

  const [newEmployee, setNewEmployee] = useState({
    name: '',
    email: '',
    role: 'worker',
    base: branches[0]?.name ?? '',
    phone: '',
    joinDate: format(new Date(), 'yyyy-MM-dd')
  });

  // 就業時間（従業員登録ダイアログで一緒に編集 / テーブル一覧表示にも購読が必要）
  useWorkingHours();
  const [workingHoursDraft, setWorkingHoursDraft] = useState<WorkingHours>(() => ({
    workerId: '',
    weekdayStart: '09:00',
    weekdayEnd: '18:00',
    saturdayEnabled: false,
    saturdayStart: '10:00',
    saturdayEnd: '17:00',
    sundayEnabled: false,
    sundayStart: '10:00',
    sundayEnd: '17:00',
  }));

  const [newBase, setNewBase] = useState({
    name: '',
    address: '',
    phone: '',
    manager: '',
    email: ''
  });

  const handleRegisterEmployee = () => {
    if (!newEmployee.name.trim()) {
      toast.error('名前を入力してください');
      return;
    }
    if (workingHoursDraft.weekdayEnd <= workingHoursDraft.weekdayStart) {
      toast.error('平日の終了時刻は開始時刻より後にしてください');
      return;
    }
    if (editingEmployee) {
      setUsers(prev => prev.map(u =>
        u.id === editingEmployee.id
          ? { ...u, name: newEmployee.name, email: newEmployee.email, role: newEmployee.role as any, base: newEmployee.base }
          : u
      ));
      // 就業時間も同時保存
      upsertWorkingHours({ ...workingHoursDraft, workerId: editingEmployee.id });
      toast.success(`${newEmployee.name}さんの情報を更新しました`);
    } else {
      const newId = `u-${Date.now()}`;
      setUsers(prev => [...prev, {
        id: newId,
        name: newEmployee.name,
        email: newEmployee.email,
        role: newEmployee.role as any,
        base: newEmployee.base,
      }]);
      // 新規登録時も就業時間を保存
      upsertWorkingHours({ ...workingHoursDraft, workerId: newId });
      toast.success(`${newEmployee.name}さんを登録しました`);
    }
    setIsRegisterModalOpen(false);
    setEditingEmployee(null);
  };

  const handleDeleteEmployee = (emp: User) => {
    if (!window.confirm(`${emp.name}さんを削除しますか？`)) return;
    setUsers(prev => prev.filter(u => u.id !== emp.id));
    toast.success(`${emp.name}さんを削除しました`);
  };

  const handleRegisterBase = () => {
    if (!newBase.name.trim()) {
      toast.error('拠点名を入力してください');
      return;
    }
    if (editingBase) {
      const oldName = editingBase.name;
      const updatedName = newBase.name;
      setBranches(prev => prev.map(b =>
        b.id === editingBase.id
          ? { ...b, name: updatedName, address: newBase.address, phone: newBase.phone, managerId: newBase.manager, email: newBase.email }
          : b
      ));
      // 拠点名が変わった場合、所属従業員の base も追従
      if (oldName !== updatedName) {
        setUsers(prev => prev.map(u => u.base === oldName ? { ...u, base: updatedName } : u));
      }
      toast.success(`拠点「${updatedName}」の情報を更新しました`);
    } else {
      const newId = `b-${Date.now()}`;
      setBranches(prev => [...prev, {
        id: newId,
        name: newBase.name,
        address: newBase.address,
        phone: newBase.phone,
        managerId: newBase.manager,
        email: newBase.email,
      }]);
      toast.success(`拠点「${newBase.name}」を登録しました`);
    }
    setIsBaseModalOpen(false);
    setEditingBase(null);
  };

  const handleDeleteBase = (branch: BranchMaster) => {
    const memberCount = users.filter(u => u.base === branch.name).length;
    const message = memberCount > 0
      ? `拠点「${branch.name}」を削除しますか？\n所属従業員 ${memberCount} 名は所属が外れます。`
      : `拠点「${branch.name}」を削除しますか？`;
    if (!window.confirm(message)) return;
    setBranches(prev => prev.filter(b => b.id !== branch.id));
    if (memberCount > 0) {
      setUsers(prev => prev.map(u => u.base === branch.name ? { ...u, base: '' } : u));
    }
    toast.success(`拠点「${branch.name}」を削除しました`);
  };

  const openEditEmployee = (emp: any) => {
    setEditingEmployee(emp);
    setNewEmployee({
      name: emp.name,
      email: emp.email,
      role: emp.role,
      base: emp.base,
      phone: emp.phone || '',
      joinDate: emp.joinDate || format(new Date(), 'yyyy-MM-dd')
    });
    // 該当従業員の就業時間をロード
    setWorkingHoursDraft(getWorkingHoursFor(emp.id));
    setIsRegisterModalOpen(true);
  };

  // 「新規登録」ボタンを押した時の初期化（編集状態を解除）
  const openCreateEmployee = () => {
    setEditingEmployee(null);
    setNewEmployee({
      name: '',
      email: '',
      role: 'worker',
      base: branches[0]?.name ?? '',
      phone: '',
      joinDate: format(new Date(), 'yyyy-MM-dd'),
    });
    setWorkingHoursDraft({
      workerId: '',
      weekdayStart: '09:00',
      weekdayEnd: '18:00',
      saturdayEnabled: false,
      saturdayStart: '10:00',
      saturdayEnd: '17:00',
      sundayEnabled: false,
      sundayStart: '10:00',
      sundayEnd: '17:00',
    });
    setIsRegisterModalOpen(true);
  };

  const openEditBase = (base: BranchMaster) => {
    setEditingBase(base);
    setNewBase({
      name: base.name,
      address: base.address,
      phone: base.phone,
      manager: base.managerId,
      email: base.email || ''
    });
    setIsBaseModalOpen(true);
  };

  const employees = users.filter(u => !selectedBase || u.base === selectedBase);

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('emp.title')}</h1>
          <p className="text-slate-500 text-sm">{t('emp.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button className="bg-blue-600 hover:bg-blue-700 gap-2" onClick={openCreateEmployee}>
            <Plus className="w-4 h-4" /> 従業員登録・修正
          </Button>
          <Dialog open={isRegisterModalOpen} onOpenChange={(open) => {
            setIsRegisterModalOpen(open);
            if (!open) {
              setEditingEmployee(null);
              setNewEmployee({
                name: '', email: '', role: 'worker', base: branches[0]?.name ?? '', phone: '', joinDate: format(new Date(), 'yyyy-MM-dd')
              });
            }
          }}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingEmployee ? '従業員情報の修正' : '新規従業員登録'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">名前</label>
                    <Input
                      placeholder="山田 太郎"
                      value={newEmployee.name}
                      onChange={(e) => setNewEmployee({...newEmployee, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">電話番号</label>
                    <Input
                      placeholder="080-0000-0000"
                      value={newEmployee.phone}
                      onChange={(e) => setNewEmployee({...newEmployee, phone: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">メールアドレス</label>
                  <Input
                    type="email"
                    placeholder="yamada@example.com"
                    value={newEmployee.email}
                    onChange={(e) => setNewEmployee({...newEmployee, email: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">役割</label>
                    <select
                      className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm"
                      value={newEmployee.role}
                      onChange={(e) => setNewEmployee({...newEmployee, role: e.target.value as any})}
                    >
                      <option value="worker">作業員</option>
                      <option value="collector">回収員</option>
                      <option value="admin">管理者</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">入社日</label>
                    <Input
                      type="date"
                      value={newEmployee.joinDate}
                      onChange={(e) => setNewEmployee({...newEmployee, joinDate: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">所属拠点</label>
                  <select
                    className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm"
                    value={newEmployee.base}
                    onChange={(e) => setNewEmployee({...newEmployee, base: e.target.value})}
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.name}>{b.name}</option>
                    ))}
                  </select>
                </div>

                {/* 就業時間（マスタを統合） */}
                <div className="space-y-3 border-t border-slate-100 pt-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <h3 className="text-sm font-bold text-slate-800">就業時間</h3>
                    <span className="text-[10px] text-slate-400">この設定はシフト・作業スケジュールにも反映されます</span>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600">平日（月〜金）</label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={workingHoursDraft.weekdayStart}
                        onChange={(e) =>
                          setWorkingHoursDraft({ ...workingHoursDraft, weekdayStart: e.target.value })
                        }
                        className="h-9 text-xs"
                      />
                      <span className="text-slate-400 text-xs">〜</span>
                      <Input
                        type="time"
                        value={workingHoursDraft.weekdayEnd}
                        onChange={(e) =>
                          setWorkingHoursDraft({ ...workingHoursDraft, weekdayEnd: e.target.value })
                        }
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* 土曜 */}
                    <div className="space-y-2 p-3 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-600">土曜</label>
                        <Button
                          type="button"
                          size="sm"
                          variant={workingHoursDraft.saturdayEnabled ? 'default' : 'outline'}
                          onClick={() =>
                            setWorkingHoursDraft({
                              ...workingHoursDraft,
                              saturdayEnabled: !workingHoursDraft.saturdayEnabled,
                            })
                          }
                          className={cn(
                            'h-7 px-3 text-[10px] font-bold rounded-full',
                            workingHoursDraft.saturdayEnabled
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-white text-slate-500 border-slate-200',
                          )}
                        >
                          {workingHoursDraft.saturdayEnabled ? '出勤' : '休日'}
                        </Button>
                      </div>
                      <div
                        className={cn(
                          'flex items-center gap-2',
                          !workingHoursDraft.saturdayEnabled && 'opacity-50',
                        )}
                      >
                        <Input
                          type="time"
                          value={workingHoursDraft.saturdayStart}
                          onChange={(e) =>
                            setWorkingHoursDraft({
                              ...workingHoursDraft,
                              saturdayStart: e.target.value,
                            })
                          }
                          disabled={!workingHoursDraft.saturdayEnabled}
                          className="h-9 text-xs"
                        />
                        <span className="text-slate-400 text-xs">〜</span>
                        <Input
                          type="time"
                          value={workingHoursDraft.saturdayEnd}
                          onChange={(e) =>
                            setWorkingHoursDraft({
                              ...workingHoursDraft,
                              saturdayEnd: e.target.value,
                            })
                          }
                          disabled={!workingHoursDraft.saturdayEnabled}
                          className="h-9 text-xs"
                        />
                      </div>
                    </div>

                    {/* 日曜 */}
                    <div className="space-y-2 p-3 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-600">日曜</label>
                        <Button
                          type="button"
                          size="sm"
                          variant={workingHoursDraft.sundayEnabled ? 'default' : 'outline'}
                          onClick={() =>
                            setWorkingHoursDraft({
                              ...workingHoursDraft,
                              sundayEnabled: !workingHoursDraft.sundayEnabled,
                            })
                          }
                          className={cn(
                            'h-7 px-3 text-[10px] font-bold rounded-full',
                            workingHoursDraft.sundayEnabled
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-white text-slate-500 border-slate-200',
                          )}
                        >
                          {workingHoursDraft.sundayEnabled ? '出勤' : '休日'}
                        </Button>
                      </div>
                      <div
                        className={cn(
                          'flex items-center gap-2',
                          !workingHoursDraft.sundayEnabled && 'opacity-50',
                        )}
                      >
                        <Input
                          type="time"
                          value={workingHoursDraft.sundayStart}
                          onChange={(e) =>
                            setWorkingHoursDraft({
                              ...workingHoursDraft,
                              sundayStart: e.target.value,
                            })
                          }
                          disabled={!workingHoursDraft.sundayEnabled}
                          className="h-9 text-xs"
                        />
                        <span className="text-slate-400 text-xs">〜</span>
                        <Input
                          type="time"
                          value={workingHoursDraft.sundayEnd}
                          onChange={(e) =>
                            setWorkingHoursDraft({
                              ...workingHoursDraft,
                              sundayEnd: e.target.value,
                            })
                          }
                          disabled={!workingHoursDraft.sundayEnabled}
                          className="h-9 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsRegisterModalOpen(false)}>キャンセル</Button>
                <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleRegisterEmployee}>
                  {editingEmployee ? '更新する' : '登録する'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isBaseModalOpen} onOpenChange={(open) => {
            setIsBaseModalOpen(open);
            if (!open) {
              setEditingBase(null);
              setNewBase({ name: '', address: '', phone: '', manager: '', email: '' });
            }
          }}>
            <DialogTrigger 
              render={
                <Button variant="outline" className="gap-2">
                  <MapPin className="w-4 h-4" /> 拠点登録・修正
                </Button>
              }
            />
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingBase ? '拠点情報の修正' : '新規拠点登録'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">拠点名</label>
                    <Input 
                      placeholder="横浜第二支店" 
                      value={newBase.name}
                      onChange={(e) => setNewBase({...newBase, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">電話番号</label>
                    <Input 
                      placeholder="045-000-0000" 
                      value={newBase.phone}
                      onChange={(e) => setNewBase({...newBase, phone: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">住所</label>
                  <Input 
                    placeholder="神奈川県横浜市..." 
                    value={newBase.address}
                    onChange={(e) => setNewBase({...newBase, address: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">拠点責任者</label>
                    <select 
                      className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm"
                      value={newBase.manager}
                      onChange={(e) => setNewBase({...newBase, manager: e.target.value})}
                    >
                      <option value="">未設定</option>
                      {users.filter(u => u.role === 'admin').map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">拠点メールアドレス</label>
                    <Input 
                      type="email" 
                      placeholder="branch@example.com" 
                      value={newBase.email}
                      onChange={(e) => setNewBase({...newBase, email: e.target.value})}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsBaseModalOpen(false)}>キャンセル</Button>
                <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleRegisterBase}>
                  {editingBase ? '更新する' : '登録する'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t('att.totalEmployees')}</p>
              <h3 className="text-xl font-bold">{users.length} {t('att.staff')}</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t('att.todayPresent')}</p>
              <h3 className="text-xl font-bold">98 {t('att.staff')}</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
              <Star className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">平均モチベーション</p>
              <h3 className="text-xl font-bold">4.2 / 5.0</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-purple-50 rounded-xl text-purple-600">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">拠点数</p>
              <h3 className="text-xl font-bold">{branches.length} 拠点</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="employees" className="w-full" onValueChange={setActiveTab}>
        <div className="flex items-center justify-between mb-4 bg-white p-2 rounded-xl shadow-sm overflow-x-auto">
          <TabsList className="bg-transparent border-none">
            <TabsTrigger value="employees" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 rounded-lg px-6">{t('emp.tabEmployeesList')}</TabsTrigger>
            <TabsTrigger value="bases" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 rounded-lg px-6">拠点一覧</TabsTrigger>
            <TabsTrigger value="evaluation" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 rounded-lg px-6">評価・モチベーション</TabsTrigger>
            <TabsTrigger value="taskmasters" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 rounded-lg px-6">{t('emp.tabTasks')}</TabsTrigger>
            <TabsTrigger value="customers" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 rounded-lg px-6">{t('emp.tabPartnersList')}</TabsTrigger>
            <TabsTrigger value="masters" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 rounded-lg px-6">役職・マスター</TabsTrigger>
          </TabsList>
          <div className="relative w-64 mr-2 hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="検索..." className="pl-9 h-9 bg-slate-50 border-none rounded-lg text-sm" />
          </div>
        </div>

        <TabsContent value="employees" className="mt-0">
          <Card className="border-none shadow-sm overflow-hidden text-sm">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-[10px] font-bold uppercase px-6">{t('emp.empNameCol')}</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase px-6">{t('emp.empRoleCol')}</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase px-6">{t('emp.empBranchCol')}</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase px-4">{t('emp.empWorkHoursCol')}</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase px-6">{t('emp.empStatusCol')}</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((user) => {
                  const wh = getWorkingHoursFor(user.id);
                  const satLabel = wh.saturdayEnabled ? `${wh.saturdayStart}-${wh.saturdayEnd}` : '休';
                  const sunLabel = wh.sundayEnabled ? `${wh.sundayStart}-${wh.sundayEnd}` : '休';
                  return (
                    <TableRow key={user.id} className="hover:bg-slate-50 transition-colors">
                      <TableCell className="px-6">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user.avatar} />
                            <AvatarFallback>{user.name?.[0] || '?'}</AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-700">{user.name}</span>
                            <span className="text-[10px] text-slate-400">{user.email}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-6">
                        <Badge variant="outline" className="text-[10px] font-bold bg-slate-50 border-slate-100">
                          {user.role === 'admin' ? t('role.admin') : user.role === 'worker' ? t('role.worker') : t('role.collector')}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-6 text-slate-600">{user.base}</TableCell>
                      <TableCell className="px-4 text-[11px] text-slate-600">
                        <div className="flex flex-col gap-0.5 leading-tight">
                          <span className="font-mono">
                            <span className="text-[9px] font-bold text-slate-400 mr-1">平日</span>
                            {wh.weekdayStart}-{wh.weekdayEnd}
                          </span>
                          <span className="font-mono text-[10px]">
                            <span
                              className={cn(
                                'text-[9px] font-bold mr-1',
                                wh.saturdayEnabled ? 'text-blue-600' : 'text-rose-500',
                              )}
                            >
                              土
                            </span>
                            <span className={cn(!wh.saturdayEnabled && 'text-rose-500')}>{satLabel}</span>
                            <span
                              className={cn(
                                'text-[9px] font-bold ml-2 mr-1',
                                wh.sundayEnabled ? 'text-blue-600' : 'text-rose-500',
                              )}
                            >
                              日
                            </span>
                            <span className={cn(!wh.sundayEnabled && 'text-rose-500')}>{sunLabel}</span>
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-6">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="text-xs font-medium text-slate-600">在籍中</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 text-right">
                        <Button variant="ghost" size="sm" className="text-blue-600" onClick={() => openEditEmployee(user)}>修正</Button>
                        <Button variant="ghost" size="sm" className="text-rose-600 ml-1" onClick={() => handleDeleteEmployee(user)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="bases" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {branches.map(branch => (
              <Card key={branch.id} className="border-none shadow-sm flex flex-col justify-between">
                <CardContent className="p-5 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h3 className="font-bold text-lg">{branch.name}</h3>
                      <p className="text-xs text-slate-500">{branch.address}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => openEditBase(branch)}>
                        <Settings className="w-3.5 h-3.5" /> 修正
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-100"
                        onClick={() => handleDeleteBase(branch)}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> 削除
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm pt-2">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">電話番号</p>
                      <p className="font-medium">{branch.phone || '—'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">責任者</p>
                      <p className="font-medium">
                        {users.find(u => u.id === branch.managerId)?.name || '未設定'}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">所属従業員</p>
                      <p className="font-medium">{users.filter(u => u.base === branch.name).length} 名</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">メール</p>
                      <p className="font-medium truncate">{branch.email || '—'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            <Button
              variant="outline"
              className="border-dashed border-2 p-10 h-auto text-slate-400 hover:text-blue-600 hover:border-blue-200 flex-col gap-3"
              onClick={() => {
                setEditingBase(null);
                setNewBase({ name: '', address: '', phone: '', manager: '', email: '' });
                setIsBaseModalOpen(true);
              }}
            >
              <div className="p-3 bg-slate-50 rounded-full">
                <Plus className="w-6 h-6" />
              </div>
              <span className="font-bold">新しい拠点を追加</span>
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="taskmasters" className="mt-0">
          <TaskMasterPanel />
        </TabsContent>

        <TabsContent value="customers" className="mt-0">
          <CustomerMasterPanel />
        </TabsContent>

        <TabsContent value="masters" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-emerald-600" /> 役職マスター
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="p-3 bg-slate-50 rounded-lg flex justify-between items-center">
                  <span className="text-sm font-bold">店長・責任者</span>
                  <Badge className="bg-slate-200 text-slate-600 text-[10px]">Lv.5</Badge>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg flex justify-between items-center">
                  <span className="text-sm font-bold">チーフリーダー</span>
                  <Badge className="bg-slate-200 text-slate-600 text-[10px]">Lv.3</Badge>
                </div>
                <Button variant="outline" className="w-full border-dashed border-2 h-10 text-xs gap-2">
                  <Plus className="w-3 h-3" /> 役職追加
                </Button>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-600" /> 評価項目マスター
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="p-3 bg-slate-50 rounded-lg flex justify-between items-center">
                  <span className="text-sm font-bold">作業スピード</span>
                  <span className="text-xs text-slate-400">10pt</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg flex justify-between items-center">
                  <span className="text-sm font-bold">品質（ミスなし）</span>
                  <span className="text-xs text-slate-400">10pt</span>
                </div>
                <Button variant="outline" className="w-full border-dashed border-2 h-10 text-xs gap-2">
                  <Plus className="w-3 h-3" /> 項目追加
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="evaluation" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-bold">モチベーション推移</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px] flex items-center justify-center text-slate-400 italic">
                グラフ表示エリア（Recharts実装予定）
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-bold">直近の評価フィードバック</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex gap-4 p-4 bg-slate-50 rounded-xl">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>U</AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">作業員 一郎</span>
                        <span className="text-[10px] text-slate-400">2時間前</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        今週はエンジンの解体作業が非常にスムーズでした。目標時間を15%短縮できています。
                      </p>
                      <div className="flex gap-1 pt-1">
                        {[1, 2, 3, 4, 5].map(s => (
                          <Star key={s} className={cn("w-3 h-3", s <= 4 ? "text-amber-400 fill-amber-400" : "text-slate-200")} />
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ----------------------------------------------------------------------
 * 作業マスタ パネル
 * 管理者がここで作業マスタ（TaskMaster）を CRUD すると
 * 作業スケジュール / 業務管理 / ダッシュボード等にリアルタイム反映される
 * --------------------------------------------------------------------*/
function TaskMasterPanel() {
  const taskMasters = useTaskMasters();
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<TaskMaster | null>(null);
  const [search, setSearch] = useState('');

  const [draft, setDraft] = useState<{
    name: string;
    type: TaskType;
    description: string;
    estimatedTime: string;
    basePrice: string;
  }>({
    name: '',
    type: 'sorting',
    description: '',
    estimatedTime: '30',
    basePrice: '',
  });

  const filtered = taskMasters.filter((t) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q) ||
      (TASK_TYPE_LABELS[t.type] || '').toLowerCase().includes(q)
    );
  });

  const openCreate = () => {
    setEditing(null);
    setDraft({
      name: '',
      type: 'sorting',
      description: '',
      estimatedTime: '30',
      basePrice: '',
    });
    setIsOpen(true);
  };
  const openEdit = (tm: TaskMaster) => {
    setEditing(tm);
    setDraft({
      name: tm.name,
      type: tm.type,
      description: tm.description || '',
      estimatedTime: String(tm.estimatedTime ?? 30),
      basePrice: tm.basePrice !== undefined ? String(tm.basePrice) : '',
    });
    setIsOpen(true);
  };

  const submit = () => {
    if (!draft.name.trim()) {
      toast.error('作業名を入力してください');
      return;
    }
    const est = Number(draft.estimatedTime);
    if (!Number.isFinite(est) || est <= 0) {
      toast.error('想定所要時間は 1 分以上で入力してください');
      return;
    }
    const price =
      draft.basePrice.trim() === '' ? undefined : Number(draft.basePrice);
    if (price !== undefined && (!Number.isFinite(price) || price < 0)) {
      toast.error('単価は 0 以上の数値で入力してください');
      return;
    }

    if (editing) {
      updateTaskMaster(editing.id, {
        name: draft.name,
        type: draft.type,
        description: draft.description,
        estimatedTime: est,
        basePrice: price,
      });
      toast.success(`「${draft.name}」を更新しました`);
    } else {
      addTaskMaster({
        name: draft.name,
        type: draft.type,
        description: draft.description,
        estimatedTime: est,
        basePrice: price,
      });
      toast.success(`「${draft.name}」を追加しました`);
    }
    setIsOpen(false);
    setEditing(null);
  };

  const remove = (tm: TaskMaster) => {
    if (!window.confirm(`「${tm.name}」を削除しますか？\n既に割り当てられた作業は残りますが、新規割当時に表示されなくなります。`)) {
      return;
    }
    deleteTaskMaster(tm.id);
    toast.success(`「${tm.name}」を削除しました`);
  };

  return (
    <div className="space-y-4">
      <Card className="border-none shadow-sm">
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-3">
          <div>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Wrench className="w-4 h-4 text-blue-600" /> 作業マスタ
            </CardTitle>
            <p className="text-[11px] text-slate-500 mt-1">
              作業スケジュール画面で割り当てる作業の名称・所要時間・標準単価を管理します。
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="作業名で検索..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 bg-slate-50 border-slate-200 text-sm"
              />
            </div>
            <Button
              onClick={openCreate}
              className="h-9 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold gap-2"
            >
              <Plus className="w-3.5 h-3.5" /> 作業マスタ追加
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="px-6 py-12 text-center text-xs text-slate-400">
              {taskMasters.length === 0
                ? 'まだ作業マスタが登録されていません。「作業マスタ追加」から登録してください。'
                : '検索条件に一致する作業がありません。'}
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-[10px] font-bold uppercase px-6 w-[260px]">作業名</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase px-4 w-[110px]">区分</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase px-4">説明</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase px-4 w-[110px] text-center">想定時間</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase px-4 w-[120px] text-right">標準単価</TableHead>
                  <TableHead className="w-[120px] text-right pr-6">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((tm) => (
                  <TableRow key={tm.id} className="hover:bg-slate-50 transition-colors">
                    <TableCell className="px-6 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1.5 bg-blue-50 rounded-md text-blue-600 shrink-0">
                          <ClipboardList className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-bold text-sm text-slate-800 truncate">
                          {tm.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <Badge className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold">
                        {TASK_TYPE_LABELS[tm.type] || tm.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-xs text-slate-500 truncate max-w-[360px]">
                      {tm.description || <span className="text-slate-300">（なし）</span>}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-center text-xs font-mono text-slate-700">
                      {tm.estimatedTime} 分
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right text-xs font-mono text-slate-700">
                      {tm.basePrice !== undefined ? `¥${tm.basePrice.toLocaleString()}` : '-'}
                    </TableCell>
                    <TableCell className="pr-6 py-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(tm)}
                          className="h-8 px-2 text-xs text-slate-600 gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> 編集
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(tm)}
                          className="h-8 px-2 text-xs text-rose-500 hover:text-rose-600 gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> 削除
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 追加・編集ダイアログ */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? '作業マスタを編集' : '作業マスタを追加'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="tm-name" className="text-[11px] font-bold">作業名</Label>
              <Input
                id="tm-name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="例：商品撮影（5カット）"
                className="mt-1 h-9 text-sm"
              />
            </div>
            <div>
              <Label className="text-[11px] font-bold">区分</Label>
              <Select
                value={draft.type}
                onValueChange={(v) => setDraft({ ...draft, type: v as TaskType })}
              >
                <SelectTrigger className="mt-1 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="text-sm">
                      {TASK_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="tm-desc" className="text-[11px] font-bold">説明（任意）</Label>
              <Textarea
                id="tm-desc"
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="作業内容のメモ"
                className="mt-1 text-sm min-h-[64px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="tm-est" className="text-[11px] font-bold">想定所要時間（分）</Label>
                <Input
                  id="tm-est"
                  type="number"
                  min={1}
                  value={draft.estimatedTime}
                  onChange={(e) => setDraft({ ...draft, estimatedTime: e.target.value })}
                  className="mt-1 h-9 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="tm-price" className="text-[11px] font-bold">標準単価（¥／任意）</Label>
                <Input
                  id="tm-price"
                  type="number"
                  min={0}
                  value={draft.basePrice}
                  onChange={(e) => setDraft({ ...draft, basePrice: e.target.value })}
                  placeholder="例：2000"
                  className="mt-1 h-9 text-sm"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)} className="h-9 text-xs">
              キャンセル
            </Button>
            <Button onClick={submit} className="h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white">
              {editing ? '更新' : '追加'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ----------------------------------------------------------------------
 * 取引先マスタ パネル（旧 CollectionManagement のダイアログを移設）
 * 引取送料あり/なし、デフォルト送料、買取明細書の送付先メールを管理
 * --------------------------------------------------------------------*/
function CustomerMasterPanel() {
  const customers = useCustomers();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<Partial<Customer>>({});

  const openCreate = () => {
    setEditing(null);
    setForm({ shippingFeeApplicable: false });
  };
  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({ ...c });
  };
  const clearForm = () => {
    setEditing(null);
    setForm({});
  };

  const save = () => {
    if (!form.name?.trim()) {
      toast.error('取引先名を入力してください');
      return;
    }
    if (form.shippingFeeApplicable && (!form.defaultShippingFee || form.defaultShippingFee < 0)) {
      toast.error('送料ありの場合はデフォルト送料を入力してください');
      return;
    }
    if (editing) {
      updateCustomer(editing.id, {
        name: form.name,
        email: form.email,
        phone: form.phone,
        address: form.address,
        shippingFeeApplicable: !!form.shippingFeeApplicable,
        defaultShippingFee: form.shippingFeeApplicable ? form.defaultShippingFee : undefined,
        notes: form.notes,
        billingContactName: form.billingContactName,
      });
      toast.success(`「${form.name}」を更新しました`);
    } else {
      const id = nextCustomerId();
      addCustomer({
        id,
        name: form.name!,
        email: form.email,
        phone: form.phone,
        address: form.address,
        shippingFeeApplicable: !!form.shippingFeeApplicable,
        defaultShippingFee: form.shippingFeeApplicable ? form.defaultShippingFee : undefined,
        notes: form.notes,
        billingContactName: form.billingContactName,
      });
      toast.success(`「${form.name}」を追加しました`);
    }
    clearForm();
  };

  const remove = (c: Customer) => {
    if (!window.confirm(`「${c.name}」を削除しますか？`)) return;
    removeCustomer(c.id);
    toast.success(`「${c.name}」を削除しました`);
    if (editing?.id === c.id) clearForm();
  };

  const filtered = customers.filter(
    (c) => !search || c.name.includes(search) || (c.email || '').includes(search) || (c.address || '').includes(search),
  );

  return (
    <Card className="border-none shadow-sm overflow-hidden">
      <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-3">
        <div>
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Truck className="w-4 h-4 text-amber-600" /> 取引先マスタ
          </CardTitle>
          <p className="text-[11px] text-slate-500 mt-1">
            引取送料あり/なし、月次買取明細書のメール送付先を取引先単位で管理。新規回収登録時に自動引き当てされます。
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="取引先名/メールで検索..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 bg-slate-50 border-slate-200 text-sm"
            />
          </div>
          <Button
            onClick={openCreate}
            className="h-9 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold gap-2"
          >
            <Plus className="w-3.5 h-3.5" /> 新規取引先
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-0 min-h-[480px]">
          {/* 一覧 */}
          <div className="md:col-span-3 border-r border-slate-100">
            <div className="max-h-[560px] overflow-y-auto">
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0 z-[1]">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[10px] font-bold uppercase pl-6">取引先名</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase">送料</TableHead>
                    <TableHead className="text-right text-[10px] font-bold uppercase">デフォルト</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase">担当者</TableHead>
                    <TableHead className="w-24 pr-6"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-xs text-slate-400 py-12">
                        {customers.length === 0
                          ? 'まだ取引先が登録されていません。「新規取引先」から登録してください。'
                          : '検索条件に一致する取引先がありません。'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((c) => (
                      <TableRow
                        key={c.id}
                        className={cn(
                          'cursor-pointer hover:bg-amber-50/40 transition-colors',
                          editing?.id === c.id && 'bg-amber-50',
                        )}
                        onClick={() => openEdit(c)}
                      >
                        <TableCell className="pl-6 py-3">
                          <div className="font-bold text-sm text-slate-800 truncate">{c.name}</div>
                          {c.email && <div className="text-[10px] text-slate-400 truncate">{c.email}</div>}
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge
                            className={cn(
                              'text-[10px] font-bold border',
                              c.shippingFeeApplicable
                                ? 'bg-rose-100 text-rose-700 border-rose-200'
                                : 'bg-emerald-100 text-emerald-700 border-emerald-200',
                            )}
                          >
                            {c.shippingFeeApplicable ? '送料あり' : '送料なし'}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3 text-right text-xs text-slate-700 font-mono tabular-nums">
                          {c.shippingFeeApplicable ? `¥${(c.defaultShippingFee || 0).toLocaleString()}` : '—'}
                        </TableCell>
                        <TableCell className="py-3 text-xs text-slate-500 truncate max-w-[140px]">
                          {c.billingContactName || <span className="text-slate-300">（未設定）</span>}
                        </TableCell>
                        <TableCell className="pr-6 py-3">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEdit(c);
                              }}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-rose-600 hover:bg-rose-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                remove(c);
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* フォーム（詳細編集／新規登録） */}
          <div className="md:col-span-2 bg-slate-50/40 p-5 space-y-3">
            <div className="text-xs font-bold uppercase text-slate-500">
              {editing ? '取引先を編集' : '新規取引先を登録'}
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px]">取引先名 <span className="text-rose-500">*</span></Label>
              <Input
                className="h-9 text-sm"
                value={form.name || ''}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="例: ネッツトヨタ大阪（株）"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px]">メール（買取明細書送付先）</Label>
              <Input
                type="email"
                className="h-9 text-sm"
                value={form.email || ''}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="例: parts@example.co.jp"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-[11px]">電話番号</Label>
                <Input
                  className="h-9 text-sm"
                  value={form.phone || ''}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="06-0000-0000"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px]">担当者名</Label>
                <Input
                  className="h-9 text-sm"
                  value={form.billingContactName || ''}
                  onChange={(e) => setForm({ ...form, billingContactName: e.target.value })}
                  placeholder="例: 山田 太郎"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px]">住所</Label>
              <Input
                className="h-9 text-sm"
                value={form.address || ''}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="例: 大阪府吹田市豊津町12-1"
              />
            </div>

            <div className="pt-2 border-t border-slate-200 space-y-2">
              <Label className="text-[11px] font-bold flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5" /> 引取送料設定
              </Label>
              <div className="flex items-center gap-3 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    checked={!form.shippingFeeApplicable}
                    onChange={() => setForm({ ...form, shippingFeeApplicable: false, defaultShippingFee: undefined })}
                  />
                  <span>なし</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    checked={!!form.shippingFeeApplicable}
                    onChange={() => setForm({ ...form, shippingFeeApplicable: true })}
                  />
                  <span>あり</span>
                </label>
              </div>
              {form.shippingFeeApplicable && (
                <div className="space-y-1.5">
                  <Label className="text-[11px]">デフォルト送料 (円)</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    className="h-9 text-sm"
                    value={form.defaultShippingFee?.toString() || ''}
                    onChange={(e) => setForm({ ...form, defaultShippingFee: Number(e.target.value) })}
                    placeholder="3500"
                  />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px]">備考</Label>
              <Textarea
                className="text-sm min-h-[64px]"
                value={form.notes || ''}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="特記事項、月次明細書のフォーマット指定など"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                className="flex-1 gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs"
                onClick={save}
                disabled={!form.name}
              >
                <Save className="w-3.5 h-3.5" /> {editing ? '更新' : '追加'}
              </Button>
              <Button variant="outline" onClick={clearForm} className="text-xs">
                クリア
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
