from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import urlsplit

from dotenv import load_dotenv


SERVICE_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = SERVICE_ROOT.parent

# The Node backend already owns the real configuration. Reuse it so the
# microservice reads the same MongoDB database and never needs a duplicated
# credential file. A service-local .env still wins when one is present.
for candidate in (SERVICE_ROOT / ".env", REPO_ROOT / "backend" / ".env"):
    if candidate.exists():
        load_dotenv(candidate, override=False)


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _mongo_host(uri: str) -> str:
    """Return only the hostname, never a credential, for diagnostics."""
    try:
        parsed = urlsplit(uri.replace("mongodb+srv://", "https://", 1).replace("mongodb://", "http://", 1))
        host = parsed.hostname or "unknown"
        # A multi-host URI can put a comma in the netloc; urlsplit still gives
        # us the first hostname, which is enough for a status label.
        return host
    except ValueError:
        return "unknown"


class Settings:
    def __init__(self) -> None:
        self.mongo_uri = os.getenv("MONGO_URI", "").strip()
        if not self.mongo_uri:
            raise RuntimeError(
                "MONGO_URI is required. Put the real MongoDB connection string in "
                "python-service/.env or backend/.env; do not rely on a localhost default."
            )
        if not self.mongo_uri.startswith(("mongodb://", "mongodb+srv://")):
            raise RuntimeError("MONGO_URI must be a mongodb:// or mongodb+srv:// connection string.")

        self.db_name = os.getenv("MONGODB_DB_NAME", "metabolic_city").strip()
        if not self.db_name:
            raise RuntimeError("MONGODB_DB_NAME is required.")

        self.environment = (
            os.getenv("INTELLIGENCE_ENV") or os.getenv("NODE_ENV") or "development"
        ).strip().lower()
        self.is_production = self.environment == "production"
        self.mongo_host = _mongo_host(self.mongo_uri)
        self.mongo_is_local = self.mongo_host in {"127.0.0.1", "localhost", "::1"}

        if self.is_production and self.mongo_is_local:
            raise RuntimeError(
                "MONGO_URI points at localhost while INTELLIGENCE_ENV/NODE_ENV is production. "
                "Set the real MongoDB connection string in the environment."
            )

        self.host = os.getenv("INTELLIGENCE_HOST", "127.0.0.1")
        self.port = int(os.getenv("INTELLIGENCE_PORT", "8001"))
        self.service_name = "metabolic-city-intelligence"
        self.version = "1.2.0"
        self.openai_api_key = os.getenv("OPENAI_API_KEY", "").strip()
        self.openai_base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
        self.openai_model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        self.embedding_model = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
        self.embedding_provider = os.getenv("INTELLIGENCE_EMBEDDING_PROVIDER", "local").strip().lower()
        self.brief_provider = os.getenv("INTELLIGENCE_BRIEF_PROVIDER", "cloudflare").strip().lower()
        self.cloudflare_account_id = os.getenv("CLOUDFLARE_ACCOUNT_ID", "").strip()
        self.cloudflare_api_token = (
            os.getenv("CLOUDFLARE_API_TOKEN") or os.getenv("CLOUDFLARE_AUTH_TOKEN") or ""
        ).strip()
        self.cloudflare_ai_base_url = os.getenv(
            "CLOUDFLARE_AI_BASE_URL", "https://api.cloudflare.com/client/v4"
        ).rstrip("/")
        self.cloudflare_embedding_model = os.getenv(
            "CLOUDFLARE_EMBEDDING_MODEL", "@cf/baai/bge-small-en-v1.5"
        ).strip()
        self.cloudflare_chat_model = os.getenv(
            "CLOUDFLARE_CHAT_MODEL", "@cf/meta/llama-3.3-70b-instruct-fp8-fast"
        ).strip()
        self.escalation_minutes = int(os.getenv("ESCALATION_TIMEOUT_MINUTES", "15"))
        self.mongodb_timeout_ms = int(os.getenv("INTELLIGENCE_MONGO_TIMEOUT_MS", "8000"))

        # Realtime sync keeps cell memory and incident retrieval documents
        # current without making every browser request wait for a full rebuild.
        self.realtime_enabled = _env_bool("INTELLIGENCE_REALTIME_ENABLED", True)
        self.realtime_poll_seconds = max(2, int(os.getenv("INTELLIGENCE_REALTIME_POLL_SECONDS", "5")))
        self.realtime_reconcile_seconds = max(
            60, int(os.getenv("INTELLIGENCE_REALTIME_RECONCILE_SECONDS", "300"))
        )
        self.knowledge_rebuild_on_start = _env_bool("INTELLIGENCE_KNOWLEDGE_REBUILD_ON_START", True)

    @property
    def mongo_mode(self) -> str:
        if self.mongo_is_local:
            return "local"
        if "mongodb+srv://" in self.mongo_uri or "mongodb.net" in self.mongo_host:
            return "atlas"
        return "remote"

    @property
    def cloudflare_ready(self) -> bool:
        return bool(self.cloudflare_account_id and self.cloudflare_api_token)

    @property
    def embedding_provider_name(self) -> str:
        if self.embedding_provider == "cloudflare" and self.cloudflare_ready:
            return "cloudflare-workers-ai"
        if self.embedding_provider == "openai" and self.openai_api_key:
            return "openai"
        return "local-hashed"

    @property
    def brief_provider_name(self) -> str:
        if self.brief_provider in {"auto", "cloudflare"} and self.cloudflare_ready:
            return "cloudflare-workers-ai"
        if self.brief_provider == "openai" and self.openai_api_key:
            return "openai"
        return "deterministic-template"


settings = Settings()
