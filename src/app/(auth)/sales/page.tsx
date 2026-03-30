import type { Metadata } from 'next'
import { fetchSales, fetchProjects } from '@/lib/db'
import { SalesClient } from './SalesClient'

export const metadata: Metadata = {
  title: '売上・入金管理 | NEXUS',
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>💵</text></svg>" },
}

export default async function SalesPage() {
  const [sales, projects] = await Promise.all([fetchSales(), fetchProjects()])
  return <SalesClient sales={sales} projects={projects} />
}
