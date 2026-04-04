import { KpiCard } from "@/components/charts/kpi-card"
import { TrendChart } from "@/components/charts/trend-chart"
import { DataTable, type Column } from "@/components/charts/data-table"
import { getOverviewKpis, getTopAsins, getUploadCoverage } from "@/lib/data-access"
import { AlertCircle } from "lucide-react"

interface AsinRow {
  asin: string
  product_title: string
  ordered_revenue: number
  ordered_units: number
  ad_spend: number
  acos: number
  sessions: number
  conversion_rate: number
}

const ASIN_COLUMNS: Column<AsinRow>[] = [
  { key: "asin", label: "ASIN", format: "asin", sortable: true },
  { key: "product_title", label: "Product", sortable: true, width: "250px" },
  { key: "ordered_revenue", label: "Revenue", format: "currency", sortable: true, align: "right" },
  { key: "ordered_units", label: "Units", format: "number", sortable: true, align: "right" },
  { key: "ad_spend", label: "Ad Spend", format: "currency", sortable: true, align: "right" },
  { key: "acos", label: "ACoS", format: "percent", sortable: true, align: "right" },
  { key: "sessions", label: "Glance Views", format: "number", sortable: true, align: "right" },
  { key: "conversion_rate", label: "CVR", format: "percent", sortable: true, align: "right" },
]

export default async function OverviewPage() {
  const [kpis, topAsins, uploadCoverage] = await Promise.all([
    getOverviewKpis(),
    getTopAsins(),
    getUploadCoverage(),
  ])

  const hasData = uploadCoverage.length > 0

  const kpiCards = [
    { label: "Ordered Revenue", value: kpis.orderedRevenue, format: "currency" as const, tooltip: "SUM(ordered_revenue) from fact_sales", source: "fact_sales" },
    { label: "Units Ordered", value: kpis.orderedUnits, format: "number" as const, tooltip: "SUM(ordered_units) from fact_sales", source: "fact_sales" },
    { label: "Average Selling Price", value: kpis.asp, format: "currency" as const, tooltip: "ordered_revenue / ordered_units", source: "fact_sales" },
    { label: "Ad Spend", value: kpis.adSpend, format: "currency" as const, tooltip: "SUM(spend) from fact_advertising", source: "fact_advertising" },
    { label: "Ad Sales (Attributed)", value: kpis.adSales, format: "currency" as const, tooltip: "SUM(ad_sales) from fact_advertising", source: "fact_advertising" },
    { label: "ROAS", value: kpis.roas, format: "number" as const, tooltip: "ad_sales / spend", source: "fact_advertising" },
    { label: "TACoS", value: kpis.tacos, format: "percent" as const, tooltip: "SUM(ad_spend) / SUM(total_revenue)", source: "fact_advertising + fact_sales" },
    { label: "Glance Views", value: kpis.glanceViews, format: "compact" as const, tooltip: "SUM(glance_views) from ARA Traffic", source: "ARA Traffic" },
  ]

  const asinRows: AsinRow[] = topAsins.map((item) => ({
    asin: item.asin,
    product_title: item.product_title,
    ordered_revenue: item.ordered_revenue,
    ordered_units: item.ordered_units,
    ad_spend: 0,
    acos: 0,
    sessions: 0,
    conversion_rate: 0,
  }))

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h2 className="text-xl font-bold text-foreground">Executive Overview</h2>
        <p className="text-sm text-muted-foreground">
          Unified view of sales, advertising, traffic, and conversion performance
        </p>
      </div>

      {/* Data coverage notice — only shown when no completed uploads exist */}
      {!hasData && (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">No data uploaded yet</p>
            <p className="mt-1">
              Go to <a href="/data-management" className="font-medium text-primary underline">Data Management</a> to
              upload your first report. Start with ARA Sales (Ordered Revenue) for the best initial view.
            </p>
          </div>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {kpiCards.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      {/* Revenue + Ad Spend Trend */}
      <div className="grid gap-6 lg:grid-cols-2">
        <TrendChart
          data={[]}
          title="Revenue & Ad Spend Trend"
          lines={[
            { dataKey: "total_revenue", label: "Revenue", color: "var(--chart-1)", format: "currency" },
            { dataKey: "total_ad_spend", label: "Ad Spend", color: "var(--chart-3)", format: "currency", yAxisId: "right" },
          ]}
          dualAxis
        />
        <TrendChart
          data={[]}
          title="Efficiency Metrics"
          lines={[
            { dataKey: "avg_acos", label: "ACoS", color: "var(--chart-4)", format: "percent" },
            { dataKey: "avg_tacos", label: "TACoS", color: "var(--chart-2)", format: "percent" },
            { dataKey: "avg_conversion_rate", label: "Conversion Rate", color: "var(--chart-1)", format: "percent" },
          ]}
        />
      </div>

      {/* Traffic + Conversion */}
      <TrendChart
        data={[]}
        title="Glance Views & Conversion Rate"
        lines={[
          { dataKey: "total_glance_views", label: "Glance Views", color: "var(--chart-1)", format: "number" },
          { dataKey: "avg_conversion_rate", label: "CVR", color: "var(--chart-2)", format: "percent", yAxisId: "right" },
        ]}
        dualAxis
      />

      {/* Top ASINs */}
      <DataTable<AsinRow>
        data={asinRows}
        columns={ASIN_COLUMNS}
        title="Top ASINs by Revenue"
        emptyMessage="Upload sales data to see ASIN performance"
      />

      {/* Interpretation note */}
      <div className="rounded-lg border border-border bg-muted/20 p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data Interpretation Notes</h4>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          <li>Ad Sales are attributed revenue (7-day or 14-day attribution window depending on campaign type). They are not additive with organic sales.</li>
          <li>TACoS = Total Ad Spend / Total Ordered Revenue. Lower is better. This is the key efficiency metric connecting ads to total business.</li>
          <li>Conversion Rate = Units Ordered / Glance Views. This uses ARA Traffic data (weekly grain).</li>
          <li>All metrics reflect data coverage. If a report type has not been uploaded for a date range, those metrics will show as zero, not missing.</li>
        </ul>
      </div>
    </div>
  )
}
