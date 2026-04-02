import type { Metadata } from 'next'
import { fetchProjects, fetchAllAddons, fetchPartners, getDashboardSummary, getSystemSetting } from '@/lib/db'
import { getFiscalYear, getFiscalYearRange } from '@/lib/utils/date'
import { perfStart } from '@/lib/perf'
import { DashboardClient } from './DashboardClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '経営状況 | NEXUS',
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📊</text></svg>" },
}

export default async function DashboardPage() {
  const end = perfStart('dashboard page total')

  // getSystemSetting はキャッシュ済みなので await しても高速
  const fiscalStartMonth = parseInt(await getSystemSetting('FISCAL_START_MONTH', '4'))
  const currentFY = getFiscalYear(new Date(), fiscalStartMonth)
  const { start: fyStart, end: fyEnd } = getFiscalYearRange(currentFY, fiscalStartMonth)

  // summaryPromise は await しない → Suspense でストリーミング
  const summaryPromise = getDashboardSummary(fyStart, fyEnd)

  const [projects, addons, partners] = await Promise.all([
    fetchProjects(),   // 稼働中現場表示・追加工事金額用
    fetchAllAddons(),  // 稼働中現場の追加工事金額用
    fetchPartners(),   // キャッシュ済み。ランキング名前解決用
  ])
  end()

  return (
    <DashboardClient
      projects={projects}
      addons={addons}
      partners={partners}
      summaryPromise={summaryPromise}
      fiscalStartMonth={fiscalStartMonth}
    />
  )
}
