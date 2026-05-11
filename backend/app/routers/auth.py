"""Auth router — Clerk JWT validation + webhook handler."""
from fastapi import APIRouter, Request, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import User
from app.config import get_settings
import jwt
import hmac
import hashlib

router = APIRouter()
settings = get_settings()


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    """Validate Clerk JWT and return current User (creating if needed)."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    token = auth_header[7:]  # Strip "Bearer "

    try:
        payload = jwt.decode(
            token,
            settings.CLERK_SECRET_KEY,
            algorithms=["HS256"],
            audience=settings.CLERK_PUBLISHABLE_KEY,
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")

    clerk_id: str = payload.get("sub", "")
    if not clerk_id:
        raise HTTPException(status_code=401, detail="No subject in token")

    # Upsert user
    result = await db.execute(select(User).where(User.clerk_id == clerk_id))
    user = result.scalar_one_or_none()

    if not user:
        email = payload.get("email", "")
        user = User(clerk_id=clerk_id, email=email)
        db.add(user)
        await db.flush()

    return user


@router.get("/me")
async def get_me(user: User = Depends(get_current_user)):
    """Return current authenticated user info."""
    return {
        "id": str(user.id),
        "clerk_id": user.clerk_id,
        "email": user.email,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


@router.post("/webhook")
async def clerk_webhook(request: Request):
    """Handle Clerk webhook events (user.created, user.updated)."""
    body = await request.json()
    event_type = body.get("type", "")
    data = body.get("data", {})

    if event_type in ("user.created", "user.updated"):
        # In production: update user record in DB
        # For now, user is auto-created on first API call via get_current_user
        pass

    return {"status": "ok"}