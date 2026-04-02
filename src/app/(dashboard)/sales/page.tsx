"use client"

import { KpiCard } from "@/components/charts/kpi-card"
import { TrendChart } from "@/components/charts/trend-chart"
import { DataTable, type Column } from "@/components/charts/data-table"
import { useRouter } from "next/navigation"
import { AlertCircle } from "lucide-react"

interface SalesAsinRow {
  asin: string
  product_title: string
  ordered_revenue: number
  ordered_units: number
  avg_selling_price: number
  shipped_revenue: number
  shipped_units: number
  revenue_share: number
}

const COLUMNS: Column<SalesAsinRow>[] = [
  { key: "asin", label: "ASIN", format: "asin", sortable: true },
  { key: "product_title", label: "Product", sortable: true, width: "250px" },
  { key: "ordered_revenue", label: "Ordered Revenue", format: "currency", sortable: true, align: "right" },
  { key: "ordered_units", label: "Units", format: "number", sortable: true, align: "right" },
  { key: "avg_selling_price", label: "ASP", format: "currency", sortable: true, align: "right" },
  { key: "shipped_revenue", label: "Shipped Revenue", format: "currency", sortable: true, align: "right" },
  { key: "shipped_units", label: "Shipped Units", format: "number", sortable: true, align: "right" },
  { key: "revenue_share", label: "% of Total", format: "percent", sortable: true, align: "right" },
]

export default function SalesPage() {
  const router = useRouter()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Sales Performance</h2>
        <p className="text-sm text-muted-foreground">
          Amazon 1P ordered and shipped revenue, units, and ASP analysis
        </p>
      </div>

      {/* Empty state */}
      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
        <AlertCircle className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
        <div className="text-sm text-muted-foreground">
          <p>Upload <strong>Amazon Retail Analytics</strong> or <strong>Business Reports</strong> to populate this view.</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Ordered Revenue" value={0} format="currency" tooltip="SUM(ordered_revenue)" source="fact_sales" />
        <KpiCard label="Ordered Units" value={0} format="number" tooltip="SUM(ordered_units)" source="fact_sales" />
        <KpiCard label="ASP" value={0} format="currency" tooltip="ordered_revenue / ordered_units" source="fact_sales" />
        <KpiCard label="Active ASINs" value={0} format="number" tooltip="COUNT(DISTINCT product_id)" source="fact_sales" />
      </div>

      {/* Revenue trend */}
      <TrendChart
        data={[]}
        title="Revenue Trend"
        lines={[
          { dataKey: "ordered_revenue", label: "Ordered Revenue", color: "var(--chart-1)", format: "currency" },
          { dataKey: "shipped_revenue", label: "Shipped Revenue", color: "var(--chart-2)", format: "currency" },
        ]}
      />

      {/* Units + ASP */}
      <div className="grid gap-6 lg:grid-cols-2">
        <TrendChart
          data={[]}
          title="Units Ordered"
          lines={[
            { dataKey: "ordered_units", label: "Units", color: "var(--chart-1)", format: "number" },
          ]}
        />
        <TrendChart
          data={[]}
          title="Average Selling Price"
          lines={[
            { dataKey: "avg_asp", label: "ASP", color: "var(--chart-3)", format: "currency" },
          ]}
        />
      </div>

      {/* ASIN breakdown */}
      <DataTable<SalesAsinRow>
        data={[]}
        columns={COLUMNS}
        title="ASIN Sales Breakdown"
        emptyMessage="Upload sales data to see ASIN breakdown"
        onRowClick={(row) => router.push(`/products/${row.asin}`)}
      />

      <div className="rounded-lg border border-border bg-muted/20 p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Business Questions This View Answers</h4>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          <li>Is total revenue growing or declining? At what rate?</li>
          <li>Is growth driven by units or price? Is ASP trending up or down?</li>
          <li>Which ASINs contribute the most revenue? Is the portfolio concentrated or diversified?</li>
          <li>Is there a gap between ordered and shipped revenue (indicating cancellations or returns)?</li>
        </ul>
      </div>
    </div>
  )
}
