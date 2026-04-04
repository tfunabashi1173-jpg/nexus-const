'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[AuthError]', error)
  }, [error])

  const router = useRouter()

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <AlertTriangle className="h-10 w-10 text-amber-500" />
      <h2 className="text-xl font-bold text-slate-800">データの取得に失敗しました</h2>
      <p className="text-sm text-slate-500 max-w-sm">
        DBへの接続が一時的に失敗しました。<br />
        しばらく待ってから再試行してください。
      </p>
      <div className="flex gap-3">
        <Button onClick={reset}>再試行</Button>
        <Button variant="outline" onClick={() => router.push('/dashboard')}>
          ダッシュボードへ
        </Button>
      </div>
    </div>
  )
}
