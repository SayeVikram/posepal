from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.models.schemas import LoginRequest, ProfileUpdate, RegisterRequest, TokenResponse, UserProfile
from app.utils.auth import get_db_user
from app.utils.supabase_auth import sign_in, sign_up
from app.utils.supabase_db import get_user_by_id, update_user_profile
from app.utils.supabase_storage import upload_avatar

router = APIRouter()


@router.post("/register", response_model=TokenResponse)
async def register(body: RegisterRequest):
    result = await sign_up(body.email, body.password, body.name, body.role)
    if not result:
        raise HTTPException(status_code=400, detail="Registration failed")
    return result


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    result = await sign_in(body.email, body.password)
    if not result:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return result


@router.get("/me", response_model=UserProfile)
async def me(user=Depends(get_db_user)):
    return user


@router.patch("/me", response_model=UserProfile)
async def update_me(body: ProfileUpdate, user=Depends(get_db_user)):
    updates = body.model_dump(exclude_none=True)
    if not updates:
        return user
    updated = await update_user_profile(user["id"], **updates)
    return updated if updated else user


@router.get("/user/{user_id}", response_model=UserProfile)
async def get_user_profile(user_id: int, _user=Depends(get_db_user)):
    profile = await get_user_by_id(user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")
    return profile


@router.post("/upload-avatar", response_model=UserProfile)
async def upload_my_avatar(file: UploadFile = File(...), user=Depends(get_db_user)):
    data = await file.read()
    try:
        url = await upload_avatar(data, user["id"], file.filename or "avatar", file.content_type or "image/jpeg")
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Storage upload failed. Ensure the 'avatars' bucket exists in Supabase Storage. ({e})",
        )
    try:
        updated = await update_user_profile(user["id"], avatar=url)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"DB update failed. Run: ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar text; ({e})",
        )
    return updated if updated else user
