# MEGH Flagship Rework

This version is a full frontend/interaction rework while preserving the existing FastAPI fusion backend and API contract.

## What changed

- Rebuilt the operations console around a map-first forecast workflow.
- Reworked the decision trace into a compact scientific inspection panel.
- Added explicit confidence, disagreement, hazard, regime and model-contribution surfaces.
- Reworked Model Trust, Verification and Replay into dedicated evidence workspaces.
- Removed the previous remote India GeoJSON runtime dependency.
- Replaced the remote MapLibre style dependency with a local MapLibre style using OSM raster tiles.
- Added a deterministic MapLibre v6 worker-copy lifecycle for both `npm run dev` and `npm run build`.
- Added clearer map failure states so a basemap failure does not masquerade as a forecast failure.
- Added map fit/zoom controls and geographic domain constraints.
- Added typed hazards, replay frames, cycle status and model-skill API contracts.
- Added `top_model` and `top_weight` to the forecast API response.
- Removed misleading client-side fabricated forecast-evolution values.
- Preserved the demo-data disclaimer throughout the UI and documentation.

## Validation

Backend test suite: **9 passed**.

The frontend dependencies were not installed in the build environment used to package this archive, so a local Vite production build still needs to be run after `npm install` on the target machine.
