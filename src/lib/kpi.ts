import type { PeriodSummary } from '@/types/database'

export interface KpiResult {
  current: number;
  previous: number;
  change: number;
  changePercent: number;
}

export function calculateKpi(
  currentPeriod: PeriodSummary[],
  previousPeriod: PeriodSummary[],
  metric: keyof PeriodSummary
): KpiResult {
  const current = currentPeriod.reduce((sum, row) => sum + (Number(row[metric]) || 0), 0)
  const previous = previousPeriod.reduce((sum, row) => sum + (Number(row[metric]) || 0), 0)
  const change = current - previous
  const changePercent = previous !== 0 ? (change / previous) : 0

  return { current, previous, change, changePercent }
}

export function calculateAverageKpi(
  currentPeriod: PeriodSummary[],
  previousPeriod: PeriodSummary[],
  numerator: keyof PeriodSummary,
  denominator: keyof PeriodSummary
): KpiResult {
  const currentNum = currentPeriod.reduce((sum, row) => sum + (Number(row[numerator]) || 0), 0)
  const currentDen = currentPeriod.reduce((sum, row) => sum + (Number(row[denominator]) || 0), 0)
  const prevNum = previousPeriod.reduce((sum, row) => sum + (Number(row[numerator]) || 0), 0)
  const prevDen = previousPeriod.reduce((sum, row) => sum + (Number(row[denominator]) || 0), 0)

  const current = currentDen !== 0 ? currentNum / currentDen : 0
  const previous = prevDen !== 0 ? prevNum / prevDen : 0
  const change = current - previous
  const changePercent = previous !== 0 ? (change / previous) : 0

  return { current, previous, change, changePercent }
}

// Standard KPI definitions for governance
export const KPI_DEFINITIONS: Record<string, { name: string; description: string; formula: string; source: string }> = {
  ordered_revenue: {
    name: 'Ordered Revenue',
    description: 'Total revenue from orders placed (not yet shipped)',
    formula: 'SUM(ordered_revenue)',
    source: 'fact_sales',
  },
  ordered_units: {
    name: 'Units Ordered',
    description: 'Total units ordered',
    formula: 'SUM(ordered_units)',
    source: 'fact_sales',
  },
  asp: {
    name: 'Average Selling Price',
    description: 'Revenue per unit',
    formula: 'ordered_revenue / ordered_units',
    source: 'fact_sales',
  },
  ad_spend: {
    name: 'Ad Spend',
    description: 'Total advertising spend across all campaign types',
    formula: 'SUM(spend)',
    source: 'fact_advertising',
  },
  ad_sales: {
    name: 'Ad Sales',
    description: 'Revenue attributed to advertising',
    formula: 'SUM(ad_sales)',
    source: 'fact_advertising',
  },
  roas: {
    name: 'ROAS',
    description: 'Return on ad spend',
    formula: 'ad_sales / spend',
    source: 'fact_advertising',
  },
  acos: {
    name: 'ACoS',
    description: 'Advertising cost of sales',
    formula: 'spend / ad_sales',
    source: 'fact_advertising',
  },
  tacos: {
    name: 'TACoS',
    description: 'Total advertising cost of sales (ad spend / total revenue)',
    formula: 'SUM(spend) / SUM(ordered_revenue)',
    source: 'fact_advertising + fact_sales',
  },
  glance_views: {
    name: 'Glance Views',
    description: 'Detail page views from ARA Traffic (weekly grain)',
    formula: 'SUM(glance_views)',
    source: 'fact_traffic_conversion (ARA Traffic)',
  },
  conversion_rate: {
    name: 'Conversion Rate',
    description: 'Units ordered per glance view',
    formula: 'ordered_units / glance_views',
    source: 'fact_sales + fact_traffic_conversion (ARA)',
  },
}
