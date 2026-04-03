'use client'

import { use, useMemo, useState, useEffect, Suspense } from 'react'
import { Project, Addon, Partner, Sale, Cost, DashboardSummary } from '@/types'
import { getFiscalYear, getFiscalYearRange, formatDateLocal, formatYen, formatYenFull } from '@/lib/utils/date'
import { normalizeCompanyName } from '@/lib/utils/text'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { AlertTriangle, EyeOff, Eye } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface Props {
  projects: Project[]
  addons: Addon[]
  partners: Partner[]
  sales: Sale[]
  costs: Cost[]
  summaryPromise: Promise<DashboardSummary>
  fiscalStartMonth: number
}

export function DashboardClient({ projects, addons, partners, sales, costs, summaryPromise, fiscalStartMonth }: Props) {
  const today = new Date()
  const currentFY = getFiscalYear(today, fiscalStartMonth)
  const [selectedFY, setSelectedFY] = useState(currentFY)
  const [overrideSummary, setOverrideSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [masked, setMasked] = useState(false)
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set())

  useEffect(() => {
    setMasked(localStorage.getItem('dashboard_masked') === '1')
    const raw = localStorage.getItem('dismissed_alerts')
    if (raw) {
      try { setDismissedAlerts(new Set(JSON.parse(raw))) } catch {}
    }
  }, [])

  function toggleMasked() {
    setMasked(v => {
      const next = !v
      localStorage.setItem('dashboard_masked', next ? '1' : '0')
      return next
    })
  }

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

  function dismissAlert(key: string) {
    setDismissedAlerts(prev => {
      const next = new Set(prev).add(key)
      localStorage.setItem('dismissed_alerts', JSON.stringify([...next]))
      return next
    })
  }

  const addonMap = useMemo(() => {
    const map: Record<string, number> = {}
    addons.forEach(a => { map[a.project_id] = (map[a.project_id] ?? 0) + a.amount })
    return map
  }, [addons])

  const activeProjects = useMemo(
    () => projects.filter(p => ['着工中', '受注'].includes(p.status)),
    [projects]
  )

  // 入金遅延：未入金かつ請求日から30日以上経過
  const overduePayments = useMemo(() => {
    const todayStr = formatDateLocal(new Date())
    return sales
      .filter(s => !s.deposit_status)
      .map(s => {
        const billingDate = new Date(s.billing_date)
        const diffDays = Math.floor((new Date(todayStr).getTime() - billingDate.getTime()) / (1000 * 60 * 60 * 24))
        return { ...s, diffDays }
      })
      .filter(s => s.diffDays >= 30)
      .sort((a, b) => b.diffDays - a.diffDays)
  }, [sales])

  // 予算超過：稼働中現場で原価合計 > 契約金額（追加工事含む）
  const overBudgetProjects = useMemo(() => {
    const costsByProject: Record<string, number> = {}
    costs.forEach(c => {
      if (c.project_id) costsByProject[c.project_id] = (costsByProject[c.project_id] ?? 0) + c.amount
    })
    return activeProjects
      .map(p => {
        const totalContract = (p.contract_amount ?? 0) + (addonMap[p.project_id] ?? 0)
        const costsSum = costsByProject[p.project_id] ?? 0
        return { ...p, totalContract, costsSum, overAmount: costsSum - totalContract }
      })
      .filter(p => p.overAmount > 0)
  }, [activeProjects, costs, addonMap])

  const projectMap = useMemo(
    () => Object.fromEntries(projects.map(p => [p.project_id, p.site_name])),
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
          <button
            onClick={toggleMasked}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-slate-500 hover:bg-slate-200 transition-colors"
            title={masked ? '金額を表示' : '金額を隠す'}
          >
            {masked ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            {masked ? '金額表示' : '金額非表示'}
          </button>
        </div>
      </div>

      {/* アラート + KPI — Suspense でストリーミング（h1直下） */}
      <Suspense fallback={<KpiSkeleton />}>
        <KpiContent
          summaryPromise={summaryPromise}
          overrideSummary={overrideSummary}
          masked={masked}
        />
      </Suspense>

      {/* 入金遅延アラート */}
      {overduePayments.filter(s => !dismissedAlerts.has(`overdue_${s.sales_id}`)).length > 0 && (
        <Card className="border-amber-300 bg-amber-50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-amber-800 flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" />入金遅延（請求から30日以上）
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {overduePayments
              .filter(s => !dismissedAlerts.has(`overdue_${s.sales_id}`))
              .map(s => (
                <div key={s.sales_id} className="flex items-center justify-between text-sm bg-white rounded-md px-3 py-2 border border-amber-200">
                  <div>
                    <span className="font-medium">{projectMap[s.project_id] ?? s.project_id}</span>
                    <span className="ml-2 text-slate-500">{s.billing_date}</span>
                    <span className="ml-2 text-amber-700 font-semibold">{s.diffDays}日経過</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums font-medium">{masked ? '¥ ****' : formatYenFull(s.amount)}</span>
                    <button onClick={() => dismissAlert(`overdue_${s.sales_id}`)} className="text-slate-400 hover:text-slate-600" title="確認済みにする">
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* 予算超過アラート */}
      {overBudgetProjects.filter(p => !dismissedAlerts.has(`overbudget_${p.project_id}`)).length > 0 && (
        <Card className="border-red-300 bg-red-50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-red-800 flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" />予算超過
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {overBudgetProjects
              .filter(p => !dismissedAlerts.has(`overbudget_${p.project_id}`))
              .map(p => (
                <div key={p.project_id} className="flex items-center justify-between text-sm bg-white rounded-md px-3 py-2 border border-red-200">
                  <div>
                    <Link href={`/projects/${p.project_id}`} className="font-medium hover:underline">{p.site_name}</Link>
                    <span className="ml-2 text-red-700 font-semibold">+{masked ? '****' : formatYenFull(p.overAmount)} 超過</span>
                  </div>
                  <button onClick={() => dismissAlert(`overbudget_${p.project_id}`)} className="text-slate-400 hover:text-slate-600" title="確認済みにする">
                    <Eye className="h-4 w-4" />
                  </button>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* 稼働現場 — 即時表示 */}
      <Card className="bg-white shadow-sm border-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">🏗 稼働中現場</CardTitle>
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
                        <td className="py-2.5 px-3 font-medium">{p.site_name}</td>
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
}: {
  summaryPromise: Promise<DashboardSummary>
  overrideSummary: DashboardSummary | null
  masked: boolean
}) {
  const initialSummary = use(summaryPromise)
  const summary = overrideSummary ?? initialSummary

  const totalSales  = summary.kpi.total_sales
  const totalCosts  = summary.kpi.total_costs
  const totalProfit = totalSales - totalCosts
  const { alerts } = summary
  const hasAlerts = alerts.unpaid_sales > 0 || alerts.orphaned_costs > 0 || alerts.unbilled_costs > 0

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
                <Link href="/sales" className="underline underline-offset-2 hover:opacity-80">
                  💰 未入金: <strong>{alerts.unpaid_sales}件</strong> →入金消込
                </Link>
              )}
              {alerts.unbilled_costs > 0 && (
                <Link href="/projects" className="underline underline-offset-2 hover:opacity-80">
                  📋 未請求現場: <strong>{alerts.unbilled_costs}件</strong> →工事一覧
                </Link>
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
    </>
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
