"""Load validated, normalized rows into fact tables."""
from typing import Optional
from supabase import Client
from etl.loaders.dimension_loader import (
    upsert_product,
    upsert_campaign,
    upsert_query_keyword,
    get_marketplace_id,
)


def load_sales_row(
    supabase: Client,
    row: dict,
    batch_id: str,
    marketplace_id: str,
) -> Optional[str]:
    """Load a row into fact_sales. Returns the row id or None on error."""
    product_id = upsert_product(
        supabase,
        asin=row["asin"],
        parent_asin=row.get("parent_asin"),
        product_title=row.get("product_title"),
        category=row.get("category"),
    )

    fact_row = {
        "date_key": row["date_key"],
        "product_id": product_id,
        "marketplace_id": marketplace_id,
        "batch_id": batch_id,
        "ordered_revenue": float(row.get("ordered_revenue", 0)),
        "ordered_units": int(float(row.get("ordered_units", 0))),
        "shipped_revenue": float(row.get("shipped_revenue", 0)),
        "shipped_units": int(float(row.get("shipped_units", 0))),
        "shipped_cogs": float(row.get("shipped_cogs", 0)),
        "avg_selling_price": float(row.get("avg_selling_price", 0)),
        "subcategory_rank": _safe_int(row.get("subcategory_rank")),
        "category_rank": _safe_int(row.get("category_rank")),
    }

    result = supabase.table("fact_sales").upsert(
        fact_row,
        on_conflict="date_key,product_id,marketplace_id,batch_id",
    ).execute()

    return result.data[0]["id"] if result.data else None


def load_advertising_row(
    supabase: Client,
    row: dict,
    batch_id: str,
    marketplace_id: str,
) -> Optional[str]:
    """Load a row into fact_advertising."""
    product_id = None
    if row.get("asin"):
        product_id = upsert_product(supabase, asin=row["asin"])

    campaign_id = None
    if row.get("campaign_name"):
        campaign_id = upsert_campaign(
            supabase,
            campaign_name=row["campaign_name"],
            campaign_type=row.get("campaign_type"),
        )

    fact_row = {
        "date_key": row["date_key"],
        "product_id": product_id,
        "campaign_id": campaign_id,
        "marketplace_id": marketplace_id,
        "batch_id": batch_id,
        "impressions": int(float(row.get("impressions", 0))),
        "clicks": int(float(row.get("clicks", 0))),
        "spend": float(row.get("spend", 0)),
        "ad_sales": float(row.get("ad_sales", 0)),
        "ad_units": int(float(row.get("ad_units", 0))),
        "orders": int(float(row.get("orders", 0))),
        "ctr": float(row.get("ctr", 0)),
        "cpc": float(row.get("cpc", 0)),
        "acos": float(row.get("acos", 0)),
        "roas": float(row.get("roas", 0)),
    }

    result = supabase.table("fact_advertising").insert(fact_row).execute()
    return result.data[0]["id"] if result.data else None


def load_traffic_row(
    supabase: Client,
    row: dict,
    batch_id: str,
    marketplace_id: str,
) -> Optional[str]:
    """Load a row into fact_traffic_conversion."""
    product_id = upsert_product(
        supabase,
        asin=row["asin"],
        product_title=row.get("product_title"),
    )

    fact_row = {
        "date_key": row["date_key"],
        "product_id": product_id,
        "marketplace_id": marketplace_id,
        "batch_id": batch_id,
        "sessions": int(float(row.get("sessions", 0))),
        "page_views": int(float(row.get("page_views", 0))),
        "page_views_percentage": float(row.get("page_views_percentage", 0)),
        "buy_box_percentage": float(row.get("buy_box_percentage", 0)),
        "unit_session_percentage": float(row.get("unit_session_percentage", 0)),
        "session_percentage": float(row.get("session_percentage", 0)),
    }

    result = supabase.table("fact_traffic_conversion").upsert(
        fact_row,
        on_conflict="date_key,product_id,marketplace_id,batch_id",
    ).execute()

    return result.data[0]["id"] if result.data else None


def load_search_row(
    supabase: Client,
    row: dict,
    batch_id: str,
    marketplace_id: str,
    period_start: str,
    period_end: str,
) -> Optional[str]:
    """Load a row into fact_search_visibility."""
    product_id = None
    if row.get("asin"):
        product_id = upsert_product(supabase, asin=row["asin"])

    query_id = None
    if row.get("query_text"):
        query_id = upsert_query_keyword(
            supabase,
            query_text=row["query_text"],
            is_branded=row.get("is_branded", False),
        )

    fact_row = {
        "period_start": period_start,
        "period_end": period_end,
        "product_id": product_id,
        "query_id": query_id,
        "marketplace_id": marketplace_id,
        "batch_id": batch_id,
        "search_query_volume": int(float(row.get("search_query_volume", 0))),
        "search_query_rank": _safe_int(row.get("search_query_rank")),
        "impressions": int(float(row.get("impressions", 0))),
        "clicks": int(float(row.get("clicks", 0))),
        "cart_adds": int(float(row.get("cart_adds", 0))),
        "purchases": int(float(row.get("purchases", 0))),
        "impression_share": float(row.get("impression_share", 0)),
        "click_share": float(row.get("click_share", 0)),
        "purchase_share": float(row.get("purchase_share", 0)),
        "brand_impression_share": float(row.get("brand_impression_share", 0)),
    }

    result = supabase.table("fact_search_visibility").insert(fact_row).execute()
    return result.data[0]["id"] if result.data else None


# Mapping of source_category to loader function
CATEGORY_LOADERS = {
    "sales": load_sales_row,
    "advertising": load_advertising_row,
}


def _safe_int(value) -> Optional[int]:
    """Safely convert to int, returning None for empty/invalid."""
    if value is None or value == "" or value == "None":
        return None
    try:
        return int(float(value))
    except (ValueError, TypeError):
        return None
