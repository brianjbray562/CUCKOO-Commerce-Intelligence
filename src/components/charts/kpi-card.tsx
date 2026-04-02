"use client"

import { cn, formatCurrency, formatNumber, formatPercent, formatCompact } from "@/lib/utils"
import { TrendingUp, TrendingDown, Minus, Info } from "lucide-react"

interface KpiCardProps {
  label: string
  value: number
  previousValue?: number
  format: "currency" | "number" | "percent" | "compact"
  tooltip?: string
  source?: string
  className?: string
}

export function KpiCard({
  label,
  value,
  previousValue,
  format,
  tooltip,
  source,
  className,
}: KpiCardProps) {
  const formattedValue = formatValue(value, format)
  const changePercent = previousValue && previousValue !== 0
    ? ((value - previousValue) / Math.abs(previousValue))
    : undefined

  return (
    <div className={cn("rounded-lg border border-border bg-card p-4", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        {tooltip && (
          <span className="group relative">
            <Info className="h-3.5 w-3.5 text-muted-foreground/50" />
            <span className="pointer-events-none absolute right-0 top-6 z-50 w-48 rounded-md border bg-popover p-2 text-xs text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100">
              {tooltip}
            </span>
          </span>
        )}
      </div>

      <div className="mt-2">
        <span className="text-2xl font-bold text-foreground">{formattedValue}</span>
      </div>

      {changePercent !== undefined && (
        <div className="mt-1 flex items-center gap-1">
          {changePercent > 0.001 ? (
            <TrendingUp className="h-3.5 w-3.5 text-green-600" />
          ) : changePercent < -0.001 ? (
            <TrendingDown className="h-3.5 w-3.5 text-red-600" />
          ) : (
            <Minus className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span
            className={cn(
              "text-xs font-medium",
              changePercent > 0.001
                ? "text-green-600"
                : changePercent < -0.001
                  ? "text-red-600"
                  : "text-muted-foreground"
            )}
          >
            {changePercent > 0 ? "+" : ""}
            {(changePercent * 100).toFixed(1)}% vs prior period
          </span>
        </div>
      )}

      {source && (
        <div className="mt-2 text-[10px] text-muted-foreground/60">
          Source: {source}
        </div>
      )}
    </div>
  )
}

function formatValue(value: number, format: KpiCardProps["format"]): string {
  switch (format) {
    case "currency":
      return formatCurrency(value)
    case "number":
      return formatNumber(value)
    case "percent":
      return formatPercent(value)
    case "compact":
      return formatCompact(value)
    default:
      return String(value)
  }
}
