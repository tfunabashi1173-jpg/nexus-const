import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getDashboardSummary } from '@/lib/db'

export async function GET(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const fyStartStr = searchParams.get('fy_start')
  const fyEndStr   = searchParams.get('fy_end')

  if (!fyStartStr || !fyEndStr) {
    return NextResponse.json({ error: 'fy_start と fy_end が必要です' }, { status: 400 })
  }

  const summary = await getDashboardSummary(new Date(fyStartStr + 'T00:00:00'), new Date(fyEndStr + 'T00:00:00'))
  return NextResponse.json(summary)
}
