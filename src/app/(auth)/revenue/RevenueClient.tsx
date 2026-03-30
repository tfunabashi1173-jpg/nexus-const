'use client'

import { useMemo, useState } from 'react'
import { Project, Sale, Cost, Addon, Partner } from '@/types'
import { getFiscalYear, getFiscalYearRange, formatYenFull } from '@/lib/utils/date'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid
} from 'recharts'
import { Download } from 'lucide-react'

interface Props {
  projects: Project[]
  sales: Sale[]
  costs: Cost[]
  addons: Addon[]
  partners: Partner[]
  fiscalStartMonth: number
}

export function RevenueClient({ projects, sales, costs, addons, partners, fiscalStartMonth }: Props) {
  const today = new Date()
  const currentFY = getFiscalYear(today, fiscalStartMonth)
  const [selectedFY, setSelectedFY] = useState(currentFY)
  const [selectedMonth, setSelectedMonth] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  )

  const partnerMap = Object.fromEntries(partners.map(p => [p.partner_id, p.name]))

  const addonMap = useMemo(() => {
    const map: Record<string, number> = {}
    addons.forEach(a => { map[a.project_id] = (map[a.project_id] ?? 0) + a.amount })
    return map
  }, [addons])

  const { start: fyStart, end: fyEnd } = getFiscalYearRange(selectedFY, fiscalStartMonth)

  // 年次収支（現場別）
  const annualData = useMemo(() => {
    const salesByProject: Record<string, number> = {}
    sales.forEach(s => {
      const d = new Date(s.billing_date)
      if (d >= fyStart && d <= fyEnd) {
        salesByProject[s.project_id] = (salesByProject[s.project_id] ?? 0) + s.amount
      }
    })
    const costsByProject: Record<string, number> = {}
    costs.forEach(c => {
      if (!c.project_id) return
      const d = new Date(c.billing_month)
      if (d >= fyStart && d <= fyEnd) {
        costsByProject[c.project_id] = (costsByProject[c.project_id] ?? 0) + c.amount
      }
    })

    return projects
      .filter(p => salesByProject[p.project_id] || costsByProject[p.project_id])
      .map(p => ({
        project_id: p.project_id,
        site_name: p.site_name,
        contract: (p.contract_amount ?? 0) + (addonMap[p.project_id] ?? 0),
        sales: salesByProject[p.project_id] ?? 0,
        costs: costsByProject[p.project_id] ?? 0,
        profit: (salesByProject[p.project_id] ?? 0) - (costsByProject[p.project_id] ?? 0),
      }))
      .sort((a, b) => b.sales - a.sales)
  }, [projects, sales, costs, addonMap, fyStart, fyEnd])

  // 月別推移（12ヶ月）
  const monthlyData = useMemo(() => {
    const months: string[] = []
    for (let i = 0; i < 12; i++) {
      const d = new Date(fyStart.getFullYear(), fyStart.getMonth() + i, 1)
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    return months.map(month => {
      const s = sales.filter(r => r.billing_date?.startsWith(month)).reduce((a, r) => a + r.amount, 0)
      const c = costs.filter(r => r.billing_month?.startsWith(month)).reduce((a, r) => a + r.amount, 0)
      return { month, 売上: s, 原価: c, 粗利: s - c }
    })
  }, [sales, costs, fyStart])

  // 月次収支
  const monthlyProjectData = useMemo(() => {
    const [year, month] = selectedMonth.split('-')
    const monthStr = `${year}-${month}`
    const salesByProject: Record<string, number> = {}
    sales.forEach(s => {
      if (s.billing_date?.startsWith(monthStr)) {
        salesByProject[s.project_id] = (salesByProject[s.project_id] ?? 0) + s.amount
      }
    })
    const costsByProject: Record<string, number> = {}
    costs.forEach(c => {
      if (!c.project_id || !c.billing_month?.startsWith(monthStr)) return
      costsByProject[c.project_id] = (costsByProject[c.project_id] ?? 0) + c.amount
    })
    const projectIds = new Set([...Object.keys(salesByProject), ...Object.keys(costsByProject)])
    return [...projectIds].map(pid => {
      const p = projects.find(x => x.project_id === pid)
      return {
        project_id: pid,
        site_name: p?.site_name ?? '(不明)',
        sales: salesByProject[pid] ?? 0,
        costs: costsByProject[pid] ?? 0,
        profit: (salesByProject[pid] ?? 0) - (costsByProject[pid] ?? 0),
      }
    }).sort((a, b) => b.sales - a.sales)
  }, [sales, costs, projects, selectedMonth])

  // 業者別発注
  const vendorData = useMemo(() => {
    const map: Record<string, number> = {}
    costs.forEach(c => {
      const d = new Date(c.billing_month)
      if (d >= fyStart && d <= fyEnd) {
        const name = partnerMap[c.vendor_id] ?? '(不明)'
        map[name] = (map[name] ?? 0) + c.amount
      }
    })
    return Object.entries(map)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 20)
  }, [costs, partnerMap, fyStart, fyEnd])

  const totalSales = annualData.reduce((s, r) => s + r.sales, 0)
  const totalCosts = annualData.reduce((s, r) => s + r.costs, 0)
  const totalProfit = totalSales - totalCosts

  const years = [currentFY, currentFY - 1, currentFY - 2]
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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">💴 収支一覧・分析</h1>

      <Tabs defaultValue="annual">
        <TabsList>
          <TabsTrigger value="monthly">月次収支</TabsTrigger>
          <TabsTrigger value="annual">年次収支</TabsTrigger>
          <TabsTrigger value="trend">月別推移</TabsTrigger>
          <TabsTrigger value="vendor">業者別</TabsTrigger>
        </TabsList>

        {/* 月次収支 */}
        <TabsContent value="monthly">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <Select value={selectedMonth} onValueChange={(v) => setSelectedMonth(v ?? "")}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {monthOptions.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <RevenueTable data={monthlyProjectData} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* 年次収支 */}
        <TabsContent value="annual">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <Select value={String(selectedFY)} onValueChange={(v) => setSelectedFY(parseInt(v ?? '0'))}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {years.map(y => <SelectItem key={y} value={String(y)}>{y}年度</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={exportExcel} className="gap-1.5">
                  <Download className="h-3.5 w-3.5" />Excel出力
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-6 mb-4 text-sm">
                <span>売上合計: <strong>{formatYenFull(totalSales)}</strong></span>
                <span>原価合計: <strong>{formatYenFull(totalCosts)}</strong></span>
                <span className={totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                  粗利合計: <strong>{formatYenFull(totalProfit)}</strong>
                </span>
              </div>
              <RevenueTable data={annualData} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* 月別推移 */}
        <TabsContent value="trend">
          <Card>
            <CardHeader className="pb-2">
              <Select value={String(selectedFY)} onValueChange={(v) => setSelectedFY(parseInt(v ?? '0'))}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map(y => <SelectItem key={y} value={String(y)}>{y}年度</SelectItem>)}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={monthlyData} margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => `${(v / 10000).toFixed(0)}万`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => `¥${v.toLocaleString()}`} />
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
              <Select value={String(selectedFY)} onValueChange={(v) => setSelectedFY(parseInt(v ?? '0'))}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map(y => <SelectItem key={y} value={String(y)}>{y}年度</SelectItem>)}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-3 font-medium text-muted-foreground">順位</th>
                      <th className="text-left py-2 pr-3 font-medium text-muted-foreground">業者名</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">発注額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendorData.map((v, i) => (
                      <tr key={v.name} className="border-b last:border-0">
                        <td className="py-2 pr-3 text-muted-foreground">{i + 1}</td>
                        <td className="py-2 pr-3">{v.name}</td>
                        <td className="py-2 text-right">{formatYenFull(v.amount)}</td>
                      </tr>
                    ))}
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

function RevenueTable({ data }: { data: { project_id: string; site_name: string; sales: number; costs: number; profit: number }[] }) {
  const total = data.reduce((acc, r) => ({
    sales: acc.sales + r.sales, costs: acc.costs + r.costs, profit: acc.profit + r.profit
  }), { sales: 0, costs: 0, profit: 0 })

  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 pr-3 font-medium text-muted-foreground">現場名</th>
            <th className="text-right py-2 pr-3 font-medium text-muted-foreground">売上</th>
            <th className="text-right py-2 pr-3 font-medium text-muted-foreground">原価</th>
            <th className="text-right py-2 font-medium text-muted-foreground">粗利</th>
          </tr>
        </thead>
        <tbody>
          {data.map(r => (
            <tr key={r.project_id} className="border-b last:border-0 hover:bg-muted/30">
              <td className="py-2 pr-3">{r.site_name}</td>
              <td className="py-2 pr-3 text-right">{formatYenFull(r.sales)}</td>
              <td className="py-2 pr-3 text-right">{formatYenFull(r.costs)}</td>
              <td className={`py-2 text-right font-medium ${r.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatYenFull(r.profit)}
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
              <td className="py-2 pr-3 text-right">{formatYenFull(total.sales)}</td>
              <td className="py-2 pr-3 text-right">{formatYenFull(total.costs)}</td>
              <td className={`py-2 text-right ${total.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatYenFull(total.profit)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
