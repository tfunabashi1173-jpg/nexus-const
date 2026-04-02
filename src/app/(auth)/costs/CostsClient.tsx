'use client'

import { useState, useTransition, useMemo } from 'react'
import { Cost, Partner, Project, TaxType } from '@/types'
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
import { Bot, Pencil, Trash2, Paperclip, Plus, X } from 'lucide-react'
import { InvoiceDetail } from '@/types'

interface Props {
  costs: Cost[]
  vendors: Partner[]
  projects: Project[]
  safetyFeeRate: number  // % (例: 1.0 = 1%)
}

interface OcrResult {
  company: string
  date: string
  details: InvoiceDetail[]
  matched_vendor?: string
}

interface SiteGroup {
  site_name: string
  amount: number
  project_id: string
}

function computeTaxBreakdown(amount: number, taxType: TaxType) {
  if (taxType === '税込') {
    const excl = Math.floor(amount / 1.1)
    return { excl, tax: amount - excl, incl: amount }
  }
  if (taxType === '免税') {
    return { excl: amount, tax: 0, incl: amount }
  }
  // 税抜
  const tax = Math.floor(amount * 0.1)
  return { excl: amount, tax, incl: amount + tax }
}

function TaxTypeSelect({ value, onChange, className }: { value: TaxType; onChange: (v: TaxType) => void; className?: string }) {
  return (
    <Select value={value} onValueChange={v => onChange((v ?? '税抜') as TaxType)}>
      <SelectTrigger className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="税抜">税抜</SelectItem>
        <SelectItem value="税込">税込</SelectItem>
        <SelectItem value="免税">免税</SelectItem>
      </SelectContent>
    </Select>
  )
}

export function CostsClient({ costs, vendors, projects, safetyFeeRate }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const vendorMap = Object.fromEntries(vendors.map(v => [v.partner_id, v.name]))

  const today = new Date()
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

  // 手動入力
  const [manualVendorId, setManualVendorId] = useState('')
  const [manualTaxType, setManualTaxType] = useState<TaxType>('税抜')
  const [manualProjectId, setManualProjectId] = useState('')
  const [manualMonth, setManualMonth] = useState(currentMonthStr)
  const [manualAmount, setManualAmount] = useState('')
  const [manualFile, setManualFile] = useState<File | null>(null)
  const [manualShowAll, setManualShowAll] = useState(false)

  const manualProjects = useMemo(() => {
    if (!manualMonth) return projects
    const [yearStr, monStr] = manualMonth.split('-')
    const year = parseInt(yearStr)
    const mon  = parseInt(monStr)
    if (manualShowAll) return projects
    const prevMonthStart  = new Date(year, mon - 2, 1)
    const billingMonthEnd = new Date(year, mon, 0)
    return projects.filter(p => {
      if (!p.start_date || !p.end_date) return false
      return new Date(p.start_date) <= billingMonthEnd && new Date(p.end_date) >= prevMonthStart
    })
  }, [projects, manualMonth, manualShowAll])

  // 一覧フィルター・楽観的削除
  const prevMonthStr = today.getMonth() === 0
    ? `${today.getFullYear() - 1}-12`
    : `${today.getFullYear()}-${String(today.getMonth()).padStart(2, '0')}`
  const [filterMonth, setFilterMonth] = useState(prevMonthStr)
  const [deletedCostIds, setDeletedCostIds] = useState<Set<string>>(new Set())
  const filteredCosts = useMemo(() => {
    const base = filterMonth ? costs.filter(c => c.billing_month?.startsWith(filterMonth)) : costs
    return base.filter(c => !deletedCostIds.has(c.cost_id))
  }, [costs, filterMonth, deletedCostIds])

  // 編集・削除
  const [editingCostId, setEditingCostId] = useState<string | null>(null)
  const [editVendorId, setEditVendorId] = useState('')
  const [editProjectId, setEditProjectId] = useState('')
  const [editMonth, setEditMonth] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editMode, setEditMode] = useState<'simple' | 'split' | 'ocr_register'>('simple')
  const [editTaxType, setEditTaxType] = useState<TaxType>('税抜')
  const [splitGroups, setSplitGroups] = useState<SiteGroup[]>([])
  const [splitLoading, setSplitLoading] = useState(false)
  const [ocrRegisterResult, setOcrRegisterResult] = useState<OcrResult | null>(null)
  const [ocrRegisterVendorId, setOcrRegisterVendorId] = useState('')
  const [ocrRegisterMonth, setOcrRegisterMonth] = useState('')
  const [ocrRegisterTaxType, setOcrRegisterTaxType] = useState<TaxType>('税抜')
  // 編集インラインOCR登録: 業者×月のリアルタイム重複チェック（自分自身を除外）
  const ocrRegisterDuplicate = useMemo(() => {
    if (!ocrRegisterVendorId || !ocrRegisterMonth) return null
    return costs.find(c => c.cost_id !== editingCostId && c.vendor_id === ocrRegisterVendorId && c.billing_month?.slice(0, 7) === ocrRegisterMonth) ?? null
  }, [ocrRegisterVendorId, ocrRegisterMonth, editingCostId, costs])

  function startEdit(c: Cost) {
    setEditingCostId(c.cost_id)
    setEditVendorId(c.vendor_id)
    setEditProjectId(c.project_id ?? '')
    setEditMonth(c.billing_month?.slice(0, 7) ?? '')
    setEditAmount(String(c.amount))
    setEditTaxType(c.tax_type ?? '税抜')
    setEditMode('simple')
    setSplitGroups([])
    setOcrRegisterResult(null)
  }

  function cancelEdit() {
    setEditingCostId(null)
    setEditMode('simple')
    setSplitGroups([])
    setOcrRegisterResult(null)
  }

  function saveEdit() {
    if (!editingCostId) return
    startTransition(async () => {
      const res = await fetch('/api/costs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingCostId,
          vendor_id: editVendorId,
          project_id: editProjectId || null,
          billing_month: editMonth + '-01',
          amount: parseInt(editAmount.replace(/,/g, '')) || 0,
          tax_type: editTaxType,
        }),
      })
      if (res.ok) {
        toast.success('更新しました')
        cancelEdit()
        router.refresh()
      } else {
        toast.error('更新に失敗しました')
      }
    })
  }

  async function reanalyzeOcr(filePath: string) {
    setSplitLoading(true)
    try {
      const res = await fetch('/api/ocr/reanalyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: filePath }),
      })
      if (!res.ok) { toast.error('OCR解析に失敗しました'); return }
      const data = await res.json()

      // 業者自動マッチング（既存の業者を優先）
      const vendorCandidates = vendors.map(v => ({ id: v.partner_id, name: v.name }))
      const match = findSimilarMatch(data.company, vendorCandidates)
      const matchedVendorId = match?.id ?? editVendorId

      // 請求月（OCRの日付 or 既存の月）
      const month = data.date ? data.date.slice(0, 7) : editMonth

      // 現場別グループ化
      const projectCandidates = projects.map(p => ({ id: p.project_id, name: p.site_name }))
      const groupMap: Record<string, number> = {}
      for (const d of (data.details ?? []) as InvoiceDetail[]) {
        const key = d.site_name || '(不明)'
        groupMap[key] = (groupMap[key] ?? 0) + d.amount
      }
      const groups: SiteGroup[] = Object.entries(groupMap).map(([site_name, amount]) => {
        const pm = site_name !== '(不明)' ? findSimilarMatch(site_name, projectCandidates) : null
        return { site_name, amount, project_id: pm?.id ?? '' }
      })

      setSplitGroups(groups.length > 0 ? groups : [{ site_name: '', amount: parseInt(editAmount) || 0, project_id: '' }])
      setOcrRegisterVendorId(matchedVendorId)
      setOcrRegisterMonth(month)
      const matchedVendor = vendors.find(v => v.partner_id === matchedVendorId)
      setOcrRegisterTaxType((matchedVendor?.default_tax_type ?? '税抜') as TaxType)
      setOcrRegisterResult({
        ...data,
        matched_vendor: match ? vendorMap[match.id] : undefined,
      })
      setEditMode('ocr_register')
      toast.success('OCR解析完了')
    } catch (e: any) {
      toast.error(`エラー: ${e.message}`)
    } finally {
      setSplitLoading(false)
    }
  }

  function submitOcrRegister() {
    if (!editingCostId || !ocrRegisterVendorId || !ocrRegisterMonth || splitGroups.length === 0) {
      toast.error('業者・請求月を確認してください')
      return
    }
    startTransition(async () => {
      // 1. 現場ごとに新規登録
      const results = await Promise.all(splitGroups.map(group => fetch('/api/costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tax_type: ocrRegisterTaxType,
          project_id: group.project_id || null,
          vendor_id: ocrRegisterVendorId,
          billing_month: ocrRegisterMonth + '-01',
          amount: group.amount,
        }),
      })))

      if (!results.every(r => r.ok)) {
        toast.error('一部の登録に失敗しました')
        return
      }

      // 2. 元の現場不明レコードを削除
      const deleteRes = await fetch('/api/costs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingCostId }),
      })

      if (deleteRes.ok) setDeletedCostIds(prev => new Set([...prev, editingCostId!]))
      toast.success(`${splitGroups.length}件を登録しました（元データを削除）`)
      if (!deleteRes.ok) toast.error('元データの削除に失敗しました（新規登録は完了）')
      cancelEdit()
      router.refresh()  // 新規登録分を一覧に追加するため
    })
  }

  function startManualSplit(originalAmount: number) {
    setSplitGroups([
      { site_name: '', amount: originalAmount, project_id: editProjectId },
      { site_name: '', amount: 0, project_id: '' },
    ])
    setEditMode('split')
  }

  function saveSplit() {
    if (!editingCostId || splitGroups.length === 0) return
    startTransition(async () => {
      const [first, ...rest] = splitGroups
      const patchRes = await fetch('/api/costs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingCostId,
          project_id: first.project_id || null,
          amount: first.amount,
          vendor_id: editVendorId,
          billing_month: editMonth + '-01',
        }),
      })
      const additionalRes = await Promise.all(rest.map(g => fetch('/api/costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: g.project_id || null,
          vendor_id: editVendorId,
          billing_month: editMonth + '-01',
          amount: g.amount,
        }),
      })))
      if (patchRes.ok && additionalRes.every(r => r.ok)) {
        toast.success(`${splitGroups.length}件に分割して保存しました`)
        cancelEdit()
        router.refresh()
      } else {
        toast.error('一部の保存に失敗しました')
      }
    })
  }

  function deleteCost(id: string) {
    if (!window.confirm('この原価データを削除しますか？')) return
    startTransition(async () => {
      const res = await fetch('/api/costs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        setDeletedCostIds(prev => new Set([...prev, id]))
        toast.success('削除しました')
      } else {
        toast.error('削除に失敗しました')
      }
    })
  }

  // OCR (新規登録)
  const [ocrFiles, setOcrFiles] = useState<File[]>([])
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrVendorId, setOcrVendorId] = useState('')
  const [ocrTaxType, setOcrTaxType] = useState<TaxType>('税抜')
  const [ocrSiteGroups, setOcrSiteGroups] = useState<SiteGroup[]>([])
  const [ocrMonth, setOcrMonth] = useState('')
  // 月間集計
  const [selectedMonthStr, setSelectedMonthStr] = useState(prevMonthStr)

  const monthlyVendorData = useMemo(() => {
    const map: Record<string, { excl: number; tax: number; incl: number }> = {}
    for (const c of costs) {
      if (deletedCostIds.has(c.cost_id)) continue
      if (!c.billing_month?.startsWith(selectedMonthStr)) continue
      const { excl, tax, incl } = computeTaxBreakdown(c.amount, c.tax_type ?? '税抜')
      if (!map[c.vendor_id]) map[c.vendor_id] = { excl: 0, tax: 0, incl: 0 }
      map[c.vendor_id].excl += excl
      map[c.vendor_id].tax += tax
      map[c.vendor_id].incl += incl
    }
    return Object.entries(map)
      .map(([vendor_id, { excl, tax, incl }]) => {
        const vendor = vendors.find(v => v.partner_id === vendor_id)
        const participates = vendor?.safety_fee_rate != null
        const safetyFee = participates ? Math.floor(excl * safetyFeeRate / 100) : 0
        return { vendor_id, name: vendor?.name ?? vendorMap[vendor_id] ?? '(不明)', participates, amount: excl, tax, totalWithTax: incl, safetyFee, netPayment: incl - safetyFee }
      })
      .sort((a, b) => normalizeCompanyName(a.name).localeCompare(normalizeCompanyName(b.name), 'ja'))
  }, [costs, deletedCostIds, selectedMonthStr, vendors, vendorMap, safetyFeeRate])

  function downloadMonthlyCsv() {
    const header = ['業者名', '安協加入', '請求金額（税抜）', '消費税', '請求合計(税込)', '安全協力会費', '差引支払額']
    const rows = monthlyVendorData.map(r => [r.name, r.participates ? '参加' : '', r.amount, r.tax, r.totalWithTax, r.safetyFee, r.netPayment])
    const csv = [header, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `査定表_${selectedMonthStr}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  // OCRタブ: 業者×月のリアルタイム重複チェック
  const ocrPossibleDuplicate = useMemo(() => {
    if (!ocrVendorId || !ocrMonth) return null
    return costs.find(c => c.vendor_id === ocrVendorId && c.billing_month?.slice(0, 7) === ocrMonth) ?? null
  }, [ocrVendorId, ocrMonth, costs])

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
        tax_type: manualTaxType,
      }
      let res: Response
      if (manualFile) {
        const form = new FormData()
        form.append('file', manualFile)
        form.append('project_id', body.project_id ?? '')
        form.append('vendor_id', body.vendor_id)
        form.append('billing_month', body.billing_month)
        form.append('amount', String(body.amount))
        form.append('tax_type', manualTaxType)
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
        setManualVendorId(''); setManualTaxType('税抜'); setManualProjectId(''); setManualMonth(''); setManualAmount(''); setManualFile(null)
        router.refresh()
      } else {
        const { error } = await res.json()
        toast.error(`登録エラー: ${error}`)
      }
    })
  }

  async function runOcr() {
    if (ocrFiles.length === 0) { toast.error('ファイルを選択してください'); return }
    setOcrLoading(true)
    try {
      const form = new FormData()
      ocrFiles.forEach(f => form.append('file', f))
      const res = await fetch('/api/ocr', { method: 'POST', body: form })
      if (!res.ok) { const { error } = await res.json(); toast.error(`OCRエラー: ${error}`); return }
      const data = await res.json()

      const candidates = vendors.map(v => ({ id: v.partner_id, name: v.name }))
      const match = findSimilarMatch(data.company, candidates)
      if (match) {
        setOcrVendorId(match.id)
        const matchedV = vendors.find(v => v.partner_id === match.id)
        setOcrTaxType((matchedV?.default_tax_type ?? '税抜') as TaxType)
      }
      if (data.date) setOcrMonth(data.date.slice(0, 7))

      const projectCandidates = projects.map(p => ({ id: p.project_id, name: p.site_name }))
      const groupMap: Record<string, number> = {}
      for (const d of (data.details ?? []) as InvoiceDetail[]) {
        const key = d.site_name || '(不明)'
        groupMap[key] = (groupMap[key] ?? 0) + d.amount
      }
      const groups: SiteGroup[] = Object.entries(groupMap).map(([site_name, amount]) => {
        const pm = site_name !== '(不明)' ? findSimilarMatch(site_name, projectCandidates) : null
        return { site_name, amount, project_id: pm?.id ?? '' }
      })
      setOcrSiteGroups(groups)

      setOcrResult({
        ...data,
        matched_vendor: match ? vendorMap[match.id] : undefined,
      })
      toast.success('OCR解析完了')
    } catch (e: any) {
      toast.error(`エラー: ${e.message}`)
    } finally {
      setOcrLoading(false)
    }
  }

  function submitOcr() {
    if (!ocrVendorId || !ocrMonth || !ocrResult) { toast.error('業者・請求月を確認してください'); return }
    if (ocrSiteGroups.length === 0) { toast.error('明細がありません'); return }
    startTransition(async () => {
      const results = await Promise.all(
        ocrSiteGroups.map((group, i) => {
          if (i === 0 && ocrFiles.length > 0) {
            const form = new FormData()
            form.append('file', ocrFiles[0])
            form.append('project_id', group.project_id || '')
            form.append('vendor_id', ocrVendorId)
            form.append('billing_month', ocrMonth + '-01')
            form.append('amount', String(group.amount))
            form.append('tax_type', ocrTaxType)
            form.append('target_date', ocrMonth + '-01')
            return fetch('/api/costs', { method: 'POST', body: form })
          }
          return fetch('/api/costs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ project_id: group.project_id || null, vendor_id: ocrVendorId, billing_month: ocrMonth + '-01', amount: group.amount, tax_type: ocrTaxType }),
          })
        })
      )
      if (results.every(r => r.ok)) {
        toast.success(`${ocrSiteGroups.length}件の原価を登録しました`)
        setOcrResult(null); setOcrFiles([]); setOcrVendorId(''); setOcrSiteGroups([]); setOcrMonth('')
        router.refresh()
      } else {
        toast.error('一部の登録に失敗しました')
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
          <TabsTrigger value="monthly">月間集計</TabsTrigger>
        </TabsList>

        {/* 手動入力 */}
        <TabsContent value="manual">
          <Card>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>業者 <span className="text-destructive">*</span></Label>
                  <Select value={manualVendorId} onValueChange={(v) => {
                    setManualVendorId(v ?? '')
                    const vendor = vendors.find(x => x.partner_id === v)
                    setManualTaxType((vendor?.default_tax_type ?? '税抜') as TaxType)
                  }}>
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
                  <Select value={manualProjectId || '__none__'} onValueChange={(v) => setManualProjectId(v === '__none__' ? '' : (v ?? ''))}>
                    <SelectTrigger>
                      <span className={manualProjectId ? '' : 'text-muted-foreground'}>
                        {manualProjectId ? (projects.find(p => p.project_id === manualProjectId)?.site_name ?? manualProjectId) : '現場を選択'}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {manualProjects.map(p => <SelectItem key={p.project_id} value={p.project_id}>{p.site_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {!manualShowAll ? (
                    <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setManualShowAll(true)}>
                      その他の現場を表示（全件）
                    </button>
                  ) : (
                    <button type="button" className="text-xs text-muted-foreground underline" onClick={() => { setManualShowAll(false); setManualProjectId('') }}>
                      稼働現場に絞り込む
                    </button>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>請求月 <span className="text-destructive">*</span></Label>
                  <Input type="month" value={manualMonth} onChange={e => { setManualMonth(e.target.value); setManualShowAll(false); setManualProjectId('') }} />
                </div>

                <div className="space-y-1.5">
                  <Label>税区分 <span className="text-destructive">*</span></Label>
                  <TaxTypeSelect value={manualTaxType} onChange={setManualTaxType} />
                </div>
                <div className="space-y-1.5">
                  <Label>金額（{manualTaxType}）<span className="text-destructive">*</span></Label>
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
                  <Label>請求書ファイル（画像/PDF・複数枚可）</Label>
                  <Input type="file" accept="image/*,.pdf" multiple onChange={e => setOcrFiles(Array.from(e.target.files ?? []))} />
                  {ocrFiles.length > 1 && <p className="text-xs text-muted-foreground">{ocrFiles.length}枚選択中 → まとめて1回で解析します</p>}
                </div>
                <Button onClick={runOcr} disabled={ocrLoading || ocrFiles.length === 0} className="gap-2">
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
                    {ocrResult.matched_vendor && <p className="text-sm text-green-600">✅ 業者自動マッチング: {ocrResult.matched_vendor}</p>}
                    {ocrPossibleDuplicate && (
                      <p className="text-sm text-red-600 font-medium">
                        🚨 重複の可能性: {ocrPossibleDuplicate.billing_month?.slice(0, 7)} に同業者で {formatYenFull(ocrPossibleDuplicate.amount)} が登録済みです
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-2">現場別振り当て <span className="text-muted-foreground font-normal">（現場ごとに1件登録されます）</span></p>
                    <div className="overflow-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-800 text-white">
                            <th className="text-left py-2 px-3 font-medium">請求書の現場名</th>
                            <th className="text-right py-2 px-3 font-medium">小計</th>
                            <th className="text-left py-2 px-3 font-medium">振り当て工事</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ocrSiteGroups.map((group, i) => (
                            <tr key={i} className={`border-b last:border-0 ${i % 2 === 1 ? 'bg-slate-50' : 'bg-white'}`}>
                              <td className="py-2 px-3 text-muted-foreground">{group.site_name}</td>
                              <td className="py-2 px-3 text-right whitespace-nowrap">{formatYenFull(group.amount)}</td>
                              <td className="py-2 px-3">
                                <Select value={group.project_id || '__none__'} onValueChange={(v) => setOcrSiteGroups(prev => prev.map((g, j) => j === i ? { ...g, project_id: v === '__none__' ? '' : (v ?? '') } : g))}>
                                  <SelectTrigger className="h-8 text-xs">
                                    <span className={group.project_id ? '' : 'text-muted-foreground'}>
                                      {group.project_id ? (projects.find(p => p.project_id === group.project_id)?.site_name ?? group.project_id) : '⚠️ 未選択'}
                                    </span>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">（現場不明）</SelectItem>
                                    {projects.map(p => <SelectItem key={p.project_id} value={p.project_id}>{p.site_name}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </td>
                            </tr>
                          ))}
                          <tr className="font-bold border-t">
                            <td className="py-2 px-3">合計</td>
                            <td className="py-2 px-3 text-right">{formatYenFull(ocrSiteGroups.reduce((s, g) => s + g.amount, 0))}</td>
                            <td />
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>業者 <span className="text-destructive">*</span></Label>
                      <Select value={ocrVendorId} onValueChange={(v) => {
                      setOcrVendorId(v ?? '')
                      const vendor = vendors.find(x => x.partner_id === v)
                      setOcrTaxType((vendor?.default_tax_type ?? '税抜') as TaxType)
                    }}>
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
                      <Label>請求月 <span className="text-destructive">*</span></Label>
                      <Input type="month" value={ocrMonth} onChange={e => setOcrMonth(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>税区分</Label>
                      <TaxTypeSelect value={ocrTaxType} onChange={setOcrTaxType} />
                    </div>
                  </div>

                  <Button onClick={submitOcr} disabled={isPending}>
                    {ocrSiteGroups.length > 1 ? `${ocrSiteGroups.length}件まとめて登録` : '登録する'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 原価一覧 */}
        <TabsContent value="list">
          <Card>
            <CardContent className="pt-4">
              {/* 月フィルター */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <Label className="text-xs whitespace-nowrap">月フィルター:</Label>
                <Input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="h-8 w-36 text-sm" />
                {filterMonth && (
                  <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setFilterMonth('')}>クリア</Button>
                )}
                <span className="text-xs text-muted-foreground">{filteredCosts.length}件</span>
              </div>

              <div className="overflow-auto max-h-[600px]">
                <table className="w-full text-sm table-fixed">
                  <colgroup>
                    <col className="w-[11%]" />
                    <col className="w-[21%]" />
                    <col className="w-[30%]" />
                    <col className="w-[17%]" />
                    <col className="w-[5%]" />
                    <col className="w-[16%]" />
                  </colgroup>
                  <thead className="sticky top-0">
                    <tr className="bg-slate-800 text-white">
                      <th className="text-left py-2.5 px-3 font-medium">請求月</th>
                      <th className="text-left py-2.5 px-3 font-medium">業者</th>
                      <th className="text-left py-2.5 px-3 font-medium">現場</th>
                      <th className="text-right py-2.5 px-3 font-medium">金額</th>
                      <th className="py-2.5 px-1"></th>
                      <th className="py-2.5 px-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCosts.map((c, i) => (
                      editingCostId === c.cost_id ? (
                        <tr key={c.cost_id} className="border-b bg-blue-50">
                          <td colSpan={6} className="py-3 px-3">
                            {editMode === 'ocr_register' ? (
                              // OCR登録モード（元データを削除して新規登録）
                              <div className="space-y-3">
                                {/* 解析サマリー */}
                                <div className="bg-muted/50 rounded p-2.5 space-y-1 text-xs">
                                  <p className="font-medium">OCR解析結果</p>
                                  <p>請求元: <strong>{ocrRegisterResult?.company}</strong></p>
                                  {ocrRegisterResult?.matched_vendor && (
                                    <p className="text-green-600">✅ 業者自動マッチング: {ocrRegisterResult.matched_vendor}</p>
                                  )}
                                  {ocrRegisterDuplicate && (
                                    <p className="text-red-600 font-medium">
                                      🚨 重複の可能性: {ocrRegisterDuplicate.billing_month?.slice(0, 7)} に同業者で {formatYenFull(ocrRegisterDuplicate.amount)} が登録済みです
                                    </p>
                                  )}
                                </div>

                                {/* 業者・請求月・税区分 */}
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <Label className="text-xs">業者</Label>
                                    <Select value={ocrRegisterVendorId} onValueChange={v => {
                                      setOcrRegisterVendorId(v ?? '')
                                      const vendor = vendors.find(x => x.partner_id === v)
                                      setOcrRegisterTaxType((vendor?.default_tax_type ?? '税抜') as TaxType)
                                    }}>
                                      <SelectTrigger className="h-8 text-xs">
                                        <span className={ocrRegisterVendorId ? '' : 'text-muted-foreground'}>
                                          {ocrRegisterVendorId ? normalizeCompanyName(vendorMap[ocrRegisterVendorId] ?? ocrRegisterVendorId) : '業者を選択'}
                                        </span>
                                      </SelectTrigger>
                                      <SelectContent>
                                        {vendors.map(v => <SelectItem key={v.partner_id} value={v.partner_id}>{normalizeCompanyName(v.name)}</SelectItem>)}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label className="text-xs">請求月</Label>
                                    <Input type="month" value={ocrRegisterMonth} onChange={e => setOcrRegisterMonth(e.target.value)} className="h-8 text-sm" />
                                  </div>
                                  <div>
                                    <Label className="text-xs">税区分</Label>
                                    <TaxTypeSelect value={ocrRegisterTaxType} onChange={setOcrRegisterTaxType} className="h-8 text-xs" />
                                  </div>
                                </div>

                                {/* 現場別振り当て */}
                                <table className="w-full text-xs border rounded">
                                  <thead>
                                    <tr className="bg-slate-100">
                                      <th className="text-left py-1.5 px-2 font-medium">請求書の現場名</th>
                                      <th className="text-left py-1.5 px-2 font-medium">振り当て工事</th>
                                      <th className="text-right py-1.5 px-2 font-medium">金額</th>
                                      <th className="w-8"></th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {splitGroups.map((g, idx) => (
                                      <tr key={idx} className="border-t">
                                        <td className="py-1 px-2 text-muted-foreground">{g.site_name || '—'}</td>
                                        <td className="py-1 px-2">
                                          <Select value={g.project_id || '__none__'} onValueChange={v => setSplitGroups(prev => prev.map((x, j) => j === idx ? { ...x, project_id: v === '__none__' ? '' : (v ?? '') } : x))}>
                                            <SelectTrigger className="h-7 text-xs">
                                              <span className={g.project_id ? '' : 'text-muted-foreground'}>
                                                {g.project_id ? (projects.find(p => p.project_id === g.project_id)?.site_name ?? g.project_id) : '⚠️ 未選択'}
                                              </span>
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="__none__">（現場不明）</SelectItem>
                                              {projects.map(p => <SelectItem key={p.project_id} value={p.project_id}>{p.site_name}</SelectItem>)}
                                            </SelectContent>
                                          </Select>
                                        </td>
                                        <td className="py-1 px-2">
                                          <AmountInput
                                            value={String(g.amount)}
                                            onChange={v => setSplitGroups(prev => prev.map((x, j) => j === idx ? { ...x, amount: parseInt(v.replace(/,/g, '')) || 0 } : x))}
                                            className="h-7 text-xs"
                                          />
                                        </td>
                                        <td className="py-1 px-1 text-center">
                                          {splitGroups.length > 1 && (
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSplitGroups(prev => prev.filter((_, j) => j !== idx))}>
                                              <X className="h-3 w-3" />
                                            </Button>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                    <tr className="border-t font-medium">
                                      <td colSpan={2} className="py-1 px-2">合計</td>
                                      <td className="py-1 px-2 text-right">
                                        {formatYenFull(splitGroups.reduce((s, g) => s + g.amount, 0))}
                                      </td>
                                      <td />
                                    </tr>
                                  </tbody>
                                </table>

                                <div className="flex gap-2 flex-wrap">
                                  <Button size="sm" onClick={submitOcrRegister} disabled={isPending}>
                                    {splitGroups.length > 1 ? `${splitGroups.length}件登録（元データ削除）` : '登録（元データ削除）'}
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => setSplitGroups(prev => [...prev, { site_name: '', amount: 0, project_id: '' }])}>
                                    <Plus className="h-3.5 w-3.5 mr-1" />行追加
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={cancelEdit}>キャンセル</Button>
                                </div>
                              </div>
                          ) : editMode === 'split' ? (
                              // 現場分割モード
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-xs font-medium text-slate-700">現場別に分割保存</p>
                                  <span className="text-xs text-muted-foreground">
                                    元の金額: {formatYenFull(parseInt(editAmount) || 0)}
                                    {' '}/ 業者: {normalizeCompanyName(vendorMap[editVendorId] ?? editVendorId)}
                                    {' '}/ {editMonth}
                                  </span>
                                </div>
                                <table className="w-full text-xs border rounded">
                                  <thead>
                                    <tr className="bg-slate-100">
                                      <th className="text-left py-1.5 px-2 font-medium">現場名（請求書）</th>
                                      <th className="text-left py-1.5 px-2 font-medium">振り当て工事</th>
                                      <th className="text-right py-1.5 px-2 font-medium">金額</th>
                                      <th className="w-8 py-1.5 px-1"></th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {splitGroups.map((g, idx) => (
                                      <tr key={idx} className="border-t">
                                        <td className="py-1 px-2 text-muted-foreground">{g.site_name || '—'}</td>
                                        <td className="py-1 px-2">
                                          <Select value={g.project_id || '__none__'} onValueChange={v => setSplitGroups(prev => prev.map((x, j) => j === idx ? { ...x, project_id: v === '__none__' ? '' : (v ?? '') } : x))}>
                                            <SelectTrigger className="h-7 text-xs">
                                              <span className={g.project_id ? '' : 'text-muted-foreground'}>
                                                {g.project_id ? (projects.find(p => p.project_id === g.project_id)?.site_name ?? g.project_id) : '（現場不明）'}
                                              </span>
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="__none__">（現場不明）</SelectItem>
                                              {projects.map(p => <SelectItem key={p.project_id} value={p.project_id}>{p.site_name}</SelectItem>)}
                                            </SelectContent>
                                          </Select>
                                        </td>
                                        <td className="py-1 px-2">
                                          <AmountInput
                                            value={String(g.amount)}
                                            onChange={v => setSplitGroups(prev => prev.map((x, j) => j === idx ? { ...x, amount: parseInt(v.replace(/,/g, '')) || 0 } : x))}
                                            className="h-7 text-xs"
                                          />
                                        </td>
                                        <td className="py-1 px-1 text-center">
                                          {splitGroups.length > 1 && (
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSplitGroups(prev => prev.filter((_, j) => j !== idx))}>
                                              <X className="h-3 w-3" />
                                            </Button>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                    <tr className="border-t font-medium">
                                      <td colSpan={2} className="py-1 px-2">合計</td>
                                      <td className="py-1 px-2 text-right">
                                        {(() => {
                                          const total = splitGroups.reduce((s, g) => s + g.amount, 0)
                                          const orig = parseInt(editAmount) || 0
                                          const diff = total - orig
                                          return (
                                            <span className={diff !== 0 ? 'text-red-600' : 'text-green-600'}>
                                              {formatYenFull(total)}{diff !== 0 ? ` (差額 ${diff > 0 ? '+' : ''}${formatYenFull(diff)})` : ' ✓'}
                                            </span>
                                          )
                                        })()}
                                      </td>
                                      <td />
                                    </tr>
                                  </tbody>
                                </table>
                                <div className="flex gap-2 flex-wrap">
                                  <Button size="sm" onClick={saveSplit} disabled={isPending}>分割して保存</Button>
                                  <Button size="sm" variant="outline" onClick={() => setSplitGroups(prev => [...prev, { site_name: '', amount: 0, project_id: '' }])}>
                                    <Plus className="h-3.5 w-3.5 mr-1" />行追加
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => setEditMode('simple')}>シンプル編集に戻る</Button>
                                  <Button size="sm" variant="ghost" onClick={cancelEdit}>キャンセル</Button>
                                </div>
                              </div>
                            ) : (
                              // シンプル編集モード
                              <div className="space-y-2">
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                  <div>
                                    <Label className="text-xs">請求月</Label>
                                    <Input type="month" value={editMonth} onChange={e => setEditMonth(e.target.value)} className="h-8 text-sm" />
                                  </div>
                                  <div>
                                    <Label className="text-xs">業者</Label>
                                    <Select value={editVendorId} onValueChange={v => setEditVendorId(v ?? '')}>
                                      <SelectTrigger className="h-8 text-xs">
                                        <span className={editVendorId ? '' : 'text-muted-foreground'}>
                                          {editVendorId ? normalizeCompanyName(vendorMap[editVendorId] ?? editVendorId) : '選択'}
                                        </span>
                                      </SelectTrigger>
                                      <SelectContent>
                                        {vendors.map(v => <SelectItem key={v.partner_id} value={v.partner_id}>{normalizeCompanyName(v.name)}</SelectItem>)}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label className="text-xs">現場</Label>
                                    <Select value={editProjectId || '__none__'} onValueChange={v => setEditProjectId(v === '__none__' ? '' : (v ?? ''))}>
                                      <SelectTrigger className="h-8 text-xs">
                                        <span className={editProjectId ? '' : 'text-muted-foreground'}>
                                          {editProjectId ? (projects.find(p => p.project_id === editProjectId)?.site_name ?? editProjectId) : '（現場不明）'}
                                        </span>
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="__none__">（現場不明）</SelectItem>
                                        {projects.map(p => <SelectItem key={p.project_id} value={p.project_id}>{p.site_name}</SelectItem>)}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label className="text-xs">税区分</Label>
                                    <TaxTypeSelect value={editTaxType} onChange={setEditTaxType} className="h-8 text-xs" />
                                  </div>
                                  <div>
                                    <Label className="text-xs">金額</Label>
                                    <AmountInput value={editAmount} onChange={setEditAmount} className="h-8 text-sm" />
                                  </div>
                                </div>
                                <div className="flex gap-2 flex-wrap">
                                  <Button size="sm" onClick={saveEdit} disabled={isPending}>保存</Button>
                                  <Button size="sm" variant="outline" onClick={() => startManualSplit(parseInt(editAmount) || 0)}>
                                    <Plus className="h-3.5 w-3.5 mr-1" />現場分割
                                  </Button>
                                  {c.file_path && !c.project_id && (
                                    <Button size="sm" variant="outline" disabled={splitLoading}
                                      onClick={() => reanalyzeOcr(c.file_path!)}>
                                      <Bot className="h-3.5 w-3.5 mr-1" />
                                      {splitLoading ? 'OCR中...' : 'OCRで登録'}
                                    </Button>
                                  )}
                                  <Button size="sm" variant="ghost" onClick={cancelEdit}>キャンセル</Button>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      ) : (
                        <tr key={c.cost_id} className={`border-b last:border-0 hover:bg-blue-50 transition-colors ${i % 2 === 1 ? 'bg-slate-50' : 'bg-white'}`}>
                          <td className="py-2 px-3">{c.billing_month?.slice(0, 7)}</td>
                          <td className="py-2 px-3 truncate">{normalizeCompanyName(vendorMap[c.vendor_id] ?? '(不明)')}</td>
                          <td className="py-2 px-3 truncate text-muted-foreground">
                            {c.project_id
                              ? projects.find(p => p.project_id === c.project_id)?.site_name ?? '(不明)'
                              : <Badge variant="destructive" className="text-xs">現場不明</Badge>
                            }
                          </td>
                          <td className="py-2 px-3 text-right whitespace-nowrap">
                            {c.tax_type && c.tax_type !== '税抜' && (
                              <Badge variant={c.tax_type === '免税' ? 'outline' : 'secondary'} className="text-xs mr-1">{c.tax_type}</Badge>
                            )}
                            {formatYenFull(c.amount)}
                          </td>
                          <td className="py-1 px-1 text-center">
                            {c.file_path && (
                              <a href={`/api/evidence?path=${encodeURIComponent(c.file_path)}`} target="_blank" rel="noopener noreferrer" title="証憑を表示">
                                <Paperclip className="h-3.5 w-3.5 text-blue-500 hover:text-blue-700" />
                              </a>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(c)} disabled={isPending}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteCost(c.cost_id)} disabled={isPending}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    ))}
                    {filteredCosts.length === 0 && (
                      <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">データなし</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 月間集計 */}
        <TabsContent value="monthly">
          <Card>
            <CardContent className="pt-4 space-y-4">
              {/* 年月選択 */}
              <div className="flex items-center gap-2">
                <Input type="month" value={selectedMonthStr} onChange={e => setSelectedMonthStr(e.target.value)} className="w-40 h-9" />
              </div>

              {/* 支払総額ヘッダー */}
              <div className="bg-blue-50 rounded p-3">
                <p className="text-sm font-semibold text-blue-700">
                  {selectedMonthStr} 支払総額: {formatYenFull(monthlyVendorData.reduce((s, r) => s + r.netPayment, 0))}
                </p>
              </div>

              {/* 業者別テーブル */}
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      <th className="text-left py-2.5 px-3 font-medium">業者名</th>
                      <th className="text-center py-2.5 px-3 font-medium">安協加入</th>
                      <th className="text-right py-2.5 px-3 font-medium">請求金額（税抜）</th>
                      <th className="text-right py-2.5 px-3 font-medium">消費税</th>
                      <th className="text-right py-2.5 px-3 font-medium">請求合計(税込)</th>
                      <th className="text-right py-2.5 px-3 font-medium">安全協力会費</th>
                      <th className="text-right py-2.5 px-3 font-medium">差引支払額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyVendorData.map((r, i) => (
                      <tr key={r.vendor_id} className={`border-b last:border-0 ${i % 2 === 1 ? 'bg-slate-50' : 'bg-white'}`}>
                        <td className="py-2 px-3">{r.name}</td>
                        <td className="py-2 px-3 text-center">{r.participates ? <Badge variant="secondary" className="text-xs">参加</Badge> : ''}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{formatYenFull(r.amount)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">{formatYenFull(r.tax)}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{formatYenFull(r.totalWithTax)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">{r.safetyFee > 0 ? formatYenFull(r.safetyFee) : '¥0'}</td>
                        <td className="py-2 px-3 text-right tabular-nums font-medium">{formatYenFull(r.netPayment)}</td>
                      </tr>
                    ))}
                    {monthlyVendorData.length > 0 && (
                      <tr className="border-t-2 font-bold bg-slate-100">
                        <td className="py-2.5 px-3">合計</td>
                        <td></td>
                        <td className="py-2.5 px-3 text-right tabular-nums">{formatYenFull(monthlyVendorData.reduce((s, r) => s + r.amount, 0))}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">{formatYenFull(monthlyVendorData.reduce((s, r) => s + r.tax, 0))}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">{formatYenFull(monthlyVendorData.reduce((s, r) => s + r.totalWithTax, 0))}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">{formatYenFull(monthlyVendorData.reduce((s, r) => s + r.safetyFee, 0))}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">{formatYenFull(monthlyVendorData.reduce((s, r) => s + r.netPayment, 0))}</td>
                      </tr>
                    )}
                    {monthlyVendorData.length === 0 && (
                      <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">データなし</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {monthlyVendorData.length > 0 && (
                <Button variant="outline" size="sm" onClick={downloadMonthlyCsv}>
                  📥 査定表DL (CSV)
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
