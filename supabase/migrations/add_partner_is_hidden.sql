-- partners テーブルにリスト非表示フラグを追加
ALTER TABLE partners
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;
