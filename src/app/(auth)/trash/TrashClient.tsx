'use client'

import { useState, useTransition } from 'react'
import { Project, Sale, Cost, Partner, Addon } from '@/types'
import { formatYenFull } from '@/lib/utils/date'
import { normalizeCompanyName } from '@/lib/utils/text'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { RotateCcw, Trash2 } from 'lucide-react'

interface Props {
  deletedProjects: Project[]
  deletedSales: Sale[]
  deletedCosts: Cost[]
  deletedPartners: Partner[]
  deletedAddons: Addon[]
  projectsMap: Record<string, string>
  partnersMap: Record<string, string>
}

function formatDeletedAt(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function TrashClient({
  deletedProjects: initProjects,
  deletedSales: initSales,
  deletedCosts: initCosts,
  deletedPartners: initPartners,
  deletedAddons: initAddons,
  projectsMap,
  partnersMap,
}: Props) {
  const [projects, setProjects] = useState(initProjects)
  const [sales, setSales] = useState(initSales)
  const [costs, setCosts] = useState(initCosts)
  const [partners, setPartners] = useState(initPartners)
  const [addons, setAddons] = useState(initAddons)
  const [isPending, startTransition] = useTransition()

  function restore(type: string, id: string, remove: () => void) {
    startTransition(async () => {
      const res = await fetch('/api/trash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id }),
      })
      if (res.ok) {
        remove()
        toast.success('復元しました')
      } else {
        toast.error('復元に失敗しました')
      }
    })
  }

  function hardDelete(type: string, id: string, remove: () => void) {
    if (!window.confirm('完全削除します。この操作は取り消せません。よろしいですか？')) return
    startTransition(async () => {
      const res = await fetch('/api/trash', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id }),
      })
      if (res.ok) {
        remove()
        toast.success('完全削除しました')
      } else {
        toast.error('削除に失敗しました')
      }
    })
  }

  const total = projects.length + sales.length + costs.length + partners.length + addons.length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">ゴミ箱</h1>
        <p className="text-sm text-slate-500 mt-1">削除済みデータの復元ができます。合計 {total} 件</p>
      </div>

      <Tabs defaultValue="projects">
        <TabsList className="bg-white border">
          <TabsTrigger value="projects">工事 {projects.length > 0 && <Badge variant="secondary" className="ml-1.5">{projects.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="sales">売上 {sales.length > 0 && <Badge variant="secondary" className="ml-1.5">{sales.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="costs">原価 {costs.length > 0 && <Badge variant="secondary" className="ml-1.5">{costs.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="partners">取引先 {partners.length > 0 && <Badge variant="secondary" className="ml-1.5">{partners.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="addons">追加工事 {addons.length > 0 && <Badge variant="secondary" className="ml-1.5">{addons.length}</Badge>}</TabsTrigger>
        </TabsList>

        {/* 工事 */}
        <TabsContent value="projects">
          <TrashTable
            empty={projects.length === 0}
            headers={['現場名', 'ステータス', '担当者', '削除日時', '']}
            rows={projects.map(p => ({
              id: p.project_id,
              cells: [p.site_name, p.status, p.manager_name ?? p.manager_id, formatDeletedAt(p.deleted_at)],
              onRestore: () => restore('project', p.project_id, () =>
                setProjects(prev => prev.filter(x => x.project_id !== p.project_id))),
              onHardDelete: () => hardDelete('project', p.project_id, () =>
                setProjects(prev => prev.filter(x => x.project_id !== p.project_id))),
            }))}
            isPending={isPending}
          />
        </TabsContent>

        {/* 売上 */}
        <TabsContent value="sales">
          <TrashTable
            empty={sales.length === 0}
            headers={['現場名', '請求日', '金額', '削除日時', '']}
            rows={sales.map(s => ({
              id: s.sales_id,
              cells: [projectsMap[s.project_id] ?? s.project_id, s.billing_date, formatYenFull(s.amount), formatDeletedAt(s.deleted_at)],
              onRestore: () => restore('sale', s.sales_id, () =>
                setSales(prev => prev.filter(x => x.sales_id !== s.sales_id))),
              onHardDelete: () => hardDelete('sale', s.sales_id, () =>
                setSales(prev => prev.filter(x => x.sales_id !== s.sales_id))),
            }))}
            isPending={isPending}
          />
        </TabsContent>

        {/* 原価 */}
        <TabsContent value="costs">
          <TrashTable
            empty={costs.length === 0}
            headers={['仕入先', '現場名', '計上月', '金額', '削除日時', '']}
            rows={costs.map(c => ({
              id: c.cost_id,
              cells: [
                normalizeCompanyName(partnersMap[c.vendor_id] ?? c.vendor_id),
                c.project_id ? (projectsMap[c.project_id] ?? c.project_id) : '（未割当）',
                c.billing_month?.slice(0, 7) ?? '—',
                formatYenFull(c.amount),
                formatDeletedAt(c.deleted_at),
              ],
              onRestore: () => restore('cost', c.cost_id, () =>
                setCosts(prev => prev.filter(x => x.cost_id !== c.cost_id))),
              onHardDelete: () => hardDelete('cost', c.cost_id, () =>
                setCosts(prev => prev.filter(x => x.cost_id !== c.cost_id))),
            }))}
            isPending={isPending}
          />
        </TabsContent>

        {/* 取引先 */}
        <TabsContent value="partners">
          <TrashTable
            empty={partners.length === 0}
            headers={['取引先名', '区分', '削除日時', '']}
            rows={partners.map(p => ({
              id: p.partner_id,
              cells: [p.name, p.category, formatDeletedAt(p.deleted_at)],
              onRestore: () => restore('partner', p.partner_id, () =>
                setPartners(prev => prev.filter(x => x.partner_id !== p.partner_id))),
              onHardDelete: () => hardDelete('partner', p.partner_id, () =>
                setPartners(prev => prev.filter(x => x.partner_id !== p.partner_id))),
            }))}
            isPending={isPending}
          />
        </TabsContent>

        {/* 追加工事 */}
        <TabsContent value="addons">
          <TrashTable
            empty={addons.length === 0}
            headers={['現場名', '内容', '金額', '削除日時', '']}
            rows={addons.map(a => ({
              id: a.addon_id,
              cells: [projectsMap[a.project_id] ?? a.project_id, a.description ?? '—', formatYenFull(a.amount), formatDeletedAt(a.deleted_at)],
              onRestore: () => restore('addon', a.addon_id, () =>
                setAddons(prev => prev.filter(x => x.addon_id !== a.addon_id))),
              onHardDelete: () => hardDelete('addon', a.addon_id, () =>
                setAddons(prev => prev.filter(x => x.addon_id !== a.addon_id))),
            }))}
            isPending={isPending}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ---- テーブル共通コンポーネント ----

interface TrashRow {
  id: string
  cells: string[]
  onRestore: () => void
  onHardDelete: () => void
}

function TrashTable({
  empty,
  headers,
  rows,
  isPending,
}: {
  empty: boolean
  headers: string[]
  rows: TrashRow[]
  isPending: boolean
}) {
  if (empty) {
    return <p className="text-sm text-slate-400 py-8 text-center">削除済みデータはありません</p>
  }

  return (
    <div className="mt-3 overflow-auto rounded-lg border bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-800 text-white">
            {headers.map((h, i) => (
              <th key={i} className={`py-2.5 px-3 font-medium text-sm ${i === headers.length - 1 ? 'w-36' : 'text-left'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={row.id} className={`border-b last:border-0 ${ri % 2 === 1 ? 'bg-slate-50' : 'bg-white'}`}>
              {row.cells.map((cell, ci) => (
                <td key={ci} className="py-2.5 px-3 text-slate-700">{cell}</td>
              ))}
              <td className="py-2 px-3">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-xs"
                    onClick={row.onRestore}
                    disabled={isPending}
                  >
                    <RotateCcw className="h-3 w-3" />
                    復元
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 text-xs text-destructive hover:text-destructive hover:bg-red-50"
                    onClick={row.onHardDelete}
                    disabled={isPending}
                  >
                    <Trash2 className="h-3 w-3" />
                    完全削除
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
