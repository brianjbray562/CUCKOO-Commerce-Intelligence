"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface TooltipContextValue {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const TooltipContext = React.createContext<TooltipContextValue>({
  open: false,
  onOpenChange: () => {},
})

interface TooltipProviderProps {
  delayDuration?: number
  children: React.ReactNode
}

function TooltipProvider({ children }: TooltipProviderProps) {
  return <>{children}</>
}

interface TooltipProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  defaultOpen?: boolean
  delayDuration?: number
  children: React.ReactNode
}

function Tooltip({ open, onOpenChange, defaultOpen = false, children }: TooltipProps) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen)
  const isOpen = open !== undefined ? open : internalOpen

  const handleOpenChange = React.useCallback(
    (value: boolean) => {
      if (open === undefined) setInternalOpen(value)
      onOpenChange?.(value)
    },
    [open, onOpenChange]
  )

  return (
    <TooltipContext.Provider value={{ open: isOpen, onOpenChange: handleOpenChange }}>
      <div className="relative inline-flex">{children}</div>
    </TooltipContext.Provider>
  )
}

function TooltipTrigger({
  asChild: _asChild,
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { asChild?: boolean }) {
  const { onOpenChange } = React.useContext(TooltipContext)
  return (
    <div
      data-slot="tooltip-trigger"
      className={cn("inline-flex", className)}
      onMouseEnter={() => onOpenChange(true)}
      onMouseLeave={() => onOpenChange(false)}
      onFocus={() => onOpenChange(true)}
      onBlur={() => onOpenChange(false)}
      {...props}
    >
      {children}
    </div>
  )
}

interface TooltipContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: "top" | "bottom" | "left" | "right"
  sideOffset?: number
  align?: "start" | "center" | "end"
}

function TooltipContent({
  className,
  side = "top",
  sideOffset = 4,
  children,
  ...props
}: TooltipContentProps) {
  const { open } = React.useContext(TooltipContext)

  if (!open) return null

  const positionStyles: React.CSSProperties = {}
  const positionClasses: string[] = []

  switch (side) {
    case "top":
      positionClasses.push("bottom-full left-1/2 -translate-x-1/2")
      positionStyles.marginBottom = sideOffset
      break
    case "bottom":
      positionClasses.push("top-full left-1/2 -translate-x-1/2")
      positionStyles.marginTop = sideOffset
      break
    case "left":
      positionClasses.push("right-full top-1/2 -translate-y-1/2")
      positionStyles.marginRight = sideOffset
      break
    case "right":
      positionClasses.push("left-full top-1/2 -translate-y-1/2")
      positionStyles.marginLeft = sideOffset
      break
  }

  return (
    <div
      data-slot="tooltip-content"
      role="tooltip"
      style={positionStyles}
      className={cn(
        "absolute z-50 w-max max-w-xs rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground shadow-sm animate-in fade-in-0 zoom-in-95",
        ...positionClasses,
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
