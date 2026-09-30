from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.config import settings
from .core.observability import request_context
from .api.routes import router

app = FastAPI(title=settings.app_name, version=settings.version, docs_url="/docs", redoc_url="/redoc")
app.state.settings = settings
origins=[x.strip() for x in settings.allowed_origins.split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.middleware("http")(request_context)
app.include_router(router, prefix=settings.api_prefix)

@app.get("/")
def root():
    return {"service":"MEGH","api":"/api/v1","docs":"/docs","status":"operational"}
