import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createUser, insertAuditLog } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const user = await getSession()
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const hashedPassword = await bcrypt.hash(body.password, 10)
  const { data, error } = await createUser({
    user_id: body.user_id,
    username: body.username,
    password: hashedPassword,
    role: body.role,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await insertAuditLog(user, 'insert', 'users', body.user_id, { username: body.username })
  return NextResponse.json(data)
}
