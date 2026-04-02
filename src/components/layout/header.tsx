"use client"

import { CalendarDays, RefreshCw } from "lucide-react"

export function Header() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-foreground">
          CUCKOO Commerce Intelligence
        </h1>
      </div>

      <div className="flex items-center gap-3">
        {/* Date range selector placeholder */}
        <button className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent transition-colors">
          <CalendarDays className="h-4 w-4" />
          <span>Last 30 days</span>
        </button>

        {/* Refresh */}
        <button className="flex items-center justify-center rounded-md border border-input bg-background p-1.5 text-muted-foreground hover:bg-accent transition-colors">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
