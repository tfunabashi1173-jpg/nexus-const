import { createServiceRoleClient } from '@/lib/supabase/server'
import { Project, Partner, Sale, Cost, Addon, User } from '@/types'

const supabase = () => createServiceRoleClient()
const ACTIVE = 'is_deleted.is.null,is_deleted.eq.false'

// ==========================================
// Projects
// ==========================================
export async function fetchProjects(): Promise<Project[]> {
  const { data } = await supabase()
    .from('projects')
    .select('*, users(username)')
    .or(ACTIVE)
    .order('start_date', { ascending: false })
  if (!data) return []
  return data.map((p: any) => ({
    ...p,
    manager_name: p.users?.username ?? p.manager_id,
  }))
}

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
  return { data, error }
}

export async function updateProject(id: string, updates: Partial<Project>) {
  const { data, error } = await supabase()
    .from('projects')
    .update(updates)
    .eq('project_id', id)
    .select()
    .single()
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
  return { error }
}

export async function getNextProjectId(): Promise<string> {
  const prefix = new Date().toISOString().slice(0, 7).replace('-', '')
  const { data } = await supabase()
    .from('projects')
    .select('project_id')
    .like('project_id', `${prefix}%`)
  const nums = (data ?? []).map((r: any) => {
    const n = parseInt(r.project_id.slice(6))
    return isNaN(n) ? 0 : n
  })
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1
  return `${prefix}${String(next).padStart(3, '0')}`
}

// ==========================================
// Partners
// ==========================================
export async function fetchPartners(): Promise<Partner[]> {
  const { data } = await supabase()
    .from('partners')
    .select('*')
    .or(ACTIVE)
    .order('name')
  return data ?? []
}

export async function createPartner(partner: Omit<Partner, 'is_deleted' | 'deleted_at'>) {
  const { data, error } = await supabase().from('partners').insert(partner).select().single()
  return { data, error }
}

export async function updatePartner(id: string, updates: Partial<Partner>) {
  const { data, error } = await supabase()
    .from('partners')
    .update(updates)
    .eq('partner_id', id)
    .select()
    .single()
  return { data, error }
}

export async function softDeletePartner(id: string) {
  const { error } = await supabase()
    .from('partners')
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq('partner_id', id)
  return { error }
}

// ==========================================
// Sales
// ==========================================
export async function fetchSales(): Promise<Sale[]> {
  const { data } = await supabase()
    .from('sales')
    .select('*')
    .or(ACTIVE)
    .order('billing_date', { ascending: false })
  return data ?? []
}

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
  return { data, error }
}

export async function updateSale(id: string, updates: Partial<Sale>) {
  const { data, error } = await supabase()
    .from('sales')
    .update(updates)
    .eq('sales_id', id)
    .select()
    .single()
  return { data, error }
}

export async function softDeleteSale(id: string) {
  const { error } = await supabase()
    .from('sales')
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq('sales_id', id)
  return { error }
}

// ==========================================
// Costs
// ==========================================
export async function fetchCosts(): Promise<Cost[]> {
  const { data } = await supabase()
    .from('costs')
    .select('*')
    .or(ACTIVE)
    .order('billing_month', { ascending: false })
  return data ?? []
}

export async function fetchCostsByProject(projectId: string): Promise<Cost[]> {
  const { data } = await supabase()
    .from('costs')
    .select('*')
    .eq('project_id', projectId)
    .or(ACTIVE)
    .order('billing_month', { ascending: false })
  return data ?? []
}

export async function createCost(cost: Omit<Cost, 'is_deleted' | 'deleted_at'>) {
  const { data, error } = await supabase().from('costs').insert(cost).select().single()
  return { data, error }
}

export async function updateCost(id: string, updates: Partial<Cost>) {
  const { data, error } = await supabase()
    .from('costs')
    .update(updates)
    .eq('cost_id', id)
    .select()
    .single()
  return { data, error }
}

export async function softDeleteCost(id: string) {
  const { error } = await supabase()
    .from('costs')
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq('cost_id', id)
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
  const { data } = await supabase()
    .from('addons')
    .select('*')
    .or(ACTIVE)
  return data ?? []
}

export async function createAddon(addon: Omit<Addon, 'is_deleted' | 'deleted_at'>) {
  const { data, error } = await supabase().from('addons').insert(addon).select().single()
  return { data, error }
}

export async function updateAddon(id: string, updates: Partial<Addon>) {
  const { data, error } = await supabase()
    .from('addons')
    .update(updates)
    .eq('addon_id', id)
    .select()
    .single()
  return { data, error }
}

export async function softDeleteAddon(id: string) {
  const { error } = await supabase()
    .from('addons')
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq('addon_id', id)
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
// System Settings
// ==========================================
export async function getSystemSetting(key: string, defaultValue: string = ''): Promise<string> {
  const { data } = await supabase()
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', key)
    .single()
  return data?.setting_value ?? defaultValue
}

export async function saveSystemSetting(key: string, value: string, description: string = '') {
  const { error } = await supabase()
    .from('system_settings')
    .upsert({ setting_key: key, setting_value: value, description })
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
// Auto Status Update
// ==========================================
export async function autoUpdateStatuses(): Promise<{ updated: boolean; message: string }> {
  const today = new Date().toISOString().split('T')[0]
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

  return { updated: count > 0, message: count > 0 ? `${count}件のステータスを更新しました` : '更新なし' }
}

// ==========================================
// Alert Data
// ==========================================
export async function getAlertData() {
  const today = new Date().toISOString().split('T')[0]

  const [salesData, costsData, projectsData] = await Promise.all([
    fetchSales(),
    fetchCosts(),
    fetchProjects(),
  ])

  const projectIds = new Set(projectsData.map(p => p.project_id))

  // 入金遅延（入金予定日を過ぎた未入金売上）
  const unpaid_sales = salesData.filter(s =>
    !s.deposit_status
  )

  // 現場不明原価（project_idがnullまたは存在しないプロジェクト）
  const orphaned_costs = costsData.filter(c =>
    !c.project_id || !projectIds.has(c.project_id)
  )

  // 原価超過（原価合計 > 売上合計）
  const projectSales = salesData.reduce((acc, s) => {
    acc[s.project_id] = (acc[s.project_id] ?? 0) + s.amount
    return acc
  }, {} as Record<string, number>)

  const projectCosts = costsData.filter(c => c.project_id).reduce((acc, c) => {
    acc[c.project_id!] = (acc[c.project_id!] ?? 0) + c.amount
    return acc
  }, {} as Record<string, number>)

  const unbilled_costs = projectsData
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
