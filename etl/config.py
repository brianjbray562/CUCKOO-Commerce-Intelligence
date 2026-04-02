"""ETL configuration and Supabase connection."""
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", os.getenv("NEXT_PUBLIC_SUPABASE_URL", ""))
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", ""))

# Brand names for branded query detection
BRAND_NAMES = ["cuckoo", "cuckoo electronics"]

# Standard date formats to try during parsing
DATE_FORMATS = [
    "%Y-%m-%d",
    "%m/%d/%Y",
    "%m/%d/%y",
    "%Y/%m/%d",
    "%d-%b-%Y",
    "%B %d, %Y",
    "%b %d, %Y",
]

# Currency symbols to strip from revenue fields
CURRENCY_SYMBOLS = ["$", ",", "USD", "CAD", "MXN"]

# Percentage fields that might come as "12.5%" instead of 0.125
PERCENTAGE_FIELDS = [
    "buy_box_percentage",
    "unit_session_percentage",
    "session_percentage",
    "page_views_percentage",
    "impression_share",
    "click_share",
    "purchase_share",
    "in_stock_rate",
    "buy_box_win_rate",
    "ctr",
    "acos",
]


def get_supabase_client() -> Client:
    """Create and return a Supabase client."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set")
    return create_client(SUPABASE_URL, SUPABASE_KEY)
