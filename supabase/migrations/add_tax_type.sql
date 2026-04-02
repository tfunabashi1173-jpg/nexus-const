-- costs テーブルに税区分カラムを追加
ALTER TABLE costs
  ADD COLUMN IF NOT EXISTS tax_type TEXT NOT NULL DEFAULT '税抜'
  CHECK (tax_type IN ('税抜', '税込', '免税'));

-- partners テーブルにデフォルト税区分カラムを追加
ALTER TABLE partners
  ADD COLUMN IF NOT EXISTS default_tax_type TEXT NOT NULL DEFAULT '税抜'
  CHECK (default_tax_type IN ('税抜', '税込', '免税'));

-- 仕入先・経費カテゴリのデフォルトを税込に更新
UPDATE partners SET default_tax_type = '税込' WHERE category IN ('仕入先', '経費');
