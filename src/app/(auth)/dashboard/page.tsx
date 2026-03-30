import { fetchProjects, fetchSales, fetchCosts, fetchAllAddons, fetchPartners, getAlertData, getSystemSetting } from '@/lib/db'
import { DashboardClient } from './DashboardClient'

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
