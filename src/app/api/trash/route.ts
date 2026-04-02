import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { restoreProject, restoreSale, restoreCost, restorePartner, restoreAddon } from '@/lib/db'

export async function POST(req: NextRequest) {
  const user = await getSession()
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { type, id } = await req.json()
  if (!type || !id) {
    return NextResponse.json({ error: 'type と id は必須です' }, { status: 400 })
  }

  let error: any = null
  if (type === 'project') ({ error } = await restoreProject(id))
  else if (type === 'sale') ({ error } = await restoreSale(id))
  else if (type === 'cost') ({ error } = await restoreCost(id))
  else if (type === 'partner') ({ error } = await restorePartner(id))
  else if (type === 'addon') ({ error } = await restoreAddon(id))
  else return NextResponse.json({ error: '不明なtype' }, { status: 400 })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
