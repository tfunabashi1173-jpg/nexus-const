import type { Metadata } from 'next'
import { getSession } from '@/lib/auth'
import { fetchUsers, fetchPartners, getSystemSetting } from '@/lib/db'
import { redirect } from 'next/navigation'
import { MasterClient } from './MasterClient'

export const metadata: Metadata = {
  title: 'マスタ管理 | NEXUS',
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚙️</text></svg>" },
}

export default async function MasterPage() {
  const session = await getSession()
  if (!session || session.role !== 'admin') redirect('/dashboard')

  const [users, partners, fiscalStartMonth, safetyFeeRate, geminiModel] = await Promise.all([
    fetchUsers(),
    fetchPartners(),
    getSystemSetting('FISCAL_START_MONTH', '4'),
    getSystemSetting('SAFETY_FEE_RATE', '0.5'),
    getSystemSetting('GEMINI_MODEL', 'gemini-3.1-flash-lite-preview'),
  ])

  return (
    <MasterClient
      users={users}
      partners={partners}
      fiscalStartMonth={fiscalStartMonth}
      safetyFeeRate={safetyFeeRate}
      geminiModel={geminiModel}
    />
  )
}
