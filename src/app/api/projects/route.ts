import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createProject } from '@/lib/db'
import { revalidateTag } from 'next/cache'

export async function POST(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { data, error } = await createProject(body)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  revalidateTag('projects', {})
  return NextResponse.json(data)
}
