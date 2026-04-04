import { AlertCircle } from "lucide-react"
import { getTopAsins } from "@/lib/data-access"
import { ProductsClient, type ProductRow } from "./products-client"

export default async function ProductsPage() {
  const topAsins = await getTopAsins()

  const products: ProductRow[] = topAsins.map((p) => ({
    asin: p.asin,
    parent_asin: "",
    product_title: p.product_title,
    category: "",
    ordered_revenue: p.ordered_revenue,
    ordered_units: p.ordered_units,
  }))

  const hasData = products.length > 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Product Catalog</h2>
        <p className="text-sm text-muted-foreground">
          ASIN-level view of all products with unified sales, advertising, and traffic metrics
        </p>
      </div>

      {!hasData && (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
          <div className="text-sm text-muted-foreground">
            <p>Products are auto-discovered from uploaded reports. Upload any report containing ASINs to build the catalog.</p>
          </div>
        </div>
      )}

      <ProductsClient products={products} />
    </div>
  )
}
