import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createSubManager, deleteSubManager } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: project_id } = await params
  const { manager_id, start_date, end_date } = await req.json()

  if (!manager_id || !start_date) {
    return NextResponse.json({ error: 'manager_id と start_date は必須です' }, { status: 400 })
  }

  const { data, error } = await createSubManager({
    id: uuidv4().slice(0, 8),
    project_id,
    manager_id,
    start_date,
    end_date: end_date || null,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  const { error } = await deleteSubManager(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
