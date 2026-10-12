from typing import Any, Dict


def _clamp(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def combined_risk(
    sea_ice: float = 0.0,
    iceberg: float = 0.0,
    wave: float = 0.0,
    wind: float = 0.0,
    current: float = 0.0,
    weights: Dict[str, float] | None = None,
) -> Dict[str, Any]:
    """
    Prototype multi-hazard navigation risk.

    Default weights are deliberately simple and configurable. This is not
    a certified POLARIS RIO calculation.
    """
    weights = weights or {
        "sea_ice": 0.35,
        "iceberg": 0.30,
        "wave": 0.15,
        "wind": 0.10,
        "current": 0.10,
    }

    components = {
        "sea_ice": _clamp(sea_ice),
        "iceberg": _clamp(iceberg),
        "wave": _clamp(wave),
        "wind": _clamp(wind),
        "current": _clamp(current),
    }

    total_weight = sum(weights.values())
    if total_weight <= 0:
        raise ValueError("Risk weights must sum to a positive value")

    score = sum(
        components[name] * weights.get(name, 0.0)
        for name in components
    ) / total_weight

    return {
        "score": round(_clamp(score), 4),
        "level": risk_level(score),
        "components": components,
        "weights": weights,
        "method": "POLARIS-inspired prototype risk layer",
    }


def risk_level(score: float) -> str:
    score = _clamp(score)

    if score < 0.30:
        return "LOW"
    if score < 0.60:
        return "MEDIUM"
    if score < 0.80:
        return "HIGH"
    return "EXTREME"


def explain_risk(risk: Dict[str, Any]) -> list[str]:
    """Generate short explanations suitable for the frontend."""
    components = risk.get("components", {})
    explanations = []

    labels = {
        "sea_ice": "sea-ice concentration",
        "iceberg": "iceberg proximity",
        "wave": "wave conditions",
        "wind": "wind conditions",
        "current": "ocean current",
    }

    for key, value in components.items():
        if value >= 0.70:
            explanations.append(
                f"High {labels.get(key, key)} contributes significantly to risk."
            )
        elif value >= 0.40:
            explanations.append(
                f"Moderate {labels.get(key, key)} contributes to navigation risk."
            )

    if not explanations:
        explanations.append("No individual environmental factor is currently dominant.")

    return explanations
