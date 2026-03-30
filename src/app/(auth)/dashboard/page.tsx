import type { Metadata } from 'next'
import { fetchProjects, fetchSales, fetchCosts, fetchAllAddons, fetchPartners, getAlertData, getSystemSetting } from '@/lib/db'
import { DashboardClient } from './DashboardClient'

export const metadata: Metadata = {
  title: '経営状況 | NEXUS',
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📊</text></svg>" },
}

export default async function DashboardPage() {
  const [projects, sales, costs, addons, partners, alerts, fiscalStartMonth] = await Promise.all([
    fetchProjects(),
    fetchSales(),
    fetchCosts(),
    fetchAllAddons(),
    fetchPartners(),
    getAlertData(),
    getSystemSetting('FISCAL_START_MONTH', '4'),
  ])

  return (
    <DashboardClient
      projects={projects}
      sales={sales}
      costs={costs}
      addons={addons}
      partners={partners}
      alerts={alerts}
      fiscalStartMonth={parseInt(fiscalStartMonth)}
    />
  )
}
