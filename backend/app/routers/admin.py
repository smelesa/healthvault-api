"""Admin router — manage conditions list (protected by X-Admin-Key)."""
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import Condition
from app.config import get_settings

router = APIRouter()
settings = get_settings()
ADMIN_KEY = settings.ADMIN_API_KEY or ""


async def _require_admin(x_admin_key: str = Header(None)):
    if not ADMIN_KEY or x_admin_key != ADMIN_KEY:
        raise HTTPException(status_code=403, detail="Invalid or missing X-Admin-Key")


@router.get("")
async def list_conditions(
    db: AsyncSession = Depends(get_db),
    x_admin_key: str = Header(None),
):
    await _require_admin(x_admin_key)
    result = await db.execute(
        select(Condition).where(Condition.is_active == True).order_by(Condition.category, Condition.name)
    )
    conditions = result.scalars().all()
    return [
        {
            "id": str(c.id),
            "code": c.code,
            "name": c.name,
            "category": c.category,
            "description": c.description,
            "is_active": c.is_active,
        }
        for c in conditions
    ]


@router.post("")
async def create_condition(
    code: str,
    name: str,
    category: str,
    description: str | None = None,
    x_admin_key: str = Header(None),
    db: AsyncSession = Depends(get_db),
):
    await _require_admin(x_admin_key)
    existing = await db.execute(select(Condition).where(Condition.code == code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Condition with code '{code}' already exists")
    cond = Condition(code=code, name=name, category=category, description=description)
    db.add(cond)
    await db.flush()
    return {"id": str(cond.id), "code": cond.code, "name": cond.name, "category": cond.category, "is_active": True}


@router.put("/{code}")
async def update_condition(
    code: str,
    name: str | None = None,
    category: str | None = None,
    description: str | None = None,
    is_active: bool | None = None,
    x_admin_key: str = Header(None),
    db: AsyncSession = Depends(get_db),
):
    await _require_admin(x_admin_key)
    result = await db.execute(select(Condition).where(Condition.code == code))
    cond = result.scalar_one_or_none()
    if not cond:
        raise HTTPException(status_code=404, detail=f"Condition '{code}' not found")
    if name is not None:
        cond.name = name
    if category is not None:
        cond.category = category
    if description is not None:
        cond.description = description
    if is_active is not None:
        cond.is_active = is_active
    await db.flush()
    return {"code": cond.code, "name": cond.name, "category": cond.category, "is_active": cond.is_active}


@router.delete("/{code}")
async def delete_condition(
    code: str,
    x_admin_key: str = Header(None),
    db: AsyncSession = Depends(get_db),
):
    await _require_admin(x_admin_key)
    result = await db.execute(select(Condition).where(Condition.code == code))
    cond = result.scalar_one_or_none()
    if not cond:
        raise HTTPException(status_code=404, detail=f"Condition '{code}' not found")
    cond.is_active = False
    await db.flush()
    return {"code": code, "is_active": False}