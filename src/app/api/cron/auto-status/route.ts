import { NextRequest, NextResponse } from 'next/server'
import { autoUpdateStatuses } from '@/lib/db'
import { revalidateTag } from 'next/cache'

// Vercel Cron から毎日呼び出される（vercel.json で設定）
// Authorization: Bearer <CRON_SECRET> で保護
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[cron/auto-status] CRON_SECRET is not configured')
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await autoUpdateStatuses()
  if (result.updated) {
    revalidateTag('projects', {})
    revalidateTag('dashboard', {})
  }

  console.log('[cron/auto-status]', result)
  return NextResponse.json(result)
}
