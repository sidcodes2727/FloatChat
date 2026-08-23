import React, { useState, useEffect } from 'react';
import Map from 'react-map-gl/maplibre';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer } from '@deck.gl/layers';
import { ArrowLeft, Layers } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import { API_BASE } from '../config';
import 'maplibre-gl/dist/maplibre-gl.css';

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json';

const INITIAL_VIEW_STATE = {
  longitude: 80,
  latitude: 22,
  zoom: 4,
  pitch: 0,
  bearing: 0,
};

// Provide sensible fallback points with valid coordinates (near India)
const fallbackData = [
  { id: 1, depth: 10, pressure: 5, temperature: 20, latitude: 19.0, longitude: 72.8 },
  { id: 2, depth: 20, pressure: 10, temperature: 25, latitude: 13.0, longitude: 80.3 },
  { id: 3, depth: 15, pressure: 7, temperature: 30, latitude: 22.6, longitude: 88.4 },
];

export default function OceanMap({ setActivePage, onMapClick }) {
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [data, setData] = useState([]);
  const [hoverInfo, setHoverInfo] = useState(null); // {x,y,coordinate,object}
  const [selectedYear, setSelectedYear] = useState('All');
  const [availableYears, setAvailableYears] = useState([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`${API_BASE}/depth`);
        const rawData = await response.json();

        console.log('Fetched data sample:', rawData[0]);

        if (rawData.length && rawData[0].latitude != null && rawData[0].longitude != null) {
          const cleaned = rawData
            .filter(
              (d) =>
                d.latitude != null &&
                d.longitude != null &&
                Math.abs(d.latitude) <= 90 &&
                Math.abs(d.longitude) <= 360 &&
                Number.isFinite(Number(d.depth))
            )
            .map((d) => ({
              ...d,
              longitude: d.longitude > 180 ? d.longitude - 360 : d.longitude,
              year: d.year != null ? Number(d.year) : null,
            }));

          if (cleaned.length) {
            const avgLat =
              cleaned.reduce((sum, d) => sum + d.latitude, 0) / cleaned.length;
            const avgLon =
              cleaned.reduce((sum, d) => sum + d.longitude, 0) / cleaned.length;
            setViewState((v) => ({
              ...v,
              latitude: avgLat,
              longitude: avgLon,
              zoom: 6,
            }));
          }
          setData(cleaned);
          const years = [...new Set(cleaned.map(d => d.year).filter(y => y != null))].sort((a, b) => b - a);
          setAvailableYears(years);
        } else {
          setData(fallbackData);
        }
      } catch (e) {
        console.error('Error fetching data:', e);
        setData(fallbackData);
      }
    }
    fetchData();
  }, []);

  const filteredData = selectedYear === 'All' 
    ? data 
    : data.filter(d => d.year === selectedYear);

  // Ensure only valid points are passed to DeckGL to avoid runtime errors
  const safePoints = (filteredData || []).filter(
    (d) =>
      d &&
      Number.isFinite(Number(d.latitude)) &&
      Number.isFinite(Number(d.longitude)) &&
      Math.abs(Number(d.latitude)) <= 90 &&
      Math.abs(Number(d.longitude)) <= 180
  );

    const layers = [
    new ScatterplotLayer({
      id: 'depth-points',
      data: safePoints,
      pickable: true,
      stroked: true,
      filled: true,
      opacity: 0.8,
      radiusScale: 10,
      radiusMinPixels: 5,
      radiusMaxPixels: 50,
      getPosition: (d) => [d.longitude, d.latitude],
      getRadius: () => 6,
      getFillColor: (d) => {
        const z = Number(d.depth);
        if (!Number.isFinite(z)) return [150, 150, 150];
        const t = Math.max(0, Math.min(1, z / 5000));
        const r = 0;
        const g = Math.floor(200 - 120 * t);
        const b = Math.floor(255 - 80 * t);
        return [r, g, b];
      },
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
      }
    }),
  ];

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
      <button
        onClick={() => setActivePage('Home')}
        className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-3 py-1.5 glass-subtle rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/8 transition-all duration-200"
      >
        <ArrowLeft size={14} />
        Back
      </button>

      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value === 'All' ? 'All' : Number(e.target.value))}
          className="glass-subtle rounded-lg px-2 py-1.5 text-xs text-white/80 bg-transparent border-none outline-none cursor-pointer"
        >
          <option value="All" className="bg-[#040c1a]">All Years</option>
          {availableYears.map(year => (
            <option key={year} value={year} className="bg-[#040c1a]">{year}</option>
          ))}
        </select>
        <div className="glass-subtle rounded-lg px-3 py-1.5 flex items-center gap-1.5">
          <Layers size={12} className="text-[var(--accent)]" />
          <span className="text-xs text-white/60">{safePoints.length.toLocaleString()} points</span>
        </div>
      </div>

      <DeckGL
        viewState={viewState}
        controller={true}
        layers={layers}
        onViewStateChange={({ viewState }) => setViewState(viewState)}
      >
        <Map
          reuseMaps
          mapLib={maplibregl}
          mapStyle={MAP_STYLE}
          attributionControl={false}
        />
      </DeckGL>
      {safePoints.length === 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 glass-subtle text-white/60 px-3 py-1.5 rounded-lg text-xs">
          No points available to display.
        </div>
      )}
      {hoverInfo && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(Math.max(8, hoverInfo.x + 12), window.innerWidth - 240),
            top: Math.min(Math.max(8, hoverInfo.y + 12), window.innerHeight - 180)
          }}
          className="tooltip-card min-w-[160px]"
        >
          <div className="text-white/90 text-xs font-bold mb-2 border-b border-white/10 pb-1 flex justify-between">
            <span>Float Point</span>
            <span className="text-white/40">{hoverInfo.coordinate[1].toFixed(2)}°, {hoverInfo.coordinate[0].toFixed(2)}°</span>
          </div>
          {hoverInfo.object ? (
            <div>
               {hoverInfo.object.year && <div className="text-[10px] text-white/60 mb-1">Year: {hoverInfo.object.year}</div>}
               {renderMiniChart('Depth (m)', hoverInfo.object.depth, 2000, '#00d4ff')}
               {renderMiniChart('Temp (°C)', hoverInfo.object.temperature, 35, '#ff8a65')}
               {renderMiniChart('Salinity (PSU)', hoverInfo.object.salinity, 40, '#aed581')}
               <div className="text-[9px] text-white/40 mt-3 text-center italic">Click to analyze with AI</div>
            </div>
          ) : (
            <div className="text-white/40 text-xs">No point under cursor</div>
          )}
        </div>
      )}
    </div>
  );
}
