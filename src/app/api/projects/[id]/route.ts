import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { updateProject, softDeleteProject, insertAuditLog } from '@/lib/db'
import { revalidateTag } from 'next/cache'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { data, error } = await updateProject(id, body)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  revalidateTag('projects', {})
  await insertAuditLog(user, 'update', 'projects', id)
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { error } = await softDeleteProject(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  revalidateTag('projects', {})
  await insertAuditLog(user, 'delete', 'projects', id)
  return NextResponse.json({ success: true })
}
