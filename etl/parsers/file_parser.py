"""Parse CSV and XLSX files into structured row data."""
import io
import csv
from typing import Optional
import pandas as pd


def parse_file(
    file_bytes: bytes,
    file_name: str,
    sheet_name: Optional[str] = None,
) -> tuple[list[str], list[dict]]:
    """
    Parse a CSV or XLSX file into column headers and row dicts.

    Returns:
        (columns, rows) where rows is a list of dicts keyed by column name.
    """
    ext = file_name.rsplit(".", 1)[-1].lower()

    if ext == "csv":
        return _parse_csv(file_bytes)
    elif ext in ("xlsx", "xls"):
        return _parse_xlsx(file_bytes, sheet_name)
    else:
        raise ValueError(f"Unsupported file type: .{ext}. Use CSV or XLSX.")


def _parse_csv(file_bytes: bytes) -> tuple[list[str], list[dict]]:
    """Parse CSV bytes, handling encoding and BOM."""
    # Try UTF-8 first, fall back to latin-1
    for encoding in ["utf-8-sig", "utf-8", "latin-1"]:
        try:
            text = file_bytes.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise ValueError("Could not decode file. Try saving as UTF-8 CSV.")

    # Skip blank lines at the top (some Amazon exports have metadata rows)
    lines = text.strip().split("\n")
    start_idx = _find_header_row(lines)
    if start_idx > 0:
        text = "\n".join(lines[start_idx:])

    reader = csv.DictReader(io.StringIO(text))
    columns = reader.fieldnames or []
    # Strip whitespace from column names
    columns = [c.strip() for c in columns]
    rows = []
    for row in reader:
        cleaned = {k.strip(): (v.strip() if v else "") for k, v in row.items()}
        rows.append(cleaned)

    return columns, rows


def _parse_xlsx(
    file_bytes: bytes, sheet_name: Optional[str] = None
) -> tuple[list[str], list[dict]]:
    """Parse XLSX bytes using pandas."""
    df = pd.read_excel(
        io.BytesIO(file_bytes),
        sheet_name=sheet_name or 0,
        dtype=str,  # Read everything as strings to preserve formatting
    )
    # Drop fully empty rows
    df = df.dropna(how="all")

    # Strip column names
    df.columns = [str(c).strip() for c in df.columns]
    columns = list(df.columns)
    rows = df.fillna("").to_dict("records")

    return columns, rows


def _find_header_row(lines: list[str], max_skip: int = 10) -> int:
    """
    Detect header row by finding the first line with multiple comma-separated values.
    Amazon exports sometimes have metadata in the first few rows.
    """
    for i, line in enumerate(lines[:max_skip]):
        # Header rows typically have several fields
        parts = line.split(",")
        if len(parts) >= 3 and all(p.strip() for p in parts[:3]):
            return i
    return 0


def detect_source_type(columns: list[str]) -> Optional[str]:
    """
    Attempt to detect the report source type based on column headers.

    Returns source_name string or None if unknown.
    """
    col_set = {c.lower().strip() for c in columns}

    # Amazon Business Report - Sales & Traffic
    if {"sessions", "page views", "units ordered"}.issubset(col_set) or {
        "sessions", "page views", "ordered product sales"
    }.issubset(col_set):
        return "Amazon Business Report - Sales & Traffic"

    # ARA Sales
    if {"ordered revenue", "ordered units", "shipped revenue"}.issubset(col_set):
        return "Amazon Retail Analytics - Sales"

    # SP Advertised Product Report
    if {"advertised asin", "impressions", "clicks", "spend"}.issubset(col_set):
        return "Sponsored Products Advertised Product Report"

    # SP Campaign Report
    if {"campaign name", "impressions", "clicks", "spend"}.issubset(col_set) and (
        "7 day total sales" in col_set or "14 day total sales" in col_set
    ):
        if "advertised asin" not in col_set:
            return "Sponsored Products Campaign Report"

    # SB Campaign Report
    if {"campaign name", "impressions", "clicks", "spend"}.issubset(col_set) and (
        "14 day total sales" in col_set
    ):
        return "Sponsored Brands Campaign Report"

    # Search Query Performance
    if {"search query", "search query volume"}.issubset(col_set):
        return "Search Query Performance"

    # Search Catalog Performance
    if {"impression share"} & col_set and {"asin", "impressions", "clicks"}.issubset(col_set):
        return "Search Catalog Performance"

    # Inventory Health
    if {"available", "inbound", "unfulfillable"}.issubset(col_set):
        return "Inventory Health Report"

    return None
