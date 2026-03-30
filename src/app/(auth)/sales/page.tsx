import { fetchSales, fetchProjects } from '@/lib/db'
import { SalesClient } from './SalesClient'

export default async function SalesPage() {
  const [sales, projects] = await Promise.all([fetchSales(), fetchProjects()])
  return <SalesClient sales={sales} projects={projects} />
}
