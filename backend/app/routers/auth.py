"""Auth router — Clerk JWT validation + user profile."""
import time
import httpx
import jwt
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.database import get_db
from app.models import User, UserProfile, Condition, UserCondition
from app.config import get_settings

router = APIRouter()
settings = get_settings()

# ── JWKS cache ─────────────────────────────────────────
_jwks_cache: dict | None = None
_jwks_cache_time: float = 0
_JWKS_CACHE_TTL = 3600


async def get_instance_jwks() -> dict:
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
    jwks = await get_instance_jwks()
    unverified_header = jwt.get_unverified_header(token)
    kid = unverified_header.get("kid", "")
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
            token, rsa_key, algorithms=["RS256"],
            options={"verify_exp": True, "verify_aud": False, "verify_iss": False, "verify_iat": False, "require": ["sub"]},
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidSignatureError:
        raise HTTPException(status_code=401, detail="Invalid signature")
    except jwt.DecodeError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token verification failed: {e}")


async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)) -> User:
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
        public_meta = payload.get("public_metadata", {}) or {}
        sex = public_meta.get("sex", "M") if isinstance(public_meta, dict) else "M"
        user = User(clerk_id=clerk_id, email=email, sex=sex)
        db.add(user)
        await db.flush()
        await db.commit()
    return user


def _profile_dict(profile: UserProfile | None) -> dict:
    if not profile:
        return {"date_of_birth": None, "height_cm": None, "weight_kg": None, "country": None, "smoking_status": None, "alcohol_use": None, "physical_activity": None, "additional_notes": None}
    return {
        "date_of_birth": profile.date_of_birth.isoformat() if profile.date_of_birth else None,
        "height_cm": float(profile.height_cm) if profile.height_cm else None,
        "weight_kg": float(profile.weight_kg) if profile.weight_kg else None,
        "country": profile.country,
        "smoking_status": profile.smoking_status,
        "alcohol_use": profile.alcohol_use,
        "physical_activity": profile.physical_activity,
        "additional_notes": profile.additional_notes,
    }


async def _user_conditions(user_id, db: AsyncSession) -> list[dict]:
    result = await db.execute(
        select(Condition, UserCondition)
        .join(UserCondition, UserCondition.condition_id == Condition.id)
        .where(UserCondition.user_id == user_id)
    )
    rows = result.all()
    return [
        {"code": c.code, "name": c.name, "category": c.category, "is_diagnosed": uc.is_diagnosed, "notes": uc.notes}
        for c, uc in rows
    ]


@router.get("/me")
async def get_me(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Get or create profile
    profile_result = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))
    profile = profile_result.scalar_one_or_none()
    conditions = await _user_conditions(user.id, db)
    return {
        "id": str(user.id),
        "clerk_id": user.clerk_id,
        "email": user.email,
        "sex": user.sex,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "profile": _profile_dict(profile),
        "conditions": conditions,
    }


@router.patch("/me")
async def update_me(
    date_of_birth: str | None = None,
    height_cm: float | None = None,
    weight_kg: float | None = None,
    country: str | None = None,
    smoking_status: str | None = None,
    alcohol_use: str | None = None,
    physical_activity: str | None = None,
    additional_notes: str | None = None,
    condition_codes: list[str] | None = None,
    is_diagnosed_map: dict[str, bool] | None = None,
    sex: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Update sex if provided
    if sex is not None and sex.upper() in ("M", "F"):
        user.sex = sex.upper()
    # Upsert profile
    profile_result = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))
    profile = profile_result.scalar_one_or_none()
    if not profile:
        profile = UserProfile(user_id=user.id)
        db.add(profile)
    if date_of_birth is not None:
        try:
            profile.date_of_birth = date.fromisoformat(date_of_birth)
        except ValueError:
            pass
    if height_cm is not None:
        profile.height_cm = height_cm
    if weight_kg is not None:
        profile.weight_kg = weight_kg
    if country is not None:
        profile.country = country
    if smoking_status is not None and smoking_status in ("never", "former", "current"):
        profile.smoking_status = smoking_status
    if alcohol_use is not None and alcohol_use in ("none", "light", "moderate", "heavy"):
        profile.alcohol_use = alcohol_use
    if physical_activity is not None and physical_activity in ("sedentary", "light", "moderate", "active"):
        profile.physical_activity = physical_activity
    if additional_notes is not None:
        profile.additional_notes = additional_notes

    # Sync conditions if provided
    if condition_codes is not None and len(condition_codes) > 0:
        is_diag = is_diagnosed_map or {}
        existing_result = await db.execute(
            select(UserCondition).join(Condition).where(UserCondition.user_id == user.id)
        )
        existing_codes = {c.code for c, _ in existing_result.all()}
        for code in condition_codes:
            if code not in existing_codes:
                cond_result = await db.execute(select(Condition).where(Condition.code == code))
                cond = cond_result.scalar_one_or_none()
                if cond:
                    uc = UserCondition(user_id=user.id, condition_id=cond.id, is_diagnosed=is_diag.get(code, False))
                    db.add(uc)
    elif condition_codes is not None:
        # Empty list = remove ALL conditions
        await db.execute(
            delete(UserCondition).where(UserCondition.user_id == user.id)
        )

    await db.flush()
    await db.commit()
    conditions = await _user_conditions(user.id, db)
    return {
        "id": str(user.id),
        "email": user.email,
        "sex": user.sex,
        "profile": _profile_dict(profile),
        "conditions": conditions,
    }


@router.post("/webhook")
async def clerk_webhook():
    return {"status": "ok"}