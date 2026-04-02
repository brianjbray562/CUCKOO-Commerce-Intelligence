"""
Main ETL pipeline orchestrator.

Handles the full ingestion flow:
1. Parse raw file
2. Stage rows
3. Auto-map columns
4. Validate and normalize
5. Load into canonical fact/dim tables
6. Track lineage and errors
"""
import json
import logging
from datetime import datetime
from typing import Optional

from etl.config import get_supabase_client
from etl.parsers.file_parser import parse_file, detect_source_type
from etl.mappers.column_mapper import auto_map_columns, apply_mapping
from etl.validators.row_validator import validate_and_normalize
from etl.loaders.dimension_loader import get_marketplace_id, get_report_source
from etl.loaders.fact_loader import load_sales_row, load_advertising_row, load_traffic_row

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Map source categories to their loader functions
LOADERS = {
    "sales": load_sales_row,
    "advertising": load_advertising_row,
}


def run_pipeline(
    batch_id: str,
    file_bytes: bytes,
    file_name: str,
    source_name: Optional[str] = None,
    country_code: str = "US",
    column_mapping_override: Optional[dict[str, str]] = None,
) -> dict:
    """
    Run the full ETL pipeline for an uploaded file.

    Args:
        batch_id: UUID of the upload batch record
        file_bytes: Raw file content
        file_name: Original filename
        source_name: Report source name (auto-detected if None)
        country_code: Marketplace country code
        column_mapping_override: Manual column mapping to use instead of auto

    Returns:
        dict with processing results
    """
    supabase = get_supabase_client()
    processing_log = []
    error_log = []

    def log_step(message: str, level: str = "info"):
        entry = {"timestamp": datetime.utcnow().isoformat(), "message": message, "level": level}
        processing_log.append(entry)
        logger.info(f"[{batch_id[:8]}] {message}")

    def log_error(row: int, field: str, message: str):
        error_log.append({"row": row, "field": field, "message": message})

    try:
        # Update batch status
        _update_batch(supabase, batch_id, status="processing", processing_log=processing_log)

        # Step 1: Parse file
        log_step(f"Parsing file: {file_name}")
        columns, rows = parse_file(file_bytes, file_name)
        log_step(f"Parsed {len(rows)} rows with {len(columns)} columns")

        _update_batch(supabase, batch_id, row_count_raw=len(rows), processing_log=processing_log)

        # Step 2: Detect or verify source type
        if not source_name:
            source_name = detect_source_type(columns)
            if source_name:
                log_step(f"Auto-detected source type: {source_name}")
            else:
                log_step("Could not auto-detect source type", level="warning")
                _update_batch(supabase, batch_id, status="failed",
                              processing_log=processing_log, error_log=error_log)
                return {"status": "failed", "error": "Could not detect source type"}

        # Get source config
        source_config = get_report_source(supabase, source_name)
        source_category = source_config["source_category"]
        log_step(f"Source category: {source_category}")

        # Step 3: Map columns
        _update_batch(supabase, batch_id, status="mapping", processing_log=processing_log)

        if column_mapping_override:
            column_mapping = column_mapping_override
            log_step("Using manual column mapping override")
        else:
            mapping_template = source_config.get("mapping_template")
            suggestions = auto_map_columns(columns, mapping_template)
            # Build mapping dict from suggestions (only mapped columns)
            column_mapping = {
                s["sourceColumn"]: s["targetColumn"]
                for s in suggestions
                if s["targetColumn"]
            }
            log_step(f"Auto-mapped {len(column_mapping)}/{len(columns)} columns")

        # Store mapping on batch
        _update_batch(supabase, batch_id, column_mapping=column_mapping,
                      source_id=source_config["source_id"], processing_log=processing_log)

        # Step 4: Validate, normalize, and stage
        _update_batch(supabase, batch_id, status="validating", processing_log=processing_log)

        marketplace_id = get_marketplace_id(supabase, country_code)
        valid_rows = []
        error_count = 0

        for i, raw_row in enumerate(rows):
            mapped_row = apply_mapping(raw_row, column_mapping)
            normalized, validation = validate_and_normalize(mapped_row, source_category, i + 1)

            if validation.is_valid:
                valid_rows.append(normalized)
            else:
                error_count += 1
                for err in validation.errors:
                    log_error(i + 1, err["field"], err["message"])

        log_step(f"Validation complete: {len(valid_rows)} valid, {error_count} errors")
        _update_batch(supabase, batch_id, row_count_staged=len(valid_rows),
                      row_count_errors=error_count, processing_log=processing_log)

        # Step 5: Load into fact tables
        _update_batch(supabase, batch_id, status="loading", processing_log=processing_log)

        loader_fn = _get_loader(source_category)
        loaded_count = 0

        for row in valid_rows:
            try:
                if source_category == "sales" and "sessions" in row:
                    # Business Report has both sales and traffic data
                    load_sales_row(supabase, row, batch_id, marketplace_id)
                    load_traffic_row(supabase, row, batch_id, marketplace_id)
                    loaded_count += 1
                elif loader_fn:
                    loader_fn(supabase, row, batch_id, marketplace_id)
                    loaded_count += 1
            except Exception as e:
                error_count += 1
                log_error(0, "loader", str(e))

        log_step(f"Loaded {loaded_count} rows into fact tables")

        # Determine date range
        dates = [r.get("date_key") for r in valid_rows if r.get("date_key")]
        date_range_start = min(dates) if dates else None
        date_range_end = max(dates) if dates else None

        # Step 6: Finalize
        _update_batch(
            supabase, batch_id,
            status="completed",
            row_count_loaded=loaded_count,
            row_count_errors=error_count,
            date_range_start=date_range_start,
            date_range_end=date_range_end,
            processing_log=processing_log,
            error_log=error_log,
            completed_at=datetime.utcnow().isoformat(),
        )

        log_step("Pipeline completed successfully")

        return {
            "status": "completed",
            "rows_raw": len(rows),
            "rows_loaded": loaded_count,
            "rows_errors": error_count,
            "date_range": [date_range_start, date_range_end],
            "source_name": source_name,
        }

    except Exception as e:
        logger.exception(f"Pipeline failed for batch {batch_id}")
        log_step(f"Pipeline failed: {str(e)}", level="error")
        _update_batch(supabase, batch_id, status="failed",
                      processing_log=processing_log, error_log=error_log)
        return {"status": "failed", "error": str(e)}


def _get_loader(source_category: str):
    """Get the appropriate loader function for a source category."""
    return LOADERS.get(source_category)


def _update_batch(supabase, batch_id: str, **kwargs):
    """Update a batch record with the given fields."""
    updates = {}
    for key, value in kwargs.items():
        if value is not None:
            if isinstance(value, (list, dict)):
                updates[key] = json.loads(json.dumps(value, default=str))
            else:
                updates[key] = value

    if updates:
        supabase.table("dim_upload_batch").update(updates).eq("batch_id", batch_id).execute()
