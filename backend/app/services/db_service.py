from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

_client = None
_db = None
_initialized = False


def _get_db():
    global _client, _db, _initialized
    if _initialized:
        return _db
    _initialized = True
    uri = os.getenv("MONGODB_URI")
    database_name = os.getenv("MONGODB_DB", "sagar_drishti")
    if not uri:
        return None
    try:
        from pymongo import MongoClient
        _client = MongoClient(uri, serverSelectionTimeoutMS=1500)
        _client.admin.command("ping")
        _db = _client[database_name]
        return _db
    except Exception:
        _client = None
        _db = None
        return None


def status() -> Dict[str, Any]:
    db = _get_db()
    return {
        "enabled": bool(os.getenv("MONGODB_URI")),
        "connected": db is not None,
        "database": os.getenv("MONGODB_DB", "sagar_drishti") if db else None,
    }


def save_result(collection: str, document: Dict[str, Any]) -> Optional[str]:
    db = _get_db()
    if db is None:
        return None
    payload = dict(document)
    payload.setdefault("created_at", datetime.now(timezone.utc))
    try:
        result = db[collection].insert_one(payload)
        return str(result.inserted_id)
    except Exception:
        return None
