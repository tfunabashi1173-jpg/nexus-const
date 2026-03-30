import { fetchPartners, fetchUsers, getNextProjectId } from '@/lib/db'
import { NewProjectClient } from './NewProjectClient'

export default async function NewProjectPage() {
  const [partners, users, nextId] = await Promise.all([
    fetchPartners(),
    fetchUsers(),
    getNextProjectId(),
  ])

  const customers = partners.filter(p => p.category === '得意先')

  return <NewProjectClient customers={customers} users={users} nextId={nextId} />
}
