# MEGH Architecture

```text
              FORECAST SOURCES
  ┌────────┬────────┬────────┬────────┬─────────┐
  │ ECMWF  │  AIFS  │  NCUM  │  GFS   │GraphCast│
  └───┬────┴───┬────┴───┬────┴───┬────┴────┬────┘
      │        │        │        │         │
      └────────┴────────┴────────┴─────────┘
                         ↓
              SOURCE ADAPTER LAYER
             GRIB2 / NetCDF / CSV / Zarr
                         ↓
             SCHEMA + QC + HARMONIZE
                         ↓
        ┌────────────────┴────────────────┐
        │                                 │
   OBSERVATION STORE                 FEATURE STORE
        │                                 │
        └──────────────┬──────────────────┘
                       ↓
             CONTEXT / REGIME ENGINE
                       ↓
                 SKILL CUBE
     model × region × lead × season × regime × variable
                       ↓
              CONTEXTUAL ROUTER
                       ↓
          BIAS / CALIBRATION LAYER
                       ↓
        ┌──────────────┴──────────────┐
        │                             │
   BLENDED VALUE                MODEL WEIGHTS
        │                             │
        └──────────────┬──────────────┘
                       ↓
             UNCERTAINTY ENGINE
        spread / disagreement / confidence
                       ↓
              EXTREME EVENT LAYER
       threshold probability / risk flags
                       ↓
                MEGH API / GIS
                       ↓
          FORECAST OPS CONSOLE
                       ↓
                 VERIFICATION
                       ↓
             MODEL HEALTH UPDATE
                       ↓
              CHAMPION / CHALLENGER
```

## Core fusion equation

For location x, variable v, lead t and regime r:

`F_MEHG(x,t,v) = Σ_m w_m(x,t,v,r,s) · Calibrate(F_m(x,t,v))`

Weights are normalized from historical skill, regime affinity, lead-time decay and an outlier penalty. Production training should replace the calibration priors with out-of-sample hindcast statistics.

## Verification hierarchy

1. climatology
2. best individual model
3. simple arithmetic MME
4. static skill-weighted MME
5. MEGH contextual fusion

Recommended metrics: RMSE/MAE/Bias/correlation; CSI/ETS/POD/FAR/FSS for hazards; Brier score/CRPS/reliability for probabilistic output.
