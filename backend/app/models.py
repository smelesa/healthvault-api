"""SQLAlchemy ORM models — PostgreSQL (FHIR-aligned)."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Index, DECIMAL, Date, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clerk_id = Column(String(255), unique=True, nullable=False, index=True)
    email = Column(String(255), nullable=True)
    sex = Column(String(1), nullable=True)  # M or F
    created_at = Column(DateTime, default=datetime.utcnow)

    documents = relationship("Document", back_populates="user", lazy="selectin")
    chat_sessions = relationship("ChatSession", back_populates="user", lazy="selectin")

    def __repr__(self):
        return f"<User {self.email}>"


class Document(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_type = Column(String(50), nullable=False)  # pdf, image
    document_type = Column(String(100), nullable=False)  # lab_report, prescription, imaging, other
    fhir_resource = Column(JSON, nullable=True)  # Full FHIR DiagnosticReport
    extracted_text = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)  # Soft delete

    user = relationship("User", back_populates="documents")
    observations = relationship("Observation", back_populates="document", lazy="selectin")

    __table_args__ = (
        Index("idx_documents_user_id", "user_id"),
        Index("idx_documents_user_deleted", "user_id", "deleted_at"),
    )

    def __repr__(self):
        return f"<Document {self.id} ({self.document_type})>"


class Observation(Base):
    __tablename__ = "observations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    code = Column(String(50), nullable=False, index=True)  # GLU, HbA1c, CHOL, etc.
    display_name = Column(String(255), nullable=True)
    value_numeric = Column(DECIMAL(10, 2), nullable=True)
    value_string = Column(String(255), nullable=True)
    unit = Column(String(50), nullable=True)
    reference_range_low = Column(DECIMAL(10, 2), nullable=True)
    reference_range_high = Column(DECIMAL(10, 2), nullable=True)
    standard_reference_range_low = Column(DECIMAL(10, 2), nullable=True)
    standard_reference_range_high = Column(DECIMAL(10, 2), nullable=True)
    lab_reference_range_low = Column(DECIMAL(10, 2), nullable=True)
    lab_reference_range_high = Column(DECIMAL(10, 2), nullable=True)
    reference_source = Column(String(100), nullable=True)  # CLSI, ADA, lab_document
    effective_date = Column(Date, nullable=True)
    interpretation = Column(String(50), nullable=True)  # normal, low, high, critical_low, critical_high
    created_at = Column(DateTime, default=datetime.utcnow)

    document = relationship("Document", back_populates="observations")

    __table_args__ = (
        Index("idx_observations_user_id", "user_id"),
        Index("idx_observations_code", "code"),
    )

    def __repr__(self):
        return f"<Observation {self.code}: {self.value_numeric} {self.unit}>"


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    session_id = Column(String(255), nullable=False)  # External session ID for API
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session", lazy="selectin", order_by="ChatMessage.created_at")

    __table_args__ = (
        Index("idx_chat_sessions_user_id", "user_id"),
    )

    def __repr__(self):
        return f"<ChatSession {self.session_id}>"


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("chat_sessions.id"), nullable=False)
    role = Column(String(20), nullable=False)  # user, assistant
    content = Column(Text, nullable=False)
    sources = Column(JSON, nullable=True)  # list of document_ids
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("ChatSession", back_populates="messages")

    def __repr__(self):
        return f"<ChatMessage {self.role}: {self.content[:50]}>"