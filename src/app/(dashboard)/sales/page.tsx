import { KpiCard } from "@/components/charts/kpi-card"
import { TrendChart } from "@/components/charts/trend-chart"
import { DataTable, type Column } from "@/components/charts/data-table"
import { AlertCircle } from "lucide-react"
import { getSalesSummary } from "@/lib/data-access"
import { SalesTableWithNav } from "./sales-table-with-nav"

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

export default async function SalesPage() {
  const salesData = await getSalesSummary()

  // Aggregate totals across all rows
  const totalRevenue = salesData.reduce((sum, r) => sum + Number(r.ordered_revenue || 0), 0)
  const totalUnits = salesData.reduce((sum, r) => sum + Number(r.ordered_units || 0), 0)
  const asp = totalUnits > 0 ? totalRevenue / totalUnits : 0

  // Aggregate by ASIN
  const asinMap = new Map<string, SalesAsinRow>()
  for (const row of salesData) {
    const product = row.dim_product as unknown as { asin: string; product_title: string } | null
    if (!product) continue
    const key = product.asin
    const existing = asinMap.get(key)
    if (existing) {
      existing.ordered_revenue += Number(row.ordered_revenue || 0)
      existing.ordered_units += Number(row.ordered_units || 0)
      existing.shipped_revenue += Number(row.shipped_revenue || 0)
      existing.shipped_units += Number(row.shipped_units || 0)
    } else {
      asinMap.set(key, {
        asin: product.asin,
        product_title: product.product_title || "",
        ordered_revenue: Number(row.ordered_revenue || 0),
        ordered_units: Number(row.ordered_units || 0),
        avg_selling_price: Number(row.avg_selling_price || 0),
        shipped_revenue: Number(row.shipped_revenue || 0),
        shipped_units: Number(row.shipped_units || 0),
        revenue_share: 0,
      })
    }
  }

  // Compute revenue share and ASP per ASIN
  const asinRows: SalesAsinRow[] = Array.from(asinMap.values()).map((r) => ({
    ...r,
    avg_selling_price: r.ordered_units > 0 ? r.ordered_revenue / r.ordered_units : 0,
    revenue_share: totalRevenue > 0 ? r.ordered_revenue / totalRevenue : 0,
  })).sort((a, b) => b.ordered_revenue - a.ordered_revenue)

  const activeAsins = asinRows.length
  const hasData = salesData.length > 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Sales Performance</h2>
        <p className="text-sm text-muted-foreground">
          Amazon 1P ordered and shipped revenue, units, and ASP analysis
        </p>
      </div>

      {/* Empty state */}
      {!hasData && (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
          <div className="text-sm text-muted-foreground">
            <p>Upload <strong>ARA Sales (Ordered Revenue)</strong> or <strong>ARA Sales (Shipped Revenue)</strong> from Vendor Central to populate this view.</p>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Ordered Revenue" value={totalRevenue} format="currency" tooltip="SUM(ordered_revenue)" source="fact_sales" />
        <KpiCard label="Ordered Units" value={totalUnits} format="number" tooltip="SUM(ordered_units)" source="fact_sales" />
        <KpiCard label="ASP" value={asp} format="currency" tooltip="ordered_revenue / ordered_units" source="fact_sales" />
        <KpiCard label="Active ASINs" value={activeAsins} format="number" tooltip="COUNT(DISTINCT product_id)" source="fact_sales" />
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

      {/* ASIN breakdown — uses client wrapper for row-click navigation */}
      <SalesTableWithNav data={asinRows} columns={COLUMNS} />

      <div className="rounded-lg border border-border bg-muted/20 p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Business Questions This View Answers</h4>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          <li>Is total revenue growing or declining? At what rate?</li>
          <li>Is growth driven by units or price? Is ASP trending up or down?</li>
          <li>Which ASINs contribute the most revenue? Is the portfolio concentrated or diversified?</li>
          <li>Is there a gap between ordered and shipped revenue (indicating PO shortfalls or returns)?</li>
          <li>What does the COGS data tell us about margin trends?</li>
        </ul>
      </div>
    </div>
  )
}
