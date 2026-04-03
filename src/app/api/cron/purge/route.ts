import { NextRequest, NextResponse } from 'next/server'
import { purgeDeleted } from '@/lib/db'

// Vercel Cron または外部 cron から呼び出される
// Authorization: Bearer <CRON_SECRET> で保護
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[cron/purge] CRON_SECRET is not configured')
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { purged, errors } = await purgeDeleted()
  const total = Object.values(purged).reduce((s, n) => s + n, 0)

  console.log('[cron/purge]', { purged, errors, total })

  return NextResponse.json({ purged, errors, total })
}
