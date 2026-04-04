import type { Metadata } from 'next'
import { fetchProjects, fetchPartners } from '@/lib/db'
import { ProjectsClient } from './ProjectsClient'

export const metadata: Metadata = {
  title: '現場一覧 | NEXUS',
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🛠</text></svg>" },
}

export default async function ProjectsPage() {
  const [projects, partners] = await Promise.all([fetchProjects(), fetchPartners()])
  const customers = partners.filter(p => p.category === '得意先')
  return <ProjectsClient projects={projects} customers={customers} />
}
