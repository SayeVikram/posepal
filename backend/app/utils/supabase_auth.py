import requests

from app.config import settings
from app.utils.supabase_db import upsert_user_from_jwt


def _auth_headers(apikey: str) -> dict:
    return {
        "apikey": apikey,
        "Authorization": f"Bearer {apikey}",
        "Content-Type": "application/json",
    }


def _admin_create_user(email: str, password: str, name: str, role: str) -> str | None:
    url = f"{settings.SUPABASE_URL}/auth/v1/admin/users"
    resp = requests.post(
        url,
        headers=_auth_headers(settings.SUPABASE_SERVICE_ROLE_KEY),
        json={
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {"name": name, "role": role},
        },
        timeout=20,
    )
    print(f"[register] admin API status={resp.status_code} body={resp.text[:300]}")
    if resp.status_code != 200:
        return None
    return (resp.json() or {}).get("id")


def _public_sign_up(email: str, password: str, name: str, role: str) -> str | None:
    url = f"{settings.SUPABASE_URL}/auth/v1/signup"
    resp = requests.post(
        url,
        headers=_auth_headers(settings.SUPABASE_ANON_KEY),
        json={
            "email": email,
            "password": password,
            "data": {"name": name, "role": role},
        },
        timeout=20,
    )
    print(f"[register] public signup status={resp.status_code} body={resp.text[:300]}")
    if resp.status_code not in (200, 201):
        return None
    user = (resp.json() or {}).get("user") or {}
    return user.get("id")


def _public_sign_in(email: str, password: str) -> tuple[str, str] | None:
    url = f"{settings.SUPABASE_URL}/auth/v1/token?grant_type=password"
    resp = requests.post(
        url,
        headers={"apikey": settings.SUPABASE_ANON_KEY, "Content-Type": "application/json"},
        json={"email": email, "password": password},
        timeout=20,
    )
    if resp.status_code != 200:
        return None
    payload = resp.json() or {}
    token = payload.get("access_token")
    user = payload.get("user") or {}
    uid = user.get("id")
    if not token or not uid:
        return None
    return token, uid


async def sign_up(email: str, password: str, name: str, role: str) -> dict | None:
    supabase_uid = _admin_create_user(email, password, name, role)
    if supabase_uid is None:
        supabase_uid = _public_sign_up(email, password, name, role)
    if supabase_uid is None:
        return None

    await upsert_user_from_jwt(supabase_uid, email, name, role)

    signin = _public_sign_in(email, password)
    access_token = signin[0] if signin else ""

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": supabase_uid,
    }


async def sign_in(email: str, password: str) -> dict | None:
    signin = _public_sign_in(email, password)
    if signin is None:
        return None
    access_token, user_id = signin
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user_id,
    }
