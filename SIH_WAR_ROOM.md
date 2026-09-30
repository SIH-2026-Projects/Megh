# MEGH SIH War Room

## The one-line thesis

> MEGH is the intelligence layer that decides which forecast source deserves trust for this place, this lead time and this weather regime — and verifies whether that decision actually improved the forecast.

## Do not claim

- first dynamic weather-weighting system
- first AI weather model
- replacement for NCMRWF/IMD NWP
- real operational performance until verified data are ingested
- fabricated accuracy improvements

## Demo sequence

1. Open Forecast.
2. Select rainfall, +48h.
3. Show India-wide blended field.
4. Click a high-disagreement cell.
5. Show MEGH value, uncertainty and model weights.
6. Switch Map Layer to Model contribution.
7. Switch to Models and show regime-conditioned skill.
8. Open Verification and compare MEGH against simple MME.
9. Open Replay and run Autopsy.
10. Explain that the exact same interfaces accept real GRIB/NetCDF observations through the adapters.

## Jury questions to expect

### Why not a simple mean?
Because model skill is context dependent. MEGH changes trust using region, lead, variable and regime and penalizes current outliers.

### Why AI + NWP?
AI models and physics-based models have different strengths and operational constraints. The fusion layer does not assume either family is always superior.

### How do you prove improvement?
Use held-out hindcasts and compare climatology, best individual, simple MME, static skill weighting and MEGH using deterministic and probabilistic metrics.

### What happens when a new model arrives?
Implement an adapter to the common schema. The verification and skill pipeline can evaluate it without changing the fusion API.

### Is the demo data real?
No. The bundled mode is synthetic calibration data and is labelled as such. The production architecture is built to ingest verified operational sources.
