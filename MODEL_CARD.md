# MEGH Model Card

## Intended use

MEGH is intended to combine heterogeneous weather forecasts and expose forecast confidence, disagreement and model-specific contribution for medium-range operational analysis.

## Not intended for

The bundled synthetic mode is not suitable for real-world warning decisions. It must not be used as an operational forecast until verified source and observation feeds are connected and validated.

## Learning approach

Production training is designed as a supervised contextual error model. The learner predicts source-specific expected absolute error from lead time, location, month, regime, variable and source identity. Predicted error is converted to trust weights and combined with calibration constraints.

## Evaluation

Use temporally held-out hindcasts and event-based holdouts. Never randomly split adjacent forecast cycles when leakage can occur.

Recommended metrics:

- deterministic: MAE, RMSE, bias, correlation
- precipitation/hazard: CSI, ETS, POD, FAR, FSS
- probabilistic: Brier score, CRPS, reliability, sharpness

## Known limitations

- Synthetic mode does not prove improvement.
- A learned blending model can inherit systematic biases from its training sources.
- Extremes require event-aware validation because average error can hide tail failures.
- Calibration must be monitored after source-model upgrades.
