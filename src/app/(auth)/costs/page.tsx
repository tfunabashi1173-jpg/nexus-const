import { fetchCosts, fetchPartners, fetchProjects } from '@/lib/db'
import { CostsClient } from './CostsClient'

export default async function CostsPage() {
  const [costs, partners, projects] = await Promise.all([
    fetchCosts(),
    fetchPartners(),
    fetchProjects(),
  ])

  const vendors = partners.filter(p => ['協力会社', '仕入先', '経費'].includes(p.category))

  return <CostsClient costs={costs} vendors={vendors} projects={projects} />
}
