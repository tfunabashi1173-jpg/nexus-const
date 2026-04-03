import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createProject, insertAuditLog } from '@/lib/db'
import { revalidateTag } from 'next/cache'
import { ProjectCreateSchema } from '@/lib/schemas'

export async function POST(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = ProjectCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? '入力値が不正です' }, { status: 422 })
  }
  const { data, error } = await createProject(parsed.data)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  revalidateTag('projects', {})
  await insertAuditLog(user, 'insert', 'projects', data.project_id, { site_name: data.site_name })
  return NextResponse.json(data)
}
