"use client"

import { KpiCard } from "@/components/charts/kpi-card"
import { TrendChart } from "@/components/charts/trend-chart"
import { DataTable, type Column } from "@/components/charts/data-table"
import { AlertCircle } from "lucide-react"

interface TrafficRow {
  asin: string
  product_title: string
  sessions: number
  page_views: number
  buy_box_percentage: number
  unit_session_percentage: number
  ordered_units: number
}

const COLUMNS: Column<TrafficRow>[] = [
  { key: "asin", label: "ASIN", format: "asin", sortable: true },
  { key: "product_title", label: "Product", sortable: true, width: "250px" },
  { key: "sessions", label: "Sessions", format: "number", sortable: true, align: "right" },
  { key: "page_views", label: "Page Views", format: "number", sortable: true, align: "right" },
  { key: "buy_box_percentage", label: "Buy Box %", format: "percent", sortable: true, align: "right" },
  { key: "unit_session_percentage", label: "CVR", format: "percent", sortable: true, align: "right" },
  { key: "ordered_units", label: "Units", format: "number", sortable: true, align: "right" },
]

export default function TrafficPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Traffic & Conversion</h2>
        <p className="text-sm text-muted-foreground">
          Sessions, page views, buy box ownership, and conversion rate analysis
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
        <AlertCircle className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
        <div className="text-sm text-muted-foreground">
          <p>Upload <strong>Amazon Business Reports (Detail Page Sales and Traffic)</strong> to populate this view.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Total Sessions" value={0} format="compact" tooltip="SUM(sessions)" source="fact_traffic_conversion" />
        <KpiCard label="Total Page Views" value={0} format="compact" tooltip="SUM(page_views)" source="fact_traffic_conversion" />
        <KpiCard label="Avg Conversion Rate" value={0} format="percent" tooltip="ordered_units / sessions" source="fact_traffic_conversion" />
        <KpiCard label="Avg Buy Box %" value={0} format="percent" tooltip="AVG(buy_box_percentage)" source="fact_traffic_conversion" />
      </div>

      <TrendChart
        data={[]}
        title="Sessions & Conversion Rate"
        lines={[
          { dataKey: "sessions", label: "Sessions", color: "var(--chart-1)", format: "number" },
          { dataKey: "conversion_rate", label: "CVR", color: "var(--chart-2)", format: "percent", yAxisId: "right" },
        ]}
        dualAxis
      />

      <TrendChart
        data={[]}
        title="Buy Box Percentage"
        lines={[
          { dataKey: "buy_box_percentage", label: "Buy Box %", color: "var(--chart-3)", format: "percent" },
        ]}
      />

      <DataTable<TrafficRow>
        data={[]}
        columns={COLUMNS}
        title="ASIN Traffic Breakdown"
        emptyMessage="Upload traffic data to see ASIN-level traffic metrics"
      />

      <div className="rounded-lg border border-border bg-muted/20 p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Business Questions This View Answers</h4>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          <li>Are we getting enough traffic to our product pages?</li>
          <li>Is our conversion rate healthy? Is it improving or declining?</li>
          <li>Do we own the Buy Box consistently? Buy Box loss = lost sales.</li>
          <li>Which ASINs have high traffic but low conversion (optimization opportunity)?</li>
        </ul>
      </div>
    </div>
  )
}
