# Geographic data

MEGH uses MapLibre GL JS for the interactive geographic surface.

- Basemap: OpenStreetMap raster tiles, referenced by a local MapLibre style.
- Forecast field: GeoJSON returned by the MEGH API.
- No hand-drawn SVG projection is used.
- No external India-boundary GeoJSON is required by the map runtime.

The forecast field is demo calibration data in the current repository. Production deployments should replace the demo generator with harmonized NetCDF/GRIB/Zarr forecast data and authorized observation feeds.
