"""HealthVault API — Entry Point"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, documents, analyze, coach, fhir, conditions, admin
from app.config import settings
from app.database import engine, Base

app = FastAPI(
    title="HealthVault API",
    description="Personal Health Record Platform — PHR + AI Analysis + AI Coach",
    version="0.1.0",
    docs_url="/docs" if settings.DEBUG else None,  # Hide docs in production
    redoc_url="/redoc" if settings.DEBUG else None,
)

# CORS — allow Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(conditions.router, prefix="/api/conditions", tags=["conditions"])
app.include_router(documents.router, prefix="/api/documents", tags=["documents"])
app.include_router(analyze.router, prefix="/api/analyze", tags=["analyze"])
app.include_router(coach.router, prefix="/api/coach", tags=["coach"])
app.include_router(fhir.router, prefix="/api/fhir", tags=["fhir"])
app.include_router(admin.router, prefix="/api/admin/conditions", tags=["admin"])


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}


@app.get("/")
async def root():
    return {"message": "HealthVault API", "version": "0.1.0", "docs": "/docs"}