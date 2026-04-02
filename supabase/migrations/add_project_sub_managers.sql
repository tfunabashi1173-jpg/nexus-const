-- サブ担当者テーブル
CREATE TABLE IF NOT EXISTS project_sub_managers (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(project_id),
  manager_id  TEXT NOT NULL REFERENCES users(user_id),
  start_date  DATE NOT NULL,
  end_date    DATE,          -- NULL = 現在日まで有効
  is_deleted  BOOLEAN,
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_project_sub_managers_project ON project_sub_managers(project_id);
