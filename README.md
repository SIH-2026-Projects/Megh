# MEGH — Adaptive Multi-Model Weather Intelligence

MEGH is a forecast-fusion platform for SIH 26081. It is designed as an operational intelligence layer rather than a consumer weather application.

## What it does

MEGH normalizes heterogeneous forecast sources and assigns context-dependent trust using:

- historical model skill
- geographic region
- lead time
- variable
- atmospheric regime
- recent model bias
- model disagreement / outlier behaviour

It produces a blended forecast, uncertainty, hazard probability, model contribution and an auditable decision trace. A verification workspace compares MEGH with simpler reference methods, while Replay and Autopsy expose forecast evolution and failure analysis.

## Repository

```text
MEGH/
├── backend/                 # FastAPI, fusion engine, adapters, tests
├── frontend/                # React + Vite + MapLibre operations console
├── scripts/                 # training and operational cycle entry points
├── artifacts/               # generated model artifacts / reports
├── .github/workflows/       # CI
├── ARCHITECTURE.md
├── DATA_CONTRACT.md
├── MODEL_CARD.md
├── DEPLOYMENT.md
├── SIH_WAR_ROOM.md
└── docker-compose.yml
```

## Local development

### API

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

### Web

In another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

The Vite dev server proxies `/api` to `http://127.0.0.1:8000`, so no frontend API URL is required for local use.

## Docker

```bash
docker compose up --build
```

Open `http://localhost:8080`.

The Nginx container serves the frontend and proxies `/api/*` to FastAPI. See `DEPLOYMENT.md`.

## Data honesty

The default engine is deterministic demo calibration data. It is intended to make the entire application executable without restricted meteorological feeds. It must not be presented as an operational ECMWF/NCMRWF/IMD forecast or as measured observations.

For deployment with real data, use the adapters and data contract, train on historical hindcasts, validate on a held-out period, and promote only verified models.
