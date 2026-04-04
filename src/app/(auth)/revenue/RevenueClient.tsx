'use client'

import { useMemo, useState, useEffect } from 'react'
import { RevenueSummary, MonthlyRevenue, Project, User, ProjectSubManager, Sale, Cost } from '@/types'
import { getFiscalYear, getFiscalYearRange, formatDateLocal, formatYenFull } from '@/lib/utils/date'
import { useMasked } from '@/lib/hooks/use-masked'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid
} from 'recharts'
import { Download } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  initialSummary: RevenueSummary
  initialMonthlyData: MonthlyRevenue
  initialMonth: string
  currentFY: number
  fiscalStartMonth: number
  projects: Project[]
  users: User[]
  subManagers: ProjectSubManager[]
  sales: Sale[]
  costs: Cost[]
}

export function RevenueClient({
  initialSummary,
  initialMonthlyData,
  initialMonth,
  currentFY,
  fiscalStartMonth,
  projects,
  users,
  subManagers,
  sales,
  costs,
}: Props) {
  const today = new Date()
  const [masked] = useMasked()
  const [selectedFY, setSelectedFY] = useState(currentFY)
  const [selectedMonth, setSelectedMonth] = useState(initialMonth)
  const [summary, setSummary] = useState<RevenueSummary>(initialSummary)
  const [monthlyData, setMonthlyData] = useState<MonthlyRevenue>(initialMonthlyData)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [monthlyLoading, setMonthlyLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('annual')

  // 年度変更 → サマリー再取得
  useEffect(() => {
    if (selectedFY === currentFY) {
      setSummary(initialSummary)
      return
    }
    const { start, end } = getFiscalYearRange(selectedFY, fiscalStartMonth)
    const s = formatDateLocal(start)
    const e = formatDateLocal(end)
    setSummaryLoading(true)
    fetch(`/api/revenue-summary?fy_start=${s}&fy_end=${e}`)
      .then(r => r.json())
      .then(data => { setSummary(data); setSummaryLoading(false) })
      .catch(() => { setSummaryLoading(false); toast.error('データの取得に失敗しました') })
  }, [selectedFY, currentFY, fiscalStartMonth, initialSummary])

  // 月変更 → 月次データ再取得
  useEffect(() => {
    if (selectedMonth === initialMonth) {
      setMonthlyData(initialMonthlyData)
      return
    }
    setMonthlyLoading(true)
    fetch(`/api/revenue-monthly?month=${selectedMonth}`)
      .then(r => r.json())
      .then(data => { setMonthlyData(data); setMonthlyLoading(false) })
      .catch(() => { setMonthlyLoading(false); toast.error('データの取得に失敗しました') })
  }, [selectedMonth, initialMonth, initialMonthlyData])

  const annualData = summary.annual
  const totalSales  = annualData.reduce((s, r) => s + r.sales, 0)
  const totalCosts  = annualData.reduce((s, r) => s + r.costs, 0)
  const totalProfit = totalSales - totalCosts

  const monthlyTrendData = useMemo(() =>
    summary.monthly_trend.map(m => ({
      month:  m.month,
      売上:   m.sales,
      原価:   m.costs,
      粗利:   m.sales - m.costs,
    })),
    [summary.monthly_trend]
  )

  const trueCurrentFY = getFiscalYear(today, fiscalStartMonth)
  const years = Array.from(new Set([trueCurrentFY, currentFY, currentFY - 1, currentFY - 2])).sort((a, b) => b - a)
  const monthOptions: string[] = []
  for (let i = 0; i < 24; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    monthOptions.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  async function exportExcel() {
    const res = await fetch('/api/export/revenue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fiscalYear: selectedFY, data: annualData }),
    })
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `収支一覧_${selectedFY}年度.xlsx`
    a.click()
  }

  const endMonth = fiscalStartMonth === 1 ? 12 : fiscalStartMonth - 1
  const fyLabel = (y: number) => `${y}年度 (${y}/${fiscalStartMonth}〜${y + 1}/${endMonth})`

  const FYSelector = (
    <Select value={String(selectedFY)} onValueChange={(v) => setSelectedFY(parseInt(v ?? '0'))}>
      <SelectTrigger className="w-auto min-w-36">
        <span className="mr-1">{fyLabel(selectedFY)}</span>
      </SelectTrigger>
      <SelectContent>
        {years.map(y => (
          <SelectItem key={y} value={String(y)}>{y}年度</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">💴 収支一覧・分析</h1>

      <Tabs defaultValue="annual" onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="monthly">月次収支</TabsTrigger>
          <TabsTrigger value="annual">年次収支</TabsTrigger>
          <TabsTrigger value="trend">月別推移</TabsTrigger>
          <TabsTrigger value="vendor">業者別</TabsTrigger>
          <TabsTrigger value="staff">担当者別</TabsTrigger>
        </TabsList>

        {/* 月次収支 */}
        <TabsContent value="monthly">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <Select value={selectedMonth} onValueChange={(v) => setSelectedMonth(v ?? '')}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {monthOptions.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
                {monthlyLoading && <span className="text-sm text-muted-foreground animate-pulse">読み込み中...</span>}
              </div>
            </CardHeader>
            <CardContent>
              <RevenueTable data={monthlyData} masked={masked} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* 年次収支 */}
        <TabsContent value="annual">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                {FYSelector}
                <Button variant="outline" size="sm" onClick={exportExcel} className="gap-1.5">
                  <Download className="h-3.5 w-3.5" />Excel出力
                </Button>
                <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5">
                  <Download className="h-3.5 w-3.5" />PDF印刷
                </Button>
                {summaryLoading && <span className="text-sm text-muted-foreground animate-pulse">読み込み中...</span>}
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-6 mb-4 text-sm">
                <span>売上合計: <strong>{masked ? '¥ ****' : formatYenFull(totalSales)}</strong></span>
                <span>原価合計: <strong>{masked ? '¥ ****' : formatYenFull(totalCosts)}</strong></span>
                <span className={totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                  粗利合計: <strong>{masked ? '¥ ****' : formatYenFull(totalProfit)}</strong>
                </span>
              </div>
              <RevenueTable data={annualData} masked={masked} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* 月別推移 */}
        <TabsContent value="trend">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                {FYSelector}
                {summaryLoading && <span className="text-sm text-muted-foreground animate-pulse">読み込み中...</span>}
              </div>
            </CardHeader>
            <CardContent>
<ResponsiveContainer key={activeTab} width="100%" height={350}>
                <BarChart data={monthlyTrendData} margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => masked ? '***' : `${(v / 10000).toFixed(0)}万`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => masked ? '¥ ****' : `¥${v.toLocaleString()}`} />
                  <Legend />
                  <Bar dataKey="売上" fill="#3b82f6" />
                  <Bar dataKey="原価" fill="#ef4444" />
                  <Bar dataKey="粗利" fill="#22c55e" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 業者別 */}
        <TabsContent value="vendor">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                {FYSelector}
                {summaryLoading && <span className="text-sm text-muted-foreground animate-pulse">読み込み中...</span>}
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-800 text-white sticky top-0 z-10">
                      <th className="text-left py-2.5 px-3 font-medium">順位</th>
                      <th className="text-left py-2.5 px-3 font-medium">業者名</th>
                      <th className="text-right py-2.5 px-3 font-medium">発注額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.vendor_ranking.map((v, i) => (
                      <tr key={v.id} className={`border-b last:border-0 ${i % 2 === 1 ? 'bg-slate-50' : 'bg-white'}`}>
                        <td className="py-2 pr-3 text-muted-foreground">{i + 1}</td>
                        <td className="py-2 pr-3">{v.name}</td>
                        <td className="py-2 text-right">{masked ? '¥ ****' : formatYenFull(v.amount)}</td>
                      </tr>
                    ))}
                    {summary.vendor_ranking.length === 0 && (
                      <tr><td colSpan={3} className="py-6 text-center text-muted-foreground">データなし</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 担当者別 */}
        <TabsContent value="staff">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                {FYSelector}
                {summaryLoading && <span className="text-sm text-muted-foreground animate-pulse">読み込み中...</span>}
              </div>
            </CardHeader>
            <CardContent>
              <StaffSummaryTable
                annualData={summary.annual}
                projects={projects}
                users={users}
                subManagers={subManagers}
                sales={sales}
                costs={costs}
                masked={masked}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

type AnnualRow = RevenueSummary['annual'][number]

type AllocatedRow = AnnualRow & { isSubManager: boolean }

function StaffSummaryTable({
  annualData,
  projects,
  users,
  subManagers,
  sales,
  costs,
  masked,
}: {
  annualData: AnnualRow[]
  projects: Project[]
  users: User[]
  subManagers: ProjectSubManager[]
  sales: Sale[]
  costs: Cost[]
  masked: boolean
}) {
  const fmt = (v: number) => masked ? '¥ ****' : formatYenFull(v)

  const managerMap = Object.fromEntries(projects.map(p => [p.project_id, p.manager_id]))
  const userMap = Object.fromEntries(users.filter(u => u.username !== '管理者').map(u => [u.user_id, u.username]))

  // project_id → 副担当リスト（期間情報付き）
  const subMap: Record<string, ProjectSubManager[]> = {}
  for (const sm of subManagers) {
    if (!subMap[sm.project_id]) subMap[sm.project_id] = []
    subMap[sm.project_id].push(sm)
  }

  // project_id → Sales[]・Costs[]
  const salesByProject: Record<string, Sale[]> = {}
  const costsByProject: Record<string, Cost[]> = {}
  const projectIds = new Set(annualData.map(r => r.project_id))
  for (const s of sales) {
    if (!projectIds.has(s.project_id)) continue
    if (!salesByProject[s.project_id]) salesByProject[s.project_id] = []
    salesByProject[s.project_id].push(s)
  }
  for (const c of costs) {
    if (!c.project_id || !projectIds.has(c.project_id)) continue
    if (!costsByProject[c.project_id]) costsByProject[c.project_id] = []
    costsByProject[c.project_id].push(c)
  }

  // 担当者ごとに集計
  const staffMap: Record<string, { name: string; rows: AllocatedRow[]; sales: number; costs: number; profit: number }> = {}

  for (const row of annualData) {
    const mainId = managerMap[row.project_id]
    if (!mainId) continue
    const subs = subMap[row.project_id] ?? []

    // 売上：billing_dateで副担当のアクティブ期間を判定して按分
    const salesAlloc: Record<string, number> = {}
    for (const sale of salesByProject[row.project_id] ?? []) {
      const d = sale.billing_date ?? ''
      const activeSubs = subs.filter(sm => sm.start_date <= d && (sm.end_date === null || sm.end_date >= d))
      const divisor = 1 + activeSubs.length
      salesAlloc[mainId] = (salesAlloc[mainId] ?? 0) + Math.round(sale.amount / divisor)
      for (const sm of activeSubs) {
        salesAlloc[sm.manager_id] = (salesAlloc[sm.manager_id] ?? 0) + Math.round(sale.amount / divisor)
      }
    }
    // 個別トランザクションがない場合は全額主担当
    if (Object.keys(salesAlloc).length === 0) salesAlloc[mainId] = row.sales

    // 原価：billing_monthで同様に按分
    const costsAlloc: Record<string, number> = {}
    for (const cost of costsByProject[row.project_id] ?? []) {
      const d = cost.billing_month?.slice(0, 10) ?? ''
      const activeSubs = subs.filter(sm => sm.start_date <= d && (sm.end_date === null || sm.end_date >= d))
      const divisor = 1 + activeSubs.length
      costsAlloc[mainId] = (costsAlloc[mainId] ?? 0) + Math.round(cost.amount / divisor)
      for (const sm of activeSubs) {
        costsAlloc[sm.manager_id] = (costsAlloc[sm.manager_id] ?? 0) + Math.round(cost.amount / divisor)
      }
    }
    if (Object.keys(costsAlloc).length === 0) costsAlloc[mainId] = row.costs

    // 関与した全員を集計
    const allPersons = new Set([mainId, ...Object.keys(salesAlloc), ...Object.keys(costsAlloc)])
    for (const uid of allPersons) {
      const name = userMap[uid] ?? uid
      const allocSales  = salesAlloc[uid]  ?? 0
      const allocCosts  = costsAlloc[uid]  ?? 0
      const allocProfit = allocSales - allocCosts
      if (!staffMap[uid]) staffMap[uid] = { name, rows: [], sales: 0, costs: 0, profit: 0 }
      staffMap[uid].rows.push({
        ...row,
        sales:  allocSales,
        costs:  allocCosts,
        profit: allocProfit,
        isSubManager: uid !== mainId,
      })
      staffMap[uid].sales  += allocSales
      staffMap[uid].costs  += allocCosts
      staffMap[uid].profit += allocProfit
    }
  }
  const staffList = Object.entries(staffMap).sort((a, b) => b[1].sales - a[1].sales)

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (staffList.length === 0) {
    return <p className="text-center text-muted-foreground py-6">データなし</p>
  }

  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-800 text-white sticky top-0 z-10">
            <th className="text-left py-2.5 px-3 font-medium">担当者</th>
            <th className="text-right py-2.5 px-3 font-medium">担当件数</th>
            <th className="text-right py-2.5 px-3 font-medium">売上</th>
            <th className="text-right py-2.5 px-3 font-medium">原価</th>
            <th className="text-right py-2.5 px-3 font-medium">粗利</th>
            <th className="text-right py-2.5 px-3 font-medium">粗利率</th>
          </tr>
        </thead>
        <tbody>
          {staffList.map(([managerId, s], i) => (
            <>
              <tr
                key={managerId}
                className={`border-b cursor-pointer hover:bg-blue-50 transition-colors font-medium ${i % 2 === 1 ? 'bg-slate-50' : 'bg-white'}`}
                onClick={() => toggle(managerId)}
              >
                <td className="py-2 px-3">
                  <span className="mr-1 text-muted-foreground">{expanded.has(managerId) ? '▾' : '▸'}</span>
                  {s.name}
                </td>
                <td className="py-2 px-3 text-right text-muted-foreground">{s.rows.length}件</td>
                <td className="py-2 px-3 text-right">{fmt(s.sales)}</td>
                <td className="py-2 px-3 text-right">{fmt(s.costs)}</td>
                <td className={`py-2 px-3 text-right ${s.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(s.profit)}</td>
                <td className={`py-2 px-3 text-right ${s.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {s.sales > 0 ? `${((s.profit / s.sales) * 100).toFixed(1)}%` : '—'}
                </td>
              </tr>
              {expanded.has(managerId) && s.rows.map(r => (
                <tr key={r.project_id + (r.isSubManager ? '-sub' : '')} className="border-b bg-blue-50/40 text-xs">
                  <td className="py-1.5 px-3 pl-8 text-muted-foreground">
                    {r.site_name}
                    {r.isSubManager && (
                      <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">副</span>
                    )}
                  </td>
                  <td className="py-1.5 px-3 text-right text-muted-foreground">—</td>
                  <td className="py-1.5 px-3 text-right">{fmt(r.sales)}</td>
                  <td className="py-1.5 px-3 text-right">{fmt(r.costs)}</td>
                  <td className={`py-1.5 px-3 text-right ${r.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(r.profit)}</td>
                  <td className={`py-1.5 px-3 text-right ${r.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {r.sales > 0 ? `${((r.profit / r.sales) * 100).toFixed(1)}%` : '—'}
                  </td>
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RevenueTable({ data, masked }: { data: { project_id: string; site_name: string; sales: number; costs: number; profit: number }[]; masked: boolean }) {
  const fmt = (v: number) => masked ? '¥ ****' : formatYenFull(v)
  const total = data.reduce((acc, r) => ({
    sales: acc.sales + r.sales, costs: acc.costs + r.costs, profit: acc.profit + r.profit
  }), { sales: 0, costs: 0, profit: 0 })

  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-800 text-white sticky top-0 z-10">
            <th className="text-left py-2.5 px-3 font-medium">現場名</th>
            <th className="text-right py-2.5 px-3 font-medium">売上</th>
            <th className="text-right py-2.5 px-3 font-medium">原価</th>
            <th className="text-right py-2.5 px-3 font-medium">粗利</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r, i) => (
            <tr key={r.project_id} className={`border-b last:border-0 hover:bg-blue-50 transition-colors ${i % 2 === 1 ? 'bg-slate-50' : 'bg-white'}`}>
              <td className="py-2 pr-3">{r.site_name}</td>
              <td className="py-2 pr-3 text-right">{fmt(r.sales)}</td>
              <td className="py-2 pr-3 text-right">{fmt(r.costs)}</td>
              <td className={`py-2 text-right font-medium ${r.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {fmt(r.profit)}
              </td>
            </tr>
          ))}
          {data.length === 0 && (
            <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">データなし</td></tr>
          )}
        </tbody>
        {data.length > 0 && (
          <tfoot>
            <tr className="border-t font-bold">
              <td className="py-2 pr-3">合計</td>
              <td className="py-2 pr-3 text-right">{fmt(total.sales)}</td>
              <td className="py-2 pr-3 text-right">{fmt(total.costs)}</td>
              <td className={`py-2 text-right ${total.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(total.profit)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
