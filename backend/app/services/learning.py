"""Trainable components used by production MEGH.

The demo engine uses deterministic priors so the repository runs without a model artifact.
This module contains the production training path: learn model error from hindcasts, then
turn predicted error into context-dependent trust weights.
"""
from __future__ import annotations
from dataclasses import dataclass
import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline

FEATURES = ["lead_hours", "latitude", "longitude", "month", "regime", "variable", "model"]
TARGET = "absolute_error"

@dataclass
class ModelErrorLearner:
    pipeline: Pipeline | None = None

    def fit(self, frame):
        X = frame[FEATURES]
        y = frame[TARGET].astype(float)
        numeric = ["lead_hours", "latitude", "longitude", "month"]
        categorical = ["regime", "variable", "model"]
        pre = ColumnTransformer([
            ("num", "passthrough", numeric),
            ("cat", OneHotEncoder(handle_unknown="ignore"), categorical),
        ])
        self.pipeline = Pipeline([("features", pre), ("regressor", HistGradientBoostingRegressor(max_iter=220, learning_rate=.06, max_depth=5, random_state=42))])
        self.pipeline.fit(X, y)
        return self

    def predict_error(self, frame):
        if self.pipeline is None:
            raise RuntimeError("ModelErrorLearner is not fitted")
        return np.maximum(0, self.pipeline.predict(frame))


def weights_from_predicted_error(errors: dict[str,float], floor=.03):
    inv = {m: 1.0 / max(floor, float(e)) for m,e in errors.items()}
    total = sum(inv.values())
    return {m:v/total for m,v in inv.items()}
