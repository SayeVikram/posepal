from app.utils.supabase_client import get_client


async def sign_up(email: str, password: str, name: str, role: str) -> dict | None:
    sb = get_client()

    # Use admin API so no confirmation email is sent — user is active immediately.
    res = sb.auth.admin.create_user({
        "email": email,
        "password": password,
        "email_confirm": True,
        "user_metadata": {"name": name, "role": role},
    })
    if res.user is None:
        return None

    supabase_uid = res.user.id
    sb.table("users").insert({
        "supabase_uid": supabase_uid,
        "email": email,
        "name": name,
        "role": role,
    }).execute()

    # Sign in to get a live session token
    sign_in_res = sb.auth.sign_in_with_password({"email": email, "password": password})
    return {
        "access_token": sign_in_res.session.access_token if sign_in_res.session else "",
        "token_type": "bearer",
        "user_id": supabase_uid,
    }


async def sign_in(email: str, password: str) -> dict | None:
    sb = get_client()
    res = sb.auth.sign_in_with_password({"email": email, "password": password})
    if res.session is None:
        return None
    return {
        "access_token": res.session.access_token,
        "token_type": "bearer",
        "user_id": res.user.id,
    }
