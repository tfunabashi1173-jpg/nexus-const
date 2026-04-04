-- ダッシュボード集計関数
-- Supabase SQL Editor で実行してください
--
-- KPI・ランキング・アラートカウントをDB側で一括計算し、
-- Vercel へは集計済みのJSON一本だけを返します。
-- staff_ranking はサブ担当の実働期間に応じて売上・粗利を均等按分します。
-- 粗利の按分 = 按分売上 × プロジェクト粗利率（ProjectDetailClient と同一ロジック）

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
  -- FY内の売上をプロジェクト別に集計（KPI・得意先ランキング用）
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
           p.end_date,
           coalesce(u.username, p.manager_id) AS manager_name
    FROM   projects p
    LEFT   JOIN users u ON u.user_id = p.manager_id
    WHERE  p.is_deleted IS NULL OR p.is_deleted = false
  ),

  -- ===== 按分ロジック =====
  -- FY内の各売上に対して、billing_date 時点のアクティブなサブ担当人数を付与
  sale_sub_counts AS (
    SELECT s.sales_id,
           s.project_id,
           s.amount::numeric AS amount,
           s.billing_date::date AS billing_date,
           count(sm.id) AS sub_count
    FROM   sales s
    LEFT   JOIN project_info pi ON pi.project_id = s.project_id
    LEFT   JOIN project_sub_managers sm
           ON  sm.project_id = s.project_id
           AND sm.start_date <= s.billing_date::date
           AND COALESCE(sm.end_date, pi.end_date, '9999-12-31') >= s.billing_date::date
           AND (sm.is_deleted IS NULL OR sm.is_deleted = false)
    WHERE  (s.is_deleted IS NULL OR s.is_deleted = false)
      AND  s.billing_date::date BETWEEN p_fy_start AND p_fy_end
    GROUP  BY s.sales_id, s.project_id, s.amount, s.billing_date
  ),
  -- プロジェクト別の粗利率（FY売上ベース）
  project_profit_ratio AS (
    SELECT
      pi.project_id,
      coalesce(s.total, 0)::numeric                           AS proj_sales,
      (coalesce(s.total, 0) - coalesce(c.total, 0))::numeric AS proj_profit
    FROM   project_info pi
    LEFT   JOIN fy_sales_by_project s ON s.project_id = pi.project_id
    LEFT   JOIN fy_costs_by_project c ON c.project_id = pi.project_id
  ),
  -- 各売上の1人あたり按分売上・按分粗利を算出
  -- 粗利 = 按分売上 × プロジェクト粗利率（売上ゼロプロジェクトは0）
  sale_allocation AS (
    SELECT
      ssc.sales_id,
      ssc.project_id,
      ssc.billing_date,
      ssc.sub_count,
      round(ssc.amount / (ssc.sub_count + 1))                                              AS alloc_sales,
      CASE WHEN ppr.proj_sales > 0
           THEN round(ssc.amount * ppr.proj_profit / ppr.proj_sales / (ssc.sub_count + 1))
           ELSE 0
      END                                                                                   AS alloc_profit
    FROM   sale_sub_counts ssc
    JOIN   project_profit_ratio ppr ON ppr.project_id = ssc.project_id
  ),
  -- 主担当への按分集計
  manager_alloc AS (
    SELECT pi.manager_id AS person_id,
           sum(sa.alloc_sales)  AS sales,
           sum(sa.alloc_profit) AS profit
    FROM   sale_allocation sa
    JOIN   project_info pi ON pi.project_id = sa.project_id
    GROUP  BY pi.manager_id
  ),
  -- サブ担当への按分集計
  sub_alloc AS (
    SELECT sm.manager_id AS person_id,
           sum(sa.alloc_sales)  AS sales,
           sum(sa.alloc_profit) AS profit
    FROM   sale_allocation sa
    JOIN   project_info pi ON pi.project_id = sa.project_id
    JOIN   project_sub_managers sm
           ON  sm.project_id = sa.project_id
           AND sm.start_date <= sa.billing_date
           AND COALESCE(sm.end_date, pi.end_date, '9999-12-31') >= sa.billing_date
           AND (sm.is_deleted IS NULL OR sm.is_deleted = false)
    GROUP  BY sm.manager_id
  ),
  -- FY売上ゼロだが原価あり → 主担当に負の粗利として計上
  orphaned_costs_profit AS (
    SELECT pi.manager_id AS person_id,
           0::numeric             AS sales,
           (-sum(c.total))::numeric AS profit
    FROM   fy_costs_by_project c
    JOIN   project_info pi ON pi.project_id = c.project_id
    WHERE  c.project_id NOT IN (SELECT project_id FROM fy_sales_by_project)
    GROUP  BY pi.manager_id
  ),
  -- 個人別集計（主担当 + サブ担当 + 売上ゼロ原価）
  person_totals AS (
    SELECT person_id,
           sum(sales)  AS total_sales,
           sum(profit) AS total_profit
    FROM   (
      SELECT * FROM manager_alloc
      UNION ALL SELECT * FROM sub_alloc
      UNION ALL SELECT * FROM orphaned_costs_profit
    ) x
    GROUP  BY person_id
  ),
  -- 社員別ランキング（按分売上・按分粗利ベース）
  staff_ranking AS (
    SELECT u.user_id                                       AS manager_id,
           coalesce(u.username, u.user_id)                AS name,
           coalesce(pt.total_sales,  0)::bigint            AS sales,
           coalesce(pt.total_profit, 0)::bigint            AS profit
    FROM   users u
    LEFT   JOIN person_totals pt ON pt.person_id = u.user_id
    WHERE  (u.is_deleted IS NULL OR u.is_deleted = false)
      AND  (coalesce(pt.total_sales, 0) > 0 OR coalesce(pt.total_profit, 0) != 0)
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
