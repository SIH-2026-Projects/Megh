from pydantic import BaseModel, Field
from typing import Literal

Variable = Literal["rainfall", "temperature", "wind"]
Mode = Literal["blend", "model", "confidence", "disagreement", "hazard"]

class ForecastRequest(BaseModel):
    variable: Variable = "rainfall"
    lead_hours: int = Field(48, ge=0, le=240)
    latitude: float = Field(20.6, ge=6, le=38)
    longitude: float = Field(78.9, ge=68, le=98)
    model: str | None = None

class ModelContribution(BaseModel):
    model: str
    weight: float
    forecast: float
    skill: float
    regime_affinity: float
    recent_bias: float
    outlier_penalty: float

class ForecastPoint(BaseModel):
    latitude: float
    longitude: float
    value: float
    lower: float
    upper: float
    confidence: float
    disagreement: float
    hazard_probability: float
    regime: str
    contributions: list[ModelContribution]
    top_model: str | None = None
    top_weight: float | None = None

class ForecastResponse(BaseModel):
    product: str = "MEGH"
    data_mode: str
    variable: Variable
    lead_hours: int
    valid_time: str
    point: ForecastPoint
    methodology: list[str]

class VerificationResponse(BaseModel):
    data_mode: str
    variable: Variable
    horizon_days: int
    methods: list[dict]
    event_cases: list[dict]

class ReplayResponse(BaseModel):
    data_mode: str
    event_id: str
    variable: Variable
    frames: list[dict]
