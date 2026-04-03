import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { updateUser, insertAuditLog } from '@/lib/db'
import bcrypt from 'bcryptjs'

interface BatchUpdateItem {
  id: string
  username?: string
  password?: string
  role?: string
}

export async function PATCH(req: NextRequest) {
  const user = await getSession()
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const items: BatchUpdateItem[] = await req.json()
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: '更新内容がありません' }, { status: 400 })
  }

  const results = await Promise.all(items.map(async ({ id, username, password, role }) => {
    const updates: Record<string, any> = {}
    if (username) updates.username = username
    if (role) updates.role = role
    if (password) updates.password = await bcrypt.hash(password, 10)

    if (Object.keys(updates).length === 0) return { id, success: true }

    const { error } = await updateUser(id, updates)
    if (error) return { id, success: false, error: error.message }
    await insertAuditLog(user, 'update', 'users', id)
    return { id, success: true }
  }))

  const failed = results.filter(r => !r.success)
  return NextResponse.json({ results, failed: failed.length })
}
