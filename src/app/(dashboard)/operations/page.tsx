"use client"

import { KpiCard } from "@/components/charts/kpi-card"
import { TrendChart } from "@/components/charts/trend-chart"
import { DataTable, type Column } from "@/components/charts/data-table"
import { AlertCircle } from "lucide-react"

interface OpsRow {
  asin: string
  product_title: string
  in_stock_rate: number
  available_units: number
  buy_box_win_rate: number
  content_score: number
  has_a_plus: boolean
}

const COLUMNS: Column<OpsRow>[] = [
  { key: "asin", label: "ASIN", format: "asin", sortable: true },
  { key: "product_title", label: "Product", sortable: true, width: "250px" },
  { key: "in_stock_rate", label: "In-Stock Rate", format: "percent", sortable: true, align: "right" },
  { key: "available_units", label: "Available", format: "number", sortable: true, align: "right" },
  { key: "buy_box_win_rate", label: "Buy Box %", format: "percent", sortable: true, align: "right" },
  { key: "content_score", label: "Content Score", format: "number", sortable: true, align: "right" },
]

export default function OperationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Operations & Retail Readiness</h2>
        <p className="text-sm text-muted-foreground">
          Inventory health, buy box ownership, content quality, and listing completeness
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
        <AlertCircle className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
        <div className="text-sm text-muted-foreground">
          <p>Upload <strong>Inventory Health Reports</strong> and <strong>Content Quality Exports</strong> to populate this view.</p>
          <p className="mt-1">This is Phase 2 functionality. The data model is ready — upload operational reports to activate.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Avg In-Stock Rate" value={0} format="percent" source="fact_operational_health" />
        <KpiCard label="Avg Buy Box Win" value={0} format="percent" source="fact_operational_health" />
        <KpiCard label="Avg Content Score" value={0} format="number" source="fact_operational_health" />
        <KpiCard label="ASINs with A+" value={0} format="number" source="fact_operational_health" />
      </div>

      <TrendChart
        data={[]}
        title="In-Stock Rate Trend"
        lines={[
          { dataKey: "in_stock_rate", label: "In-Stock Rate", color: "var(--chart-1)", format: "percent" },
        ]}
      />

      <DataTable<OpsRow>
        data={[]}
        columns={COLUMNS}
        title="Retail Readiness by ASIN"
        emptyMessage="Upload operational reports to see retail readiness metrics"
      />
    </div>
  )
}
