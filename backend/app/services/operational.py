from datetime import datetime, timezone
from .fusion import fuse

def cycle_status():
    return {
        "cycle":"demo-00Z",
        "status":"ready",
        "steps":[
            {"id":"ingest","label":"Ingest model runs","status":"ready"},
            {"id":"qc","label":"Quality control / harmonization","status":"ready"},
            {"id":"context","label":"Detect regime + lookup skill","status":"ready"},
            {"id":"blend","label":"Contextual fusion","status":"ready"},
            {"id":"risk","label":"Uncertainty + hazard guidance","status":"ready"},
            {"id":"verify","label":"Verify against observations","status":"adapter-ready"},
            {"id":"promote","label":"Champion / challenger update","status":"adapter-ready"},
        ],
        "generated_at":datetime.now(timezone.utc).isoformat(),
    }

def hazard_bundle(lat:float,lon:float,lead:int):
    rain=fuse(lat,lon,lead,"rainfall")
    temp=fuse(lat,lon,lead,"temperature")
    wind=fuse(lat,lon,lead,"wind")
    return [
        {"hazard":"HEAVY_RAIN","probability":rain.hazard_probability,"basis":"rainfall threshold + ensemble spread","value":rain.value},
        {"hazard":"HEAT_STRESS","probability":temp.hazard_probability,"basis":"temperature threshold + ensemble spread","value":temp.value},
        {"hazard":"HIGH_WIND","probability":wind.hazard_probability,"basis":"wind threshold + ensemble spread","value":wind.value},
    ]
