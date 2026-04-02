-- CUCKOO Commerce Intelligence - Canonical Data Model
-- Supabase (PostgreSQL) Schema

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- fuzzy text matching

-- ============================================================
-- DIMENSION TABLES
-- ============================================================

-- dim_date: Standard date dimension
CREATE TABLE dim_date (
  date_key DATE PRIMARY KEY,
  year SMALLINT NOT NULL,
  quarter SMALLINT NOT NULL,
  month SMALLINT NOT NULL,
  month_name VARCHAR(20) NOT NULL,
  week_of_year SMALLINT NOT NULL,
  day_of_week SMALLINT NOT NULL,
  day_name VARCHAR(20) NOT NULL,
  is_weekend BOOLEAN NOT NULL DEFAULT FALSE,
  is_prime_day BOOLEAN NOT NULL DEFAULT FALSE,
  is_holiday_season BOOLEAN NOT NULL DEFAULT FALSE,
  fiscal_quarter VARCHAR(10),
  fiscal_year SMALLINT
);

-- Populate dim_date for 2020-2030
INSERT INTO dim_date (date_key, year, quarter, month, month_name, week_of_year, day_of_week, day_name, is_weekend, is_holiday_season)
SELECT
  d::DATE AS date_key,
  EXTRACT(YEAR FROM d)::SMALLINT AS year,
  EXTRACT(QUARTER FROM d)::SMALLINT AS quarter,
  EXTRACT(MONTH FROM d)::SMALLINT AS month,
  TO_CHAR(d, 'Month') AS month_name,
  EXTRACT(WEEK FROM d)::SMALLINT AS week_of_year,
  EXTRACT(DOW FROM d)::SMALLINT AS day_of_week,
  TO_CHAR(d, 'Day') AS day_name,
  EXTRACT(DOW FROM d) IN (0, 6) AS is_weekend,
  EXTRACT(MONTH FROM d) IN (11, 12) AS is_holiday_season
FROM generate_series('2020-01-01'::DATE, '2030-12-31'::DATE, '1 day'::INTERVAL) AS d;

-- dim_marketplace: Amazon marketplace identifiers
CREATE TABLE dim_marketplace (
  marketplace_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  marketplace_name VARCHAR(100) NOT NULL,
  country_code VARCHAR(5) NOT NULL,
  currency_code VARCHAR(5) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO dim_marketplace (marketplace_name, country_code, currency_code) VALUES
  ('Amazon.com', 'US', 'USD'),
  ('Amazon.ca', 'CA', 'CAD'),
  ('Amazon.com.mx', 'MX', 'MXN');

-- dim_report_source: Registry of supported report types
CREATE TABLE dim_report_source (
  source_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_name VARCHAR(200) NOT NULL UNIQUE,
  source_category VARCHAR(100) NOT NULL, -- sales, advertising, search, operations, reviews, promotions
  expected_grain VARCHAR(100), -- daily, weekly, monthly, etc.
  expected_columns JSONB, -- expected column names for schema detection
  mapping_template JSONB, -- default column-to-canonical mapping
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed common report sources
INSERT INTO dim_report_source (source_name, source_category, expected_grain, description, expected_columns, mapping_template) VALUES
  ('Amazon Business Report - Sales & Traffic', 'sales', 'daily', 'Detail Page Sales and Traffic by ASIN',
   '["Date", "ASIN", "Sessions", "Page Views", "Buy Box Percentage", "Units Ordered", "Ordered Product Sales"]'::JSONB,
   '{"Date": "date_key", "ASIN": "asin", "Sessions": "sessions", "Page Views": "page_views", "Buy Box Percentage": "buy_box_percentage", "Units Ordered": "ordered_units", "Ordered Product Sales": "ordered_revenue", "Unit Session Percentage": "unit_session_percentage"}'::JSONB),
  ('Amazon Retail Analytics - Sales', 'sales', 'daily', 'ARA ordered/shipped revenue and units',
   '["Date", "ASIN", "Ordered Revenue", "Ordered Units", "Shipped Revenue", "Shipped Units", "Average Selling Price"]'::JSONB,
   '{"Date": "date_key", "ASIN": "asin", "Ordered Revenue": "ordered_revenue", "Ordered Units": "ordered_units", "Shipped Revenue": "shipped_revenue", "Shipped Units": "shipped_units", "Average Selling Price": "avg_selling_price"}'::JSONB),
  ('Sponsored Products Campaign Report', 'advertising', 'daily', 'SP campaign-level performance',
   '["Date", "Campaign Name", "Ad Group Name", "Targeting", "Impressions", "Clicks", "Spend", "7 Day Total Sales", "7 Day Total Orders"]'::JSONB,
   '{"Date": "date_key", "Campaign Name": "campaign_name", "Impressions": "impressions", "Clicks": "clicks", "Spend": "spend", "7 Day Total Sales": "ad_sales", "7 Day Total Orders": "orders"}'::JSONB),
  ('Sponsored Products Advertised Product Report', 'advertising', 'daily', 'SP ASIN-level ad performance',
   '["Date", "Campaign Name", "Advertised ASIN", "Impressions", "Clicks", "Spend", "7 Day Total Sales", "7 Day Total Units"]'::JSONB,
   '{"Date": "date_key", "Campaign Name": "campaign_name", "Advertised ASIN": "asin", "Impressions": "impressions", "Clicks": "clicks", "Spend": "spend", "7 Day Total Sales": "ad_sales", "7 Day Total Units": "ad_units"}'::JSONB),
  ('Sponsored Brands Campaign Report', 'advertising', 'daily', 'SB campaign-level performance',
   '["Date", "Campaign Name", "Impressions", "Clicks", "Spend", "14 Day Total Sales", "14 Day Total Orders"]'::JSONB,
   '{"Date": "date_key", "Campaign Name": "campaign_name", "Impressions": "impressions", "Clicks": "clicks", "Spend": "spend", "14 Day Total Sales": "ad_sales", "14 Day Total Orders": "orders"}'::JSONB),
  ('Search Query Performance', 'search', 'weekly', 'Brand Analytics search query performance',
   '["Search Query", "Search Query Volume", "ASIN", "Impressions", "Clicks", "Cart Adds", "Purchases"]'::JSONB,
   '{"Search Query": "query_text", "ASIN": "asin", "Search Query Volume": "search_query_volume", "Impressions": "impressions", "Clicks": "clicks", "Cart Adds": "cart_adds", "Purchases": "purchases"}'::JSONB),
  ('Search Catalog Performance', 'search', 'weekly', 'Brand Analytics search catalog performance',
   '["ASIN", "Impressions", "Clicks", "Cart Adds", "Purchases", "Impression Share"]'::JSONB,
   '{"ASIN": "asin", "Impressions": "impressions", "Clicks": "clicks", "Cart Adds": "cart_adds", "Purchases": "purchases", "Impression Share": "impression_share"}'::JSONB),
  ('Inventory Health Report', 'operations', 'daily', 'FBA inventory health and availability',
   '["ASIN", "Available", "Inbound", "Unfulfillable", "Days of Supply"]'::JSONB,
   '{"ASIN": "asin", "Available": "available_units", "Unfulfillable": "unfulfillable_units"}'::JSONB),
  ('Customer Reviews Report', 'reviews', 'daily', 'Review and rating data',
   '["ASIN", "Date", "Rating", "Review Count"]'::JSONB,
   '{"ASIN": "asin", "Date": "date_key", "Rating": "avg_rating", "Review Count": "review_count_new"}'::JSONB),
  ('Promotions Report', 'promotions', 'event', 'Deal and promotion tracking',
   '["ASIN", "Promotion Type", "Start Date", "End Date", "Discount"]'::JSONB,
   '{"ASIN": "asin", "Promotion Type": "promo_type", "Start Date": "promo_start", "End Date": "promo_end", "Discount": "discount_percentage"}'::JSONB);

-- dim_product: Master product table
CREATE TABLE dim_product (
  product_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asin VARCHAR(20) NOT NULL,
  parent_asin VARCHAR(20),
  sku VARCHAR(50),
  product_title TEXT,
  product_group VARCHAR(200),
  category VARCHAR(200),
  subcategory VARCHAR(200),
  brand VARCHAR(200) DEFAULT 'CUCKOO',
  model_number VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  first_seen_date DATE,
  last_seen_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(asin)
);

CREATE INDEX idx_product_asin ON dim_product(asin);
CREATE INDEX idx_product_parent_asin ON dim_product(parent_asin);

-- dim_campaign: Advertising campaign hierarchy
CREATE TABLE dim_campaign (
  campaign_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_name VARCHAR(500) NOT NULL,
  campaign_type VARCHAR(20), -- SP, SB, SD, DSP
  portfolio_name VARCHAR(200),
  targeting_type VARCHAR(50), -- auto, manual, keyword, product
  status VARCHAR(20) DEFAULT 'active',
  first_seen_date DATE,
  last_seen_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(campaign_name, campaign_type)
);

CREATE INDEX idx_campaign_type ON dim_campaign(campaign_type);

-- dim_query_keyword: Search queries and keywords
CREATE TABLE dim_query_keyword (
  query_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  query_text TEXT NOT NULL,
  query_normalized TEXT NOT NULL, -- lowercased, trimmed
  is_branded BOOLEAN DEFAULT FALSE,
  brand_match_type VARCHAR(50), -- exact, contains, none
  first_seen_date DATE,
  last_seen_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(query_normalized)
);

CREATE INDEX idx_query_normalized ON dim_query_keyword USING gin(query_normalized gin_trgm_ops);

-- dim_upload_batch: Lineage tracking for every upload
CREATE TABLE dim_upload_batch (
  batch_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  uploaded_by UUID, -- references auth.users
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  file_name VARCHAR(500) NOT NULL,
  file_path TEXT, -- Supabase storage path
  file_size_bytes BIGINT,
  source_id UUID REFERENCES dim_report_source(source_id),
  marketplace_id UUID REFERENCES dim_marketplace(marketplace_id),
  row_count_raw INTEGER DEFAULT 0,
  row_count_staged INTEGER DEFAULT 0,
  row_count_loaded INTEGER DEFAULT 0,
  row_count_errors INTEGER DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, processing, validating, mapping, loading, completed, failed
  date_range_start DATE,
  date_range_end DATE,
  column_mapping JSONB, -- actual mapping used for this upload
  processing_log JSONB DEFAULT '[]'::JSONB, -- array of log entries
  error_log JSONB DEFAULT '[]'::JSONB, -- array of error entries
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_batch_status ON dim_upload_batch(status);
CREATE INDEX idx_batch_source ON dim_upload_batch(source_id);

-- ============================================================
-- STAGING TABLE (generic staging for all report types)
-- ============================================================
CREATE TABLE staging_rows (
  staging_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id UUID NOT NULL REFERENCES dim_upload_batch(batch_id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  raw_data JSONB NOT NULL, -- original row as key-value pairs
  mapped_data JSONB, -- after mapping to canonical column names
  validation_status VARCHAR(20) DEFAULT 'pending', -- pending, valid, warning, error
  validation_errors JSONB DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_staging_batch ON staging_rows(batch_id);
CREATE INDEX idx_staging_status ON staging_rows(validation_status);

-- ============================================================
-- FACT TABLES
-- ============================================================

-- fact_sales: Daily ASIN-level ordered/shipped revenue and units
CREATE TABLE fact_sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date_key DATE NOT NULL REFERENCES dim_date(date_key),
  product_id UUID NOT NULL REFERENCES dim_product(product_id),
  marketplace_id UUID NOT NULL REFERENCES dim_marketplace(marketplace_id),
  batch_id UUID NOT NULL REFERENCES dim_upload_batch(batch_id),
  ordered_revenue NUMERIC(14,2) DEFAULT 0,
  ordered_units INTEGER DEFAULT 0,
  shipped_revenue NUMERIC(14,2) DEFAULT 0,
  shipped_units INTEGER DEFAULT 0,
  shipped_cogs NUMERIC(14,2) DEFAULT 0,
  avg_selling_price NUMERIC(10,2) DEFAULT 0,
  subcategory_rank INTEGER,
  category_rank INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(date_key, product_id, marketplace_id, batch_id)
);

CREATE INDEX idx_fact_sales_date ON fact_sales(date_key);
CREATE INDEX idx_fact_sales_product ON fact_sales(product_id);
CREATE INDEX idx_fact_sales_date_product ON fact_sales(date_key, product_id);

-- fact_advertising: Daily campaign/ASIN-level ad performance
CREATE TABLE fact_advertising (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date_key DATE NOT NULL REFERENCES dim_date(date_key),
  product_id UUID REFERENCES dim_product(product_id), -- nullable for campaign-only rows
  campaign_id UUID REFERENCES dim_campaign(campaign_id),
  marketplace_id UUID NOT NULL REFERENCES dim_marketplace(marketplace_id),
  batch_id UUID NOT NULL REFERENCES dim_upload_batch(batch_id),
  impressions BIGINT DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  spend NUMERIC(12,2) DEFAULT 0,
  ad_sales NUMERIC(14,2) DEFAULT 0,
  ad_units INTEGER DEFAULT 0,
  orders INTEGER DEFAULT 0,
  ctr NUMERIC(8,4) DEFAULT 0, -- stored as decimal, e.g. 0.0234
  cpc NUMERIC(10,2) DEFAULT 0,
  acos NUMERIC(8,4) DEFAULT 0,
  roas NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fact_ad_date ON fact_advertising(date_key);
CREATE INDEX idx_fact_ad_product ON fact_advertising(product_id);
CREATE INDEX idx_fact_ad_campaign ON fact_advertising(campaign_id);
CREATE INDEX idx_fact_ad_date_product ON fact_advertising(date_key, product_id);

-- fact_traffic_conversion: Session/pageview data with conversion
CREATE TABLE fact_traffic_conversion (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date_key DATE NOT NULL REFERENCES dim_date(date_key),
  product_id UUID NOT NULL REFERENCES dim_product(product_id),
  marketplace_id UUID NOT NULL REFERENCES dim_marketplace(marketplace_id),
  batch_id UUID NOT NULL REFERENCES dim_upload_batch(batch_id),
  sessions INTEGER DEFAULT 0,
  page_views INTEGER DEFAULT 0,
  page_views_percentage NUMERIC(8,4) DEFAULT 0,
  buy_box_percentage NUMERIC(8,4) DEFAULT 0,
  unit_session_percentage NUMERIC(8,4) DEFAULT 0, -- conversion rate
  session_percentage NUMERIC(8,4) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(date_key, product_id, marketplace_id, batch_id)
);

CREATE INDEX idx_fact_traffic_date ON fact_traffic_conversion(date_key);
CREATE INDEX idx_fact_traffic_product ON fact_traffic_conversion(product_id);

-- fact_search_visibility: Search query/catalog performance
CREATE TABLE fact_search_visibility (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  product_id UUID REFERENCES dim_product(product_id),
  query_id UUID REFERENCES dim_query_keyword(query_id),
  marketplace_id UUID NOT NULL REFERENCES dim_marketplace(marketplace_id),
  batch_id UUID NOT NULL REFERENCES dim_upload_batch(batch_id),
  search_query_volume BIGINT DEFAULT 0,
  search_query_rank INTEGER,
  impressions BIGINT DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  cart_adds INTEGER DEFAULT 0,
  purchases INTEGER DEFAULT 0,
  impression_share NUMERIC(8,4) DEFAULT 0,
  click_share NUMERIC(8,4) DEFAULT 0,
  purchase_share NUMERIC(8,4) DEFAULT 0,
  brand_impression_share NUMERIC(8,4) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fact_search_product ON fact_search_visibility(product_id);
CREATE INDEX idx_fact_search_query ON fact_search_visibility(query_id);
CREATE INDEX idx_fact_search_period ON fact_search_visibility(period_start, period_end);

-- fact_operational_health: Inventory, buybox, content health
CREATE TABLE fact_operational_health (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date_key DATE NOT NULL REFERENCES dim_date(date_key),
  product_id UUID NOT NULL REFERENCES dim_product(product_id),
  marketplace_id UUID NOT NULL REFERENCES dim_marketplace(marketplace_id),
  batch_id UUID NOT NULL REFERENCES dim_upload_batch(batch_id),
  in_stock_rate NUMERIC(8,4) DEFAULT 0,
  available_units INTEGER DEFAULT 0,
  sellable_units INTEGER DEFAULT 0,
  unfulfillable_units INTEGER DEFAULT 0,
  buy_box_win_rate NUMERIC(8,4) DEFAULT 0,
  content_score NUMERIC(5,2) DEFAULT 0,
  listing_quality_score NUMERIC(5,2) DEFAULT 0,
  has_a_plus BOOLEAN DEFAULT FALSE,
  image_count SMALLINT DEFAULT 0,
  bullet_count SMALLINT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(date_key, product_id, marketplace_id, batch_id)
);

CREATE INDEX idx_fact_ops_date ON fact_operational_health(date_key);
CREATE INDEX idx_fact_ops_product ON fact_operational_health(product_id);

-- fact_reviews: Review/rating trends
CREATE TABLE fact_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date_key DATE NOT NULL REFERENCES dim_date(date_key),
  product_id UUID NOT NULL REFERENCES dim_product(product_id),
  marketplace_id UUID NOT NULL REFERENCES dim_marketplace(marketplace_id),
  batch_id UUID NOT NULL REFERENCES dim_upload_batch(batch_id),
  review_count_new INTEGER DEFAULT 0,
  review_count_cumulative INTEGER DEFAULT 0,
  avg_rating NUMERIC(3,2) DEFAULT 0,
  rating_1_star INTEGER DEFAULT 0,
  rating_2_star INTEGER DEFAULT 0,
  rating_3_star INTEGER DEFAULT 0,
  rating_4_star INTEGER DEFAULT 0,
  rating_5_star INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(date_key, product_id, marketplace_id, batch_id)
);

-- fact_promotions: Promotion/deal events
CREATE TABLE fact_promotions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  promo_start DATE NOT NULL,
  promo_end DATE NOT NULL,
  product_id UUID NOT NULL REFERENCES dim_product(product_id),
  marketplace_id UUID NOT NULL REFERENCES dim_marketplace(marketplace_id),
  batch_id UUID NOT NULL REFERENCES dim_upload_batch(batch_id),
  promo_type VARCHAR(100),
  promo_name VARCHAR(500),
  discount_amount NUMERIC(10,2) DEFAULT 0,
  discount_percentage NUMERIC(5,2) DEFAULT 0,
  promo_revenue NUMERIC(14,2) DEFAULT 0,
  promo_units INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fact_promo_dates ON fact_promotions(promo_start, promo_end);
CREATE INDEX idx_fact_promo_product ON fact_promotions(product_id);

-- ============================================================
-- VIEWS for common dashboard queries
-- ============================================================

-- Unified daily performance view (sales + traffic + ads at ASIN level)
CREATE OR REPLACE VIEW v_daily_asin_performance AS
SELECT
  s.date_key,
  p.asin,
  p.parent_asin,
  p.product_title,
  p.product_group,
  p.category,
  m.marketplace_name,
  m.country_code,
  -- Sales metrics
  s.ordered_revenue,
  s.ordered_units,
  s.avg_selling_price,
  s.shipped_revenue,
  s.shipped_units,
  -- Traffic metrics
  tc.sessions,
  tc.page_views,
  tc.buy_box_percentage,
  tc.unit_session_percentage AS conversion_rate,
  -- Ad metrics (aggregated to ASIN level)
  ad.total_impressions AS ad_impressions,
  ad.total_clicks AS ad_clicks,
  ad.total_spend AS ad_spend,
  ad.total_ad_sales AS ad_sales,
  ad.total_ad_units AS ad_units,
  -- Calculated metrics
  CASE WHEN s.ordered_units > 0 THEN s.ordered_revenue / s.ordered_units ELSE 0 END AS calc_asp,
  CASE WHEN ad.total_ad_sales > 0 THEN ad.total_spend / ad.total_ad_sales ELSE 0 END AS acos,
  CASE WHEN ad.total_spend > 0 THEN ad.total_ad_sales / ad.total_spend ELSE 0 END AS roas,
  CASE WHEN s.ordered_revenue > 0 THEN ad.total_spend / s.ordered_revenue ELSE 0 END AS tacos
FROM fact_sales s
JOIN dim_product p ON s.product_id = p.product_id
JOIN dim_marketplace m ON s.marketplace_id = m.marketplace_id
LEFT JOIN fact_traffic_conversion tc ON
  s.date_key = tc.date_key AND s.product_id = tc.product_id AND s.marketplace_id = tc.marketplace_id
LEFT JOIN LATERAL (
  SELECT
    SUM(impressions) AS total_impressions,
    SUM(clicks) AS total_clicks,
    SUM(spend) AS total_spend,
    SUM(ad_sales) AS total_ad_sales,
    SUM(ad_units) AS total_ad_units
  FROM fact_advertising a
  WHERE a.date_key = s.date_key AND a.product_id = s.product_id AND a.marketplace_id = s.marketplace_id
) ad ON TRUE;

-- Executive summary view (daily totals)
CREATE OR REPLACE VIEW v_daily_summary AS
SELECT
  s.date_key,
  d.year,
  d.quarter,
  d.month,
  d.week_of_year,
  m.marketplace_name,
  SUM(s.ordered_revenue) AS total_revenue,
  SUM(s.ordered_units) AS total_units,
  CASE WHEN SUM(s.ordered_units) > 0 THEN SUM(s.ordered_revenue) / SUM(s.ordered_units) ELSE 0 END AS avg_asp,
  SUM(tc.sessions) AS total_sessions,
  CASE WHEN SUM(tc.sessions) > 0 THEN SUM(s.ordered_units)::NUMERIC / SUM(tc.sessions) ELSE 0 END AS avg_conversion_rate,
  SUM(ad.spend) AS total_ad_spend,
  SUM(ad.ad_sales) AS total_ad_sales,
  CASE WHEN SUM(ad.ad_sales) > 0 THEN SUM(ad.spend) / SUM(ad.ad_sales) ELSE 0 END AS avg_acos,
  CASE WHEN SUM(ad.spend) > 0 THEN SUM(ad.ad_sales) / SUM(ad.spend) ELSE 0 END AS avg_roas,
  CASE WHEN SUM(s.ordered_revenue) > 0 THEN SUM(ad.spend) / SUM(s.ordered_revenue) ELSE 0 END AS avg_tacos,
  COUNT(DISTINCT s.product_id) AS active_asins
FROM fact_sales s
JOIN dim_date d ON s.date_key = d.date_key
JOIN dim_marketplace m ON s.marketplace_id = m.marketplace_id
LEFT JOIN fact_traffic_conversion tc ON
  s.date_key = tc.date_key AND s.product_id = tc.product_id AND s.marketplace_id = tc.marketplace_id
LEFT JOIN (
  SELECT date_key, marketplace_id, SUM(spend) AS spend, SUM(ad_sales) AS ad_sales
  FROM fact_advertising
  GROUP BY date_key, marketplace_id
) ad ON s.date_key = ad.date_key AND s.marketplace_id = ad.marketplace_id
GROUP BY s.date_key, d.year, d.quarter, d.month, d.week_of_year, m.marketplace_name;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE dim_upload_batch ENABLE ROW LEVEL SECURITY;
ALTER TABLE staging_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE fact_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE fact_advertising ENABLE ROW LEVEL SECURITY;
ALTER TABLE fact_traffic_conversion ENABLE ROW LEVEL SECURITY;
ALTER TABLE fact_search_visibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE fact_operational_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE fact_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE fact_promotions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access (internal app)
CREATE POLICY "Authenticated users can read all data" ON dim_upload_batch FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert uploads" ON dim_upload_batch FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update uploads" ON dim_upload_batch FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated read staging" ON staging_rows FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert staging" ON staging_rows FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update staging" ON staging_rows FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete staging" ON staging_rows FOR DELETE TO authenticated USING (true);

CREATE POLICY "Read fact_sales" ON fact_sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert fact_sales" ON fact_sales FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Read fact_advertising" ON fact_advertising FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert fact_advertising" ON fact_advertising FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Read fact_traffic" ON fact_traffic_conversion FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert fact_traffic" ON fact_traffic_conversion FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Read fact_search" ON fact_search_visibility FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert fact_search" ON fact_search_visibility FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Read fact_ops" ON fact_operational_health FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert fact_ops" ON fact_operational_health FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Read fact_reviews" ON fact_reviews FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert fact_reviews" ON fact_reviews FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Read fact_promotions" ON fact_promotions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert fact_promotions" ON fact_promotions FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- STORAGE BUCKET
-- ============================================================
-- Run in Supabase dashboard or via API:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('uploads', 'uploads', false);
