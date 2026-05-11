"""FHIR utility router — Patient and Observation resources."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import User, Observation
from app.routers.auth import get_current_user

router = APIRouter()


@router.get("/Patient")
async def get_fhir_patient(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return FHIR Patient resource for current user."""
    return {
        "resourceType": "Patient",
        "id": str(user.id),
        "identifier": [{"system": "clerk", "value": user.clerk_id}],
        "email": [{"system": "email", "value": user.email}] if user.email else [],
    }


@router.get("/Observations")
async def get_fhir_observations(
    code: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return FHIR Bundle of Observation resources for current user."""
    query = select(Observation).where(Observation.user_id == user.id)

    if code:
        query = query.where(Observation.code == code)
    if date_from:
        from datetime import date
        query = query.where(Observation.effective_date >= date.fromisoformat(date_from))
    if date_to:
        from datetime import date
        query = query.where(Observation.effective_date <= date.fromisoformat(date_to))

    result = await db.execute(query.order_by(Observation.effective_date.desc()))
    observations = result.scalars().all()

    fhir_observations = []
    for obs in observations:
        fhir_obs = {
            "resourceType": "Observation",
            "id": str(obs.id),
            "status": "final",
            "code": {
                "coding": [{"system": "http://loinc.org", "code": obs.code, "display": obs.display_name}]
            },
            "subject": {"reference": f"Patient/{user.id}"},
            "effectiveDateTime": obs.effective_date.isoformat() if obs.effective_date else None,
        }
        if obs.value_numeric is not None:
            fhir_obs["valueQuantity"] = {
                "value": float(obs.value_numeric),
                "unit": obs.unit,
            }
        if obs.reference_range_low and obs.reference_range_high:
            fhir_obs["referenceRange"] = [{
                "low": {"value": float(obs.reference_range_low), "unit": obs.unit},
                "high": {"value": float(obs.reference_range_high), "unit": obs.unit},
            }]
        fhir_observations.append(fhir_obs)

    return {
        "resourceType": "Bundle",
        "type": "searchset",
        "total": len(fhir_observations),
        "entry": [{"resource": obs} for obs in fhir_observations],
    }