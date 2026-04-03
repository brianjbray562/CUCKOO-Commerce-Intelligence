"use client"

import { KpiCard } from "@/components/charts/kpi-card"
import { TrendChart } from "@/components/charts/trend-chart"
import { DataTable, type Column } from "@/components/charts/data-table"
import { AlertCircle } from "lucide-react"

interface OpsRow {
  asin: string
  product_title: string
  sellthrough_rate: number
  available_units: number
  open_po_units: number
  weeks_of_cover: number
  aged_90plus_units: number
}

const COLUMNS: Column<OpsRow>[] = [
  { key: "asin", label: "ASIN", format: "asin", sortable: true },
  { key: "product_title", label: "Product", sortable: true, width: "250px" },
  { key: "sellthrough_rate", label: "Sellthrough Rate", format: "percent", sortable: true, align: "right" },
  { key: "available_units", label: "Available", format: "number", sortable: true, align: "right" },
  { key: "open_po_units", label: "Open PO Units", format: "number", sortable: true, align: "right" },
  { key: "weeks_of_cover", label: "Weeks of Cover", format: "number", sortable: true, align: "right" },
  { key: "aged_90plus_units", label: "Aged 90+ Units", format: "number", sortable: true, align: "right" },
]

export default function OperationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Operations & Inventory Health</h2>
        <p className="text-sm text-muted-foreground">
          ARA Inventory sellthrough rate, open POs, weeks of cover, and stock availability
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
        <AlertCircle className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
        <div className="text-sm text-muted-foreground">
          <p>Upload <strong>ARA Inventory</strong> from Vendor Central to populate this view.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Avg Sellthrough Rate" value={0} format="percent" source="ARA Inventory" />
        <KpiCard label="Avg Weeks of Cover" value={0} format="number" source="ARA Inventory" />
        <KpiCard label="Open PO Units" value={0} format="number" source="ARA Inventory" />
        <KpiCard label="Aged 90+ Day Units" value={0} format="number" source="ARA Inventory" />
      </div>

      <TrendChart
        data={[]}
        title="Sellthrough Rate Trend"
        lines={[
          { dataKey: "sellthrough_rate", label: "Sellthrough Rate", color: "var(--chart-1)", format: "percent" },
        ]}
      />

      <DataTable<OpsRow>
        data={[]}
        columns={COLUMNS}
        title="Inventory Health by ASIN"
        emptyMessage="Upload ARA Inventory reports to see inventory health metrics"
      />
    </div>
  )
}
