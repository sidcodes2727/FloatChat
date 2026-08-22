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


function getColor(value, metric) {
  if (!Number.isFinite(value)) value = 0;
  switch (metric) {
    case 'salinity': {
      // 30-38 PSU mapped to purple shades ending at #b103fc
      const t = Math.max(0, Math.min(1, (value - 30) / 8));
      const start = [220, 190, 255]; // light lavender
      const end = [177, 3, 252];     // #b103fc
      const r = Math.round(start[0] + (end[0] - start[0]) * t);
      const g = Math.round(start[1] + (end[1] - start[1]) * t);
      const b = Math.round(start[2] + (end[2] - start[2]) * t);
      return [r, g, b];
    }
    case 'temperature': {
      // 0-30C from blue to red
      const t = Math.max(0, Math.min(1, value / 30));
      const r = Math.floor(30 + 225 * t);
      const g = Math.floor(80 + 120 * t);
      const b = Math.floor(220 - 200 * t);
      return [r, g, b];
    }
    case 'pressure': {
      // 0-1000 dbar from teal to magenta
      const t = Math.max(0, Math.min(1, value / 1000));
      const r = Math.floor(20 + 235 * t);    // 20 -> 255
      const g = Math.floor(200 - 160 * t);   // 200 -> 40
      const b = Math.floor(180 + 60 * t);    // 180 -> 240
      return [r, g, b];
    }
    default:
      return [0, 200, 255];
  }
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

  // Build a robust 6-stop RGBA color range for the heatmap
  const heatColors = useMemo(() => {
    const spec = getLegendSpec(metric);
    const values = [
      spec.min,
      spec.min + (spec.max - spec.min) * 0.2,
      spec.min + (spec.max - spec.min) * 0.4,
      spec.min + (spec.max - spec.min) * 0.6,
      spec.min + (spec.max - spec.min) * 0.8,
      spec.max
    ];
    return values.map(v => {
      const [r, g, b] = getColor(v, metric);
      return [r, g, b, 255];
    });
  }, [metric]);

  // Temperature-like color range (blue -> red) for HeatmapLayer (RGBA)
  const TEMP_RANGE = useMemo(() => ([
    [30, 80, 220, 255],
    [60, 100, 200, 255],
    [90, 120, 180, 255],
    [130, 140, 150, 255],
    [170, 160, 120, 255],
    [200, 175, 90, 255],
    [230, 190, 60, 255],
    [255, 200, 20, 255]
  ]), []);

  // Salinity palette (teal -> cyan -> blue -> purple)
  const SALINITY_RANGE = useMemo(() => ([
    [240, 220, 255, 255], // very light lavender
    [230, 200, 255, 255],
    [215, 170, 255, 255],
    [200, 140, 255, 255],
    [190, 100, 255, 255],
    [183, 50, 253, 255],
    [177, 3, 252, 255]   // #b103fc
  ]), []);

  // Pressure palette (teal -> green -> yellow -> orange -> magenta)
  const PRESSURE_RANGE = useMemo(() => ([
    [20, 160, 180, 255],
    [40, 200, 140, 255],
    [180, 210, 60, 255],
    [230, 160, 40, 255],
    [240, 100, 80, 255],
    [250, 60, 160, 255]
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
    colorRange: metric === 'salinity' ? SALINITY_RANGE : metric === 'pressure' ? PRESSURE_RANGE : TEMP_RANGE,
    weightsTextureSize: 512,
  }), [filteredRows, metric, viewState, TEMP_RANGE, SALINITY_RANGE, PRESSURE_RANGE]);

  // Black dot markers for actual coordinates
  const pointsLayer = useMemo(() => new ScatterplotLayer({
    id: `${metric}-points`,
    data: filteredRows,
    pickable: true,
    opacity: 0.95,
    radiusScale: 10,
    radiusMinPixels: 3,
    radiusMaxPixels: 30,
    getPosition: (d) => [Number(d.longitude) > 180 ? Number(d.longitude) - 360 : Number(d.longitude), Number(d.latitude)],
    getRadius: () => 4,
    getFillColor: [0, 0, 0], // black dots
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
      getFillColor: [14, 18, 24, 255], // close to basemap land color
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
         <div className="mt-1.5">
            <div className="flex justify-between text-[10px] text-white/70 mb-0.5">
               <span>{label}</span>
               <span className="font-mono">{Number(val).toFixed(1)}</span>
            </div>
            <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden">
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
          style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', width: '80%', maxWidth: 600, zIndex: 10 }}
          className="glass-subtle rounded-xl p-3 px-5 flex flex-col gap-2 shadow-2xl"
        >
          <div className="flex justify-between items-center px-1">
             <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
             >
                {isPlaying ? <Pause size={14} className="text-white" /> : <Play size={14} className="ml-0.5 text-white" />}
             </button>
             <div className="text-white/90 font-mono text-sm tracking-wider font-semibold">
                {new Date(currentTime).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
             </div>
          </div>
          <input 
             type="range" 
             min={timeRange[0]} 
             max={timeRange[1]} 
             value={currentTime} 
             onChange={(e) => { setCurrentTime(Number(e.target.value)); setIsPlaying(false); }}
             className="w-full h-1.5 bg-white/20 rounded-full appearance-none outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
             style={{
                accentColor: '#00d4ff'
             }}
          />
        </div>
      )}

      {/* Color Legend */}
      <div
        style={{ position: 'absolute', left: 12, bottom: 12, width: 240 }}
        className="glass-subtle rounded-lg p-3"
      >
        <div className="flex items-center justify-between text-[11px] text-white/50 mb-2 font-medium">
          <span className="uppercase tracking-wider">{legend.label}</span>
          <span>{legend.unit}</span>
        </div>
        <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: legend.gradient }} />
        <div className="flex items-center justify-between text-[10px] text-white/40 mt-1.5">
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
            top: Math.min(Math.max(8, hoverInfo.y + 12), window.innerHeight - 150),
          }}
          className="tooltip-card min-w-[160px]"
        >
          <div className="text-white/90 text-xs font-bold mb-2 border-b border-white/10 pb-1 flex justify-between">
            <span>Float Point</span>
            <span className="text-white/40">{hoverInfo.coordinate[1].toFixed(2)}°, {hoverInfo.coordinate[0].toFixed(2)}°</span>
          </div>
          {hoverInfo.object ? (
            <div>
               {renderMiniChart('Depth (m)', hoverInfo.object.depth, 2000, '#00d4ff')}
               {metric === 'temperature' && renderMiniChart('Temp (°C)', hoverInfo.object.temperature, 35, '#ff8a65')}
               {metric === 'salinity' && renderMiniChart('Salinity (PSU)', hoverInfo.object.salinity, 40, '#aed581')}
               {metric === 'pressure' && renderMiniChart('Pressure (dbar)', hoverInfo.object.pressure, 2000, '#ba68c8')}
               <div className="text-[9px] text-white/40 mt-3 text-center italic">Click to analyze with AI</div>
            </div>
          ) : (
            <div className="text-white/40 text-xs">No point under cursor</div>
          )}
        </div>
      )}
      {error && (
        <div style={{ position: 'absolute', bottom: 12, right: 12 }} className="glass-subtle rounded-lg px-3 py-2 text-red-400/80 text-xs">
          Failed to load {metric}: {error}
        </div>
      )}
    </div>
  );
}
