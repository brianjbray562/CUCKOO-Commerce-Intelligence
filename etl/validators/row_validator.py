"""Validate and normalize mapped rows before loading into fact tables."""
import re
from datetime import datetime
from typing import Optional
from etl.config import DATE_FORMATS, CURRENCY_SYMBOLS, PERCENTAGE_FIELDS, BRAND_NAMES


class ValidationResult:
    def __init__(self):
        self.errors: list[dict] = []
        self.warnings: list[dict] = []

    @property
    def is_valid(self) -> bool:
        return len(self.errors) == 0

    def add_error(self, field: str, message: str):
        self.errors.append({"field": field, "message": message})

    def add_warning(self, field: str, message: str):
        self.warnings.append({"field": field, "message": message})


def validate_and_normalize(
    row: dict[str, str],
    source_category: str,
    row_number: int,
) -> tuple[dict, ValidationResult]:
    """
    Validate a mapped row and normalize values.

    Returns (normalized_row, validation_result).
    """
    result = ValidationResult()
    normalized = {}

    for key, value in row.items():
        if key == "date_key":
            parsed = _parse_date(value)
            if parsed:
                normalized[key] = parsed
            else:
                result.add_error(key, f"Could not parse date: '{value}'")
        elif key == "asin":
            asin = _normalize_asin(value)
            if asin:
                normalized[key] = asin
            else:
                result.add_error(key, f"Invalid ASIN: '{value}'")
        elif key == "parent_asin":
            asin = _normalize_asin(value)
            normalized[key] = asin  # Can be None
        elif key in PERCENTAGE_FIELDS:
            normalized[key] = _parse_percentage(value)
        elif _is_numeric_field(key):
            normalized[key] = _parse_numeric(value)
        elif key == "campaign_name":
            normalized[key] = value.strip() if value else None
        elif key == "query_text":
            normalized[key] = value.strip() if value else None
            normalized["query_normalized"] = value.strip().lower() if value else None
            # Detect branded queries
            if value:
                normalized["is_branded"] = _is_branded_query(value)
        else:
            normalized[key] = value.strip() if value else None

    # Validate required fields based on source category
    if source_category in ("sales", "advertising", "operations", "reviews"):
        if "date_key" not in normalized or not normalized.get("date_key"):
            result.add_error("date_key", "Date is required")

    if "asin" not in normalized or not normalized.get("asin"):
        # Some campaign-level reports don't have ASINs
        if source_category != "advertising":
            result.add_error("asin", "ASIN is required")

    # Calculate derived fields
    if source_category == "advertising":
        spend = _safe_float(normalized.get("spend", 0))
        ad_sales = _safe_float(normalized.get("ad_sales", 0))
        clicks = _safe_float(normalized.get("clicks", 0))
        impressions = _safe_float(normalized.get("impressions", 0))

        if ad_sales > 0 and "acos" not in normalized:
            normalized["acos"] = spend / ad_sales
        if spend > 0 and "roas" not in normalized:
            normalized["roas"] = ad_sales / spend
        if clicks > 0 and "cpc" not in normalized:
            normalized["cpc"] = spend / clicks
        if impressions > 0 and "ctr" not in normalized:
            normalized["ctr"] = clicks / impressions

    return normalized, result


def _parse_date(value: str) -> Optional[str]:
    """Try to parse a date string into ISO format."""
    if not value or not value.strip():
        return None

    value = value.strip()

    # Handle date ranges like "01/01/2024 - 01/07/2024" (take start date)
    if " - " in value:
        value = value.split(" - ")[0].strip()

    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(value, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue

    # Try pandas as a fallback
    try:
        from dateutil import parser as dateutil_parser
        parsed = dateutil_parser.parse(value)
        return parsed.strftime("%Y-%m-%d")
    except (ValueError, TypeError):
        return None


def _normalize_asin(value: str) -> Optional[str]:
    """Normalize an ASIN value. Valid ASINs are 10 characters, alphanumeric."""
    if not value or not value.strip():
        return None

    asin = value.strip().upper()
    # Remove any leading/trailing quotes
    asin = asin.strip("'\"")

    if len(asin) == 10 and asin.isalnum():
        return asin

    # Some exports prefix with = or wrap in quotes
    cleaned = re.sub(r"[=\"']", "", asin)
    if len(cleaned) == 10 and cleaned.isalnum():
        return cleaned

    return None


def _parse_numeric(value) -> float:
    """Parse a numeric value, stripping currency symbols and commas."""
    if value is None or value == "":
        return 0.0

    if isinstance(value, (int, float)):
        return float(value)

    s = str(value).strip()
    for symbol in CURRENCY_SYMBOLS:
        s = s.replace(symbol, "")
    s = s.strip()

    # Handle parentheses for negatives: (123.45) -> -123.45
    if s.startswith("(") and s.endswith(")"):
        s = "-" + s[1:-1]

    try:
        return float(s)
    except ValueError:
        return 0.0


def _parse_percentage(value) -> float:
    """Parse a percentage value. Returns as decimal (0.125 for 12.5%)."""
    if value is None or value == "":
        return 0.0

    if isinstance(value, (int, float)):
        v = float(value)
        # If the value is > 1, it's likely a percentage (12.5 -> 0.125)
        return v / 100 if v > 1 else v

    s = str(value).strip().replace("%", "").replace(",", "").strip()
    try:
        v = float(s)
        return v / 100 if v > 1 else v
    except ValueError:
        return 0.0


def _is_numeric_field(key: str) -> bool:
    """Check if a field should be treated as numeric."""
    numeric_suffixes = [
        "revenue", "units", "sales", "spend", "cogs",
        "price", "rank", "impressions", "clicks", "orders",
        "volume", "count", "score", "views",
    ]
    return any(key.endswith(suffix) or suffix in key for suffix in numeric_suffixes)


def _is_branded_query(query: str) -> bool:
    """Check if a search query is branded."""
    q_lower = query.lower().strip()
    return any(brand in q_lower for brand in BRAND_NAMES)


def _safe_float(value) -> float:
    """Safely convert to float."""
    try:
        return float(value) if value else 0.0
    except (ValueError, TypeError):
        return 0.0
