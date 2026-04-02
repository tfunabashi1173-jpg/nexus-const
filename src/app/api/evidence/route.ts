import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getEvidenceSignedUrl } from '@/lib/db'

export async function GET(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const path = req.nextUrl.searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'path is required' }, { status: 400 })

  const url = await getEvidenceSignedUrl(path)
  if (!url) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.redirect(url)
}
