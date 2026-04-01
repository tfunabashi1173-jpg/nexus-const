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
    <aside className="fixed top-0 left-0 w-56 h-screen bg-background border-r flex flex-col z-40 overflow-hidden">
      {/* ヘッダー */}
      <div className="p-4 border-b">
        <h1 className="font-bold text-sm text-foreground leading-tight">
          NEXUS<br />工事管理システム
        </h1>
      </div>

      {/* 日付・ユーザー */}
      <div className="p-4 space-y-1">
        <p className="text-xs text-muted-foreground">{dateStr}</p>
        <p className="text-sm font-medium">👤 {user.username}</p>
      </div>

      <Separator />

      {/* ナビゲーション */}
      <nav className="flex-1 p-2 space-y-4 overflow-y-auto">
        {navItems.map((section) => (
          <div key={section.section}>
            <p className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
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
                      'flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-accent hover:text-accent-foreground text-foreground'
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
            <p className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              設定
            </p>
            <Link
              href={adminItem.href}
              className={cn(
                'flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors',
                pathname.startsWith(adminItem.href)
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent hover:text-accent-foreground text-foreground'
              )}
            >
              <Settings className="h-4 w-4 shrink-0" />
              {adminItem.label}
            </Link>
          </div>
        )}
      </nav>

      <Separator />

      {/* フッター */}
      <div className="p-3 space-y-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 text-xs"
          onClick={handleRefresh}
          disabled={isPending}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isPending && 'animate-spin')} />
          データ最新化
        </Button>

        <form action={logout}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-xs text-muted-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
            ログアウト
          </Button>
        </form>

        <p className="text-xs text-center text-muted-foreground">
          © 2025 DESIGN OFFICE NEXUS
        </p>
        <p className="text-xs text-center text-muted-foreground/50">v2.0.0</p>
      </div>
    </aside>
  )
}
