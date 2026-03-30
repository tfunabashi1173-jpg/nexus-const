import type { Metadata } from 'next'
import { fetchPartners, fetchUsers, getNextProjectId } from '@/lib/db'
import { NewProjectClient } from './NewProjectClient'

export const metadata: Metadata = {
  title: '新規工事登録 | NEXUS',
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📝</text></svg>" },
}

export default async function NewProjectPage() {
  const [partners, users, nextId] = await Promise.all([
    fetchPartners(),
    fetchUsers(),
    getNextProjectId(),
  ])

  const customers = partners.filter(p => p.category === '得意先')

  return <NewProjectClient customers={customers} users={users} nextId={nextId} />
}
