import { createServiceRoleClient } from '@/lib/supabase/server'
import { Project, Partner, Sale, Cost, Addon, User, ProjectSubManager, DashboardSummary, RevenueSummary, MonthlyRevenue, AuditLog, SessionUser } from '@/types'
import { formatDateLocal } from '@/lib/utils/date'
import { unstable_cache, revalidateTag } from 'next/cache'
import { perfStart } from '@/lib/perf'

const supabase = () => createServiceRoleClient()
const ACTIVE = 'is_deleted.is.null,is_deleted.eq.false'

// Next.js 16 では revalidateTag が (tag, profile) を要求するため空の CacheLifeConfig を渡す
const invalidate = (tag: string) => revalidateTag(tag, {})

// ==========================================
// Projects
// ==========================================
async function fetchProjectsImpl(): Promise<Project[]> {
  const end = perfStart('fetchProjects')
  const { data } = await supabase()
    .from('projects')
    .select('*, users(username)')
    .or(ACTIVE)
    .order('start_date', { ascending: false })
  end()
  if (!data) return []
  return data.map((p: any) => ({
    ...p,
    manager_name: p.users?.username ?? p.manager_id,
  }))
}

export const fetchProjects = unstable_cache(fetchProjectsImpl, ['projects'], {
  tags: ['projects'],
  revalidate: 30,
})

export async function fetchProject(id: string): Promise<Project | null> {
  const { data } = await supabase()
    .from('projects')
    .select('*, users(username)')
    .eq('project_id', id)
    .single()
  if (!data) return null
  return { ...data, manager_name: data.users?.username ?? data.manager_id }
}

export async function createProject(project: Omit<Project, 'is_deleted' | 'deleted_at'>) {
  const { data, error } = await supabase().from('projects').insert(project).select().single()
  if (!error) {
    invalidate('projects')
    invalidate('dashboard')
    invalidate('revenue')
  }
  return { data, error }
}

export async function updateProject(id: string, updates: Partial<Project>) {
  const { data, error } = await supabase()
    .from('projects')
    .update(updates)
    .eq('project_id', id)
    .select()
    .single()
  if (!error) {
    invalidate('projects')
    invalidate('dashboard')
    invalidate('revenue')
  }
  return { data, error }
}

export async function softDeleteProject(id: string) {
  const { error } = await supabase()
    .from('projects')
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq('project_id', id)
  // 追加工事も論理削除
  await supabase()
    .from('addons')
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq('project_id', id)
  if (!error) {
    invalidate('projects')
    invalidate('dashboard')
    invalidate('revenue')
  }
  return { error }
}

export async function getNextProjectId(): Promise<string> {
  const end = perfStart('getNextProjectId')
  const prefix = new Date().toISOString().slice(0, 7).replace('-', '')
  const { data } = await supabase()
    .from('projects')
    .select('project_id')
    .like('project_id', `${prefix}%`)
    .order('project_id', { ascending: false })
    .limit(1)
  end()
  const last = data?.[0]?.project_id
  const next = last ? parseInt(last.slice(6)) + 1 : 1
  return `${prefix}${String(next).padStart(3, '0')}`
}

// ==========================================
// Partners
// ==========================================
async function fetchPartnersImpl(): Promise<Partner[]> {
  const end = perfStart('fetchPartners')
  const { data } = await supabase()
    .from('partners')
    .select('*')
    .or(ACTIVE)
    .order('name')
  end()
  return data ?? []
}

export const fetchPartners = unstable_cache(fetchPartnersImpl, ['partners'], {
  tags: ['partners'],
  revalidate: 60,
})

export async function createPartner(partner: Omit<Partner, 'is_deleted' | 'deleted_at'>) {
  const { data, error } = await supabase().from('partners').insert(partner).select().single()
  if (!error) invalidate('partners')
  return { data, error }
}

export async function updatePartner(id: string, updates: Partial<Partner>) {
  const { data, error } = await supabase()
    .from('partners')
    .update(updates)
    .eq('partner_id', id)
    .select()
    .single()
  if (!error) invalidate('partners')
  return { data, error }
}

export async function softDeletePartner(id: string) {
  const { error } = await supabase()
    .from('partners')
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq('partner_id', id)
  if (!error) invalidate('partners')
  return { error }
}

// ==========================================
// Sales
// ==========================================
async function fetchSalesImpl(): Promise<Sale[]> {
  const end = perfStart('fetchSales')
  const { data } = await supabase()
    .from('sales')
    .select('*')
    .or(ACTIVE)
    .order('billing_date', { ascending: false })
  end()
  return data ?? []
}

export const fetchSales = unstable_cache(fetchSalesImpl, ['sales'], {
  tags: ['sales'],
  revalidate: 30,
})

export async function fetchSalesByProject(projectId: string): Promise<Sale[]> {
  const { data } = await supabase()
    .from('sales')
    .select('*')
    .eq('project_id', projectId)
    .or(ACTIVE)
    .order('billing_date', { ascending: false })
  return data ?? []
}

export async function createSale(sale: Omit<Sale, 'is_deleted' | 'deleted_at'>) {
  const { data, error } = await supabase().from('sales').insert(sale).select().single()
  if (!error) {
    invalidate('sales')
    invalidate('dashboard')
    invalidate('revenue')
  }
  return { data, error }
}

export async function updateSale(id: string, updates: Partial<Sale>) {
  const { data, error } = await supabase()
    .from('sales')
    .update(updates)
    .eq('sales_id', id)
    .select()
    .single()
  if (!error) {
    invalidate('sales')
    invalidate('dashboard')
    invalidate('revenue')
  }
  return { data, error }
}

export async function softDeleteSale(id: string) {
  const { error } = await supabase()
    .from('sales')
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq('sales_id', id)
  if (!error) {
    invalidate('sales')
    invalidate('dashboard')
    invalidate('revenue')
  }
  return { error }
}

// ==========================================
// Costs
// ==========================================
async function fetchCostsImpl(): Promise<Cost[]> {
  const end = perfStart('fetchCosts')
  // 36ヶ月分に絞り込み（全件取得によるパフォーマンス劣化を防止）
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - 36)
  const cutoffStr = formatDateLocal(new Date(cutoff.getFullYear(), cutoff.getMonth(), 1))
  const { data } = await supabase()
    .from('costs')
    .select('*')
    .or(ACTIVE)
    .gte('billing_month', cutoffStr)
    .order('billing_month', { ascending: false })
  end()
  return data ?? []
}

export const fetchCosts = unstable_cache(fetchCostsImpl, ['costs'], {
  tags: ['costs'],
  revalidate: 30,
})

export async function fetchCostsByProject(projectId: string): Promise<Cost[]> {
  const { data } = await supabase()
    .from('costs')
    .select('*')
    .eq('project_id', projectId)
    .or(ACTIVE)
    .order('billing_month', { ascending: false })
  return data ?? []
}

// ==========================================
// Project Sub Managers
// ==========================================
export async function fetchSubManagersByProject(projectId: string): Promise<ProjectSubManager[]> {
  const { data } = await supabase()
    .from('project_sub_managers')
    .select('*, users(username)')
    .eq('project_id', projectId)
    .or(ACTIVE)
    .order('start_date', { ascending: true })
  if (!data) return []
  return data.map((r: any) => ({ ...r, username: r.users?.username ?? r.manager_id }))
}

export async function createSubManager(sub: Omit<ProjectSubManager, 'username'>) {
  const { data, error } = await supabase()
    .from('project_sub_managers')
    .insert(sub)
    .select()
    .single()
  if (!error) {
    invalidate('dashboard')
    invalidate('revenue')
  }
  return { data, error }
}

export async function deleteSubManager(id: string) {
  const { error } = await supabase()
    .from('project_sub_managers')
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (!error) {
    invalidate('dashboard')
    invalidate('revenue')
  }
  return { error }
}

export async function createCost(cost: Omit<Cost, 'is_deleted' | 'deleted_at'>) {
  const { data, error } = await supabase().from('costs').insert(cost).select().single()
  if (!error) {
    invalidate('costs')
    invalidate('dashboard')
    invalidate('revenue')
  }
  return { data, error }
}

export async function updateCost(id: string, updates: Partial<Cost>) {
  const { data, error } = await supabase()
    .from('costs')
    .update(updates)
    .eq('cost_id', id)
    .select()
    .single()
  if (!error) {
    invalidate('costs')
    invalidate('dashboard')
    invalidate('revenue')
  }
  return { data, error }
}

export async function softDeleteCost(id: string) {
  const { error } = await supabase()
    .from('costs')
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq('cost_id', id)
  if (!error) {
    invalidate('costs')
    invalidate('dashboard')
    invalidate('revenue')
  }
  return { error }
}

// ==========================================
// Addons
// ==========================================
export async function fetchAddonsByProject(projectId: string): Promise<Addon[]> {
  const { data } = await supabase()
    .from('addons')
    .select('*')
    .eq('project_id', projectId)
    .or(ACTIVE)
    .order('request_date', { ascending: false })
  return data ?? []
}

export async function fetchAllAddons(): Promise<Addon[]> {
  const end = perfStart('fetchAllAddons')
  const { data } = await supabase()
    .from('addons')
    .select('*')
    .or(ACTIVE)
  end()
  return data ?? []
}

export async function createAddon(addon: Omit<Addon, 'is_deleted' | 'deleted_at'>) {
  const { data, error } = await supabase().from('addons').insert(addon).select().single()
  if (!error) {
    invalidate('projects')
    invalidate('dashboard')
    invalidate('revenue')
  }
  return { data, error }
}

export async function updateAddon(id: string, updates: Partial<Addon>) {
  const { data, error } = await supabase()
    .from('addons')
    .update(updates)
    .eq('addon_id', id)
    .select()
    .single()
  if (!error) {
    invalidate('dashboard')
    invalidate('revenue')
  }
  return { data, error }
}

export async function softDeleteAddon(id: string) {
  const { error } = await supabase()
    .from('addons')
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq('addon_id', id)
  if (!error) {
    invalidate('dashboard')
    invalidate('revenue')
  }
  return { error }
}

// ==========================================
// Users
// ==========================================
export async function fetchUsers(): Promise<User[]> {
  const { data } = await supabase()
    .from('users')
    .select('*')
    .or(ACTIVE)
    .order('username')
  return data ?? []
}

export async function createUser(user: Omit<User, 'is_deleted' | 'deleted_at'>) {
  const { data, error } = await supabase().from('users').insert(user).select().single()
  return { data, error }
}

export async function updateUser(id: string, updates: Partial<User>) {
  const { data, error } = await supabase()
    .from('users')
    .update(updates)
    .eq('user_id', id)
    .select()
    .single()
  return { data, error }
}

export async function softDeleteUser(id: string) {
  const { error } = await supabase()
    .from('users')
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq('user_id', id)
  return { error }
}

// ==========================================
// Trash (deleted items)
// ==========================================

export async function fetchDeletedProjects(): Promise<Project[]> {
  const { data } = await supabase()
    .from('projects')
    .select('*, users(username)')
    .eq('is_deleted', true)
    .order('deleted_at', { ascending: false })
  if (!data) return []
  return data.map((p: any) => ({ ...p, manager_name: p.users?.username ?? p.manager_id }))
}

export async function fetchDeletedSales(): Promise<Sale[]> {
  const { data } = await supabase()
    .from('sales')
    .select('*')
    .eq('is_deleted', true)
    .order('deleted_at', { ascending: false })
  return data ?? []
}

export async function fetchDeletedCosts(): Promise<Cost[]> {
  const { data } = await supabase()
    .from('costs')
    .select('*')
    .eq('is_deleted', true)
    .order('deleted_at', { ascending: false })
  return data ?? []
}

export async function fetchDeletedPartners(): Promise<Partner[]> {
  const { data } = await supabase()
    .from('partners')
    .select('*')
    .eq('is_deleted', true)
    .order('deleted_at', { ascending: false })
  return data ?? []
}

export async function fetchDeletedAddons(): Promise<Addon[]> {
  const { data } = await supabase()
    .from('addons')
    .select('*')
    .eq('is_deleted', true)
    .order('deleted_at', { ascending: false })
  return data ?? []
}

/** 全工事（削除済み含む）の project_id → site_name マップ */
export async function fetchAllProjectsMap(): Promise<Record<string, string>> {
  const { data } = await supabase().from('projects').select('project_id, site_name')
  if (!data) return {}
  return Object.fromEntries(data.map((p: any) => [p.project_id, p.site_name]))
}

export async function restoreProject(id: string) {
  const { error } = await supabase()
    .from('projects')
    .update({ is_deleted: null, deleted_at: null })
    .eq('project_id', id)
  // 工事削除時に一括削除された追加工事も復元
  await supabase()
    .from('addons')
    .update({ is_deleted: null, deleted_at: null })
    .eq('project_id', id)
    .eq('is_deleted', true)
  if (!error) {
    invalidate('projects')
    invalidate('dashboard')
    invalidate('revenue')
  }
  return { error }
}

export async function restoreSale(id: string) {
  const { error } = await supabase()
    .from('sales')
    .update({ is_deleted: null, deleted_at: null })
    .eq('sales_id', id)
  if (!error) {
    invalidate('sales')
    invalidate('dashboard')
    invalidate('revenue')
  }
  return { error }
}

export async function restoreCost(id: string) {
  const { error } = await supabase()
    .from('costs')
    .update({ is_deleted: null, deleted_at: null })
    .eq('cost_id', id)
  if (!error) {
    invalidate('costs')
    invalidate('dashboard')
    invalidate('revenue')
  }
  return { error }
}

export async function restorePartner(id: string) {
  const { error } = await supabase()
    .from('partners')
    .update({ is_deleted: null, deleted_at: null })
    .eq('partner_id', id)
  if (!error) invalidate('partners')
  return { error }
}

export async function restoreAddon(id: string) {
  const { error } = await supabase()
    .from('addons')
    .update({ is_deleted: null, deleted_at: null })
    .eq('addon_id', id)
  if (!error) {
    invalidate('projects')
    invalidate('dashboard')
    invalidate('revenue')
  }
  return { error }
}

// ==========================================
// Hard Delete (物理削除)
// ==========================================
export async function hardDeleteProject(id: string) {
  const { error } = await supabase().from('projects').delete().eq('project_id', id)
  return { error }
}
export async function hardDeleteSale(id: string) {
  const { error } = await supabase().from('sales').delete().eq('sales_id', id)
  return { error }
}
export async function hardDeleteCost(id: string) {
  const { error } = await supabase().from('costs').delete().eq('cost_id', id)
  return { error }
}
export async function hardDeletePartner(id: string) {
  const { error } = await supabase().from('partners').delete().eq('partner_id', id)
  return { error }
}
export async function hardDeleteAddon(id: string) {
  const { error } = await supabase().from('addons').delete().eq('addon_id', id)
  return { error }
}

// ==========================================
// System Settings
// ==========================================
async function getSystemSettingImpl(key: string, defaultValue: string): Promise<string> {
  const { data } = await supabase()
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', key)
    .single()
  return data?.setting_value ?? defaultValue
}

export function getSystemSetting(key: string, defaultValue: string = ''): Promise<string> {
  return unstable_cache(
    () => getSystemSettingImpl(key, defaultValue),
    ['settings', key],
    { tags: ['settings'], revalidate: 3600 }
  )()
}

export async function saveSystemSetting(key: string, value: string, description: string = '') {
  const { error } = await supabase()
    .from('system_settings')
    .upsert({ setting_key: key, setting_value: value, description })
  if (!error) invalidate('settings')
  return { error }
}

// ==========================================
// Storage
// ==========================================
export async function uploadEvidence(fileBuffer: Buffer, fileName: string, contentType: string, targetDate?: string): Promise<string | null> {
  const now = targetDate ? new Date(targetDate) : new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const ext = fileName.split('.').pop() || 'jpg'
  const path = `${year}/${month}/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase()
    .storage
    .from('evidence')
    .upload(path, fileBuffer, { contentType })

  if (error) return null
  return path
}

export async function getEvidenceSignedUrl(filePath: string): Promise<string | null> {
  if (!filePath) return null
  const { data, error } = await supabase()
    .storage
    .from('evidence')
    .createSignedUrl(filePath.replace(/^\//, ''), 600)
  if (error || !data) return null
  return data.signedUrl
}

// ==========================================
// Purge (論理削除から30日経過したレコードを物理削除)
// ==========================================
export async function purgeDeleted(): Promise<{ purged: Record<string, number>; errors: string[] }> {
  const threshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const purged: Record<string, number> = {}
  const errors: string[] = []

  const tables: { table: string; pk: string }[] = [
    { table: 'costs',    pk: 'cost_id' },
    { table: 'sales',    pk: 'sales_id' },
    { table: 'addons',   pk: 'addon_id' },
    { table: 'projects', pk: 'project_id' },
    { table: 'partners', pk: 'partner_id' },
    { table: 'users',    pk: 'user_id' },
  ]

  for (const { table, pk } of tables) {
    const { data, error } = await supabase()
      .from(table)
      .delete()
      .eq('is_deleted', true)
      .lt('deleted_at', threshold)
      .select(pk)
    if (error) errors.push(`${table}: ${error.message}`)
    purged[table] = data?.length ?? 0
  }

  return { purged, errors }
}

// ==========================================
// Auto Status Update
// ==========================================
export async function autoUpdateStatuses(): Promise<{ updated: boolean; message: string }> {
  const today = formatDateLocal(new Date())
  let count = 0

  // 受注 → 着工中
  const { data: d1 } = await supabase()
    .from('projects').select('project_id').eq('status', '受注').lte('start_date', today).or(ACTIVE)
  if (d1?.length) {
    await supabase().from('projects').update({ status: '着工中' }).in('project_id', d1.map((r: any) => r.project_id))
    count += d1.length
  }

  // 受注/着工中 → 完工
  const { data: d2 } = await supabase()
    .from('projects').select('project_id').in('status', ['受注', '着工中']).lt('end_date', today).or(ACTIVE)
  if (d2?.length) {
    await supabase().from('projects').update({ status: '完工' }).in('project_id', d2.map((r: any) => r.project_id))
    count += d2.length
  }

  // 完工 → 着工中（工期修正で戻った場合）
  const { data: d3 } = await supabase()
    .from('projects').select('project_id').eq('status', '完工').lte('start_date', today).gte('end_date', today).or(ACTIVE)
  if (d3?.length) {
    await supabase().from('projects').update({ status: '着工中' }).in('project_id', d3.map((r: any) => r.project_id))
    count += d3.length
  }

  if (count > 0) invalidate('projects')

  return { updated: count > 0, message: count > 0 ? `${count}件のステータスを更新しました` : '更新なし' }
}

// ==========================================
// Alert Data
// ==========================================

// DBアクセスなし。既に取得済みデータからアラートを計算する純粋関数
export function computeAlerts(projects: Project[], sales: Sale[], costs: Cost[]) {
  const projectIds = new Set(projects.map(p => p.project_id))

  const unpaid_sales = sales.filter(s => !s.deposit_status)

  const orphaned_costs = costs.filter(c =>
    !c.project_id || !projectIds.has(c.project_id)
  )

  const projectSales = sales.reduce((acc, s) => {
    acc[s.project_id] = (acc[s.project_id] ?? 0) + s.amount
    return acc
  }, {} as Record<string, number>)

  const projectCosts = costs.filter(c => c.project_id).reduce((acc, c) => {
    acc[c.project_id!] = (acc[c.project_id!] ?? 0) + c.amount
    return acc
  }, {} as Record<string, number>)

  const unbilled_costs = projects
    .filter(p => {
      const cost = projectCosts[p.project_id] ?? 0
      const sale = projectSales[p.project_id] ?? 0
      return cost > 0 && sale === 0
    })
    .map(p => ({
      project_id: p.project_id,
      site_name: p.site_name,
      cost_total: projectCosts[p.project_id] ?? 0,
      sales_total: projectSales[p.project_id] ?? 0,
    }))

  return { unpaid_sales, orphaned_costs, unbilled_costs }
}

// ==========================================
// Dashboard RPC
// ==========================================

async function getDashboardSummaryImpl(s: string, e: string): Promise<DashboardSummary> {
  const end = perfStart('getDashboardSummary')
  const { data, error } = await supabase()
    .rpc('get_dashboard_summary', { p_fy_start: s, p_fy_end: e })
  end()
  if (error || !data) {
    return {
      kpi: { total_sales: 0, total_costs: 0 },
      staff_ranking: [],
      customer_ranking: [],
      vendor_ranking: [],
      alerts: { unpaid_sales: 0, orphaned_costs: 0, unbilled_costs: 0 },
    }
  }
  return data as DashboardSummary
}

export function getDashboardSummary(fyStart: Date, fyEnd: Date): Promise<DashboardSummary> {
  const s = formatDateLocal(fyStart)
  const e = formatDateLocal(fyEnd)
  return unstable_cache(
    () => getDashboardSummaryImpl(s, e),
    ['dashboard-summary', s, e],
    { tags: ['dashboard'], revalidate: 10 }
  )()
}

// ==========================================
// Revenue RPC
// ==========================================

async function getRevenueSummaryImpl(fyStartStr: string, fyEndStr: string): Promise<RevenueSummary> {
  const end = perfStart('getRevenueSummary')
  const { data, error } = await supabase()
    .rpc('get_revenue_summary', {
      p_fy_start: fyStartStr,
      p_fy_end:   fyEndStr,
    })
  end()
  if (error || !data) return { annual: [], monthly_trend: [], vendor_ranking: [] }

  const result = data as RevenueSummary

  // RPC が monthly_trend を返さない古いバージョンの場合、JS 側でフォールバック計算
  if (!result.monthly_trend || result.monthly_trend.length === 0) {
    const [salesRes, costsRes] = await Promise.all([
      supabase()
        .from('sales')
        .select('billing_date, amount')
        .gte('billing_date', fyStartStr)
        .lte('billing_date', fyEndStr),
      supabase()
        .from('costs')
        .select('billing_month, amount')
        .not('project_id', 'is', null)
        .gte('billing_month', fyStartStr)
        .lte('billing_month', fyEndStr),
    ])

    const salesByMonth: Record<string, number> = {}
    for (const row of (salesRes.data ?? [])) {
      const m = (row.billing_date as string).slice(0, 7)
      salesByMonth[m] = (salesByMonth[m] ?? 0) + (row.amount as number)
    }
    const costsByMonth: Record<string, number> = {}
    for (const row of (costsRes.data ?? [])) {
      const m = (row.billing_month as string).slice(0, 7)
      costsByMonth[m] = (costsByMonth[m] ?? 0) + (row.amount as number)
    }

    // fyStart〜fyEnd の全月を生成（文字列比較で確実に範囲内に収める）
    const months: { month: string; sales: number; costs: number }[] = []
    const endKey = fyEndStr.slice(0, 7) // 'YYYY-MM'
    const cur = new Date(Date.UTC(
      parseInt(fyStartStr.slice(0, 4)),
      parseInt(fyStartStr.slice(5, 7)) - 1,
      1
    ))
    for (let i = 0; i < 24; i++) { // 最大24ヶ月でガード
      const y = cur.getUTCFullYear()
      const m = cur.getUTCMonth() + 1
      const key = `${y}-${String(m).padStart(2, '0')}`
      if (key > endKey) break
      months.push({ month: key, sales: salesByMonth[key] ?? 0, costs: costsByMonth[key] ?? 0 })
      cur.setUTCMonth(cur.getUTCMonth() + 1)
    }

    result.monthly_trend = months
  }

  return result
}

export function getRevenueSummary(fyStart: Date, fyEnd: Date): Promise<RevenueSummary> {
  const s = formatDateLocal(fyStart)
  const e = formatDateLocal(fyEnd)
  return unstable_cache(
    () => getRevenueSummaryImpl(s, e),
    ['revenue-summary', s, e],
    { tags: ['revenue'], revalidate: 30 }
  )()
}

export async function getMonthlyRevenue(month: string): Promise<MonthlyRevenue> {
  const end = perfStart('getMonthlyRevenue')
  const { data, error } = await supabase()
    .rpc('get_monthly_revenue', { p_month: month })
  end()
  if (error || !data) return []
  return data as MonthlyRevenue
}

// ==========================================
// Audit Log
// ==========================================

export async function insertAuditLog(
  user: SessionUser,
  action: 'insert' | 'update' | 'delete' | 'restore' | 'hard_delete',
  targetTable: string,
  targetKey: string,
  detail: Record<string, any> = {}
): Promise<void> {
  try {
    await supabase().from('app_audit_log').insert({
      ts: new Date().toISOString(),
      user_id: user.user_id,
      user_name: user.username,
      role: user.role,
      action,
      target_table: targetTable,
      target_key: targetKey,
      detail,
    })
  } catch {
    // ログ失敗はサイレントに無視（メイン処理を止めない）
  }
}

export async function fetchAuditLogs(limit = 200): Promise<AuditLog[]> {
  const { data } = await supabase()
    .from('app_audit_log')
    .select('*')
    .order('ts', { ascending: false })
    .limit(limit)
  return (data ?? []) as AuditLog[]
}

// スタンドアロン用（ダッシュボード以外から呼ぶ場合）
export async function getAlertData() {
  const [salesData, costsData, projectsData] = await Promise.all([
    fetchSales(),
    fetchCosts(),
    fetchProjects(),
  ])
  return computeAlerts(projectsData, salesData, costsData)
}
