# MEGH deployment

## Recommended production path

The repository is packaged as two containers:

- `api`: FastAPI / Python 3.10
- `web`: Nginx serving the Vite build and proxying `/api/*` to the API container

This keeps the browser on one origin and avoids CORS configuration in the deployed UI.

## Local production-like run

```bash
docker compose up --build
```

Open `http://localhost:8080`.

API health:

```text
http://localhost:8080/api/v1/health
```

Swagger:

```text
http://localhost:8080/docs
```

## Separate hosting

If the API and frontend are deployed separately, set `VITE_API_BASE` at frontend build time to the API's `/api/v1` URL. Keep `MEGH_ALLOWED_ORIGINS` on the API restricted to the deployed frontend origin.

## Production data

The repository intentionally ships a deterministic demo calibration engine so the application is runnable without proprietary weather feeds. For an operational deployment, connect the adapters under `backend/app/adapters/` to licensed or institutionally authorized forecast and observation feeds, persist normalized data, train the contextual error model on historical hindcasts, and verify on a held-out period before promotion.

Do not label demo values as ECMWF, NCMRWF, IMD or observed values.

## Map runtime

The frontend uses MapLibre GL JS 6. The build lifecycle copies both `maplibre-gl-worker.mjs` and `maplibre-gl-shared.mjs` into `public/maplibre/` before development/build, keeping the worker on the same origin as the application.

The default map style is local and references OpenStreetMap raster tiles. This removes the previous dependency on a remote style JSON and external India GeoJSON at runtime.
