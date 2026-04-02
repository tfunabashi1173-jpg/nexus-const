'use client'

import { useActionState } from 'react'
import { login } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Lock, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'

const initialState = { error: '', userId: '' }

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [state, formAction, isPending] = useActionState(
    async (_: typeof initialState, formData: FormData) => {
      const userId = formData.get('userId') as string
      const result = await login(formData)
      return result ? { ...result, userId } : initialState
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
                key={state.userId}
                id="userId"
                name="userId"
                placeholder="IDを入力"
                required
                autoFocus
                defaultValue={state.userId}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">パスワード</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="パスワードを入力"
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
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
