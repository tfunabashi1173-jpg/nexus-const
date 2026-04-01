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

interface Props {
  sales: Sale[]
  projects: Project[]
}

export function SalesClient({ sales, projects }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const projectMap = Object.fromEntries(projects.map(p => [p.project_id, p.site_name]))
  const depositDateMap = Object.fromEntries(projects.map(p => [p.project_id, p.scheduled_deposit_date]))

  const unpaid = sales.filter(s => !s.deposit_status)
  const paid = sales.filter(s => s.deposit_status)

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
      <h1 className="text-2xl font-bold">💵 売上・入金管理</h1>

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
                <p className="text-sm text-green-600">✅ 未入金の請求はありません</p>
              ) : (
                <>
                  <div className="overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 pr-3 font-medium text-muted-foreground">請求日</th>
                          <th className="text-left py-2 pr-3 font-medium text-muted-foreground">現場名</th>
                          <th className="text-left py-2 pr-3 font-medium text-muted-foreground">名称</th>
                          <th className="text-right py-2 pr-3 font-medium text-muted-foreground">金額</th>
                          <th className="text-left py-2 font-medium text-muted-foreground">入金予定日</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unpaid.map(s => (
                          <tr
                            key={s.sales_id}
                            className={`border-b last:border-0 cursor-pointer hover:bg-muted/30 transition-colors ${selectedId === s.sales_id ? 'bg-primary/5' : ''}`}
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
            <CardContent className="pt-4">
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-3 font-medium text-muted-foreground">請求日</th>
                      <th className="text-left py-2 pr-3 font-medium text-muted-foreground">現場名</th>
                      <th className="text-left py-2 pr-3 font-medium text-muted-foreground">名称</th>
                      <th className="text-right py-2 pr-3 font-medium text-muted-foreground">金額</th>
                      <th className="text-left py-2 font-medium text-muted-foreground">入金日</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paid.map(s => (
                      <tr key={s.sales_id} className="border-b last:border-0">
                        <td className="py-2 pr-3">{s.billing_date?.slice(0, 7)}</td>
                        <td className="py-2 pr-3">{projectMap[s.project_id] ?? '(不明)'}</td>
                        <td className="py-2 pr-3">{s.remarks}</td>
                        <td className="py-2 pr-3 text-right">{formatYenFull(s.amount)}</td>
                        <td className="py-2">{s.deposit_date ?? '-'}</td>
                      </tr>
                    ))}
                    {paid.length === 0 && (
                      <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">データなし</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
