import { NextRequest, NextResponse } from 'next/server'
import { purgeDeleted, autoUpdateStatuses } from '@/lib/db'
import { revalidateTag } from 'next/cache'

// Vercel Cron から毎日呼び出される（vercel.json で設定）
// Authorization: Bearer <CRON_SECRET> で保護
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[cron] CRON_SECRET is not configured')
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [statusResult, purgeResult] = await Promise.all([
    autoUpdateStatuses(),
    purgeDeleted(),
  ])

  if (statusResult.updated) {
    revalidateTag('projects', {})
    revalidateTag('dashboard', {})
  }

  const purgeTotal = Object.values(purgeResult.purged).reduce((s, n) => s + n, 0)
  console.log('[cron] auto-status:', statusResult)
  console.log('[cron] purge:', { ...purgeResult, total: purgeTotal })

  return NextResponse.json({ statusResult, purgeResult: { ...purgeResult, total: purgeTotal } })
}
