"""
Server-side Supabase client.

Uses the secret key, which bypasses Row Level Security. Only use it behind
endpoints that check the caller is an authorized researcher.
"""

from functools import lru_cache

from supabase import Client, create_client

from app.config import get_settings


@lru_cache
def get_supabase() -> Client:
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_secret_key)
