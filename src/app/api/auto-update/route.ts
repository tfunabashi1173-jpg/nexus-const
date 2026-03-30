import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { autoUpdateStatuses } from '@/lib/db'

export async function POST() {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await autoUpdateStatuses()
  return NextResponse.json(result)
}
