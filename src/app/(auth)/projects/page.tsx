import { fetchProjects, fetchPartners } from '@/lib/db'
import { ProjectsClient } from './ProjectsClient'

export default async function ProjectsPage() {
  const [projects, partners] = await Promise.all([fetchProjects(), fetchPartners()])
  const customers = partners.filter(p => p.category === '得意先')
  return <ProjectsClient projects={projects} customers={customers} />
}
