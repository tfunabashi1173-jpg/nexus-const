'use client'

import { useState, useTransition, useMemo } from 'react'
import { Cost, Partner, Project } from '@/types'
import { formatYenFull } from '@/lib/utils/date'
import { AmountInput } from '@/components/ui/amount-input'
import { findSimilarMatch, normalizeCompanyName } from '@/lib/utils/text'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Upload, Bot } from 'lucide-react'
import { InvoiceDetail } from '@/types'

interface Props {
  costs: Cost[]
  vendors: Partner[]
  projects: Project[]
}

interface OcrResult {
  company: string
  date: string
  details: InvoiceDetail[]
  matched_vendor?: string
}

export function CostsClient({ costs, vendors, projects }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const vendorMap = Object.fromEntries(vendors.map(v => [v.partner_id, v.name]))
  const projectMap = Object.fromEntries(projects.map(p => [p.project_id, `${p.project_id}: ${p.site_name}`]))

  const today = new Date()
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

  // 手動入力
  const [manualVendorId, setManualVendorId] = useState('')
  const [manualProjectId, setManualProjectId] = useState('')
  const [manualMonth, setManualMonth] = useState(currentMonthStr)
  const [manualAmount, setManualAmount] = useState('')
  const [manualFile, setManualFile] = useState<File | null>(null)
  const [manualShowAll, setManualShowAll] = useState(false)

  // 請求月・前月の稼働現場、または年内全現場（その他選択時）
  const manualProjects = useMemo(() => {
    if (!manualMonth) return projects
    const [yearStr, monStr] = manualMonth.split('-')
    const year = parseInt(yearStr)
    const mon  = parseInt(monStr)

    if (manualShowAll) {
      return projects
    }

    const prevMonthStart  = new Date(year, mon - 2, 1)
    const billingMonthEnd = new Date(year, mon, 0)
    return projects.filter(p => {
      if (!p.start_date || !p.end_date) return false
      return new Date(p.start_date) <= billingMonthEnd && new Date(p.end_date) >= prevMonthStart
    })
  }, [projects, manualMonth, manualShowAll])

  // OCR
  const [ocrFile, setOcrFile] = useState<File | null>(null)
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrVendorId, setOcrVendorId] = useState('')
  const [ocrProjectId, setOcrProjectId] = useState('')
  const [ocrMonth, setOcrMonth] = useState('')

  function submitManual() {
    if (!manualVendorId || !manualProjectId || !manualMonth || !manualAmount) {
      toast.error('業者・現場・請求月・金額を入力してください')
      return
    }

    startTransition(async () => {
      const body: any = {
        project_id: manualProjectId || null,
        vendor_id: manualVendorId,
        billing_month: manualMonth + '-01',
        amount: parseInt(manualAmount.replace(/,/g, '')) || 0,
      }

      let res: Response
      if (manualFile) {
        const form = new FormData()
        form.append('file', manualFile)
        form.append('project_id', body.project_id ?? '')
        form.append('vendor_id', body.vendor_id)
        form.append('billing_month', body.billing_month)
        form.append('amount', String(body.amount))
        form.append('target_date', body.billing_month)
        res = await fetch('/api/costs', { method: 'POST', body: form })
      } else {
        res = await fetch('/api/costs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }

      if (res.ok) {
        toast.success('原価を登録しました')
        setManualVendorId('')
        setManualProjectId('')
        setManualMonth('')
        setManualAmount('')
        setManualFile(null)
        router.refresh()
      } else {
        const { error } = await res.json()
        toast.error(`登録エラー: ${error}`)
      }
    })
  }

  async function runOcr() {
    if (!ocrFile) { toast.error('ファイルを選択してください'); return }
    setOcrLoading(true)
    try {
      const form = new FormData()
      form.append('file', ocrFile)
      const res = await fetch('/api/ocr', { method: 'POST', body: form })
      if (!res.ok) {
        const { error } = await res.json()
        toast.error(`OCRエラー: ${error}`)
        return
      }
      const data = await res.json()

      // 業者名の自動マッチング
      const candidates = vendors.map(v => ({ id: v.partner_id, name: v.name }))
      const match = findSimilarMatch(data.company, candidates)
      if (match) setOcrVendorId(match.id)

      // 日付から請求月を設定
      if (data.date) setOcrMonth(data.date.slice(0, 7))

      setOcrResult({ ...data, matched_vendor: match ? vendorMap[match.id] : undefined })
      toast.success('OCR解析完了')
    } catch (e: any) {
      toast.error(`エラー: ${e.message}`)
    } finally {
      setOcrLoading(false)
    }
  }

  function submitOcr() {
    if (!ocrVendorId || !ocrMonth || !ocrResult) {
      toast.error('業者・請求月を確認してください')
      return
    }

    const totalAmount = ocrResult.details.reduce((s, d) => s + d.amount, 0)

    startTransition(async () => {
      const form = new FormData()
      if (ocrFile) form.append('file', ocrFile)
      form.append('project_id', ocrProjectId || '')
      form.append('vendor_id', ocrVendorId)
      form.append('billing_month', ocrMonth + '-01')
      form.append('amount', String(totalAmount))
      form.append('target_date', ocrMonth + '-01')

      const res = ocrFile
        ? await fetch('/api/costs', { method: 'POST', body: form })
        : await fetch('/api/costs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              project_id: ocrProjectId || null,
              vendor_id: ocrVendorId,
              billing_month: ocrMonth + '-01',
              amount: totalAmount,
            }),
          })

      if (res.ok) {
        toast.success('原価を登録しました')
        setOcrResult(null)
        setOcrFile(null)
        setOcrVendorId('')
        setOcrProjectId('')
        setOcrMonth('')
        router.refresh()
      } else {
        const { error } = await res.json()
        toast.error(`登録エラー: ${error}`)
      }
    })
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">💰 請求・原価管理</h1>

      <Tabs defaultValue="manual">
        <TabsList>
          <TabsTrigger value="manual">手動入力</TabsTrigger>
          <TabsTrigger value="ocr"><Bot className="h-3.5 w-3.5 mr-1.5" />AI-OCR</TabsTrigger>
          <TabsTrigger value="list">原価一覧</TabsTrigger>
        </TabsList>

        {/* 手動入力 */}
        <TabsContent value="manual">
          <Card>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>業者 <span className="text-destructive">*</span></Label>
                  <Select value={manualVendorId} onValueChange={(v) => setManualVendorId(v ?? "")}>
                    <SelectTrigger>
                      <span className={manualVendorId ? '' : 'text-muted-foreground'}>
                        {manualVendorId ? normalizeCompanyName(vendorMap[manualVendorId] ?? manualVendorId) : '業者を選択'}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {vendors.map(v => <SelectItem key={v.partner_id} value={v.partner_id}>{normalizeCompanyName(v.name)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>現場 <span className="text-destructive">*</span></Label>
                  <Select
                    value={manualProjectId || '__none__'}
                    onValueChange={(v) => setManualProjectId(v === '__none__' ? '' : (v ?? ''))}
                  >
                    <SelectTrigger>
                      <span className={manualProjectId ? '' : 'text-muted-foreground'}>
                        {manualProjectId
                          ? (projects.find(p => p.project_id === manualProjectId)?.site_name ?? manualProjectId)
                          : '現場を選択'}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {manualProjects.map(p => (
                        <SelectItem key={p.project_id} value={p.project_id}>{p.site_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!manualShowAll ? (
                    <button
                      type="button"
                      className="text-xs text-muted-foreground underline"
                      onClick={() => setManualShowAll(true)}
                    >
                      その他の現場を表示（全件）
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="text-xs text-muted-foreground underline"
                      onClick={() => { setManualShowAll(false); setManualProjectId('') }}
                    >
                      稼働現場に絞り込む
                    </button>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>請求月 <span className="text-destructive">*</span></Label>
                  <Input
                    type="month"
                    value={manualMonth}
                    onChange={e => {
                      setManualMonth(e.target.value)
                      setManualShowAll(false)
                      setManualProjectId('')
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>金額（税抜）<span className="text-destructive">*</span></Label>
                  <AmountInput value={manualAmount} onChange={setManualAmount} />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>証憑ファイル（任意）</Label>
                  <Input type="file" accept="image/*,.pdf" onChange={e => setManualFile(e.target.files?.[0] ?? null)} />
                </div>
              </div>
              <Button onClick={submitManual} disabled={isPending}>登録</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI-OCR */}
        <TabsContent value="ocr">
          <Card>
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>請求書ファイル（画像/PDF）</Label>
                  <Input type="file" accept="image/*,.pdf" onChange={e => setOcrFile(e.target.files?.[0] ?? null)} />
                </div>
                <Button onClick={runOcr} disabled={ocrLoading || !ocrFile} className="gap-2">
                  <Bot className="h-4 w-4" />
                  {ocrLoading ? 'AI解析中...' : 'OCR解析を実行'}
                </Button>
              </div>

              {ocrResult && (
                <div className="border-t pt-4 space-y-4">
                  <div className="bg-muted/50 rounded p-3 space-y-1">
                    <p className="text-sm font-medium">解析結果</p>
                    <p className="text-sm">請求元: <strong>{ocrResult.company}</strong></p>
                    <p className="text-sm">請求日: {ocrResult.date}</p>
                    {ocrResult.matched_vendor && (
                      <p className="text-sm text-green-600">✅ 業者自動マッチング: {ocrResult.matched_vendor}</p>
                    )}
                  </div>

                  {/* 明細 */}
                  <div className="overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-1.5 pr-3 font-medium text-muted-foreground">現場名</th>
                          <th className="text-left py-1.5 pr-3 font-medium text-muted-foreground">摘要</th>
                          <th className="text-right py-1.5 font-medium text-muted-foreground">金額</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ocrResult.details.map((d, i) => (
                          <tr key={i} className="border-b last:border-0">
                            <td className="py-1.5 pr-3">{d.site_name}</td>
                            <td className="py-1.5 pr-3">{d.description}</td>
                            <td className="py-1.5 text-right">{formatYenFull(d.amount)}</td>
                          </tr>
                        ))}
                        <tr className="font-bold">
                          <td colSpan={2} className="py-1.5 pr-3">合計</td>
                          <td className="py-1.5 text-right">{formatYenFull(ocrResult.details.reduce((s, d) => s + d.amount, 0))}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label>業者 <span className="text-destructive">*</span></Label>
                      <Select value={ocrVendorId} onValueChange={(v) => setOcrVendorId(v ?? "")}>
                        <SelectTrigger>
                          <span className={ocrVendorId ? '' : 'text-muted-foreground'}>
                            {ocrVendorId ? normalizeCompanyName(vendorMap[ocrVendorId] ?? ocrVendorId) : '業者を選択'}
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          {vendors.map(v => <SelectItem key={v.partner_id} value={v.partner_id}>{normalizeCompanyName(v.name)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>現場</Label>
                      <Select value={ocrProjectId} onValueChange={(v) => setOcrProjectId(v ?? "")}>
                        <SelectTrigger>
                          <span className={ocrProjectId ? '' : 'text-muted-foreground'}>
                            {ocrProjectId ? (projects.find(p => p.project_id === ocrProjectId)?.site_name ?? ocrProjectId) : '現場を選択（任意）'}
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">（現場不明）</SelectItem>
                          {projects.map(p => <SelectItem key={p.project_id} value={p.project_id}>{p.site_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>請求月 <span className="text-destructive">*</span></Label>
                      <Input type="month" value={ocrMonth} onChange={e => setOcrMonth(e.target.value)} />
                    </div>
                  </div>

                  <Button onClick={submitOcr} disabled={isPending}>登録する</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 原価一覧 */}
        <TabsContent value="list">
          <Card>
            <CardContent className="pt-4">
              <div className="overflow-auto max-h-[600px]">
                <table className="w-full text-sm table-fixed">
                  <colgroup>
                    <col className="w-[13%]" />
                    <col className="w-[27%]" />
                    <col className="w-[38%]" />
                    <col className="w-[22%]" />
                  </colgroup>
                  <thead className="sticky top-0">
                    <tr className="bg-slate-800 text-white">
                      <th className="text-left py-2.5 px-3 font-medium">請求月</th>
                      <th className="text-left py-2.5 px-3 font-medium">業者</th>
                      <th className="text-left py-2.5 px-3 font-medium">現場</th>
                      <th className="text-right py-2.5 px-3 font-medium">金額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costs.map((c, i) => (
                      <tr key={c.cost_id} className={`border-b last:border-0 hover:bg-blue-50 transition-colors ${i % 2 === 1 ? 'bg-slate-50' : 'bg-white'}`}>
                        <td className="py-2 px-3">{c.billing_month?.slice(0, 7)}</td>
                        <td className="py-2 px-3 truncate">{normalizeCompanyName(vendorMap[c.vendor_id] ?? '(不明)')}</td>
                        <td className="py-2 px-3 truncate text-muted-foreground">
                          {c.project_id
                            ? projects.find(p => p.project_id === c.project_id)?.site_name ?? '(不明)'
                            : <Badge variant="destructive" className="text-xs">現場不明</Badge>
                          }
                        </td>
                        <td className="py-2 px-3 text-right whitespace-nowrap">{formatYenFull(c.amount)}</td>
                      </tr>
                    ))}
                    {costs.length === 0 && (
                      <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">データなし</td></tr>
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
