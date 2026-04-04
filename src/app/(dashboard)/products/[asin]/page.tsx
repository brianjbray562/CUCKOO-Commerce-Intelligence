export const dynamic = 'force-dynamic'

import { KpiCard } from "@/components/charts/kpi-card"
import { TrendChart } from "@/components/charts/trend-chart"
import { DataTable, type Column } from "@/components/charts/data-table"
import { ArrowLeft, ExternalLink } from "lucide-react"
import Link from "next/link"
import { getSalesSummary, getAdSummary, getTrafficSummary } from "@/lib/data-access"

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

export default async function AsinDetailPage({ params }: { params: Promise<{ asin: string }> }) {
  const { asin } = await params

  // Fetch all data in parallel
  const [allSales, allAds, allTraffic] = await Promise.all([
    getSalesSummary(),
    getAdSummary(),
    getTrafficSummary(),
  ])

  // Filter to this ASIN only
  const salesRows = allSales.filter((r) => {
    const p = r.dim_product as unknown as { asin: string } | null
    return p?.asin === asin
  })

  const adRows = allAds.filter((r) => {
    const p = r.dim_product as unknown as { asin: string } | null
    return p?.asin === asin
  })

  const trafficRows = allTraffic.filter((r) => {
    const p = r.dim_product as unknown as { asin: string } | null
    return p?.asin === asin
  })

  // Sales KPIs
  const totalRevenue = salesRows.reduce((sum, r) => sum + Number(r.ordered_revenue || 0), 0)
  const totalUnits = salesRows.reduce((sum, r) => sum + Number(r.ordered_units || 0), 0)
  const asp = totalUnits > 0 ? totalRevenue / totalUnits : 0

  // Ad KPIs
  const totalAdSpend = adRows.reduce((sum, r) => sum + Number(r.spend || 0), 0)
  const totalAdSales = adRows.reduce((sum, r) => sum + Number(r.ad_sales || 0), 0)
  const acos = totalAdSales > 0 ? totalAdSpend / totalAdSales : 0
  const roas = totalAdSpend > 0 ? totalAdSales / totalAdSpend : 0
  const tacos = totalRevenue > 0 ? totalAdSpend / totalRevenue : 0

  // Traffic KPIs
  const totalGlanceViews = trafficRows.reduce((sum, r) => sum + Number(r.glance_views || 0), 0)
  const cvr = totalGlanceViews > 0 ? totalUnits / totalGlanceViews : 0

  // Product info from first sales row
  const productInfo = salesRows.length > 0
    ? (salesRows[0].dim_product as unknown as { asin: string; product_title: string; parent_asin: string; category: string } | null)
    : null
  const productTitle = productInfo?.product_title || "Product title unavailable"
  const parentAsin = productInfo?.parent_asin || "-"
  const category = productInfo?.category || "-"

  // Campaign breakdown for this ASIN
  const campaignMap = new Map<string, CampaignRow>()
  for (const row of adRows) {
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
        acos: 0,
        impressions: Number(row.impressions || 0),
        clicks: Number(row.clicks || 0),
      })
    }
  }

  const campaignRows: CampaignRow[] = Array.from(campaignMap.values()).map((c) => ({
    ...c,
    acos: c.ad_sales > 0 ? c.spend / c.ad_sales : 0,
  })).sort((a, b) => b.spend - a.spend)

  // Data coverage flags
  const hasSales = salesRows.length > 0
  const hasAds = adRows.length > 0
  const hasTraffic = trafficRows.length > 0

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
          <p className="text-sm text-muted-foreground">{productTitle}</p>
        </div>
      </div>

      {/* Product info card */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <span className="text-muted-foreground">Parent ASIN</span>
            <p className="font-mono font-medium text-foreground">{parentAsin}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Category</span>
            <p className="font-medium text-foreground">{category}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Brand</span>
            <p className="font-medium text-foreground">CUCKOO</p>
          </div>
          <div>
            <span className="text-muted-foreground">Status</span>
            <p className="font-medium text-foreground">{hasSales ? "Active" : "No Data"}</p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5">
        <KpiCard label="Revenue" value={totalRevenue} format="currency" />
        <KpiCard label="Units" value={totalUnits} format="number" />
        <KpiCard label="ASP" value={asp} format="currency" />
        <KpiCard label="Ad Spend" value={totalAdSpend} format="currency" />
        <KpiCard label="ACoS" value={acos} format="percent" />
        <KpiCard label="ROAS" value={roas} format="number" />
        <KpiCard label="TACoS" value={tacos} format="percent" />
        <KpiCard label="Glance Views" value={totalGlanceViews} format="compact" />
        <KpiCard label="CVR" value={cvr} format="percent" />
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
        title="Glance Views & Conversion"
        lines={[
          { dataKey: "glance_views", label: "Glance Views", color: "var(--chart-1)", format: "number" },
          { dataKey: "conversion_rate", label: "CVR", color: "var(--chart-2)", format: "percent", yAxisId: "right" },
        ]}
        dualAxis
      />

      {/* Campaigns for this ASIN */}
      <DataTable<CampaignRow>
        data={campaignRows}
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
            <p>{hasSales ? `${salesRows.length} period(s)` : "No data"}</p>
          </div>
          <div className="rounded border border-border p-2">
            <p className="font-medium text-foreground">Advertising</p>
            <p>{hasAds ? `${adRows.length} record(s)` : "No data"}</p>
          </div>
          <div className="rounded border border-border p-2">
            <p className="font-medium text-foreground">Traffic</p>
            <p>{hasTraffic ? `${trafficRows.length} period(s)` : "No data"}</p>
          </div>
          <div className="rounded border border-border p-2">
            <p className="font-medium text-foreground">Search</p>
            <p>Not loaded on this view</p>
          </div>
        </div>
      </div>
    </div>
  )
}
