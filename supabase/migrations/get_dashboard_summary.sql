-- ダッシュボード集計関数
-- Supabase SQL Editor で実行してください
--
-- KPI・ランキング・アラートカウントをDB側で一括計算し、
-- Vercel へは集計済みのJSON一本だけを返します。
-- これにより fetchSales() / fetchCosts() の全件転送を排除します。

CREATE OR REPLACE FUNCTION get_dashboard_summary(
  p_fy_start date,
  p_fy_end   date
)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
WITH
  -- FY内の売上をプロジェクト別に集計
  fy_sales_by_project AS (
    SELECT project_id, sum(amount) AS total
    FROM   sales
    WHERE  (is_deleted IS NULL OR is_deleted = false)
      AND  billing_date::date BETWEEN p_fy_start AND p_fy_end
    GROUP  BY project_id
  ),
  -- FY内の原価をプロジェクト別に集計
  fy_costs_by_project AS (
    SELECT project_id, sum(amount) AS total
    FROM   costs
    WHERE  (is_deleted IS NULL OR is_deleted = false)
      AND  billing_month::date BETWEEN p_fy_start AND p_fy_end
      AND  project_id IS NOT NULL
    GROUP  BY project_id
  ),
  -- FY内の原価を仕入先別に集計
  fy_costs_by_vendor AS (
    SELECT vendor_id, sum(amount) AS total
    FROM   costs
    WHERE  (is_deleted IS NULL OR is_deleted = false)
      AND  billing_month::date BETWEEN p_fy_start AND p_fy_end
    GROUP  BY vendor_id
  ),
  -- 有効なプロジェクト（担当者名を結合）
  project_info AS (
    SELECT p.project_id,
           p.manager_id,
           p.customer_id,
           coalesce(u.username, p.manager_id) AS manager_name
    FROM   projects p
    LEFT   JOIN users u ON u.user_id = p.manager_id
    WHERE  p.is_deleted IS NULL OR p.is_deleted = false
  ),
  -- 社員別ランキング
  staff_ranking AS (
    SELECT pi.manager_id,
           pi.manager_name                                               AS name,
           coalesce(sum(s.total), 0)::bigint                            AS sales,
           (coalesce(sum(s.total), 0) - coalesce(sum(c.total), 0))::bigint AS profit
    FROM   project_info pi
    LEFT   JOIN fy_sales_by_project s ON s.project_id = pi.project_id
    LEFT   JOIN fy_costs_by_project c ON c.project_id = pi.project_id
    GROUP  BY pi.manager_id, pi.manager_name
    HAVING coalesce(sum(s.total), 0) > 0
        OR coalesce(sum(c.total), 0) > 0
    ORDER  BY sales DESC
  ),
  -- 得意先別ランキング Top20
  customer_ranking AS (
    SELECT pi.customer_id          AS id,
           sum(s.total)::bigint    AS amount
    FROM   project_info pi
    JOIN   fy_sales_by_project s ON s.project_id = pi.project_id
    GROUP  BY pi.customer_id
    ORDER  BY amount DESC
    LIMIT  20
  ),
  -- 支払先別ランキング Top20
  vendor_ranking AS (
    SELECT vendor_id               AS id,
           total::bigint           AS amount
    FROM   fy_costs_by_vendor
    ORDER  BY amount DESC
    LIMIT  20
  ),
  -- アラート: 未入金件数
  alert_unpaid AS (
    SELECT count(*)::int AS cnt
    FROM   sales
    WHERE  (is_deleted IS NULL OR is_deleted = false)
      AND  deposit_status = false
  ),
  -- アラート: 現場不明原価件数
  alert_orphaned AS (
    SELECT count(*)::int AS cnt
    FROM   costs c
    WHERE  (c.is_deleted IS NULL OR c.is_deleted = false)
      AND  (
             c.project_id IS NULL
          OR NOT EXISTS (
               SELECT 1 FROM projects p
               WHERE  p.project_id = c.project_id
                 AND  (p.is_deleted IS NULL OR p.is_deleted = false)
             )
           )
  ),
  -- アラート: 未請求現場（原価あり・売上ゼロ）件数
  all_costs_by_project AS (
    SELECT project_id, sum(amount) AS total
    FROM   costs
    WHERE  (is_deleted IS NULL OR is_deleted = false)
      AND  project_id IS NOT NULL
    GROUP  BY project_id
  ),
  all_sales_by_project AS (
    SELECT project_id, sum(amount) AS total
    FROM   sales
    WHERE  (is_deleted IS NULL OR is_deleted = false)
    GROUP  BY project_id
  ),
  alert_unbilled AS (
    SELECT count(*)::int AS cnt
    FROM   all_costs_by_project pc
    LEFT   JOIN all_sales_by_project ps ON ps.project_id = pc.project_id
    WHERE  coalesce(ps.total, 0) = 0
  )
SELECT json_build_object(
  'kpi', json_build_object(
    'total_sales', coalesce((SELECT sum(total) FROM fy_sales_by_project), 0),
    'total_costs', coalesce((SELECT sum(total) FROM fy_costs_by_project), 0)
  ),
  'staff_ranking',    coalesce((SELECT json_agg(row_to_json(s)) FROM staff_ranking    s), '[]'::json),
  'customer_ranking', coalesce((SELECT json_agg(row_to_json(c)) FROM customer_ranking c), '[]'::json),
  'vendor_ranking',   coalesce((SELECT json_agg(row_to_json(v)) FROM vendor_ranking   v), '[]'::json),
  'alerts', json_build_object(
    'unpaid_sales',   (SELECT cnt FROM alert_unpaid),
    'orphaned_costs', (SELECT cnt FROM alert_orphaned),
    'unbilled_costs', (SELECT cnt FROM alert_unbilled)
  )
)
$$;
