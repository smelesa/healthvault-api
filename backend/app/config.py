"""Application settings — loaded from environment variables."""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    DEBUG: bool = True
    APP_NAME: str = "HealthVault"
    VERSION: str = "0.1.0"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://hvuser:hvpass@localhost:5432/healthvault"

    # Clerk
    CLERK_PUBLISHABLE_KEY: str = ""
    CLERK_SECRET_KEY: str = ""
    CLERK_WEBHOOK_SECRET: str = ""

    # Groq
    GROQ_API_KEY: str = ""

    # Encryption (Fernet key — must be 32 bytes, base64-encoded)
    ENCRYPTION_KEY: str = ""  # Generate with: Fernet.generate_key()

    # File storage
    VAULT_PATH: str = "/vault/docs"

    # ChromaDB
    CHROMA_HOST: str = "localhost"
    CHROMA_PORT: int = 8000

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:8080"]

    # Reference ranges config
    REFERENCE_RANGES_PATH: str = "config/reference_ranges.yaml"

    # Biomarker parser
    MAX_UPLOAD_SIZE_MB: int = 20

    def validate(self) -> None:
        """Validate required settings at startup."""
        errors = []
        if not self.CLERK_SECRET_KEY:
            errors.append("CLERK_SECRET_KEY is required")
        if not self.GROQ_API_KEY:
            errors.append("GROQ_API_KEY is required")
        if not self.ENCRYPTION_KEY:
            errors.append("ENCRYPTION_KEY is required (generate with Fernet.generate_key())")
        if errors:
            raise ValueError("Missing required settings:\n" + "\n".join(errors))


@lru_cache
def get_settings() -> Settings:
    return Settings()