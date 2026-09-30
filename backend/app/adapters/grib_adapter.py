try:
    import xarray as xr
except Exception:
    xr = None

def open_grib(path: str):
    if xr is None:
        raise RuntimeError("xarray is required")
    return xr.open_dataset(path, engine="cfgrib")
