import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local" },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const formData = await request.formData()
    const file = formData.get("file") as File
    const sourceName = formData.get("source_name") as string
    const marketplace = formData.get("marketplace") as string || "US"

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // 1. Upload raw file to Supabase Storage
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const timestamp = Date.now()
    const storagePath = `uploads/${timestamp}_${file.name}`

    const { error: storageError } = await supabase.storage
      .from("uploads")
      .upload(storagePath, fileBuffer, {
        contentType: file.type || "application/octet-stream",
      })

    if (storageError) {
      console.error("Storage upload error:", storageError)
      // Continue anyway — storage is optional for processing
    }

    // 2. Create upload batch record
    const { data: batch, error: batchError } = await supabase
      .from("dim_upload_batch")
      .insert({
        file_name: file.name,
        file_path: storagePath,
        file_size_bytes: file.size,
        status: "pending",
        processing_log: [
          {
            timestamp: new Date().toISOString(),
            message: "File uploaded successfully",
            level: "info",
          },
        ],
      })
      .select()
      .single()

    if (batchError) {
      console.error("Batch creation error:", batchError)
      return NextResponse.json({ error: "Failed to create upload record" }, { status: 500 })
    }

    // 3. In production, trigger the Python ETL pipeline here.
    // Options:
    //   a. Call a Python microservice endpoint
    //   b. Use Supabase Edge Function
    //   c. Use a queue (e.g., Supabase Realtime or webhooks)
    //   d. Process inline for small files
    //
    // For now, return the batch_id so the client can poll for status.

    return NextResponse.json({
      batch_id: batch.batch_id,
      file_name: file.name,
      storage_path: storagePath,
      source_name: sourceName || "auto-detect",
      marketplace,
      status: "pending",
      message: "File uploaded. Configure Supabase and run the ETL pipeline to process.",
    })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
