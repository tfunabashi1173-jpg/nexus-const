import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { saveSystemSetting } from '@/lib/db'

export async function POST(req: NextRequest) {
  const user = await getSession()
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { fiscalStartMonth, safetyFeeRate } = await req.json()

  await Promise.all([
    saveSystemSetting('FISCAL_START_MONTH', String(fiscalStartMonth), '期首月'),
    saveSystemSetting('SAFETY_FEE_RATE', String(safetyFeeRate), '安全協力会費率'),
  ])

  return NextResponse.json({ success: true })
}
