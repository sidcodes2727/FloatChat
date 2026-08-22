import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Play, Pause } from 'lucide-react';
import Map from 'react-map-gl/maplibre';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer, GeoJsonLayer } from '@deck.gl/layers';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';
import maplibregl from 'maplibre-gl';
import { API_BASE } from '../config';

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json';

const INITIAL_VIEW_STATE = { longitude: 0, latitude: 0, zoom: 2, pitch: 0, bearing: 0 };


const LAND_GEOJSON_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson';

// Palette Colors RGB
// Deep Navy: 9, 21, 64
// Royal Blue: 27, 44, 193
// Periwinkle Blue: 118, 146, 255
// Light Ocean Blue: 171, 210, 250

function getColor(value, metric) {
  if (!Number.isFinite(value)) value = 0;
  
  // Custom interpolation between our precise colors:
  // Deep Navy -> Royal Blue -> Periwinkle Blue -> Light Ocean Blue
  const STOPS = [
    [9, 21, 64],
    [27, 44, 193],
    [118, 146, 255],
    [171, 210, 250],
  ];
  
  let t = 0;
  switch (metric) {
    case 'salinity':
      // 30-38 PSU
      t = Math.max(0, Math.min(1, (value - 30) / 8));
      break;
    case 'temperature':
      // 0-30C
      t = Math.max(0, Math.min(1, value / 30));
      break;
    case 'pressure':
      // 0-1000 dbar
      t = Math.max(0, Math.min(1, value / 1000));
      break;
    default:
      t = 0;
  }

  // Linear interpolation across the 4 color stops
  const segments = STOPS.length - 1;
  const scaledT = t * segments;
  const index = Math.floor(scaledT);
  const frac = scaledT - index;

  if (index >= segments) return STOPS[segments];
  if (index < 0) return STOPS[0];

  const c1 = STOPS[index];
  const c2 = STOPS[index + 1];

  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * frac),
    Math.round(c1[1] + (c2[1] - c1[1]) * frac),
    Math.round(c1[2] + (c2[2] - c1[2]) * frac)
  ];
}

// Legend specification per metric
function getLegendSpec(metric) {
  switch (metric) {
    case 'salinity':
      return { min: 30, max: 38, unit: 'PSU', label: 'Salinity' };
    case 'temperature':
      return { min: 0, max: 30, unit: '°C', label: 'Temperature' };
    case 'pressure':
      return { min: 0, max: 1000, unit: 'dbar', label: 'Pressure' };
    default:
      return { min: 0, max: 1, unit: '', label: metric };
  }
}

function toRgb(c) {
  const [r, g, b] = c;
  return `rgb(${r}, ${g}, ${b})`;
}

export default function MetricMap({ metric = 'salinity', onMapClick }) {
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [hoverInfo, setHoverInfo] = useState(null); // {x,y,coordinate,object}
  const [land, setLand] = useState(null); // Natural Earth land polygons

  // Time Series State
  const [timeRange, setTimeRange] = useState(null);
  const [currentTime, setCurrentTime] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setError(null);
        const res = await fetch(`${API_BASE}/${metric}`);
        const data = await res.json();
        const cleaned = (Array.isArray(data) ? data : []).filter(
          d => d.latitude != null && d.longitude != null && Math.abs(d.latitude) <= 90 && Math.abs(d.longitude) <= 360
        ).map(d => ({
          ...d,
          parsedTime: d.time_ts ? new Date(d.time_ts).getTime() : 0
        }));
        setRows(cleaned);
        if (cleaned.length) {
          const times = cleaned.map(d => d.parsedTime).filter(t => t > 0);
          if (times.length > 0) {
            const min = Math.min(...times);
            const max = Math.max(...times);
            setTimeRange([min, max]);
            setCurrentTime(max);
          }
          const avgLat = cleaned.reduce((s, d) => s + Number(d.latitude), 0) / cleaned.length;
          const avgLon = cleaned.reduce((s, d) => s + (Number(d.longitude) > 180 ? Number(d.longitude) - 360 : Number(d.longitude)), 0) / cleaned.length;
          setViewState(v => ({ ...v, latitude: avgLat, longitude: avgLon, zoom: 3 }));
        }
      } catch (e) {
        setError(e.message || 'Failed to load');
      }
    }
    load();
  }, [metric]);

  // Load land polygons once for masking by overdrawing
  useEffect(() => {
    let cancelled = false;
    async function loadLand() {
      try {
        const resp = await fetch(LAND_GEOJSON_URL);
        if (!resp.ok) return;
        const gj = await resp.json();
        if (!cancelled) setLand(gj);
      } catch (_) {}
    }
    loadLand();
    return () => { cancelled = true; };
  }, []);

  const filteredRows = useMemo(() => {
    if (!currentTime || !timeRange) return rows;
    // 1 year time window (in milliseconds) so older points fade away
    const TIME_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;
    return rows.filter(r => r.parsedTime <= currentTime && r.parsedTime > (currentTime - TIME_WINDOW_MS));
  }, [rows, currentTime, timeRange]);

  useEffect(() => {
    let animationFrame;
    if (isPlaying && timeRange) {
      let lastTime = Date.now();
      const animate = () => {
        const now = Date.now();
        const dt = now - lastTime;
        lastTime = now;
        
        // Advance by ~5% of the total time range every second
        const totalDuration = timeRange[1] - timeRange[0];
        const step = totalDuration * 0.05 * (dt / 1000); 
        
        setCurrentTime(prev => {
          let next = prev + step;
          if (next > timeRange[1]) next = timeRange[0]; // loop back to start
          return next;
        });
        animationFrame = requestAnimationFrame(animate);
      };
      animationFrame = requestAnimationFrame(animate);
    }
    return () => cancelAnimationFrame(animationFrame);
  }, [isPlaying, timeRange]);

  // Unified color scale for heatmaps
  const SCIENTIFIC_RANGE = useMemo(() => ([
    [9, 21, 64, 255],     // Deep Navy
    [15, 30, 110, 255],   // Transition
    [27, 44, 193, 255],   // Royal Blue
    [65, 80, 210, 255],   // Transition
    [118, 146, 255, 255], // Periwinkle Blue
    [145, 175, 252, 255], // Transition
    [171, 210, 250, 255], // Light Ocean Blue
  ]), []);

  // Heatmap layer for continuous surface
  const heatmapLayer = useMemo(() => new HeatmapLayer({
    id: `${metric}-heat`,
    data: filteredRows,
    getPosition: (d) => [Number(d.longitude) > 180 ? Number(d.longitude) - 360 : Number(d.longitude), Number(d.latitude)],
    getWeight: (d) => {
      const raw = d[metric] ?? d.value;
      const v = Number.isFinite(Number(raw)) ? Number(raw) : 0;
      // Normalize per metric range to keep brightness comparable
      const spec = getLegendSpec(metric);
      const t = Math.max(0, Math.min(1, (v - spec.min) / (spec.max - spec.min || 1)));
      return 1 + t; // emphasize higher values slightly
    },
    radiusPixels: Math.max(18, Math.min(90, Math.round(18 * (viewState?.zoom || 2)))),
    intensity: 1.0,
    threshold: 0.05,
    colorRange: SCIENTIFIC_RANGE,
    weightsTextureSize: 512,
  }), [filteredRows, metric, viewState, SCIENTIFIC_RANGE]);

  // White dot markers for actual coordinates
  const pointsLayer = useMemo(() => new ScatterplotLayer({
    id: `${metric}-points`,
    data: filteredRows,
    pickable: true,
    opacity: 0.95,
    radiusScale: 10,
    radiusMinPixels: 2,
    radiusMaxPixels: 30,
    getPosition: (d) => [Number(d.longitude) > 180 ? Number(d.longitude) - 360 : Number(d.longitude), Number(d.latitude)],
    getRadius: () => 4,
    getFillColor: [171, 210, 250],
    getLineColor: [255, 255, 255],
    lineWidthUnits: 'pixels',
    stroked: true,
    lineWidthMinPixels: 0.5,
    onHover: (info) => {
      if (!info || !info.coordinate || !info.object) {
        setHoverInfo(null);
        return;
      }
      setHoverInfo({ x: info.x, y: info.y, coordinate: info.coordinate, object: info.object });
    },
    onClick: (info) => {
      if (info && info.coordinate && onMapClick) {
         onMapClick(info.coordinate[1], info.coordinate[0]);
      }
    },
  }), [filteredRows, metric, onMapClick]);

  // Land mask layer (overdraw on top to hide heat on land)
  const landMask = useMemo(() => {
    if (!land) return null;
    return new GeoJsonLayer({
      id: 'land-mask',
      data: land,
      stroked: false,
      filled: true,
      getFillColor: [9, 21, 64, 255], // Deep Navy land
      parameters: { depthTest: false },
      pickable: false,
    });
  }, [land]);

  // Legend gradient background computed from getColor mapping
  const legend = useMemo(() => {
    const spec = getLegendSpec(metric);
    const steps = 12; // number of color stops
    const stops = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const value = spec.min + t * (spec.max - spec.min);
      const color = toRgb(getColor(value, metric));
      const pct = Math.round(t * 100);
      stops.push(`${color} ${pct}%`);
    }
    const gradient = `linear-gradient(90deg, ${stops.join(', ')})`;
    const mid = (spec.min + spec.max) / 2;
    return { ...spec, gradient, mid };
  }, [metric]);

  const renderMiniChart = (label, val, max, color) => {
      if (val == null) return null;
      const pct = Math.min(100, Math.max(0, (val / max) * 100));
      return (
         <div className="mt-2">
            <div className="flex justify-between text-[10px] text-muted-foreground mb-1 font-mono">
               <span className="uppercase tracking-widest">{label}</span>
               <span className="text-foreground font-semibold">{Number(val).toFixed(1)}</span>
            </div>
            <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
               <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
            </div>
         </div>
      );
  };

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <DeckGL
        initialViewState={viewState}
        controller
        layers={[heatmapLayer, pointsLayer, landMask].filter(Boolean)}
        onViewStateChange={({ viewState }) => setViewState(viewState)}
      >
        <Map mapLib={maplibregl} reuseMaps mapStyle={MAP_STYLE} attributionControl={false} {...viewState} />
      </DeckGL>
      {/* Time Slider UI */}
      {timeRange && (
        <div 
          style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', width: '80%', maxWidth: 600, zIndex: 10 }}
          className="bg-background/95 backdrop-blur-md border border-border rounded-xl p-4 flex flex-col gap-3 shadow-lg"
        >
          <div className="flex justify-between items-center px-1">
             <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-muted hover:bg-muted/80 text-foreground transition-colors cursor-pointer border border-border"
             >
                {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
             </button>
             <div className="text-foreground font-mono text-sm tracking-widest font-semibold">
                {new Date(currentTime).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
             </div>
          </div>
          <input 
             type="range" 
             min={timeRange[0]} 
             max={timeRange[1]} 
             value={currentTime} 
             onChange={(e) => { setCurrentTime(Number(e.target.value)); setIsPlaying(false); }}
             className="w-full h-2 bg-black/15 shadow-inner rounded-full appearance-none outline-none focus:ring-2 focus:ring-periwinkle cursor-pointer"
             style={{
                accentColor: 'var(--color-royal-blue)'
             }}
          />
        </div>
      )}

      {/* Color Legend */}
      <div
        style={{ position: 'absolute', left: 16, bottom: 24, width: 240 }}
        className="bg-background/95 backdrop-blur-md border border-border shadow-lg rounded-lg p-4"
      >
        <div className="flex items-center justify-between text-[11px] text-foreground font-bold mb-3 font-mono uppercase tracking-widest border-b border-border pb-2">
          <span>{legend.label}</span>
          <span className="text-muted-foreground">{legend.unit}</span>
        </div>
        <div className="h-2.5 w-full rounded-full overflow-hidden shadow-inner" style={{ background: legend.gradient }} />
        <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-2 font-mono">
          <span>{legend.min}</span>
          <span>{legend.mid}</span>
          <span>{legend.max}</span>
        </div>
      </div>
      
      {hoverInfo && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(Math.max(8, hoverInfo.x + 12), window.innerWidth - 240),
            top: Math.min(Math.max(8, hoverInfo.y + 12), window.innerHeight - 180),
          }}
          className="bg-background border border-border shadow-lg rounded-md p-4 min-w-[200px]"
        >
          <div className="text-foreground text-xs font-bold mb-3 border-b border-border pb-2 flex justify-between font-mono tracking-wider uppercase">
            <span>Float Point</span>
            <span className="text-muted-foreground">{hoverInfo.coordinate[1].toFixed(2)}°, {hoverInfo.coordinate[0].toFixed(2)}°</span>
          </div>
          {hoverInfo.object ? (
            <div>
               {renderMiniChart('Depth (m)', hoverInfo.object.depth, 2000, 'var(--color-light-ocean)')}
               {metric === 'temperature' && renderMiniChart('Temp (°C)', hoverInfo.object.temperature, 35, 'var(--color-periwinkle)')}
               {metric === 'salinity' && renderMiniChart('Salinity (PSU)', hoverInfo.object.salinity, 40, 'var(--color-royal-blue)')}
               {metric === 'pressure' && renderMiniChart('Pressure (dbar)', hoverInfo.object.pressure, 2000, 'var(--color-periwinkle)')}
               <div className="text-[10px] text-periwinkle mt-4 text-center font-sans opacity-80 bg-periwinkle/10 rounded py-1">Click to analyze with AI</div>
            </div>
          ) : (
            <div className="text-muted-foreground text-xs font-mono">No point under cursor</div>
          )}
        </div>
      )}
      
      {error && (
        <div style={{ position: 'absolute', top: 16, right: 16 }} className="bg-red-50 border border-red-200 shadow-md rounded-md px-4 py-2 text-red-600 text-xs font-mono">
          Failed to load {metric}: {error}
        </div>
      )}
    </div>
  );
}
