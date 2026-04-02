"use client"

import { use } from "react"
import { KpiCard } from "@/components/charts/kpi-card"
import { TrendChart } from "@/components/charts/trend-chart"
import { DataTable, type Column } from "@/components/charts/data-table"
import { ArrowLeft, ExternalLink } from "lucide-react"
import Link from "next/link"

interface CampaignRow {
  campaign_name: string
  campaign_type: string
  spend: number
  ad_sales: number
  acos: number
  impressions: number
  clicks: number
}

const CAMPAIGN_COLUMNS: Column<CampaignRow>[] = [
  { key: "campaign_name", label: "Campaign", sortable: true, width: "250px" },
  { key: "campaign_type", label: "Type", sortable: true },
  { key: "spend", label: "Spend", format: "currency", sortable: true, align: "right" },
  { key: "ad_sales", label: "Ad Sales", format: "currency", sortable: true, align: "right" },
  { key: "acos", label: "ACoS", format: "percent", sortable: true, align: "right" },
  { key: "impressions", label: "Impressions", format: "number", sortable: true, align: "right" },
  { key: "clicks", label: "Clicks", format: "number", sortable: true, align: "right" },
]

export default function AsinDetailPage({ params }: { params: Promise<{ asin: string }> }) {
  const { asin } = use(params)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/products"
          className="flex items-center justify-center rounded-md border border-input bg-background p-2 text-muted-foreground hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-foreground font-mono">{asin}</h2>
            <a
              href={`https://www.amazon.com/dp/${asin}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
          <p className="text-sm text-muted-foreground">Product title will appear here once data is loaded</p>
        </div>
      </div>

      {/* Product info card */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <span className="text-muted-foreground">Parent ASIN</span>
            <p className="font-mono font-medium text-foreground">-</p>
          </div>
          <div>
            <span className="text-muted-foreground">Category</span>
            <p className="font-medium text-foreground">-</p>
          </div>
          <div>
            <span className="text-muted-foreground">Brand</span>
            <p className="font-medium text-foreground">CUCKOO</p>
          </div>
          <div>
            <span className="text-muted-foreground">Status</span>
            <p className="font-medium text-foreground">-</p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5">
        <KpiCard label="Revenue" value={0} format="currency" />
        <KpiCard label="Units" value={0} format="number" />
        <KpiCard label="ASP" value={0} format="currency" />
        <KpiCard label="Ad Spend" value={0} format="currency" />
        <KpiCard label="ACoS" value={0} format="percent" />
        <KpiCard label="ROAS" value={0} format="number" />
        <KpiCard label="TACoS" value={0} format="percent" />
        <KpiCard label="Sessions" value={0} format="compact" />
        <KpiCard label="CVR" value={0} format="percent" />
        <KpiCard label="Buy Box %" value={0} format="percent" />
      </div>

      {/* Revenue + spend trend */}
      <TrendChart
        data={[]}
        title="Revenue & Ad Spend"
        lines={[
          { dataKey: "ordered_revenue", label: "Revenue", color: "var(--chart-1)", format: "currency" },
          { dataKey: "ad_spend", label: "Ad Spend", color: "var(--chart-3)", format: "currency", yAxisId: "right" },
        ]}
        dualAxis
      />

      {/* Traffic + conversion */}
      <TrendChart
        data={[]}
        title="Sessions & Conversion"
        lines={[
          { dataKey: "sessions", label: "Sessions", color: "var(--chart-1)", format: "number" },
          { dataKey: "conversion_rate", label: "CVR", color: "var(--chart-2)", format: "percent", yAxisId: "right" },
        ]}
        dualAxis
      />

      {/* Campaigns for this ASIN */}
      <DataTable<CampaignRow>
        data={[]}
        columns={CAMPAIGN_COLUMNS}
        title="Advertising Campaigns"
        emptyMessage="No advertising data for this ASIN"
      />

      {/* Data coverage */}
      <div className="rounded-lg border border-border bg-muted/20 p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data Coverage for {asin}</h4>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
          <div className="rounded border border-border p-2">
            <p className="font-medium text-foreground">Sales</p>
            <p>No data</p>
          </div>
          <div className="rounded border border-border p-2">
            <p className="font-medium text-foreground">Advertising</p>
            <p>No data</p>
          </div>
          <div className="rounded border border-border p-2">
            <p className="font-medium text-foreground">Traffic</p>
            <p>No data</p>
          </div>
          <div className="rounded border border-border p-2">
            <p className="font-medium text-foreground">Search</p>
            <p>No data</p>
          </div>
        </div>
      </div>
    </div>
  )
}
