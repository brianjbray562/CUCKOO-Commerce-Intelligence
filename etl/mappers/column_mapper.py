"""Map source columns to canonical schema columns with fuzzy matching."""
from difflib import SequenceMatcher
from typing import Optional


# Canonical column aliases: maps various source column names to our standard names.
# This handles the fact that Amazon reports use inconsistent column naming.
COLUMN_ALIASES: dict[str, list[str]] = {
    # Date
    "date_key": ["date", "day", "report date", "date range"],
    # Product identifiers
    "asin": ["asin", "(child) asin", "advertised asin", "promoted asin", "child asin"],
    "parent_asin": ["parent asin", "(parent) asin"],
    "sku": ["sku", "seller sku", "merchant sku"],
    "product_title": [
        "product title", "title", "product name", "item name",
        "(child) asin title", "advertised product title",
    ],
    # Sales metrics
    "ordered_revenue": [
        "ordered product sales", "ordered revenue", "ordered product sales amount",
        "sales", "revenue", "total sales",
    ],
    "ordered_units": [
        "units ordered", "ordered units", "total units", "units",
    ],
    "shipped_revenue": ["shipped revenue", "shipped product sales"],
    "shipped_units": ["shipped units"],
    "avg_selling_price": [
        "average selling price", "avg selling price", "asp",
        "average sales price", "avg. selling price",
    ],
    # Traffic metrics
    "sessions": ["sessions", "total sessions", "session count"],
    "page_views": ["page views", "pageviews", "page views - total", "detail page views"],
    "buy_box_percentage": [
        "buy box percentage", "featured offer (buy box) percentage",
        "buy box %", "buybox %",
    ],
    "unit_session_percentage": [
        "unit session percentage", "conversion rate",
        "unit session percentage - b2c",
    ],
    "session_percentage": ["session percentage"],
    "page_views_percentage": ["page views percentage"],
    # Advertising metrics
    "campaign_name": ["campaign name", "campaign"],
    "ad_group_name": ["ad group name", "ad group"],
    "targeting": ["targeting", "targeting expression", "keyword"],
    "match_type": ["match type"],
    "impressions": ["impressions", "impr.", "impr"],
    "clicks": ["clicks"],
    "spend": ["spend", "cost", "total spend", "cost per click (cpc)"],
    "ad_sales": [
        "7 day total sales", "14 day total sales",
        "total advertising sales", "sales", "attributed sales",
    ],
    "ad_units": [
        "7 day total units", "14 day total units",
        "total advertising units", "attributed units",
    ],
    "orders": [
        "7 day total orders", "14 day total orders",
        "total orders", "attributed orders",
    ],
    "ctr": ["click-thru rate (ctr)", "ctr", "click through rate"],
    "cpc": ["cost per click (cpc)", "cpc", "avg cpc"],
    "acos": ["total advertising cost of sales (acos)", "acos", "acos %"],
    "roas": ["total return on advertising spend (roas)", "roas"],
    # Search visibility
    "query_text": ["search query", "query", "keyword", "search term"],
    "search_query_volume": [
        "search query volume", "search volume", "query volume",
    ],
    "search_query_rank": ["search query score", "search frequency rank"],
    "impression_share": ["impression share", "search impression share"],
    "click_share": ["click share", "search click share"],
    "purchase_share": ["purchase share", "search conversion share"],
    "cart_adds": ["cart adds", "add to cart", "add to carts"],
    "purchases": ["purchases", "purchase count"],
    # Operational
    "available_units": ["available", "available units", "afn fulfillable quantity"],
    "unfulfillable_units": ["unfulfillable", "unfulfillable quantity"],
    "sellable_units": ["sellable", "sellable units"],
    # Reviews
    "avg_rating": ["rating", "average rating", "star rating", "avg rating"],
    "review_count_new": ["review count", "reviews", "new reviews"],
    # Promotions
    "promo_type": ["promotion type", "deal type", "promo type"],
    "promo_start": ["start date", "promotion start date"],
    "promo_end": ["end date", "promotion end date"],
    "discount_percentage": ["discount", "discount %", "discount percentage"],
}

# Build reverse lookup
_ALIAS_LOOKUP: dict[str, str] = {}
for canonical, aliases in COLUMN_ALIASES.items():
    for alias in aliases:
        _ALIAS_LOOKUP[alias.lower().strip()] = canonical


def auto_map_columns(
    source_columns: list[str],
    mapping_template: Optional[dict[str, str]] = None,
) -> list[dict]:
    """
    Generate column mapping suggestions for source columns.

    Returns list of {sourceColumn, targetColumn, confidence, isRequired}.
    """
    mappings = []

    for col in source_columns:
        col_lower = col.lower().strip()
        target = None
        confidence = 0.0

        # 1. Check explicit mapping template from report source config
        if mapping_template and col in mapping_template:
            target = mapping_template[col]
            confidence = 1.0
        # 2. Check alias lookup (exact match)
        elif col_lower in _ALIAS_LOOKUP:
            target = _ALIAS_LOOKUP[col_lower]
            confidence = 0.95
        else:
            # 3. Fuzzy match against known aliases
            best_score = 0.0
            best_target = None
            for alias, canonical in _ALIAS_LOOKUP.items():
                score = SequenceMatcher(None, col_lower, alias).ratio()
                if score > best_score and score >= 0.75:
                    best_score = score
                    best_target = canonical
            if best_target:
                target = best_target
                confidence = best_score * 0.9  # Discount fuzzy matches

        is_required = target in ("date_key", "asin") if target else False
        mappings.append({
            "sourceColumn": col,
            "targetColumn": target,
            "confidence": round(confidence, 2),
            "isRequired": is_required,
        })

    return mappings


def apply_mapping(
    row: dict[str, str],
    column_mapping: dict[str, str],
) -> dict[str, str]:
    """
    Apply a column mapping to a raw row dict.

    column_mapping: {source_col: canonical_col}
    Returns dict with canonical column names.
    """
    mapped = {}
    for source_col, canonical_col in column_mapping.items():
        if canonical_col and source_col in row:
            mapped[canonical_col] = row[source_col]
    return mapped
