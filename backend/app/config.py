"""Application settings — loaded from environment variables."""
import json
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    DEBUG: bool = False
    APP_NAME: str = "HealthVault"
    VERSION: str = "0.1.0"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://hvuser:hvpass@localhost:5432/healthvault"

    # Clerk
    CLERK_PUBLISHABLE_KEY: str = ""
    CLERK_SECRET_KEY: str = ""
    CLERK_WEBHOOK_SECRET: str = ""
    CLERK_INSTANCE: str = "equipped-stallion-81"  # Clerk instance slug (from dashboard URL)

    # Groq
    GROQ_API_KEY: str = ""

    # Encryption (Fernet key — must be 32 bytes, base64-encoded)
    ENCRYPTION_KEY: str = ""

    # File storage
    VAULT_PATH: str = "/vault/docs"

    # ChromaDB
    CHROMA_HOST: str = "localhost"
    CHROMA_PORT: int = 8000

    # CORS — stored as JSON string in .env, parsed at runtime
    CORS_ORIGINS: str = '["http://localhost:3000"]'

    # Reference ranges config
    REFERENCE_RANGES_PATH: str = "config/reference_ranges.yaml"

    # Biomarker parser
    MAX_UPLOAD_SIZE_MB: int = 20

    @property
    def cors_list(self) -> list[str]:
        """Parse CORS_ORIGINS from JSON string."""
        try:
            return json.loads(self.CORS_ORIGINS)
        except Exception:
            return ["http://localhost:3000"]


@lru_cache
def get_settings() -> Settings:
    return Settings()


# Module-level singleton — import as `from app.config import settings`
settings = get_settings()
