from fastapi import APIRouter, Depends, HTTPException

from app.models.schemas import LoginRequest, RegisterRequest, TokenResponse, UserProfile
from app.utils.auth import get_db_user
from app.utils.supabase_auth import sign_in, sign_up

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
