"use client"

import { useState, useCallback } from "react"
import { Upload, FileSpreadsheet, CheckCircle, XCircle, Clock, AlertTriangle, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { UploadStatus } from "@/types/database"

// Report source options (matches dim_report_source seeds)
const REPORT_SOURCES = [
  { value: "Amazon Business Report - Sales & Traffic", label: "Amazon Business Report - Sales & Traffic", category: "sales" },
  { value: "Amazon Retail Analytics - Sales", label: "Amazon Retail Analytics - Sales", category: "sales" },
  { value: "Sponsored Products Campaign Report", label: "Sponsored Products - Campaign Report", category: "advertising" },
  { value: "Sponsored Products Advertised Product Report", label: "Sponsored Products - Advertised Product Report", category: "advertising" },
  { value: "Sponsored Brands Campaign Report", label: "Sponsored Brands - Campaign Report", category: "advertising" },
  { value: "Search Query Performance", label: "Search Query Performance", category: "search" },
  { value: "Search Catalog Performance", label: "Search Catalog Performance", category: "search" },
  { value: "Inventory Health Report", label: "Inventory Health Report", category: "operations" },
  { value: "Customer Reviews Report", label: "Customer Reviews Report", category: "reviews" },
  { value: "Promotions Report", label: "Promotions Report", category: "promotions" },
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
  const [uploads] = useState<UploadRecord[]>([])

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

  const handleUpload = async () => {
    if (!selectedFile || !selectedSource) return
    setUploading(true)

    // In production, this would:
    // 1. Upload file to Supabase Storage
    // 2. Create dim_upload_batch record
    // 3. Trigger ETL pipeline
    // For now, show the workflow structure
    try {
      const formData = new FormData()
      formData.append("file", selectedFile)
      formData.append("source_name", selectedSource)
      formData.append("marketplace", selectedMarketplace)

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("Upload failed")
      }

      // Reset form
      setSelectedFile(null)
      setPreviewData(null)
      setSelectedSource("")
    } catch {
      alert("Upload failed. Make sure Supabase is configured in .env.local")
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
          Upload a CSV or XLSX file from Amazon Seller Central, Vendor Central, or advertising console.
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
            <p className="text-sm font-medium text-foreground">1. Business Report</p>
            <p className="text-xs text-muted-foreground">Sales + Traffic data combined. Best first upload for immediate overview.</p>
          </div>
          <div className="rounded border border-border p-3">
            <p className="text-sm font-medium text-foreground">2. SP Advertised Product Report</p>
            <p className="text-xs text-muted-foreground">ASIN-level ad performance. Enables TACoS and ad efficiency analysis.</p>
          </div>
          <div className="rounded border border-border p-3">
            <p className="text-sm font-medium text-foreground">3. ARA Sales Report</p>
            <p className="text-xs text-muted-foreground">Higher-quality sales data with shipped revenue. Replaces Business Report sales data.</p>
          </div>
          <div className="rounded border border-border p-3">
            <p className="text-sm font-medium text-foreground">4. Search Query Performance</p>
            <p className="text-xs text-muted-foreground">Brand Analytics search data. Enables branded vs non-branded analysis.</p>
          </div>
          <div className="rounded border border-border p-3">
            <p className="text-sm font-medium text-foreground">5. Inventory Health</p>
            <p className="text-xs text-muted-foreground">In-stock rates and availability. Connects supply to demand signals.</p>
          </div>
          <div className="rounded border border-border p-3">
            <p className="text-sm font-medium text-foreground">6. SB/SD Campaign Reports</p>
            <p className="text-xs text-muted-foreground">Completes the advertising picture across all campaign types.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
