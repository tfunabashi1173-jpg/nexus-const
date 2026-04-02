import type { Metadata } from 'next'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import {
  fetchDeletedProjects,
  fetchDeletedSales,
  fetchDeletedCosts,
  fetchDeletedPartners,
  fetchDeletedAddons,
  fetchAllProjectsMap,
  fetchPartners,
} from '@/lib/db'
import { TrashClient } from './TrashClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'ゴミ箱 | NEXUS',
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🗑</text></svg>" },
}

export default async function TrashPage() {
  const session = await getSession()
  if (!session || session.role !== 'admin') redirect('/dashboard')

  const [projects, sales, costs, partners, addons, projectsMap, allPartners] = await Promise.all([
    fetchDeletedProjects(),
    fetchDeletedSales(),
    fetchDeletedCosts(),
    fetchDeletedPartners(),
    fetchDeletedAddons(),
    fetchAllProjectsMap(),
    fetchPartners(),
  ])

  return (
    <TrashClient
      deletedProjects={projects}
      deletedSales={sales}
      deletedCosts={costs}
      deletedPartners={partners}
      deletedAddons={addons}
      projectsMap={projectsMap}
      partnersMap={Object.fromEntries(allPartners.map(p => [p.partner_id, p.name]))}
    />
  )
}
