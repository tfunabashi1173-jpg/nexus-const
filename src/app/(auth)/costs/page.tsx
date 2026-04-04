import type { Metadata } from 'next'
import { fetchCosts, fetchPartners, fetchProjects, getSystemSetting } from '@/lib/db'
import { normalizeCompanyName } from '@/lib/utils/text'
import { CostsClient } from './CostsClient'

export const metadata: Metadata = {
  title: '請求・原価管理 | NEXUS',
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>💰</text></svg>" },
}

export default async function CostsPage() {
  const [costs, partners, projects, safetyFeeRateStr] = await Promise.all([
    fetchCosts(),
    fetchPartners(),
    fetchProjects(),
    getSystemSetting('SAFETY_FEE_RATE', '0.5'),
  ])

  const VENDOR_CATEGORY_ORDER = ['協力業者', '仕入先', '経費']
  const vendors = partners
    .filter(p => VENDOR_CATEGORY_ORDER.includes(p.category) && !p.is_hidden)
    .sort((a, b) => {
      const ci = VENDOR_CATEGORY_ORDER.indexOf(a.category) - VENDOR_CATEGORY_ORDER.indexOf(b.category)
      return ci !== 0 ? ci : normalizeCompanyName(a.name).localeCompare(normalizeCompanyName(b.name), 'ja')
    })
  // 非表示業者も名前解決のために渡す（既存原価の表示で(不明)にならないよう）
  const allVendors = partners
    .filter(p => VENDOR_CATEGORY_ORDER.includes(p.category))
    .sort((a, b) => {
      const ci = VENDOR_CATEGORY_ORDER.indexOf(a.category) - VENDOR_CATEGORY_ORDER.indexOf(b.category)
      return ci !== 0 ? ci : normalizeCompanyName(a.name).localeCompare(normalizeCompanyName(b.name), 'ja')
    })

  return <CostsClient costs={costs} vendors={vendors} allVendors={allVendors} projects={projects} safetyFeeRate={parseFloat(safetyFeeRateStr) || 0} />
}
