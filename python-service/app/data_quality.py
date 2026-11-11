from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from .db import db


def _as_utc(value: Any) -> datetime | None:
    if not isinstance(value, datetime):
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _iso(value: Any) -> str | None:
    parsed = _as_utc(value)
    return parsed.isoformat() if parsed else None


def _age_seconds(value: Any, now: datetime) -> int | None:
    parsed = _as_utc(value)
    if not parsed:
        return None
    return max(0, int((now - parsed).total_seconds()))


def _freshness(age: int | None) -> str:
    if age is None:
        return "no-data"
    if age <= 20 * 60:
        return "fresh"
    if age <= 60 * 60:
        return "aging"
    return "stale"


def _with(match: dict[str, Any] | None, extra: dict[str, Any]) -> dict[str, Any]:
    return {"$and": [match, extra]} if match else extra


def telemetry_quality(
    h3_index: str | None = None,
    city_code: str | None = None,
) -> dict[str, Any]:
    """Return live telemetry provenance, quality flags and freshness.

    Every value is aggregated from the current ``telemetryevents`` collection.
    The optional cell/city scope is used by the cell intelligence response so
    the weather provenance sits next to the score it produced.
    """
    now = datetime.now(timezone.utc)
    match: dict[str, Any] = {}
    if h3_index:
        match["h3Index"] = h3_index
    if city_code:
        match["cityCode"] = city_code

    scoped = match or None
    collection = db().telemetryevents

    total = collection.count_documents(match)
    source_counts = [
        {"sourceType": row["_id"] or "unknown", "count": row["count"]}
        for row in collection.aggregate(
            [
                *([{"$match": match}] if match else []),
                {"$group": {"_id": "$sourceType", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}},
            ]
        )
    ]

    synthetic = collection.count_documents(_with(scoped, {"rawPayload.synthetic": True}))
    simulated = collection.count_documents(_with(scoped, {"rawPayload.simulated": True}))

    latest_event = collection.find_one(match, sort=[("observedAt", -1)])
    first_event = collection.find_one(match, sort=[("observedAt", 1)])
    last_observed_at = latest_event.get("observedAt") if latest_event else None
    first_observed_at = first_event.get("observedAt") if first_event else None
    observation_age = _age_seconds(last_observed_at, now)

    weather_match = _with(scoped, {"sourceType": "WEATHER_API"})
    weather_total = collection.count_documents(weather_match)
    weather_interpolated = collection.count_documents(
        _with(weather_match, {"rawPayload.interpolation": {"$exists": True}})
    )
    weather_exact = collection.count_documents(
        _with(weather_match, {"rawPayload.interpolation.exact": True})
    )
    nearest_rows = list(
        collection.aggregate(
            [
                {"$match": _with(weather_match, {"rawPayload.interpolation.nearestDistanceKm": {"$type": "number"}})},
                {"$group": {"_id": None, "average": {"$avg": "$rawPayload.interpolation.nearestDistanceKm"}}},
            ]
        )
    )
    average_nearest = nearest_rows[0]["average"] if nearest_rows else None

    latest_weather = collection.find_one(weather_match, sort=[("observedAt", -1)])
    weather_payload = (latest_weather or {}).get("rawPayload") or {}
    interpolation = weather_payload.get("interpolation")
    latest_weather_payload = None
    if latest_weather:
        latest_weather_payload = {
            "observedAt": _iso(latest_weather.get("observedAt")),
            "ageSeconds": _age_seconds(latest_weather.get("observedAt"), now),
            "temperatureC": latest_weather.get("temperatureC"),
            "rainMmHr": latest_weather.get("rainMmHr"),
            "visibilityM": latest_weather.get("visibilityM"),
            "condition": latest_weather.get("weatherCondition"),
            "source": latest_weather.get("source") or latest_weather.get("sourceType"),
            "interpolation": interpolation or None,
        }

    cell_match: dict[str, Any] = {}
    if h3_index:
        cell_match["h3Index"] = h3_index
    elif city_code:
        cell_match["cityCode"] = city_code
    latest_cell = db().spatialcells.find_one(cell_match, sort=[("lastUpdated", -1)])
    latest_cell_update = latest_cell.get("lastUpdated") if latest_cell else None

    return {
        "scope": {"h3Index": h3_index, "cityCode": city_code},
        "generatedAt": now.isoformat(),
        "totalEvents": total,
        "sourceCounts": source_counts,
        "synthetic": synthetic,
        "simulated": simulated,
        "firstObservedAt": _iso(first_observed_at),
        "lastObservedAt": _iso(last_observed_at),
        "observationAgeSeconds": observation_age,
        "freshness": _freshness(observation_age),
        "latestCellUpdate": _iso(latest_cell_update),
        "cellUpdateAgeSeconds": _age_seconds(latest_cell_update, now),
        "weather": {
            "events": weather_total,
            "interpolated": weather_interpolated,
            "exact": weather_exact,
            "averageNearestDistanceKm": round(float(average_nearest), 3) if average_nearest is not None else None,
            "latest": latest_weather_payload,
        },
        "derived": {
            "riskScore": "computed from stored telemetry, not a direct sensor reading",
            "forecast": "linear trend projection, not a measurement",
            "playbooks": "static authored templates, not official municipal SOPs",
            "agentActions": "advisory only; no dispatch, SMS or status mutation",
        },
    }
