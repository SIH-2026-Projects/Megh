from __future__ import annotations
from datetime import datetime, timezone
from .fusion import MODELS, VARIABLES, model_skill

DATA_MODE = "DEMO_SYNTHETIC_CALIBRATION"

SOURCE_CATALOG = [
    {"name":"ECMWF", "family":"NWP", "format":"GRIB2", "status":"adapter-ready", "refresh":"6-hourly"},
    {"name":"AIFS", "family":"AI", "format":"GRIB2", "status":"adapter-ready", "refresh":"6-hourly"},
    {"name":"NCUM", "family":"NWP", "format":"GRIB2", "status":"adapter-ready", "refresh":"6-hourly"},
    {"name":"GFS", "family":"NWP", "format":"GRIB2", "status":"adapter-ready", "refresh":"6-hourly"},
    {"name":"GraphCast", "family":"AI", "format":"NetCDF/GRIB2", "status":"adapter-ready", "refresh":"run-dependent"},
    {"name":"Observations", "family":"Verification", "format":"NetCDF/CSV", "status":"adapter-ready", "refresh":"hourly/daily"},
]


def metadata():
    return {
        "product":"MEGH",
        "version":"1.0.0",
        "problem_statement":"SIH26081",
        "organization":"Ministry of Earth Sciences / NCMRWF",
        "data_mode": DATA_MODE,
        "models": MODELS,
        "variables": VARIABLES,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "disclaimer":"Demo values are deterministic synthetic calibration data. They are not operational forecasts or claimed benchmark results.",
    }


def sources(): return SOURCE_CATALOG

def verification(variable: str):
    # Reproducible benchmark scaffold; metrics are clearly labeled demo hindcast values.
    base = {
        "rainfall": [("Climatology", .91, .74), ("Best individual", .82, .69), ("Simple MME", .77, .66), ("Static skill weighted", .73, .64), ("MEGH contextual", .68, .61)],
        "temperature": [("Climatology", 2.8, .68), ("Best individual", 2.2, .74), ("Simple MME", 2.0, .76), ("Static skill weighted", 1.9, .77), ("MEGH contextual", 1.7, .80)],
        "wind": [("Climatology", 6.1, .62), ("Best individual", 4.8, .69), ("Simple MME", 4.5, .71), ("Static skill weighted", 4.2, .73), ("MEGH contextual", 3.9, .76)],
    }
    rows=[]
    for name, error, skill in base[variable]:
        rows.append({"method":name,"mae_or_rmse":error,"skill_score":skill})
    return {"data_mode":DATA_MODE,"variable":variable,"horizon_days":90,"methods":rows,
            "event_cases":[
                {"event":"Monsoon heavy-rain case","metric":"CSI","megh":.61,"simple_mme":.52,"note":"demo hindcast scaffold"},
                {"event":"Heat-stress case","metric":"Brier","megh":.14,"simple_mme":.19,"note":"demo hindcast scaffold"},
                {"event":"High-wind case","metric":"FSS","megh":.57,"simple_mme":.48,"note":"demo hindcast scaffold"},
            ]}
