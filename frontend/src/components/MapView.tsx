import { useEffect, useRef, useState } from 'react';
import { Map as MapLibreMap, NavigationControl, Popup, setWorkerUrl, type GeoJSONSource, type MapMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { api, type GridResponse, type Mode, type PointForecast, type Variable } from '../lib/api';

setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');

type Props = { variable: Variable; lead: number; mode: Mode; focus?: { lat: number; lon: number } | null; onSelect: (point: PointForecast) => void; model?: string };
const INDIA_BOUNDS: [[number, number], [number, number]] = [[68.2, 6.0], [97.9, 37.4]];
const INDIA_CENTER: [number, number] = [79.2, 22.5];
const MAP_STYLE = {
  version: 8,
  sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap contributors', maxzoom: 19 } },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#e8efed' } },
    { id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-opacity': 0.82, 'raster-saturation': -0.55, 'raster-contrast': -0.08 } },
  ],
} as any;

function colorExpression(mode: Mode, variable: Variable): any[] {
  if (mode === 'confidence') return ['interpolate', ['linear'], ['get', 'confidence'], 0.2, '#b81920', 0.5, '#d08a00', 0.75, '#5e9f8d', 0.95, '#0f62fe'];
  if (mode === 'disagreement') return ['interpolate', ['linear'], ['get', 'disagreement'], 0, '#0f62fe', 0.25, '#8a3ffc', 0.55, '#da1e28', 1, '#750e13'];
  if (mode === 'hazard') return ['interpolate', ['linear'], ['get', 'hazard_probability'], 0, '#198038', 0.35, '#f1c21b', 0.65, '#da1e28', 0.9, '#750e13'];
  if (mode === 'model') return ['interpolate', ['linear'], ['get', 'value'], 0, '#edf5ff', 20, '#78a9ff', 60, '#4589ff', 100, '#0f62fe', 160, '#002d9c'];
  if (variable === 'temperature') return ['interpolate', ['linear'], ['get', 'value'], 15, '#0f62fe', 25, '#78a9ff', 32, '#f1c21b', 40, '#da1e28', 48, '#750e13'];
  if (variable === 'wind') return ['interpolate', ['linear'], ['get', 'value'], 0, '#edf5ff', 15, '#78a9ff', 30, '#4589ff', 50, '#da1e28', 70, '#750e13'];
  return ['interpolate', ['linear'], ['get', 'value'], 0, '#edf5ff', 10, '#a6c8ff', 30, '#4589ff', 60, '#f1c21b', 100, '#da1e28', 160, '#750e13'];
}
function heatWeight(mode: Mode): any[] {
  if (mode === 'hazard') return ['interpolate', ['linear'], ['get', 'hazard_probability'], 0, 0, 1, 1];
  if (mode === 'confidence') return ['interpolate', ['linear'], ['get', 'confidence'], 0, 1, 1, 0];
  if (mode === 'disagreement') return ['interpolate', ['linear'], ['get', 'disagreement'], 0, 0, 1, 1];
  return ['interpolate', ['linear'], ['get', 'value'], 0, 0, 40, 0.35, 100, 0.8, 180, 1];
}
function parsePoint(props: any): PointForecast {
  return { ...props, latitude: Number(props.latitude), longitude: Number(props.longitude), value: Number(props.value), lower: Number(props.lower), upper: Number(props.upper), confidence: Number(props.confidence), disagreement: Number(props.disagreement), hazard_probability: Number(props.hazard_probability), contributions: typeof props.contributions === 'string' ? JSON.parse(props.contributions) : props.contributions };
}
function popupMarkup(point: PointForecast, variable: Variable, mode: Mode, model?: string) {
  const unit = variable === 'rainfall' ? 'mm' : variable === 'temperature' ? '°C' : 'km/h';
  const label = mode === 'model' ? `${model ?? 'SOURCE'} FIELD` : mode.toUpperCase();
  return `<div class="map-popup"><div class="map-popup-kicker">MEGH · ${label}</div><strong>${point.value.toFixed(1)} ${unit}</strong><span>${point.latitude.toFixed(2)}°N · ${point.longitude.toFixed(2)}°E</span><small>${String(point.regime).replaceAll('_', ' ')} · ${Math.round(point.confidence * 100)}% confidence</small></div>`;
}

export function MapView({ variable, lead, mode, model, focus, onSelect }: Props) {
  const node = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const [grid, setGrid] = useState<GridResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [baseMapError, setBaseMapError] = useState(false);

  useEffect(() => {
    if (!node.current) return;
    const map = new MapLibreMap({ container: node.current, style: MAP_STYLE, center: INDIA_CENTER, zoom: 4.35, minZoom: 3.2, maxZoom: 10, maxBounds: [[60, 0], [106, 43]], attributionControl: true, renderWorldCopies: false, cooperativeGestures: true });
    map.addControl(new NavigationControl({ showCompass: true, visualizePitch: false }), 'top-right');
    mapRef.current = map;
    const onError = (event: any) => {
      const message = String(event?.error?.message || event?.error || '');
      if (/tile|openstreetmap|source/i.test(message)) setBaseMapError(true);
      if (/worker/i.test(message)) setError('Map worker failed. Restart Vite to refresh the local worker.');
    };
    map.on('error', onError);
    map.on('load', () => {
      map.addSource('forecast-grid', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } as any });
      map.addLayer({ id: 'forecast-heat', type: 'heatmap', source: 'forecast-grid', paint: { 'heatmap-weight': heatWeight(mode), 'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 3, 0.7, 6, 1.05, 9, 1.35], 'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 3, 18, 5, 29, 8, 40], 'heatmap-opacity': 0.68, 'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,0,0,0)', 0.18, '#edf5ff', 0.4, '#78a9ff', 0.66, '#f1c21b', 0.84, '#da1e28', 1, '#750e13'] } });
      map.addLayer({ id: 'forecast-points', type: 'circle', source: 'forecast-grid', minzoom: 5.0, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 3.1, 7, 5.6, 9, 8], 'circle-color': colorExpression(mode, variable), 'circle-opacity': 0.86, 'circle-stroke-color': '#ffffff', 'circle-stroke-opacity': 0.72, 'circle-stroke-width': 0.65 } });
      map.on('mouseenter', 'forecast-points', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'forecast-points', () => { map.getCanvas().style.cursor = ''; });
      map.on('click', 'forecast-points', (event: MapMouseEvent) => {
        const feature = event.features?.[0];
        if (!feature?.properties) return;
        const point = parsePoint(feature.properties);
        popupRef.current?.remove();
        popupRef.current = new Popup({ closeButton: false, offset: 11, maxWidth: '240px' }).setLngLat(event.lngLat).setHTML(popupMarkup(point, variable, mode, model)).addTo(map);
        onSelect(point);
      });
      setMapReady(true);
    });
    return () => { popupRef.current?.remove(); map.off('error', onError); map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    let live = true;
    setLoading(true); setError('');
    api.grid(variable, lead, mode === 'model' ? model : undefined)
      .then((data) => { if (live) setGrid(data); })
      .catch((e) => { if (live) setError(e instanceof Error ? e.message : 'Forecast field unavailable'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [variable, lead, mode, model]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !grid) return;
    const source = map.getSource('forecast-grid') as GeoJSONSource | undefined;
    source?.setData(grid as any);
    if (map.getLayer('forecast-points')) map.setPaintProperty('forecast-points', 'circle-color', colorExpression(mode, variable) as any);
    if (map.getLayer('forecast-heat')) map.setPaintProperty('forecast-heat', 'heatmap-weight', heatWeight(mode) as any);
  }, [grid, mapReady, mode, variable]);

  useEffect(() => { if (focus && mapRef.current && mapReady) mapRef.current.easeTo({ center: [focus.lon, focus.lat], zoom: Math.max(mapRef.current.getZoom(), 5.8), duration: 500, essential: true }); }, [focus, mapReady]);

  const resetView = () => mapRef.current?.fitBounds(INDIA_BOUNDS, { padding: 70, duration: 500 });
  const zoomIn = () => mapRef.current?.zoomIn({ duration: 180 });
  const zoomOut = () => mapRef.current?.zoomOut({ duration: 180 });

  return <div className="map-shell">
    <div ref={node} className="map-canvas" />
    <div className="map-status map-status-left"><span className="status-dot" />{loading ? 'UPDATING FIELD' : mapReady ? `${grid?.features.length ?? 0} GRID CELLS` : 'INITIALIZING MAP'}<em>· 1.25°</em></div>
    <div className="map-status map-status-bottom"><b>INDIA DOMAIN</b><span>69°–97°E</span><span>8°–36°N</span></div>
    <div className="map-tools" aria-label="Map controls"><button onClick={zoomIn} title="Zoom in">+</button><button onClick={zoomOut} title="Zoom out">−</button><button onClick={resetView} title="Fit India domain">⌂</button></div>
    {mode === 'model' && <div className="map-layer-badge">SOURCE · {model}</div>}
    {baseMapError && <div className="map-notice">Basemap unavailable · forecast field remains interactive</div>}
    {error && <div className="map-error">{error}</div>}
  </div>;
}
