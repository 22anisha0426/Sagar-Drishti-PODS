from __future__ import annotations

from dataclasses import dataclass
from random import Random
from typing import Any, Dict, List, Tuple

GridPoint = Tuple[int, int]

ACTIONS: Dict[str, GridPoint] = {
    "NORTH": (1, 0),
    "SOUTH": (-1, 0),
    "EAST": (0, 1),
    "WEST": (0, -1),
    "NORTHEAST": (1, 1),
    "NORTHWEST": (1, -1),
    "SOUTHEAST": (-1, 1),
    "SOUTHWEST": (-1, -1),
}


@dataclass
class ReplanDecision:
    action: str
    reason: str
    risk_score: float
    next_cell: GridPoint | None
    policy: str


def _clamp(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def valid_actions(cell: GridPoint, rows: int, cols: int) -> Dict[str, GridPoint]:
    r, c = cell
    result: Dict[str, GridPoint] = {}
    for name, (dr, dc) in ACTIONS.items():
        nxt = (r + dr, c + dc)
        if 0 <= nxt[0] < rows and 0 <= nxt[1] < cols:
            result[name] = nxt
    return result


def _argmax_action(q_values: Dict[str, float], rng: Random) -> str:
    maximum = max(q_values.values())
    choices = [a for a, v in q_values.items() if abs(v - maximum) < 1e-12]
    return rng.choice(choices)


def train_q_learning(
    risk_grid: List[List[float]],
    start: GridPoint,
    goal: GridPoint,
    episodes: int = 250,
    max_steps: int = 300,
    alpha: float = 0.20,
    gamma: float = 0.92,
    epsilon: float = 0.25,
    seed: int = 42,
) -> Dict[str, Any]:
    """Train a small tabular Q-learning policy directly on the current risk grid.

    This is intentionally a prototype/simulation policy, not a production RL
    navigation controller. The state is the grid cell and the reward balances
    progress, movement cost and environmental risk.
    """
    if not risk_grid or not risk_grid[0]:
        raise ValueError("Risk grid is empty")

    rows, cols = len(risk_grid), len(risk_grid[0])
    if not (0 <= start[0] < rows and 0 <= start[1] < cols):
        raise ValueError("RL start cell is outside the grid")
    if not (0 <= goal[0] < rows and 0 <= goal[1] < cols):
        raise ValueError("RL goal cell is outside the grid")

    rng = Random(seed)
    q: Dict[Tuple[GridPoint, str], float] = {}
    successful = 0

    def q_value(state: GridPoint, action: str) -> float:
        return q.get((state, action), 0.0)

    for _ in range(max(1, episodes)):
        state = start
        for _step in range(max(1, max_steps)):
            candidates = valid_actions(state, rows, cols)
            if not candidates:
                break
            if state == goal:
                successful += 1
                break

            if rng.random() < epsilon:
                action = rng.choice(list(candidates))
            else:
                action = _argmax_action({a: q_value(state, a) for a in candidates}, rng)

            nxt = candidates[action]
            risk = _clamp(risk_grid[nxt[0]][nxt[1]])
            distance_before = abs(state[0] - goal[0]) + abs(state[1] - goal[1])
            distance_after = abs(nxt[0] - goal[0]) + abs(nxt[1] - goal[1])
            progress = distance_before - distance_after

            # Risk dominates only when it is significant; reaching the goal
            # receives a large positive reward.
            reward = (1.5 * progress) - 0.20 - (3.0 * risk)
            if risk >= 0.85:
                reward -= 3.0
            if nxt == goal:
                reward += 15.0

            next_candidates = valid_actions(nxt, rows, cols)
            next_max = max((q_value(nxt, a) for a in next_candidates), default=0.0)
            old = q_value(state, action)
            q[(state, action)] = old + alpha * (reward + gamma * next_max - old)
            state = nxt

            if state == goal:
                successful += 1
                break

    return {
        "q_values": q,
        "episodes": max(1, episodes),
        "successful_episodes": successful,
        "policy": "tabular-q-learning-prototype",
    }


def choose_action_from_policy(
    risk_grid: List[List[float]],
    current: GridPoint,
    goal: GridPoint,
    q_values: Dict[Tuple[GridPoint, str], float],
    hazard_threshold: float = 0.70,
) -> ReplanDecision:
    rows, cols = len(risk_grid), len(risk_grid[0])
    candidates = valid_actions(current, rows, cols)
    if not candidates:
        return ReplanDecision("HALT", "No candidate movement actions are available.", 1.0, None, "tabular-q-learning-prototype")

    scored: List[Tuple[float, str, GridPoint, float]] = []
    for action, nxt in candidates.items():
        risk = _clamp(risk_grid[nxt[0]][nxt[1]])
        q = float(q_values.get((current, action), 0.0))
        # Tie-break toward lower hazard and then toward the goal.
        goal_distance = abs(nxt[0] - goal[0]) + abs(nxt[1] - goal[1])
        score = q - (4.0 * risk) - (0.05 * goal_distance)
        scored.append((score, action, nxt, risk))

    scored.sort(key=lambda item: item[0], reverse=True)
    _, action, nxt, risk = scored[0]

    if _clamp(risk_grid[current[0]][current[1]]) >= hazard_threshold and risk >= hazard_threshold:
        return ReplanDecision(
            "HALT",
            "High hazard persists in the current cell and candidate movement cells.",
            risk,
            None,
            "tabular-q-learning-prototype",
        )

    if risk < _clamp(risk_grid[current[0]][current[1]]):
        reason = "Q-learning selected a movement action that reduces predicted multi-hazard exposure."
    else:
        reason = "Q-learning selected the highest-value available movement action while balancing risk and progress."

    return ReplanDecision(action, reason, risk, nxt, "tabular-q-learning-prototype")


def replan_on_grid(
    risk_grid: List[List[float]],
    current: GridPoint,
    goal: GridPoint,
    episodes: int = 250,
    seed: int = 42,
) -> Dict[str, Any]:
    trained = train_q_learning(risk_grid, current, goal, episodes=episodes, seed=seed)
    decision = choose_action_from_policy(risk_grid, current, goal, trained["q_values"])
    return {
        "action": decision.action,
        "reason": decision.reason,
        "risk": round(decision.risk_score, 4),
        "next_cell": list(decision.next_cell) if decision.next_cell else None,
        "policy": decision.policy,
        "training": {
            "episodes": trained["episodes"],
            "successful_episodes": trained["successful_episodes"],
        },
    }
