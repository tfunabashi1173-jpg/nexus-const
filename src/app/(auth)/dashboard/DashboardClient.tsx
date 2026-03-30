'use client'

import { useMemo, useState } from 'react'
import { Project, Sale, Cost, Addon, Partner } from '@/types'
import { getFiscalYear, getFiscalYearRange, formatYen, formatYenFull } from '@/lib/utils/date'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
  Cell,
} from 'recharts'
import { AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { format } from 'date-fns'

interface AlertsData {
  unpaid_sales: Sale[]
  orphaned_costs: Cost[]
  unbilled_costs: { project_id: string; site_name: string; cost_total: number; sales_total: number }[]
}

interface Props {
  projects: Project[]
  sales: Sale[]
  costs: Cost[]
  addons: Addon[]
  partners: Partner[]
  alerts: AlertsData
  fiscalStartMonth: number
}

export function DashboardClient({ projects, sales, costs, addons, partners, alerts, fiscalStartMonth }: Props) {
  const today = new Date()
  const currentFY = getFiscalYear(today, fiscalStartMonth)
  const [selectedFY, setSelectedFY] = useState(currentFY)

  const partnerMap = useMemo(() => {
    return Object.fromEntries(partners.map(p => [p.partner_id, p.name]))
  }, [partners])

  const addonMap = useMemo(() => {
    const map: Record<string, number> = {}
    addons.forEach(a => {
      map[a.project_id] = (map[a.project_id] ?? 0) + a.amount
    })
    return map
  }, [addons])

  const { start: fyStart, end: fyEnd } = getFiscalYearRange(selectedFY, fiscalStartMonth)

  const salesFY = useMemo(() =>
    sales.filter(s => {
      const d = new Date(s.billing_date)
      return d >= fyStart && d <= fyEnd
    }),
    [sales, fyStart, fyEnd]
  )

  const costsFY = useMemo(() =>
    costs.filter(c => {
      const d = new Date(c.billing_month)
      return d >= fyStart && d <= fyEnd
    }),
    [costs, fyStart, fyEnd]
  )

  const totalSales = salesFY.reduce((s, r) => s + r.amount, 0)
  const totalCosts = costsFY.reduce((s, r) => s + r.amount, 0)
  const totalProfit = totalSales - totalCosts

  const activeProjects = projects.filter(p => ['着工中', '受注'].includes(p.status))

  // 社員別ランキング
  const staffRanking = useMemo(() => {
    const salesByProject: Record<string, number> = {}
    salesFY.forEach(s => { salesByProject[s.project_id] = (salesByProject[s.project_id] ?? 0) + s.amount })

    const costsByProject: Record<string, number> = {}
    costsFY.forEach(c => { if (c.project_id) costsByProject[c.project_id] = (costsByProject[c.project_id] ?? 0) + c.amount })

    const staffMap: Record<string, { sales: number; profit: number }> = {}
    projects.forEach(p => {
      const manager = p.manager_name ?? '(不明)'
      const s = salesByProject[p.project_id] ?? 0
      const c = costsByProject[p.project_id] ?? 0
      if (!staffMap[manager]) staffMap[manager] = { sales: 0, profit: 0 }
      staffMap[manager].sales += s
      staffMap[manager].profit += s - c
    })

    return Object.entries(staffMap)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.sales - a.sales)
  }, [projects, salesFY, costsFY])

  // 得意先別ランキング
  const customerRanking = useMemo(() => {
    const projectCustomer = Object.fromEntries(projects.map(p => [p.project_id, p.customer_id]))
    const map: Record<string, number> = {}
    salesFY.forEach(s => {
      const cid = projectCustomer[s.project_id]
      if (cid) map[cid] = (map[cid] ?? 0) + s.amount
    })
    return Object.entries(map)
      .map(([id, amount]) => ({ name: partnerMap[id] ?? id, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 20)
  }, [salesFY, projects, partnerMap])

  // 支払先別ランキング
  const vendorRanking = useMemo(() => {
    const map: Record<string, number> = {}
    costsFY.forEach(c => {
      const name = partnerMap[c.vendor_id] ?? '(不明)'
      map[name] = (map[name] ?? 0) + c.amount
    })
    return Object.entries(map)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 20)
  }, [costsFY, partnerMap])

  const hasAlerts = alerts.unpaid_sales.length > 0 || alerts.orphaned_costs.length > 0 || alerts.unbilled_costs.length > 0

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">📊 経営状況</h1>

      {/* アラート */}
      {hasAlerts && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="flex flex-wrap gap-3 mt-1">
              {alerts.orphaned_costs.length > 0 && (
                <span>⚠️ 現場不明原価: <strong>{alerts.orphaned_costs.length}件</strong></span>
              )}
              {alerts.unpaid_sales.length > 0 && (
                <span>💰 未入金: <strong>{alerts.unpaid_sales.length}件</strong></span>
              )}
              {alerts.unbilled_costs.length > 0 && (
                <span>📋 未請求現場: <strong>{alerts.unbilled_costs.length}件</strong></span>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* 年度セレクタ */}
      <div className="flex items-center gap-3">
        <Select value={String(selectedFY)} onValueChange={(v) => setSelectedFY(parseInt(v ?? '0'))}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[currentFY, currentFY - 1, currentFY - 2].map(fy => (
              <SelectItem key={fy} value={String(fy)}>{fy}年度</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {format(fyStart, 'yyyy/MM/dd')} 〜 {format(fyEnd, 'yyyy/MM/dd')}
        </span>
      </div>

      {/* KPI + 稼働現場 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* KPI */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">📈 年間サマリー</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <KpiRow label="売上（請求済）" value={totalSales} />
            <KpiRow label="原価（発生済）" value={totalCosts} />
            <KpiRow label="粗利" value={totalProfit} highlight />
          </CardContent>
        </Card>

        {/* 稼働中現場 */}
        <Card className="lg:col-span-2">
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
                    <tr className="border-b">
                      <th className="text-left py-1 pr-3 font-medium text-muted-foreground">現場名</th>
                      <th className="text-left py-1 pr-3 font-medium text-muted-foreground">工期</th>
                      <th className="text-left py-1 pr-3 font-medium text-muted-foreground">担当</th>
                      <th className="text-right py-1 font-medium text-muted-foreground">金額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeProjects.map(p => {
                      const base = p.contract_amount ?? 0
                      const addon = addonMap[p.project_id] ?? 0
                      return (
                        <tr key={p.project_id} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="py-1.5 pr-3 font-medium">{p.site_name}</td>
                          <td className="py-1.5 pr-3 text-muted-foreground whitespace-nowrap">
                            {p.start_date?.slice(0, 7)} 〜 {p.end_date?.slice(0, 7)}
                          </td>
                          <td className="py-1.5 pr-3 text-muted-foreground">{p.manager_name}</td>
                          <td className="py-1.5 text-right">{formatYenFull(base + addon)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 社員別ランキング */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">🥇 社員別 売上</CardTitle>
          </CardHeader>
          <CardContent>
            <RankingChart data={staffRanking.map(s => ({ name: s.name, value: s.sales }))} color="#3b82f6" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">💰 社員別 利益</CardTitle>
          </CardHeader>
          <CardContent>
            <RankingChart data={staffRanking.map(s => ({ name: s.name, value: s.profit }))} color="#22c55e" />
          </CardContent>
        </Card>
      </div>

      {/* 得意先・支払先 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">🏢 得意先別 Top20</CardTitle>
          </CardHeader>
          <CardContent>
            <RankingChart data={customerRanking.map(r => ({ name: r.name, value: r.amount }))} color="#f59e0b" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">🔧 支払先別 Top20</CardTitle>
          </CardHeader>
          <CardContent>
            <RankingChart data={vendorRanking.map(r => ({ name: r.name, value: r.amount }))} color="#8b5cf6" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function KpiRow({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`flex justify-between items-center py-2 border-b last:border-0 ${highlight ? 'font-bold' : ''}`}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm ${highlight ? (value >= 0 ? 'text-green-600' : 'text-red-600') : ''}`}>
        {formatYen(value)}
      </span>
    </div>
  )
}

function RankingChart({ data, color }: { data: { name: string; value: number }[]; color: string }) {
  if (!data.length) return <p className="text-sm text-muted-foreground">データなし</p>

  const sorted = [...data].sort((a, b) => b.value - a.value)
  const height = Math.max(200, sorted.length * 28)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={sorted} layout="vertical" margin={{ left: 8, right: 40, top: 4, bottom: 4 }}>
        <XAxis type="number" tickFormatter={v => `${(v / 10000).toFixed(0)}万`} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v: any) => [`¥${v.toLocaleString()}`, "金額"]} />
        <Bar dataKey="value" radius={[0, 3, 3, 0]}>
          {sorted.map((_, i) => <Cell key={i} fill={color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
