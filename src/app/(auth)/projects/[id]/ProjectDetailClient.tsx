'use client'

import { useState, useTransition, useMemo, useRef, useEffect } from 'react'
import { Project, Cost, Sale, Addon, Partner, User, ProjectSubManager, TaxType } from '@/types'
import { formatYenFull, formatDateLocal } from '@/lib/utils/date'
import { AmountInput } from '@/components/ui/amount-input'
import { normalizeCompanyName } from '@/lib/utils/text'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Trash2, Save, ExternalLink, X, Plus, Paperclip, ImageIcon, AlertTriangle, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface Props {
  project: Project
  costs: Cost[]
  sales: Sale[]
  addons: Addon[]
  partners: Partner[]
  users: User[]
  subManagers: ProjectSubManager[]
}

const STATUS_OPTIONS = ['受注', '着工中', '完工', '入金済']
const STRUCTURES = ['RC造', 'S造', '木造', 'SRC造', '軽量鉄骨造', 'その他']

export function ProjectDetailClient({ project, costs, sales, addons, partners, users, subManagers: initialSubManagers }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // 基本情報の編集状態
  const [siteName, setSiteName] = useState(project.site_name)
  const [status, setStatus] = useState(project.status)
  const [siteAddress, setSiteAddress] = useState(project.site_address ?? '')
  const [customerContact, setCustomerContact] = useState(project.customer_contact ?? '')
  const [structure, setStructure] = useState(project.building_structure ?? 'RC造')
  const [managerId, setManagerId] = useState(project.manager_id)
  const [customerId, setCustomerId] = useState(project.customer_id)
  const [startDate, setStartDate] = useState(project.start_date ?? '')
  const [endDate, setEndDate] = useState(project.end_date ?? '')
  const [contractAmount, setContractAmount] = useState(String(project.contract_amount ?? 0))
  const [confirmDelete, setConfirmDelete] = useState(false)

  // サブ担当
  const today = formatDateLocal(new Date())
  const [subManagers, setSubManagers] = useState<ProjectSubManager[]>(initialSubManagers)
  const [subManagerId, setSubManagerId] = useState('')
  const [subStartDate, setSubStartDate] = useState(today)
  const [subEndDate, setSubEndDate] = useState('')

  function addSubManager() {
    if (!subManagerId || !subStartDate) { toast.error('担当者と開始日を入力してください'); return }
    if (subManagerId === managerId) { toast.error('主担当者はサブ担当に追加できません'); return }
    if (subManagers.some(sm => sm.manager_id === subManagerId)) { toast.error('既にサブ担当として登録されています'); return }
    if (subEndDate && subEndDate < subStartDate) { toast.error('終了日は開始日以降の日付を入力してください'); return }
    startTransition(async () => {
      const res = await fetch(`/api/projects/${project.project_id}/sub-managers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_id: subManagerId, start_date: subStartDate, end_date: subEndDate || null }),
      })
      if (res.ok) {
        const data = await res.json()
        const user = users.find(u => u.user_id === subManagerId)
        setSubManagers(prev => [...prev, { ...data, username: user?.username ?? subManagerId }])
        setSubManagerId(''); setSubStartDate(today); setSubEndDate('')
        toast.success('サブ担当を追加しました')
      } else {
        toast.error('追加に失敗しました')
      }
    })
  }

  function removeSubManager(id: string) {
    startTransition(async () => {
      const res = await fetch(`/api/projects/${project.project_id}/sub-managers`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        setSubManagers(prev => prev.filter(s => s.id !== id))
        toast.success('削除しました')
      } else {
        toast.error('削除に失敗しました')
      }
    })
  }

  // 追加工事フォーム
  const [addonDate, setAddonDate] = useState('')
  const [addonDesc, setAddonDesc] = useState('')
  const [addonAmount, setAddonAmount] = useState('')

  // 売上登録フォーム
  const [saleDate, setSaleDate] = useState('')
  const [saleRemarks, setSaleRemarks] = useState(project.site_name)
  const [saleAmount, setSaleAmount] = useState('')

  const partnerMap = Object.fromEntries(partners.map(p => [p.partner_id, p.name]))
  const userMap = Object.fromEntries(users.map(u => [u.user_id, u.username]))
  const customers = partners.filter(p => p.category === '得意先')

  const addonSum = addons.reduce((s, a) => s + a.amount, 0)
  const totalContract = (project.contract_amount ?? 0) + addonSum
  const salesSum = sales.reduce((s, r) => s + r.amount, 0)
  const costsSum = costs.reduce((s, r) => s + r.amount, 0)
  const profit = salesSum - costsSum
  const progress = totalContract > 0 ? salesSum / totalContract : 0

  // 担当者別の按分売上・粗利（サブ担当がいる場合のみ意味を持つ）
  const personAllocations = useMemo(() => {
    const totals: Record<string, number> = {}
    for (const sale of sales) {
      const d = sale.billing_date
      const activeSubs = subManagers.filter(sm =>
        sm.start_date <= d && (sm.end_date === null || sm.end_date >= d)
      )
      const divisor = 1 + activeSubs.length
      const share = Math.round(sale.amount / divisor)
      totals[project.manager_id] = (totals[project.manager_id] ?? 0) + share
      for (const sm of activeSubs) {
        totals[sm.manager_id] = (totals[sm.manager_id] ?? 0) + share
      }
    }
    // 原価を売上按分比率で分配（salesSum=0 の場合は原価を主担当に全額）
    const profitRatio = salesSum > 0 ? profit / salesSum : 0
    return Object.entries(totals).map(([uid, allocatedSales]) => ({
      user_id: uid,
      name: userMap[uid] ?? uid,
      isMain: uid === project.manager_id,
      allocatedSales,
      profit: salesSum > 0 ? Math.round(allocatedSales * profitRatio) : (uid === project.manager_id ? -costsSum : 0),
    })).sort((a, b) => (a.isMain ? -1 : 1) - (b.isMain ? -1 : 1))
  }, [sales, subManagers, project.manager_id, costsSum, userMap])

  function saveBasicInfo() {
    startTransition(async () => {
      const res = await fetch(`/api/projects/${project.project_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site_name: siteName,
          status,
          site_address: siteAddress || null,
          customer_contact: customerContact || null,
          building_structure: structure,
          manager_id: managerId,
          customer_id: customerId,
          start_date: startDate || null,
          end_date: endDate || null,
          contract_amount: parseInt(contractAmount.replace(/,/g, '')) || 0,
        }),
      })
      if (res.ok) {
        toast.success('更新しました')
        router.refresh()
      } else {
        toast.error('更新に失敗しました')
      }
    })
  }

  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    startTransition(async () => {
      const res = await fetch(`/api/projects/${project.project_id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('ゴミ箱に移動しました')
        router.push('/projects')
        router.refresh()
      } else {
        toast.error('削除に失敗しました')
      }
    })
  }

  function addAddon() {
    startTransition(async () => {
      const res = await fetch('/api/addons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: project.project_id,
          request_date: addonDate,
          description: addonDesc,
          amount: parseInt(addonAmount.replace(/,/g, '')) || 0,
        }),
      })
      if (res.ok) {
        toast.success('追加工事を登録しました')
        setAddonDate(''); setAddonDesc(''); setAddonAmount('')
        router.refresh()
      } else {
        toast.error('登録に失敗しました')
      }
    })
  }

  function addSale() {
    startTransition(async () => {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: project.project_id,
          billing_date: saleDate,
          remarks: saleRemarks,
          amount: parseInt(saleAmount.replace(/,/g, '')) || 0,
          deposit_status: false,
          deposit_date: null,
        }),
      })
      if (res.ok) {
        toast.success('請求を登録しました')
        setSaleDate(''); setSaleRemarks(project.site_name); setSaleAmount('')
        router.refresh()
      } else {
        toast.error('登録に失敗しました')
      }
    })
  }

  return (
    <div className="space-y-5">
      {/* ヘッダー帯 */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-slate-400 font-mono mb-1">{project.project_id}</p>
            <h1 className="text-2xl font-bold text-slate-900">{project.site_name}</h1>
          </div>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
            project.status === '受注' ? 'bg-blue-100 text-blue-700' :
            project.status === '着工中' ? 'bg-amber-100 text-amber-700' :
            project.status === '完工' ? 'bg-emerald-100 text-emerald-700' :
            'bg-slate-100 text-slate-600'
          }`}>{project.status}</span>
        </div>

        {/* KPI */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <KpiCard label="契約金額（追加含む）" value={formatYenFull(totalContract)} />
          <KpiCard label="請求済売上" value={formatYenFull(salesSum)} />
          <KpiCard label="原価合計" value={formatYenFull(costsSum)} />
          <KpiCard label="予想粗利" value={formatYenFull(profit)} highlight={profit >= 0} />
        </div>

        {/* 予算超過アラート */}
        {costsSum > totalContract && (
          <Alert variant="destructive" className="mb-3">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              原価合計（{formatYenFull(costsSum)}）が契約金額（{formatYenFull(totalContract)}）を
              <strong> {formatYenFull(costsSum - totalContract)} 超過</strong>しています。
            </AlertDescription>
          </Alert>
        )}

        {/* 進捗バー */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-500">
            <span className="font-medium">請求進捗</span>
            <span className="font-semibold tabular-nums">{(progress * 100).toFixed(1)}%</span>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${Math.min(progress * 100, 100)}%` }} />
          </div>
        </div>

        {/* 担当者別按分（サブ担当がいる場合のみ） */}
        {subManagers.length > 0 && (
          <div className="mt-4 border-t pt-4">
            <p className="text-xs font-medium text-slate-500 mb-2">担当者別 按分売上・粗利</p>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 text-slate-600">
                    <th className="text-left py-1.5 px-3 font-medium text-xs">担当者</th>
                    <th className="text-right py-1.5 px-3 font-medium text-xs">按分売上</th>
                    <th className="text-right py-1.5 px-3 font-medium text-xs">按分粗利</th>
                  </tr>
                </thead>
                <tbody>
                  {personAllocations.map(p => (
                    <tr key={p.user_id} className="border-b last:border-0">
                      <td className="py-1.5 px-3 text-sm">
                        {p.name}
                        {p.isMain && <span className="ml-1.5 text-xs text-slate-400">（主）</span>}
                      </td>
                      <td className="py-1.5 px-3 text-right tabular-nums text-sm">{formatYenFull(p.allocatedSales)}</td>
                      <td className={`py-1.5 px-3 text-right tabular-nums text-sm font-medium ${p.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {formatYenFull(p.profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* タブ */}
      <Tabs defaultValue="costs">
        <TabsList>
          <TabsTrigger value="costs">原価明細</TabsTrigger>
          <TabsTrigger value="addons">追加工事</TabsTrigger>
          <TabsTrigger value="sales">得意先請求</TabsTrigger>
          <TabsTrigger value="info">基本情報</TabsTrigger>
        </TabsList>

        {/* 原価明細タブ */}
        <TabsContent value="costs">
          <Card>
            <CardContent className="pt-4">
              {costs.length === 0 ? (
                <p className="text-sm text-muted-foreground">原価データがありません</p>
              ) : (
                <CostPivotTable costs={costs} partnerMap={partnerMap} partners={partners} projectId={project.project_id} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 追加工事タブ */}
        <TabsContent value="addons">
          <Card>
            <CardContent className="pt-4 space-y-4">
              {addons.length > 0 && (
                <table className="w-full text-sm mb-4">
                  <thead>
                    <tr className="bg-slate-800 text-white sticky top-0 z-10">
                      <th className="text-left py-2.5 px-3 font-medium">日付</th>
                      <th className="text-left py-2.5 px-3 font-medium">内容</th>
                      <th className="text-right py-2.5 px-3 font-medium">金額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {addons.map((a, i) => (
                      <tr key={a.addon_id} className={`border-b last:border-0 ${i % 2 === 1 ? 'bg-slate-50' : 'bg-white'}`}>
                        <td className="py-2 pr-3">{a.request_date}</td>
                        <td className="py-2 pr-3">{a.description}</td>
                        <td className="py-2 text-right">{formatYenFull(a.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="border-t pt-4">
                <p className="font-medium text-sm mb-3">追加工事を登録</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">日付</Label>
                    <Input type="date" value={addonDate} onChange={e => setAddonDate(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">内容</Label>
                    <Input value={addonDesc} onChange={e => setAddonDesc(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">金額（税抜）</Label>
                    <AmountInput value={addonAmount} onChange={setAddonAmount} />
                  </div>
                </div>
                <Button onClick={addAddon} disabled={isPending} className="mt-3" size="sm">登録</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 得意先請求タブ */}
        <TabsContent value="sales">
          <Card>
            <CardContent className="pt-4 space-y-4">
              {sales.length > 0 && (
                <table className="w-full text-sm mb-4">
                  <thead>
                    <tr className="bg-slate-800 text-white sticky top-0 z-10">
                      <th className="text-left py-2.5 px-3 font-medium">請求日</th>
                      <th className="text-left py-2.5 px-3 font-medium">名称</th>
                      <th className="text-right py-2.5 px-3 font-medium">金額</th>
                      <th className="text-center py-2.5 px-3 font-medium">状態</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map((s, i) => (
                      <tr key={s.sales_id} className={`border-b last:border-0 ${i % 2 === 1 ? 'bg-slate-50' : 'bg-white'}`}>
                        <td className="py-2 pr-3">{s.billing_date}</td>
                        <td className="py-2 pr-3">{s.remarks}</td>
                        <td className="py-2 pr-3 text-right">{formatYenFull(s.amount)}</td>
                        <td className="py-2 text-center">
                          <Badge variant={s.deposit_status ? 'secondary' : 'destructive'}>
                            {s.deposit_status ? '入金済' : '未入金'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="border-t pt-4">
                <p className="font-medium text-sm mb-3">請求を登録</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">請求日</Label>
                    <Input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">名称・摘要</Label>
                    <Input value={saleRemarks} onChange={e => setSaleRemarks(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">金額（税抜）</Label>
                    <AmountInput value={saleAmount} onChange={setSaleAmount} />
                  </div>
                </div>
                <Button onClick={addSale} disabled={isPending} className="mt-3" size="sm">登録</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 基本情報タブ */}
        <TabsContent value="info">
          <Card>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>現場名</Label>
                  <Input value={siteName} onChange={e => setSiteName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>ステータス</Label>
                  <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>現場住所</Label>
                  <Input value={siteAddress} onChange={e => setSiteAddress(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>得意先</Label>
                  <Select value={customerId} onValueChange={(v) => setCustomerId(v ?? "")}>
                    <SelectTrigger><SelectValue>{normalizeCompanyName(partnerMap[customerId] ?? customerId)}</SelectValue></SelectTrigger>
                    <SelectContent>{customers.map(c => <SelectItem key={c.partner_id} value={c.partner_id}>{normalizeCompanyName(c.name)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>得意先担当者</Label>
                  <Input value={customerContact} onChange={e => setCustomerContact(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>担当者（主）</Label>
                  <Select value={managerId} onValueChange={(v) => setManagerId(v ?? "")}>
                    <SelectTrigger><SelectValue>{userMap[managerId] ?? managerId}</SelectValue></SelectTrigger>
                    <SelectContent>{users.map(u => <SelectItem key={u.user_id} value={u.user_id}>{u.username}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>サブ担当</Label>
                  <div className="border rounded-md p-3 space-y-2 bg-slate-50">
                    {subManagers.length > 0 && (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-muted-foreground border-b">
                            <th className="text-left py-1 font-medium">担当者</th>
                            <th className="text-left py-1 font-medium">開始日</th>
                            <th className="text-left py-1 font-medium">終了日</th>
                            <th className="w-8"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {subManagers.map(s => (
                            <tr key={s.id} className="border-b last:border-0">
                              <td className="py-1.5 pr-2 text-sm">{s.username}</td>
                              <td className="py-1.5 pr-2 text-sm tabular-nums">{s.start_date}</td>
                              <td className="py-1.5 pr-2 text-sm tabular-nums text-muted-foreground">{s.end_date ?? '（現在まで）'}</td>
                              <td className="py-1.5">
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeSubManager(s.id)} disabled={isPending}>
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 pt-1">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">担当者</p>
                        <Select value={subManagerId} onValueChange={v => setSubManagerId(v ?? '')}>
                          <SelectTrigger className="h-8 text-xs">
                            <span className={subManagerId ? '' : 'text-muted-foreground'}>
                              {subManagerId ? (userMap[subManagerId] ?? subManagerId) : '選択'}
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            {users.filter(u => u.user_id !== managerId && u.role !== 'admin').map(u => (
                              <SelectItem key={u.user_id} value={u.user_id}>{u.username}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">開始日</p>
                        <Input type="date" value={subStartDate} onChange={e => setSubStartDate(e.target.value)} className="h-8 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">終了日（空欄=現在まで）</p>
                        <Input type="date" value={subEndDate} onChange={e => setSubEndDate(e.target.value)} className="h-8 text-xs" />
                      </div>
                      <div className="flex items-end">
                        <Button size="sm" className="h-8 gap-1.5" onClick={addSubManager} disabled={isPending}>
                          <Plus className="h-3.5 w-3.5" />追加
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">※ サブ担当の実働期間中の売上は主担当と均等按分されます</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>建物構造</Label>
                  <Select value={structure} onValueChange={(v) => setStructure(v ?? "")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STRUCTURES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>請負金額（税抜）</Label>
                  <AmountInput value={contractAmount} onChange={setContractAmount} />
                </div>
                <div className="space-y-1.5">
                  <Label>工期開始日</Label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>工期終了日</Label>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={saveBasicInfo} disabled={isPending} className="gap-2">
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}更新
                </Button>
                {!confirmDelete ? (
                  <Button variant="outline" onClick={handleDelete} disabled={isPending} className="gap-2 text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />削除
                  </Button>
                ) : (
                  <div className="flex gap-2 items-center">
                    <span className="text-sm text-destructive">本当に削除しますか？</span>
                    <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isPending}>はい</Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>キャンセル</Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

const fmtAmt = (v: number) => Math.round(v).toLocaleString()

function fmtAmountInput(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '')
  if (!digits) return ''
  return parseInt(digits, 10).toLocaleString('ja-JP')
}

function CostPivotTable({ costs, partnerMap, partners, projectId }: { costs: Cost[]; partnerMap: Record<string, string>; partners: Partner[]; projectId: string }) {
  const router = useRouter()
  const [dialog, setDialog] = useState<{ vendor_id: string; month: string } | null>(null)
  const [editAmounts, setEditAmounts] = useState<Record<string, string>>({})
  const [editTaxTypes, setEditTaxTypes] = useState<Record<string, TaxType>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [newAmount, setNewAmount] = useState('')
  const [newTaxType, setNewTaxType] = useState<TaxType>('税抜')
  const [creating, setCreating] = useState(false)
  const [preview, setPreview] = useState<{ url: string; isPdf: boolean } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  // ピボットテーブルのスクロールコンテナ（初期位置を右端に）
  const pivotScrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (pivotScrollRef.current) {
      pivotScrollRef.current.scrollLeft = pivotScrollRef.current.scrollWidth
    }
  }, [])

  // ダイアログ表示時に最初の金額欄へ自動フォーカス
  const firstEditRef = useRef<HTMLInputElement>(null)
  const newAmountRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!dialog) return
    const timer = setTimeout(() => {
      if (firstEditRef.current) {
        firstEditRef.current.focus()
        firstEditRef.current.select()
      } else {
        newAmountRef.current?.focus()
      }
    }, 80)
    return () => clearTimeout(timer)
  }, [dialog?.vendor_id, dialog?.month])

  async function openPreview(filePath: string) {
    setPreviewLoading(true)
    try {
      const res = await fetch(`/api/evidence?path=${encodeURIComponent(filePath)}&json=1`)
      const { signedUrl } = await res.json()
      const isPdf = /\.pdf$/i.test(filePath)
      setPreview({ url: signedUrl, isPdf })
    } catch {
      toast.error('プレビューの取得に失敗しました')
    } finally {
      setPreviewLoading(false)
    }
  }
  const [uploading, setUploading] = useState<Record<string, boolean>>({})
  const [newFile, setNewFile] = useState<File | null>(null)

  // 月一覧（昇順）＋ユーザーが追加した月
  const dbMonths = [...new Set(costs.map(c => c.billing_month?.slice(0, 7) ?? ''))].filter(Boolean)
  const [extraMonths, setExtraMonths] = useState<string[]>([])
  const [addingMonth, setAddingMonth] = useState(false)
  const _now = new Date()
  const [monthPickYear, setMonthPickYear] = useState(_now.getFullYear())
  const [monthPickMonth, setMonthPickMonth] = useState(_now.getMonth() + 1)
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null)
  const months = [...new Set([...dbMonths, ...extraMonths])].sort()

  // 業者一覧（合計降順）＋ユーザーが追加した業者
  const vendorTotals: Record<string, number> = {}
  costs.forEach(c => { vendorTotals[c.vendor_id] = (vendorTotals[c.vendor_id] ?? 0) + c.amount })
  const dbVendors = Object.keys(vendorTotals).sort((a, b) => vendorTotals[b] - vendorTotals[a])
  const [extraVendors, setExtraVendors] = useState<string[]>([])
  const [addingVendor, setAddingVendor] = useState(false)
  const [selectedVendorId, setSelectedVendorId] = useState('')
  const vendors = [...new Set([...dbVendors, ...extraVendors])]

  const VENDOR_CATEGORY_ORDER: Record<string, number> = { '協力業者': 0, '仕入先': 1, '経費': 2 }
  const vendorOptions = partners
    .filter(p => p.category !== '得意先' && !vendors.includes(p.partner_id))
    .sort((a, b) => {
      const catDiff = (VENDOR_CATEGORY_ORDER[a.category] ?? 99) - (VENDOR_CATEGORY_ORDER[b.category] ?? 99)
      if (catDiff !== 0) return catDiff
      return a.name.localeCompare(b.name, 'ja')
    })

  // ピボット: [vendor_id][month] = Cost[]
  const pivot: Record<string, Record<string, Cost[]>> = {}
  costs.forEach(c => {
    const month = c.billing_month?.slice(0, 7) ?? ''
    if (!pivot[c.vendor_id]) pivot[c.vendor_id] = {}
    if (!pivot[c.vendor_id][month]) pivot[c.vendor_id][month] = []
    pivot[c.vendor_id][month].push(c)
  })

  const cellTotal = (vid: string, m: string) =>
    (pivot[vid]?.[m] ?? []).reduce((s, c) => s + c.amount, 0)
  const monthTotal = (m: string) =>
    vendors.reduce((s, vid) => s + cellTotal(vid, m), 0)
  const grandTotal = vendors.reduce((s, vid) => s + vendorTotals[vid], 0)

  const dialogRecords = dialog ? (pivot[dialog.vendor_id]?.[dialog.month] ?? []) : []

  async function saveRecord(cost: Cost) {
    const newAmt = parseInt((editAmounts[cost.cost_id] ?? '').replace(/,/g, ''))
    const newTax = editTaxTypes[cost.cost_id] ?? cost.tax_type
    if (isNaN(newAmt) || (newAmt === cost.amount && newTax === cost.tax_type)) return
    setSaving(s => ({ ...s, [cost.cost_id]: true }))
    const res = await fetch('/api/costs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: cost.cost_id, amount: newAmt, tax_type: newTax }),
    })
    setSaving(s => ({ ...s, [cost.cost_id]: false }))
    if (res.ok) { toast.success('更新しました'); router.refresh() }
    else toast.error('更新に失敗しました')
  }

  async function deleteRecord(cost: Cost) {
    if (!confirm('この原価を削除しますか？')) return
    const res = await fetch('/api/costs', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: cost.cost_id }),
    })
    if (res.ok) { toast.success('削除しました'); router.refresh(); setDialog(null) }
    else toast.error('削除に失敗しました')
  }

  async function createRecord() {
    if (!dialog || !newAmount) return
    const amt = parseInt(newAmount.replace(/,/g, ''))
    if (isNaN(amt) || amt <= 0) { toast.error('金額を入力してください'); return }
    setCreating(true)

    let res: Response
    if (newFile) {
      const form = new FormData()
      form.append('project_id', projectId)
      form.append('vendor_id', dialog.vendor_id)
      form.append('billing_month', dialog.month + '-01')
      form.append('amount', String(amt))
      form.append('tax_type', newTaxType)
      form.append('target_date', dialog.month + '-01')
      form.append('file', newFile)
      res = await fetch('/api/costs', { method: 'POST', body: form })
    } else {
      res = await fetch('/api/costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, vendor_id: dialog.vendor_id, billing_month: dialog.month + '-01', amount: amt, tax_type: newTaxType }),
      })
    }

    setCreating(false)
    if (res.ok) {
      toast.success('登録しました')
      setNewAmount('')
      setNewTaxType('税抜')
      setNewFile(null)
      setExtraMonths(prev => prev.filter(m => m !== dialog.month))
      setExtraVendors(prev => prev.filter(v => v !== dialog.vendor_id))
      router.refresh()
      setDialog(null)
    } else toast.error('登録に失敗しました')
  }

  async function uploadEvidenceForCost(cost: Cost, file: File) {
    setUploading(u => ({ ...u, [cost.cost_id]: true }))
    const form = new FormData()
    form.append('id', cost.cost_id)
    form.append('file', file)
    form.append('target_date', cost.billing_month)
    const res = await fetch('/api/costs', { method: 'PATCH', body: form })
    setUploading(u => ({ ...u, [cost.cost_id]: false }))
    if (res.ok) { toast.success('証憑を添付しました'); router.refresh() }
    else toast.error('アップロードに失敗しました')
  }

  function addMonthColumn() {
    const m = `${monthPickYear}-${String(monthPickMonth).padStart(2, '0')}`
    if (!months.includes(m)) setExtraMonths(prev => [...prev, m])
    setAddingMonth(false)
  }

  function addVendorRow() {
    if (!selectedVendorId) return
    if (!vendors.includes(selectedVendorId)) setExtraVendors(prev => [...prev, selectedVendorId])
    setAddingVendor(false)
    setSelectedVendorId('')
  }

  function exportExcel() {
    import('xlsx').then(({ utils, writeFile }) => {
      const header = ['業者', '合計', ...months]
      const rows = [
        ['合計', grandTotal, ...months.map(m => monthTotal(m))],
        ...vendors.map(vid => [
          partnerMap[vid] ?? '(不明)',
          vendorTotals[vid],
          ...months.map(m => cellTotal(vid, m)),
        ]),
      ]
      const ws = utils.aoa_to_sheet([header, ...rows])
      const wb = utils.book_new()
      utils.book_append_sheet(wb, ws, '原価ピボット')
      writeFile(wb, `原価_${projectId}_${new Date().toLocaleDateString('ja-JP').replace(/\//g, '')}.xlsx`)
    })
  }

  return (
    <>
      <div className="flex justify-end mb-2">
        <Button variant="outline" size="sm" onClick={exportExcel} className="text-xs h-7 gap-1.5">
          📥 Excel出力
        </Button>
      </div>
      <div className="overflow-auto" ref={pivotScrollRef}>
        <table className="border-separate border-spacing-0" style={{ fontSize: '10px' }}>
          <thead>
            <tr>
              <th className="text-left py-2 pr-2 font-medium text-muted-foreground whitespace-nowrap sticky left-0 bg-background w-[128px] min-w-[128px] border-b">業者</th>
              <th className="text-right py-2 px-3 font-medium text-muted-foreground whitespace-nowrap sticky left-[128px] bg-background border-r border-b">合計</th>
              {months.map(m => (
                <th
                  key={m}
                  className={`text-right py-2 px-3 font-medium whitespace-nowrap transition-colors border-b ${hoveredMonth === m ? 'bg-blue-100 text-blue-700' : 'text-muted-foreground'}`}
                >{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="font-bold bg-muted/30">
              <td className="py-2 pr-2 sticky left-0 bg-muted/30 w-[128px] min-w-[128px] border-b">合計</td>
              <td className="py-2 px-3 text-right sticky left-[128px] bg-muted/30 border-r border-b">{fmtAmt(grandTotal)}</td>
              {months.map(m => (
                <td key={m} className={`py-2 px-3 text-right whitespace-nowrap transition-colors border-b ${hoveredMonth === m ? 'bg-blue-50' : ''}`}>{fmtAmt(monthTotal(m))}</td>
              ))}
            </tr>
            {vendors.map((vid, idx) => {
              const name = partnerMap[vid] ?? '(不明)'
              const shortName = normalizeCompanyName(name)
              const isRowHovered = hoveredRow === vid
              const isLast = idx === vendors.length - 1
              return (
                <tr
                  key={vid}
                  onMouseEnter={() => setHoveredRow(vid)}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  <td
                    className={`py-2 pr-2 whitespace-nowrap sticky left-0 transition-colors font-medium w-[128px] min-w-[128px] overflow-hidden text-ellipsis ${isLast ? '' : 'border-b'} ${isRowHovered ? 'bg-amber-50 text-amber-800' : 'bg-background text-foreground'}`}
                    title={name}
                  >{shortName}</td>
                  <td className={`py-2 px-3 text-right font-medium whitespace-nowrap sticky left-[128px] transition-colors border-r ${isLast ? '' : 'border-b'} ${isRowHovered ? 'bg-amber-50' : 'bg-background'}`}>{fmtAmt(vendorTotals[vid])}</td>
                  {months.map(m => {
                    const records = pivot[vid]?.[m] ?? []
                    const total = records.reduce((s, c) => s + c.amount, 0)
                    const isColHovered = hoveredMonth === m
                    return (
                      <td
                        key={m}
                        className={`py-2 px-3 text-right whitespace-nowrap cursor-pointer transition-colors rounded ${isLast ? '' : 'border-b'}
                          ${isRowHovered && isColHovered ? 'bg-blue-200 text-blue-900' : isRowHovered ? 'bg-amber-50' : isColHovered ? 'bg-blue-50 text-blue-700' : 'hover:bg-blue-50 hover:text-blue-700'}`}
                        onMouseEnter={() => setHoveredMonth(m)}
                        onMouseLeave={() => setHoveredMonth(null)}
                        onClick={() => {
                          setDialog({ vendor_id: vid, month: m })
                          setNewAmount('')
                          const initAmt: Record<string, string> = {}
                          const initTax: Record<string, TaxType> = {}
                          records.forEach(c => {
                            initAmt[c.cost_id] = c.amount.toLocaleString('ja-JP')
                            initTax[c.cost_id] = c.tax_type ?? '税抜'
                          })
                          setEditAmounts(initAmt)
                          setEditTaxTypes(initTax)
                          setNewTaxType('税抜')
                        }}
                      >
                        {records.length > 0 ? fmtAmt(total) : <span className="text-muted-foreground/40">—</span>}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          {addingVendor ? (
            <>
              <select
                className="border rounded px-2 py-1 text-sm"
                value={selectedVendorId}
                onChange={e => setSelectedVendorId(e.target.value)}
                autoFocus
              >
                <option value="">業者を選択</option>
                {(['協力業者', '仕入先', '経費'] as const).map(cat => {
                  const opts = vendorOptions.filter(p => p.category === cat)
                  if (opts.length === 0) return null
                  return (
                    <optgroup key={cat} label={cat}>
                      {opts.map(p => (
                        <option key={p.partner_id} value={p.partner_id}>{normalizeCompanyName(p.name)}</option>
                      ))}
                    </optgroup>
                  )
                })}
              </select>
              <button onClick={addVendorRow} className="text-sm text-blue-600 font-medium hover:underline">追加</button>
              <button onClick={() => { setAddingVendor(false); setSelectedVendorId('') }} className="text-sm text-muted-foreground hover:text-foreground">キャンセル</button>
            </>
          ) : (
            <button
              onClick={() => setAddingVendor(true)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <span className="text-base font-bold leading-none">+</span> 業者を追加
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {addingMonth ? (
            <div className="flex flex-col gap-2 bg-slate-50 border rounded p-2">
              {/* 年選択 */}
              <div className="flex items-center gap-1.5">
                <button
                  className="h-6 w-6 rounded border border-input flex items-center justify-center text-xs hover:bg-slate-100"
                  onClick={() => setMonthPickYear(y => y - 1)}
                >−</button>
                <span className="w-14 text-center text-sm font-medium tabular-nums">{monthPickYear}年</span>
                <button
                  className="h-6 w-6 rounded border border-input flex items-center justify-center text-xs hover:bg-slate-100"
                  onClick={() => setMonthPickYear(y => y + 1)}
                >+</button>
              </div>
              {/* 月選択 */}
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <button
                    key={m}
                    onClick={() => setMonthPickMonth(m)}
                    className={`h-7 w-9 rounded text-xs font-medium transition-colors ${monthPickMonth === m ? 'bg-blue-600 text-white' : 'border border-input hover:bg-slate-100'}`}
                  >{m}月</button>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-0.5">
                <span className="text-xs text-muted-foreground">
                  {monthPickYear}-{String(monthPickMonth).padStart(2, '0')} を追加
                </span>
                <button onClick={addMonthColumn} className="text-xs text-blue-600 font-medium hover:underline">追加</button>
                <button onClick={() => setAddingMonth(false)} className="text-xs text-muted-foreground hover:text-foreground">キャンセル</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingMonth(true)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <span className="text-base font-bold leading-none">+</span> 月を追加
            </button>
          )}
        </div>
      </div>

      <Dialog open={!!dialog} onOpenChange={open => { if (!open) { setDialog(null); setNewFile(null); setPreview(null) } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialog && `${normalizeCompanyName(partnerMap[dialog.vendor_id] ?? dialog.vendor_id)} / ${dialog.month}`}
            </DialogTitle>
            <DialogClose className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </DialogClose>
          </DialogHeader>

          <div className="space-y-3">
            {dialogRecords.map((cost, idx) => (
              <div key={cost.cost_id} className="border rounded p-2 space-y-1.5">
                <div className="flex items-center gap-2">
                  <select
                    className="border rounded px-1.5 py-1 text-xs text-muted-foreground bg-background"
                    value={editTaxTypes[cost.cost_id] ?? cost.tax_type ?? '税抜'}
                    onChange={e => setEditTaxTypes(t => ({ ...t, [cost.cost_id]: e.target.value as TaxType }))}
                  >
                    <option value="税抜">税抜</option>
                    <option value="税込">税込</option>
                    <option value="免税">免税</option>
                  </select>
                  <input
                    ref={idx === 0 ? firstEditRef : undefined}
                    className="flex-1 text-right border rounded px-2 py-1 text-sm tabular-nums"
                    inputMode="numeric"
                    value={editAmounts[cost.cost_id] ?? cost.amount.toLocaleString('ja-JP')}
                    onChange={e => setEditAmounts(a => ({ ...a, [cost.cost_id]: fmtAmountInput(e.target.value) }))}
                    onFocus={e => e.target.select()}
                  />
                  <Button size="sm" variant="outline" disabled={saving[cost.cost_id]} onClick={() => saveRecord(cost)}>
                    <Save className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => deleteRecord(cost)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  {cost.file_path ? (
                    <button
                      className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                      disabled={previewLoading}
                      onClick={() => openPreview(cost.file_path!)}
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                      {previewLoading ? '読込中...' : '証憑を見る'}
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">証憑なし</span>
                  )}
                  <label className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 cursor-pointer ml-auto">
                    <Paperclip className="h-3.5 w-3.5" />
                    {uploading[cost.cost_id] ? 'アップロード中...' : cost.file_path ? '差し替え' : '添付'}
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      disabled={uploading[cost.cost_id]}
                      onChange={e => {
                        const f = e.target.files?.[0]
                        if (f) uploadEvidenceForCost(cost, f)
                        e.target.value = ''
                      }}
                    />
                  </label>
                </div>
              </div>
            ))}
            {dialogRecords.length > 0 && (
              <div className="text-right text-sm font-medium pt-1 border-t">
                合計: {fmtAmt(dialogRecords.reduce((s, c) => s + c.amount, 0))}
              </div>
            )}
            <div className="pt-2 border-t space-y-2">
              <span className="text-xs text-muted-foreground">新規追加</span>
              <div className="flex items-center gap-2">
                <select
                  className="border rounded px-1.5 py-1 text-xs text-muted-foreground bg-background"
                  value={newTaxType}
                  onChange={e => setNewTaxType(e.target.value as TaxType)}
                >
                  <option value="税抜">税抜</option>
                  <option value="税込">税込</option>
                  <option value="免税">免税</option>
                </select>
                <input
                  ref={newAmountRef}
                  className="flex-1 text-right border rounded px-2 py-1 text-sm tabular-nums"
                  inputMode="numeric"
                  placeholder="金額"
                  value={newAmount}
                  onChange={e => setNewAmount(fmtAmountInput(e.target.value))}
                  onFocus={e => e.target.select()}
                  onKeyDown={e => { if (e.key === 'Enter') createRecord() }}
                />
                <Button size="sm" disabled={creating || !newAmount} onClick={createRecord}>登録</Button>
              </div>
              <label className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 cursor-pointer w-fit">
                <Paperclip className="h-3.5 w-3.5" />
                {newFile ? newFile.name : '証憑ファイルを添付（任意）'}
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={e => setNewFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {newFile && (
                <button className="text-xs text-slate-400 hover:text-red-500" onClick={() => setNewFile(null)}>
                  × ファイルを削除
                </button>
              )}
            </div>
          </div>

          {/* 証憑プレビューモーダル */}
          {preview && (
            <div
              className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
              onClick={() => setPreview(null)}
            >
              <div
                className="bg-white rounded-lg w-full max-w-3xl p-4 space-y-2"
                style={{ maxHeight: '90vh' }}
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">証憑プレビュー</span>
                  <div className="flex items-center gap-3">
                    <a
                      href={preview.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      別タブで開く
                    </a>
                    <button className="text-slate-500 hover:text-slate-800 text-lg leading-none" onClick={() => setPreview(null)}>×</button>
                  </div>
                </div>
                {preview.isPdf ? (
                  <iframe
                    src={preview.url}
                    className="w-full rounded border"
                    style={{ height: '75vh' }}
                    title="証憑PDF"
                  />
                ) : (
                  <div className="overflow-auto" style={{ maxHeight: '75vh' }}>
                    <img src={preview.url} alt="証憑" className="max-w-full rounded" />
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function KpiCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-slate-50 rounded-lg px-4 py-3 border border-slate-100">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold mt-1 tabular-nums ${highlight === false ? 'text-red-600' : highlight ? 'text-emerald-600' : 'text-slate-800'}`}>{value}</p>
    </div>
  )
}
