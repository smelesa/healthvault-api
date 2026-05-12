"""Auth router — Clerk JWT validation via Clerk Backend API (HTTP-based)."""
import time
import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import User
from app.config import get_settings

router = APIRouter()
settings = get_settings()

# JWKS cache
_jwks_cache: dict | None = None
_jwks_cache_time: float = 0
_JWKS_CACHE_TTL = 3600


async def get_instance_jwks() -> dict:
    """Fetch Clerk instance JWKS (for token signature verification)."""
    global _jwks_cache, _jwks_cache_time
    now = time.time()
    if _jwks_cache and (now - _jwks_cache_time) < _JWKS_CACHE_TTL:
        return _jwks_cache

    instance = settings.CLERK_INSTANCE
    jwks_url = f"https://{instance}.clerk.accounts.dev/.well-known/jwks.json"

    async with httpx.AsyncClient(verify=True, timeout=15.0) as client:
        resp = await client.get(jwks_url)
        resp.raise_for_status()
        _jwks_cache = resp.json()
        _jwks_cache_time = now
        return _jwks_cache


async def verify_clerk_token(token: str) -> dict:
    """
    Verify Clerk session token.
    Strategy:
    1. Try to verify with Instance JWKS (public, for Clerk session tokens)
    2. If signature fails, raise detailed error
    """
    # Get instance JWKS
    jwks = await get_instance_jwks()
    unverified_header = jwt.get_unverified_header(token)
    kid = unverified_header.get("kid", "")

    # Find the key
    rsa_key = None
    for key_data in jwks.get("keys", []):
        if key_data.get("kid") == kid:
            rsa_key = jwt.algorithms.RSAAlgorithm.from_jwk(key_data)
            break

    if not rsa_key:
        raise HTTPException(
            status_code=401,
            detail=f"Unknown signing key. Token kid={kid}. Available: {[k.get('kid') for k in jwks.get('keys', [])]}"
        )

    try:
        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=["RS256"],
            options={
                "verify_exp": True,
                "verify_aud": False,
                "verify_iss": False,
                "verify_iat": False,
                "require": ["sub"],
            },
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidSignatureError:
        raise HTTPException(
            status_code=401,
            detail=f"Invalid signature. Token kid={kid}. This usually means the token was not signed by the Clerk Instance JWKS. Available kids: {[k.get('kid') for k in jwks.get('keys', [])]}"
        )
    except jwt.DecodeError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token verification failed: {e}")


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    """Validate Clerk JWT and return current User (creating if needed)."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    token = auth_header[7:]

    payload = await verify_clerk_token(token)
    clerk_id = payload.get("sub", "")
    if not clerk_id:
        raise HTTPException(status_code=401, detail="Token missing 'sub' claim")

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
    return {
        "id": str(user.id),
        "clerk_id": user.clerk_id,
        "email": user.email,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


@router.post("/webhook")
async def clerk_webhook():
    return {"status": "ok"}
