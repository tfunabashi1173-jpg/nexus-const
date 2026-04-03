'use client'

import { useState, useMemo } from 'react'
import { Project, Partner } from '@/types'
import { formatYenFull } from '@/lib/utils/date'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Link from 'next/link'
import { Search } from 'lucide-react'

interface Props {
  projects: Project[]
  customers: Partner[]
}

const STATUS_COLORS: Record<string, string> = {
  '受注': 'bg-blue-100 text-blue-700',
  '着工中': 'bg-yellow-100 text-yellow-700',
  '完工': 'bg-green-100 text-green-700',
  '入金済': 'bg-gray-100 text-gray-600',
}

export function ProjectsClient({ projects, customers }: Props) {
  const today = new Date()
  const currentYM = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState(currentYM)

  const customerMap = useMemo(
    () => Object.fromEntries(customers.map(c => [c.partner_id, c.name])),
    [customers]
  )

  // 稼働月の選択肢: 全プロジェクトのstart_date〜end_dateの範囲から生成
  const monthOptions = useMemo(() => {
    const dates = projects.flatMap(p => [p.start_date, p.end_date]).filter(Boolean) as string[]
    if (dates.length === 0) return [currentYM]
    const min = dates.map(d => d.slice(0, 7)).sort()[0]
    const maxDate = dates.map(d => d.slice(0, 7)).sort().at(-1)!
    const max = maxDate < currentYM ? currentYM : maxDate
    const months: string[] = []
    let [y, m] = min.split('-').map(Number)
    const [ey, em] = max.split('-').map(Number)
    while (y < ey || (y === ey && m <= em)) {
      months.push(`${y}-${String(m).padStart(2, '0')}`)
      m++; if (m > 12) { m = 1; y++ }
    }
    return months.reverse()
  }, [projects, currentYM])

  const filtered = useMemo(() => projects.filter(p => {
    const matchSearch = !search ||
      p.site_name.includes(search) ||
      p.project_id.includes(search) ||
      (p.manager_name ?? '').includes(search)
    const matchStatus = statusFilter === 'all' || p.status === statusFilter
    const matchMonth = monthFilter === 'all' ||
      ((p.start_date?.slice(0, 7) ?? '') <= monthFilter &&
       (p.end_date?.slice(0, 7) ?? '9999-12') >= monthFilter)
    return matchSearch && matchStatus && matchMonth
  }), [projects, search, statusFilter, monthFilter])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">現場一覧</h1>
        <span className="bg-slate-800 text-white text-xs font-semibold px-3 py-1 rounded-full">{filtered.length}件</span>
      </div>

      {/* フィルター */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="現場名・ID・担当者で検索"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "")}>
          <SelectTrigger className="w-36"><SelectValue placeholder="ステータス" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべて</SelectItem>
            <SelectItem value="受注">受注</SelectItem>
            <SelectItem value="着工中">着工中</SelectItem>
            <SelectItem value="完工">完工</SelectItem>
            <SelectItem value="入金済">入金済</SelectItem>
          </SelectContent>
        </Select>
        <Select value={monthFilter} onValueChange={(v) => setMonthFilter(v ?? currentYM)}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべての月</SelectItem>
            {monthOptions.map(m => (
              <SelectItem key={m} value={m}>
                {m.replace('-', '年')}月{m === currentYM ? '（今月）' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 一覧（デスクトップ: テーブル） */}
      <div className="hidden md:block overflow-auto rounded-lg shadow-sm border-0 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800 text-white sticky top-0 z-10">
              <th className="text-left py-3 px-3 font-medium">工事ID</th>
              <th className="text-left py-3 px-3 font-medium">現場名</th>
              <th className="text-left py-3 px-3 font-medium">ステータス</th>
              <th className="text-left py-3 px-3 font-medium">得意先</th>
              <th className="text-left py-3 px-3 font-medium">担当</th>
              <th className="text-left py-3 px-3 font-medium">工期</th>
              <th className="text-right py-3 px-3 font-medium">請負金額</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => (
              <tr key={p.project_id} className={`border-b last:border-0 hover:bg-blue-50 transition-colors ${i % 2 === 1 ? 'bg-slate-50' : 'bg-white'}`}>
                <td className="py-2 px-3">
                  <Link href={`/projects/${p.project_id}`} className="text-primary hover:underline font-mono text-xs">
                    {p.project_id}
                  </Link>
                </td>
                <td className="py-2 px-3">
                  <Link href={`/projects/${p.project_id}`} className="font-medium hover:text-primary">
                    {p.site_name}
                  </Link>
                </td>
                <td className="py-2 px-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[p.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {p.status}
                  </span>
                </td>
                <td className="py-2 px-3 text-muted-foreground">{customerMap[p.customer_id] ?? '(不明)'}</td>
                <td className="py-2 px-3 text-muted-foreground">{p.manager_name}</td>
                <td className="py-2 px-3 text-muted-foreground whitespace-nowrap text-xs">
                  {p.start_date?.slice(0, 7)} 〜 {p.end_date?.slice(0, 7)}
                </td>
                <td className="py-2 px-3 text-right">{formatYenFull(p.contract_amount)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-muted-foreground">
                  該当する現場はありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 一覧（モバイル: カード型） */}
      <div className="md:hidden space-y-2">
        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">該当する現場はありません</p>
        ) : (
          filtered.map(p => (
            <Link key={p.project_id} href={`/projects/${p.project_id}`} className="block bg-white rounded-lg border p-4 hover:bg-blue-50 transition-colors">
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="font-semibold text-base leading-tight">{p.site_name}</p>
                <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[p.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {p.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mb-2">{p.project_id}</p>
              <div className="flex justify-between items-end">
                <div className="space-y-0.5 text-xs text-slate-500">
                  <p>{customerMap[p.customer_id] ?? '(不明)'} / {p.manager_name}</p>
                  <p>{p.start_date?.slice(0, 7)} 〜 {p.end_date?.slice(0, 7)}</p>
                </div>
                <p className="text-sm font-semibold tabular-nums">{formatYenFull(p.contract_amount)}</p>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
