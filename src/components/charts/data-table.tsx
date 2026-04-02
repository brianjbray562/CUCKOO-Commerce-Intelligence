"use client"

import { useState } from "react"
import { cn, formatCurrency, formatNumber, formatPercent } from "@/lib/utils"
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react"

export interface Column<T> {
  key: keyof T & string
  label: string
  format?: "currency" | "number" | "percent" | "text" | "asin"
  sortable?: boolean
  width?: string
  align?: "left" | "right" | "center"
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  title?: string
  emptyMessage?: string
  onRowClick?: (row: T) => void
  maxRows?: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  title,
  emptyMessage = "No data available",
  onRowClick,
  maxRows,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  const sortedData = [...data].sort((a, b) => {
    if (!sortKey) return 0
    const aVal = a[sortKey]
    const bVal = b[sortKey]
    if (aVal == null && bVal == null) return 0
    if (aVal == null) return 1
    if (bVal == null) return -1
    const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
    return sortDir === "asc" ? cmp : -cmp
  })

  const displayData = maxRows ? sortedData.slice(0, maxRows) : sortedData

  return (
    <div className="rounded-lg border border-border bg-card">
      {title && (
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-4 py-2.5 text-xs font-medium text-muted-foreground",
                    col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left",
                    col.sortable && "cursor-pointer select-none hover:text-foreground"
                  )}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortable && (
                      sortKey === col.key
                        ? sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        : <ArrowUpDown className="h-3 w-3 opacity-30" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              displayData.map((row, i) => (
                <tr
                  key={i}
                  className={cn(
                    "border-b border-border last:border-0 transition-colors",
                    onRowClick && "cursor-pointer hover:bg-muted/50"
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-4 py-2.5",
                        col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left",
                        col.format === "asin" && "font-mono text-xs"
                      )}
                    >
                      {formatCell(row[col.key], col.format)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {maxRows && data.length > maxRows && (
        <div className="border-t border-border px-4 py-2 text-center text-xs text-muted-foreground">
          Showing {maxRows} of {data.length} rows
        </div>
      )}
    </div>
  )
}

function formatCell(value: unknown, format?: string): string {
  if (value == null || value === "") return "-"
  const num = Number(value)
  switch (format) {
    case "currency":
      return isNaN(num) ? String(value) : formatCurrency(num)
    case "number":
      return isNaN(num) ? String(value) : formatNumber(num)
    case "percent":
      return isNaN(num) ? String(value) : formatPercent(num)
    default:
      return String(value)
  }
}
