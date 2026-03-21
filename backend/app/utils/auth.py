import requests

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError, jwk
from app.config import settings

bearer = HTTPBearer()


def _load_jwks() -> dict:
    url = f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json"
    try:
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        print(f"[auth] WARNING: failed to load JWKS from {url}: {e}")
        return {"keys": []}


_JWKS = _load_jwks()


def _get_public_key(kid: str | None):
    keys = _JWKS.get("keys", [])
    if not keys:
        return None
    if kid:
        for key in keys:
            if key.get("kid") == kid:
                return jwk.construct(key)
    return jwk.construct(keys[0])


def _decode_token(token: str) -> dict:
    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "HS256")
        kid = header.get("kid")

        # Newer Supabase projects issue asymmetric tokens (ES256/RS256).
        if alg in ("ES256", "RS256"):
            key = _get_public_key(kid)
            if key is None:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="No public key available",
                )
            return jwt.decode(
                token,
                key,
                algorithms=[alg],
                options={"verify_aud": False},
            )

        # Backward-compatible fallback if project still uses HS256.
        return jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
    except JWTError as e:
        print(f"[auth] JWT decode failed: {e}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    """Return the raw JWT payload (has .sub = supabase_uid)."""
    return _decode_token(credentials.credentials)


async def get_db_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    payload = _decode_token(credentials.credentials)
    supabase_uid = payload.get("sub")
    email = payload.get("email", "")
    meta = payload.get("user_metadata") or {}
    name = meta.get("name") or email
    # Fall back to email prefix so manually-created accounts get the right role
    role = meta.get("role") or ("therapist" if email.startswith("therapist") else "patient")

    from app.utils.supabase_db import get_user_by_supabase_uid, upsert_user_from_jwt
    user = await get_user_by_supabase_uid(supabase_uid)
    if not user:
        print(f"[auth] uid not found, upserting email={email}")
        user = await upsert_user_from_jwt(supabase_uid, email, name, role)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def require_role(role: str):
    async def _check(user=Depends(get_db_user)):
        if user.get("role") != role:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return user
    return _check
