"use client"

import { KpiCard } from "@/components/charts/kpi-card"
import { TrendChart } from "@/components/charts/trend-chart"
import { BarChart } from "@/components/charts/bar-chart"
import { DataTable, type Column } from "@/components/charts/data-table"
import { AlertCircle } from "lucide-react"

interface CampaignRow {
  campaign_name: string
  campaign_type: string
  spend: number
  ad_sales: number
  impressions: number
  clicks: number
  acos: number
  roas: number
}

const CAMPAIGN_COLUMNS: Column<CampaignRow>[] = [
  { key: "campaign_name", label: "Campaign", sortable: true, width: "250px" },
  { key: "campaign_type", label: "Type", sortable: true },
  { key: "spend", label: "Spend", format: "currency", sortable: true, align: "right" },
  { key: "ad_sales", label: "Ad Sales", format: "currency", sortable: true, align: "right" },
  { key: "impressions", label: "Impressions", format: "number", sortable: true, align: "right" },
  { key: "clicks", label: "Clicks", format: "number", sortable: true, align: "right" },
  { key: "acos", label: "ACoS", format: "percent", sortable: true, align: "right" },
  { key: "roas", label: "ROAS", format: "number", sortable: true, align: "right" },
]

export default function AdvertisingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Advertising Performance</h2>
        <p className="text-sm text-muted-foreground">
          Sponsored Products, Sponsored Brands, and Sponsored Display performance across campaigns and ASINs
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
        <AlertCircle className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
        <div className="text-sm text-muted-foreground">
          <p>Upload <strong>Sponsored Products</strong>, <strong>Sponsored Brands</strong>, or <strong>Sponsored Display</strong> campaign reports to populate this view.</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5">
        <KpiCard label="Total Ad Spend" value={0} format="currency" tooltip="SUM(spend)" source="fact_advertising" />
        <KpiCard label="Ad Sales" value={0} format="currency" tooltip="SUM(ad_sales)" source="fact_advertising" />
        <KpiCard label="ROAS" value={0} format="number" tooltip="ad_sales / spend" source="fact_advertising" />
        <KpiCard label="ACoS" value={0} format="percent" tooltip="spend / ad_sales" source="fact_advertising" />
        <KpiCard label="TACoS" value={0} format="percent" tooltip="ad_spend / total_revenue" source="fact_advertising + fact_sales" />
      </div>

      {/* Spend + Sales trend */}
      <TrendChart
        data={[]}
        title="Ad Spend & Ad Sales Trend"
        lines={[
          { dataKey: "spend", label: "Spend", color: "var(--chart-3)", format: "currency" },
          { dataKey: "ad_sales", label: "Ad Sales", color: "var(--chart-1)", format: "currency" },
        ]}
      />

      {/* Efficiency metrics */}
      <div className="grid gap-6 lg:grid-cols-2">
        <TrendChart
          data={[]}
          title="ACoS & ROAS Trend"
          lines={[
            { dataKey: "acos", label: "ACoS", color: "var(--chart-4)", format: "percent" },
            { dataKey: "roas", label: "ROAS", color: "var(--chart-2)", format: "number", yAxisId: "right" },
          ]}
          dualAxis
        />
        <TrendChart
          data={[]}
          title="Impressions & Clicks"
          lines={[
            { dataKey: "impressions", label: "Impressions", color: "var(--chart-1)", format: "number" },
            { dataKey: "clicks", label: "Clicks", color: "var(--chart-5)", format: "number", yAxisId: "right" },
          ]}
          dualAxis
        />
      </div>

      {/* Spend by campaign type */}
      <BarChart
        data={[]}
        title="Spend by Campaign Type"
        bars={[
          { dataKey: "spend", label: "Spend", color: "var(--chart-1)", format: "currency" },
          { dataKey: "ad_sales", label: "Ad Sales", color: "var(--chart-2)", format: "currency" },
        ]}
        xAxisKey="campaign_type"
      />

      {/* Campaign table */}
      <DataTable<CampaignRow>
        data={[]}
        columns={CAMPAIGN_COLUMNS}
        title="Campaign Performance"
        emptyMessage="Upload advertising reports to see campaign breakdown"
      />

      <div className="rounded-lg border border-border bg-muted/20 p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Business Questions This View Answers</h4>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          <li>Is advertising efficient? Is ACoS trending toward or away from target?</li>
          <li>What is the total cost of advertising relative to total business revenue (TACoS)?</li>
          <li>Which campaign types (SP/SB/SD) are most efficient?</li>
          <li>Are we getting enough impressions? Is CTR healthy?</li>
          <li>Note: Ad Sales use 7-day (SP) or 14-day (SB/SD) attribution windows. Do not sum with organic sales.</li>
        </ul>
      </div>
    </div>
  )
}
