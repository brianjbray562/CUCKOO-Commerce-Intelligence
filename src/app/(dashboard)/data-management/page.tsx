"use client"

import { useState, useCallback, useEffect } from "react"
import { Upload, FileSpreadsheet, CheckCircle, XCircle, Clock, AlertTriangle, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { UploadStatus } from "@/types/database"
import { createBrowserClient } from "@supabase/ssr"

// Report source options (matches dim_report_source seeds)
const REPORT_SOURCES = [
  // ARA (Vendor Central)
  { value: "ARA Sales", label: "ARA Sales (Ordered + Shipped Revenue)", category: "sales" },
  { value: "ARA Traffic", label: "ARA Traffic (Glance Views)", category: "traffic" },
  { value: "ARA Inventory", label: "ARA Inventory", category: "operations" },
  // Advertising
  { value: "SP Campaign Report", label: "SP Campaign Report", category: "advertising" },
  { value: "SP Advertised Product Report", label: "SP Advertised Product Report", category: "advertising" },
  { value: "SP Search Term Report", label: "SP Search Term Report", category: "advertising" },
  { value: "SB Campaign Report", label: "SB Campaign Report", category: "advertising" },
  // Brand Analytics (from 3P account)
  { value: "Search Query Performance", label: "Search Query Performance (Brand Analytics)", category: "search" },
  { value: "Search Catalog Performance", label: "Search Catalog Performance (Brand Analytics)", category: "search" },
  { value: "Market Basket Analysis", label: "Market Basket Analysis (Brand Analytics)", category: "search" },
  { value: "Repeat Purchase Behavior", label: "Repeat Purchase Behavior (Brand Analytics)", category: "search" },
  { value: "Demographics", label: "Demographics (Brand Analytics)", category: "search" },
]

const MARKETPLACES = [
  { value: "US", label: "Amazon.com (US)" },
  { value: "CA", label: "Amazon.ca (CA)" },
  { value: "MX", label: "Amazon.com.mx (MX)" },
]

interface UploadRecord {
  batch_id: string
  file_name: string
  source_name: string
  status: UploadStatus
  uploaded_at: string
  row_count_raw: number
  row_count_loaded: number
  row_count_errors: number
  date_range_start: string | null
  date_range_end: string | null
}

function StatusBadge({ status }: { status: UploadStatus }) {
  const config = {
    pending: { icon: Clock, color: "text-yellow-600 bg-yellow-50 border-yellow-200", label: "Pending" },
    processing: { icon: Clock, color: "text-blue-600 bg-blue-50 border-blue-200", label: "Processing" },
    validating: { icon: Clock, color: "text-blue-600 bg-blue-50 border-blue-200", label: "Validating" },
    mapping: { icon: Clock, color: "text-blue-600 bg-blue-50 border-blue-200", label: "Mapping" },
    loading: { icon: Clock, color: "text-blue-600 bg-blue-50 border-blue-200", label: "Loading" },
    completed: { icon: CheckCircle, color: "text-green-600 bg-green-50 border-green-200", label: "Completed" },
    failed: { icon: XCircle, color: "text-red-600 bg-red-50 border-red-200", label: "Failed" },
  }
  const c = config[status]
  const Icon = c.icon

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", c.color)}>
      <Icon className="h-3 w-3" />
      {c.label}
    </span>
  )
}

export default function DataManagementPage() {
  const [selectedSource, setSelectedSource] = useState("")
  const [selectedMarketplace, setSelectedMarketplace] = useState("US")
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewData, setPreviewData] = useState<{ columns: string[]; rows: Record<string, string>[] } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploads, setUploads] = useState<UploadRecord[]>([])

  const fetchUploads = useCallback(async () => {
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data } = await supabase
        .from("dim_upload_batch")
        .select("batch_id, file_name, status, uploaded_at, row_count_raw, row_count_loaded, row_count_errors, date_range_start, date_range_end, source_id, dim_report_source(source_name)")
        .order("uploaded_at", { ascending: false })
        .limit(50)

      if (data) {
        setUploads(data.map((u: Record<string, unknown>) => ({
          batch_id: u.batch_id as string,
          file_name: u.file_name as string,
          source_name: (u.dim_report_source as Record<string, string>)?.source_name || "Unknown",
          status: u.status as UploadStatus,
          uploaded_at: u.uploaded_at as string,
          row_count_raw: (u.row_count_raw as number) || 0,
          row_count_loaded: (u.row_count_loaded as number) || 0,
          row_count_errors: (u.row_count_errors as number) || 0,
          date_range_start: u.date_range_start as string | null,
          date_range_end: u.date_range_end as string | null,
        })))
      }
    } catch {
      // Silently fail — upload history is non-critical
    }
  }, [])

  useEffect(() => {
    fetchUploads()
  }, [fetchUploads])

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }, [])

  const handleFileSelect = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase()
    if (!ext || !["csv", "xlsx", "xls"].includes(ext)) {
      alert("Please upload a CSV or XLSX file")
      return
    }
    setSelectedFile(file)

    // Parse preview (first 5 rows) client-side for CSV
    if (ext === "csv") {
      const text = await file.text()
      const lines = text.trim().split("\n")
      if (lines.length > 0) {
        const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""))
        const rows = lines.slice(1, 6).map((line) => {
          const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""))
          const row: Record<string, string> = {}
          headers.forEach((h, i) => {
            row[h] = values[i] || ""
          })
          return row
        })
        setPreviewData({ columns: headers, rows })
      }
    } else {
      // For XLSX, we'll show a placeholder (full parsing happens server-side)
      setPreviewData(null)
    }
  }

  const [uploadResult, setUploadResult] = useState<{
    status: string
    rows_loaded: number
    rows_errors: number
    source_name: string
    date_range: string[]
  } | null>(null)

  const handleUpload = async () => {
    if (!selectedFile) return
    setUploading(true)
    setUploadResult(null)

    try {
      const formData = new FormData()
      formData.append("file", selectedFile)
      formData.append("source_name", selectedSource)
      formData.append("marketplace", selectedMarketplace)

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        alert(result.error || "Upload failed")
        return
      }

      setUploadResult(result)

      // Reset form after successful upload
      setSelectedFile(null)
      setPreviewData(null)
      setSelectedSource("")

      // Refresh upload history
      fetchUploads()
    } catch {
      alert("Upload failed. Check your network connection and Supabase configuration.")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Data Management</h2>
        <p className="text-sm text-muted-foreground">
          Upload, manage, and track data sources. All uploaded files are parsed, validated, and loaded into the canonical data model.
        </p>
      </div>

      {/* Upload section */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="text-base font-semibold text-foreground">Upload Report</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload reports from Amazon Vendor Central, Advertising Console, or Brand Analytics.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {/* Source type */}
          <div>
            <label className="text-sm font-medium text-foreground">Report Type</label>
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Auto-detect or select...</option>
              {REPORT_SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Marketplace */}
          <div>
            <label className="text-sm font-medium text-foreground">Marketplace</label>
            <select
              value={selectedMarketplace}
              onChange={(e) => setSelectedMarketplace(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {MARKETPLACES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Drop zone */}
        <div
          className={cn(
            "mt-4 flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors",
            dragActive
              ? "border-primary bg-primary/5"
              : selectedFile
                ? "border-green-300 bg-green-50/50"
                : "border-border hover:border-primary/50"
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          {selectedFile ? (
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm font-medium text-foreground">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedFile(null)
                  setPreviewData(null)
                }}
                className="ml-4 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium text-foreground">
                Drag and drop your file here
              </p>
              <p className="mt-1 text-xs text-muted-foreground">CSV or XLSX up to 50MB</p>
              <label className="mt-3 cursor-pointer rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors">
                Browse files
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleFileSelect(e.target.files[0])
                  }}
                />
              </label>
            </>
          )}
        </div>

        {/* Preview */}
        {previewData && (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-foreground">File Preview (first 5 rows)</h4>
            <div className="mt-2 overflow-x-auto rounded border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    {previewData.columns.map((col) => (
                      <th key={col} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.rows.map((row, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      {previewData.columns.map((col) => (
                        <td key={col} className="px-3 py-1.5 whitespace-nowrap text-foreground">
                          {row[col] || "-"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Detected {previewData.columns.length} columns
            </p>
          </div>
        )}

        {/* Upload button */}
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className={cn(
              "rounded-md px-6 py-2 text-sm font-medium transition-colors",
              selectedFile && !uploading
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            {uploading ? "Uploading..." : "Upload & Process"}
          </button>
          {!selectedSource && selectedFile && (
            <p className="flex items-center gap-1 text-xs text-yellow-600">
              <AlertTriangle className="h-3 w-3" />
              No report type selected — will attempt auto-detection
            </p>
          )}
        </div>

        {/* Upload result */}
        {uploadResult && (
          <div className={cn(
            "mt-4 rounded-md border p-4",
            uploadResult.status === "completed"
              ? "border-green-200 bg-green-50"
              : "border-red-200 bg-red-50"
          )}>
            <div className="flex items-center gap-2">
              {uploadResult.status === "completed" ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <span className={cn("text-sm font-medium", uploadResult.status === "completed" ? "text-green-700" : "text-red-700")}>
                {uploadResult.status === "completed" ? "Upload processed successfully" : "Upload had errors"}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <div>
                <span className="text-muted-foreground">Source:</span>{" "}
                <span className="font-medium">{uploadResult.source_name}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Rows loaded:</span>{" "}
                <span className="font-medium">{uploadResult.rows_loaded}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Errors:</span>{" "}
                <span className="font-medium">{uploadResult.rows_errors}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Period:</span>{" "}
                <span className="font-medium">{uploadResult.date_range?.join(" to ")}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Upload history */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">Upload History</h3>
        </div>
        {uploads.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No uploads yet. Upload your first report above to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">File</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Report Type</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Rows</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Loaded</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Errors</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Date Range</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {uploads.map((u) => (
                  <tr key={u.batch_id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 font-medium text-foreground">{u.file_name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{u.source_name}</td>
                    <td className="px-4 py-2"><StatusBadge status={u.status} /></td>
                    <td className="px-4 py-2 text-right">{u.row_count_raw.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right">{u.row_count_loaded.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-red-600">{u.row_count_errors > 0 ? u.row_count_errors : "-"}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {u.date_range_start && u.date_range_end
                        ? `${u.date_range_start} to ${u.date_range_end}`
                        : "-"
                      }
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {new Date(u.uploaded_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recommended uploads guide */}
      <div className="rounded-lg border border-border bg-muted/20 p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recommended Upload Order</h4>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded border border-border p-3">
            <p className="text-sm font-medium text-foreground">1. ARA Sales</p>
            <p className="text-xs text-muted-foreground">Ordered + shipped revenue, units, ASP, and COGS in one report. Weekly grain. Best first upload.</p>
          </div>
          <div className="rounded border border-border p-3">
            <p className="text-sm font-medium text-foreground">2. ARA Traffic</p>
            <p className="text-xs text-muted-foreground">Glance views (detail page views) by ASIN. Enables conversion rate analysis when combined with sales data.</p>
          </div>
          <div className="rounded border border-border p-3">
            <p className="text-sm font-medium text-foreground">3. SP Advertised Product Report</p>
            <p className="text-xs text-muted-foreground">ASIN-level ad performance. Enables TACoS calculation and ad-to-sales connection.</p>
          </div>
          <div className="rounded border border-border p-3">
            <p className="text-sm font-medium text-foreground">5. Search Query Performance</p>
            <p className="text-xs text-muted-foreground">From Brand Analytics (3P account). Search demand capture and branded vs non-branded analysis.</p>
          </div>
          <div className="rounded border border-border p-3">
            <p className="text-sm font-medium text-foreground">6. ARA Inventory</p>
            <p className="text-xs text-muted-foreground">Sellthrough rate, open POs, weeks of cover. Connects supply health to demand signals.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
