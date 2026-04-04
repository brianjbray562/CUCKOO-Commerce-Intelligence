"use server"

import { createClient } from "@supabase/supabase-js"

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function getSalesSummary(periodStart?: string, periodEnd?: string) {
  const supabase = getSupabase()
  let query = supabase
    .from("fact_sales")
    .select(`
      period_start,
      period_end,
      ordered_revenue,
      ordered_units,
      shipped_revenue,
      shipped_units,
      shipped_cogs,
      avg_selling_price,
      ordered_revenue_prior,
      ordered_units_prior,
      product_id,
      dim_product!inner(asin, product_title, parent_asin, category, product_group)
    `)
    .order("period_start", { ascending: false })

  if (periodStart) query = query.gte("period_start", periodStart)
  if (periodEnd) query = query.lte("period_end", periodEnd)

  const { data, error } = await query
  if (error) {
    console.error("getSalesSummary error:", error)
    return []
  }
  return data || []
}

export async function getAdSummary(periodStart?: string, periodEnd?: string) {
  const supabase = getSupabase()
  let query = supabase
    .from("fact_advertising")
    .select(`
      date_key,
      impressions,
      clicks,
      spend,
      ad_sales,
      ad_units,
      orders,
      product_id,
      campaign_id,
      dim_product(asin, product_title),
      dim_campaign(campaign_name, campaign_type)
    `)
    .order("date_key", { ascending: false })

  if (periodStart) query = query.gte("date_key", periodStart)
  if (periodEnd) query = query.lte("date_key", periodEnd)

  const { data, error } = await query
  if (error) {
    console.error("getAdSummary error:", error)
    return []
  }
  return data || []
}

export async function getTrafficSummary(periodStart?: string, periodEnd?: string) {
  const supabase = getSupabase()
  let query = supabase
    .from("fact_traffic_conversion")
    .select(`
      period_start,
      period_end,
      glance_views,
      glance_views_prior,
      glance_views_ly,
      product_id,
      dim_product!inner(asin, product_title)
    `)
    .order("period_start", { ascending: false })

  if (periodStart) query = query.gte("period_start", periodStart)
  if (periodEnd) query = query.lte("period_end", periodEnd)

  const { data, error } = await query
  if (error) {
    console.error("getTrafficSummary error:", error)
    return []
  }
  return data || []
}

export async function getSearchSummary(periodStart?: string, periodEnd?: string) {
  const supabase = getSupabase()
  let query = supabase
    .from("fact_search_visibility")
    .select(`
      period_start,
      period_end,
      search_query_volume,
      search_query_rank,
      impressions,
      clicks,
      cart_adds,
      purchases,
      click_share,
      purchase_share,
      impression_share,
      product_id,
      query_id,
      dim_product(asin, product_title),
      dim_query_keyword(query_text, query_normalized, is_branded)
    `)
    .order("search_query_volume", { ascending: false })
    .limit(500)

  if (periodStart) query = query.gte("period_start", periodStart)
  if (periodEnd) query = query.lte("period_end", periodEnd)

  const { data, error } = await query
  if (error) {
    console.error("getSearchSummary error:", error)
    return []
  }
  return data || []
}

export async function getOverviewKpis() {
  const supabase = getSupabase()

  // Get latest sales data
  const { data: sales } = await supabase
    .from("fact_sales")
    .select("ordered_revenue, ordered_units, shipped_revenue, shipped_cogs, avg_selling_price")

  // Get latest ad data
  const { data: ads } = await supabase
    .from("fact_advertising")
    .select("spend, ad_sales, impressions, clicks")

  // Get latest traffic data
  const { data: traffic } = await supabase
    .from("fact_traffic_conversion")
    .select("glance_views")

  // Get product count
  const { count: productCount } = await supabase
    .from("dim_product")
    .select("*", { count: "exact", head: true })

  // Aggregate
  const totalRevenue = (sales || []).reduce((sum, r) => sum + Number(r.ordered_revenue || 0), 0)
  const totalUnits = (sales || []).reduce((sum, r) => sum + Number(r.ordered_units || 0), 0)
  const totalShippedRevenue = (sales || []).reduce((sum, r) => sum + Number(r.shipped_revenue || 0), 0)
  const totalCogs = (sales || []).reduce((sum, r) => sum + Number(r.shipped_cogs || 0), 0)
  const totalAdSpend = (ads || []).reduce((sum, r) => sum + Number(r.spend || 0), 0)
  const totalAdSales = (ads || []).reduce((sum, r) => sum + Number(r.ad_sales || 0), 0)
  const totalGlanceViews = (traffic || []).reduce((sum, r) => sum + Number(r.glance_views || 0), 0)

  return {
    orderedRevenue: totalRevenue,
    orderedUnits: totalUnits,
    asp: totalUnits > 0 ? totalRevenue / totalUnits : 0,
    shippedRevenue: totalShippedRevenue,
    cogs: totalCogs,
    adSpend: totalAdSpend,
    adSales: totalAdSales,
    roas: totalAdSpend > 0 ? totalAdSales / totalAdSpend : 0,
    acos: totalAdSales > 0 ? totalAdSpend / totalAdSales : 0,
    tacos: totalRevenue > 0 ? totalAdSpend / totalRevenue : 0,
    glanceViews: totalGlanceViews,
    conversionRate: totalGlanceViews > 0 ? totalUnits / totalGlanceViews : 0,
    activeAsins: productCount || 0,
  }
}

export async function getTopAsins() {
  const supabase = getSupabase()

  const { data: sales } = await supabase
    .from("fact_sales")
    .select(`
      ordered_revenue,
      ordered_units,
      avg_selling_price,
      product_id,
      dim_product!inner(asin, product_title, parent_asin, category)
    `)
    .order("ordered_revenue", { ascending: false })

  if (!sales || sales.length === 0) return []

  // Aggregate by ASIN
  const asinMap = new Map<string, {
    asin: string
    product_title: string
    ordered_revenue: number
    ordered_units: number
  }>()

  for (const row of sales) {
    const product = row.dim_product as { asin: string; product_title: string } | null
    if (!product) continue
    const key = product.asin
    const existing = asinMap.get(key)
    if (existing) {
      existing.ordered_revenue += Number(row.ordered_revenue || 0)
      existing.ordered_units += Number(row.ordered_units || 0)
    } else {
      asinMap.set(key, {
        asin: product.asin,
        product_title: product.product_title || "",
        ordered_revenue: Number(row.ordered_revenue || 0),
        ordered_units: Number(row.ordered_units || 0),
      })
    }
  }

  return Array.from(asinMap.values())
    .sort((a, b) => b.ordered_revenue - a.ordered_revenue)
    .slice(0, 20)
}

export async function getUploadCoverage() {
  const supabase = getSupabase()
  const { data } = await supabase
    .from("dim_upload_batch")
    .select("source_id, status, row_count_loaded, date_range_start, date_range_end, dim_report_source(source_name, source_category)")
    .eq("status", "completed")
    .gt("row_count_loaded", 0)
    .order("date_range_end", { ascending: false })

  return data || []
}
