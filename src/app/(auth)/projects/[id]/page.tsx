import { fetchProject, fetchCostsByProject, fetchSalesByProject, fetchAddonsByProject, fetchPartners, fetchUsers } from '@/lib/db'
import { notFound } from 'next/navigation'
import { ProjectDetailClient } from './ProjectDetailClient'

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [project, costs, sales, addons, partners, users] = await Promise.all([
    fetchProject(id),
    fetchCostsByProject(id),
    fetchSalesByProject(id),
    fetchAddonsByProject(id),
    fetchPartners(),
    fetchUsers(),
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
    />
  )
}
