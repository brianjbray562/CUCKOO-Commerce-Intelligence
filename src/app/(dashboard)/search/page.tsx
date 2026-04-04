import { KpiCard } from "@/components/charts/kpi-card"
import { TrendChart } from "@/components/charts/trend-chart"
import { DataTable, type Column } from "@/components/charts/data-table"
import { AlertCircle } from "lucide-react"
import { getSearchSummary } from "@/lib/data-access"

interface QueryRow {
  query_text: string
  is_branded: boolean
  search_query_volume: number
  impressions: number
  clicks: number
  purchases: number
  impression_share: number
  click_share: number
}

const COLUMNS: Column<QueryRow>[] = [
  { key: "query_text", label: "Search Query", sortable: true, width: "250px" },
  { key: "is_branded", label: "Branded", sortable: true },
  { key: "search_query_volume", label: "Volume", format: "number", sortable: true, align: "right" },
  { key: "impressions", label: "Impressions", format: "number", sortable: true, align: "right" },
  { key: "clicks", label: "Clicks", format: "number", sortable: true, align: "right" },
  { key: "purchases", label: "Purchases", format: "number", sortable: true, align: "right" },
  { key: "impression_share", label: "Imp. Share", format: "percent", sortable: true, align: "right" },
  { key: "click_share", label: "Click Share", format: "percent", sortable: true, align: "right" },
]

export default async function SearchPage() {
  const searchData = await getSearchSummary()

  // Aggregate totals
  const totalImpressions = searchData.reduce((sum, r) => sum + Number(r.impressions || 0), 0)
  const totalSearchQueryVolume = searchData.reduce((sum, r) => sum + Number(r.search_query_volume || 0), 0)

  // Avg impression share (weighted by search volume)
  const avgImpressionShare =
    totalSearchQueryVolume > 0
      ? searchData.reduce(
          (sum, r) => sum + Number(r.impression_share || 0) * Number(r.search_query_volume || 0),
          0
        ) / totalSearchQueryVolume
      : 0

  // Branded query share: impressions from branded queries / total impressions
  const brandedImpressions = searchData
    .filter((r) => {
      const kw = r.dim_query_keyword as unknown as { is_branded: boolean } | null
      return kw?.is_branded === true
    })
    .reduce((sum, r) => sum + Number(r.impressions || 0), 0)
  const brandedQueryShare = totalImpressions > 0 ? brandedImpressions / totalImpressions : 0

  // Count distinct queries
  const queryIds = new Set(searchData.map((r) => r.query_id).filter(Boolean))
  const trackedQueriesCount = queryIds.size

  // Build query rows — aggregate by query_text
  const queryMap = new Map<string, QueryRow>()
  for (const row of searchData) {
    const kw = row.dim_query_keyword as unknown as { query_text: string; is_branded: boolean } | null
    const queryText = kw?.query_text || "Unknown"
    const existing = queryMap.get(queryText)
    if (existing) {
      existing.search_query_volume += Number(row.search_query_volume || 0)
      existing.impressions += Number(row.impressions || 0)
      existing.clicks += Number(row.clicks || 0)
      existing.purchases += Number(row.purchases || 0)
      // Accumulate weighted impression_share and click_share for averaging later
    } else {
      queryMap.set(queryText, {
        query_text: queryText,
        is_branded: kw?.is_branded ?? false,
        search_query_volume: Number(row.search_query_volume || 0),
        impressions: Number(row.impressions || 0),
        clicks: Number(row.clicks || 0),
        purchases: Number(row.purchases || 0),
        impression_share: Number(row.impression_share || 0),
        click_share: Number(row.click_share || 0),
      })
    }
  }

  const queryRows: QueryRow[] = Array.from(queryMap.values()).sort(
    (a, b) => b.search_query_volume - a.search_query_volume
  )

  const hasData = searchData.length > 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Search & Brand Analytics</h2>
        <p className="text-sm text-muted-foreground">
          Search query performance, catalog visibility, branded vs non-branded demand analysis
        </p>
      </div>

      {!hasData && (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
          <div className="text-sm text-muted-foreground">
            <p>Upload <strong>Search Query Performance</strong> or <strong>Search Catalog Performance</strong> reports from Brand Analytics to populate this view. These reports come from your 3P Brand Analytics account.</p>
            <p className="mt-1">Note: Search data is typically available at weekly grain. Daily comparisons are not possible with this data source.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Total Search Impressions" value={totalImpressions} format="compact" source="fact_search_visibility" />
        <KpiCard label="Avg Impression Share" value={avgImpressionShare} format="percent" source="fact_search_visibility" />
        <KpiCard label="Branded Query Share" value={brandedQueryShare} format="percent" tooltip="% of impressions from branded queries" />
        <KpiCard label="Tracked Queries" value={trackedQueriesCount} format="number" source="dim_query_keyword" />
      </div>

      <TrendChart
        data={[]}
        title="Search Impression Share Trend"
        lines={[
          { dataKey: "impression_share", label: "Impression Share", color: "var(--chart-1)", format: "percent" },
          { dataKey: "click_share", label: "Click Share", color: "var(--chart-2)", format: "percent" },
          { dataKey: "purchase_share", label: "Purchase Share", color: "var(--chart-3)", format: "percent" },
        ]}
      />

      <DataTable<QueryRow>
        data={queryRows}
        columns={COLUMNS}
        title="Top Search Queries"
        emptyMessage="Upload Search Query Performance data to see query-level insights"
      />

      <div className="rounded-lg border border-border bg-muted/20 p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Business Questions This View Answers</h4>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          <li>Are we capturing search demand for our key terms?</li>
          <li>What share of our visibility comes from branded vs non-branded queries?</li>
          <li>Are we creating new demand (non-branded) or capturing existing demand (branded)?</li>
          <li>Which queries are we losing share on? Where are competitors gaining?</li>
        </ul>
      </div>
    </div>
  )
}
