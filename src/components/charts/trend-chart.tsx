"use client"

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts"
import { formatCompact, formatCurrency } from "@/lib/utils"

interface TrendChartProps {
  data: Array<Record<string, unknown>>
  lines: Array<{
    dataKey: string
    label: string
    color: string
    format?: "currency" | "number" | "percent"
    yAxisId?: string
  }>
  xAxisKey?: string
  height?: number
  title?: string
  showLegend?: boolean
  dualAxis?: boolean
}

export function TrendChart({
  data,
  lines,
  xAxisKey = "date_key",
  height = 300,
  title,
  showLegend = true,
  dualAxis = false,
}: TrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border bg-card p-8" style={{ height }}>
        <p className="text-sm text-muted-foreground">No data available for this period</p>
      </div>
    )
  }

  const formatTick = (value: number, format?: string) => {
    if (format === "currency") return formatCurrency(value)
    if (format === "percent") return `${(value * 100).toFixed(0)}%`
    return formatCompact(value)
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      {title && <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey={xAxisKey}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickFormatter={(v) => {
              if (typeof v === "string" && v.includes("-")) {
                const d = new Date(v + "T00:00:00")
                return `${d.getMonth() + 1}/${d.getDate()}`
              }
              return v
            }}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickFormatter={(v) => formatTick(v, lines[0]?.format)}
            width={65}
          />
          {dualAxis && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickFormatter={(v) => formatTick(v, lines[lines.length - 1]?.format)}
              width={65}
            />
          )}
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={(value, name) => {
              const v = Number(value)
              const n = String(name)
              const line = lines.find((l) => l.dataKey === n || l.label === n)
              if (line?.format === "currency") return [formatCurrency(v), line.label]
              if (line?.format === "percent") return [`${(v * 100).toFixed(2)}%`, line.label]
              return [formatCompact(v), line?.label || n]
            }}
          />
          {showLegend && (
            <Legend
              wrapperStyle={{ fontSize: "12px" }}
            />
          )}
          {lines.map((line) => (
            <Line
              key={line.dataKey}
              yAxisId={line.yAxisId || "left"}
              type="monotone"
              dataKey={line.dataKey}
              name={line.label}
              stroke={line.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
