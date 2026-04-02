import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { softDeletePartner, updatePartner, insertAuditLog } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession()
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const body = await req.json()
  const { error } = await updatePartner(id, body)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await insertAuditLog(user, 'update', 'partners', id)
  return NextResponse.json({ success: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession()
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const { error } = await softDeletePartner(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await insertAuditLog(user, 'delete', 'partners', id)
  return NextResponse.json({ success: true })
}
