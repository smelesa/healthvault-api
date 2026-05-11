"""Coach router — AI health coach chat."""
import uuid
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import User, ChatSession, ChatMessage
from app.routers.auth import get_current_user
from app.config import get_settings

router = APIRouter()
settings = get_settings()

COACH_SYSTEM_PROMPT = """You are HealthVault Coach, a helpful, empathetic health assistant.

Your role:
- Help users understand their personal health documents
- Explain biomarker values in plain language using the reference ranges provided
- Provide general wellness guidance based on the user's data
- Never provide definitive medical diagnoses
- Always recommend consulting a physician for health decisions

Guardrails:
- If asked about diagnosis, respond: "I cannot provide medical diagnoses. Please consult your healthcare provider."
- If data is insufficient, say: "I don't have enough information from your documents to answer that. Can you upload relevant lab results?"
- Cite specific documents when providing information: "According to your [document date] lab report..."
- Always note which reference range you are using (standard vs lab-specific)

Disclaimer: This is not a medical diagnosis. Consult your physician.
"""

DISCLAIMER = "This is not a medical diagnosis. Consult your physician for health decisions."


@router.post("/chat")
async def chat(
    message: str,
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Send a message to the AI coach."""
    # Get or create session
    result = await db.execute(
        select(ChatSession).where(
            and_(ChatSession.user_id == user.id, ChatSession.session_id == session_id)
        )
    )
    session = result.scalar_one_or_none()

    if not session:
        session = ChatSession(id=uuid.uuid4(), user_id=user.id, session_id=session_id)
        db.add(session)
        await db.flush()

    # Load chat history
    history_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.created_at)
        .limit(10)  # Last 5 exchanges (10 messages)
    )
    history = history_result.scalars().all()

    # Build messages for LLM
    messages = [{"role": "system", "content": COACH_SYSTEM_PROMPT}]

    # Add history
    for msg in history:
        messages.append({"role": msg.role, "content": msg.content})

    # Add current message
    messages.append({"role": "user", "content": message})

    # Get user's document context for RAG
    from app.routers.documents import list_documents
    docs_result = await list_documents(
        type="lab_report", page=1, limit=5, db=db, user=user
    )

    context_docs = ""
    if docs_result.get("items"):
        doc_ids = [item["id"] for item in docs_result["items"]]
        # Get full text from these documents
        from app.models import Document
        doc_result = await db.execute(
            select(Document).where(Document.id.in_([uuid.UUID(d) for d in doc_ids]))
        )
        docs = doc_result.scalars().all()
        context_docs = "\n\n".join(
            f"[Document {doc.id}]: {doc.extracted_text[:500] if doc.extracted_text else 'No text'}"
            for doc in docs
        )

    # Inject context into system prompt
    if context_docs:
        messages[0]["content"] = COACH_SYSTEM_PROMPT + f"\n\nRelevant documents from user's health records:\n{context_docs[:2000]}"

    # Call Groq
    try:
        from groq import Groq
        client = Groq(api_key=settings.GROQ_API_KEY)
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            temperature=0.3,
            max_tokens=1024,
        )
        reply = response.choices[0].message.content

        # Save messages
        user_msg = ChatMessage(
            id=uuid.uuid4(), session_id=session.id, role="user", content=message
        )
        assistant_msg = ChatMessage(
            id=uuid.uuid4(), session_id=session.id, role="assistant", content=reply,
            sources=json.dumps(doc_ids if docs_result.get("items") else [])
        )
        db.add(user_msg)
        db.add(assistant_msg)
        await db.flush()

        return {
            "reply": reply,
            "sources": doc_ids if docs_result.get("items") else [],
            "disclaimer": DISCLAIMER,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Groq error: {e}")


@router.get("/history")
async def get_history(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get chat history for a session."""
    result = await db.execute(
        select(ChatSession).where(
            and_(ChatSession.user_id == user.id, ChatSession.session_id == session_id)
        )
    )
    session = result.scalar_one_or_none()

    if not session:
        return {"session_id": session_id, "messages": []}

    msg_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.created_at)
    )
    messages = msg_result.scalars().all()

    return {
        "session_id": session_id,
        "messages": [
            {
                "role": msg.role,
                "content": msg.content,
                "sources": json.loads(msg.sources) if msg.sources else [],
                "created_at": msg.created_at.isoformat(),
            }
            for msg in messages
        ],
    }


@router.post("/session")
async def create_session(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a new chat session."""
    new_session_id = str(uuid.uuid4())
    session = ChatSession(id=uuid.uuid4(), user_id=user.id, session_id=new_session_id)
    db.add(session)
    await db.flush()
    return {"session_id": new_session_id}