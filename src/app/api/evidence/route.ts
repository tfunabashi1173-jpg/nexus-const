import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getEvidenceSignedUrl } from '@/lib/db'

export async function GET(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const path = req.nextUrl.searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'path is required' }, { status: 400 })

  let url: string | null = null
  try {
    url = await getEvidenceSignedUrl(path)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create signed URL'
    const isNotFound = /not found|object.*not/i.test(message)
    return NextResponse.json(
      { error: isNotFound ? 'Not found' : message },
      { status: isNotFound ? 404 : 500 },
    )
  }
  if (!url) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // ?json=1 の場合はURLをJSONで返す（img srcに直接使用するため）
  if (req.nextUrl.searchParams.get('json') === '1') {
    return NextResponse.json({ signedUrl: url })
  }

  return NextResponse.redirect(url)
}
