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
  system_error: 'エラー',
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

function DetailCell({ detail, action }: { detail: Record<string, any>; action: string }) {
  const [open, setOpen] = useState(false)

  if (!detail || Object.keys(detail).length === 0) return <span className="text-slate-300">—</span>

  if (action === 'system_error') {
    const msg = detail.message ?? JSON.stringify(detail)
    return (
      <span
        className="cursor-pointer text-red-600 hover:underline"
        title={msg}
        onClick={() => setOpen(v => !v)}
      >
        {open ? msg : (msg.length > 60 ? msg.slice(0, 60) + '…' : msg)}
      </span>
    )
  }

  const summary = Object.entries(detail)
    .slice(0, 2)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join(' / ')
  return (
    <span
      className="cursor-pointer text-slate-500 hover:underline text-xs"
      title={JSON.stringify(detail, null, 2)}
      onClick={() => setOpen(v => !v)}
    >
      {open ? JSON.stringify(detail) : (summary.length > 60 ? summary.slice(0, 60) + '…' : summary)}
    </span>
  )
}

interface Props {
  logs: AuditLog[]
}

export function AuditClient({ logs }: Props) {
  const [searchUser, setSearchUser] = useState('')
  const [filterAction, setFilterAction] = useState('all')
  const [limit, setLimit] = useState(200)

  const errorCount = useMemo(() => logs.filter(l => l.action === 'system_error').length, [logs])

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
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-900">操作履歴（監査ログ）</h1>
        {errorCount > 0 && filterAction !== 'system_error' && (
          <button
            className="text-sm px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-medium hover:bg-red-200"
            onClick={() => setFilterAction('system_error')}
          >
            エラー {errorCount}件
          </button>
        )}
        {filterAction !== 'all' && (
          <button
            className="text-sm px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-medium hover:bg-slate-200"
            onClick={() => setFilterAction('all')}
          >
            ✕ 絞込解除
          </button>
        )}
      </div>

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
              <SelectItem value="system_error">system_error（エラー）</SelectItem>
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
              <th className="px-3 py-2 text-left font-medium whitespace-nowrap">日時(JST)</th>
              <th className="px-3 py-2 text-left font-medium">ユーザー</th>
              <th className="px-3 py-2 text-left font-medium">操作</th>
              <th className="px-3 py-2 text-left font-medium">対象テーブル</th>
              <th className="px-3 py-2 text-left font-medium">対象ID</th>
              <th className="px-3 py-2 text-left font-medium">詳細・エラー内容</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-400">
                  ログがありません
                </td>
              </tr>
            )}
            {filtered.map((log, i) => {
              const isError = log.action === 'system_error'
              return (
                <tr
                  key={log.id}
                  className={
                    isError
                      ? 'bg-red-50 border-l-4 border-red-400'
                      : i % 2 === 1 ? 'bg-slate-50' : 'bg-white'
                  }
                >
                  <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">
                    {log.ts_jst ?? (log.ts ? formatDateJST(log.ts) : '—')}
                  </td>
                  <td className="px-3 py-2">{log.user_name ?? '—'}</td>
                  <td className="px-3 py-2">
                    <span className={
                      isError ? 'text-red-600 font-bold' :
                      log.action === 'delete' ? 'text-red-600 font-medium' :
                      log.action === 'insert' ? 'text-green-700 font-medium' :
                      log.action === 'restore' ? 'text-blue-600 font-medium' :
                      'text-slate-700'
                    }>
                      {ACTION_LABELS[log.action] ?? log.action}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {TABLE_LABELS[log.target_table ?? ''] ?? log.target_table ?? '—'}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-400">
                    {log.target_key ?? '—'}
                  </td>
                  <td className="px-3 py-2 max-w-md">
                    <DetailCell detail={log.detail ?? {}} action={log.action} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400">{filtered.length} 件表示（全 {logs.length} 件）</p>
    </div>
  )
}
