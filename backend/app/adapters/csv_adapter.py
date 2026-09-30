import pandas as pd
REQUIRED = {"model","valid_time","lead_hours","variable","latitude","longitude","value"}

def read_forecast_csv(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    missing = REQUIRED - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {sorted(missing)}")
    return df
