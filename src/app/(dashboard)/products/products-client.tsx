"use client"

import { useRouter } from "next/navigation"
import { DataTable, type Column } from "@/components/charts/data-table"
import { Search } from "lucide-react"
import { useState } from "react"

export interface ProductRow {
  asin: string
  parent_asin: string
  product_title: string
  category: string
  ordered_revenue: number
  ordered_units: number
}

const COLUMNS: Column<ProductRow>[] = [
  { key: "asin", label: "ASIN", format: "asin", sortable: true },
  { key: "parent_asin", label: "Parent", format: "asin", sortable: true },
  { key: "product_title", label: "Product", sortable: true, width: "250px" },
  { key: "category", label: "Category", sortable: true },
  { key: "ordered_revenue", label: "Revenue", format: "currency", sortable: true, align: "right" },
  { key: "ordered_units", label: "Units", format: "number", sortable: true, align: "right" },
]

interface Props {
  products: ProductRow[]
}

export function ProductsClient({ products }: Props) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")

  const filtered = searchQuery.trim()
    ? products.filter((p) => {
        const q = searchQuery.toLowerCase()
        return (
          p.asin.toLowerCase().includes(q) ||
          p.parent_asin?.toLowerCase().includes(q) ||
          p.product_title?.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q)
        )
      })
    : products

  return (
    <>
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
        data={filtered}
        columns={COLUMNS}
        title="All Products"
        emptyMessage="No products discovered yet. Upload reports to build the product catalog."
        onRowClick={(row) => router.push(`/products/${row.asin}`)}
      />
    </>
  )
}
