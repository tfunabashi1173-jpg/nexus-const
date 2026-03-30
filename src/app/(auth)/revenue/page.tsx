import { fetchProjects, fetchSales, fetchCosts, fetchAllAddons, fetchPartners, getSystemSetting } from '@/lib/db'
import { RevenueClient } from './RevenueClient'

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
