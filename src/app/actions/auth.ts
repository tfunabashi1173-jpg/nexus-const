'use server'

import { createServiceRoleClient } from '@/lib/supabase/server'
import { setSessionCookie, clearSessionCookie } from '@/lib/auth'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'

export async function login(formData: FormData) {
  const userId = formData.get('userId') as string
  const password = formData.get('password') as string
  const rememberMe = formData.get('rememberMe') === 'on'

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

  const isHashed = data.password.startsWith('$2')
  let isValid = false

  if (isHashed) {
    isValid = await bcrypt.compare(password, data.password)
  } else {
    // 平文パスワードの場合: 照合後にハッシュ化して移行
    isValid = data.password === password
    if (isValid) {
      const hashed = await bcrypt.hash(password, 10)
      await supabase.from('users').update({ password: hashed }).eq('user_id', userId)
    }
  }

  if (!isValid) {
    return { error: 'パスワードが違います' }
  }

  await setSessionCookie({
    user_id: data.user_id,
    username: data.username,
    role: data.role,
  }, rememberMe)

  redirect('/dashboard')
}

export async function logout() {
  await clearSessionCookie()
  redirect('/login')
}
