from __future__ import annotations
import math
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Iterable
import numpy as np

MODELS = ["ECMWF", "AIFS", "NCUM", "GFS", "GraphCast"]
REGIMES = ["MONSOON_ACTIVE", "MONSOON_BREAK", "DRY", "HEAT_STRESS", "WESTERN_DISTURBANCE", "CONVECTIVE"]
VARIABLES = ["rainfall", "temperature", "wind"]

# These values are calibration/demo priors, NOT claimed operational scores.
BASE_SKILL = {
    "rainfall": {"ECMWF": .82, "AIFS": .79, "NCUM": .80, "GFS": .75, "GraphCast": .77},
    "temperature": {"ECMWF": .86, "AIFS": .88, "NCUM": .81, "GFS": .78, "GraphCast": .84},
    "wind": {"ECMWF": .84, "AIFS": .82, "NCUM": .83, "GFS": .80, "GraphCast": .81},
}
REGIME_AFFINITY = {
    "MONSOON_ACTIVE": {"ECMWF": .10, "AIFS": .08, "NCUM": .12, "GFS": .03, "GraphCast": .06},
    "MONSOON_BREAK": {"ECMWF": .05, "AIFS": .08, "NCUM": .06, "GFS": .07, "GraphCast": .09},
    "DRY": {"ECMWF": .06, "AIFS": .10, "NCUM": .05, "GFS": .08, "GraphCast": .09},
    "HEAT_STRESS": {"ECMWF": .07, "AIFS": .12, "NCUM": .05, "GFS": .04, "GraphCast": .08},
    "WESTERN_DISTURBANCE": {"ECMWF": .12, "AIFS": .07, "NCUM": .10, "GFS": .08, "GraphCast": .05},
    "CONVECTIVE": {"ECMWF": .08, "AIFS": .10, "NCUM": .11, "GFS": .04, "GraphCast": .07},
}

@dataclass(frozen=True)
class FusionResult:
    value: float
    lower: float
    upper: float
    confidence: float
    disagreement: float
    hazard_probability: float
    regime: str
    contributions: list[dict]


def _sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))


def regime_for(lat: float, lon: float, variable: str, lead: int) -> str:
    if variable == "temperature" and lat < 28 and 14 < (lon % 20) < 19:
        return "HEAT_STRESS"
    if variable == "rainfall":
        seasonal = ((lon * .7 + lat * .2 + lead / 36) % 7)
        if 1.0 < seasonal < 4.6:
            return "MONSOON_ACTIVE"
        if 4.6 <= seasonal < 5.6:
            return "CONVECTIVE"
        return "MONSOON_BREAK"
    if lat > 28 and lead > 72:
        return "WESTERN_DISTURBANCE"
    return "DRY"


def raw_model_forecast(model: str, lat: float, lon: float, lead: int, variable: str, regime: str) -> float:
    # Deterministic spatial field used only when no real model adapter is configured.
    wave = math.sin(math.radians(lon * 2.4 + lead * .7)) + .55 * math.cos(math.radians(lat * 3.1 - lead))
    monsoon_band = max(0.0, math.cos(math.radians(lat - 19)) * math.sin(math.radians(lon * 1.7 + lead * 2)))
    model_offset = {"ECMWF": .0, "AIFS": .7, "NCUM": -1.1, "GFS": -2.0, "GraphCast": .3}[model]
    if variable == "rainfall":
        base = 34 + 23 * wave + 42 * monsoon_band
        regime_boost = 22 if regime == "MONSOON_ACTIVE" else 8 if regime == "CONVECTIVE" else 0
        return max(0.0, base + regime_boost + model_offset * 2.1 + 0.12 * lead)
    if variable == "temperature":
        base = 28 + .30 * (24 - lat) + 2.2 * wave
        return base + model_offset + (.9 if regime == "HEAT_STRESS" else 0)
    base = 12 + 7 * abs(wave) + 2.5 * math.sin(math.radians(lon + lead))
    return max(0.0, base + model_offset)


def softmax(xs: Iterable[float], temperature: float = .075) -> np.ndarray:
    arr = np.asarray(list(xs), dtype=float) / temperature
    arr -= np.max(arr)
    ex = np.exp(arr)
    return ex / ex.sum()


def hazard_probability(value: float, variable: str, disagreement: float) -> float:
    if variable == "rainfall":
        threshold = 64.5
    elif variable == "temperature":
        threshold = 40.0
    else:
        threshold = 50.0
    spread = max(3.0, abs(value) * (.10 + .45 * disagreement))
    return float(np.clip(1 - 0.5 * (1 + math.erf((threshold - value) / (spread * math.sqrt(2)))), 0, 1))


def fuse(lat: float, lon: float, lead: int, variable: str, requested_model: str | None = None) -> FusionResult:
    regime = regime_for(lat, lon, variable, lead)
    forecasts = {m: raw_model_forecast(m, lat, lon, lead, variable, regime) for m in MODELS}
    med = float(np.median(list(forecasts.values())))
    scored = []
    detail = []
    for m in MODELS:
        skill = BASE_SKILL[variable][m]
        affinity = REGIME_AFFINITY[regime][m]
        bias = ((forecasts[m] - med) / max(1.0, abs(med)))
        outlier = min(0.20, abs(bias) * 0.55)
        lead_penalty = min(0.12, lead / 240 * (0.05 if m == "AIFS" else 0.08))
        score = skill + affinity - outlier - lead_penalty
        scored.append(score)
        detail.append((m, skill, affinity, bias, outlier, forecasts[m]))
    weights = softmax(scored)
    if requested_model in MODELS:
        # Used for the 
        selected = requested_model
        value = forecasts[selected]
    else:
        value = float(sum(w * forecasts[m] for w, m in zip(weights, MODELS)))
    variance = float(sum(w * (forecasts[m] - value) ** 2 for w, m in zip(weights, MODELS)))
    std = math.sqrt(max(0.0, variance))
    disagreement = float(np.clip(std / max(5.0, abs(value)), 0, 1))
    confidence = float(np.clip(0.96 - 0.75 * disagreement - 0.0018 * lead, 0.18, 0.96))
    lower = max(0.0, value - 1.65 * std)
    upper = value + 1.65 * std
    hazard = hazard_probability(value, variable, disagreement)
    contributions = []
    for (m, skill, affinity, bias, outlier, forecast), w in zip(detail, weights):
        contributions.append({
            "model": m,
            "weight": round(float(w), 4),
            "forecast": round(float(forecast), 2),
            "skill": round(float(skill), 3),
            "regime_affinity": round(float(affinity), 3),
            "recent_bias": round(float(bias), 4),
            "outlier_penalty": round(float(outlier), 4),
        })
    return FusionResult(
        value=round(float(value), 2),
        lower=round(float(lower), 2),
        upper=round(float(upper), 2),
        confidence=round(confidence, 3),
        disagreement=round(disagreement, 3),
        hazard_probability=round(hazard, 3),
        regime=regime,
        contributions=contributions,
    )


def point_feature(lat: float, lon: float, lead: int, variable: str, requested_model: str | None = None) -> dict:
    r = fuse(lat, lon, lead, variable, requested_model)
    return {
        "latitude": lat, "longitude": lon, "value": r.value,
        "lower": r.lower, "upper": r.upper,
        "confidence": r.confidence, "disagreement": r.disagreement,
        "hazard_probability": r.hazard_probability, "regime": r.regime,
        "contributions": r.contributions,
        "top_model": max(r.contributions, key=lambda x: x["weight"])["model"],
        "top_weight": max(x["weight"] for x in r.contributions),
    }


def grid_features(variable: str, lead: int, step: float = 1.25, requested_model: str | None = None) -> list[dict]:
    # India operational view; grid is intentionally bounded to the Indian domain.
    # A real deployment replaces this generator with gridded NetCDF/GRIB ingestion.
    points = []
    for lat in np.arange(8.0, 36.1, step):
        for lon in np.arange(69.0, 97.1, step):
            # broad India land-domain gate, conservative around the coasts and islands.
            if lon < 74 and lat > 30: continue
            if lon > 92 and lat < 20: continue
            if lat < 9.0 and lon > 78: continue
            points.append(point_feature(round(float(lat), 3), round(float(lon), 3), lead, variable, requested_model))
    return points


def model_skill(variable: str) -> list[dict]:
    rows = []
    for m in MODELS:
        regime_scores = {r: round(BASE_SKILL[variable][m] + REGIME_AFFINITY[r][m], 3) for r in REGIMES}
        rows.append({"model": m, "overall_skill": BASE_SKILL[variable][m], "regimes": regime_scores,
                     "health": round(.93 - .02 * MODELS.index(m), 3)})
    return rows


def replay(event_id: str, variable: str) -> list[dict]:
    lead_points = [120, 96, 72, 48, 24, 12, 6, 0]
    out = []
    lat, lon = (19.0, 73.0) if "west" in event_id.lower() else (23.0, 85.0)
    for lead in lead_points:
        r = fuse(lat, lon, lead, variable)
        out.append({"lead_hours": lead, "forecast": r.value, "confidence": r.confidence,
                    "disagreement": r.disagreement, "hazard_probability": r.hazard_probability,
                    "weights": {x["model"]: x["weight"] for x in r.contributions}})
    return out
