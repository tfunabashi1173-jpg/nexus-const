'use client'

import { useState, useTransition } from 'react'
import { Sale, Project } from '@/types'
import { formatYenFull } from '@/lib/utils/date'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AmountInput } from '@/components/ui/amount-input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface Props {
  sales: Sale[]
  projects: Project[]
}

export function SalesClient({ sales, projects }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const projectMap = Object.fromEntries(projects.map(p => [p.project_id, p.site_name]))
  const depositDateMap = Object.fromEntries(projects.map(p => [p.project_id, p.scheduled_deposit_date]))

  const [deletedSaleIds, setDeletedSaleIds] = useState<Set<string>>(new Set())
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const unpaid = sales.filter(s => !s.deposit_status && !deletedSaleIds.has(s.sales_id))
  const paid = sales.filter(s => s.deposit_status && !deletedSaleIds.has(s.sales_id))

  // 新規売上登録
  const [showNewForm, setShowNewForm] = useState(false)
  const [newProjectId, setNewProjectId] = useState('')
  const [newBillingDate, setNewBillingDate] = useState('')
  const [newRemarks, setNewRemarks] = useState('')
  const [newAmount, setNewAmount] = useState('')

  const activeProjects = projects.filter(p => p.status !== '入金済')

  function addSale() {
    if (!newProjectId || !newBillingDate || !newAmount) {
      toast.error('現場・請求日・金額は必須です')
      return
    }
    startTransition(async () => {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: newProjectId,
          billing_date: newBillingDate,
          remarks: newRemarks,
          amount: parseInt(newAmount.replace(/,/g, '')) || 0,
          deposit_status: false,
          deposit_date: null,
        }),
      })
      if (res.ok) {
        toast.success('登録しました')
        setNewProjectId('')
        setNewBillingDate('')
        setNewRemarks('')
        setNewAmount('')
        setShowNewForm(false)
        router.refresh()
      } else {
        toast.error('登録に失敗しました')
      }
    })
  }

  // 売上編集・削除
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null)
  const [editBillingDate, setEditBillingDate] = useState('')
  const [editSaleAmount, setEditSaleAmount] = useState('')
  const [editRemarks, setEditRemarks] = useState('')

  function startSaleEdit(s: Sale) {
    setEditingSaleId(s.sales_id)
    setEditBillingDate(s.billing_date ?? '')
    setEditSaleAmount(String(s.amount))
    setEditRemarks(s.remarks ?? '')
  }

  function cancelSaleEdit() { setEditingSaleId(null) }

  function saveSaleEdit() {
    if (!editingSaleId) return
    startTransition(async () => {
      const res = await fetch('/api/sales', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingSaleId,
          billing_date: editBillingDate,
          amount: parseInt(editSaleAmount.replace(/,/g, '')) || 0,
          remarks: editRemarks,
        }),
      })
      if (res.ok) {
        toast.success('更新しました')
        setEditingSaleId(null)
        router.refresh()
      } else {
        toast.error('更新に失敗しました')
      }
    })
  }

  function deleteSale(id: string) {
    startTransition(async () => {
      const res = await fetch('/api/sales', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        setDeletedSaleIds(prev => new Set([...prev, id]))
        toast.success('削除しました')
      } else {
        toast.error('削除に失敗しました')
      }
    })
  }

  // 入金履歴フィルタ
  const now = new Date()
  const [historyYear, setHistoryYear] = useState(now.getFullYear())
  const [historyMonth, setHistoryMonth] = useState(now.getMonth() + 1)
  const filteredPaid = paid.filter(s => {
    if (!s.deposit_date) return false
    const [y, m] = s.deposit_date.split('-').map(Number)
    return y === historyYear && m === historyMonth
  })

  // 入金消込状態
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [depositDate, setDepositDate] = useState('')
  const [depositAmount, setDepositAmount] = useState('')

  const selectedSale = selectedId ? sales.find(s => s.sales_id === selectedId) : null

  function handleDeposit() {
    if (!selectedId || !depositDate) { toast.error('入金日を入力してください'); return }
    const amount = parseInt(depositAmount.replace(/,/g, '')) || selectedSale?.amount || 0

    startTransition(async () => {
      const res = await fetch('/api/sales', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedId,
          deposit_status: true,
          deposit_date: depositDate,
          amount,
        }),
      })
      if (res.ok) {
        toast.success('入金消込しました')
        setSelectedId(null)
        setDepositDate('')
        setDepositAmount('')
        router.refresh()
      } else {
        toast.error('処理に失敗しました')
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">売上・入金管理</h1>
        <Button size="sm" onClick={() => setShowNewForm(v => !v)} variant={showNewForm ? 'outline' : 'default'}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          新規登録
        </Button>
      </div>

      {showNewForm && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <p className="text-sm font-medium">売上を登録</p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="space-y-1 md:col-span-1">
                <Label className="text-xs">現場 <span className="text-destructive">*</span></Label>
                <Select value={newProjectId} onValueChange={v => setNewProjectId(v ?? '')}>
                  <SelectTrigger><SelectValue placeholder="現場を選択" /></SelectTrigger>
                  <SelectContent>
                    {activeProjects.map(p => (
                      <SelectItem key={p.project_id} value={p.project_id}>{p.site_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">請求日 <span className="text-destructive">*</span></Label>
                <Input type="date" value={newBillingDate} onChange={e => setNewBillingDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">名称・摘要</Label>
                <Input value={newRemarks} onChange={e => setNewRemarks(e.target.value)} placeholder="例：第1回請求" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">金額（税抜）<span className="text-destructive">*</span></Label>
                <AmountInput value={newAmount} onChange={setNewAmount} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={addSale} disabled={isPending}>登録</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowNewForm(false)}>キャンセル</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="unpaid">
        <TabsList>
          <TabsTrigger value="unpaid">入金消込（未入金）<Badge variant="destructive" className="ml-1.5 text-xs">{unpaid.length}</Badge></TabsTrigger>
          <TabsTrigger value="history">入金履歴</TabsTrigger>
        </TabsList>

        {/* 未入金一覧 */}
        <TabsContent value="unpaid">
          <Card>
            <CardContent className="pt-4 space-y-4">
              {unpaid.length === 0 ? (
                <p className="text-sm text-muted-foreground">未入金の請求はありません</p>
              ) : (
                <>
                  <div className="overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-800 text-white sticky top-0 z-10">
                          <th className="text-left py-2.5 px-3 font-medium">請求日</th>
                          <th className="text-left py-2.5 px-3 font-medium">現場名</th>
                          <th className="text-left py-2.5 px-3 font-medium">名称</th>
                          <th className="text-right py-2.5 px-3 font-medium">金額</th>
                          <th className="text-left py-2.5 px-3 font-medium">入金予定日</th>
                          <th className="py-2.5 px-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {unpaid.map((s, i) => (
                          <tr
                            key={s.sales_id}
                            className={`border-b last:border-0 cursor-pointer transition-colors ${selectedId === s.sales_id ? 'bg-blue-50' : i % 2 === 1 ? 'bg-slate-50 hover:bg-blue-50' : 'bg-white hover:bg-blue-50'}`}
                            onClick={() => {
                              setSelectedId(s.sales_id)
                              setDepositAmount(String(s.amount).replace(/,/g, ''))
                            }}
                          >
                            <td className="py-2 pr-3">{s.billing_date?.slice(0, 7)}</td>
                            <td className="py-2 pr-3">{projectMap[s.project_id] ?? '(不明)'}</td>
                            <td className="py-2 pr-3">{s.remarks}</td>
                            <td className="py-2 pr-3 text-right">{formatYenFull(s.amount)}</td>
                            <td className="py-2">{depositDateMap[s.project_id] ?? '-'}</td>
                            <td className="py-2 pr-3 text-right" onClick={e => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setConfirmDeleteId(s.sales_id)} disabled={isPending}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {selectedSale && (
                    <div className="border-t pt-4 space-y-3">
                      <p className="font-medium text-sm">
                        選択中: <span className="text-primary">{projectMap[selectedSale.project_id] ?? '(不明)'}</span> — {selectedSale.remarks}（¥{selectedSale.amount.toLocaleString()}）
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">入金日 <span className="text-destructive">*</span></Label>
                          <Input type="date" value={depositDate} onChange={e => setDepositDate(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">入金金額（税抜）</Label>
                          <AmountInput
                            value={depositAmount}
                            onChange={setDepositAmount}
                          />
                          <p className="text-xs text-muted-foreground">請求額と異なる場合は差額が残ります</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleDeposit} disabled={isPending}>入金消込</Button>
                        <Button variant="ghost" onClick={() => setSelectedId(null)}>キャンセル</Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 入金履歴 */}
        <TabsContent value="history">
          <Card>
            <CardContent className="pt-4 space-y-3">
              {/* 年月フィルタ */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <button className="h-7 w-7 rounded border border-input flex items-center justify-center text-sm hover:bg-slate-100" onClick={() => setHistoryYear(v => v - 1)}>−</button>
                  <span className="w-14 text-center text-sm font-medium">{historyYear}年</span>
                  <button className="h-7 w-7 rounded border border-input flex items-center justify-center text-sm hover:bg-slate-100" onClick={() => setHistoryYear(v => v + 1)}>+</button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <button
                      key={m}
                      onClick={() => setHistoryMonth(m)}
                      className={`h-7 px-2.5 rounded text-xs font-medium transition-colors ${historyMonth === m ? 'bg-blue-600 text-white' : 'border border-input hover:bg-slate-100'}`}
                    >{m}月</button>
                  ))}
                </div>
                <span className="text-xs text-slate-400 ml-auto">{filteredPaid.length}件</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm table-fixed min-w-[640px]">
                  <colgroup>
                    <col className="w-24" />
                    <col className="w-64" />
                    <col className="w-36" />
                    <col className="w-32" />
                    <col className="w-24" />
                    <col className="w-16" />
                  </colgroup>
                  <thead>
                    <tr className="bg-slate-800 text-white sticky top-0 z-10">
                      <th className="text-left py-2.5 px-3 font-medium whitespace-nowrap">請求日</th>
                      <th className="text-left py-2.5 px-3 font-medium">現場名</th>
                      <th className="text-left py-2.5 px-3 font-medium">名称</th>
                      <th className="text-right py-2.5 px-3 font-medium whitespace-nowrap">金額</th>
                      <th className="text-left py-2.5 px-3 font-medium whitespace-nowrap">入金日</th>
                      <th className="py-2.5 px-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPaid.map((s, i) => (
                      editingSaleId === s.sales_id ? (
                        <tr key={s.sales_id} className="border-b bg-blue-50">
                          <td colSpan={6} className="py-3 px-3">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                              <div>
                                <Label className="text-xs">請求日</Label>
                                <Input type="date" value={editBillingDate} onChange={e => setEditBillingDate(e.target.value)} className="h-8 text-sm" />
                              </div>
                              <div>
                                <Label className="text-xs">金額</Label>
                                <AmountInput value={editSaleAmount} onChange={setEditSaleAmount} className="h-8 text-sm" />
                              </div>
                              <div>
                                <Label className="text-xs">名称</Label>
                                <Input value={editRemarks} onChange={e => setEditRemarks(e.target.value)} className="h-8 text-sm" />
                              </div>
                            </div>
                            <div className="flex gap-2 mt-2">
                              <Button size="sm" onClick={saveSaleEdit} disabled={isPending}>保存</Button>
                              <Button size="sm" variant="ghost" onClick={cancelSaleEdit}>キャンセル</Button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <tr key={s.sales_id} className={`border-b last:border-0 ${i % 2 === 1 ? 'bg-slate-50' : 'bg-white'} hover:bg-blue-50`}>
                          <td className="py-2 px-3 whitespace-nowrap">{s.billing_date?.slice(0, 7)}</td>
                          <td className="py-2 px-3 truncate max-w-0" title={projectMap[s.project_id] ?? '(不明)'}>{projectMap[s.project_id] ?? '(不明)'}</td>
                          <td className="py-2 px-3 truncate max-w-0" title={s.remarks ?? ''}>{s.remarks}</td>
                          <td className="py-2 px-3 text-right whitespace-nowrap">{formatYenFull(s.amount)}</td>
                          <td className="py-2 px-3 whitespace-nowrap">{s.deposit_date ?? '-'}</td>
                          <td className="py-2 px-3">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startSaleEdit(s)} disabled={isPending}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setConfirmDeleteId(s.sales_id)} disabled={isPending}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    ))}
                    {filteredPaid.length === 0 && (
                      <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">該当データなし</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <ConfirmDialog
        open={confirmDeleteId !== null}
        onOpenChange={open => { if (!open) setConfirmDeleteId(null) }}
        title="売上データの削除"
        description="この売上データを削除しますか？削除後はゴミ箱から復元できます。"
        confirmLabel="削除"
        onConfirm={() => { if (confirmDeleteId) deleteSale(confirmDeleteId) }}
      />
    </div>
  )
}
