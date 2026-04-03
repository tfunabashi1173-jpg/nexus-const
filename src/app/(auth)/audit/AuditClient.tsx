'use client'

import { useState, useMemo } from 'react'
import { AuditLog } from '@/types'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const TABLE_LABELS: Record<string, string> = {
  projects: '工事台帳',
  partners: '取引先マスタ',
  costs: '原価明細',
  sales: '売上明細',
  addons: '追加工事履歴',
  users: 'ユーザー',
}

const ACTION_LABELS: Record<string, string> = {
  insert: '登録',
  update: '更新',
  delete: '削除',
  restore: '復元',
}

function formatDateJST(iso: string) {
  return new Date(iso).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

interface Props {
  logs: AuditLog[]
}

export function AuditClient({ logs }: Props) {
  const [searchUser, setSearchUser] = useState('')
  const [filterAction, setFilterAction] = useState('all')
  const [limit, setLimit] = useState(200)

  const filtered = useMemo(() => {
    return logs
      .filter(l => {
        if (searchUser && !(l.user_name ?? '').includes(searchUser)) return false
        if (filterAction !== 'all' && l.action !== filterAction) return false
        return true
      })
      .slice(0, limit)
  }, [logs, searchUser, filterAction, limit])

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">操作履歴（監査ログ）</h1>

      {/* フィルター */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <p className="text-sm text-slate-600">ユーザー名で検索（部分一致）</p>
          <Input
            className="w-64"
            placeholder="ユーザー名"
            value={searchUser}
            onChange={e => setSearchUser(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <p className="text-sm text-slate-600">操作</p>
          <Select value={filterAction} onValueChange={(v) => setFilterAction(v ?? 'all')}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">（全て）</SelectItem>
              <SelectItem value="insert">insert（登録）</SelectItem>
              <SelectItem value="update">update（更新）</SelectItem>
              <SelectItem value="delete">delete（削除）</SelectItem>
              <SelectItem value="restore">restore（復元）</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-slate-600">表示件数</p>
          <div className="flex items-center gap-2">
            <button
              className="h-9 w-9 rounded border border-input flex items-center justify-center text-lg hover:bg-slate-100"
              onClick={() => setLimit(v => Math.max(10, v - 50))}
            >−</button>
            <span className="w-16 text-center font-medium">{limit}</span>
            <button
              className="h-9 w-9 rounded border border-input flex items-center justify-center text-lg hover:bg-slate-100"
              onClick={() => setLimit(v => v + 50)}
            >+</button>
          </div>
        </div>
      </div>

      {/* テーブル */}
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800 text-white sticky top-0 z-10">
              <th className="px-3 py-2 text-left font-medium w-8"></th>
              <th className="px-3 py-2 text-left font-medium whitespace-nowrap">日時(JST)</th>
              <th className="px-3 py-2 text-left font-medium">ユーザー</th>
              <th className="px-3 py-2 text-left font-medium">権限</th>
              <th className="px-3 py-2 text-left font-medium">操作</th>
              <th className="px-3 py-2 text-left font-medium">対象</th>
              <th className="px-3 py-2 text-left font-medium">詳細</th>
              <th className="px-3 py-2 text-left font-medium">id</th>
              <th className="px-3 py-2 text-left font-medium">user_id</th>
              <th className="px-3 py-2 text-left font-medium">target_table</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-slate-400">
                  ログがありません
                </td>
              </tr>
            )}
            {filtered.map((log, i) => (
              <tr
                key={log.id}
                className={i % 2 === 1 ? 'bg-slate-50' : 'bg-white'}
              >
                <td className="px-3 py-2 text-slate-400">{i}</td>
                <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">
                  {log.ts_jst ?? (log.ts ? formatDateJST(log.ts) : '—')}
                </td>
                <td className="px-3 py-2">{log.user_name ?? '—'}</td>
                <td className="px-3 py-2 text-slate-500">{log.role ?? '—'}</td>
                <td className="px-3 py-2">
                  <span className={
                    log.action === 'delete' ? 'text-red-600 font-medium' :
                    log.action === 'insert' ? 'text-green-700 font-medium' :
                    log.action === 'restore' ? 'text-blue-600 font-medium' :
                    'text-slate-700'
                  }>
                    {log.action}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {log.target_table} / <span className="font-mono text-xs">{log.target_key}</span>
                </td>
                <td className="px-3 py-2 text-slate-500">
                  {TABLE_LABELS[log.target_table ?? ''] ?? log.target_table}
                </td>
                <td className="px-3 py-2 text-slate-400 text-xs">{log.id}</td>
                <td className="px-3 py-2 text-slate-400 text-xs">{log.user_id ?? '—'}</td>
                <td className="px-3 py-2 text-slate-400 text-xs">{log.target_table}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400">{filtered.length} 件表示（全 {logs.length} 件）</p>
    </div>
  )
}
