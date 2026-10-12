from heapq import heappop, heappush
from math import sqrt
from typing import Any, Dict, List, Tuple

GridPoint = Tuple[int, int]


def _heuristic(a: GridPoint, b: GridPoint) -> float:
    return sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2)


def _neighbors(point: GridPoint, rows: int, cols: int):
    r, c = point
    for dr, dc in (
        (-1, 0), (1, 0), (0, -1), (0, 1),
        (-1, -1), (-1, 1), (1, -1), (1, 1),
    ):
        nr, nc = r + dr, c + dc
        if 0 <= nr < rows and 0 <= nc < cols:
            yield (nr, nc)


def astar(
    risk_grid: List[List[float]],
    start: GridPoint,
    goal: GridPoint,
    risk_weight: float = 1.0,
) -> List[GridPoint]:
    """A* over a normalized risk grid.

    Cost = movement distance + risk_weight * cell risk.
    Use risk_weight=0 for the prototype fastest route.
    """
    if not risk_grid or not risk_grid[0]:
        return []

    rows, cols = len(risk_grid), len(risk_grid[0])
    if not (
        0 <= start[0] < rows and 0 <= start[1] < cols
        and 0 <= goal[0] < rows and 0 <= goal[1] < cols
    ):
        raise ValueError("start/goal is outside the risk grid")

    open_set = []
    heappush(open_set, (0.0, start))
    came_from: Dict[GridPoint, GridPoint] = {}
    cost_so_far: Dict[GridPoint, float] = {start: 0.0}

    while open_set:
        _, current = heappop(open_set)
        if current == goal:
            path = [current]
            while current in came_from:
                current = came_from[current]
                path.append(current)
            return list(reversed(path))

        for nxt in _neighbors(current, rows, cols):
            movement_cost = _heuristic(current, nxt)
            cell_risk = max(0.0, min(1.0, float(risk_grid[nxt[0]][nxt[1]])))
            new_cost = cost_so_far[current] + movement_cost + risk_weight * cell_risk
            if nxt not in cost_so_far or new_cost < cost_so_far[nxt]:
                cost_so_far[nxt] = new_cost
                priority = new_cost + _heuristic(nxt, goal)
                heappush(open_set, (priority, nxt))
                came_from[nxt] = current

    return []


def route_metrics(path: List[GridPoint], risk_grid: List[List[float]]) -> Dict[str, Any]:
    if not path:
        return {"grid_distance": 0.0, "risk_exposure": 0.0, "average_risk": 0.0, "max_risk": 0.0}

    distance = 0.0
    risks: List[float] = []
    for i in range(1, len(path)):
        a, b = path[i - 1], path[i]
        distance += _heuristic(a, b)
        risks.append(max(0.0, min(1.0, float(risk_grid[b[0]][b[1]]))))

    exposure = sum(risks)
    return {
        "grid_distance": round(distance, 4),
        "risk_exposure": round(exposure, 4),
        "average_risk": round(exposure / len(risks), 4) if risks else 0.0,
        "max_risk": round(max(risks), 4) if risks else 0.0,
    }


def build_route_pair(
    risk_grid: List[List[float]],
    start: GridPoint,
    goal: GridPoint,
) -> Dict[str, Any]:
    """Produce fastest and safest prototype alternatives."""
    fastest = astar(risk_grid, start, goal, risk_weight=0.0)
    safest = astar(risk_grid, start, goal, risk_weight=3.0)

    return {
        "fastest_route": {"path": fastest, "metrics": route_metrics(fastest, risk_grid)},
        "safest_route": {"path": safest, "metrics": route_metrics(safest, risk_grid)},
    }
