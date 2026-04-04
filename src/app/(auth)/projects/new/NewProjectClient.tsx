'use client'

import { useState, useTransition } from 'react'
import { Partner, User } from '@/types'
import { calcScheduledDate, formatDateLocal } from '@/lib/utils/date'
import { normalizeCompanyName } from '@/lib/utils/text'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AmountInput } from '@/components/ui/amount-input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

interface Props {
  customers: Partner[]
  users: User[]
  nextId: string
}

const STRUCTURES = ['RC造', 'S造', '木造', 'SRC造', '軽量鉄骨造', 'その他']
const STATUSES = ['受注', '着工中', '完工'] as const

export function NewProjectClient({ customers, users, nextId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [siteName, setSiteName] = useState('')
  const [siteAddress, setSiteAddress] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [customerContact, setCustomerContact] = useState('')
  const [status, setStatus] = useState<string>('受注')
  const [amount, setAmount] = useState('')
  const [managerId, setManagerId] = useState('')
  const [structure, setStructure] = useState('RC造')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // バリデーション: touched フラグ
  const [touched, setTouched] = useState({ siteName: false, customerId: false, managerId: false, amount: false })
  const errors = {
    siteName: touched.siteName && !siteName ? '現場名を入力してください' : '',
    customerId: touched.customerId && !customerId ? '得意先を選択してください' : '',
    managerId: touched.managerId && !managerId ? '担当者を選択してください' : '',
    amount: touched.amount && (parseInt(amount.replace(/,/g, '')) || 0) <= 0 ? '請負金額を入力してください' : '',
  }

  // 入金予定日の自動計算
  const scheduledDepositDate = (() => {
    if (!customerId || !endDate) return null
    const customer = customers.find(c => c.partner_id === customerId)
    if (!customer) return null
    const closeDay = customer.closing_day ?? 99
    const payMonths = customer.payment_cycle ?? 1
    const payDay = customer.payment_day ?? 99
    const base = new Date(endDate)
    if (isNaN(base.getTime())) return null
    return calcScheduledDate(base, closeDay, payMonths, payDay)
  })()

  function handleSubmit() {
    setTouched({ siteName: true, customerId: true, managerId: true, amount: true })
    if (!siteName) { toast.error('現場名を入力してください'); return }
    if (!customerId) { toast.error('得意先を選択してください'); return }
    if (!managerId) { toast.error('担当者を選択してください'); return }
    const amountNum = parseInt(amount.replace(/,/g, '')) || 0
    if (amountNum <= 0) { toast.error('請負金額を入力してください'); return }

    startTransition(async () => {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: nextId,
          site_name: siteName,
          status,
          contract_amount: amountNum,
          scheduled_deposit_date: scheduledDepositDate
            ? formatDateLocal(scheduledDepositDate)
            : null,
          manager_id: managerId,
          customer_id: customerId,
          site_address: siteAddress || null,
          customer_contact: customerContact || null,
          building_structure: structure,
          start_date: startDate || null,
          end_date: endDate || null,
        }),
      })

      if (res.ok) {
        toast.success(`工事ID: ${nextId} で登録しました`)
        router.push('/projects')
        router.refresh()
      } else {
        const { error } = await res.json()
        toast.error(`登録エラー: ${error}`)
      }
    })
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">📝 新規工事登録</h1>

      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>工事ID</Label>
              <Input value={nextId} disabled className="bg-muted" />
            </div>
            <div className="space-y-1.5">
              <Label>ステータス</Label>
              <Select value={status} onValueChange={(v) => setStatus(v ?? "")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>現場名 <span className="text-destructive">*</span></Label>
              <Input value={siteName} onChange={e => setSiteName(e.target.value)} onBlur={() => setTouched(t => ({...t, siteName: true}))} placeholder="例: ○○ビル改修工事" className={errors.siteName ? 'border-destructive' : ''} />
              {errors.siteName && <p className="text-xs text-destructive">{errors.siteName}</p>}
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>現場住所</Label>
              <Input value={siteAddress} onChange={e => setSiteAddress(e.target.value)} placeholder="例: 東京都渋谷区..." />
            </div>
            <div className="space-y-1.5">
              <Label>得意先 <span className="text-destructive">*</span></Label>
              <Select value={customerId} onValueChange={(v) => { setCustomerId(v ?? ""); setTouched(t => ({...t, customerId: true})) }}>
                <SelectTrigger className={errors.customerId ? 'border-destructive' : ''}>
                  {customerId
                    ? normalizeCompanyName(customers.find(c => c.partner_id === customerId)?.name ?? '')
                    : <span className="text-muted-foreground">得意先を選択</span>}
                </SelectTrigger>
                <SelectContent>
                  {customers.map(c => <SelectItem key={c.partner_id} value={c.partner_id}>{normalizeCompanyName(c.name)}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.customerId && <p className="text-xs text-destructive">{errors.customerId}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>得意先担当者名</Label>
              <Input value={customerContact} onChange={e => setCustomerContact(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>本工事請負金額（税抜）<span className="text-destructive">*</span></Label>
              <AmountInput value={amount} onChange={v => { setAmount(v); setTouched(t => ({...t, amount: true})) }} className={errors.amount ? 'border-destructive' : ''} />
              {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>担当者 <span className="text-destructive">*</span></Label>
              <Select value={managerId} onValueChange={(v) => { setManagerId(v ?? ""); setTouched(t => ({...t, managerId: true})) }}>
                <SelectTrigger className={errors.managerId ? 'border-destructive' : ''}>
                  {managerId
                    ? (users.find(u => u.user_id === managerId)?.username ?? '')
                    : <span className="text-muted-foreground">担当者を選択</span>}
                </SelectTrigger>
                <SelectContent>
                  {users.filter(u => u.username !== '管理者').map(u => <SelectItem key={u.user_id} value={u.user_id}>{u.username}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.managerId && <p className="text-xs text-destructive">{errors.managerId}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>建物構造</Label>
              <Select value={structure} onValueChange={(v) => setStructure(v ?? "")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STRUCTURES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>工期開始日</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>工期終了日（完了予定）</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>

          {scheduledDepositDate && (
            <p className="text-sm text-muted-foreground bg-muted rounded p-2">
              📅 入金予定日（自動計算）: <strong>{formatDateLocal(scheduledDepositDate)}</strong>
            </p>
          )}

          <Button onClick={handleSubmit} disabled={isPending} className="w-full" size="lg">
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isPending ? '登録中...' : '登録する'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
