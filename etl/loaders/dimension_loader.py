"""Load and upsert dimension records (products, campaigns, queries)."""
from typing import Optional
from supabase import Client


def upsert_product(
    supabase: Client,
    asin: str,
    parent_asin: Optional[str] = None,
    product_title: Optional[str] = None,
    category: Optional[str] = None,
) -> str:
    """
    Upsert a product into dim_product. Returns product_id.

    On conflict (asin), updates title/category if provided and newer.
    """
    # Check if product exists
    result = supabase.table("dim_product").select("product_id").eq("asin", asin).execute()

    if result.data:
        product_id = result.data[0]["product_id"]
        # Update fields if we have new data
        updates = {}
        if parent_asin:
            updates["parent_asin"] = parent_asin
        if product_title:
            updates["product_title"] = product_title
        if category:
            updates["category"] = category
        updates["last_seen_date"] = "now()"

        if updates:
            supabase.table("dim_product").update(updates).eq("product_id", product_id).execute()
        return product_id
    else:
        insert_data = {
            "asin": asin,
            "parent_asin": parent_asin,
            "product_title": product_title,
            "category": category,
            "brand": "CUCKOO",
            "is_active": True,
        }
        # Remove None values
        insert_data = {k: v for k, v in insert_data.items() if v is not None}
        result = supabase.table("dim_product").insert(insert_data).execute()
        return result.data[0]["product_id"]


def upsert_campaign(
    supabase: Client,
    campaign_name: str,
    campaign_type: Optional[str] = None,
) -> str:
    """Upsert a campaign into dim_campaign. Returns campaign_id."""
    result = (
        supabase.table("dim_campaign")
        .select("campaign_id")
        .eq("campaign_name", campaign_name)
        .execute()
    )

    if result.data:
        return result.data[0]["campaign_id"]
    else:
        insert_data = {
            "campaign_name": campaign_name,
            "campaign_type": campaign_type,
            "status": "active",
        }
        insert_data = {k: v for k, v in insert_data.items() if v is not None}
        result = supabase.table("dim_campaign").insert(insert_data).execute()
        return result.data[0]["campaign_id"]


def upsert_query_keyword(
    supabase: Client,
    query_text: str,
    is_branded: bool = False,
) -> str:
    """Upsert a search query into dim_query_keyword. Returns query_id."""
    query_normalized = query_text.strip().lower()

    result = (
        supabase.table("dim_query_keyword")
        .select("query_id")
        .eq("query_normalized", query_normalized)
        .execute()
    )

    if result.data:
        return result.data[0]["query_id"]
    else:
        result = (
            supabase.table("dim_query_keyword")
            .insert({
                "query_text": query_text.strip(),
                "query_normalized": query_normalized,
                "is_branded": is_branded,
                "brand_match_type": "contains" if is_branded else "none",
            })
            .execute()
        )
        return result.data[0]["query_id"]


def get_marketplace_id(supabase: Client, country_code: str = "US") -> str:
    """Get marketplace_id for a country code."""
    result = (
        supabase.table("dim_marketplace")
        .select("marketplace_id")
        .eq("country_code", country_code)
        .execute()
    )
    if result.data:
        return result.data[0]["marketplace_id"]
    raise ValueError(f"Marketplace not found for country code: {country_code}")


def get_report_source(supabase: Client, source_name: str) -> dict:
    """Get report source config by name."""
    result = (
        supabase.table("dim_report_source")
        .select("*")
        .eq("source_name", source_name)
        .execute()
    )
    if result.data:
        return result.data[0]
    raise ValueError(f"Report source not found: {source_name}")
