from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Iterable

import h3

from .db import db, json_safe


RESOLUTIONS = (8, 6, 4)
RESOLUTION_LABELS = {
    8: "Street",
    6: "Neighbourhood",
    4: "City",
}


def _number(value: Any, default: float = 0.0) -> float:
    try:
        parsed = float(value)
        return parsed if parsed == parsed else default
    except (TypeError, ValueError):
        return default


def cell_document(h3_index: str) -> dict[str, Any] | None:
    return db().spatialcells.find_one({"h3Index": h3_index})


def all_cell_documents(limit: int = 5000) -> list[dict[str, Any]]:
    return list(
        db()
        .spatialcells.find(
            {},
            {
                "h3Index": 1,
                "cityCode": 1,
                "compositeRisk": 1,
                "riskLevel": 1,
                "scores": 1,
                "latitude": 1,
                "longitude": 1,
                "alertScore": 1,
                "alertLevel": 1,
                "context": 1,
                "lastUpdated": 1,
                "history": 1,
            },
        )
        .sort("compositeRisk", -1)
        .limit(limit)
    )


def resolution_parent(h3_index: str, resolution: int) -> str:
    return h3.cell_to_parent(h3_index, resolution)


def cell_center(h3_index: str) -> tuple[float, float]:
    lat, lng = h3.cell_to_latlng(h3_index)
    return _number(lat), _number(lng)


def multi_resolution(h3_index: str) -> dict[str, Any]:
    """Aggregate the same cell at street, neighbourhood and city scale.

    Scanning the stored res-8 cells and grouping them by their true parent is
    safer than generating every child of a res-4 parent: a city-scale parent
    can include cells outside the municipality boundary.
    """
    cells = all_cell_documents()
    if not cells:
        return {"h3Index": h3_index, "resolutions": [], "source": "empty"}

    groups: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for cell in cells:
        index = cell.get("h3Index")
        if not index:
            continue
        for resolution in RESOLUTIONS:
            try:
                parent = resolution_parent(index, resolution)
            except Exception:
                continue
            if parent == resolution_parent(h3_index, resolution):
                groups[resolution].append(cell)

    center = cell_document(h3_index)
    center_risk = _number(center.get("compositeRisk") if center else 0)
    levels = []
    for resolution in RESOLUTIONS:
        members = groups.get(resolution, [])
        risks = [_number(item.get("compositeRisk")) for item in members]
        avg = sum(risks) / len(risks) if risks else 0.0
        total = sum(risks)
        peak_cell = max(members, key=lambda item: _number(item.get("compositeRisk")), default=None)
        levels.append(
            {
                "resolution": resolution,
                "label": RESOLUTION_LABELS[resolution],
                "h3Index": resolution_parent(h3_index, resolution),
                "cellCount": len(members),
                "averageRisk": round(avg, 2),
                "peakRisk": round(max(risks), 2) if risks else 0.0,
                "peakCell": peak_cell.get("h3Index") if peak_cell else None,
                # Share of the parent's total stored risk, not a ratio of
                # averages. This is the number that answers "how much of the
                # neighbourhood's risk sits in this cell?".
                "contribution": round((center_risk / total) if total > 0 else 0, 3),
            }
        )

    return {
        "h3Index": h3_index,
        "centerRisk": round(center_risk, 2),
        "resolutions": levels,
        "insight": _resolution_insight(levels),
        "source": "spatialcells grouped by H3 parent",
    }


def _resolution_insight(levels: list[dict[str, Any]]) -> str:
    if len(levels) < 2:
        return "Insufficient cells to compare scales."
    street = levels[0]
    city = levels[-1]
    if street["averageRisk"] >= city["averageRisk"] + 1:
        return "This street is a local hotspot above the city-scale average."
    if city["peakRisk"] >= 5 and street["averageRisk"] < 5:
        return "The wider area contains a higher-risk cell; review neighbourhood propagation."
    return "Risk is broadly consistent across the street and city scales."


def graph_analysis(h3_index: str, rings: int = 2) -> dict[str, Any]:
    """Build the H3 adjacency graph around a cell and expose operational signals."""
    import networkx as nx

    ring_cells = h3.grid_disk(h3_index, max(1, min(rings, 4)))
    documents = {
        item["h3Index"]: item
        for item in db().spatialcells.find({"h3Index": {"$in": list(ring_cells)}})
    }
    graph = nx.Graph()
    for index, cell in documents.items():
        graph.add_node(
            index,
            risk=_number(cell.get("compositeRisk")),
            level=cell.get("riskLevel") or "LOW",
            cityCode=cell.get("cityCode"),
        )

    for index in documents:
        if index not in graph:
            continue
        for neighbour in h3.grid_disk(index, 1):
            if neighbour == index or neighbour not in graph:
                continue
            risk_diff = abs(graph.nodes[index]["risk"] - graph.nodes[neighbour]["risk"])
            # A high risk difference is a harder boundary to cross; the weight
            # is also useful as an intervention score.
            graph.add_edge(index, neighbour, weight=round(1 + risk_diff, 3), riskDiff=round(risk_diff, 3))

    if not graph:
        return {"h3Index": h3_index, "nodes": [], "edges": [], "available": False}

    degree = nx.degree_centrality(graph)
    betweenness = nx.betweenness_centrality(graph, weight="weight") if len(graph) > 2 else {node: 0 for node in graph}
    closeness = nx.closeness_centrality(graph)
    ranking = sorted(
        graph.nodes,
        key=lambda node: (betweenness.get(node, 0) * 0.6) + (degree.get(node, 0) * 0.4),
        reverse=True,
    )
    center_node = graph.nodes.get(h3_index, {})
    neighbours = list(graph.neighbors(h3_index)) if h3_index in graph else []
    neighbour_risk = [graph.nodes[node]["risk"] for node in neighbours]
    avg_neighbour = sum(neighbour_risk) / len(neighbour_risk) if neighbour_risk else 0.0
    higher_neighbours = [node for node in neighbours if graph.nodes[node]["risk"] > _number(center_node.get("risk")) + 0.25]
    highest = max(graph.nodes, key=lambda node: graph.nodes[node]["risk"], default=h3_index)

    path: list[str] = []
    if h3_index in graph and highest in graph:
        try:
            path = nx.shortest_path(graph, h3_index, highest, weight="weight")
        except nx.NetworkXNoPath:
            path = []

    nodes = []
    for node, attrs in graph.nodes(data=True):
        nodes.append(
            {
                "h3Index": node,
                "risk": round(_number(attrs.get("risk")), 2),
                "level": attrs.get("level"),
                "degreeCentrality": round(degree.get(node, 0), 3),
                "betweennessCentrality": round(betweenness.get(node, 0), 3),
                "closenessCentrality": round(closeness.get(node, 0), 3),
                "isCenter": node == h3_index,
            }
        )
    nodes.sort(key=lambda item: item["betweennessCentrality"], reverse=True)
    intervention = [item["h3Index"] for item in nodes[:3]]
    containment = {
        "interventionNodes": intervention,
        "isolateNeighbours": [
            {"h3Index": node, "risk": round(_number(graph.nodes[node]["risk"]), 2)}
            for node in higher_neighbours[:4]
        ],
        "score": round(
            min(1.0, (betweenness.get(ranking[0], 0) if ranking else 0) + (len(higher_neighbours) / max(1, len(neighbours))) * 0.5),
            3,
        ),
        "recommendation": (
            f"Intervene at {ranking[0]} first; it carries the highest combined centrality, then recheck {len(higher_neighbours)} higher-risk neighbours."
            if ranking and higher_neighbours
            else f"Intervene at {ranking[0]} first; no higher-risk neighbour is currently pulling the centre up."
            if ranking
            else "No containment path exists in the loaded graph."
        ),
    }

    return {
        "h3Index": h3_index,
        "available": True,
        "nodeCount": graph.number_of_nodes(),
        "edgeCount": graph.number_of_edges(),
        "density": round(nx.density(graph), 3),
        "componentCount": nx.number_connected_components(graph),
        "criticalHub": ranking[0] if ranking else None,
        "criticalHubRisk": round(_number(graph.nodes[ranking[0]]["risk"]), 2) if ranking else 0,
        "center": {
            "h3Index": h3_index,
            "risk": round(_number(center_node.get("risk")), 2),
            "degreeCentrality": round(degree.get(h3_index, 0), 3),
            "betweennessCentrality": round(betweenness.get(h3_index, 0), 3),
        },
        "neighbourAverageRisk": round(avg_neighbour, 2),
        "cascadeDelta": round(avg_neighbour - _number(center_node.get("risk")), 2),
        "cascadeDirection": "increasing" if avg_neighbour > _number(center_node.get("risk")) + 0.5 else "decreasing" if avg_neighbour < _number(center_node.get("risk")) - 0.5 else "stable",
        "higherRiskNeighbours": higher_neighbours,
        "responseRoute": path,
        "containment": containment,
        "nodes": nodes,
        "edges": [
            {"source": source, "target": target, "weight": attrs.get("weight"), "riskDiff": attrs.get("riskDiff")}
            for source, target, attrs in graph.edges(data=True)
        ],
        "method": "H3 adjacency graph; weighted by risk difference",
    }


def critical_hubs(limit: int = 8) -> list[dict[str, Any]]:
    """Rank cells by how much risk they could pass to their neighbours."""
    cells = all_cell_documents()
    by_index = {cell["h3Index"]: cell for cell in cells if cell.get("h3Index")}
    ranked: list[dict[str, Any]] = []
    for cell in cells[: max(40, limit * 4)]:
        index = cell.get("h3Index")
        if not index:
            continue
        neighbour_docs = [by_index[node] for node in h3.grid_disk(index, 1) if node in by_index and node != index]
        if not neighbour_docs:
            continue
        neighbour_avg = sum(_number(item.get("compositeRisk")) for item in neighbour_docs) / len(neighbour_docs)
        risk = _number(cell.get("compositeRisk"))
        spread = max(0.0, risk - neighbour_avg)
        ranked.append(
            {
                "h3Index": index,
                "cityCode": cell.get("cityCode"),
                "risk": round(risk, 2),
                "neighbourAverageRisk": round(neighbour_avg, 2),
                "spreadRisk": round(spread, 2),
                "neighbourCount": len(neighbour_docs),
                "streets": (cell.get("context") or {}).get("streets", [])[:2],
            }
        )
    ranked.sort(key=lambda item: (item["spreadRisk"], item["risk"]), reverse=True)
    return ranked[: max(1, min(limit, 25))]


def risk_level(risk: float) -> str:
    if risk >= 7:
        return "CRITICAL"
    if risk >= 5:
        return "HIGH"
    if risk >= 3:
        return "MODERATE"
    return "LOW"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()