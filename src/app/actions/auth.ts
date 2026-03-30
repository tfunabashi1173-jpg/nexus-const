'use server'

import { createServiceRoleClient } from '@/lib/supabase/server'
import { setSessionCookie, clearSessionCookie } from '@/lib/auth'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'

export async function login(formData: FormData) {
  const userId = formData.get('userId') as string
  const password = formData.get('password') as string

  if (!userId || !password) {
    return { error: 'IDとパスワードを入力してください' }
  }

  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .or('is_deleted.is.null,is_deleted.eq.false')
    .single()

  if (error || !data) {
    return { error: 'IDが見つかりません' }
  }

  let isValid = false
  try {
    isValid = await bcrypt.compare(password, data.password)
  } catch {
    // フォールバック: 平文比較（古いデータ対応）
    isValid = data.password === password
  }

  if (!isValid) {
    return { error: 'パスワードが違います' }
  }

  await setSessionCookie({
    user_id: data.user_id,
    username: data.username,
    role: data.role,
  })

  redirect('/dashboard')
}

export async function logout() {
  await clearSessionCookie()
  redirect('/login')
}
