"""
Re-exports the Supabase client for convenience.
For raw DB access use supabase_db.py; for auth use supabase_auth.py.
"""
from app.utils.supabase_client import get_client  # noqa: F401
