'use client'

import { use, useMemo, useState, useEffect, useTransition, Suspense } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Project, Addon, Partner, Sale, DashboardSummary } from '@/types'
import { getFiscalYear, getFiscalYearRange, formatDateLocal, formatYen, formatYenFull } from '@/lib/utils/date'
import { normalizeCompanyName } from '@/lib/utils/text'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from 'recharts'
import { AlertTriangle, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useMasked } from '@/lib/hooks/use-masked'

type AlertItems = {
  unpaid_sales: Sale[]
  unbilled_costs: { project_id: string; site_name: string; cost_total: number; sales_total: number }[]
  orphaned_costs: { cost_id: string }[]
}

interface Props {
  projects: Project[]
  addons: Addon[]
  partners: Partner[]
  summaryPromise: Promise<DashboardSummary>
  fiscalStartMonth: number
  alertItems: AlertItems
}

export function DashboardClient({ projects, addons, partners, summaryPromise, fiscalStartMonth, alertItems }: Props) {
  const today = new Date()
  const currentFY = getFiscalYear(today, fiscalStartMonth)
  const [selectedFY, setSelectedFY] = useState(currentFY)
  const [overrideSummary, setOverrideSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [masked] = useMasked()

  useEffect(() => {
    if (selectedFY === currentFY) {
      setOverrideSummary(null)
      return
    }
    const { start, end } = getFiscalYearRange(selectedFY, fiscalStartMonth)
    const s = formatDateLocal(start)
    const e = formatDateLocal(end)
    setLoading(true)
    fetch(`/api/dashboard-summary?fy_start=${s}&fy_end=${e}`)
      .then(r => r.json())
      .then(data => { setOverrideSummary(data); setLoading(false) })
      .catch(() => { setLoading(false); toast.error('データの取得に失敗しました') })
  }, [selectedFY, currentFY, fiscalStartMonth])

  const addonMap = useMemo(() => {
    const map: Record<string, number> = {}
    addons.forEach(a => { map[a.project_id] = (map[a.project_id] ?? 0) + a.amount })
    return map
  }, [addons])

  const activeProjects = useMemo(
    () => projects.filter(p => ['着工中', '受注'].includes(p.status)),
    [projects]
  )

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">経営状況</h1>
        <div className="flex items-center gap-3 mt-2">
          <Select value={String(selectedFY)} onValueChange={(v) => setSelectedFY(parseInt(v ?? '0'))}>
            <SelectTrigger className="w-auto min-w-36 bg-white">
              <span className="mr-1">
                {selectedFY}年度 ({selectedFY}/{fiscalStartMonth}〜{selectedFY + 1}/{fiscalStartMonth === 1 ? 12 : fiscalStartMonth - 1})
              </span>
            </SelectTrigger>
            <SelectContent>
              {[currentFY, currentFY - 1, currentFY - 2].map(fy => (
                <SelectItem key={fy} value={String(fy)}>{fy}年度</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {loading && <span className="text-sm text-slate-400 animate-pulse">読み込み中...</span>}
        </div>
      </div>

      {/* アラート + KPI — Suspense でストリーミング（h1直下） */}
      <Suspense fallback={<KpiSkeleton />}>
        <KpiContent
          summaryPromise={summaryPromise}
          overrideSummary={overrideSummary}
          masked={masked}
          projects={projects}
          alertItems={alertItems}
        />
      </Suspense>

      {/* 稼働現場 — 即時表示 */}
      <Card className="bg-white shadow-sm border-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">稼働中現場</CardTitle>
        </CardHeader>
        <CardContent>
          {activeProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">稼働中の現場はありません</p>
          ) : (
            <div className="overflow-auto max-h-64">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-800 text-white sticky top-0 z-10">
                    <th className="text-left py-2.5 px-3 font-medium text-sm">現場名</th>
                    <th className="text-left py-2.5 px-3 font-medium text-sm">工期</th>
                    <th className="text-left py-2.5 px-3 font-medium text-sm">担当</th>
                    <th className="text-right py-2.5 px-3 font-medium text-sm">金額</th>
                  </tr>
                </thead>
                <tbody>
                  {activeProjects.map(p => {
                    const base  = p.contract_amount ?? 0
                    const addon = addonMap[p.project_id] ?? 0
                    return (
                      <tr key={p.project_id} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 font-medium"><Link href={`/projects/${p.project_id}`} className="hover:text-blue-600 hover:underline">{p.site_name}</Link></td>
                        <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap text-xs">
                          {p.start_date?.slice(0, 7)} 〜 {p.end_date?.slice(0, 7)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">{p.manager_name}</td>
                        <td className="py-2.5 px-3 text-right font-medium tabular-nums">{masked ? '¥ ****' : formatYenFull(base + addon)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ランキング — Suspense でストリーミング */}
      <Suspense fallback={<RankingSkeleton />}>
        <RankingContent
          summaryPromise={summaryPromise}
          overrideSummary={overrideSummary}
          partners={partners}
          masked={masked}
        />
      </Suspense>
    </div>
  )
}

// ---- KPI + アラート ----

function KpiContent({
  summaryPromise,
  overrideSummary,
  masked,
  projects,
  alertItems,
}: {
  summaryPromise: Promise<DashboardSummary>
  overrideSummary: DashboardSummary | null
  masked: boolean
  projects: Project[]
  alertItems: AlertItems
}) {
  const router = useRouter()
  const initialSummary = use(summaryPromise)
  const summary = overrideSummary ?? initialSummary

  const totalSales  = summary.kpi.total_sales
  const totalCosts  = summary.kpi.total_costs
  const totalProfit = totalSales - totalCosts
  const { alerts } = summary

  // 入金予定日超過の現場（入金済でないもの）
  // new Date('YYYY-MM-DD') はUTC解釈でJSTと1日ズレるため文字列比較を使用
  const todayStr = formatDateLocal(new Date())
  const overdueDeposit = projects.filter(p =>
    p.scheduled_deposit_date &&
    p.scheduled_deposit_date < todayStr &&
    p.status !== '入金済'
  )

  const projectMap = useMemo(
    () => Object.fromEntries(projects.map(p => [p.project_id, p.site_name])),
    [projects]
  )

  const [openDialog, setOpenDialog] = useState<'unpaid' | 'unbilled' | 'overdue' | null>(null)
  const [removedSaleIds, setRemovedSaleIds] = useState<Set<string>>(new Set())

  const displayedUnpaidSales = alertItems.unpaid_sales.filter(s => !removedSaleIds.has(s.sales_id))

  async function handleDeposit(saleId: string, depositDate: string) {
    const res = await fetch('/api/sales', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: saleId, deposit_status: true, deposit_date: depositDate }),
    })
    if (res.ok) {
      setRemovedSaleIds(prev => new Set([...prev, saleId]))
      toast.success('入金消込しました')
      router.refresh()
    } else {
      toast.error('更新に失敗しました')
    }
  }

  const hasAlerts = alerts.unpaid_sales > 0 || alerts.orphaned_costs > 0 || alerts.unbilled_costs > 0 || overdueDeposit.length > 0

  const fmt = (v: number) => masked ? '¥ ****' : formatYen(v)

  return (
    <>
      {hasAlerts && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="flex flex-wrap gap-3 mt-1">
              {alerts.orphaned_costs > 0 && (
                <Link href="/costs" className="underline underline-offset-2 hover:opacity-80">
                  ⚠️ 現場不明原価: <strong>{alerts.orphaned_costs}件</strong> →確認・割り当て
                </Link>
              )}
              {alerts.unpaid_sales > 0 && (
                <button onClick={() => setOpenDialog('unpaid')} className="underline underline-offset-2 hover:opacity-80 text-left">
                  💰 未入金: <strong>{alerts.unpaid_sales}件</strong> →入金消込
                </button>
              )}
              {alerts.unbilled_costs > 0 && (
                <button onClick={() => setOpenDialog('unbilled')} className="underline underline-offset-2 hover:opacity-80 text-left">
                  📋 未請求現場: <strong>{alerts.unbilled_costs}件</strong> →工事一覧
                </button>
              )}
              {overdueDeposit.length > 0 && (
                <button onClick={() => setOpenDialog('overdue')} className="underline underline-offset-2 hover:opacity-80 text-left">
                  🗓️ 入金予定日超過: <strong>{overdueDeposit.length}件</strong>（{overdueDeposit.slice(0, 2).map(p => p.site_name).join('、')}{overdueDeposit.length > 2 ? '…' : ''}）
                </button>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-600 rounded-xl p-5 text-white shadow-sm">
          <p className="text-sm font-medium text-blue-100">売上（請求済）</p>
          <p className="text-3xl font-bold mt-2 tabular-nums">{fmt(totalSales)}</p>
        </div>
        <div className="bg-slate-700 rounded-xl p-5 text-white shadow-sm">
          <p className="text-sm font-medium text-slate-300">原価（発生済）</p>
          <p className="text-3xl font-bold mt-2 tabular-nums">{fmt(totalCosts)}</p>
        </div>
        <div className={`rounded-xl p-5 text-white shadow-sm ${totalProfit >= 0 ? 'bg-emerald-600' : 'bg-red-600'}`}>
          <p className={`text-sm font-medium ${totalProfit >= 0 ? 'text-emerald-100' : 'text-red-100'}`}>粗利</p>
          <p className="text-3xl font-bold mt-2 tabular-nums">{totalProfit >= 0 ? '+' : '▲'}{fmt(Math.abs(totalProfit))}</p>
        </div>
      </div>

      {/* 未入金ダイアログ */}
      <Dialog open={openDialog === 'unpaid'} onOpenChange={open => !open && setOpenDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="flex flex-row items-center justify-between mb-3">
            <DialogTitle>未入金一覧</DialogTitle>
            <DialogClose className="text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </DialogClose>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[60vh]">
            {displayedUnpaidSales.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">未入金の請求はありません</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-800 text-white sticky top-0">
                    <th className="text-left py-2 px-3 font-medium">現場名</th>
                    <th className="text-left py-2 px-3 font-medium">請求日</th>
                    <th className="text-right py-2 px-3 font-medium">金額</th>
                    <th className="py-2 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {displayedUnpaidSales.map((sale, i) => (
                    <UnpaidSaleRow
                      key={sale.sales_id}
                      sale={sale}
                      projectName={projectMap[sale.project_id] ?? '(不明)'}
                      masked={masked}
                      stripe={i % 2 === 1}
                      onDeposit={handleDeposit}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 未請求現場ダイアログ */}
      <Dialog open={openDialog === 'unbilled'} onOpenChange={open => !open && setOpenDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="flex flex-row items-center justify-between mb-3">
            <DialogTitle>未請求現場一覧</DialogTitle>
            <DialogClose className="text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </DialogClose>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[60vh]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-800 text-white sticky top-0">
                  <th className="text-left py-2 px-3 font-medium">現場名</th>
                  <th className="text-right py-2 px-3 font-medium">原価合計</th>
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {alertItems.unbilled_costs.map((item, i) => (
                  <tr key={item.project_id} className={`${i % 2 === 1 ? 'bg-slate-50' : 'bg-white'} hover:bg-blue-50`}>
                    <td className="py-2.5 px-3">{item.site_name}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{masked ? '¥ ****' : formatYenFull(item.cost_total)}</td>
                    <td className="py-2.5 px-3 text-right">
                      <Link href={`/projects/${item.project_id}`} className="text-blue-600 text-xs hover:underline whitespace-nowrap">詳細 →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      {/* 入金予定日超過ダイアログ */}
      <Dialog open={openDialog === 'overdue'} onOpenChange={open => !open && setOpenDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="flex flex-row items-center justify-between mb-3">
            <DialogTitle>入金予定日超過一覧</DialogTitle>
            <DialogClose className="text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </DialogClose>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[60vh]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-800 text-white sticky top-0">
                  <th className="text-left py-2 px-3 font-medium">現場名</th>
                  <th className="text-left py-2 px-3 font-medium">入金予定日</th>
                  <th className="text-right py-2 px-3 font-medium">請負金額</th>
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {overdueDeposit.map((p, i) => (
                  <tr key={p.project_id} className={`${i % 2 === 1 ? 'bg-slate-50' : 'bg-white'} hover:bg-blue-50`}>
                    <td className="py-2.5 px-3">{p.site_name}</td>
                    <td className="py-2.5 px-3 text-red-600 font-medium whitespace-nowrap">{p.scheduled_deposit_date}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{masked ? '¥ ****' : formatYenFull(p.contract_amount)}</td>
                    <td className="py-2.5 px-3 text-right">
                      <Link href={`/projects/${p.project_id}`} className="text-blue-600 text-xs hover:underline whitespace-nowrap">詳細 →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ---- 未入金行コンポーネント ----

function UnpaidSaleRow({
  sale,
  projectName,
  masked,
  stripe,
  onDeposit,
}: {
  sale: Sale
  projectName: string
  masked: boolean
  stripe: boolean
  onDeposit: (saleId: string, depositDate: string) => Promise<void>
}) {
  const [showForm, setShowForm] = useState(false)
  const [depositDate, setDepositDate] = useState(formatDateLocal(new Date()))
  const [isPending, startTransition] = useTransition()

  function submit() {
    startTransition(async () => {
      await onDeposit(sale.sales_id, depositDate)
      setShowForm(false)
    })
  }

  return (
    <tr className={`${stripe ? 'bg-slate-50' : 'bg-white'} hover:bg-blue-50`}>
      <td className="py-2.5 px-3">{projectName}</td>
      <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{sale.billing_date}</td>
      <td className="py-2.5 px-3 text-right tabular-nums">{masked ? '¥ ****' : formatYenFull(sale.amount)}</td>
      <td className="py-2.5 px-3 text-right">
        {showForm ? (
          <div className="flex items-center justify-end gap-1">
            <input
              type="date"
              value={depositDate}
              onChange={e => setDepositDate(e.target.value)}
              className="border border-slate-300 rounded px-1.5 py-0.5 text-xs w-32 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <Button size="sm" className="h-6 text-xs px-2 py-0" onClick={submit} disabled={isPending}>
              {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : '確定'}
            </Button>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 ml-1">
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="h-6 text-xs px-2 py-0" onClick={() => setShowForm(true)}>
            入金消込
          </Button>
        )}
      </td>
    </tr>
  )
}

// ---- ランキング ----

function RankingContent({
  summaryPromise,
  overrideSummary,
  partners,
  masked,
}: {
  summaryPromise: Promise<DashboardSummary>
  overrideSummary: DashboardSummary | null
  partners: Partner[]
  masked: boolean
}) {
  const initialSummary = use(summaryPromise)
  const summary = overrideSummary ?? initialSummary

  const partnerMap = useMemo(
    () => Object.fromEntries(partners.map(p => [p.partner_id, p.name])),
    [partners]
  )

  const staffSalesData = useMemo(() =>
    summary.staff_ranking.map((s, i) => ({
      name: i === 0 ? `🥇 ${s.name}` : i === 1 ? `🥈 ${s.name}` : i === 2 ? `🥉 ${s.name}` : s.name,
      value: s.sales,
    })),
    [summary.staff_ranking]
  )

  const staffProfitData = useMemo(() =>
    [...summary.staff_ranking]
      .sort((a, b) => b.profit - a.profit)
      .map((s, i) => ({
        name: i === 0 ? `🥇 ${s.name}` : i === 1 ? `🥈 ${s.name}` : i === 2 ? `🥉 ${s.name}` : s.name,
        value: s.profit,
      })),
    [summary.staff_ranking]
  )

  const customerRankingData = useMemo(() =>
    summary.customer_ranking.map(r => ({
      name: normalizeCompanyName(partnerMap[r.id] ?? r.id),
      value: r.amount,
    })),
    [summary.customer_ranking, partnerMap]
  )

  const vendorRankingData = useMemo(() =>
    summary.vendor_ranking.map(r => ({
      name: normalizeCompanyName(partnerMap[r.id] ?? '(不明)'),
      value: r.amount,
    })),
    [summary.vendor_ranking, partnerMap]
  )

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-white shadow-sm border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-slate-700">社員別 売上</CardTitle>
          </CardHeader>
          <CardContent>
            <RankingChart data={staffSalesData} color="#3b82f6" masked={masked} />
          </CardContent>
        </Card>
        <Card className="bg-white shadow-sm border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-slate-700">社員別 利益</CardTitle>
          </CardHeader>
          <CardContent>
            <RankingChart data={staffProfitData} color="#22c55e" masked={masked} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-white shadow-sm border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-slate-700">得意先別 Top20</CardTitle>
          </CardHeader>
          <CardContent>
            <RankingChart data={customerRankingData} color="#f59e0b" masked={masked} />
          </CardContent>
        </Card>
        <Card className="bg-white shadow-sm border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-slate-700">支払先別 Top20</CardTitle>
          </CardHeader>
          <CardContent>
            <RankingChart data={vendorRankingData} color="#8b5cf6" masked={masked} />
          </CardContent>
        </Card>
      </div>
    </>
  )
}

// ---- スケルトン ----

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {[0, 1, 2].map(i => (
        <div key={i} className="rounded-xl p-5 bg-slate-200 animate-pulse h-24" />
      ))}
    </div>
  )
}

function RankingSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="rounded-xl bg-slate-100 animate-pulse h-52" />
      ))}
    </div>
  )
}

// ---- チャート ----

function fmtBarLabel(v: number): string {
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 10_000_000) return `${sign}${Math.round(abs / 1_000_000)}M`
  if (abs >= 1_000_000)  return `${sign}${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)      return `${sign}${Math.round(abs / 1_000)}k`
  return `${sign}${abs}`
}

function niceMax(dataMax: number): number {
  if (dataMax <= 0) return 1
  const rough = dataMax / 4
  const exp = Math.pow(10, Math.floor(Math.log10(rough)))
  const n = rough / exp
  const steps = [1, 1.25, 2, 2.5, 4, 5, 10]
  const nice = steps.find(s => s >= n) ?? 10
  return nice * exp * 4
}

function RankingChart({ data, color, masked }: { data: { name: string; value: number }[]; color: string; masked: boolean }) {
  if (!data.length) return <p className="text-sm text-muted-foreground">データなし</p>

  const sorted     = [...data].sort((a, b) => b.value - a.value)
  const height     = Math.max(200, sorted.length * 32)
  const maxNameLen = Math.max(...sorted.map(d => d.name.length))
  const yAxisWidth = Math.min(Math.max(maxNameLen * 12, 100), 240)
  const gradId     = `grad-${color.replace('#', '')}`

  const axisMax  = niceMax(sorted[0].value)
  const axisTicks = [0, axisMax / 4, axisMax / 2, (axisMax * 3) / 4, axisMax]

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={sorted} layout="vertical" margin={{ left: 0, right: 56, top: 4, bottom: 4 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={color} stopOpacity={0.6} />
            <stop offset="100%" stopColor={color} stopOpacity={1} />
          </linearGradient>
        </defs>
        <XAxis
          type="number"
          domain={[0, axisMax]}
          ticks={axisTicks}
          tickFormatter={masked ? () => '***' : v => `${(v / 10000).toFixed(0)}万`}
          tick={{ fontSize: 11 }}
        />
        <YAxis type="category" dataKey="name" width={yAxisWidth} tick={{ fontSize: 11 }} tickLine={false} />
        <Tooltip formatter={(v: any) => [masked ? '¥ ***' : `¥${v.toLocaleString()}`, '金額']} />
        <Bar dataKey="value" fill={`url(#${gradId})`} radius={[0, 3, 3, 0]}>
          <LabelList
            dataKey="value"
            position="right"
            formatter={(v: any) => masked ? '***' : fmtBarLabel(v)}
            style={{ fontSize: 11, fontWeight: 600, fill: '#374151' }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
