export const dynamic = 'force-dynamic'

import { KpiCard } from "@/components/charts/kpi-card"
import { TrendChart } from "@/components/charts/trend-chart"
import { DataTable, type Column } from "@/components/charts/data-table"
import { AlertCircle } from "lucide-react"
import { getTrafficSummary, getSalesSummary } from "@/lib/data-access"

interface TrafficRow {
  asin: string
  product_title: string
  glance_views: number
  unit_session_percentage: number
  ordered_units: number
}

const COLUMNS: Column<TrafficRow>[] = [
  { key: "asin", label: "ASIN", format: "asin", sortable: true },
  { key: "product_title", label: "Product", sortable: true, width: "250px" },
  { key: "glance_views", label: "Glance Views", format: "number", sortable: true, align: "right" },
  { key: "unit_session_percentage", label: "CVR", format: "percent", sortable: true, align: "right" },
  { key: "ordered_units", label: "Units", format: "number", sortable: true, align: "right" },
]

export default async function TrafficPage() {
  const [trafficData, salesData] = await Promise.all([getTrafficSummary(), getSalesSummary()])

  // Aggregate total glance views
  const totalGlanceViews = trafficData.reduce((sum, r) => sum + Number(r.glance_views || 0), 0)

  // Aggregate total ordered units from sales for conversion rate
  const totalUnits = salesData.reduce((sum, r) => sum + Number(r.ordered_units || 0), 0)
  const avgConversionRate = totalGlanceViews > 0 ? totalUnits / totalGlanceViews : 0

  // Build units lookup by ASIN from sales data
  const unitsByAsin = new Map<string, number>()
  for (const row of salesData) {
    const product = row.dim_product as unknown as { asin: string } | null
    if (!product) continue
    const existing = unitsByAsin.get(product.asin) ?? 0
    unitsByAsin.set(product.asin, existing + Number(row.ordered_units || 0))
  }

  // Aggregate traffic by ASIN
  const asinMap = new Map<string, { asin: string; product_title: string; glance_views: number }>()
  for (const row of trafficData) {
    const product = row.dim_product as unknown as { asin: string; product_title: string } | null
    if (!product) continue
    const existing = asinMap.get(product.asin)
    if (existing) {
      existing.glance_views += Number(row.glance_views || 0)
    } else {
      asinMap.set(product.asin, {
        asin: product.asin,
        product_title: product.product_title || "",
        glance_views: Number(row.glance_views || 0),
      })
    }
  }

  const trafficRows: TrafficRow[] = Array.from(asinMap.values()).map((r) => {
    const units = unitsByAsin.get(r.asin) ?? 0
    return {
      asin: r.asin,
      product_title: r.product_title,
      glance_views: r.glance_views,
      ordered_units: units,
      unit_session_percentage: r.glance_views > 0 ? units / r.glance_views : 0,
    }
  }).sort((a, b) => b.glance_views - a.glance_views)

  const hasData = trafficData.length > 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Traffic & Conversion (Glance Views)</h2>
        <p className="text-sm text-muted-foreground">
          ARA Traffic glance views (detail page views) and conversion rate analysis
        </p>
      </div>

      {!hasData && (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
          <div className="text-sm text-muted-foreground">
            <p>Upload <strong>ARA Traffic</strong> from Vendor Central to populate this view.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
        <KpiCard label="Total Glance Views" value={totalGlanceViews} format="compact" tooltip="SUM(glance_views)" source="ARA Traffic" />
        <KpiCard label="Avg Conversion Rate (Units/GV)" value={avgConversionRate} format="percent" tooltip="ordered_units / glance_views" source="ARA Traffic" />
      </div>

      <TrendChart
        data={[]}
        title="Glance Views & Conversion Rate"
        lines={[
          { dataKey: "glance_views", label: "Glance Views", color: "var(--chart-1)", format: "number" },
          { dataKey: "conversion_rate", label: "CVR", color: "var(--chart-2)", format: "percent", yAxisId: "right" },
        ]}
        dualAxis
      />

      <DataTable<TrafficRow>
        data={trafficRows}
        columns={COLUMNS}
        title="ASIN Traffic Breakdown"
        emptyMessage="Upload traffic data to see ASIN-level traffic metrics"
      />

      <div className="rounded-lg border border-border bg-muted/20 p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Business Questions This View Answers</h4>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          <li>Are we getting enough glance views to our product pages?</li>
          <li>Is our conversion rate healthy? Is it improving or declining?</li>
          <li>Which ASINs have high glance views but low conversion (optimization opportunity)?</li>
          <li>ARA Standard provides weekly data. Daily trends are not available without ARA Premium.</li>
        </ul>
      </div>
    </div>
  )
}
