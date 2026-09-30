from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from ..models.schemas import ForecastRequest, ForecastResponse
from ..services.fusion import fuse, grid_features, model_skill, replay
from ..services.data import metadata, sources, verification, DATA_MODE
from ..services.operational import cycle_status, hazard_bundle

router = APIRouter()

def _check_key(request: Request):
    # API key enforcement can be enabled in production through MEGH_API_KEY.
    settings = request.app.state.settings
    if settings.api_key:
        key = request.headers.get("x-megh-api-key")
        if key != settings.api_key:
            raise HTTPException(status_code=401, detail="Invalid MEGH API key")

@router.get("/health")
def health(request: Request):
    return {"status":"ok","service":"megh-api","version":"1.0.0","data_mode":DATA_MODE}

@router.get("/metadata")
def get_metadata(request: Request):
    _check_key(request); return metadata()

@router.get("/sources")
def get_sources(request: Request):
    _check_key(request); return sources()

@router.get("/models/skill")
def get_skill(variable: str = "rainfall"):
    if variable not in {"rainfall","temperature","wind"}: raise HTTPException(400,"Unsupported variable")
    return {"variable":variable,"data_mode":DATA_MODE,"models":model_skill(variable)}

@router.post("/forecast", response_model=ForecastResponse)
def forecast(req: ForecastRequest, request: Request):
    _check_key(request)
    r = fuse(req.latitude, req.longitude, req.lead_hours, req.variable, req.model)
    valid = datetime.now(timezone.utc) + timedelta(hours=req.lead_hours)
    top = max(r.contributions, key=lambda item: item["weight"])
    return {"variable":req.variable,"lead_hours":req.lead_hours,"valid_time":valid.isoformat(),
            "data_mode":DATA_MODE,"point":{"latitude":req.latitude,"longitude":req.longitude,**r.__dict__,"top_model":top["model"],"top_weight":top["weight"]},
            "methodology":["context-conditioned skill prior","regime affinity","lead-time penalty","outlier suppression","weighted ensemble spread"]}

@router.get("/forecast/grid")
def forecast_grid(variable: str="rainfall", lead_hours: int=48, step: float=1.25, model: str | None = None, request: Request=None):
    if variable not in {"rainfall","temperature","wind"}: raise HTTPException(400,"Unsupported variable")
    if step < .5 or step > 3: raise HTTPException(400,"step must be between 0.5 and 3 degrees")
    if request: _check_key(request)
    return {"type":"FeatureCollection","data_mode":DATA_MODE,"variable":variable,"lead_hours":lead_hours,
            "features":[{"type":"Feature","properties":p,"geometry":{"type":"Point","coordinates":[p["longitude"],p["latitude"]]}} for p in grid_features(variable,lead_hours,step,model)]}

@router.get("/operations/cycle")
def operations_cycle():
    return cycle_status()

@router.get("/hazards")
def hazards(latitude: float=20.6, longitude: float=78.9, lead_hours: int=48):
    return {"latitude":latitude,"longitude":longitude,"lead_hours":lead_hours,"data_mode":DATA_MODE,"hazards":hazard_bundle(latitude,longitude,lead_hours)}

@router.get("/weights")
def weights(latitude: float=20.6, longitude: float=78.9, lead_hours: int=48, variable: str="rainfall"):
    r=fuse(latitude,longitude,lead_hours,variable)
    return {"latitude":latitude,"longitude":longitude,"lead_hours":lead_hours,"variable":variable,
            "regime":r.regime,"confidence":r.confidence,"disagreement":r.disagreement,"contributors":r.contributions}

@router.get("/verification")
def verify(variable: str="rainfall"):
    return verification(variable)

@router.get("/replay")
def get_replay(event_id: str="west_monsoon_case", variable: str="rainfall"):
    return {"data_mode":DATA_MODE,"event_id":event_id,"variable":variable,"frames":replay(event_id,variable)}

@router.get("/autopsy")
def autopsy(variable: str="rainfall", event_id: str="west_monsoon_case"):
    r=replay(event_id,variable)
    final=r[-1]
    return {"data_mode":DATA_MODE,"event_id":event_id,"variable":variable,
            "summary":"Demo forecast autopsy: compare source spread and fusion evolution against an observation record when connected.",
            "final_frame":final,
            "checks":[
                {"name":"model disagreement","status":"review","value":final["disagreement"]},
                {"name":"confidence","status":"tracked","value":final["confidence"]},
                {"name":"outlier suppression","status":"enabled"},
                {"name":"observation verification","status":"adapter-ready"},
            ]}
