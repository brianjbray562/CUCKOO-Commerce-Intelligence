import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "CUCKOO Commerce Intelligence",
  description: "Unified ecommerce intelligence platform for CUCKOO Electronics America",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  )
}
