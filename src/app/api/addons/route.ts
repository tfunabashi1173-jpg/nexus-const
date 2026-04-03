import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createAddon, insertAuditLog } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import { AddonCreateSchema } from '@/lib/schemas'

export async function POST(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const parsed = AddonCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? '入力値が不正です' }, { status: 422 })
  }
  const { data, error } = await createAddon({ ...parsed.data, addon_id: uuidv4().slice(0, 8) })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await insertAuditLog(user, 'insert', 'addons', data.addon_id)
  return NextResponse.json(data)
}
