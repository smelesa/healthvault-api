"""Documents router — upload, list, get, delete."""
import os
import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, Request
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import User, Document, Observation
from app.routers.auth import get_current_user
from app.services.biomarker_parser import parse_biomarkers_from_text
from app.config import get_settings
from app.utils.encryption import FernetEncryption

router = APIRouter()
settings = get_settings()
fernet = FernetEncryption(settings.ENCRYPTION_KEY)


async def extract_text_from_file(file: UploadFile, file_path: str) -> tuple[str, str]:
    """Extract text from PDF or image. Returns (text, document_type)."""
    ext = file.filename.split(".")[-1].lower() if file.filename else "pdf"

    # For images — OCR with PaddleOCR (deferred import to avoid slow import at startup)
    if ext in ("jpg", "jpeg", "png", "gif", "bmp"):
        from app.services.ocr_service import extract_text_from_image
        text = await extract_text_from_image(file_path)
        return text, "lab_report"

    # For PDFs — extract text
    from app.services.pdf_service import extract_text_from_pdf
    text = await extract_text_from_pdf(file_path)

    # Simple document type detection
    doc_type = "lab_report"  # default
    if any(k in text.lower() for k in ["prescription", "rx:", "recipe"]):
        doc_type = "prescription"
    elif any(k in text.lower() for k in ["ct scan", "mri", "x-ray", "ultrasound", "imaging"]):
        doc_type = "imaging"

    return text, doc_type


@router.post("/upload")
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    document_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Upload and process a document."""
    # Validate file size
    content = await file.read()
    size_mb = len(content) / (1024 * 1024)
    if size_mb > settings.MAX_UPLOAD_SIZE_MB:
        raise HTTPException(status_code=400, detail=f"File too large (max {settings.MAX_UPLOAD_SIZE_MB}MB)")

    # Reset file position
    await file.seek(0)

    # Save file to vault
    doc_id = str(uuid.uuid4())
    ext = file.filename.split(".")[-1].lower() if file.filename else "pdf"
    relative_path = f"{user.id}/{doc_id}.{ext}"
    full_path = os.path.join(settings.VAULT_PATH, relative_path)

    os.makedirs(os.path.dirname(full_path), exist_ok=True)

    # Encrypt and save
    with open(full_path, "wb") as f:
        encrypted_data = fernet.encrypt(content)
        f.write(encrypted_data)

    # Extract text
    # For now, save content to temp file for text extraction
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        extracted_text, detected_type = await extract_text_from_file(file, tmp_path)
    except Exception as e:
        extracted_text = ""
        detected_type = "other"
    finally:
        os.unlink(tmp_path)

    doc_type = document_type or detected_type

    # Create document record
    document = Document(
        id=uuid.UUID(doc_id),
        user_id=user.id,
        file_path=relative_path,
        file_type=ext,
        document_type=doc_type,
        extracted_text=extracted_text,
    )
    db.add(document)

    # Parse biomarkers (if lab_report)
    observations = []
    if doc_type == "lab_report" and extracted_text:
        parsed = parse_biomarkers_from_text(extracted_text, sex="M")  # TODO: get sex from user profile
        for p in parsed:
            obs = Observation(
                id=uuid.uuid4(),
                document_id=document.id,
                user_id=user.id,
                code=p.code,
                display_name=p.display_name,
                value_numeric=p.value,
                unit=p.unit,
                reference_range_low=p.reference_range_low,
                reference_range_high=p.reference_range_high,
                standard_reference_range_low=p.standard_reference_range_low,
                standard_reference_range_high=p.standard_reference_range_high,
                lab_reference_range_low=p.lab_reference_range_low,
                lab_reference_range_high=p.lab_reference_range_high,
                reference_source=p.reference_source,
                interpretation=p.interpretation,
                effective_date=datetime.utcnow().date(),
            )
            db.add(obs)
            observations.append({
                "code": p.code,
                "value": p.value,
                "unit": p.unit,
                "interpretation": p.interpretation,
            })

    await db.flush()

    return {
        "id": str(document.id),
        "document_type": doc_type,
        "file_path": relative_path,
        "observations": observations,
        "created_at": document.created_at.isoformat(),
    }


@router.get("")
async def list_documents(
    type: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List user's documents with optional filters."""
    query = select(Document).where(
        and_(Document.user_id == user.id, Document.deleted_at.is_(None))
    )

    if type:
        query = query.where(Document.document_type == type)
    if date_from:
        query = query.where(Document.created_at >= datetime.fromisoformat(date_from))
    if date_to:
        query = query.where(Document.created_at <= datetime.fromisoformat(date_to))

    # Full-text search on extracted_text
    if search:
        query = query.where(Document.extracted_text.ilike(f"%{search}%"))

    # Count total
    from sqlalchemy import func
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar()

    # Pagination
    offset = (page - 1) * limit
    query = query.order_by(Document.created_at.desc()).offset(offset).limit(limit)

    result = await db.execute(query)
    documents = result.scalars().all()

    return {
        "items": [
            {
                "id": str(doc.id),
                "document_type": doc.document_type,
                "file_type": doc.file_type,
                "created_at": doc.created_at.isoformat(),
                "summary": (doc.extracted_text or "")[:200] if doc.extracted_text else None,
            }
            for doc in documents
        ],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.get("/{doc_id}")
async def get_document(
    doc_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get document detail with observations."""
    result = await db.execute(
        select(Document)
        .options(selectinload(Document.observations))
        .where(and_(Document.id == uuid.UUID(doc_id), Document.user_id == user.id))
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    return {
        "id": str(doc.id),
        "document_type": doc.document_type,
        "file_type": doc.file_type,
        "file_path": doc.file_path,
        "fhir_resource": doc.fhir_resource,
        "extracted_text": doc.extracted_text,
        "observations": [
            {
                "code": obs.code,
                "display_name": obs.display_name,
                "value": float(obs.value_numeric) if obs.value_numeric else None,
                "unit": obs.unit,
                "reference_range_low": float(obs.reference_range_low) if obs.reference_range_low else None,
                "reference_range_high": float(obs.reference_range_high) if obs.reference_range_high else None,
                "interpretation": obs.interpretation,
            }
            for obs in doc.observations
        ],
        "created_at": doc.created_at.isoformat(),
    }


@router.delete("/{doc_id}")
async def delete_document(
    doc_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Soft delete a document."""
    result = await db.execute(
        select(Document).where(
            and_(Document.id == uuid.UUID(doc_id), Document.user_id == user.id)
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    doc.deleted_at = datetime.utcnow()
    await db.flush()

    return {"status": "deleted"}