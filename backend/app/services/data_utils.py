from __future__ import annotations

from datetime import datetime
from typing import Any, Iterable, Optional


def parse_timestamp(value: Any) -> Optional[datetime]:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value
    text = str(value).strip()
    if not text:
        return None
    text = text.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return None


def latest_timestamp(records: Iterable[dict]) -> Optional[str]:
    best = None
    for record in records:
        dt = parse_timestamp(record.get("timestamp"))
        if dt is not None and (best is None or dt > best):
            best = dt
    return best.isoformat().replace("+00:00", "Z") if best else None


def downsample(records: list[dict], max_points: int) -> list[dict]:
    if max_points <= 0 or len(records) <= max_points:
        return records
    step = max(1, len(records) // max_points)
    sampled = records[::step]
    return sampled[:max_points]
