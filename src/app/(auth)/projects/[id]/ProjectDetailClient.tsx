'use client'

import { useState, useTransition } from 'react'
import { Project, Cost, Sale, Addon, Partner, User } from '@/types'
import { formatYenFull } from '@/lib/utils/date'
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
import { Trash2, Save, ExternalLink, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog'

interface Props {
  project: Project
  costs: Cost[]
  sales: Sale[]
  addons: Addon[]
  partners: Partner[]
  users: User[]
}

const STATUS_OPTIONS = ['受注', '着工中', '完工', '入金済']
const STRUCTURES = ['RC造', 'S造', '木造', 'SRC造', '軽量鉄骨造', 'その他']

export function ProjectDetailClient({ project, costs, sales, addons, partners, users }: Props) {
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

  // 追加工事フォーム
  const [addonDate, setAddonDate] = useState('')
  const [addonDesc, setAddonDesc] = useState('')
  const [addonAmount, setAddonAmount] = useState('')

  // 売上登録フォーム
  const [saleDate, setSaleDate] = useState('')
  const [saleRemarks, setSaleRemarks] = useState('')
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
        setSaleDate(''); setSaleRemarks(''); setSaleAmount('')
        router.refresh()
      } else {
        toast.error('登録に失敗しました')
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-mono">{project.project_id}</p>
          <h1 className="text-2xl font-bold">{project.site_name}</h1>
        </div>
        <Badge variant={project.status === '入金済' ? 'secondary' : 'default'}>{project.status}</Badge>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="契約金額（追加含む）" value={formatYenFull(totalContract)} />
        <KpiCard label="請求済売上" value={formatYenFull(salesSum)} />
        <KpiCard label="原価合計" value={formatYenFull(costsSum)} />
        <KpiCard label="予想粗利" value={formatYenFull(profit)} highlight={profit >= 0} />
      </div>

      {/* 進捗バー */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>請求進捗</span>
          <span>{(progress * 100).toFixed(1)}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(progress * 100, 100)}%` }} />
        </div>
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
                <CostPivotTable costs={costs} partnerMap={partnerMap} projectId={project.project_id} />
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
                    <tr className="border-b">
                      <th className="text-left py-2 pr-3 font-medium text-muted-foreground">日付</th>
                      <th className="text-left py-2 pr-3 font-medium text-muted-foreground">内容</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">金額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {addons.map(a => (
                      <tr key={a.addon_id} className="border-b last:border-0">
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
                    <tr className="border-b">
                      <th className="text-left py-2 pr-3 font-medium text-muted-foreground">請求日</th>
                      <th className="text-left py-2 pr-3 font-medium text-muted-foreground">名称</th>
                      <th className="text-right py-2 pr-3 font-medium text-muted-foreground">金額</th>
                      <th className="text-center py-2 font-medium text-muted-foreground">状態</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map(s => (
                      <tr key={s.sales_id} className="border-b last:border-0">
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
                    <SelectTrigger><SelectValue>{partnerMap[customerId] ?? customerId}</SelectValue></SelectTrigger>
                    <SelectContent>{customers.map(c => <SelectItem key={c.partner_id} value={c.partner_id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>得意先担当者</Label>
                  <Input value={customerContact} onChange={e => setCustomerContact(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>担当者</Label>
                  <Select value={managerId} onValueChange={(v) => setManagerId(v ?? "")}>
                    <SelectTrigger><SelectValue>{userMap[managerId] ?? managerId}</SelectValue></SelectTrigger>
                    <SelectContent>{users.map(u => <SelectItem key={u.user_id} value={u.user_id}>{u.username}</SelectItem>)}</SelectContent>
                  </Select>
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
                  <Save className="h-4 w-4" />更新
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

function CostPivotTable({ costs, partnerMap, projectId }: { costs: Cost[]; partnerMap: Record<string, string>; projectId: string }) {
  const router = useRouter()
  const [dialog, setDialog] = useState<{ vendor_id: string; month: string } | null>(null)
  const [editAmounts, setEditAmounts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [newAmount, setNewAmount] = useState('')
  const [creating, setCreating] = useState(false)

  // 月一覧（昇順）＋ユーザーが追加した月
  const dbMonths = [...new Set(costs.map(c => c.billing_month?.slice(0, 7) ?? ''))].filter(Boolean)
  const [extraMonths, setExtraMonths] = useState<string[]>([])
  const [addingMonth, setAddingMonth] = useState(false)
  const [monthInput, setMonthInput] = useState('')
  const months = [...new Set([...dbMonths, ...extraMonths])].sort()

  // 業者一覧（合計降順）
  const vendorTotals: Record<string, number> = {}
  costs.forEach(c => { vendorTotals[c.vendor_id] = (vendorTotals[c.vendor_id] ?? 0) + c.amount })
  const vendors = Object.keys(vendorTotals).sort((a, b) => vendorTotals[b] - vendorTotals[a])

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
    if (isNaN(newAmt) || newAmt === cost.amount) return
    setSaving(s => ({ ...s, [cost.cost_id]: true }))
    const res = await fetch('/api/costs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: cost.cost_id, amount: newAmt }),
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
    const res = await fetch('/api/costs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        vendor_id: dialog.vendor_id,
        billing_month: dialog.month + '-01',
        amount: amt,
      }),
    })
    setCreating(false)
    if (res.ok) {
      toast.success('登録しました')
      setNewAmount('')
      setExtraMonths(prev => prev.filter(m => m !== dialog.month))
      router.refresh()
      setDialog(null)
    } else toast.error('登録に失敗しました')
  }

  function addMonthColumn() {
    const m = monthInput
    if (!m) return
    if (!months.includes(m)) setExtraMonths(prev => [...prev, m])
    setAddingMonth(false)
    setMonthInput('')
  }

  return (
    <>
      <div className="overflow-auto">
        <table className="border-collapse" style={{ fontSize: '10px' }}>
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 pr-4 font-medium text-muted-foreground whitespace-nowrap sticky left-0 bg-background">業者</th>
              <th className="text-right py-2 px-3 font-medium text-muted-foreground whitespace-nowrap">合計</th>
              {months.map(m => (
                <th key={m} className="text-right py-2 px-3 font-medium text-muted-foreground whitespace-nowrap">{m}</th>
              ))}
              <th className="py-2 px-2">
                {addingMonth ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="month"
                      className="border rounded px-1 py-0.5 text-xs"
                      value={monthInput}
                      onChange={e => setMonthInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') addMonthColumn(); if (e.key === 'Escape') setAddingMonth(false) }}
                      autoFocus
                    />
                    <button onClick={addMonthColumn} className="text-blue-600 font-bold text-xs">✓</button>
                    <button onClick={() => setAddingMonth(false)} className="text-muted-foreground text-xs">✕</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingMonth(true)}
                    className="text-muted-foreground hover:text-foreground font-bold text-base leading-none"
                    title="月を追加"
                  >+</button>
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b font-bold bg-muted/30">
              <td className="py-2 pr-4 sticky left-0 bg-muted/30">合計</td>
              <td className="py-2 px-3 text-right">{fmtAmt(grandTotal)}</td>
              {months.map(m => (
                <td key={m} className="py-2 px-3 text-right whitespace-nowrap">{fmtAmt(monthTotal(m))}</td>
              ))}
              <td />
            </tr>
            {vendors.map(vid => {
              const name = partnerMap[vid] ?? '(不明)'
              const shortName = normalizeCompanyName(name)
              return (
                <tr key={vid} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="py-2 pr-4 whitespace-nowrap sticky left-0 bg-background" title={name}>{shortName}</td>
                  <td className="py-2 px-3 text-right font-medium whitespace-nowrap">{fmtAmt(vendorTotals[vid])}</td>
                  {months.map(m => {
                    const records = pivot[vid]?.[m] ?? []
                    const total = records.reduce((s, c) => s + c.amount, 0)
                    return (
                      <td
                        key={m}
                        className="py-2 px-3 text-right whitespace-nowrap cursor-pointer hover:bg-blue-50 hover:text-blue-700 rounded"
                        onClick={() => {
                          setDialog({ vendor_id: vid, month: m })
                          setNewAmount('')
                          const init: Record<string, string> = {}
                          records.forEach(c => { init[c.cost_id] = c.amount.toLocaleString() })
                          setEditAmounts(init)
                        }}
                      >
                        {records.length > 0 ? fmtAmt(total) : <span className="text-muted-foreground">—</span>}
                      </td>
                    )
                  })}
                  <td />
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={!!dialog} onOpenChange={open => { if (!open) setDialog(null) }}>
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
            {dialogRecords.map(cost => (
              <div key={cost.cost_id} className="flex items-center gap-2 border rounded p-2">
                <input
                  className="flex-1 text-right border rounded px-2 py-1 text-sm"
                  value={editAmounts[cost.cost_id] ?? cost.amount.toLocaleString()}
                  onChange={e => setEditAmounts(a => ({ ...a, [cost.cost_id]: e.target.value }))}
                  onFocus={e => e.target.select()}
                />
                <Button size="sm" variant="outline" disabled={saving[cost.cost_id]} onClick={() => saveRecord(cost)}>
                  <Save className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => deleteRecord(cost)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {dialogRecords.length > 0 && (
              <div className="text-right text-sm font-medium pt-1 border-t">
                合計: {fmtAmt(dialogRecords.reduce((s, c) => s + c.amount, 0))}
              </div>
            )}
            <div className="flex items-center gap-2 pt-2 border-t">
              <span className="text-xs text-muted-foreground">新規追加</span>
              <input
                className="flex-1 text-right border rounded px-2 py-1 text-sm"
                placeholder="金額"
                value={newAmount}
                onChange={e => setNewAmount(e.target.value)}
                onFocus={e => e.target.select()}
                onKeyDown={e => { if (e.key === 'Enter') createRecord() }}
              />
              <Button size="sm" disabled={creating || !newAmount} onClick={createRecord}>登録</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function KpiCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-lg font-bold mt-1 ${highlight === false ? 'text-red-600' : highlight ? 'text-green-600' : ''}`}>{value}</p>
      </CardContent>
    </Card>
  )
}
