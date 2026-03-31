import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { softDeletePartner } from '@/lib/db'
import { revalidateTag } from 'next/cache'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession()
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const { error } = await softDeletePartner(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  revalidateTag('partners', {})
  return NextResponse.json({ success: true })
}
