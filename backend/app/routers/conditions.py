"""Conditions router — public list for profile page."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import Condition

router = APIRouter()


@router.get("")
async def list_conditions(db: AsyncSession = Depends(get_db)):
    """Public endpoint — list active conditions for profile checklist."""
    result = await db.execute(
        select(Condition).where(Condition.is_active == True).order_by(Condition.category, Condition.name)
    )
    conditions = result.scalars().all()
    return [
        {"code": c.code, "name": c.name, "category": c.category, "description": c.description}
        for c in conditions
    ]