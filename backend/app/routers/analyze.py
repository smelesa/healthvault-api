"""Analyze router — AI-powered health analysis."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import User, Document, Observation
from app.routers.auth import get_current_user
from app.config import get_settings

router = APIRouter()
settings = get_settings()


@router.post("")
async def analyze_documents(
    document_ids: list[str] | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Analyze all or specific user documents using RAG + Groq."""
    # Get documents
    query = select(Document).options(
        selectinload(Document.observations)
    ).where(and_(Document.user_id == user.id, Document.deleted_at.is_(None)))

    if document_ids:
        query = query.where(Document.id.in_(document_ids))

    result = await db.execute(query)
    documents = result.scalars().all()

    if not documents:
        return {
            "biomarkers": [],
            "deviations": [],
            "risk_factors": [],
            "recommendations": [],
            "summary": "No documents found to analyze.",
            "confidence": 0.0,
        }

    # Build observations summary
    observations = []
    for doc in documents:
        for obs in doc.observations:
            observations.append({
                "code": obs.code,
                "display_name": obs.display_name,
                "value": float(obs.value_numeric) if obs.value_numeric else None,
                "unit": obs.unit,
                "reference_range_low": float(obs.reference_range_low) if obs.reference_range_low else None,
                "reference_range_high": float(obs.reference_range_high) if obs.reference_range_high else None,
                "interpretation": obs.interpretation,
                "effective_date": obs.effective_date.isoformat() if obs.effective_date else None,
                "reference_source": obs.reference_source,
            })

    # Call Groq for analysis
    summary, risk_factors, recommendations, confidence = await _call_groq_analysis(observations)

    # Identify deviations
    deviations = [
        obs for obs in observations
        if obs["interpretation"] in ("high", "low", "critical_high", "critical_low")
    ]

    # Biomarker summary (latest per code)
    latest_by_code = {}
    for obs in observations:
        code = obs["code"]
        if code not in latest_by_code or (obs["effective_date"] and latest_by_code[code]["effective_date"] and obs["effective_date"] > latest_by_code[code]["effective_date"]):
            latest_by_code[code] = obs

    biomarkers = list(latest_by_code.values())

    return {
        "biomarkers": biomarkers,
        "deviations": deviations,
        "risk_factors": risk_factors,
        "recommendations": recommendations,
        "summary": summary,
        "confidence": confidence,
    }


@router.get("/biomarkers")
async def list_biomarkers(
    code: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all extracted biomarkers for the user."""
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

    return {
        "items": [
            {
                "code": obs.code,
                "display_name": obs.display_name,
                "value": float(obs.value_numeric) if obs.value_numeric else None,
                "unit": obs.unit,
                "interpretation": obs.interpretation,
                "effective_date": obs.effective_date.isoformat() if obs.effective_date else None,
            }
            for obs in observations
        ]
    }


async def _call_groq_analysis(observations: list) -> tuple[str, list, list, float]:
    """Call Groq LLM to analyze biomarker observations."""
    if not observations:
        return "No data available for analysis.", [], [], 0.0

    # Build context
    obs_table = []
    for obs in observations:
        ref_str = ""
        if obs.get("reference_range_low") and obs.get("reference_range_high"):
            ref_str = f" (ref: {obs['reference_range_low']}-{obs['reference_range_high']})"
        obs_table.append(f"- {obs['display_name']} ({obs['code']}): {obs['value']} {obs['unit']}{ref_str} [{obs['interpretation']}]")

    context = "\n".join(obs_table)

    prompt = f"""You are HealthVault Analysis Assistant. Analyze the following biomarker results and provide:
1. A summary paragraph (2-3 sentences)
2. Risk factors (list, max 3)
3. Recommendations (list, max 3)

Biomarker results:
{context}

Respond in JSON format:
{{"summary": "...", "risk_factors": [...], "recommendations": [...], "confidence": 0.0-1.0}}

Only include risk factors and recommendations directly supported by the data."""

    try:
        from groq import Groq
        client = Groq(api_key=settings.GROQ_API_KEY)
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are HealthVault Analysis Assistant. Always respond in JSON format."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=1024,
        )

        import json
        content = response.choices[0].message.content
        # Try to parse JSON from response
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]

        result = json.loads(content.strip())
        return (
            result.get("summary", ""),
            result.get("risk_factors", []),
            result.get("recommendations", []),
            result.get("confidence", 0.8),
        )
    except Exception as e:
        return (
            f"Analysis could not be completed: {e}",
            [],
            ["Upload more lab reports for better analysis"],
            0.3,
        )