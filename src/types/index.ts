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
  category: '得意先' | '協力会社' | '仕入先' | '経費'
  safety_fee_rate: number | null
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

export interface Cost {
  cost_id: string
  project_id: string | null
  vendor_id: string
  billing_month: string
  amount: number
  file_path: string | null
  is_deleted: boolean | null
  deleted_at: string | null
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
