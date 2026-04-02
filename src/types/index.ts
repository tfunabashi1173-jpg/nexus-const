// ==========================================
// データベース型定義
// ==========================================

export interface Project {
  project_id: string
  site_name: string
  status: '受注' | '着工中' | '完工' | '入金済'
  contract_amount: number
  scheduled_deposit_date: string | null
  manager_id: string
  customer_id: string
  site_address: string | null
  customer_contact: string | null
  building_structure: string | null
  start_date: string | null
  end_date: string | null
  is_deleted: boolean | null
  deleted_at: string | null
  manager_name?: string
}

export interface Partner {
  partner_id: string
  name: string
  category: '得意先' | '協力業者' | '仕入先' | '経費'
  safety_fee_rate: number | null
  default_tax_type: '税抜' | '税込' | '免税'
  closing_day: number | null
  payment_cycle: number | null
  payment_day: number | null
  is_deleted: boolean | null
  deleted_at: string | null
}

export interface Sale {
  sales_id: string
  project_id: string
  billing_date: string
  remarks: string | null
  amount: number
  deposit_status: boolean
  deposit_date: string | null
  is_deleted: boolean | null
  deleted_at: string | null
}

export type TaxType = '税抜' | '税込' | '免税'

export interface Cost {
  cost_id: string
  project_id: string | null
  vendor_id: string
  billing_month: string
  amount: number
  tax_type: TaxType
  file_path: string | null
  is_deleted: boolean | null
  deleted_at: string | null
}

export interface ProjectSubManager {
  id: string
  project_id: string
  manager_id: string
  start_date: string
  end_date: string | null
  username?: string
}

export interface Addon {
  addon_id: string
  project_id: string
  request_date: string
  description: string | null
  amount: number
  is_deleted: boolean | null
  deleted_at: string | null
}

export interface User {
  user_id: string
  password: string
  username: string
  role: 'admin' | 'user'
  is_deleted: boolean | null
  deleted_at: string | null
}

export interface SystemSetting {
  setting_key: string
  setting_value: string
  description: string | null
}

// ==========================================
// セッション型
// ==========================================

export interface SessionUser {
  user_id: string
  username: string
  role: 'admin' | 'user'
}

// ==========================================
// 監査ログ
// ==========================================

export interface AuditLog {
  id: number
  ts: string | null
  ts_jst: string | null
  user_id: string | null
  user_name: string | null
  role: string | null
  action: string
  target_table: string
  target_key: string | null
  detail: Record<string, any>
}

// ==========================================
// アラート型
// ==========================================

export interface AlertData {
  unpaid_sales: Sale[]
  unbilled_costs: Cost[]
  orphaned_costs: Cost[]
}

// ==========================================
// ダッシュボード集計型（Supabase RPC用）
// ==========================================

export interface DashboardSummary {
  kpi: {
    total_sales: number
    total_costs: number
  }
  staff_ranking: {
    manager_id: string
    name: string
    sales: number
    profit: number
  }[]
  customer_ranking: {
    id: string
    amount: number
  }[]
  vendor_ranking: {
    id: string
    amount: number
  }[]
  alerts: {
    unpaid_sales: number
    orphaned_costs: number
    unbilled_costs: number
  }
}

// ==========================================
// 収支ページ集計型（Supabase RPC用）
// ==========================================

export interface RevenueSummary {
  annual: {
    project_id: string
    site_name: string
    contract: number
    sales: number
    costs: number
    profit: number
  }[]
  monthly_trend: {
    month: string
    sales: number
    costs: number
  }[]
  vendor_ranking: {
    id: string
    name: string
    amount: number
  }[]
}

export type MonthlyRevenue = {
  project_id: string
  site_name: string
  sales: number
  costs: number
  profit: number
}[]

// ==========================================
// OCR結果型
// ==========================================

export interface InvoiceDetail {
  site_name: string
  description: string
  amount: number
}

export interface InvoiceResult {
  company: string
  date: string
  details: InvoiceDetail[]
}
