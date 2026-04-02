'use client'

import { useActionState } from 'react'
import { login } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Lock } from 'lucide-react'

const initialState = { error: '' }

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(
    async (_: typeof initialState, formData: FormData) => {
      const result = await login(formData)
      return result ?? initialState
    },
    initialState
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl">NEXUS工事管理システム</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="userId">ユーザーID</Label>
              <Input
                id="userId"
                name="userId"
                placeholder="IDを入力"
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">パスワード</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="パスワードを入力"
                required
              />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="rememberMe" name="rememberMe" className="h-4 w-4 rounded border-input accent-primary" />
              <label htmlFor="rememberMe" className="text-sm text-muted-foreground select-none cursor-pointer">
                ログイン状態を保持する（30日間）
              </label>
            </div>
            {state?.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? 'ログイン中...' : 'ログイン'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
