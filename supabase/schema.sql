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

-- Seed report sources for Amazon 1P (Vendor Central) business
-- ARA Standard reports are weekly grain; advertising is daily; Brand Analytics is weekly
INSERT INTO dim_report_source (source_name, source_category, expected_grain, description, expected_columns, mapping_template) VALUES
  -- ============================================================
  -- ARA (Amazon Retail Analytics) - Vendor Central
  -- ============================================================
  ('ARA Sales - Ordered Revenue', 'sales', 'weekly', 'ARA Standard: ordered revenue, units, and ASP by ASIN (weekly)',
   '["ASIN", "Product Title", "Subcategory", "Ordered Revenue", "Ordered Revenue - Prior Period", "Ordered Revenue - Last Year", "Ordered Units", "Ordered Units - Prior Period", "Ordered Units - Last Year", "Average Sales Price", "Average Sales Price - Prior Period", "Average Sales Price - Last Year"]'::JSONB,
   '{"ASIN": "asin", "Product Title": "product_title", "Subcategory": "subcategory", "Ordered Revenue": "ordered_revenue", "Ordered Units": "ordered_units", "Average Sales Price": "avg_selling_price", "Ordered Revenue - Prior Period": "ordered_revenue_prior", "Ordered Revenue - Last Year": "ordered_revenue_ly", "Ordered Units - Prior Period": "ordered_units_prior", "Ordered Units - Last Year": "ordered_units_ly"}'::JSONB),
  ('ARA Sales - Shipped Revenue', 'sales', 'weekly', 'ARA Standard: shipped revenue and COGS by ASIN (weekly)',
   '["ASIN", "Product Title", "Shipped Revenue", "Shipped Revenue - Prior Period", "Shipped Revenue - Last Year", "Shipped Units", "Shipped COGS", "Customer Returns"]'::JSONB,
   '{"ASIN": "asin", "Product Title": "product_title", "Shipped Revenue": "shipped_revenue", "Shipped Units": "shipped_units", "Shipped COGS": "shipped_cogs"}'::JSONB),
  ('ARA Traffic', 'traffic', 'weekly', 'ARA Standard: glance views (detail page views) by ASIN (weekly)',
   '["ASIN", "Product Title", "Glance Views", "Glance Views - Prior Period", "Glance Views - Last Year"]'::JSONB,
   '{"ASIN": "asin", "Product Title": "product_title", "Glance Views": "page_views", "Glance Views - Prior Period": "page_views_prior", "Glance Views - Last Year": "page_views_ly"}'::JSONB),
  ('ARA Inventory', 'operations', 'weekly', 'ARA Standard: sellthrough, open PO, and inventory health (weekly)',
   '["ASIN", "Product Title", "Sellthrough Rate", "Open Purchase Order Quantity", "Unfilled Customer Ordered Units", "Total Weeks of Cover", "Aged 90+ Days Sellable Units", "Available Units", "Sell-in Units"]'::JSONB,
   '{"ASIN": "asin", "Product Title": "product_title", "Sellthrough Rate": "in_stock_rate", "Open Purchase Order Quantity": "open_po_units", "Available Units": "available_units", "Unfilled Customer Ordered Units": "unfulfillable_units"}'::JSONB),
  -- ============================================================
  -- Advertising Console (Sponsored Products + Sponsored Brands)
  -- ============================================================
  ('SP Campaign Report', 'advertising', 'daily', 'Sponsored Products campaign-level performance (daily)',
   '["Date", "Campaign Name", "Ad Group Name", "Targeting", "Match Type", "Impressions", "Clicks", "Spend", "7 Day Total Sales", "7 Day Total Orders", "7 Day Total Units"]'::JSONB,
   '{"Date": "date_key", "Campaign Name": "campaign_name", "Ad Group Name": "ad_group_name", "Targeting": "targeting", "Match Type": "match_type", "Impressions": "impressions", "Clicks": "clicks", "Spend": "spend", "7 Day Total Sales": "ad_sales", "7 Day Total Orders": "orders", "7 Day Total Units": "ad_units"}'::JSONB),
  ('SP Advertised Product Report', 'advertising', 'daily', 'Sponsored Products ASIN-level ad performance (daily)',
   '["Date", "Campaign Name", "Ad Group Name", "Advertised ASIN", "Advertised SKU", "Impressions", "Clicks", "Spend", "7 Day Total Sales", "7 Day Total Orders", "7 Day Total Units"]'::JSONB,
   '{"Date": "date_key", "Campaign Name": "campaign_name", "Ad Group Name": "ad_group_name", "Advertised ASIN": "asin", "Impressions": "impressions", "Clicks": "clicks", "Spend": "spend", "7 Day Total Sales": "ad_sales", "7 Day Total Orders": "orders", "7 Day Total Units": "ad_units"}'::JSONB),
  ('SP Search Term Report', 'advertising', 'daily', 'Sponsored Products search term / keyword performance (daily)',
   '["Date", "Campaign Name", "Ad Group Name", "Targeting", "Match Type", "Customer Search Term", "Impressions", "Clicks", "Spend", "7 Day Total Sales", "7 Day Total Orders"]'::JSONB,
   '{"Date": "date_key", "Campaign Name": "campaign_name", "Customer Search Term": "query_text", "Targeting": "targeting", "Impressions": "impressions", "Clicks": "clicks", "Spend": "spend", "7 Day Total Sales": "ad_sales", "7 Day Total Orders": "orders"}'::JSONB),
  ('SB Campaign Report', 'advertising', 'daily', 'Sponsored Brands campaign-level performance (daily)',
   '["Date", "Campaign Name", "Impressions", "Clicks", "Spend", "14 Day Total Sales", "14 Day Total Orders", "14 Day Total Units"]'::JSONB,
   '{"Date": "date_key", "Campaign Name": "campaign_name", "Impressions": "impressions", "Clicks": "clicks", "Spend": "spend", "14 Day Total Sales": "ad_sales", "14 Day Total Orders": "orders", "14 Day Total Units": "ad_units"}'::JSONB),
  -- ============================================================
  -- Brand Analytics (from 3P account)
  -- ============================================================
  ('Search Query Performance', 'search', 'weekly', 'Brand Analytics: search query performance with impression/click/purchase share (weekly)',
   '["Reporting Range", "Search Query", "Search Query Score", "Search Query Volume", "ASIN", "Product Title", "Click Share", "Conversion Share"]'::JSONB,
   '{"Search Query": "query_text", "Search Query Score": "search_query_rank", "Search Query Volume": "search_query_volume", "ASIN": "asin", "Product Title": "product_title", "Click Share": "click_share", "Conversion Share": "purchase_share"}'::JSONB),
  ('Search Catalog Performance', 'search', 'weekly', 'Brand Analytics: ASIN-level search catalog visibility (weekly)',
   '["Reporting Range", "ASIN", "Product Title", "Search Funnel - Impressions", "Search Funnel - Clicks", "Search Funnel - Cart Adds", "Search Funnel - Purchases"]'::JSONB,
   '{"ASIN": "asin", "Product Title": "product_title", "Search Funnel - Impressions": "impressions", "Search Funnel - Clicks": "clicks", "Search Funnel - Cart Adds": "cart_adds", "Search Funnel - Purchases": "purchases"}'::JSONB),
  ('Market Basket Analysis', 'search', 'weekly', 'Brand Analytics: products frequently purchased together (weekly)',
   '["ASIN", "Product Title", "#1 Purchased ASIN", "#1 Purchased Title", "#1 Combination %", "#2 Purchased ASIN", "#2 Purchased Title", "#2 Combination %", "#3 Purchased ASIN", "#3 Purchased Title", "#3 Combination %"]'::JSONB,
   '{"ASIN": "asin", "Product Title": "product_title"}'::JSONB),
  ('Repeat Purchase Behavior', 'search', 'weekly', 'Brand Analytics: repeat vs new customer purchase behavior (weekly)',
   '["ASIN", "Product Title", "Orders", "Unique Customers", "Revenue", "Repeat Customer Orders", "Repeat Customer Revenue"]'::JSONB,
   '{"ASIN": "asin", "Product Title": "product_title", "Orders": "orders", "Unique Customers": "unique_customers", "Revenue": "ordered_revenue", "Repeat Customer Orders": "repeat_orders", "Repeat Customer Revenue": "repeat_revenue"}'::JSONB),
  ('Demographics', 'search', 'monthly', 'Brand Analytics: customer demographics (monthly)',
   '["ASIN", "Product Title", "Age Group", "Household Income", "Education", "Gender", "Marital Status"]'::JSONB,
   '{"ASIN": "asin", "Product Title": "product_title"}'::JSONB);

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

-- fact_sales: ASIN-level ordered/shipped revenue and units
-- Supports both weekly (ARA Standard) and daily (ARA Premium) grain
-- For weekly data: period_start = Monday, period_end = Sunday of reporting week
CREATE TABLE fact_sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  grain VARCHAR(10) NOT NULL DEFAULT 'weekly', -- daily, weekly, monthly
  product_id UUID NOT NULL REFERENCES dim_product(product_id),
  marketplace_id UUID NOT NULL REFERENCES dim_marketplace(marketplace_id),
  batch_id UUID NOT NULL REFERENCES dim_upload_batch(batch_id),
  ordered_revenue NUMERIC(14,2) DEFAULT 0,
  ordered_units INTEGER DEFAULT 0,
  shipped_revenue NUMERIC(14,2) DEFAULT 0,
  shipped_units INTEGER DEFAULT 0,
  shipped_cogs NUMERIC(14,2) DEFAULT 0,
  avg_selling_price NUMERIC(10,2) DEFAULT 0,
  -- Period-over-period comparisons (ARA provides these directly)
  ordered_revenue_prior NUMERIC(14,2),
  ordered_revenue_ly NUMERIC(14,2),
  ordered_units_prior INTEGER,
  ordered_units_ly INTEGER,
  subcategory_rank INTEGER,
  category_rank INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(period_start, period_end, product_id, marketplace_id, batch_id)
);

CREATE INDEX idx_fact_sales_period ON fact_sales(period_start, period_end);
CREATE INDEX idx_fact_sales_product ON fact_sales(product_id);
CREATE INDEX idx_fact_sales_period_product ON fact_sales(period_start, product_id);

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

-- fact_traffic_conversion: Glance views (detail page views) from ARA Traffic
-- In 1P/Vendor Central, the metric is "Glance Views" not "Sessions"
-- ARA Standard provides weekly data
CREATE TABLE fact_traffic_conversion (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  grain VARCHAR(10) NOT NULL DEFAULT 'weekly',
  product_id UUID NOT NULL REFERENCES dim_product(product_id),
  marketplace_id UUID NOT NULL REFERENCES dim_marketplace(marketplace_id),
  batch_id UUID NOT NULL REFERENCES dim_upload_batch(batch_id),
  glance_views INTEGER DEFAULT 0, -- ARA "Glance Views" = detail page views
  glance_views_prior INTEGER, -- prior period comparison
  glance_views_ly INTEGER, -- last year comparison
  -- Conversion rate calculated: ordered_units / glance_views (joined from fact_sales)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(period_start, period_end, product_id, marketplace_id, batch_id)
);

CREATE INDEX idx_fact_traffic_period ON fact_traffic_conversion(period_start, period_end);
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

-- fact_operational_health: ARA Inventory + content health
-- ARA Standard inventory is weekly
CREATE TABLE fact_operational_health (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  grain VARCHAR(10) NOT NULL DEFAULT 'weekly',
  product_id UUID NOT NULL REFERENCES dim_product(product_id),
  marketplace_id UUID NOT NULL REFERENCES dim_marketplace(marketplace_id),
  batch_id UUID NOT NULL REFERENCES dim_upload_batch(batch_id),
  -- ARA Inventory fields
  sellthrough_rate NUMERIC(8,4) DEFAULT 0,
  open_po_units INTEGER DEFAULT 0,
  unfilled_units INTEGER DEFAULT 0,
  available_units INTEGER DEFAULT 0,
  sell_in_units INTEGER DEFAULT 0,
  weeks_of_cover NUMERIC(6,1) DEFAULT 0,
  aged_90plus_units INTEGER DEFAULT 0,
  -- Content/listing quality (if available)
  content_score NUMERIC(5,2) DEFAULT 0,
  has_a_plus BOOLEAN DEFAULT FALSE,
  image_count SMALLINT DEFAULT 0,
  bullet_count SMALLINT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(period_start, period_end, product_id, marketplace_id, batch_id)
);

CREATE INDEX idx_fact_ops_period ON fact_operational_health(period_start, period_end);
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

-- Unified periodic ASIN performance view (sales + traffic + ads)
-- Joins weekly ARA data with daily ad data aggregated to matching periods
CREATE OR REPLACE VIEW v_asin_performance AS
SELECT
  s.period_start,
  s.period_end,
  s.grain,
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
  s.shipped_cogs,
  -- Period comparisons from ARA
  s.ordered_revenue_prior,
  s.ordered_revenue_ly,
  s.ordered_units_prior,
  s.ordered_units_ly,
  -- Traffic metrics (Glance Views from ARA Traffic)
  tc.glance_views,
  tc.glance_views_prior,
  tc.glance_views_ly,
  -- Conversion rate: units / glance views
  CASE WHEN tc.glance_views > 0 THEN s.ordered_units::NUMERIC / tc.glance_views ELSE 0 END AS conversion_rate,
  -- Ad metrics (aggregated to ASIN level for the same period)
  ad.total_impressions AS ad_impressions,
  ad.total_clicks AS ad_clicks,
  ad.total_spend AS ad_spend,
  ad.total_ad_sales AS ad_sales,
  ad.total_ad_units AS ad_units,
  -- Calculated efficiency metrics
  CASE WHEN s.ordered_units > 0 THEN s.ordered_revenue / s.ordered_units ELSE 0 END AS calc_asp,
  CASE WHEN ad.total_ad_sales > 0 THEN ad.total_spend / ad.total_ad_sales ELSE 0 END AS acos,
  CASE WHEN ad.total_spend > 0 THEN ad.total_ad_sales / ad.total_spend ELSE 0 END AS roas,
  CASE WHEN s.ordered_revenue > 0 THEN ad.total_spend / s.ordered_revenue ELSE 0 END AS tacos
FROM fact_sales s
JOIN dim_product p ON s.product_id = p.product_id
JOIN dim_marketplace m ON s.marketplace_id = m.marketplace_id
LEFT JOIN fact_traffic_conversion tc ON
  s.period_start = tc.period_start AND s.period_end = tc.period_end
  AND s.product_id = tc.product_id AND s.marketplace_id = tc.marketplace_id
LEFT JOIN LATERAL (
  SELECT
    SUM(impressions) AS total_impressions,
    SUM(clicks) AS total_clicks,
    SUM(spend) AS total_spend,
    SUM(ad_sales) AS total_ad_sales,
    SUM(ad_units) AS total_ad_units
  FROM fact_advertising a
  WHERE a.date_key >= s.period_start AND a.date_key <= s.period_end
    AND a.product_id = s.product_id AND a.marketplace_id = s.marketplace_id
) ad ON TRUE;

-- Executive summary view (weekly periods from ARA + aggregated daily ads)
CREATE OR REPLACE VIEW v_period_summary AS
SELECT
  s.period_start,
  s.period_end,
  s.grain,
  d.year,
  d.quarter,
  d.month,
  d.week_of_year,
  m.marketplace_name,
  SUM(s.ordered_revenue) AS total_revenue,
  SUM(s.ordered_units) AS total_units,
  CASE WHEN SUM(s.ordered_units) > 0 THEN SUM(s.ordered_revenue) / SUM(s.ordered_units) ELSE 0 END AS avg_asp,
  SUM(s.shipped_revenue) AS total_shipped_revenue,
  SUM(s.shipped_cogs) AS total_cogs,
  SUM(tc.glance_views) AS total_glance_views,
  CASE WHEN SUM(tc.glance_views) > 0 THEN SUM(s.ordered_units)::NUMERIC / SUM(tc.glance_views) ELSE 0 END AS avg_conversion_rate,
  SUM(ad.spend) AS total_ad_spend,
  SUM(ad.ad_sales) AS total_ad_sales,
  CASE WHEN SUM(ad.ad_sales) > 0 THEN SUM(ad.spend) / SUM(ad.ad_sales) ELSE 0 END AS avg_acos,
  CASE WHEN SUM(ad.spend) > 0 THEN SUM(ad.ad_sales) / SUM(ad.spend) ELSE 0 END AS avg_roas,
  CASE WHEN SUM(s.ordered_revenue) > 0 THEN SUM(ad.spend) / SUM(s.ordered_revenue) ELSE 0 END AS avg_tacos,
  COUNT(DISTINCT s.product_id) AS active_asins
FROM fact_sales s
JOIN dim_date d ON s.period_start = d.date_key
JOIN dim_marketplace m ON s.marketplace_id = m.marketplace_id
LEFT JOIN fact_traffic_conversion tc ON
  s.period_start = tc.period_start AND s.period_end = tc.period_end
  AND s.product_id = tc.product_id AND s.marketplace_id = tc.marketplace_id
LEFT JOIN (
  SELECT
    marketplace_id,
    -- Aggregate daily ad data to the ARA reporting period
    SUM(spend) AS spend,
    SUM(ad_sales) AS ad_sales
  FROM fact_advertising
  GROUP BY marketplace_id
) ad ON s.marketplace_id = ad.marketplace_id
GROUP BY s.period_start, s.period_end, s.grain, d.year, d.quarter, d.month, d.week_of_year, m.marketplace_name;

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
