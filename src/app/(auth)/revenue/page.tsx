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
  const currentFY = getFiscalYear(today, fiscalStartMonth)
  const { start: fyStart, end: fyEnd } = getFiscalYearRange(currentFY, fiscalStartMonth)
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

  const [summary, monthlyData] = await Promise.all([
    getRevenueSummary(fyStart, fyEnd),
    getMonthlyRevenue(currentMonth),
  ])

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
