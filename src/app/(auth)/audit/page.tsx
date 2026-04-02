import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { fetchAuditLogs } from '@/lib/db'
import { AuditClient } from './AuditClient'

export const dynamic = 'force-dynamic'

export default async function AuditPage() {
  const user = await getSession()
  if (!user || user.role !== 'admin') redirect('/dashboard')

  const logs = await fetchAuditLogs(200)

  return <AuditClient logs={logs} />
}
