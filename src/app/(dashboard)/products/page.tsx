"use client"

import { useRouter } from "next/navigation"
import { DataTable, type Column } from "@/components/charts/data-table"
import { AlertCircle, Search } from "lucide-react"
import { useState } from "react"

interface ProductRow {
  asin: string
  parent_asin: string
  product_title: string
  category: string
  ordered_revenue: number
  ordered_units: number
  ad_spend: number
  acos: number
  sessions: number
  conversion_rate: number
  is_active: boolean
}

const COLUMNS: Column<ProductRow>[] = [
  { key: "asin", label: "ASIN", format: "asin", sortable: true },
  { key: "parent_asin", label: "Parent", format: "asin", sortable: true },
  { key: "product_title", label: "Product", sortable: true, width: "250px" },
  { key: "category", label: "Category", sortable: true },
  { key: "ordered_revenue", label: "Revenue", format: "currency", sortable: true, align: "right" },
  { key: "ordered_units", label: "Units", format: "number", sortable: true, align: "right" },
  { key: "ad_spend", label: "Ad Spend", format: "currency", sortable: true, align: "right" },
  { key: "acos", label: "ACoS", format: "percent", sortable: true, align: "right" },
  { key: "sessions", label: "Sessions", format: "number", sortable: true, align: "right" },
  { key: "conversion_rate", label: "CVR", format: "percent", sortable: true, align: "right" },
]

export default function ProductsPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Product Catalog</h2>
        <p className="text-sm text-muted-foreground">
          ASIN-level view of all products with unified sales, advertising, and traffic metrics
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
        <AlertCircle className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
        <div className="text-sm text-muted-foreground">
          <p>Products are auto-discovered from uploaded reports. Upload any report containing ASINs to build the catalog.</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by ASIN, title, or category..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-4 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <DataTable<ProductRow>
        data={[]}
        columns={COLUMNS}
        title="All Products"
        emptyMessage="No products discovered yet. Upload reports to build the product catalog."
        onRowClick={(row) => router.push(`/products/${row.asin}`)}
      />
    </div>
  )
}
