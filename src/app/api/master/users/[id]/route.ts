import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { softDeleteUser, updateUser, insertAuditLog } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession()
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { username, password, role } = await req.json()

  const updates: Record<string, any> = {}
  if (username) updates.username = username
  if (role) updates.role = role
  if (password) updates.password = await bcrypt.hash(password, 10)

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: '更新内容がありません' }, { status: 400 })
  }

  const { error } = await updateUser(id, updates)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await insertAuditLog(user, 'update', 'users', id)
  return NextResponse.json({ success: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession()
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const { error } = await softDeleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await insertAuditLog(user, 'delete', 'users', id)
  return NextResponse.json({ success: true })
}
