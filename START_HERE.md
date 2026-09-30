# MEGH — Start Here

## Windows, without PowerShell activation

### Terminal 1

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

Expected test result:

```text
9 passed
```

API docs: http://127.0.0.1:8000/docs

### Terminal 2

```powershell
cd frontend
npm install
npm run dev
```

Open: http://localhost:5173

## What should work

- Forecast / Models / Verification / Replay navigation
- Variable switching: rainfall / temperature / wind
- Lead-time switching: 24–120h
- Map layer switching
- Map pan / zoom
- Clicking geographic forecast cells
- Contextual model contribution inspection
- Confidence / disagreement / hazard views
- Verification benchmark view
- Forecast replay and autopsy
- API health / refresh / recompute

## MapLibre worker setup

The frontend uses MapLibre GL JS 6 with a self-hosted worker. `npm run dev` and `npm run build` automatically copy the matching worker and shared module from `node_modules/maplibre-gl/dist/` into `frontend/public/maplibre/`.

If you previously ran an older MEGH version, stop Vite, remove `frontend/node_modules/.vite`, then run `npm run dev` again.

The basemap uses OpenStreetMap raster tiles through a local MapLibre style. If those tiles are unavailable, the forecast field itself remains a separate interactive layer.

## Data honesty rule

The demo values are synthetic calibration values. Do not present them as NCMRWF/IMD/ECMWF measurements or as proven skill improvements. The production adapter and training paths are included so real hindcasts and observations can replace them.
