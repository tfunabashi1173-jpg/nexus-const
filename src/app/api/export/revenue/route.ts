import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import * as XLSX from 'xlsx'

export async function POST(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { fiscalYear, data } = await req.json()

  const rows = data.map((r: any, i: number) => ({
    '#': i + 1,
    '現場名': r.site_name,
    '売上': r.sales,
    '原価': r.costs,
    '粗利': r.profit,
    '粗利率': r.sales > 0 ? Math.round((r.profit / r.sales) * 100) + '%' : '-',
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, `${fiscalYear}年度収支`)

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="revenue_${fiscalYear}.xlsx"`,
    },
  })
}
