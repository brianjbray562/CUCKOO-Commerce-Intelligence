"use client"

import { useRouter } from "next/navigation"
import { DataTable, type Column } from "@/components/charts/data-table"

interface Props<T extends { asin: string }> {
  data: T[]
  columns: Column<T>[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function SalesTableWithNav<T extends Record<string, any> & { asin: string }>({
  data,
  columns,
}: Props<T>) {
  const router = useRouter()

  return (
    <DataTable<T>
      data={data}
      columns={columns}
      title="ASIN Sales Breakdown"
      emptyMessage="Upload sales data to see ASIN breakdown"
      onRowClick={(row) => router.push(`/products/${row.asin}`)}
    />
  )
}
