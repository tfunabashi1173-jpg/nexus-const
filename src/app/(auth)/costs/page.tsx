import type { Metadata } from 'next'
import { fetchCosts, fetchPartners, fetchProjects } from '@/lib/db'
import { CostsClient } from './CostsClient'

export const metadata: Metadata = {
  title: '請求・原価管理 | NEXUS',
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>💰</text></svg>" },
}

export default async function CostsPage() {
  const [costs, partners, projects] = await Promise.all([
    fetchCosts(),
    fetchPartners(),
    fetchProjects(),
  ])

  const vendors = partners.filter(p => ['協力会社', '仕入先'].includes(p.category))

  return <CostsClient costs={costs} vendors={vendors} projects={projects} />
}
