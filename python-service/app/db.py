from __future__ import annotations

from datetime import date, datetime
from typing import Any

from bson import ObjectId
from pymongo import MongoClient
from pymongo.database import Database

from .config import settings


_client: MongoClient | None = None


def client() -> MongoClient:
    global _client
    if _client is None:
        _client = MongoClient(
            settings.mongo_uri,
            serverSelectionTimeoutMS=settings.mongodb_timeout_ms,
            connectTimeoutMS=settings.mongodb_timeout_ms,
            socketTimeoutMS=settings.mongodb_timeout_ms,
            maxPoolSize=20,
            minPoolSize=2,
            retryWrites=True,
            retryReads=True,
            appname="metabolic-city-intelligence",
            tz_aware=False,
        )
    return _client


def db() -> Database:
    return client()[settings.db_name]


def ping() -> bool:
    try:
        client().admin.command("ping")
        return True
    except Exception:
        return False


def server_role() -> str:
    """Return the deployment shape without exposing the connection string."""
    try:
        hello = client().admin.command("hello")
        if hello.get("msg") == "isdbgrid":
            return "sharded-cluster"
        if hello.get("setName"):
            return "replica-set"
        return "standalone"
    except Exception:
        return "unavailable"


def json_safe(value: Any) -> Any:
    """Convert BSON values to the small JSON surface the browser needs."""
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(key): json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_safe(item) for item in value]
    return value
