export const dynamic = 'force-dynamic'

import { KpiCard } from "@/components/charts/kpi-card"
import { TrendChart } from "@/components/charts/trend-chart"
import { BarChart } from "@/components/charts/bar-chart"
import { DataTable, type Column } from "@/components/charts/data-table"
import { AlertCircle } from "lucide-react"
import { getAdSummary, getSalesSummary } from "@/lib/data-access"

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

export default async function AdvertisingPage() {
  const [adData, salesData] = await Promise.all([getAdSummary(), getSalesSummary()])

  // Aggregate totals
  const totalSpend = adData.reduce((sum, r) => sum + Number(r.spend || 0), 0)
  const totalAdSales = adData.reduce((sum, r) => sum + Number(r.ad_sales || 0), 0)
  const totalRevenue = salesData.reduce((sum, r) => sum + Number(r.ordered_revenue || 0), 0)

  const roas = totalSpend > 0 ? totalAdSales / totalSpend : 0
  const acos = totalAdSales > 0 ? totalSpend / totalAdSales : 0
  const tacos = totalRevenue > 0 ? totalSpend / totalRevenue : 0

  // Aggregate by campaign name
  const campaignMap = new Map<string, CampaignRow>()
  for (const row of adData) {
    const campaign = row.dim_campaign as unknown as { campaign_name: string; campaign_type: string } | null
    const campaignName = campaign?.campaign_name || "Unknown Campaign"
    const campaignType = campaign?.campaign_type || "-"

    const existing = campaignMap.get(campaignName)
    if (existing) {
      existing.spend += Number(row.spend || 0)
      existing.ad_sales += Number(row.ad_sales || 0)
      existing.impressions += Number(row.impressions || 0)
      existing.clicks += Number(row.clicks || 0)
    } else {
      campaignMap.set(campaignName, {
        campaign_name: campaignName,
        campaign_type: campaignType,
        spend: Number(row.spend || 0),
        ad_sales: Number(row.ad_sales || 0),
        impressions: Number(row.impressions || 0),
        clicks: Number(row.clicks || 0),
        acos: 0,
        roas: 0,
      })
    }
  }

  // Compute derived metrics per campaign
  const campaignRows: CampaignRow[] = Array.from(campaignMap.values()).map((c) => ({
    ...c,
    acos: c.ad_sales > 0 ? c.spend / c.ad_sales : 0,
    roas: c.spend > 0 ? c.ad_sales / c.spend : 0,
  })).sort((a, b) => b.spend - a.spend)

  const hasData = adData.length > 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Advertising Performance</h2>
        <p className="text-sm text-muted-foreground">
          Sponsored Products, Sponsored Brands, and Sponsored Display performance across campaigns and ASINs
        </p>
      </div>

      {!hasData && (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
          <div className="text-sm text-muted-foreground">
            <p>Upload <strong>SP Campaign Reports</strong>, <strong>SP Advertised Product Reports</strong>, or <strong>SB Campaign Reports</strong> to populate this view.</p>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5">
        <KpiCard label="Total Ad Spend" value={totalSpend} format="currency" tooltip="SUM(spend)" source="fact_advertising" />
        <KpiCard label="Ad Sales" value={totalAdSales} format="currency" tooltip="SUM(ad_sales)" source="fact_advertising" />
        <KpiCard label="ROAS" value={roas} format="number" tooltip="ad_sales / spend" source="fact_advertising" />
        <KpiCard label="ACoS" value={acos} format="percent" tooltip="spend / ad_sales" source="fact_advertising" />
        <KpiCard label="TACoS" value={tacos} format="percent" tooltip="ad_spend / total_revenue" source="fact_advertising + fact_sales" />
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
        data={campaignRows}
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
