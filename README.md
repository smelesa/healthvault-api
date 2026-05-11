# HealthVault — Personal Health Record Platform

**Spec:** See `docs/SPEC.md`

## Project Structure

```
healthvault/
├── backend/              # FastAPI Python backend
│   ├── app/
│   │   ├── main.py          # FastAPI entry point
│   │   ├── config.py         # Settings / environment
│   │   ├── database.py       # PostgreSQL connection
│   │   ├── models.py         # SQLAlchemy models
│   │   ├── schemas.py        # Pydantic schemas
│   │   ├── routers/          # API route modules
│   │   │   ├── auth.py
│   │   │   ├── documents.py
│   │   │   ├── analyze.py
│   │   │   ├── coach.py
│   │   │   └── fhir.py
│   │   ├── services/         # Business logic
│   │   │   ├── document_service.py
│   │   │   ├── analysis_service.py
│   │   │   ├── coach_service.py
│   │   │   └── biomarker_parser.py
│   │   └── utils/
│   │       ├── chromadb.py   # ChromaDB client
│   │       ├── encryption.py # Fernet file encryption
│   │       ├── reference_ranges.py  # ReferenceRanges singleton
│   │       └── groq_client.py # Groq API client
│   ├── config/
│   │   └── reference_ranges.yaml   # Biomarker reference ranges
│   ├── tests/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── docker-compose.yml
├── frontend/             # Next.js + TypeScript frontend
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── public/
└── docs/
    └── SPEC.md           # Full specification
```

## Setup

### Backend (Local Dev)

```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt

# Copy env file
cp .env.example .env
# Edit .env with your values

# Run
uvicorn app.main:app --reload --port 8090
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## VPS Deployment

- **Container:** `healthvault-api` on port 8090
- **See SPEC.md section 11 Next Steps for deployment details**

## Environment Variables

```
# Backend
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/healthvault
CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
GROQ_API_KEY=gsk_xxx
ENCRYPTION_KEY=<32-byte-base64-encoded-key>
VAULT_PATH=/vault/docs

# Frontend
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
```

## API Docs

Once running: `http://localhost:8090/docs` (Swagger UI)