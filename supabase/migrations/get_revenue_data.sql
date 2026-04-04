-- ============================================================
-- get_revenue_summary: 収支ページ用サマリーRPC
--   p_fy_start / p_fy_end で年度を絞り込み、
--   annual (現場別) / monthly_trend (月別) / vendor_ranking (業者別) を返す
-- ============================================================
CREATE OR REPLACE FUNCTION get_revenue_summary(p_fy_start date, p_fy_end date)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_result jsonb;
BEGIN
  WITH
  sales_by_project AS (
    SELECT project_id, SUM(amount) AS sales
    FROM sales
    WHERE (is_deleted IS NULL OR is_deleted = FALSE)
      AND billing_date::date BETWEEN p_fy_start AND p_fy_end
    GROUP BY project_id
  ),
  costs_by_project AS (
    SELECT project_id, SUM(amount) AS costs
    FROM costs
    WHERE (is_deleted IS NULL OR is_deleted = FALSE)
      AND project_id IS NOT NULL
      AND billing_month::date BETWEEN p_fy_start AND p_fy_end
    GROUP BY project_id
  ),
  addons_by_project AS (
    SELECT project_id, SUM(amount) AS addon_total
    FROM addons
    WHERE (is_deleted IS NULL OR is_deleted = FALSE)
    GROUP BY project_id
  ),
  annual_data AS (
    SELECT
      p.project_id,
      p.site_name,
      COALESCE(p.contract_amount, 0) + COALESCE(a.addon_total, 0) AS contract,
      COALESCE(s.sales, 0)           AS sales,
      COALESCE(c.costs, 0)           AS costs,
      COALESCE(s.sales, 0) - COALESCE(c.costs, 0) AS profit
    FROM projects p
    LEFT JOIN sales_by_project s ON s.project_id = p.project_id
    LEFT JOIN costs_by_project c ON c.project_id = p.project_id
    LEFT JOIN addons_by_project a ON a.project_id = p.project_id
    WHERE (p.is_deleted IS NULL OR p.is_deleted = FALSE)
      AND (s.sales IS NOT NULL OR c.costs IS NOT NULL)
    ORDER BY COALESCE(s.sales, 0) DESC
  ),
  months AS (
    SELECT generate_series(p_fy_start::timestamp, p_fy_end::timestamp, '1 month'::interval)::date AS month_date
  ),
  sales_by_month AS (
    SELECT date_trunc('month', billing_date::date)::date AS month_date, SUM(amount) AS sales
    FROM sales
    WHERE (is_deleted IS NULL OR is_deleted = FALSE)
      AND billing_date::date BETWEEN p_fy_start AND p_fy_end
    GROUP BY 1
  ),
  costs_by_month AS (
    SELECT date_trunc('month', billing_month::date)::date AS month_date, SUM(amount) AS costs
    FROM costs
    WHERE (is_deleted IS NULL OR is_deleted = FALSE)
      AND billing_month::date BETWEEN p_fy_start AND p_fy_end
    GROUP BY 1
  ),
  monthly_trend AS (
    SELECT
      to_char(m.month_date, 'YYYY-MM') AS month,
      COALESCE(s.sales, 0)             AS sales,
      COALESCE(c.costs, 0)             AS costs
    FROM months m
    LEFT JOIN sales_by_month s ON s.month_date = m.month_date
    LEFT JOIN costs_by_month c ON c.month_date = m.month_date
    ORDER BY m.month_date
  ),
  vendor_ranking AS (
    SELECT
      c.vendor_id                             AS id,
      COALESCE(p.name, '(不明)')              AS name,
      SUM(c.amount)                           AS amount
    FROM costs c
    LEFT JOIN partners p ON p.partner_id = c.vendor_id
      AND (p.is_deleted IS NULL OR p.is_deleted = FALSE)
    WHERE (c.is_deleted IS NULL OR c.is_deleted = FALSE)
      AND c.billing_month::date BETWEEN p_fy_start AND p_fy_end
    GROUP BY c.vendor_id, p.name
    HAVING SUM(c.amount) >= 1
    ORDER BY amount DESC
  )
  SELECT jsonb_build_object(
    'annual',         (SELECT COALESCE(jsonb_agg(row_to_json(annual_data)),    '[]'::jsonb) FROM annual_data),
    'monthly_trend',  (SELECT COALESCE(jsonb_agg(row_to_json(monthly_trend)),  '[]'::jsonb) FROM monthly_trend),
    'vendor_ranking', (SELECT COALESCE(jsonb_agg(row_to_json(vendor_ranking)), '[]'::jsonb) FROM vendor_ranking)
  ) INTO v_result;

  RETURN v_result;
END;
$$;


-- ============================================================
-- get_monthly_revenue: 月次タブ用（特定月の現場別収支）
-- ============================================================
CREATE OR REPLACE FUNCTION get_monthly_revenue(p_month text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_result jsonb;
BEGIN
  WITH
  sales_data AS (
    SELECT project_id, SUM(amount) AS sales
    FROM sales
    WHERE (is_deleted IS NULL OR is_deleted = FALSE)
      AND to_char(billing_date, 'YYYY-MM') = p_month
    GROUP BY project_id
  ),
  costs_data AS (
    SELECT project_id, SUM(amount) AS costs
    FROM costs
    WHERE (is_deleted IS NULL OR is_deleted = FALSE)
      AND project_id IS NOT NULL
      AND to_char(billing_month, 'YYYY-MM') = p_month
    GROUP BY project_id
  ),
  project_ids AS (
    SELECT project_id FROM sales_data
    UNION
    SELECT project_id FROM costs_data
  ),
  monthly_data AS (
    SELECT
      pi.project_id,
      COALESCE(p.site_name, '(不明)')        AS site_name,
      COALESCE(s.sales, 0)                   AS sales,
      COALESCE(c.costs, 0)                   AS costs,
      COALESCE(s.sales, 0) - COALESCE(c.costs, 0) AS profit
    FROM project_ids pi
    LEFT JOIN projects p ON p.project_id = pi.project_id
      AND (p.is_deleted IS NULL OR p.is_deleted = FALSE)
    LEFT JOIN sales_data s ON s.project_id = pi.project_id
    LEFT JOIN costs_data c ON c.project_id = pi.project_id
    ORDER BY COALESCE(s.sales, 0) DESC
  )
  SELECT COALESCE(jsonb_agg(row_to_json(monthly_data)), '[]'::jsonb)
  INTO v_result
  FROM monthly_data;

  RETURN v_result;
END;
$$;
