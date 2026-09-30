# MEGH Frontend Rework

## What changed

The frontend was reworked around an IBM Carbon-inspired scientific operations console rather than a generic dashboard.

### Forecast workspace
- Large India forecast map is now the dominant surface.
- Variable selector: rainfall / temperature / wind.
- Lead selector: 24 / 48 / 72 / 96 / 120h.
- Source view selector: ECMWF / AIFS / NCUM / GFS / GraphCast.
- Map layer selector: MEGH blend / model trust / confidence / disagreement / hazard probability.
- Location focus selector.
- Map cells are clickable.
- Clicking a cell opens the decision trace and requests the `/weights` endpoint for the selected location.
- Hazard signals are loaded from `/hazards`.
- Model contributions, confidence, disagreement and regime are shown from the backend response.
- Recalculate and refresh-cycle actions are connected to the forecast API.

### Model trust workspace
- `/models/skill` is connected.
- `/sources` is connected.
- Source catalog shows forecast families, formats, refresh expectations and adapter status.
- Skill cube is exposed by model and weather regime.

### Verification workspace
- `/verification` is connected.
- Demo/scaffold data is visibly labelled as non-operational.
- Baselines and event cases are displayed as evidence, not as hidden dashboard KPIs.

### Replay workspace
- `/replay` is connected.
- Lead-time frames can be selected.
- Source weights, confidence, disagreement and hazard signal are inspectable.
- `/autopsy` is connected through the forecast-autopsy action.

## Backend addition

`GET /forecast/grid` now accepts an optional `model` query parameter. When the map is in `Model trust` mode, the grid is generated using the selected source forecast instead of the MEGH blended value. This makes the source-view control functional rather than decorative.

## Design direction

The visual system follows IBM Carbon principles:
- square/near-square controls
- 8px-style spacing rhythm
- restrained borders
- high information density
- clear hierarchy
- blue interaction accent
- black/white/gray base palette
- minimal shadows
- no glassmorphism
- no neon AI styling
- no decorative dashboard gauges

## Data honesty

The current backend remains `DEMO_SYNTHETIC_CALIBRATION`. The frontend explicitly labels this state and the verification workspace warns that demo hindcast values are not operational benchmark results.

The architecture is still wired to the real-data boundaries: source adapters, normalized forecast contract, fusion, verification, replay and downstream hazard products.

## Validation performed

- Backend Python compilation passed.
- Existing backend pytest suite: 9 passed.
- API smoke-tested: health, sources, grid, weights, verification, replay and autopsy all returned HTTP 200.

The frontend dependency installation/build could not be completed in the execution environment because npm dependency installation timed out; the repository itself remains dependency-clean and contains no generated `node_modules` directory.
