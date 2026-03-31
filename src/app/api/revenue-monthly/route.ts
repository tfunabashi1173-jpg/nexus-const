import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getMonthlyRevenue } from '@/lib/db'

export async function GET(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month')

  if (!month) {
    return NextResponse.json({ error: 'month が必要です' }, { status: 400 })
  }

  const data = await getMonthlyRevenue(month)
  return NextResponse.json(data)
}
