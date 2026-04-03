import { z } from 'zod'

const nullableStr = z.string().nullable().optional().transform(v => v ?? null)

export const ProjectCreateSchema = z.object({
  project_id: z.string().min(1),
  site_name: z.string().min(1, '現場名は必須です'),
  status: z.enum(['受注', '着工中', '完工']).default('受注'),
  contract_amount: z.number().positive('請負金額は正の値を入力してください'),
  manager_id: z.string().min(1, '担当者は必須です'),
  customer_id: z.string().min(1, '得意先は必須です'),
  site_address: nullableStr,
  customer_contact: nullableStr,
  building_structure: z.string().nullable().optional().transform(v => v ?? null),
  start_date: nullableStr,
  end_date: nullableStr,
  scheduled_deposit_date: nullableStr,
})

export const ProjectUpdateSchema = z.object({
  site_name: z.string().min(1).optional(),
  status: z.enum(['受注', '着工中', '完工']).optional(),
  contract_amount: z.number().positive().optional(),
  manager_id: z.string().optional(),
  customer_id: z.string().optional(),
  site_address: z.string().nullable().optional(),
  customer_contact: z.string().nullable().optional(),
  building_structure: z.string().optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  scheduled_deposit_date: z.string().nullable().optional(),
}).passthrough()

export const SaleCreateSchema = z.object({
  project_id: z.string().min(1, '現場は必須です'),
  billing_date: z.string().min(1, '請求日は必須です'),
  amount: z.number().positive('金額は正の値を入力してください'),
  remarks: nullableStr,
  deposit_status: z.boolean().default(false),
  deposit_date: nullableStr,
})

export const SaleUpdateSchema = z.object({
  id: z.string().min(1),
  billing_date: z.string().optional(),
  amount: z.number().positive().optional(),
  remarks: z.string().nullable().optional(),
  deposit_status: z.boolean().optional(),
  deposit_date: z.string().nullable().optional(),
}).passthrough()

export const SaleDeleteSchema = z.object({
  id: z.string().min(1),
})

export const CostCreateSchema = z.object({
  vendor_id: z.string().min(1, '業者は必須です'),
  billing_month: z.string().min(1, '請求月は必須です'),
  amount: z.number().positive('金額は正の値を入力してください'),
  project_id: nullableStr,
  tax_type: z.enum(['税抜', '税込', '免税']).default('税抜'),
  file_path: nullableStr,
})

export const CostUpdateSchema = z.object({
  id: z.string().min(1),
  vendor_id: z.string().optional(),
  billing_month: z.string().optional(),
  amount: z.number().positive().optional(),
  project_id: z.string().nullable().optional(),
  tax_type: z.enum(['税抜', '税込', '免税']).optional(),
}).passthrough()

export const CostDeleteSchema = z.object({
  id: z.string().min(1),
})

export const AddonCreateSchema = z.object({
  project_id: z.string().min(1, '工事IDは必須です'),
  request_date: z.string().min(1, '依頼日は必須です'),
  description: nullableStr,
  amount: z.number().nonnegative(),
})
