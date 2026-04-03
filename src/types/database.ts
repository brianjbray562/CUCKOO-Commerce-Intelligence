// Dimension types
export interface DimDate {
  date_key: string; // ISO date string
  year: number;
  quarter: number;
  month: number;
  month_name: string;
  week_of_year: number;
  day_of_week: number;
  day_name: string;
  is_weekend: boolean;
  is_prime_day: boolean;
  is_holiday_season: boolean;
}

export interface DimProduct {
  product_id: string;
  asin: string;
  parent_asin: string | null;
  sku: string | null;
  product_title: string | null;
  product_group: string | null;
  category: string | null;
  subcategory: string | null;
  brand: string;
  model_number: string | null;
  is_active: boolean;
  first_seen_date: string | null;
  last_seen_date: string | null;
}

export interface DimMarketplace {
  marketplace_id: string;
  marketplace_name: string;
  country_code: string;
  currency_code: string;
}

export interface DimReportSource {
  source_id: string;
  source_name: string;
  source_category: 'sales' | 'advertising' | 'search' | 'operations' | 'reviews' | 'promotions';
  expected_grain: string | null;
  expected_columns: string[] | null;
  mapping_template: Record<string, string> | null;
  description: string | null;
  is_active: boolean;
}

export interface DimCampaign {
  campaign_id: string;
  campaign_name: string;
  campaign_type: 'SP' | 'SB' | 'SD' | 'DSP' | null;
  portfolio_name: string | null;
  targeting_type: string | null;
  status: string;
}

export interface DimQueryKeyword {
  query_id: string;
  query_text: string;
  query_normalized: string;
  is_branded: boolean;
  brand_match_type: string | null;
}

export type UploadStatus = 'pending' | 'processing' | 'validating' | 'mapping' | 'loading' | 'completed' | 'failed';

export interface DimUploadBatch {
  batch_id: string;
  uploaded_by: string | null;
  uploaded_at: string;
  file_name: string;
  file_path: string | null;
  file_size_bytes: number | null;
  source_id: string | null;
  marketplace_id: string | null;
  row_count_raw: number;
  row_count_staged: number;
  row_count_loaded: number;
  row_count_errors: number;
  status: UploadStatus;
  date_range_start: string | null;
  date_range_end: string | null;
  column_mapping: Record<string, string> | null;
  processing_log: Array<{ timestamp: string; message: string; level: string }>;
  error_log: Array<{ row: number; field: string; message: string }>;
  completed_at: string | null;
}

// Fact types
export interface FactSales {
  id: string;
  period_start: string;
  period_end: string;
  grain: 'daily' | 'weekly' | 'monthly';
  product_id: string;
  marketplace_id: string;
  batch_id: string;
  ordered_revenue: number;
  ordered_units: number;
  shipped_revenue: number;
  shipped_units: number;
  shipped_cogs: number;
  avg_selling_price: number;
  ordered_revenue_prior: number | null;
  ordered_revenue_ly: number | null;
  ordered_units_prior: number | null;
  ordered_units_ly: number | null;
  subcategory_rank: number | null;
  category_rank: number | null;
}

export interface FactAdvertising {
  id: string;
  date_key: string;
  product_id: string | null;
  campaign_id: string | null;
  marketplace_id: string;
  batch_id: string;
  impressions: number;
  clicks: number;
  spend: number;
  ad_sales: number;
  ad_units: number;
  orders: number;
  ctr: number;
  cpc: number;
  acos: number;
  roas: number;
}

export interface FactTrafficConversion {
  id: string;
  period_start: string;
  period_end: string;
  grain: 'daily' | 'weekly' | 'monthly';
  product_id: string;
  marketplace_id: string;
  batch_id: string;
  glance_views: number;
  glance_views_prior: number | null;
  glance_views_ly: number | null;
}

export interface FactSearchVisibility {
  id: string;
  period_start: string;
  period_end: string;
  product_id: string | null;
  query_id: string | null;
  marketplace_id: string;
  batch_id: string;
  search_query_volume: number;
  search_query_rank: number | null;
  impressions: number;
  clicks: number;
  cart_adds: number;
  purchases: number;
  impression_share: number;
  click_share: number;
  purchase_share: number;
  brand_impression_share: number;
}

export interface FactOperationalHealth {
  id: string;
  period_start: string;
  period_end: string;
  grain: 'daily' | 'weekly' | 'monthly';
  product_id: string;
  marketplace_id: string;
  batch_id: string;
  sellthrough_rate: number;
  open_po_units: number;
  unfilled_units: number;
  available_units: number;
  sell_in_units: number;
  weeks_of_cover: number;
  aged_90plus_units: number;
  content_score: number;
  has_a_plus: boolean;
  image_count: number;
  bullet_count: number;
}

// View types (for dashboard queries)
export interface AsinPerformance {
  period_start: string;
  period_end: string;
  grain: string;
  asin: string;
  parent_asin: string | null;
  product_title: string | null;
  product_group: string | null;
  category: string | null;
  marketplace_name: string;
  country_code: string;
  ordered_revenue: number;
  ordered_units: number;
  avg_selling_price: number;
  shipped_revenue: number;
  shipped_units: number;
  shipped_cogs: number;
  ordered_revenue_prior: number | null;
  ordered_revenue_ly: number | null;
  ordered_units_prior: number | null;
  ordered_units_ly: number | null;
  glance_views: number | null;
  glance_views_prior: number | null;
  glance_views_ly: number | null;
  conversion_rate: number | null;
  ad_impressions: number | null;
  ad_clicks: number | null;
  ad_spend: number | null;
  ad_sales: number | null;
  ad_units: number | null;
  calc_asp: number;
  acos: number;
  roas: number;
  tacos: number;
}

export interface PeriodSummary {
  period_start: string;
  period_end: string;
  grain: string;
  year: number;
  quarter: number;
  month: number;
  week_of_year: number;
  marketplace_name: string;
  total_revenue: number;
  total_units: number;
  avg_asp: number;
  total_shipped_revenue: number;
  total_cogs: number;
  total_glance_views: number | null;
  avg_conversion_rate: number | null;
  total_ad_spend: number | null;
  total_ad_sales: number | null;
  avg_acos: number | null;
  avg_roas: number | null;
  avg_tacos: number | null;
  active_asins: number;
}

// KPI types for dashboard cards
export interface KpiCardData {
  label: string;
  value: number;
  previousValue?: number;
  format: 'currency' | 'number' | 'percent' | 'compact';
  changePercent?: number;
  tooltip?: string;
  source?: string;
}

// Filter types
export interface DashboardFilters {
  dateRange: { start: string; end: string };
  asin?: string;
  parentAsin?: string;
  productGroup?: string;
  marketplace?: string;
  campaignType?: string;
  reportSource?: string;
}

// Upload/Ingestion types
export interface UploadPreview {
  fileName: string;
  fileSize: number;
  columns: string[];
  sampleRows: Record<string, string>[];
  totalRows: number;
  detectedSourceType?: string;
}

export interface ColumnMapping {
  sourceColumn: string;
  targetColumn: string | null;
  confidence: number; // 0-1 how confident the auto-mapping is
  isRequired: boolean;
}
