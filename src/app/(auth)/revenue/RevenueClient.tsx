'use client'

import { useMemo, useState, useEffect } from 'react'
import { RevenueSummary, MonthlyRevenue } from '@/types'
import { getFiscalYearRange, formatYenFull } from '@/lib/utils/date'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid
} from 'recharts'
import { Download } from 'lucide-react'

interface Props {
  initialSummary: RevenueSummary
  initialMonthlyData: MonthlyRevenue
  initialMonth: string
  currentFY: number
  fiscalStartMonth: number
}

export function RevenueClient({
  initialSummary,
  initialMonthlyData,
  initialMonth,
  currentFY,
  fiscalStartMonth,
}: Props) {
  const today = new Date()
  const [selectedFY, setSelectedFY] = useState(currentFY)
  const [selectedMonth, setSelectedMonth] = useState(initialMonth)
  const [summary, setSummary] = useState<RevenueSummary>(initialSummary)
  const [monthlyData, setMonthlyData] = useState<MonthlyRevenue>(initialMonthlyData)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [monthlyLoading, setMonthlyLoading] = useState(false)

  // 年度変更 → サマリー再取得
  useEffect(() => {
    if (selectedFY === currentFY) {
      setSummary(initialSummary)
      return
    }
    const { start, end } = getFiscalYearRange(selectedFY, fiscalStartMonth)
    const s = start.toISOString().split('T')[0]
    const e = end.toISOString().split('T')[0]
    setSummaryLoading(true)
    fetch(`/api/revenue-summary?fy_start=${s}&fy_end=${e}`)
      .then(r => r.json())
      .then(data => { setSummary(data); setSummaryLoading(false) })
      .catch(() => setSummaryLoading(false))
  }, [selectedFY]) // eslint-disable-line react-hooks/exhaustive-deps

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
      .catch(() => setMonthlyLoading(false))
  }, [selectedMonth]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const FYSelector = (
    <Select value={String(selectedFY)} onValueChange={(v) => setSelectedFY(parseInt(v ?? '0'))}>
      <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
      <SelectContent>
        {years.map(y => <SelectItem key={y} value={String(y)}>{y}年度</SelectItem>)}
      </SelectContent>
    </Select>
  )

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
              <RevenueTable data={monthlyData} />
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
                {summaryLoading && <span className="text-sm text-muted-foreground animate-pulse">読み込み中...</span>}
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
              <div className="flex items-center gap-3">
                {FYSelector}
                {summaryLoading && <span className="text-sm text-muted-foreground animate-pulse">読み込み中...</span>}
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={monthlyTrendData} margin={{ left: 10, right: 10 }}>
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
              <div className="flex items-center gap-3">
                {FYSelector}
                {summaryLoading && <span className="text-sm text-muted-foreground animate-pulse">読み込み中...</span>}
              </div>
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
                    {summary.vendor_ranking.map((v, i) => (
                      <tr key={v.id} className="border-b last:border-0">
                        <td className="py-2 pr-3 text-muted-foreground">{i + 1}</td>
                        <td className="py-2 pr-3">{v.name}</td>
                        <td className="py-2 text-right">{formatYenFull(v.amount)}</td>
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
