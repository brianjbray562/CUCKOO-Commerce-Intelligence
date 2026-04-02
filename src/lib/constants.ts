export const APP_NAME = 'CUCKOO Commerce Intelligence'
export const APP_SHORT_NAME = 'CCI'

export const NAV_ITEMS = [
  { label: 'Overview', href: '/overview', icon: 'LayoutDashboard' },
  { label: 'Sales', href: '/sales', icon: 'DollarSign' },
  { label: 'Advertising', href: '/advertising', icon: 'Megaphone' },
  { label: 'Traffic', href: '/traffic', icon: 'MousePointerClick' },
  { label: 'Search', href: '/search', icon: 'Search' },
  { label: 'Products', href: '/products', icon: 'Package' },
  { label: 'Operations', href: '/operations', icon: 'Settings' },
  { label: 'Data Management', href: '/data-management', icon: 'Database' },
] as const

export const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

export const DATE_RANGES = [
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 14 days', value: '14d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
  { label: 'Month to date', value: 'mtd' },
  { label: 'Quarter to date', value: 'qtd' },
  { label: 'Year to date', value: 'ytd' },
  { label: 'Custom', value: 'custom' },
] as const

export const SOURCE_CATEGORIES = [
  { value: 'sales', label: 'Sales' },
  { value: 'advertising', label: 'Advertising' },
  { value: 'search', label: 'Search & Brand Analytics' },
  { value: 'operations', label: 'Operations' },
  { value: 'reviews', label: 'Reviews' },
  { value: 'promotions', label: 'Promotions' },
] as const
