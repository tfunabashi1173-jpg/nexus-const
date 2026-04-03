'use client'

import { useState, useTransition, useRef } from 'react'
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
import { Trash2, Plus, Pencil, Check, X, Download, Search, Eye, EyeOff } from 'lucide-react'
import { formatDateLocal } from '@/lib/utils/date'

interface Props {
  users: User[]
  partners: Partner[]
  fiscalStartMonth: string
  safetyFeeRate: string
  geminiModel: string
}

const PARTNER_CATEGORIES = ['得意先', '協力業者', '仕入先', '経費'] as const

export function MasterClient({ users, partners, fiscalStartMonth, safetyFeeRate, geminiModel }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // ユーザー追加フォーム
  const [newUserId, setNewUserId] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user')

  // ユーザー編集
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editUsername, setEditUsername] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [editRole, setEditRole] = useState<'admin' | 'user'>('user')
  const [showEditPw, setShowEditPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)

  // ユーザー全編集モード
  type BulkUserRow = { username: string; password: string; role: string }
  const [bulkEditUsers, setBulkEditUsers] = useState(false)
  const [bulkUserEdits, setBulkUserEdits] = useState<Record<string, BulkUserRow>>({})
  const [bulkUserSaving, setBulkUserSaving] = useState(false)
  const [showBulkPw, setShowBulkPw] = useState(false)

  function startBulkEditUsers() {
    const init: Record<string, BulkUserRow> = {}
    users.forEach(u => { init[u.user_id] = { username: u.username, password: '', role: u.role } })
    setBulkUserEdits(init)
    setBulkEditUsers(true)
    setEditingId(null)
  }

  function cancelBulkEditUsers() {
    setBulkEditUsers(false)
    setBulkUserEdits({})
    setShowBulkPw(false)
  }

  function setBulkUserField(id: string, field: keyof BulkUserRow, value: string) {
    setBulkUserEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }

  async function saveAllBulkUsers() {
    const changed = users.filter(u => {
      const e = bulkUserEdits[u.user_id]
      if (!e) return false
      return e.username !== u.username || e.password !== '' || e.role !== u.role
    })
    if (changed.length === 0) { toast('変更はありません'); cancelBulkEditUsers(); return }

    setBulkUserSaving(true)
    const payload = changed.map(u => {
      const e = bulkUserEdits[u.user_id]
      const item: Record<string, string> = { id: u.user_id }
      if (e.username !== u.username) item.username = e.username
      if (e.password) item.password = e.password
      if (e.role !== u.role) item.role = e.role
      return item
    })
    const res = await fetch('/api/master/users/batch', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const result = res.ok ? await res.json() : null
    const failed = result?.failed ?? changed.length
    setBulkUserSaving(false)
    if (failed === 0) {
      toast.success(`${changed.length}件を更新しました`)
      cancelBulkEditUsers()
      router.refresh()
    } else {
      toast.error(`${failed}件の更新に失敗しました`)
    }
  }

  function startEdit(u: User) {
    setEditingId(u.user_id)
    setEditUsername(u.username)
    setEditPassword('')
    setEditRole(u.role)
  }

  function cancelEdit() {
    setEditingId(null)
  }

  function saveEdit(id: string) {
    startTransition(async () => {
      const body: Record<string, string> = {}
      if (editUsername) body.username = editUsername
      if (editPassword) body.password = editPassword
      if (editRole) body.role = editRole
      const res = await fetch(`/api/master/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        toast.success('更新しました')
        setEditingId(null)
        router.refresh()
      } else {
        const { error } = await res.json()
        toast.error(`エラー: ${error}`)
      }
    })
  }

  // 取引先編集
  const [editingPartnerId, setEditingPartnerId] = useState<string | null>(null)
  const [editPartnerName, setEditPartnerName] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editDefaultTaxType, setEditDefaultTaxType] = useState('')
  const [editClosingDay, setEditClosingDay] = useState('')
  const [editPaymentCycle, setEditPaymentCycle] = useState('')
  const [editPaymentDay, setEditPaymentDay] = useState('')
  const [editSafetyMember, setEditSafetyMember] = useState(false)

  const SAFETY_CATS = ['協力業者', '仕入先']
  const CHANGEABLE_CATS = ['協力業者', '仕入先', '経費']

  function startEditPartner(p: Partner) {
    setEditingPartnerId(p.partner_id)
    setEditPartnerName(p.name)
    setEditCategory(p.category)
    setEditDefaultTaxType(p.default_tax_type ?? '税抜')
    setEditClosingDay(p.closing_day != null ? String(p.closing_day) : '')
    setEditPaymentCycle(p.payment_cycle != null ? String(p.payment_cycle) : '')
    setEditPaymentDay(p.payment_day != null ? String(p.payment_day) : '')
    setEditSafetyMember((p.safety_fee_rate ?? 0) > 0)
  }

  function saveEditPartner(id: string) {
    startTransition(async () => {
      const body: Record<string, any> = { name: editPartnerName, category: editCategory }
      if (editCategory !== '得意先') {
        body.default_tax_type = editDefaultTaxType
      } else {
        if (editClosingDay) body.closing_day = parseInt(editClosingDay)
        if (editPaymentCycle) body.payment_cycle = parseInt(editPaymentCycle)
        if (editPaymentDay) body.payment_day = parseInt(editPaymentDay)
      }
      if (SAFETY_CATS.includes(editCategory)) {
        body.safety_fee_rate = editSafetyMember ? 1 : null
      } else {
        body.safety_fee_rate = null
      }
      const res = await fetch(`/api/master/partners/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        toast.success('更新しました')
        setEditingPartnerId(null)
        router.refresh()
      } else {
        const { error } = await res.json()
        toast.error(`エラー: ${error}`)
      }
    })
  }

  // 取引先追加フォーム
  const [newPartnerName, setNewPartnerName] = useState('')
  const [newPartnerCategory, setNewPartnerCategory] = useState<string>('得意先')
  const [newDefaultTaxType, setNewDefaultTaxType] = useState<string>('税抜')
  const [newClosingDay, setNewClosingDay] = useState('99')
  const [newPaymentCycle, setNewPaymentCycle] = useState('1')
  const [newPaymentDay, setNewPaymentDay] = useState('99')
  const [newSafetyMember, setNewSafetyMember] = useState(false)

  // 証憑管理
  const now = new Date()
  const [evidenceYear, setEvidenceYear] = useState(now.getFullYear())
  const [evidenceMonth, setEvidenceMonth] = useState(now.getMonth() + 1)
  const [evidenceFiles, setEvidenceFiles] = useState<{ name: string; path: string; signedUrl: string | null }[]>([])
  const [evidenceSearched, setEvidenceSearched] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDownloadingZip, setIsDownloadingZip] = useState(false)
  const [previewFile, setPreviewFile] = useState<{ name: string; signedUrl: string } | null>(null)

  function isImageFile(name: string) {
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(name)
  }

  async function searchEvidence() {
    const m = String(evidenceMonth).padStart(2, '0')
    const res = await fetch(`/api/admin/evidence?year=${evidenceYear}&month=${m}`)
    const json = await res.json()
    setEvidenceFiles(json.files ?? [])
    setEvidenceSearched(true)
    setShowDeleteConfirm(false)
    setPreviewFile(null)
  }

  async function downloadEvidenceZip() {
    setIsDownloadingZip(true)
    try {
      const m = String(evidenceMonth).padStart(2, '0')
      const res = await fetch(`/api/admin/evidence?year=${evidenceYear}&month=${m}&download=1`)
      if (!res.ok) { toast.error('ダウンロードに失敗しました'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `evidence_${evidenceYear}${m}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setIsDownloadingZip(false)
    }
  }

  async function deleteAllEvidence() {
    const res = await fetch('/api/admin/evidence', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year: evidenceYear, month: evidenceMonth }),
    })
    if (res.ok) {
      const { deleted } = await res.json()
      toast.success(`${deleted}件削除しました`)
      setEvidenceFiles([])
      setShowDeleteConfirm(false)
    } else {
      toast.error('削除に失敗しました')
    }
  }

  // バックアップ インポート
  const importFileRef = useRef<HTMLInputElement>(null)
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null)

  async function importBackup() {
    const file = importFileRef.current?.files?.[0]
    if (!file) { toast.error('ファイルを選択してください'); return }
    startTransition(async () => {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/admin/backup', { method: 'POST', body: form })
      const json = await res.json()
      if (res.ok) {
        const details = (json.results as any[]).map((r: any) => `${r.sheet}: ${r.count}件`).join('、')
        setImportResult({ success: true, message: `インポート完了（合計${json.total}件）: ${details}` })
        if (json.errors?.length) toast.error(`一部エラー: ${json.errors.join(', ')}`)
        else toast.success('インポートが完了しました')
        router.refresh()
      } else {
        setImportResult({ success: false, message: `エラー: ${json.error}` })
        toast.error('インポートに失敗しました')
      }
    })
  }

  async function downloadBackup() {
    const res = await fetch('/api/admin/backup')
    if (!res.ok) { toast.error('バックアップ作成に失敗しました'); return }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const today = formatDateLocal(new Date())
    a.download = `nexus_backup_${today}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  // システム設定
  const [fiscalMonth, setFiscalMonth] = useState(fiscalStartMonth)
  const [safetyRate, setSafetyRate] = useState(safetyFeeRate)
  const [geminiModelValue, setGeminiModelValue] = useState(geminiModel)

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
          default_tax_type: newDefaultTaxType,
          closing_day: newClosingDay ? parseInt(newClosingDay) : null,
          payment_cycle: newPaymentCycle ? parseInt(newPaymentCycle) : null,
          payment_day: newPaymentDay ? parseInt(newPaymentDay) : null,
          safety_fee_rate: SAFETY_CATS.includes(newPartnerCategory) && newSafetyMember ? 1 : null,
        }),
      })
      if (res.ok) {
        toast.success('取引先を登録しました')
        setNewPartnerName(''); setNewDefaultTaxType('税抜'); setNewClosingDay(''); setNewPaymentCycle(''); setNewPaymentDay('')
        setNewSafetyMember(false)
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
        body: JSON.stringify({ fiscalStartMonth: fiscalMonth, safetyFeeRate: safetyRate, geminiModel: geminiModelValue }),
      })
      if (res.ok) {
        toast.success('設定を保存しました')
      } else {
        toast.error('保存に失敗しました')
      }
    })
  }

  const partnersByCategory = (cat: string) => partners.filter(p => p.category === cat)

  // 全編集モード
  type BulkRow = { name: string; category: string; defaultTaxType: string; safetyMember: boolean }
  const [bulkEditCat, setBulkEditCat] = useState<string | null>(null)
  const [bulkEdits, setBulkEdits] = useState<Record<string, BulkRow>>({})
  const [bulkSaving, setBulkSaving] = useState(false)

  function startBulkEdit(cat: string) {
    const init: Record<string, BulkRow> = {}
    partnersByCategory(cat).forEach(p => {
      init[p.partner_id] = {
        name: p.name,
        category: p.category,
        defaultTaxType: p.default_tax_type ?? '税抜',
        safetyMember: (p.safety_fee_rate ?? 0) > 0,
      }
    })
    setBulkEdits(init)
    setBulkEditCat(cat)
    setEditingPartnerId(null)
  }

  function cancelBulkEdit() {
    setBulkEditCat(null)
    setBulkEdits({})
  }

  function setBulkField(id: string, field: keyof BulkRow, value: string | boolean) {
    setBulkEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }

  async function saveAllBulk(cat: string) {
    const rows = partnersByCategory(cat)
    const changed = rows.filter(p => {
      const e = bulkEdits[p.partner_id]
      if (!e) return false
      return (
        e.name !== p.name ||
        e.category !== p.category ||
        e.defaultTaxType !== (p.default_tax_type ?? '税抜') ||
        e.safetyMember !== ((p.safety_fee_rate ?? 0) > 0)
      )
    })
    if (changed.length === 0) { toast('変更はありません'); cancelBulkEdit(); return }

    setBulkSaving(true)
    let failed = 0
    await Promise.all(changed.map(async p => {
      const e = bulkEdits[p.partner_id]
      const body: Record<string, any> = { name: e.name, category: e.category, default_tax_type: e.defaultTaxType }
      if (SAFETY_CATS.includes(e.category)) {
        body.safety_fee_rate = e.safetyMember ? 1 : null
      } else {
        body.safety_fee_rate = null
      }
      const res = await fetch(`/api/master/partners/${p.partner_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) failed++
    }))
    setBulkSaving(false)
    if (failed === 0) {
      toast.success(`${changed.length}件を更新しました`)
      cancelBulkEdit()
      router.refresh()
    } else {
      toast.error(`${failed}件の更新に失敗しました`)
    }
  }

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
          <TabsTrigger value="evidence">🗂️ 証憑管理</TabsTrigger>
          <TabsTrigger value="backup">💾 バックアップ</TabsTrigger>
        </TabsList>

        {/* ユーザー管理 */}
        <TabsContent value="users">
          <Card>
            <CardContent className="pt-4 space-y-4">
              {/* 全編集スイッチ */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">{users.length}件</span>
                {bulkEditUsers ? (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => setShowBulkPw(v => !v)}
                      className="h-7 gap-1 text-xs text-slate-500"
                    >
                      {showBulkPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      {showBulkPw ? 'PW非表示' : 'PW表示'}
                    </Button>
                    <Button size="sm" onClick={saveAllBulkUsers} disabled={bulkUserSaving}>
                      {bulkUserSaving ? '保存中...' : '全て保存'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelBulkEditUsers} disabled={bulkUserSaving}>キャンセル</Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={startBulkEditUsers} disabled={!!editingId}>
                    まとめて編集
                  </Button>
                )}
              </div>
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-800 text-white sticky top-0 z-10">
                      <th className="text-left py-2.5 px-3 font-medium">ID</th>
                      <th className="text-left py-2.5 px-3 font-medium">名前</th>
                      <th className="text-left py-2.5 px-3 font-medium">パスワード</th>
                      <th className="text-left py-2.5 px-3 font-medium">権限</th>
                      <th className="py-2.5 px-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u, i) => (
                      <tr key={u.user_id} className={`border-b last:border-0 ${i % 2 === 1 ? 'bg-slate-50' : 'bg-white'}`}>
                        <td className="py-2 px-3 font-mono text-xs">{u.user_id}</td>
                        {bulkEditUsers ? (
                          /* 全編集モード行 */
                          <>
                            <td className="py-1.5 px-3">
                              <Input
                                value={bulkUserEdits[u.user_id]?.username ?? u.username}
                                onChange={e => setBulkUserField(u.user_id, 'username', e.target.value)}
                                className="h-7 text-sm w-32"
                              />
                            </td>
                            <td className="py-1.5 px-3">
                              <Input
                                type={showBulkPw ? 'text' : 'password'}
                                value={bulkUserEdits[u.user_id]?.password ?? ''}
                                onChange={e => setBulkUserField(u.user_id, 'password', e.target.value)}
                                placeholder="変更する場合のみ"
                                className="h-7 text-sm w-40"
                              />
                            </td>
                            <td className="py-1.5 px-3">
                              <Select
                                value={bulkUserEdits[u.user_id]?.role ?? u.role}
                                onValueChange={v => setBulkUserField(u.user_id, 'role', v ?? u.role)}
                              >
                                <SelectTrigger className="h-7 text-sm w-24"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="user">user</SelectItem>
                                  <SelectItem value="admin">admin</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="py-1.5 px-3"></td>
                          </>
                        ) : editingId === u.user_id ? (
                          /* 個別編集モード行 */
                          <>
                            <td className="py-1.5 px-3">
                              <Input value={editUsername} onChange={e => setEditUsername(e.target.value)} className="h-7 text-sm w-32" />
                            </td>
                            <td className="py-1.5 px-3">
                              <div className="flex items-center gap-1">
                                <Input
                                  type={showEditPw ? 'text' : 'password'}
                                  value={editPassword}
                                  onChange={e => setEditPassword(e.target.value)}
                                  placeholder="変更する場合のみ"
                                  className="h-7 text-sm w-36"
                                />
                                <button
                                  type="button"
                                  className="text-slate-400 hover:text-slate-700"
                                  onClick={() => setShowEditPw(v => !v)}
                                >
                                  {showEditPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                </button>
                              </div>
                            </td>
                            <td className="py-1.5 px-3">
                              <Select value={editRole} onValueChange={(v: any) => setEditRole(v)}>
                                <SelectTrigger className="h-7 text-sm w-24"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="user">user</SelectItem>
                                  <SelectItem value="admin">admin</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="py-1.5 px-3 text-right whitespace-nowrap">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600" onClick={() => saveEdit(u.user_id)} disabled={isPending}>
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { cancelEdit(); setShowEditPw(false) }} disabled={isPending}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </>
                        ) : (
                          /* 表示モード行 */
                          <>
                            <td className="py-2 px-3">{u.username}</td>
                            <td className="py-2 px-3 text-slate-400 text-xs">••••••••</td>
                            <td className="py-2 px-3">
                              <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>{u.role}</Badge>
                            </td>
                            <td className="py-2 px-3 text-right whitespace-nowrap">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500" onClick={() => { startEdit(u); setShowEditPw(false) }} disabled={isPending}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteUser(u.user_id)} disabled={isPending}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </>
                        )}
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
                    <div className="flex items-center gap-1">
                      <Input type={showNewPw ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                      <button type="button" className="text-slate-400 hover:text-slate-700" onClick={() => setShowNewPw(v => !v)}>
                        {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
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
                {/* 全編集スイッチ */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">{partnersByCategory(cat).length}件</span>
                  {bulkEditCat === cat ? (
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={() => saveAllBulk(cat)} disabled={bulkSaving}>
                        {bulkSaving ? '保存中...' : '全て保存'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelBulkEdit} disabled={bulkSaving}>キャンセル</Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => startBulkEdit(cat)} disabled={!!editingPartnerId}>
                      まとめて編集
                    </Button>
                  )}
                </div>
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-800 text-white sticky top-0 z-10">
                        <th className="text-left py-2.5 px-3 font-medium">名称</th>
                        {cat === '得意先' && <>
                          <th className="text-center py-2.5 px-3 font-medium">締日</th>
                          <th className="text-center py-2.5 px-3 font-medium">入金月</th>
                          <th className="text-center py-2.5 px-3 font-medium">入金日</th>
                        </>}
                        {cat !== '得意先' && (
                          <th className="text-center py-2.5 px-3 font-medium">税区分</th>
                        )}
                        {SAFETY_CATS.includes(cat) && (
                          <th className="text-center py-2.5 px-3 font-medium">安全協力会費</th>
                        )}
                        <th className="py-2.5 px-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {partnersByCategory(cat).map((p, i) => (
                        <tr key={p.partner_id} className={`border-b last:border-0 ${i % 2 === 1 ? 'bg-slate-50' : 'bg-white'}`}>
                          {bulkEditCat === cat ? (
                            /* 全編集モード行 */
                            <>
                              <td className="py-1.5 px-3">
                                <div className="flex items-center gap-1.5">
                                  <Input
                                    value={bulkEdits[p.partner_id]?.name ?? p.name}
                                    onChange={e => setBulkField(p.partner_id, 'name', e.target.value)}
                                    className="h-7 text-sm w-36"
                                  />
                                  {CHANGEABLE_CATS.includes(cat) && (
                                    <Select
                                      value={bulkEdits[p.partner_id]?.category ?? cat}
                                      onValueChange={v => setBulkField(p.partner_id, 'category', v ?? cat)}
                                    >
                                      <SelectTrigger className="h-7 text-sm w-28"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        {CHANGEABLE_CATS.map(c => (
                                          <SelectItem key={c} value={c}>{c}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  )}
                                </div>
                              </td>
                              {cat !== '得意先' && (
                                <td className="py-1.5 px-3">
                                  <Select
                                    value={bulkEdits[p.partner_id]?.defaultTaxType ?? '税抜'}
                                    onValueChange={v => setBulkField(p.partner_id, 'defaultTaxType', v ?? '税抜')}
                                  >
                                    <SelectTrigger className="h-7 text-sm w-24"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="税抜">税抜</SelectItem>
                                      <SelectItem value="税込">税込</SelectItem>
                                      <SelectItem value="免税">免税</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </td>
                              )}
                              {SAFETY_CATS.includes(cat) && (
                                <td className="py-1.5 px-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={bulkEdits[p.partner_id]?.safetyMember ?? false}
                                    onChange={e => setBulkField(p.partner_id, 'safetyMember', e.target.checked)}
                                    className="h-4 w-4 accent-primary"
                                  />
                                </td>
                              )}
                              <td className="py-1.5 px-3"></td>
                            </>
                          ) : editingPartnerId === p.partner_id ? (
                            <>
                              <td className="py-1.5 px-3">
                                <div className="flex items-center gap-1.5">
                                  <Input value={editPartnerName} onChange={e => setEditPartnerName(e.target.value)} className="h-7 text-sm w-36" />
                                  {CHANGEABLE_CATS.includes(cat) && (
                                    <Select value={editCategory} onValueChange={v => setEditCategory(v ?? cat)}>
                                      <SelectTrigger className="h-7 text-sm w-28"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        {CHANGEABLE_CATS.map(c => (
                                          <SelectItem key={c} value={c}>{c}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  )}
                                </div>
                              </td>
                              {cat === '得意先' ? (
                                <>
                                  <td className="py-1.5 px-3">
                                    <Input type="number" value={editClosingDay} onChange={e => setEditClosingDay(e.target.value)} className="h-7 text-sm w-20" />
                                  </td>
                                  <td className="py-1.5 px-3">
                                    <Input type="number" value={editPaymentCycle} onChange={e => setEditPaymentCycle(e.target.value)} className="h-7 text-sm w-20" />
                                  </td>
                                  <td className="py-1.5 px-3">
                                    <Input type="number" value={editPaymentDay} onChange={e => setEditPaymentDay(e.target.value)} className="h-7 text-sm w-20" />
                                  </td>
                                </>
                              ) : (
                                <td className="py-1.5 px-3">
                                  <Select value={editDefaultTaxType} onValueChange={v => setEditDefaultTaxType(v ?? '税抜')}>
                                    <SelectTrigger className="h-7 text-sm w-28"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="税抜">税抜</SelectItem>
                                      <SelectItem value="税込">税込</SelectItem>
                                      <SelectItem value="免税">免税</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </td>
                              )}
                              {SAFETY_CATS.includes(cat) && (
                                <td className="py-1.5 px-3 text-center">
                                  <input type="checkbox" checked={editSafetyMember} onChange={e => setEditSafetyMember(e.target.checked)} className="h-4 w-4 accent-primary" />
                                </td>
                              )}
                              <td className="py-1.5 px-3 text-right whitespace-nowrap">
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600" onClick={() => saveEditPartner(p.partner_id)} disabled={isPending}>
                                  <Check className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingPartnerId(null)} disabled={isPending}>
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="py-2 px-3">{p.name}</td>
                              {cat === '得意先' && <>
                                <td className="py-2 px-3 text-center">{p.closing_day === 99 ? '末日' : p.closing_day}</td>
                                <td className="py-2 px-3 text-center">{p.payment_cycle}ヶ月後</td>
                                <td className="py-2 px-3 text-center">{p.payment_day === 99 ? '末日' : p.payment_day}日</td>
                              </>}
                              {cat !== '得意先' && (
                                <td className="py-2 px-3 text-center">
                                  <Badge variant={p.default_tax_type === '免税' ? 'outline' : p.default_tax_type === '税込' ? 'secondary' : 'default'} className="text-xs">
                                    {p.default_tax_type ?? '税抜'}
                                  </Badge>
                                </td>
                              )}
                              {SAFETY_CATS.includes(cat) && (
                                <td className="py-2 px-3 text-center text-sm">
                                  {(p.safety_fee_rate ?? 0) > 0 ? '○' : '—'}
                                </td>
                              )}
                              <td className="py-2 px-3 text-right whitespace-nowrap">
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500" onClick={() => startEditPartner(p)} disabled={isPending}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deletePartner(p.partner_id)} disabled={isPending}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </td>
                            </>
                          )}
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
                    {cat !== '得意先' && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">デフォルト税区分</Label>
                        <Select value={newDefaultTaxType} onValueChange={v => setNewDefaultTaxType(v ?? '税抜')}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="税抜">税抜（別途消費税）</SelectItem>
                            <SelectItem value="税込">税込（内税）</SelectItem>
                            <SelectItem value="免税">免税（インボイス未登録）</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
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
                    {SAFETY_CATS.includes(cat) && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">安全協力会費</Label>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={newSafetyMember} onChange={e => setNewSafetyMember(e.target.checked)} className="h-4 w-4 accent-primary" />
                          <span className="text-sm">参加</span>
                        </div>
                      </div>
                    )}
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
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Gemini モデル（AI-OCR）</Label>
                  <Input value={geminiModelValue} onChange={e => setGeminiModelValue(e.target.value)} placeholder="gemini-3.1-flash-lite-preview" />
                </div>
              </div>
              <Button onClick={saveSettings} disabled={isPending}>保存</Button>
            </CardContent>
          </Card>
        </TabsContent>
        {/* 証憑管理 */}
        <TabsContent value="evidence">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">画像データ（証憑）の管理</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">対象年</Label>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => setEvidenceYear(v => v - 1)}>−</Button>
                    <span className="w-16 text-center text-sm font-medium">{evidenceYear}</span>
                    <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => setEvidenceYear(v => v + 1)}>+</Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">対象月</Label>
                  <Select value={String(evidenceMonth)} onValueChange={v => setEvidenceMonth(Number(v))}>
                    <SelectTrigger className="w-24 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                        <SelectItem key={m} value={String(m)}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button size="sm" onClick={searchEvidence} className="bg-red-600 hover:bg-red-700">
                  <Search className="h-3.5 w-3.5 mr-1" />
                  対象ファイルを検索
                </Button>
              </div>

              {evidenceSearched && (
                <div className="space-y-3">
                  <div className="bg-yellow-50 border border-yellow-200 rounded px-4 py-3 text-sm text-yellow-800">
                    {evidenceFiles.length > 0
                      ? `⚠ ${evidenceFiles.length}個のファイルが見つかりました。`
                      : 'ファイルが見つかりませんでした。'}
                  </div>

                  {evidenceFiles.length > 0 && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={downloadEvidenceZip}
                        disabled={isDownloadingZip}
                      >
                        <Download className="h-3.5 w-3.5 mr-1" />
                        {isDownloadingZip ? 'ダウンロード中...' : `まとめてZIPで保存（${evidenceFiles.length}ファイル）`}
                      </Button>

                      {/* ファイル一覧 */}
                      <div className="border rounded overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-800 text-white sticky top-0 z-10">
                              <th className="text-left py-2 px-3 font-medium">ファイル名</th>
                              <th className="py-2 px-3 w-32"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {evidenceFiles.map((f, i) => (
                              <tr key={f.path} className={`border-b last:border-0 ${i % 2 === 1 ? 'bg-slate-50' : 'bg-white'}`}>
                                <td className="py-2 px-3 text-slate-700 truncate max-w-0" title={f.name}>
                                  {isImageFile(f.name) && (
                                    <button
                                      className="text-blue-600 hover:underline mr-2"
                                      onClick={() => f.signedUrl && setPreviewFile({ name: f.name, signedUrl: f.signedUrl! })}
                                    >
                                      {f.name}
                                    </button>
                                  )}
                                  {!isImageFile(f.name) && <span>{f.name}</span>}
                                </td>
                                <td className="py-2 px-3 text-right">
                                  {f.signedUrl && (
                                    <a
                                      href={f.signedUrl}
                                      download={f.name}
                                      className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-blue-600"
                                    >
                                      <Download className="h-3.5 w-3.5" />
                                      DL
                                    </a>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* 画像プレビューモーダル */}
                      {previewFile && (
                        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setPreviewFile(null)}>
                          <div className="bg-white rounded-lg max-w-3xl max-h-[90vh] overflow-auto p-4 space-y-2" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium truncate">{previewFile.name}</span>
                              <div className="flex items-center gap-2 ml-4">
                                <a href={previewFile.signedUrl} download={previewFile.name} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                                  <Download className="h-3.5 w-3.5" />ダウンロード
                                </a>
                                <button className="text-slate-500 hover:text-slate-800 text-lg leading-none" onClick={() => setPreviewFile(null)}>×</button>
                              </div>
                            </div>
                            <img src={previewFile.signedUrl} alt={previewFile.name} className="max-w-full rounded" />
                          </div>
                        </div>
                      )}

                      <div className="pt-2 border-t">
                        {!showDeleteConfirm ? (
                          <button
                            className="text-sm text-slate-500 hover:text-red-600 flex items-center gap-1 transition-colors"
                            onClick={() => setShowDeleteConfirm(true)}
                          >
                            <span>›</span>
                            <Trash2 className="h-3.5 w-3.5" />
                            ファイルを全て削除する
                          </button>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-sm text-red-600 font-medium">
                              {evidenceYear}年{evidenceMonth}月の証憑{evidenceFiles.length}件を完全削除します。この操作は取り消せません。
                            </p>
                            <div className="flex gap-2">
                              <Button size="sm" variant="destructive" onClick={deleteAllEvidence}>
                                削除する
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                                キャンセル
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* バックアップ＆復元 */}
        <TabsContent value="backup">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">バックアップ＆復元</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="export">
                <TabsList>
                  <TabsTrigger value="export">エクスポート</TabsTrigger>
                  <TabsTrigger value="import">インポート</TabsTrigger>
                </TabsList>
                <TabsContent value="export" className="space-y-3 pt-3">
                  <div className="bg-blue-50 border border-blue-200 rounded px-4 py-3 text-sm text-blue-800">
                    全データをExcelでダウンロードします（工事台帳・取引先・原価明細・売上明細・追加工事・ユーザー）
                  </div>
                  <Button size="sm" onClick={downloadBackup}>
                    <Download className="h-3.5 w-3.5 mr-1" />
                    バックアップ作成
                  </Button>
                </TabsContent>
                <TabsContent value="import" className="space-y-3 pt-3">
                  <div className="bg-red-50 border border-red-200 rounded px-4 py-3 text-sm text-red-800 space-y-1">
                    <p className="font-medium">⚠ 注意</p>
                    <p>バックアップExcelを読み込み、既存データにupsert（上書き追加）します。</p>
                    <p>パスワードもハッシュ値のまま復元されます。削除済みデータは復元されません。</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Excelファイル（.xlsx）を選択</Label>
                    <input
                      type="file"
                      accept=".xlsx"
                      ref={importFileRef}
                      className="block text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-input file:bg-background file:text-sm file:cursor-pointer"
                    />
                  </div>
                  <Button size="sm" onClick={importBackup} disabled={isPending}>
                    インポート実行
                  </Button>
                  {importResult && (
                    <div className={`rounded px-4 py-3 text-sm ${importResult.success ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
                      {importResult.message}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  )
}
