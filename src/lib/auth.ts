import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { SessionUser } from '@/types'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-change-in-production'
)
const COOKIE_NAME = 'nexus_session'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30日

export async function createSession(user: SessionUser): Promise<string> {
  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(JWT_SECRET)
  return token
}

export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return {
      user_id: payload.user_id as string,
      username: payload.username as string,
      role: payload.role as 'admin' | 'user',
    }
  } catch {
    return null
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifySession(token)
}

export async function setSessionCookie(user: SessionUser, rememberMe = false) {
  const token = await createSession(user)
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    ...(rememberMe ? { maxAge: COOKIE_MAX_AGE } : {}),
    path: '/',
  })
}

export async function clearSessionCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}
