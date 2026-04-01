import type { Metadata } from 'next'
import { getRevenueSummary, getMonthlyRevenue, getSystemSetting } from '@/lib/db'
import { getFiscalYear, getFiscalYearRange } from '@/lib/utils/date'
import { RevenueClient } from './RevenueClient'

export const metadata: Metadata = {
  title: '収支一覧・分析 | NEXUS',
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>💴</text></svg>" },
}

export default async function RevenuePage() {
  const today = new Date()
  const fiscalStartMonth = parseInt(await getSystemSetting('FISCAL_START_MONTH', '4'))
  let currentFY = getFiscalYear(today, fiscalStartMonth)
  let { start: fyStart, end: fyEnd } = getFiscalYearRange(currentFY, fiscalStartMonth)
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

  let summary = await getRevenueSummary(fyStart, fyEnd)

  // 当期にデータがない場合（期初直後など）は前期を初期表示
  if (summary.annual.length === 0) {
    currentFY = currentFY - 1
    const prev = getFiscalYearRange(currentFY, fiscalStartMonth)
    fyStart = prev.start
    fyEnd = prev.end
    summary = await getRevenueSummary(fyStart, fyEnd)
  }

  const monthlyData = await getMonthlyRevenue(currentMonth)

  return (
    <RevenueClient
      initialSummary={summary}
      initialMonthlyData={monthlyData}
      initialMonth={currentMonth}
      currentFY={currentFY}
      fiscalStartMonth={fiscalStartMonth}
    />
  )
}
