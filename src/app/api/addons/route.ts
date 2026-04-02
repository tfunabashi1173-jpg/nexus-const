import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createAddon, insertAuditLog } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

export async function POST(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { data, error } = await createAddon({ ...body, addon_id: uuidv4().slice(0, 8) })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await insertAuditLog(user, 'insert', 'addons', data.addon_id)
  return NextResponse.json(data)
}
