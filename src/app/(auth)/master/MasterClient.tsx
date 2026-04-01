'use client'

import { useState, useTransition } from 'react'
import { User, Partner } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Trash2, Plus } from 'lucide-react'

interface Props {
  users: User[]
  partners: Partner[]
  fiscalStartMonth: string
  safetyFeeRate: string
}

const PARTNER_CATEGORIES = ['得意先', '協力会社', '仕入先', '経費'] as const

export function MasterClient({ users, partners, fiscalStartMonth, safetyFeeRate }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // ユーザー追加フォーム
  const [newUserId, setNewUserId] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user')

  // 取引先追加フォーム
  const [newPartnerName, setNewPartnerName] = useState('')
  const [newPartnerCategory, setNewPartnerCategory] = useState<string>('得意先')
  const [newClosingDay, setNewClosingDay] = useState('')
  const [newPaymentCycle, setNewPaymentCycle] = useState('')
  const [newPaymentDay, setNewPaymentDay] = useState('')

  // システム設定
  const [fiscalMonth, setFiscalMonth] = useState(fiscalStartMonth)
  const [safetyRate, setSafetyRate] = useState(safetyFeeRate)

  function addUser() {
    if (!newUserId || !newUsername || !newPassword) {
      toast.error('ID・名前・パスワードを入力してください')
      return
    }
    startTransition(async () => {
      const res = await fetch('/api/master/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: newUserId, username: newUsername, password: newPassword, role: newRole }),
      })
      if (res.ok) {
        toast.success('ユーザーを登録しました')
        setNewUserId(''); setNewUsername(''); setNewPassword(''); setNewRole('user')
        router.refresh()
      } else {
        const { error } = await res.json()
        toast.error(`エラー: ${error}`)
      }
    })
  }

  function deleteUser(id: string) {
    startTransition(async () => {
      const res = await fetch(`/api/master/users/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('削除しました')
        router.refresh()
      } else {
        toast.error('削除に失敗しました')
      }
    })
  }

  function addPartner() {
    if (!newPartnerName) { toast.error('名称を入力してください'); return }
    startTransition(async () => {
      const res = await fetch('/api/master/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPartnerName,
          category: newPartnerCategory,
          closing_day: newClosingDay ? parseInt(newClosingDay) : null,
          payment_cycle: newPaymentCycle ? parseInt(newPaymentCycle) : null,
          payment_day: newPaymentDay ? parseInt(newPaymentDay) : null,
        }),
      })
      if (res.ok) {
        toast.success('取引先を登録しました')
        setNewPartnerName(''); setNewClosingDay(''); setNewPaymentCycle(''); setNewPaymentDay('')
        router.refresh()
      } else {
        const { error } = await res.json()
        toast.error(`エラー: ${error}`)
      }
    })
  }

  function deletePartner(id: string) {
    startTransition(async () => {
      const res = await fetch(`/api/master/partners/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('削除しました')
        router.refresh()
      } else {
        toast.error('削除に失敗しました')
      }
    })
  }

  function saveSettings() {
    startTransition(async () => {
      const res = await fetch('/api/master/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fiscalStartMonth: fiscalMonth, safetyFeeRate: safetyRate }),
      })
      if (res.ok) {
        toast.success('設定を保存しました')
      } else {
        toast.error('保存に失敗しました')
      }
    })
  }

  const partnersByCategory = (cat: string) => partners.filter(p => p.category === cat)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">⚙️ マスタ管理</h1>

      <Tabs defaultValue="users">
        <TabsList className="flex-wrap">
          <TabsTrigger value="users">👥 ユーザー</TabsTrigger>
          {PARTNER_CATEGORIES.map(cat => (
            <TabsTrigger key={cat} value={cat}>{cat}</TabsTrigger>
          ))}
          <TabsTrigger value="settings">🔧 システム設定</TabsTrigger>
        </TabsList>

        {/* ユーザー管理 */}
        <TabsContent value="users">
          <Card>
            <CardContent className="pt-4 space-y-4">
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      <th className="text-left py-2.5 px-3 font-medium">ID</th>
                      <th className="text-left py-2.5 px-3 font-medium">名前</th>
                      <th className="text-left py-2.5 px-3 font-medium">権限</th>
                      <th className="py-2.5 px-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u, i) => (
                      <tr key={u.user_id} className={`border-b last:border-0 ${i % 2 === 1 ? 'bg-slate-50' : 'bg-white'}`}>
                        <td className="py-2 pr-3 font-mono text-xs">{u.user_id}</td>
                        <td className="py-2 pr-3">{u.username}</td>
                        <td className="py-2 pr-3">
                          <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>{u.role}</Badge>
                        </td>
                        <td className="py-2 text-right">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteUser(u.user_id)} disabled={isPending}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t pt-4">
                <p className="font-medium text-sm mb-3 flex items-center gap-1.5"><Plus className="h-4 w-4" />新規ユーザー登録</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">ユーザーID</Label>
                    <Input value={newUserId} onChange={e => setNewUserId(e.target.value)} placeholder="user01" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">名前</Label>
                    <Input value={newUsername} onChange={e => setNewUsername(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">パスワード</Label>
                    <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">権限</Label>
                    <Select value={newRole} onValueChange={(v: any) => setNewRole(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">user</SelectItem>
                        <SelectItem value="admin">admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={addUser} disabled={isPending} className="mt-3" size="sm">登録</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 取引先カテゴリタブ */}
        {PARTNER_CATEGORIES.map(cat => (
          <TabsContent key={cat} value={cat}>
            <Card>
              <CardContent className="pt-4 space-y-4">
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-800 text-white">
                        <th className="text-left py-2.5 px-3 font-medium">名称</th>
                        {cat === '得意先' && <>
                          <th className="text-center py-2.5 px-3 font-medium">締日</th>
                          <th className="text-center py-2.5 px-3 font-medium">入金月</th>
                          <th className="text-center py-2.5 px-3 font-medium">入金日</th>
                        </>}
                        <th className="py-2.5 px-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {partnersByCategory(cat).map((p, i) => (
                        <tr key={p.partner_id} className={`border-b last:border-0 ${i % 2 === 1 ? 'bg-slate-50' : 'bg-white'}`}>
                          <td className="py-2 pr-3">{p.name}</td>
                          {cat === '得意先' && <>
                            <td className="py-2 pr-3 text-center">{p.closing_day === 99 ? '末日' : p.closing_day}</td>
                            <td className="py-2 pr-3 text-center">{p.payment_cycle}ヶ月後</td>
                            <td className="py-2 pr-3 text-center">{p.payment_day === 99 ? '末日' : p.payment_day}日</td>
                          </>}
                          <td className="py-2 text-right">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deletePartner(p.partner_id)} disabled={isPending}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {partnersByCategory(cat).length === 0 && (
                        <tr><td colSpan={5} className="py-4 text-center text-muted-foreground text-sm">データなし</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="border-t pt-4">
                  <p className="font-medium text-sm mb-3 flex items-center gap-1.5"><Plus className="h-4 w-4" />{cat}を追加</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5 md:col-span-2">
                      <Label className="text-xs">名称</Label>
                      <Input value={newPartnerName} onChange={e => setNewPartnerName(e.target.value)} />
                    </div>
                    {cat === '得意先' && <>
                      <div className="space-y-1.5">
                        <Label className="text-xs">締日（99=末日）</Label>
                        <Input type="number" value={newClosingDay} onChange={e => setNewClosingDay(e.target.value)} placeholder="99" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">入金月数（例: 翌月=1）</Label>
                        <Input type="number" value={newPaymentCycle} onChange={e => setNewPaymentCycle(e.target.value)} placeholder="1" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">入金日（99=末日）</Label>
                        <Input type="number" value={newPaymentDay} onChange={e => setNewPaymentDay(e.target.value)} placeholder="99" />
                      </div>
                    </>}
                  </div>
                  <Button
                    onClick={() => { setNewPartnerCategory(cat); addPartner() }}
                    disabled={isPending}
                    className="mt-3"
                    size="sm"
                  >登録</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}

        {/* システム設定 */}
        <TabsContent value="settings">
          <Card>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-sm">
                <div className="space-y-1.5">
                  <Label>期首月（会計年度開始月）</Label>
                  <Select value={fiscalMonth} onValueChange={(v) => setFiscalMonth(v ?? "")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                        <SelectItem key={m} value={String(m)}>{m}月</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>安全協力会費率（%）</Label>
                  <Input type="number" step="0.1" value={safetyRate} onChange={e => setSafetyRate(e.target.value)} />
                </div>
              </div>
              <Button onClick={saveSettings} disabled={isPending}>保存</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
