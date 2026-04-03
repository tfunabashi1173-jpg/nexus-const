'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { logout } from '@/app/actions/auth'
import { SessionUser } from '@/types'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import {
  BarChart3,
  Wallet,
  HardHat,
  PlusCircle,
  DollarSign,
  Receipt,
  Settings,
  LogOut,
  RefreshCw,
  Trash2,
  ClipboardList,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'

const navItems = [
  {
    section: '分析',
    items: [
      { href: '/dashboard', label: '経営状況', icon: BarChart3 },
      { href: '/revenue', label: '収支一覧・分析', icon: Wallet },
    ],
  },
  {
    section: '工事管理',
    items: [
      { href: '/projects', label: '現場詳細・編集', icon: HardHat },
      { href: '/projects/new', label: '新規工事登録', icon: PlusCircle },
    ],
  },
  {
    section: '入出金管理',
    items: [
      { href: '/sales', label: '売上・入金管理', icon: DollarSign },
      { href: '/costs', label: '請求・原価管理', icon: Receipt },
    ],
  },
]

const adminItem = { href: '/master', label: 'マスタ管理', icon: Settings }

interface AppSidebarProps {
  user: SessionUser
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const today = new Date()
  const dateStr = format(today, 'yyyy年MM月dd日(E)', { locale: ja })

  function handleRefresh() {
    startTransition(async () => {
      try {
        const res = await fetch('/api/auto-update', { method: 'POST' })
        if (res.ok) {
          toast.success('データを最新化しました')
          router.refresh()
        }
      } catch {
        toast.error('更新に失敗しました')
      }
    })
  }

  return (
    <aside className="fixed top-0 left-0 w-56 h-screen bg-slate-900 flex flex-col z-40 overflow-hidden">
      {/* ヘッダー */}
      <div className="px-5 py-5 border-b border-slate-700">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-0.5">NEXUS</p>
        <h1 className="font-bold text-white text-sm leading-tight">工事管理システム</h1>
      </div>

      {/* 日付・ユーザー */}
      <div className="px-5 py-3 border-b border-slate-700">
        <p className="text-xs text-slate-400">{dateStr}</p>
        <p className="text-sm font-medium text-slate-200 mt-0.5">👤 {user.username}</p>
      </div>

      {/* ナビゲーション */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {navItems.map((section) => (
          <div key={section.section}>
            <p className="px-2 pb-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {section.section}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href ||
                  (pathname.startsWith(item.href + '/') &&
                    !section.items.some(other => other.href !== item.href && pathname.startsWith(other.href)))
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
                      isActive
                        ? 'bg-blue-600 text-white font-medium'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}

        {user.role === 'admin' && (
          <div>
            <p className="px-2 pb-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              設定
            </p>
            <div className="space-y-0.5">
              <Link
                href={adminItem.href}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
                  pathname.startsWith(adminItem.href)
                    ? 'bg-blue-600 text-white font-medium'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                )}
              >
                <Settings className="h-4 w-4 shrink-0" />
                {adminItem.label}
              </Link>
              <Link
                href="/trash"
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
                  pathname.startsWith('/trash')
                    ? 'bg-blue-600 text-white font-medium'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                )}
              >
                <Trash2 className="h-4 w-4 shrink-0" />
                ゴミ箱
              </Link>
              <Link
                href="/audit"
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
                  pathname.startsWith('/audit')
                    ? 'bg-blue-600 text-white font-medium'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                )}
              >
                <ClipboardList className="h-4 w-4 shrink-0" />
                操作履歴
              </Link>
            </div>
          </div>
        )}
      </nav>

      <div className="border-t border-slate-700" />

      {/* フッター */}
      <div className="px-3 py-3 space-y-1">
        <button
          onClick={handleRefresh}
          disabled={isPending}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3.5 w-3.5 shrink-0', isPending && 'animate-spin')} />
          データ最新化
        </button>

        <form action={logout}>
          <button
            type="submit"
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            ログアウト
          </button>
        </form>

        <p className="text-xs text-center text-slate-600 pt-1">v{process.env.NEXT_PUBLIC_APP_VERSION} ({process.env.NEXT_PUBLIC_COMMIT_SHA})</p>
      </div>
    </aside>
  )
}
