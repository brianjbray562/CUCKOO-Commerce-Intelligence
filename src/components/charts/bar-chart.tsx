"use client"

import {
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts"
import { formatCompact, formatCurrency } from "@/lib/utils"

interface BarChartProps {
  data: Array<Record<string, unknown>>
  bars: Array<{
    dataKey: string
    label: string
    color: string
    format?: "currency" | "number" | "percent"
    stackId?: string
  }>
  xAxisKey?: string
  height?: number
  title?: string
  layout?: "horizontal" | "vertical"
}

export function BarChart({
  data,
  bars,
  xAxisKey = "name",
  height = 300,
  title,
  layout = "horizontal",
}: BarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border bg-card p-8" style={{ height }}>
        <p className="text-sm text-muted-foreground">No data available</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      {title && <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart
          data={data}
          layout={layout === "vertical" ? "vertical" : "horizontal"}
          margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          {layout === "vertical" ? (
            <>
              <XAxis type="number" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => formatCompact(v)} />
              <YAxis type="category" dataKey={xAxisKey} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={100} />
            </>
          ) : (
            <>
              <XAxis dataKey={xAxisKey} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => formatCompact(v)} />
            </>
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
              const bar = bars.find((b) => b.dataKey === n || b.label === n)
              if (bar?.format === "currency") return [formatCurrency(v), bar.label]
              return [formatCompact(v), bar?.label || n]
            }}
          />
          <Legend wrapperStyle={{ fontSize: "12px" }} />
          {bars.map((bar) => (
            <Bar
              key={bar.dataKey}
              dataKey={bar.dataKey}
              name={bar.label}
              fill={bar.color}
              stackId={bar.stackId}
              radius={[2, 2, 0, 0]}
            />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  )
}
