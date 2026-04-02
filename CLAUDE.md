# NEXUS - 建設業向け工事管理アプリ

## プロジェクト概要

建設会社向けの工事・原価・収支管理 Web アプリケーション。

## 技術スタック

| 項目 | 内容 |
|------|------|
| Framework | Next.js 16.2.1 (App Router) |
| Runtime | React 19.2.4 |
| Language | TypeScript |
| DB / BaaS | Supabase (PostgreSQL 14+) |
| UI | shadcn/ui + Tailwind CSS |
| Charts | Recharts |
| Auth | JWT (jose) / カスタム実装 |
| Middleware | `src/proxy.ts`（Next.js 16 では `middleware.ts` → `proxy.ts`） |
| Font | システムフォント `font-sans`（Google Fonts は削除済み・コンパイルハング対策） |

## 主要ページ構成

| パス | 機能 |
|------|------|
| `/dashboard` | 経営状況（KPI・ランキング・アラート） |
| `/projects` | 工事一覧 |
| `/projects/new` | 工事新規登録 |
| `/projects/[id]` | 工事詳細（原価ピボット・追加工事・請求） |
| `/costs` | 原価一覧・入力（手動 / AI-OCR） |
| `/sales` | 売上・入金管理 |
| `/revenue` | 収支一覧・分析（月別推移グラフ） |
| `/master` | マスタ管理（ユーザー・取引先・システム設定） |

## 重要な実装メモ

### タイムゾーンバグ（JST 環境）

**`toISOString().split('T')[0]` を絶対に使わない。**

`new Date(year, month, day)` はローカル時刻で作成されるが、`toISOString()` は UTC 変換するため、
JST(UTC+9) 環境では `April 1 JST → 2025-03-31T15:00Z` となり日付が1日ズレる。

→ 必ず `formatDateLocal(date)` を使う（`src/lib/utils/date.ts` に定義）

```ts
// NG
date.toISOString().split('T')[0]

// OK
formatDateLocal(date)  // from '@/lib/utils/date'
```

影響箇所: `db.ts` の RPC 呼び出し、`RevenueClient.tsx`・`DashboardClient.tsx` のフェッチ、`NewProjectClient.tsx` の入金予定日表示

### Edge Runtime (proxy.ts)

`src/proxy.ts` は Edge Runtime で動作するため `next/headers` を import できない。
JWT 検証は `jose` を使ってインライン実装済み（`@/lib/auth` を import しないこと）。

### Recharts hidden tab 問題

Shadcn `Tabs` は全 TabsContent を DOM に保持するため、非アクティブタブの `ResponsiveContainer` が width=0 でレンダリングされる。
→ `key={activeTab}` をグラフの `ResponsiveContainer` に付与してタブ切替時に remount することで解決済み。

### Supabase RPC

| 関数名 | 用途 |
|--------|------|
| `get_revenue_summary(p_fy_start, p_fy_end)` | 収支サマリー（annual / monthly_trend / vendor_ranking） |
| `get_monthly_revenue(p_month)` | 月次収支 |
| `get_dashboard_summary(p_fy_start, p_fy_end)` | ダッシュボード集計 |

SQL ファイル: `supabase/migrations/`（変更後は Supabase ダッシュボードで手動適用が必要）

`monthly_trend` は `generate_series` で全月を生成し LEFT JOIN。
デプロイ済み関数が古い場合のフォールバックとして `db.ts` 内で PostgREST から直接集計する処理も実装済み。

### 会計年度計算

```ts
getFiscalYear(date, fiscalStartMonth)  // → FY番号（期首月以降ならその年、未満なら前年）
getFiscalYearRange(fy, fiscalStartMonth)  // → { start: Date, end: Date }
```

`fiscalStartMonth` はシステム設定 `FISCAL_START_MONTH` から取得（デフォルト 4 月）。
→ `page.tsx` でデータが空の場合は前年度にフォールバックする処理あり（`revenue/page.tsx`）。

### 法人格の正規化

`normalizeCompanyName(name)` を `src/lib/utils/text.ts` に実装。
業者名・取引先名の表示には必ず使用する（株式会社・有限会社等を省略）。

### 金額入力

コンマ区切り入力には `AmountInput` コンポーネント（`src/components/ui/amount-input.tsx`）を使用。
`value` / `onChange` はカンマなしの数値文字列。

## UI ガイドライン

- テーブルヘッダー: `bg-slate-800 text-white`
- ストライプ行: `i % 2 === 1 ? 'bg-slate-50' : 'bg-white'`
- ホバー: `hover:bg-blue-50`
- サイドバー: `bg-slate-900`、アクティブ: `bg-blue-600 text-white`
- ページタイトル: `text-2xl font-bold text-slate-900`

## 復元ポイント

UI 変更前のコミット: `fb76a3c`

```
git checkout fb76a3c -- src/
```

## 未完了・今後の課題

- [x] Supabase RPC `get_revenue_summary` の再デプロイ（`generate_series` に `::timestamp` キャストを追加した版）
- [x] `NewProjectClient.tsx` の入金予定日をDBに保存する箇所の timezone 確認（formatDateLocal使用済みで問題なし）
- [ ] 原価ピボットテーブル（工事詳細）の業者追加・月追加機能のテスト
- [ ] AI-OCR 機能の精度確認
