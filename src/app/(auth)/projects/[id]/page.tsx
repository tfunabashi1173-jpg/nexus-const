import type { Metadata } from 'next'
import { fetchProject, fetchCostsByProject, fetchSalesByProject, fetchAddonsByProject, fetchPartners, fetchUsers, fetchSubManagersByProject } from '@/lib/db'
import { notFound } from 'next/navigation'
import { ProjectDetailClient } from './ProjectDetailClient'

export const metadata: Metadata = {
  title: '現場詳細 | NEXUS',
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🛠</text></svg>" },
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [project, costs, sales, addons, partners, users, subManagers] = await Promise.all([
    fetchProject(id),
    fetchCostsByProject(id),
    fetchSalesByProject(id),
    fetchAddonsByProject(id),
    fetchPartners(),
    fetchUsers(),
    fetchSubManagersByProject(id),
  ])

  if (!project) notFound()

  return (
    <ProjectDetailClient
      project={project}
      costs={costs}
      sales={sales}
      addons={addons}
      partners={partners}
      users={users}
      subManagers={subManagers}
    />
  )
}
