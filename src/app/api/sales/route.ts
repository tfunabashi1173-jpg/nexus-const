import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createSale, updateSale, softDeleteSale, insertAuditLog } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import { SaleCreateSchema, SaleUpdateSchema, SaleDeleteSchema } from '@/lib/schemas'

export async function POST(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const parsed = SaleCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? '入力値が不正です' }, { status: 422 })
  }
  const { data, error } = await createSale({ ...parsed.data, sales_id: uuidv4().slice(0, 8) })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await insertAuditLog(user, 'insert', 'sales', data.sales_id)
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const parsed = SaleUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? '入力値が不正です' }, { status: 422 })
  }
  const { id, ...updates } = parsed.data
  const { data, error } = await updateSale(id, updates)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await insertAuditLog(user, 'update', 'sales', id)
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const parsed = SaleDeleteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: '削除対象IDが不正です' }, { status: 422 })
  }
  const { id } = parsed.data
  const { error } = await softDeleteSale(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await insertAuditLog(user, 'delete', 'sales', id)
  return NextResponse.json({ success: true })
}
