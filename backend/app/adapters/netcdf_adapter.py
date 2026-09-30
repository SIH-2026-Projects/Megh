import xarray as xr

def open_netcdf(path: str):
    return xr.open_dataset(path)
