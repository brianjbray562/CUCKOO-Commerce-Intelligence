import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import Papa from "papaparse"
import * as XLSX from "xlsx"

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key)
}

// Column alias mapping for auto-mapping source columns to canonical names
const COLUMN_ALIASES: Record<string, string[]> = {
  date_key: ["date", "day", "report date", "date range", "reporting range", "week"],
  asin: ["asin", "(child) asin", "advertised asin", "promoted asin", "child asin"],
  parent_asin: ["parent asin", "(parent) asin"],
  product_title: ["product title", "title", "product name", "item name", "(child) asin title", "advertised product title"],
  subcategory: ["subcategory", "sub category", "sub-category"],
  ordered_revenue: ["ordered product sales", "ordered revenue", "ordered product sales amount", "sales", "revenue", "total sales", "ordered revenue - this period"],
  ordered_revenue_prior: ["ordered revenue - prior period", "ordered revenue - prior"],
  ordered_revenue_ly: ["ordered revenue - last year", "ordered revenue - ly"],
  ordered_units: ["units ordered", "ordered units", "total units", "units"],
  ordered_units_prior: ["ordered units - prior period", "ordered units - prior"],
  ordered_units_ly: ["ordered units - last year", "ordered units - ly"],
  shipped_revenue: ["shipped revenue", "shipped product sales"],
  shipped_units: ["shipped units"],
  shipped_cogs: ["shipped cogs", "cogs"],
  avg_selling_price: ["average selling price", "avg selling price", "asp", "average sales price", "avg. selling price", "average sales price - this period"],
  glance_views: ["glance views", "glance views - this period", "detail page views"],
  glance_views_prior: ["glance views - prior period", "glance views - prior"],
  glance_views_ly: ["glance views - last year", "glance views - ly"],
  campaign_name: ["campaign name", "campaign"],
  ad_group_name: ["ad group name", "ad group"],
  targeting: ["targeting", "targeting expression", "keyword"],
  match_type: ["match type"],
  impressions: ["impressions", "impr.", "impr"],
  clicks: ["clicks"],
  spend: ["spend", "cost", "total spend"],
  ad_sales: ["7 day total sales", "14 day total sales", "total advertising sales", "attributed sales"],
  ad_units: ["7 day total units", "14 day total units", "total advertising units", "attributed units"],
  orders: ["7 day total orders", "14 day total orders", "total orders", "attributed orders"],
  query_text: ["search query", "query", "customer search term", "search term"],
  search_query_volume: ["search query volume", "search volume", "query volume"],
  search_query_rank: ["search query score", "search frequency rank"],
  click_share: ["click share", "search click share"],
  purchase_share: ["purchase share", "search conversion share", "conversion share"],
  impression_share: ["impression share", "search impression share"],
  cart_adds: ["cart adds", "add to cart", "add to carts", "search funnel - cart adds"],
  purchases: ["purchases", "purchase count", "search funnel - purchases"],
  sellthrough_rate: ["sellthrough rate", "sell-through rate", "sell through rate"],
  open_po_units: ["open purchase order quantity", "open po quantity", "open po units"],
  available_units: ["available", "available units"],
  weeks_of_cover: ["total weeks of cover", "weeks of cover"],
  aged_90plus_units: ["aged 90+ days sellable units", "aged 90+ units"],
}

// Build reverse lookup
const ALIAS_LOOKUP: Record<string, string> = {}
for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
  for (const alias of aliases) {
    ALIAS_LOOKUP[alias.toLowerCase().trim()] = canonical
  }
}

function detectSourceType(columns: string[]): string | null {
  const colSet = new Set(columns.map(c => c.toLowerCase().trim()))

  // ARA Sales - combined report with both ordered + shipped
  if ((colSet.has("ordered revenue") || colSet.has("ordered units")) &&
      (colSet.has("shipped revenue") || colSet.has("shipped units")))
    return "ARA Sales"
  // ARA Sales - ordered only
  if (colSet.has("ordered revenue") && colSet.has("ordered units"))
    return "ARA Sales"
  // ARA Sales - shipped only (rare, but handle it)
  if (colSet.has("shipped revenue") && colSet.has("shipped units"))
    return "ARA Sales"
  if (colSet.has("glance views"))
    return "ARA Traffic"
  if (colSet.has("sellthrough rate"))
    return "ARA Inventory"
  if (colSet.has("advertised asin") && colSet.has("impressions") && colSet.has("clicks") && colSet.has("spend"))
    return "SP Advertised Product Report"
  if (colSet.has("customer search term") && colSet.has("impressions") && colSet.has("spend"))
    return "SP Search Term Report"
  if (colSet.has("campaign name") && colSet.has("impressions") && colSet.has("spend") && !colSet.has("advertised asin")) {
    if (colSet.has("14 day total sales")) return "SB Campaign Report"
    if (colSet.has("7 day total sales")) return "SP Campaign Report"
  }
  if (colSet.has("search query") && (colSet.has("search query volume") || colSet.has("search query score")))
    return "Search Query Performance"
  if (colSet.has("search funnel - impressions"))
    return "Search Catalog Performance"

  return null
}

function autoMapColumns(columns: string[]): Record<string, string> {
  const mapping: Record<string, string> = {}
  for (const col of columns) {
    const key = col.toLowerCase().trim()
    if (ALIAS_LOOKUP[key]) {
      mapping[col] = ALIAS_LOOKUP[key]
    }
  }
  return mapping
}

function parseNumeric(value: string | undefined): number {
  if (!value || value.trim() === "" || value === "-" || value === "N/A") return 0
  const cleaned = value.replace(/[$,\s%]/g, "").replace(/^\((.+)\)$/, "-$1")
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

function parsePercentage(value: string | undefined): number {
  if (!value || value.trim() === "") return 0
  const num = parseNumeric(value)
  return num > 1 ? num / 100 : num
}

function normalizeAsin(value: string | undefined): string | null {
  if (!value || !value.trim()) return null
  const cleaned = value.trim().toUpperCase().replace(/[="']/g, "")
  if (cleaned.length === 10 && /^[A-Z0-9]+$/.test(cleaned)) return cleaned
  return null
}

// Detect date range from column data, "Reporting Range" column, or filename
function detectPeriodDates(
  rows: Record<string, string>[],
  mapping: Record<string, string>,
  fileName?: string,
): { periodStart: string; periodEnd: string } {
  // 1. Look for "Reporting Range" column
  const reportingRangeCol = Object.entries(mapping).find(([, v]) => v === "date_key")?.[0]
  if (reportingRangeCol && rows[0]?.[reportingRangeCol]) {
    const val = rows[0][reportingRangeCol]
    // Format: "01/01/2024 - 01/07/2024" or "2024-01-01 - 2024-01-07"
    const parts = val.split(/\s*[-–]\s*/)
    if (parts.length === 2) {
      const start = tryParseDate(parts[0].trim())
      const end = tryParseDate(parts[1].trim())
      if (start && end) return { periodStart: start, periodEnd: end }
    }
    // Single date
    const single = tryParseDate(val)
    if (single) return { periodStart: single, periodEnd: single }
  }

  // 2. Try to extract dates from filename
  // Pattern: Weekly_3-22-2026_3-28-2026 or Weekly_2026-03-22_2026-03-28
  if (fileName) {
    // Match M-D-YYYY_M-D-YYYY pattern
    const fnMatch = fileName.match(/(\d{1,2})-(\d{1,2})-(\d{4})[_\s]+(\d{1,2})-(\d{1,2})-(\d{4})/)
    if (fnMatch) {
      const start = `${fnMatch[3]}-${fnMatch[1].padStart(2, "0")}-${fnMatch[2].padStart(2, "0")}`
      const end = `${fnMatch[6]}-${fnMatch[4].padStart(2, "0")}-${fnMatch[5].padStart(2, "0")}`
      return { periodStart: start, periodEnd: end }
    }
    // Match YYYY-MM-DD_YYYY-MM-DD pattern
    const isoMatch = fileName.match(/(\d{4}-\d{2}-\d{2})[_\s]+(\d{4}-\d{2}-\d{2})/)
    if (isoMatch) {
      return { periodStart: isoMatch[1], periodEnd: isoMatch[2] }
    }
  }

  // 3. Look for any date-like column in the data
  for (const row of rows.slice(0, 5)) {
    for (const val of Object.values(row)) {
      if (val && typeof val === "string") {
        const parts = val.split(/\s*[-–]\s*/)
        if (parts.length === 2) {
          const start = tryParseDate(parts[0].trim())
          const end = tryParseDate(parts[1].trim())
          if (start && end) return { periodStart: start, periodEnd: end }
        }
      }
    }
  }

  // 4. Default to current week
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - now.getDay() + 1)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return {
    periodStart: monday.toISOString().split("T")[0],
    periodEnd: sunday.toISOString().split("T")[0],
  }
}

function tryParseDate(value: string): string | null {
  if (!value) return null
  // Try ISO format first
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  // Try MM/DD/YYYY
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (match) {
    const year = match[3].length === 2 ? `20${match[3]}` : match[3]
    return `${year}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`
  }
  // Try Date constructor as fallback
  const d = new Date(value)
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0]
  return null
}

const BRAND_TERMS = ["cuckoo"]
function isBrandedQuery(query: string): boolean {
  const lower = query.toLowerCase()
  return BRAND_TERMS.some(b => lower.includes(b))
}

// Source category mapping
const SOURCE_CATEGORIES: Record<string, string> = {
  "ARA Sales": "sales",
  "ARA Sales - Ordered Revenue": "sales",
  "ARA Sales - Shipped Revenue": "sales",
  "ARA Traffic": "traffic",
  "ARA Inventory": "operations",
  "SP Campaign Report": "advertising",
  "SP Advertised Product Report": "advertising",
  "SP Search Term Report": "advertising",
  "SB Campaign Report": "advertising",
  "Search Query Performance": "search",
  "Search Catalog Performance": "search",
  "Market Basket Analysis": "search",
  "Repeat Purchase Behavior": "search",
  "Demographics": "search",
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Supabase not configured" },
        { status: 500 }
      )
    }

    const supabase = getSupabase()

    const formData = await request.formData()
    const file = formData.get("file") as File
    const sourceNameInput = formData.get("source_name") as string
    const marketplace = (formData.get("marketplace") as string) || "US"

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const timestamp = Date.now()
    const storagePath = `uploads/${timestamp}_${file.name}`

    // 1. Upload to storage (non-blocking, continue on error)
    supabase.storage.from("uploads").upload(storagePath, fileBuffer, {
      contentType: file.type || "application/octet-stream",
    }).catch(() => { /* storage is optional */ })

    // 2. Parse file (CSV or XLSX)
    let columns: string[] = []
    let rows: Record<string, string>[] = []
    const ext = file.name.split(".").pop()?.toLowerCase()

    if (ext === "csv") {
      const fileText = fileBuffer.toString("utf-8")
      const parseResult = Papa.parse<Record<string, string>>(fileText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h: string) => h.trim(),
      })
      columns = parseResult.meta.fields || []
      rows = parseResult.data
    } else if (ext === "xlsx" || ext === "xls") {
      const workbook = XLSX.read(fileBuffer, { type: "buffer" })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" })

      if (jsonData.length > 0) {
        columns = Object.keys(jsonData[0]).map(c => String(c).trim())
        rows = jsonData.map(row => {
          const cleaned: Record<string, string> = {}
          for (const [key, value] of Object.entries(row)) {
            cleaned[key.trim()] = value != null ? String(value).trim() : ""
          }
          return cleaned
        })
      }
    } else {
      return NextResponse.json({ error: "Unsupported file type. Use CSV or XLSX." }, { status: 400 })
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: "File is empty or could not be parsed" }, { status: 400 })
    }

    // 3. Detect source type
    const sourceName = sourceNameInput || detectSourceType(columns)
    if (!sourceName) {
      return NextResponse.json({
        error: "Could not detect report type. Please select the report type manually.",
        detected_columns: columns.slice(0, 20),
      }, { status: 400 })
    }

    const sourceCategory = SOURCE_CATEGORIES[sourceName] || "sales"

    // 4. Auto-map columns
    const columnMapping = autoMapColumns(columns)
    const mappedCount = Object.keys(columnMapping).length

    // 5. Get marketplace ID
    const { data: mkt } = await supabase
      .from("dim_marketplace")
      .select("marketplace_id")
      .eq("country_code", marketplace)
      .single()

    if (!mkt) {
      return NextResponse.json({ error: `Marketplace not found: ${marketplace}` }, { status: 400 })
    }
    const marketplaceId = mkt.marketplace_id

    // 6. Get or create report source
    const { data: src } = await supabase
      .from("dim_report_source")
      .select("source_id")
      .eq("source_name", sourceName)
      .single()

    // 7. Create batch record
    const { data: batch, error: batchError } = await supabase
      .from("dim_upload_batch")
      .insert({
        file_name: file.name,
        file_path: storagePath,
        file_size_bytes: file.size,
        source_id: src?.source_id || null,
        marketplace_id: marketplaceId,
        status: "processing",
        row_count_raw: rows.length,
        column_mapping: columnMapping,
        processing_log: [{
          timestamp: new Date().toISOString(),
          message: `File parsed: ${rows.length} rows, ${mappedCount}/${columns.length} columns mapped. Source: ${sourceName}`,
          level: "info",
        }],
      })
      .select()
      .single()

    if (batchError || !batch) {
      console.error("Batch creation error:", batchError)
      return NextResponse.json({ error: "Failed to create upload record: " + batchError?.message }, { status: 500 })
    }

    const batchId = batch.batch_id

    // 8. Process rows based on source category
    let loadedCount = 0
    let errorCount = 0
    const errors: Array<{ row: number; message: string }> = []
    const { periodStart, periodEnd } = detectPeriodDates(rows, columnMapping, file.name)

    for (let i = 0; i < rows.length; i++) {
      try {
        // Map columns
        const raw = rows[i]
        const mapped: Record<string, string> = {}
        for (const [srcCol, canonCol] of Object.entries(columnMapping)) {
          if (raw[srcCol] !== undefined) {
            mapped[canonCol] = raw[srcCol]
          }
        }

        const asin = normalizeAsin(mapped.asin)

        // Upsert product if we have an ASIN
        let productId: string | null = null
        if (asin) {
          const { data: existing } = await supabase
            .from("dim_product")
            .select("product_id")
            .eq("asin", asin)
            .single()

          if (existing) {
            productId = existing.product_id
            // Update title if available
            if (mapped.product_title) {
              await supabase.from("dim_product")
                .update({ product_title: mapped.product_title, last_seen_date: periodEnd })
                .eq("product_id", productId)
            }
          } else {
            const { data: newProduct } = await supabase
              .from("dim_product")
              .insert({
                asin,
                product_title: mapped.product_title || null,
                subcategory: mapped.subcategory || null,
                brand: "CUCKOO",
                is_active: true,
                first_seen_date: periodStart,
                last_seen_date: periodEnd,
              })
              .select("product_id")
              .single()
            productId = newProduct?.product_id || null
          }
        }

        // Load into appropriate fact table
        if (sourceCategory === "sales" && productId) {
          await supabase.from("fact_sales").upsert({
            period_start: periodStart,
            period_end: periodEnd,
            grain: "weekly",
            product_id: productId,
            marketplace_id: marketplaceId,
            batch_id: batchId,
            ordered_revenue: parseNumeric(mapped.ordered_revenue),
            ordered_units: Math.round(parseNumeric(mapped.ordered_units)),
            shipped_revenue: parseNumeric(mapped.shipped_revenue),
            shipped_units: Math.round(parseNumeric(mapped.shipped_units)),
            shipped_cogs: parseNumeric(mapped.shipped_cogs),
            avg_selling_price: parseNumeric(mapped.avg_selling_price),
            ordered_revenue_prior: mapped.ordered_revenue_prior ? parseNumeric(mapped.ordered_revenue_prior) : null,
            ordered_revenue_ly: mapped.ordered_revenue_ly ? parseNumeric(mapped.ordered_revenue_ly) : null,
            ordered_units_prior: mapped.ordered_units_prior ? Math.round(parseNumeric(mapped.ordered_units_prior)) : null,
            ordered_units_ly: mapped.ordered_units_ly ? Math.round(parseNumeric(mapped.ordered_units_ly)) : null,
          }, { onConflict: "period_start,period_end,product_id,marketplace_id,batch_id" })
          loadedCount++
        } else if (sourceCategory === "traffic" && productId) {
          await supabase.from("fact_traffic_conversion").upsert({
            period_start: periodStart,
            period_end: periodEnd,
            grain: "weekly",
            product_id: productId,
            marketplace_id: marketplaceId,
            batch_id: batchId,
            glance_views: Math.round(parseNumeric(mapped.glance_views)),
            glance_views_prior: mapped.glance_views_prior ? Math.round(parseNumeric(mapped.glance_views_prior)) : null,
            glance_views_ly: mapped.glance_views_ly ? Math.round(parseNumeric(mapped.glance_views_ly)) : null,
          }, { onConflict: "period_start,period_end,product_id,marketplace_id,batch_id" })
          loadedCount++
        } else if (sourceCategory === "advertising") {
          // Parse date for daily ad data
          const dateKey = tryParseDate(mapped.date_key)
          if (!dateKey) {
            errors.push({ row: i + 1, message: "Could not parse date" })
            errorCount++
            continue
          }

          // Upsert campaign
          let campaignId: string | null = null
          if (mapped.campaign_name) {
            const campaignType = sourceName.startsWith("SB") ? "SB" : "SP"
            const { data: existingCampaign } = await supabase
              .from("dim_campaign")
              .select("campaign_id")
              .eq("campaign_name", mapped.campaign_name)
              .eq("campaign_type", campaignType)
              .single()

            if (existingCampaign) {
              campaignId = existingCampaign.campaign_id
            } else {
              const { data: newCampaign } = await supabase
                .from("dim_campaign")
                .insert({
                  campaign_name: mapped.campaign_name,
                  campaign_type: campaignType,
                  status: "active",
                  first_seen_date: dateKey,
                })
                .select("campaign_id")
                .single()
              campaignId = newCampaign?.campaign_id || null
            }
          }

          const adSpend = parseNumeric(mapped.spend)
          const adSales = parseNumeric(mapped.ad_sales)
          const adClicks = Math.round(parseNumeric(mapped.clicks))
          const adImpressions = Math.round(parseNumeric(mapped.impressions))

          await supabase.from("fact_advertising").insert({
            date_key: dateKey,
            product_id: productId,
            campaign_id: campaignId,
            marketplace_id: marketplaceId,
            batch_id: batchId,
            impressions: adImpressions,
            clicks: adClicks,
            spend: adSpend,
            ad_sales: adSales,
            ad_units: Math.round(parseNumeric(mapped.ad_units)),
            orders: Math.round(parseNumeric(mapped.orders)),
            ctr: adImpressions > 0 ? adClicks / adImpressions : 0,
            cpc: adClicks > 0 ? adSpend / adClicks : 0,
            acos: adSales > 0 ? adSpend / adSales : 0,
            roas: adSpend > 0 ? adSales / adSpend : 0,
          })
          loadedCount++
        } else if (sourceCategory === "search") {
          // Search visibility data
          if (mapped.query_text) {
            const queryNormalized = mapped.query_text.trim().toLowerCase()
            // Upsert query
            const { data: existingQuery } = await supabase
              .from("dim_query_keyword")
              .select("query_id")
              .eq("query_normalized", queryNormalized)
              .single()

            let queryId: string | null = null
            if (existingQuery) {
              queryId = existingQuery.query_id
            } else {
              const { data: newQuery } = await supabase
                .from("dim_query_keyword")
                .insert({
                  query_text: mapped.query_text.trim(),
                  query_normalized: queryNormalized,
                  is_branded: isBrandedQuery(mapped.query_text),
                  brand_match_type: isBrandedQuery(mapped.query_text) ? "contains" : "none",
                  first_seen_date: periodStart,
                })
                .select("query_id")
                .single()
              queryId = newQuery?.query_id || null
            }

            await supabase.from("fact_search_visibility").insert({
              period_start: periodStart,
              period_end: periodEnd,
              product_id: productId,
              query_id: queryId,
              marketplace_id: marketplaceId,
              batch_id: batchId,
              search_query_volume: Math.round(parseNumeric(mapped.search_query_volume)),
              search_query_rank: mapped.search_query_rank ? Math.round(parseNumeric(mapped.search_query_rank)) : null,
              impressions: Math.round(parseNumeric(mapped.impressions)),
              clicks: Math.round(parseNumeric(mapped.clicks)),
              cart_adds: Math.round(parseNumeric(mapped.cart_adds)),
              purchases: Math.round(parseNumeric(mapped.purchases)),
              impression_share: parsePercentage(mapped.impression_share),
              click_share: parsePercentage(mapped.click_share),
              purchase_share: parsePercentage(mapped.purchase_share),
            })
            loadedCount++
          } else if (productId) {
            // Search Catalog Performance (no query, just ASIN)
            await supabase.from("fact_search_visibility").insert({
              period_start: periodStart,
              period_end: periodEnd,
              product_id: productId,
              marketplace_id: marketplaceId,
              batch_id: batchId,
              impressions: Math.round(parseNumeric(mapped.impressions)),
              clicks: Math.round(parseNumeric(mapped.clicks)),
              cart_adds: Math.round(parseNumeric(mapped.cart_adds)),
              purchases: Math.round(parseNumeric(mapped.purchases)),
              impression_share: parsePercentage(mapped.impression_share),
              click_share: parsePercentage(mapped.click_share),
              purchase_share: parsePercentage(mapped.purchase_share),
            })
            loadedCount++
          }
        } else if (sourceCategory === "operations" && productId) {
          await supabase.from("fact_operational_health").upsert({
            period_start: periodStart,
            period_end: periodEnd,
            grain: "weekly",
            product_id: productId,
            marketplace_id: marketplaceId,
            batch_id: batchId,
            sellthrough_rate: parsePercentage(mapped.sellthrough_rate),
            open_po_units: Math.round(parseNumeric(mapped.open_po_units)),
            available_units: Math.round(parseNumeric(mapped.available_units)),
            weeks_of_cover: parseNumeric(mapped.weeks_of_cover),
            aged_90plus_units: Math.round(parseNumeric(mapped.aged_90plus_units)),
          }, { onConflict: "period_start,period_end,product_id,marketplace_id,batch_id" })
          loadedCount++
        } else {
          if (!productId && asin === null) {
            errors.push({ row: i + 1, message: "No valid ASIN found" })
            errorCount++
          }
        }
      } catch (err) {
        errorCount++
        errors.push({ row: i + 1, message: String(err) })
      }
    }

    // 9. Update batch status
    await supabase.from("dim_upload_batch").update({
      status: errorCount > 0 && loadedCount === 0 ? "failed" : "completed",
      row_count_loaded: loadedCount,
      row_count_errors: errorCount,
      date_range_start: periodStart,
      date_range_end: periodEnd,
      completed_at: new Date().toISOString(),
      processing_log: [
        ...batch.processing_log,
        {
          timestamp: new Date().toISOString(),
          message: `Processing complete: ${loadedCount} rows loaded, ${errorCount} errors`,
          level: loadedCount > 0 ? "info" : "error",
        },
      ],
      error_log: errors.slice(0, 50), // Cap at 50 error entries
    }).eq("batch_id", batchId)

    return NextResponse.json({
      batch_id: batchId,
      file_name: file.name,
      source_name: sourceName,
      source_category: sourceCategory,
      status: loadedCount > 0 ? "completed" : "failed",
      rows_raw: rows.length,
      rows_loaded: loadedCount,
      rows_errors: errorCount,
      columns_mapped: mappedCount,
      columns_total: columns.length,
      date_range: [periodStart, periodEnd],
      errors: errors.slice(0, 10),
    })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json(
      { error: "Internal server error: " + String(error) },
      { status: 500 }
    )
  }
}
