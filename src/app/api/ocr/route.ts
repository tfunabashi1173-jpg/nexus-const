import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function POST(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const form = await req.formData()
    const file = form.get('file') as File
    if (!file) return NextResponse.json({ error: 'ファイルがありません' }, { status: 400 })

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Gemini APIキーが未設定です' }, { status: 500 })

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const base64 = fileBuffer.toString('base64')

    const prompt = `
あなたは建設業の経理担当です。アップロードされた請求書画像を解析し、以下のデータをJSON形式で出力してください。

【抽出ルール】
1. **company**: 請求元の会社名。
2. **date**: 請求日 (YYYY-MM-DD)。不明なら今日。
3. **details**: 請求明細のリスト。全ての行を抽出すること。
   - **site_name**: 現場名・工事名。明記がない行は直前の行の現場名を引き継ぐ。どうしても不明な場合は "(不明)" としてください。
   - **description**: 摘要、品名、工事内容。
   - **amount**: 金額(税抜)の数値。

【注意】
- 消費税行、合計行は除外してください。
- 値引き行（▲）はマイナス金額として抽出してください。
- 複数ページある場合も全て抽出してください。
- 出力はJSONのみ。マークダウンの\`\`\`は不要。

出力例:
{
  "company": "株式会社〇〇建材",
  "date": "2025-10-31",
  "details": [
    {"site_name": "A邸 改修工事", "description": "木材一式", "amount": 50000},
    {"site_name": "Bビル 新築工事", "description": "常用人工", "amount": 30000}
  ]
}
`

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 30000)
    )

    const result = await Promise.race([
      model.generateContent([
        { inlineData: { mimeType: file.type, data: base64 } },
        prompt,
      ]),
      timeoutPromise,
    ])

    const text = result.response.text()
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim()
    const data = JSON.parse(jsonStr)

    return NextResponse.json(data)
  } catch (e: any) {
    if (e.message === 'TIMEOUT') {
      return NextResponse.json({ error: 'OCR処理がタイムアウトしました（30秒）' }, { status: 504 })
    }
    return NextResponse.json({ error: `解析エラー: ${e.message}` }, { status: 500 })
  }
}
