from pydantic import BaseModel
import os

class Settings(BaseModel):
    app_name: str = "MEGH Forecast Intelligence Platform"
    version: str = "1.0.0"
    api_prefix: str = "/api/v1"
    demo_mode: bool = os.getenv("MEGH_DEMO_MODE", "true").lower() == "true"
    api_key: str | None = os.getenv("MEGH_API_KEY") or None
    allowed_origins: str = os.getenv("MEGH_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    data_dir: str = os.getenv("MEGH_DATA_DIR", "./data")

settings = Settings()
