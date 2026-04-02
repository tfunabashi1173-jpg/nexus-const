-- 操作履歴（監査ログ）テーブル
-- Streamlit版と共用。既に存在する場合はスキップされる。
CREATE TABLE IF NOT EXISTS app_audit_log (
  id          bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at  timestamptz DEFAULT now(),
  user_id     text,
  user_name   text,
  role        text,
  action      text,        -- insert / update / delete / restore
  target_table text,       -- projects / partners / costs / sales / addons / users
  target_key  text,
  detail      jsonb DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS app_audit_log_created_at_idx ON app_audit_log (created_at DESC);
