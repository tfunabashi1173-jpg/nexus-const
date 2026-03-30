import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { createSession } from '@/lib/auth'
import bcrypt from 'bcryptjs'

// テスト用認証エンドポイント（本番では削除またはガード）
// パスワード不要でDBのユーザー情報からセッションを発行する（開発環境専用）
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  const { userId } = await req.json()

  if (!userId) {
    return NextResponse.json({ error: 'userId が必要です' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .or('is_deleted.is.null,is_deleted.eq.false')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'IDが見つかりません' }, { status: 401 })
  }

  const token = await createSession({
    user_id: data.user_id,
    username: data.username,
    role: data.role,
  })

  const res = NextResponse.json({ ok: true, user_id: data.user_id })
  res.cookies.set('nexus_session', token, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
  return res
}
