import type { Metadata } from 'next'
import { fetchProjects, fetchSales, fetchCosts, fetchAllAddons, fetchPartners, getSystemSetting } from '@/lib/db'
import { RevenueClient } from './RevenueClient'

export const metadata: Metadata = {
  title: '収支一覧・分析 | NEXUS',
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>💴</text></svg>" },
}

export default async function RevenuePage() {
  const [projects, sales, costs, addons, partners, fiscalStartMonth] = await Promise.all([
    fetchProjects(),
    fetchSales(),
    fetchCosts(),
    fetchAllAddons(),
    fetchPartners(),
    getSystemSetting('FISCAL_START_MONTH', '4'),
  ])

  return (
    <RevenueClient
      projects={projects}
      sales={sales}
      costs={costs}
      addons={addons}
      partners={partners}
      fiscalStartMonth={parseInt(fiscalStartMonth)}
    />
  )
}
