import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createPartner, insertAuditLog } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import { revalidateTag } from 'next/cache'

export async function POST(req: NextRequest) {
  const user = await getSession()
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json()
  const { data, error } = await createPartner({ ...body, partner_id: uuidv4().slice(0, 8) })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  revalidateTag('partners', {})
  await insertAuditLog(user, 'insert', 'partners', data.partner_id, { name: data.name })
  return NextResponse.json(data)
}
