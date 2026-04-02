import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import JSZip from 'jszip'

const BUCKET = 'evidence'

/** 指定年月のファイル一覧取得 */
export async function GET(req: NextRequest) {
  const user = await getSession()
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const year = searchParams.get('year')
  const month = searchParams.get('month')?.padStart(2, '0')
  const download = searchParams.get('download') === '1'

  if (!year || !month) return NextResponse.json({ error: 'year/month が必要です' }, { status: 400 })

  const prefix = `${year}/${month}`
  const supabase = createServiceRoleClient()

  const { data: files, error } = await supabase.storage.from(BUCKET).list(prefix)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!files || files.length === 0) {
    if (download) return NextResponse.json({ error: 'ファイルがありません' }, { status: 404 })
    return NextResponse.json({ files: [], count: 0 })
  }

  if (!download) {
    const paths = files.map(f => `${prefix}/${f.name}`)
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600)
    const result = files.map((f, i) => ({
      name: f.name,
      path: paths[i],
      signedUrl: signed?.[i]?.signedUrl ?? null,
    }))
    return NextResponse.json({ files: result, count: files.length })
  }

  // ZIP を作成して返す
  const zip = new JSZip()
  await Promise.all(
    files.map(async (file) => {
      const path = `${prefix}/${file.name}`
      const { data, error: dlErr } = await supabase.storage.from(BUCKET).download(path)
      if (!dlErr && data) {
        const buf = Buffer.from(await data.arrayBuffer())
        zip.file(file.name, buf)
      }
    })
  )

  const zipBuffer = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })

  return new NextResponse(zipBuffer.buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="evidence_${year}${month}.zip"`,
    },
  })
}

/** 指定年月のファイルを全削除 */
export async function DELETE(req: NextRequest) {
  const user = await getSession()
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { year, month: rawMonth } = await req.json()
  const month = String(rawMonth).padStart(2, '0')
  if (!year || !rawMonth) return NextResponse.json({ error: 'year/month が必要です' }, { status: 400 })

  const prefix = `${year}/${month}`
  const supabase = createServiceRoleClient()

  const { data: files, error: listErr } = await supabase.storage.from(BUCKET).list(prefix)
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 })
  if (!files || files.length === 0) return NextResponse.json({ deleted: 0 })

  const paths = files.map(f => `${prefix}/${f.name}`)
  const { error } = await supabase.storage.from(BUCKET).remove(paths)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ deleted: paths.length })
}
