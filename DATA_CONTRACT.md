# MEGH Data Contract

The fusion engine is deliberately model-agnostic. Every source is normalized to the following logical record.

```json
{
  "model": "ECMWF",
  "run_time": "2026-09-27T00:00:00Z",
  "valid_time": "2026-09-29T00:00:00Z",
  "lead_hours": 48,
  "variable": "rainfall",
  "latitude": 19.0,
  "longitude": 73.0,
  "value": 84.2,
  "unit": "mm",
  "member": null,
  "source_uri": "...",
  "checksum": "..."
}
```

## Required quality checks

- coordinate range and monotonicity
- unit normalization
- duplicate run/member detection
- valid-time consistency
- missing-value mask
- spatial grid alignment
- source timestamp freshness
- physical range checks
- ensemble member completeness where applicable

## Real-data adapters

- GRIB2 via `xarray + cfgrib` in a production environment
- NetCDF via `xarray + netCDF4`
- CSV for station/hindcast exchange
- Zarr is the recommended cloud/object-store target for large analysis-ready archives
