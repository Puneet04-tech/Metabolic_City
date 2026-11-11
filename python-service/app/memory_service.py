from __future__ import annotations

import math
from collections import Counter, defaultdict
from datetime import datetime, timezone
from statistics import mean, pstdev
from typing import Any

import h3

from .db import db, json_safe
from .h3_service import cell_document, now_iso, risk_level


def _number(value: Any, default: float = 0.0) -> float:
    try:
        parsed = float(value)
        return parsed if parsed == parsed else default
    except (TypeError, ValueError):
        return default


def _dt(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    return None


def _history_for(cell: dict[str, Any]) -> list[dict[str, Any]]:
    raw = cell.get("history") or []
    points = []
    for entry in raw[-288:]:
        stamp = _dt(entry.get("calculatedAt")) or _dt(cell.get("lastUpdated"))
        if not stamp:
            continue
        points.append(
            {
                "timestamp": stamp.isoformat(),
                "compositeRisk": round(_number(entry.get("compositeRisk")), 2),
                "mobilityScore": round(_number((entry.get("scores") or {}).get("mobility")), 2),
                "climateScore": round(_number((entry.get("scores") or {}).get("climate")), 2),
                "vulnerabilityScore": round(_number((entry.get("scores") or {}).get("vulnerability")), 2),
            }
        )
    return sorted(points, key=lambda point: point["timestamp"])


def _incident_category(incident: dict[str, Any]) -> str:
    text = " ".join(
        str(part or "")
        for part in (
            (incident.get("action") or {}).get("actionNarrative"),
            (incident.get("action") or {}).get("dispatchText"),
            incident.get("resolutionNote"),
        )
    ).lower()
    if any(word in text for word in ("flood", "water", "drain", "rain", "ponding")):
        return "flood"
    if any(word in text for word in ("traffic", "road", "congestion", "closure", "diversion")):
        return "traffic"
    if any(word in text for word in ("medical", "health", "injury")):
        return "medical"
    if any(word in text for word in ("citizen", "report", "complaint")):
        return "citizen-report"
    return "municipal-hazard"


def _incident_history(h3_index: str) -> list[dict[str, Any]]:
    incidents = list(db().incidents.find({"h3Index": h3_index}).sort("detectedAt", -1).limit(80))
    history = []
    for incident in incidents:
        detected = _dt(incident.get("detectedAt")) or _dt(incident.get("createdAt"))
        resolved = _dt(incident.get("resolvedAt"))
        duration = (resolved - detected).total_seconds() * 1000 if detected and resolved else None
        action = incident.get("action") or {}
        history.append(
            {
                "incidentId": str(incident.get("_id")),
                "type": _incident_category(incident),
                "status": incident.get("status"),
                "severity": action.get("priority") or risk_level(_number(incident.get("riskScore"))),
                "riskScore": round(_number(incident.get("riskScore")), 2),
                "detectedAt": detected.isoformat() if detected else None,
                "resolvedAt": resolved.isoformat() if resolved else None,
                "resolutionTimeMs": duration,
                "success": incident.get("status") == "RESOLVED",
                "resources": action.get("recommendedResources") or [],
            }
        )
    return history


def _resource_history(incidents: list[dict[str, Any]]) -> list[dict[str, Any]]:
    resources: list[dict[str, Any]] = []
    for incident in incidents:
        for resource in incident.get("resources") or []:
            resources.append(
                {
                    "resourceType": resource,
                    "assignedAt": incident.get("detectedAt"),
                    "efficiency": 1.0 if incident.get("success") else 0.5,
                    "incidentId": incident.get("incidentId"),
                }
            )
    return resources[-80:]


def _pearson(left: list[float], right: list[float]) -> float:
    size = min(len(left), len(right))
    if size < 3:
        return 0.0
    a = left[-size:]
    b = right[-size:]
    mean_a = mean(a)
    mean_b = mean(b)
    numerator = sum((x - mean_a) * (y - mean_b) for x, y in zip(a, b))
    denominator = math.sqrt(sum((x - mean_a) ** 2 for x in a) * sum((y - mean_b) ** 2 for y in b))
    return numerator / denominator if denominator else 0.0


def _neighbour_correlations(cell: dict[str, Any], center_history: list[dict[str, Any]]) -> list[dict[str, Any]]:
    index = cell.get("h3Index")
    if not index:
        return []
    neighbours = [item for item in h3.grid_disk(index, 1) if item != index]
    docs = {item["h3Index"]: item for item in db().spatialcells.find({"h3Index": {"$in": neighbours}})}
    center_risk = _number(cell.get("compositeRisk"))
    correlations = []
    for neighbour_index, neighbour in docs.items():
        points = _history_for(neighbour)
        coefficient = _pearson(
            [point["compositeRisk"] for point in center_history],
            [point["compositeRisk"] for point in points],
        )
        diff = _number(neighbour.get("compositeRisk")) - center_risk
        correlations.append(
            {
                "neighborH3Index": neighbour_index,
                "correlationCoefficient": round(coefficient, 3),
                "neighborRisk": round(_number(neighbour.get("compositeRisk")), 2),
                "riskDelta": round(diff, 2),
                "cascadeDirection": "increasing" if diff > 0.5 else "decreasing" if diff < -0.5 else "stable",
                "streets": (neighbour.get("context") or {}).get("streets", [])[:2],
            }
        )
    correlations.sort(key=lambda item: abs(item["correlationCoefficient"]), reverse=True)
    return correlations


def _trend(points: list[dict[str, Any]]) -> dict[str, Any]:
    values = [point["compositeRisk"] for point in points]
    if len(values) < 2:
        return {"direction": "unknown", "slopePerHour": 0.0, "volatility": 0.0, "change": 0.0}
    first = values[max(0, len(values) - 12)]
    last = values[-1]
    hours = max(0.25, (len(values) - 1) * 10 / 60)
    slope = (last - first) / min(hours, 12)
    direction = "rising" if slope > 0.12 else "falling" if slope < -0.12 else "stable"
    return {
        "direction": direction,
        "slopePerHour": round(slope, 3),
        "volatility": round(pstdev(values), 3),
        "change": round(last - first, 2),
    }


def _seasonality(points: list[dict[str, Any]]) -> dict[str, Any]:
    if not points:
        return {"pattern": "unknown", "peakHour": None, "peakHourRisk": 0}
    by_hour: dict[int, list[float]] = defaultdict(list)
    for point in points:
        stamp = _dt(point.get("timestamp"))
        if stamp:
            by_hour[stamp.hour].append(point["compositeRisk"])
    if not by_hour:
        return {"pattern": "unknown", "peakHour": None, "peakHourRisk": 0}
    peak_hour, risks = max(by_hour.items(), key=lambda item: mean(item[1]))
    night = [mean(risks) for hour, risks in by_hour.items() if hour >= 22 or hour < 6]
    day = [mean(risks) for hour, risks in by_hour.items() if 6 <= hour < 22]
    night_avg = mean(night) if night else 0
    day_avg = mean(day) if day else 0
    pattern = "night-peaks" if night_avg > day_avg + 0.4 else "day-peaks" if day_avg > night_avg + 0.4 else "uniform"
    return {"pattern": pattern, "peakHour": peak_hour, "peakHourRisk": round(mean(risks), 2)}


def _event_patterns(incidents: list[dict[str, Any]], points: list[dict[str, Any]]) -> dict[str, Any]:
    by_type = Counter(incident.get("type") for incident in incidents)
    by_hour: Counter[int] = Counter()
    by_weekday: Counter[str] = Counter()
    for incident in incidents:
        stamp = _dt(incident.get("detectedAt"))
        if stamp:
            by_hour[stamp.hour] += 1
            by_weekday[stamp.strftime("%A")] += 1
    high_hours = Counter()
    for point in points:
        if point["compositeRisk"] >= 5:
            stamp = _dt(point.get("timestamp"))
            if stamp:
                high_hours[stamp.hour] += 1
    return {
        "incidentsByType": [{"type": key, "count": value} for key, value in by_type.most_common()],
        "incidentsByHour": [{"hour": hour, "count": count} for hour, count in sorted(by_hour.items())],
        "incidentsByWeekday": [{"weekday": day, "count": count} for day, count in by_weekday.most_common()],
        "highRiskHours": [hour for hour, _ in high_hours.most_common(4)],
        "peakIncidentHour": by_hour.most_common(1)[0][0] if by_hour else None,
        "recurrencePattern": "recurring" if len(incidents) >= 3 else "emerging" if incidents else "no-recorded-incidents",
    }


def _predictive_pattern(points: list[dict[str, Any]], incidents: list[dict[str, Any]], trend: dict[str, Any]) -> dict[str, Any]:
    values = [point["compositeRisk"] for point in points]
    if not values:
        return {
            "nextHourRisk": 0,
            "next3HourRisk": 0,
            "hotspotProbability": 0,
            "label": "insufficient-history",
            "method": "linear trend extrapolation; not a trained ML model",
        }
    current = values[-1]
    slope = trend.get("slopePerHour", 0)
    # Damp the slope: a single short interval should not project a spike.
    next_hour = max(0.0, min(10.0, current + slope * 0.6))
    next_three = max(0.0, min(10.0, current + slope * 1.8))
    recurrence = min(1.0, len(incidents) / 8)
    hotspot = max(0.0, min(1.0, (next_three / 10) * 0.7 + recurrence * 0.2 + max(0.0, slope) * 0.1))
    label = (
        "proactive-hotspot"
        if next_three >= 5 or hotspot >= 0.65
        else "watch"
        if next_three >= 3 or slope > 0.15
        else "stable"
    )
    return {
        "nextHourRisk": round(next_hour, 2),
        "next3HourRisk": round(next_three, 2),
        "hotspotProbability": round(hotspot, 2),
        "label": label,
        "method": "linear trend extrapolation + incident recurrence; not a trained ML model",
    }


def _profile(cell: dict[str, Any], incidents: list[dict[str, Any]], trend: dict[str, Any]) -> dict[str, Any]:
    burn_in = len(incidents)
    successes = sum(1 for incident in incidents if incident.get("success"))
    resolved = sum(1 for incident in incidents if incident.get("resolvedAt"))
    average_resolution = [
        incident["resolutionTimeMs"]
        for incident in incidents
        if incident.get("resolutionTimeMs") is not None
    ]
    dominant = Counter(incident.get("type") for incident in incidents).most_common(1)
    context = cell.get("context") or {}
    profile = "stable-monitoring"
    if trend["direction"] == "rising" and trend["volatility"] > 1.5:
        profile = "volatile-escalation"
    elif any("flood" in str(item) for item in context.get("streets", [])) or _number(context.get("floodSusceptibility")) > 0.6:
        profile = "flood-sensitive"
    elif dominant and dominant[0][0] == "traffic":
        profile = "traffic-sensitive"
    elif burn_in >= 3:
        profile = "recurring-incidents"
    return {
        "label": profile,
        "incidentCount": burn_in,
        "resolvedCount": resolved,
        "successRate": round(successes / resolved, 3) if resolved else 0,
        "averageResolutionMinutes": round(mean(average_resolution) / 60000, 1) if average_resolution else None,
        "dominantIncidentType": dominant[0][0] if dominant else None,
        "dominantIncidentCount": dominant[0][1] if dominant else 0,
        "recurrencePerMonth": round(burn_in / 30, 2),
    }


def build_memory(h3_index: str) -> dict[str, Any]:
    cell = cell_document(h3_index)
    if not cell:
        return {"h3Index": h3_index, "available": False, "reason": "cell-not-found"}
    history = _history_for(cell)
    incidents = _incident_history(h3_index)
    trend = _trend(history)
    seasonality = _seasonality(history)
    correlations = _neighbour_correlations(cell, history)
    values = [point["compositeRisk"] for point in history]
    event_patterns = _event_patterns(incidents, history)
    predictive = _predictive_pattern(history, incidents, trend)
    memory = {
        "h3Index": h3_index,
        "available": True,
        "cityCode": cell.get("cityCode"),
        "riskHistory": history[-120:],
        "incidentHistory": incidents,
        "resourceHistory": _resource_history(incidents),
        "neighborCorrelations": correlations,
        "summary": {
            "currentRisk": round(_number(cell.get("compositeRisk")), 2),
            "baselineRisk": round(mean(values), 2) if values else 0,
            "peakRisk": round(max(values), 2) if values else 0,
            "minimumRisk": round(min(values), 2) if values else 0,
            "sampleCount": len(values),
            "trend": trend,
            "seasonality": seasonality,
        },
        "personality": _profile(cell, incidents, trend),
        "eventPatterns": event_patterns,
        "predictivePattern": predictive,
        "lastUpdated": now_iso(),
    }
    db().cell_memories.update_one(
        {"h3Index": h3_index},
        {
            "$set": {
                **json_safe(memory),
                "updatedAt": datetime.now(timezone.utc),
            },
            "$setOnInsert": {"createdAt": datetime.now(timezone.utc)},
        },
        upsert=True,
    )
    return memory


def memory_document(h3_index: str) -> dict[str, Any] | None:
    return db().cell_memories.find_one({"h3Index": h3_index})


def summary_counts() -> dict[str, Any]:
    totals = list(
        db().cell_memories.aggregate(
            [
                {"$project": {"n": {"$size": {"$ifNull": ["$riskHistory", []]}}}},
                {"$group": {"_id": None, "sum": {"$sum": "$n"}}},
            ]
        )
    )
    return {
        "trackedCells": db().cell_memories.count_documents({}),
        "riskSamples": totals[0]["sum"] if totals else 0,
        "incidentsRemembered": db().incidents.count_documents({}),
        "agentRuns": db().agent_runs.count_documents({}),
        "knowledgeDocuments": db().knowledge_documents.count_documents({}),
    }