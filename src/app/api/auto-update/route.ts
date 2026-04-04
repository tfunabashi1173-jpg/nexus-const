import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { autoUpdateStatuses } from '@/lib/db'
import { revalidateTag } from 'next/cache'

export async function POST() {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await autoUpdateStatuses()
  // ステータス変更の有無に関わらず常にキャッシュをクリア
  // （DB一時障害後に空リストがキャッシュされた場合の手動回復手段として機能させる）
  revalidateTag('projects', {})
  revalidateTag('dashboard', {})
  revalidateTag('revenue', {})
  return NextResponse.json(result)
}
