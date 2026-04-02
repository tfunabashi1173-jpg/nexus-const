import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'
import { formatDateLocal } from '@/lib/utils/date'

const supabase = () => createServiceRoleClient()

// エクスポート時のシート名 → テーブル名・主キー
const SHEET_MAP: Record<string, { table: string; pk: string }> = {
  '工事台帳':       { table: 'projects',        pk: 'project_id' },
  '取引先マスタ':   { table: 'partners',         pk: 'partner_id' },
  '原価明細':       { table: 'costs',            pk: 'cost_id'    },
  '売上明細':       { table: 'sales',            pk: 'sales_id'   },
  '追加工事履歴':   { table: 'addons',           pk: 'addon_id'   },
  'ユーザー':       { table: 'users',            pk: 'user_id'    },
  // Streamlit版シート名にも対応
  'projects':       { table: 'projects',        pk: 'project_id' },
  'partners':       { table: 'partners',         pk: 'partner_id' },
  'costs':          { table: 'costs',            pk: 'cost_id'    },
  'sales':          { table: 'sales',            pk: 'sales_id'   },
  'addons':         { table: 'addons',           pk: 'addon_id'   },
  'users':          { table: 'users',            pk: 'user_id'    },
  'system_settings':{ table: 'system_settings',  pk: 'setting_key'},
}

// インポートの処理順（外部キー依存）
const IMPORT_ORDER = ['ユーザー', 'users', '取引先マスタ', 'partners', 'system_settings',
  '工事台帳', 'projects', '追加工事履歴', 'addons', '売上明細', 'sales', '原価明細', 'costs']

async function fetchAll(table: string) {
  const { data } = await supabase().from(table).select('*').order('created_at', { ascending: false })
  return data ?? []
}

/** エクスポート */
export async function GET(req: NextRequest) {
  const user = await getSession()
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [projects, partners, costs, sales, addons, users] = await Promise.all([
    fetchAll('projects'),
    fetchAll('partners'),
    fetchAll('costs'),
    fetchAll('sales'),
    fetchAll('addons'),
    fetchAll('users'),
  ])

  const wb = XLSX.utils.book_new()

  const addSheet = (name: string, data: any[]) => {
    const ws = data.length > 0 ? XLSX.utils.json_to_sheet(data) : XLSX.utils.aoa_to_sheet([[]])
    XLSX.utils.book_append_sheet(wb, ws, name)
  }

  addSheet('工事台帳', projects)
  addSheet('取引先マスタ', partners)
  addSheet('原価明細', costs)
  addSheet('売上明細', sales)
  addSheet('追加工事履歴', addons)
  addSheet('ユーザー', users)

  const buf: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const today = formatDateLocal(new Date())

  return new NextResponse(buf.buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="nexus_backup_${today}.xlsx"`,
    },
  })
}

/** インポート（upsert） */
export async function POST(req: NextRequest) {
  const user = await getSession()
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'ファイルが必要です' }, { status: 400 })

  const buf = Buffer.from(await file.arrayBuffer())
  const wb = XLSX.read(buf, { type: 'buffer' })

  const results: { sheet: string; table: string; count: number }[] = []
  const errors: string[] = []

  // インポート順に従って処理
  const sheetNames = IMPORT_ORDER.filter(name => wb.SheetNames.includes(name))
  // IMPORT_ORDER にない未知のシートも末尾で処理
  for (const name of wb.SheetNames) {
    if (!sheetNames.includes(name)) sheetNames.push(name)
  }

  for (const sheetName of sheetNames) {
    const info = SHEET_MAP[sheetName]
    if (!info) continue

    const ws = wb.Sheets[sheetName]
    const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: null })
    if (rows.length === 0) continue

    const cleaned = rows.map((row: any) =>
      Object.fromEntries(
        Object.entries(row).map(([k, v]) => [k, v === undefined ? null : v])
      )
    )

    const { error } = await supabase()
      .from(info.table)
      .upsert(cleaned, { onConflict: info.pk })

    if (error) {
      errors.push(`${sheetName}: ${error.message}`)
    } else {
      results.push({ sheet: sheetName, table: info.table, count: cleaned.length })
    }
  }

  if (results.length === 0 && errors.length > 0) {
    return NextResponse.json({ error: errors.join('\n') }, { status: 400 })
  }

  const totalCount = results.reduce((s, r) => s + r.count, 0)
  return NextResponse.json({ success: true, total: totalCount, results, errors })
}
