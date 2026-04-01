import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const PUBLIC_PATHS = ['/login']
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-change-in-production'
)

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p))

  const token = request.cookies.get('nexus_session')?.value

  if (!token) {
    if (isPublic) return NextResponse.next()
    return NextResponse.redirect(new URL('/login', request.url))
  }

  let user: { user_id: string; username: string; role: string } | null = null
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    user = { user_id: payload.user_id as string, username: payload.username as string, role: payload.role as string }
  } catch { user = null }

  if (!user) {
    if (isPublic) return NextResponse.next()
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete('nexus_session')
    return response
  }

  // 管理者限定ページのガード
  if (pathname.startsWith('/master') && user.role !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (isPublic) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
