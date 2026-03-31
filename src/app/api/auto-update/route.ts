import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { autoUpdateStatuses } from '@/lib/db'
import { revalidateTag } from 'next/cache'

export async function POST() {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await autoUpdateStatuses()
  if (result.updated) revalidateTag('projects', {})
  return NextResponse.json(result)
}
