# HealthVault — Personal Health Record Platform
**Version:** 1.0 | **Date:** 2026-05-11 | **Status:** Draft for review

---

## 1. Executive Summary

**Problem:** Health data is fragmented across multiple providers, hard to understand, and typically inaccessible to patients. Existing solutions (like BodyWision) offer personal health records but lack deep AI-powered analysis validated by medical experts.

**Goal:** Build a privacy-first personal health record (PHR) platform that allows users to store medical documents, receive AI-powered analysis of their health data, and get a conversational health coach — all with medical expert validation before expanding features.

**Target:** B2C consumers who want to own and understand their health data. Privacy/GDPR-conscious users in Europe.

**Success Criteria (measurable):**
- [ ] MVP launched with 10 beta users uploading real lab reports
- [ ] AI analysis accuracy validated by ≥1 medical expert
- [ ] Document upload success rate >95% for standard lab report formats
- [ ] Chatbot response quality rated ≥4/5 by medical advisor
- [ ] Zero data breaches; encryption verified

**Stakeholders:**
- End users (patients)
- Future: medical advisors/experts (for validation)

---

## 2. Data Sources — Deep Dive

### 2.1 User-Uploaded Documents

**Formats supported:**
- PDF (digital lab reports, prescriptions)
- Images (JPG, PNG) — photo of printed lab results
- Scanned documents (via OCR)

**Priority document type:** Lab reports (blood work, biomarker data)
- Most common document users have
- Contains structured numeric data (biomarkers)
- Parsable with regex/heuristic extraction

**Text extraction pipeline:**
```
PDF → pdfminer/pypdf2 (digital) OR PaddleOCR (scanned/image)
↓
Text chunks (per page or per logical section)
↓
FHIR Observations (structured biomarker extraction)
↓
ChromaDB (embedded chunks) + PostgreSQL (structured metadata)
```

**Supported biomarker types (MVP):**
- Glucose, HbA1c, Total Cholesterol, HDL, LDL, Triglycerides
- Creatinine, BUN, eGFR
- ALT, AST, ALP (liver enzymes)
- Hemoglobin, WBC, RBC, Platelets
- TSH, Vitamin D, Iron, Ferritin

### 2.1.1 Biomarker Reference Ranges

**Strategy (hybrid):**
1. **Primary:** Use standard reference ranges from authoritative medical sources (CLSI, NHANES, clinical guidelines)
2. **Secondary:** Extract reference range from document if present (each lab prints their own range)
3. **If diverging:** Add a note in the UI — "Lab range differs from standard: [lab] vs [standard]. Your lab's range takes precedence."

**Authoritative sources for standard ranges:**
- CLSI (Clinical and Laboratory Standards Institute) guidelines
- NHANES (National Health and Nutrition Examination Survey) population data
- ADA (American Diabetes Association) guidelines for glycemic markers
- ESC (European Society of Cardiology) guidelines for lipids
- Manufacturer package inserts for assay-specific ranges

**Standard reference ranges (adult population, general):**

| Biomarker | Low | High | Unit | Source |
|-----------|-----|------|------|--------|
| Fasting Glucose | 70 | 100 | mg/dL | ADA / CLSI |
| HbA1c | 4.0 | 5.6 | % | ADA |
| Total Cholesterol | 0 | 200 | mg/dL | ESC |
| HDL Cholesterol | 40 | 60 | mg/dL | ESC |
| LDL Cholesterol | 0 | 100 | mg/dL | ESC |
| Triglycerides | 0 | 150 | mg/dL | ESC |
| Creatinine (male) | 0.7 | 1.3 | mg/dL | CLSI |
| Creatinine (female) | 0.6 | 1.1 | mg/dL | CLSI |
| BUN | 7 | 20 | mg/dL | CLSI |
| ALT | 0 | 40 | U/L | CLSI |
| AST | 0 | 40 | U/L | CLSI |
| ALP | 30 | 120 | U/L | CLSI |
| Hemoglobin (male) | 13.5 | 17.5 | g/dL | CLSI |
| Hemoglobin (female) | 12.0 | 16.0 | g/dL | CLSI |
| WBC | 4.5 | 11.0 | ×10³/µL | CLSI |
| TSH | 0.4 | 4.0 | mIU/L | AACE |
| Vitamin D (25-OH) | 30 | 100 | ng/mL | Endocrine Society |
| Iron (male) | 65 | 175 | µg/dL | CLSI |
| Iron (female) | 50 | 170 | µg/dL | CLSI |
| Ferritin (male) | 20 | 300 | ng/mL | CLSI |
| Ferritin (female) | 20 | 200 | ng/mL | CLSI |

eGFR calculation uses CKD-EPI formula with age, sex, creatinine.

**Storage:** Reference ranges are stored in `config/reference_ranges.yaml` — not hardcoded. The FastAPI backend loads this file at startup. This keeps ranges versionable, reviewable, and separable from business logic.

**Note on demographic variation:**
- Reference ranges vary by age, sex, and sometimes ethnicity
- MVP stores sex in Patient resource for sex-specific ranges
- Future: age-specific and ethnicity-specific ranges in v2

### 2.2 FHIR Resource Mapping

All document data is stored in FHIR R4 format for interoperability.

**Resources used:**
- `Patient` — maps to Clerk user
- `DiagnosticReport` — each uploaded document
- `Observation` — each biomarker value extracted
- `DocumentReference` — file reference with metadata

**Why FHIR from the start:**
- Enables future integration with hospitals/clinics (HL7 FHIR API)
- Structured queries possible (search by biomarker, date range)
- Standard compliance for medical data

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         UTENTE                                  │
│              Browser / Mobile Web                              │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTPS
┌────────────────────────▼────────────────────────────────────────┐
│                    NEXT.JS FRONTEND                              │
│   (App Router, TypeScript, TailwindCSS)                         │
│   ┌──────────┐  ┌──────────┐  ┌──────────────────────────┐      │
│   │ PHR UI   │  │ Analysis │  │ AI Coach (chat)           │      │
│   │ Upload   │  │ Cards    │  │ Conversazionale           │      │
│   │ Timeline │  │ Summary  │  │                          │      │
│   └──────────┘  └──────────┘  └──────────────────────────┘      │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ Clerk Auth (login/logout, session management)             │   │
│   └─────────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────────┘
                         │ REST API (HTTPS)
┌────────────────────────▼────────────────────────────────────────┐
│                  FASTAPI BACKEND (Python)                       │
│              Container: healthvault-api                         │
│              Host: 187.77.161.49:8090                          │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│   │ /auth        │  │ /documents  │  │ /analyze             │  │
│   │ Clerk JWT    │  │ upload/     │  │ RAG + Groq analysis   │  │
│   │ validation   │  │ list/search │  │                      │  │
│   └──────────────┘  └──────────────┘  └──────────────────────┘  │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│   │ /coach       │  │ /fhir       │  │ /health             │  │
│   │ Chat with    │  │ Resource    │  │ Status check        │  │
│   │ context      │  │ mapping     │  │                     │  │
│   └──────────────┘  └──────────────┘  └──────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │
     ┌───────────────────┼────────────────────┐
     │                   │                    │
┌────▼────┐       ┌──────▼──────┐     ┌──────▼──────┐
│PostgreSQL│       │ File Store  │     │ ChromaDB    │
│ (metadata│       │ /vault/docs│     │ health_docs │
│  FHIR)   │       │ (encrypted│     │             │
└─────────┘       │  at rest)  │     └─────────────┘
     │            └────────────┘            │
     │                                        │
     └────────────────┬─────────────────────┘
                       │
             ┌─────────▼─────────┐
             │   GROQ API        │
             │ llama-3.3-70b-    │
             │ versatile         │
             └───────────────────┘
```

**Key design decisions:**
- Next.js frontend deployed on Vercel (or same VPS if needed)
- FastAPI backend in Docker container on VPS port 8090
- PostgreSQL for structured metadata (FHIR resources)
- Encrypted file storage at `/vault/docs` on VPS
- ChromaDB for vector similarity search (local embeddings)
- Groq for LLM inference (privacy: no data training, HIPAA-aware)
- Clerk for authentication (GDPR-compliant, managed)

---

## 4. Component Approach

### 4.1 Frontend (Next.js + TypeScript)

**Responsibilities:** User interface, authentication, document upload, results display, chat.

**Pages/Routes:**
| Route | Description |
|-------|-------------|
| `/` | Landing page with "Join Early Access" CTA |
| `/login` | Clerk-powered authentication |
| `/dashboard` | Main dashboard — document list + health overview |
| `/documents` | Document timeline with upload button |
| `/documents/[id]` | Single document detail + extracted data |
| `/analyze` | AI analysis results (biomarker summary + deviations) |
| `/coach` | AI Health Coach chat interface |

**Key components:**
- `DocumentUploader` — drag & drop, accepts PDF/JPG/PNG, shows upload progress
- `DocumentTimeline` — vertical timeline of uploaded documents
- `DocumentSearch` — full-text search with filters (date, type, biomarker)
- `AnalysisCard` — displays biomarker value, reference range, deviation flag
- `HealthCoach` — chat UI with medical disclaimer
- `FHIRPreview` — structured view of extracted data

**State management:** React Context + Server Actions (Next.js App Router pattern)

---

### 4.2 Backend — FastAPI (Python)

**Container:** `healthvault-api` on VPS 187.77.161.49

#### 4.2.1 Document Service

**Upload flow:**
1. Validate Clerk JWT from header
2. Virus scan (optional MVP: skip or use ClamAV)
3. Store file encrypted (Fernet/age encryption) at `/vault/docs/{user_id}/{doc_id}.{ext}`
4. If image/scanned → OCR via PaddleOCR
5. Text extraction via pdfminer (PDF) or PaddleOCR (image)
6. Parse biomarkers via regex patterns → list of (code, value, unit, ref_range, date)
7. Map to FHIR DiagnosticReport + Observations
8. Embed text chunks → ChromaDB
9. Insert PostgreSQL rows (Document + Observations)
10. Return document metadata

**Endpoints:**
- `POST /documents/upload` — multipart upload
- `GET /documents` — list with filters (?type=&date_from=&date_to=&search=)
- `GET /documents/{id}` — detail with FHIR resource
- `DELETE /documents/{id}` — soft delete

#### 4.2.2 Analysis Service

**Analysis flow:**
1. Get all documents for user
2. Query ChromaDB for relevant chunks (if specific document: filter by doc_id)
3. Build context: relevant chunks + FHIR Observations summary
4. Call Groq LLM with analysis prompt (structured output)
5. Return JSON: biomarkers, deviations, risk factors, recommendations

**Endpoint:**
- `POST /analyze` — full analysis of all user documents
- `GET /analyze/{doc_id}` — analysis of single document

#### 4.2.3 Coach Service

**Chat flow:**
1. Get chat history for session_id (stored in PostgreSQL, ephemeral)
2. Query ChromaDB for relevant document chunks (user's docs only)
3. Build context: chat history + relevant chunks
4. Call Groq LLM with system prompt "health coach"
5. Apply guardrails: medical disclaimer, no definitive diagnosis
6. Store message in chat history
7. Return response + sources (document IDs)

**Endpoints:**
- `POST /coach/chat` — send message
- `GET /coach/history` — get chat history (?session_id=)

#### 4.2.4 Auth Middleware

- Clerk webhook handler: `POST /auth/webhook` (user.created, user.updated)
- JWT validation on protected routes
- User context injected into request state

---

### 4.3 Database Schema (PostgreSQL)

```sql
-- Users (mirrors Clerk user)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Documents (FHIR DiagnosticReport)
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(50), -- pdf, image
    document_type VARCHAR(100), -- lab_report, prescription, imaging
    fhir_resource JSONB, -- full FHIR DiagnosticReport
    extracted_text TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP, -- soft delete
    CONSTRAINT user_id_idx UNIQUE (id, user_id)
);

-- Observations (FHIR Observations — biomarker values)
CREATE TABLE observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id),
    user_id UUID REFERENCES users(id),
    code VARCHAR(50), -- LOINC-style code e.g. "GLU", "HbA1c"
    display_name VARCHAR(255), -- "Fasting Glucose"
    value_numeric DECIMAL(10,2),
    value_string VARCHAR(255),
    unit VARCHAR(50), -- "mg/dL"
    reference_range_low DECIMAL(10,2),
    reference_range_high DECIMAL(10,2),
    standard_reference_range_low DECIMAL(10,2), -- from authoritative source
    standard_reference_range_high DECIMAL(10,2), -- from authoritative source
    lab_reference_range_low DECIMAL(10,2), -- extracted from document (if present)
    lab_reference_range_high DECIMAL(10,2), -- extracted from document (if present)
    effective_date DATE,
    interpretation VARCHAR(50), -- "normal", "high", "low", "critical"
    reference_source VARCHAR(100), -- "CLSI", "ADA", "NHANES", "lab_document"
    created_at TIMESTAMP DEFAULT NOW()
);

-- Chat sessions
CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    session_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Chat messages
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES chat_sessions(id),
    role VARCHAR(20), -- "user" or "assistant"
    content TEXT,
    sources JSONB, -- list of document_ids used as context
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_user_deleted ON documents(user_id, deleted_at);
CREATE INDEX idx_observations_user_id ON observations(user_id);
CREATE INDEX idx_observations_code ON observations(code);
CREATE INDEX idx_chat_sessions_user_id ON chat_sessions(user_id);
```

### 4.4 Database Inventory & Relationships

We use three data stores: **PostgreSQL** (structured metadata), **ChromaDB** (vector embeddings), and **filesystem** (encrypted file storage).

#### 4.4.1 PostgreSQL — Structured Metadata

| Table | Description | Key Fields |
|-------|-------------|------------|
| `users` | Mirrors Clerk user. Single source of truth for user identity. | `id`, `clerk_id`, `email`, `created_at` |
| `documents` | Each uploaded document (lab report, prescription, imaging). Maps to FHIR DiagnosticReport. | `id`, `user_id`, `file_path`, `file_type`, `document_type`, `fhir_resource`, `extracted_text`, `deleted_at` |
| `observations` | Each extracted biomarker value. Maps to FHIR Observation resource. One row per biomarker per document. | `id`, `document_id`, `user_id`, `code`, `value_numeric`, `unit`, `reference_range_*`, `effective_date`, `interpretation` |
| `chat_sessions` | Chat session container. One session per conversation thread. | `id`, `user_id`, `session_id`, `created_at` |
| `chat_messages` | Individual messages in a session. Stores role, content, sources used. | `id`, `session_id`, `role`, `content`, `sources`, `created_at` |

**Relationships (ER diagram):**

```
┌─────────────┐         ┌─────────────┐         ┌─────────────────┐
│   users     │ 1────N  │  documents   │ 1────N  │  observations   │
│             │─────────│             │─────────│                 │
│ id          │         │ user_id     │         │ document_id     │
│ clerk_id    │         │ id          │         │ id              │
│ email       │         │             │         │ code            │
│ created_at  │         └─────────────┘         │ value_numeric   │
└─────────────┘                │                 └─────────────────┘
                               │                        │
                               │                        │
              ┌────────────────┴──────────┐              │
              │                           │              │
              ▼                           ▼              │
     ┌────────────────┐        ┌────────────────────┐ │
     │  chat_sessions  │ 1────N │  chat_messages       │ │
     │                 │────────│                      │ │
     │ user_id         │        │ session_id          │ │
     │ id              │        │ id                  │ │
     │ session_id      │        │ role                │ │
     └────────────────┘        │ content             │ │
                                │ sources (doc_ids[]) │ │
                                └─────────────────────┘ │
```

**Column details for `observations`:**

| Column | Type | Description |
|--------|------|-------------|
| `code` | VARCHAR(50) | LOINC-style code: GLU, HbA1c, CHOL, HDL, LDL, TG, CREAT, BUN, ALT, AST, ALP, HGB, WBC, RBC, PLT, TSH, VITD, IRON, FERR |
| `display_name` | VARCHAR(255) | Human-readable: "Fasting Glucose", "Hemoglobin A1c" |
| `value_numeric` | DECIMAL(10,2) | Numeric value when available |
| `value_string` | VARCHAR(255) | String value for non-numeric results |
| `unit` | VARCHAR(50) | mg/dL, %, g/dL, U/L, mIU/L, etc. |
| `reference_range_low/high` | DECIMAL(10,2) | Effective range (lab or standard) |
| `standard_reference_range_low/high` | DECIMAL(10,2) | From CLSI/NHANES/ADA/ESC |
| `lab_reference_range_low/high` | DECIMAL(10,2) | Extracted from document (if present) |
| `reference_source` | VARCHAR(100) | "CLSI", "ADA", "lab_document", etc. |
| `interpretation` | VARCHAR(50) | "normal", "low", "high", "critical_low", "critical_high" |
| `effective_date` | DATE | Date the observation applies to (from document or upload date) |

#### 4.4.2 ChromaDB — Vector Embeddings

| Collection | Description | Schema |
|------------|-------------|--------|
| `health_docs` | Document chunks for RAG similarity search. One chunk per logical section of a document. | `id`, `document_id`, `chunk_text`, `metadata` |

**health_docs metadata fields:**
- `patient_id` (UUID) — user who owns this document
- `type` (string) — "lab_report", "prescription", "imaging", "other"
- `date` (ISO string) — document date
- `section` (string) — "biochemistry", "hematology", "endocrinology", etc.
- `biomarkers` (string[]) — list of biomarker codes found in this chunk

**Indexes:** ChromaDB maintains auto-index on embedding for fast ANN (approximate nearest neighbor) search. `patient_id` filter applied at query time.

#### 4.4.3 Config File — Biomarker Reference Ranges (YAML)

| File | Description |
|------|-------------|
| `config/reference_ranges.yaml` | Standard reference ranges per biomarker, loaded at app startup |

**Schema:**
```yaml
GLU:
  display_name: "Fasting Glucose"
  unit: "mg/dL"
  source: "ADA/CLSI"
  ref_male: [70, 100]
  ref_female: [70, 100]
  description: "Fasting blood glucose"

HbA1c:
  display_name: "Hemoglobin A1c"
  unit: "%"
  source: "ADA"
  ref_male: [4.0, 5.6]
  ref_female: [4.0, 5.6]

CHOL:
  display_name: "Total Cholesterol"
  unit: "mg/dL"
  source: "ESC"
  ref_male: [0, 200]
  ref_female: [0, 200]
# ... remaining biomarkers
```

**Behavior:**
- Loaded once at FastAPI startup into a `ReferenceRanges` class (singleton)
- Used by the biomarker parser to fill `standard_reference_range_low/high`
- If a lab document provides its own range, it overrides the standard (stored in `lab_reference_range_*`)
- Future: can add `age_ranges` for pediatric/adult differentiation without schema changes

#### 4.4.4 Filesystem — Encrypted Document Storage

| Path | Description |
|------|-------------|
| `/vault/docs/{user_id}/{document_id}.{ext}` | Encrypted file storage. Fernet AES-128 encryption. Extensions: .pdf, .jpg, .png |
| `/vault/keys/` | Encryption keys (NOT committed to repo, stored in environment or key management service) |

**Note:** Files are never stored in PostgreSQL. Only `file_path` (string) is stored in `documents` table.

#### 4.4.5 Data Isolation

- Every query to PostgreSQL and ChromaDB is scoped by `user_id`
- Clerk JWT contains `user_id` / `clerk_id`; the backend maps `clerk_id` → internal `user_id`
- ChromaDB queries always include `patient_id` filter — no cross-user visibility
- File storage paths are namespaced by `user_id` — no path traversal across users



**ChromaDB Schema:**
```
Collection: health_docs
{
  "id": "chunk_uuid",
  "document_id": "doc_uuid",
  "chunk_text": "Fasting Glucose: 95 mg/dL (reference: 70-100 mg/dL). HbA1c: 5.4%...",
  "metadata": {
    "patient_id": "user_uuid",
    "type": "lab_report",
    "date": "2026-01-15",
    "section": "biochemistry",
    "biomarkers": ["GLU", "HbA1c", "CHOL"]
  }
}
```

**Embedding model:** all-MiniLM-L6-v2 (local, 384 dimensions)
**Chunk size:** ~800 tokens with ~100 token overlap
**Filters:** patient_id, type, date range

---

## 5. Data Flow

### 5.1 Document Ingestion Pipeline

```
User uploads PDF/Image
        │
        ▼
┌────────────────────────┐
│ POST /documents/upload │
│ - JWT validation       │
│ - File size check      │
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ Encrypted File Storage │
│ /vault/docs/{user_id}/ │
│ {doc_id}.{ext}         │
│ (Fernet encryption)    │
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ Text Extraction        │
│ - PDF: pdfminer        │
│ - Image: PaddleOCR     │
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ Biomarker Parsing      │
│ Regex patterns for     │
│ known biomarker codes  │
│ → list of Observations │
└───────────┬────────────┘
            │
     ┌──────┴──────┐
     ▼             ▼
┌─────────┐  ┌───────────┐
│ChromaDB │  │PostgreSQL │
│(chunks) │  │(FHIR data)│
└─────────┘  └───────────┘
```

### 5.2 AI Analysis Pipeline

```
User clicks "Analyze"
        │
        ▼
┌────────────────────────┐
│ GET /documents         │
│ (user's all docs)     │
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ ChromaDB RAG           │
│ similarity search      │
│ across all docs         │
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ Context Building       │
│ - top 5 relevant chunks│
│ - FHIR Observations    │
│   summary table        │
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ Groq LLM               │
│ llama-3.3-70b-versatile│
│ Analysis prompt        │
│ (structured JSON out)  │
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ Structured JSON        │
│ - biomarkers[]         │
│ - deviations[]         │
│ - risk_factors[]       │
│ - recommendations[]   │
│ - confidence           │
└────────────────────────┘
```

### 5.3 AI Coach Chat Pipeline

```
User sends message
        │
        ▼
┌────────────────────────┐
│ POST /coach/chat       │
│ { message, session_id }│
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ Load chat history      │
│ (from chat_messages)   │
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ ChromaDB RAG           │
│ query with message     │
│ filter: same user_id  │
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ Build prompt           │
│ - system: health coach │
│ - context: chunks     │
│ - history: last 5 msgs │
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ Groq LLM               │
│ llama-3.3-70b-versatile│
│ + guardrail disclaimer │
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ Save to chat_history   │
│ Return response        │
│ + sources (doc_ids)    │
└────────────────────────┘
```

---

## 6. Frontend Requirements

### 6.1 Landing Page (`/`)
- Hero: "Own your health. Store, understand, improve."
- CTA: "Join Early Access" → Clerk sign-up
- Privacy messaging: "End-to-end encrypted · GDPR compliant · Your data stays yours"

### 6.2 Dashboard (`/dashboard`)
- Greeting + health overview card
- Recent documents list (last 3)
- Quick actions: Upload document, Ask coach
- Health score summary (if analysis run)

### 6.3 Document Upload (`/documents`)
- Drag & drop zone (accepts .pdf, .jpg, .jpeg, .png, max 20MB)
- Upload progress bar
- Success state with "View document" link
- Document timeline below upload zone (newest first)
- Filters: date range, document type
- Search: full-text search

### 6.4 Document Detail (`/documents/[id]`)
- File preview (if PDF: embedded viewer; if image: img tag)
- Extracted data section:
  - Biomarker table (code, value, unit, reference range, interpretation)
  - Interpretation badge: normal (green), high (yellow), low (yellow), critical (red)
- "Analyze this document" button

### 6.5 Analysis (`/analyze`)
- Biomarker summary cards (grid)
- Each card: biomarker name, latest value, trend (if multiple docs), reference range bar
- Deviation list: biomarkers outside reference range
- Risk factors (from AI analysis)
- AI-generated summary paragraph
- "Ask coach about this" button

### 6.6 AI Coach (`/coach`)
- Chat history display (scrollable)
- Message input at bottom
- Source documents shown as chips below AI responses
- Persistent disclaimer: "I'm not a doctor. This is informational only."
- Session indicator (new session button)

---

## 7. Technology Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Frontend | Next.js 14+ (App Router) + TypeScript | Server Components + Server Actions |
| Styling | TailwindCSS | |
| Auth | Clerk | GDPR-compliant, managed |
| Backend | FastAPI (Python 3.11+) | Container on VPS |
| ORM | SQLAlchemy 2.0 + asyncpg | Async PostgreSQL driver |
| File Storage | VPS filesystem (`/vault/docs`) | Fernet encryption at rest |
| Database | PostgreSQL 15+ | FHIR resource storage |
| Vector DB | ChromaDB | Local embeddings, `health_docs` collection |
| Embedding | all-MiniLM-L6-v2 | Local, via sentence-transformers |
| OCR | PaddleOCR | For scanned/image documents |
| PDF Parsing | pdfminer.six | For text extraction from PDF |
| LLM Inference | Groq API | llama-3.3-70b-versatile |
| Encryption | cryptography (Fernet) | AES-128, key from env |
| Container | Docker | Image on VPS, port 8090 |
| Deployment | systemd (existing pattern) | `healthvault-api.service` |

---

## 8. API Design

**Base URL:** `https://api.healthvault.example.com` (VPS nginx proxy) or `http://localhost:8090` for local dev

### 8.1 Auth

```
POST   /api/auth/webhook
        Clerk webhook for user events
        Body: { type, data: { id, email_addresses, ... } }
        Response: { status: "ok" }

GET    /api/auth/me
        Get current user info
        Headers: Authorization: Bearer <Clerk JWT>
        Response: { id, clerk_id, email, created_at }
```

### 8.2 Documents

```
POST   /api/documents/upload
        Upload a document
        Headers: Authorization: Bearer <Clerk JWT>
        Content-Type: multipart/form-data
        Body: file (binary), document_type (string, optional)
        Response: {
          id, file_path, file_type, document_type,
          fhir_resource: { resourceType: "DiagnosticReport", ... },
          observations: [{ code, value, unit, reference_range, ... }],
          created_at
        }

GET    /api/documents
        List user's documents
        Headers: Authorization: Bearer <Clerk JWT>
        Query: ?type=&date_from=&date_to=&search=&page=&limit=
        Response: {
          items: [{ id, document_type, created_at, summary }, ...],
          total, page, limit
        }

GET    /api/documents/{id}
        Get document detail
        Headers: Authorization: Bearer <Clerk JWT>
        Response: {
          id, file_path, file_type, document_type,
          fhir_resource: { resourceType: "DiagnosticReport", ... },
          extracted_text,
          observations: [{ code, value, unit, ... }],
          created_at
        }

DELETE /api/documents/{id}
        Soft delete document
        Headers: Authorization: Bearer <Clerk JWT>
        Response: { status: "deleted" }
```

### 8.3 Analysis

```
POST   /api/analyze
        Analyze all user documents
        Headers: Authorization: Bearer <Clerk JWT>
        Body: { document_ids?: [string] } // optional filter
        Response: {
          biomarkers: [{
            code, display_name, latest_value, unit,
            trend: "up"|"down"|"stable",
            interpretation, reference_range,
            doc_count
          }, ...],
          deviations: [{
            code, value, reference_range, severity
          }, ...],
          risk_factors: [string, ...],
          recommendations: [string, ...],
          summary: string,
          confidence: 0.0-1.0
        }

GET    /api/biomarkers
        List all extracted biomarkers for user
        Headers: Authorization: Bearer <Clerk JWT>
        Query: ?code=&date_from=&date_to=
        Response: {
          items: [{ code, display_name, values: [...], ... }]
        }
```

### 8.4 Coach

```
POST   /api/coach/chat
        Send message to AI coach
        Headers: Authorization: Bearer <Clerk JWT>
        Body: { message: string, session_id: string }
        Response: {
          reply: string,
          sources: [doc_id, ...],
          disclaimer: "This is not a medical diagnosis..."
        }

GET    /api/coach/history
        Get chat history
        Headers: Authorization: Bearer <Clerk JWT>
        Query: ?session_id=
        Response: {
          session_id,
          messages: [{ role, content, sources, created_at }, ...]
        }

POST   /api/coach/session
        Create new chat session
        Headers: Authorization: Bearer <Clerk JWT>
        Response: { session_id }
```

### 8.5 FHIR (Utility)

```
GET    /api/fhir/Patient
        FHIR Patient resource for current user
        Headers: Authorization: Bearer <Clerk JWT>
        Response: FHIR Patient resource JSON

GET    /api/fhir/Observations
        FHIR Observations bundle for current user
        Headers: Authorization: Bearer <Clerk JWT>
        Query: ?code=&date_from=&date_to=
        Response: FHIR Bundle of Observation resources
```

### 8.6 Health

```
GET    /api/health
        Health check
        Response: { status: "ok", timestamp, version }
```

---

## 9. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| OCR quality poor on low-quality photos | Medium | Show preview after upload; allow manual correction |
| Biomarker parsing misses uncommon formats | Medium | Start with top 20 most common lab formats; user feedback loop |
| LLM hallucination on medical data | Medium | Guardrail prompts, mandatory disclaimer, expert validation phase |
| GDPR compliance gap | Low | Clerk handles auth; data stays on VPS; encrypt everything |
| ChromaDB embedding degradation over time | Low | Periodic re-embedding on doc update |
| File upload fails for large PDFs | Low | 20MB limit, async processing with status endpoint |
| Container crash on VPS | Low | systemd Restart=always, health check endpoint |
| Users upload non-lab documents (confuses analysis) | Medium | Document type classification; clarify scope in UI |
| Reference range mismatch between labs and standards | High | Always show which range is being used; favor lab's own range |

---

## 10. Acceptance Criteria

- [ ] User can sign up/login via Clerk
- [ ] User can upload PDF and image files (lab reports)
- [ ] System extracts text from PDF and images (OCR for scanned documents)
- [ ] System parses biomarker values from lab reports into structured FHIR Observations
- [ ] System extracts or uses standard reference ranges for all supported biomarkers
- [ ] If lab document has different range than standard, UI shows both with note
- [ ] Document metadata stored in PostgreSQL with FHIR-compatible schema
- [ ] Documents displayed in timeline with date/type filters
- [ ] Full-text search works across all user documents
- [ ] AI Analysis produces biomarker summary with value, reference range, deviation
- [ ] AI Analysis shows deviations from normal range highlighted
- [ ] AI Coach responds with context from user's own documents
- [ ] AI Coach shows source documents as citations
- [ ] Medical disclaimer shown on all AI responses
- [ ] All files encrypted at rest (Fernet)
- [ ] User data is isolated — users only see their own documents
- [ ] Deploy to container on VPS 187.77.161.49 port 8090
- [ ] Web app responsive on mobile browsers
- [ ] Application loads under 3 seconds on standard connection

---


## 12. Future Considerations — Potential Integrations & Enhancements

This section captures ideas and opportunities to evaluate after MVP launch and expert validation. Items here are **not** part of the MVP scope.

### 12.1 Additional Reference Range Sources

Potential sources for extending or validating biomarker reference ranges:

| Source | URL | Notes |
|--------|-----|-------|
| Medscape Laboratory Medicine | https://reference.medscape.com/guide/laboratory_medicine | Authoritative, frequently updated. Paywall blocks automated access — use for manual validation before extending biomarker list. |
| IAPAC Normal Laboratory Values | https://www.iapac.org/fact-sheet/normal-laboratory-values/ | Open access, structured data, sex-specific ranges. Good candidate for automated data ingestion if license permits. |
| LabCorp Test Directory | https://www.labcorp.com/tests | Contains assay-specific reference ranges from major US laboratory |
| Mayo Clinic Laboratories | https://www.mayocliniclabs.com/ | Comprehensive test catalog with clinical interpretation |
| Quest Diagnostics | https://www.questdiagnostics.com/ | Another major US lab with publicly available reference ranges |

**Action:** Before extending biomarker coverage, evaluate one or more of the above for data quality, licensing, and update frequency.

### 12.2 Extended Biomarker Coverage

Beyond MVP biomarkers, potential additions after expert validation:

- **Cardiac markers:** Troponin I/T, BNP/NT-proBNP, CK-MB, LDH
- **Tumor markers:** PSA, CA-125, CEA, CA 19-9, AFP
- **Thyroid (extended):** Free T3, Free T4, TPO antibodies
- **Inflammatory:** CRP, ESR, ferritin (already in MVP), procalcitonin
- **Metabolic (extended):** Insulin, C-peptide, HOMA-IR, uric acid
- **Nutritional:** B12, folate, homocysteine, MMA

### 12.3 FHIR Integration — External Systems

Once the MVP is validated, evaluate integration with real healthcare systems:

- **HL7 FHIR API** connections to hospitals/clinics for pulling records directly (avoiding manual upload)
- **Apple Health Records** — iOS Health app integration for users who want to sync
- **Google Health Connect** — Android equivalent
- **EHR connectors** — Epic, Cerner, eCW (enterprise, Phase 3+)

### 12.4 AI Enhancements

- **Medical literature RAG** — add PubMed/chinical guidelines as a separate ChromaDB collection for richer AI context
- **Multi-language support** — parse documents in languages other than English/Italian
- **Document type auto-detection** — ML classifier to identify document type automatically instead of user selecting
- **Trend analysis** — longitudinal tracking of biomarkers over time with alerts for significant changes

### 12.5 Expert Validation Pipeline

- Structured process for medical advisor to review AI analysis accuracy
- Feedback loop from expert reviews into prompt/prompt engineering
- Consider structured output validation (LLM returns structured JSON, medical advisor confirms correctness)


## 11. Next Steps

1. **Project setup** — Create Next.js app repo + FastAPI repo; setup Docker container on VPS
2. **Infrastructure** — PostgreSQL + ChromaDB setup on VPS; Clerk app configuration
3. **Auth** — Clerk JWT validation middleware in FastAPI; webhook handler
4. **PHR core (v1)** — Upload endpoint + encrypted file storage + PostgreSQL metadata
5. **Document timeline** — List/search/delete; timeline UI with filters
6. **OCR + Parsing** — Text extraction (pdfminer/PaddleOCR) + biomarker regex parsing
7. **Reference ranges** — Implement standard ranges (CLSI/NHANES) + lab doc extraction
8. **FHIR mapping** — Structured data: DiagnosticReport + Observations
9. **RAG pipeline** — ChromaDB collection + embedding (all-MiniLM-L6-v2) + chunking
10. **AI Analysis endpoint** — RAG + Groq analysis → structured JSON response
11. **Analysis UI** — Biomarker cards, deviation display, summary panel
12. **AI Coach endpoint** — Chat with context + guardrails + disclaimer
13. **Coach UI** — Chat interface with source citations
14. **Dashboard** — Overview, recent docs, quick actions
15. **Mobile polish** — Responsive layout, touch-friendly uploads
16. **Expert validation** — Medical advisor reviews AI analysis accuracy (Phase 2 gate)
17. **Beta launch** — 10 real users with real lab reports
18. **Iterate based on feedback**

---

## Appendix A: Biomarker Regex Patterns (MVP)

```python
BIOMARKER_PATTERNS = {
    "GLU": {
        "name": "Fasting Glucose",
        "patterns": [
            r"Glucose[:\s]+(\d+\.?\d*)\s*(mg/dL)?",
            r"Glucose, Fasting[:\s]+(\d+\.?\d*)\s*(mg/dL)?",
            r"FBG[:\s]+(\d+\.?\d*)\s*(mg/dL)?",
        ],
        "unit": "mg/dL",
        "ref_male": (70, 100),
        "ref_female": (70, 100),
        "source": "ADA/CLSI",
    },
    "HbA1c": {
        "name": "Hemoglobin A1c",
        "patterns": [
            r"HbA1c[:\s]+(\d+\.?\d*)\s*(%)?",
            r"Hemoglobin A1c[:\s]+(\d+\.?\d*)\s*(%)?",
            r"A1c[:\s]+(\d+\.?\d*)\s*(%)?",
        ],
        "unit": "%",
        "ref_male": (4.0, 5.6),
        "ref_female": (4.0, 5.6),
        "source": "ADA",
    },
    "CHOL": {
        "name": "Total Cholesterol",
        "patterns": [
            r"Cholesterol, Total[:\s]+(\d+\.?\d*)\s*(mg/dL)?",
            r"Total Chol[:\s]+(\d+\.?\d*)\s*(mg/dL)?",
        ],
        "unit": "mg/dL",
        "ref_male": (0, 200),
        "ref_female": (0, 200),
        "source": "ESC",
    },
    # ... additional patterns for HDL, LDL, TG, CREAT, BUN, ALT, AST, HGB, WBC, TSH, VITD, IRON, FERR
}

def parse_lab_reference_range(text: str) -> tuple[float, float] | None:
    """Extract [low-high] or (low-high) from OCR text, e.g. '[70-100]'"""
    patterns = [
        r'\[(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)\]',  # [70-100]
        r'\((\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)\)',  # (70-100)
        r'(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)\s*(mg/dL|%)',  # 70-100 mg/dL
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return (float(match.group(1)), float(match.group(2)))
    return None

def get_interpretation(value: float, low: float, high: float) -> str:
    if value < low * 0.8:
        return "critical_low"
    elif value < low:
        return "low"
    elif value > high * 1.3:
        return "critical_high"
    elif value > high:
        return "high"
    return "normal"
```

## Appendix B: System Prompt for AI Coach

```
You are HealthVault Coach, a helpful, empathetic health assistant.

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

Context from user's health documents:
{context_chunks}

Reference ranges being used:
{reference_ranges}

Conversation history:
{chat_history}

Current question: {user_message}

Disclaimer: This is not a medical diagnosis. Consult your physician.
```

---

*Document status: Draft — pending review and approval before implementation*