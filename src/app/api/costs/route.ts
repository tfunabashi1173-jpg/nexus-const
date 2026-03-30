import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createCost, updateCost, softDeleteCost, uploadEvidence } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import sharp from 'sharp'

export async function POST(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contentType = req.headers.get('content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    // ファイルアップロードを含む場合
    const form = await req.formData()
    const file = form.get('file') as File | null
    const projectId = form.get('project_id') as string
    const vendorId = form.get('vendor_id') as string
    const billingMonth = form.get('billing_month') as string
    const amount = parseInt(form.get('amount') as string)
    const targetDate = form.get('target_date') as string | null

    let filePath: string | null = null

    if (file) {
      let buffer: Buffer = Buffer.from(await file.arrayBuffer()) as Buffer
      let contentType = file.type

      // 画像ならSharpで圧縮
      if (file.type.startsWith('image/')) {
        try {
          const resized = await sharp(buffer as Buffer)
            .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 70 })
            .toBuffer()
          buffer = resized as Buffer
          contentType = 'image/jpeg'
        } catch {}
      }

      filePath = await uploadEvidence(buffer, file.name, contentType, targetDate ?? billingMonth)
    }

    const { data, error } = await createCost({
      cost_id: uuidv4().slice(0, 8),
      project_id: projectId || null,
      vendor_id: vendorId,
      billing_month: billingMonth,
      amount,
      file_path: filePath,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  } else {
    // JSONのみ
    const body = await req.json()
    const { data, error } = await createCost({ ...body, cost_id: uuidv4().slice(0, 8) })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  }
}

export async function PATCH(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, ...updates } = await req.json()
  const { data, error } = await updateCost(id, updates)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  const { error } = await softDeleteCost(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
