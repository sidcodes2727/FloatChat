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
  longitude: 10,
  latitude: 15,
  zoom: 2.2,
  pitch: 0,
  bearing: 0,
};

// Provide sensible fallback points with valid coordinates
const fallbackData = [
  { id: 1, depth: 10, pressure: 5, temperature: 20, latitude: 19.0, longitude: 72.8 },
  { id: 2, depth: 20, pressure: 10, temperature: 25, latitude: 13.0, longitude: 80.3 },
  { id: 3, depth: 15, pressure: 7, temperature: 30, latitude: 22.6, longitude: 88.4 },
];

export default function OceanMap({ setActivePage, onPointClick }) {
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [data, setData] = useState([]);
  const [argovisCount, setArgovisCount] = useState(0);
  const [hoverInfo, setHoverInfo] = useState(null); // {x,y,coordinate,object}

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`${API_BASE}/api/argovis/global`);
        const rawArgovis = await response.json();

        if (Array.isArray(rawArgovis) && rawArgovis.length > 0) {
          const argovisPoints = rawArgovis.map(p => ({
            ...p,
            longitude: p.longitude > 180 ? p.longitude - 360 : p.longitude,
          }));
          setArgovisCount(argovisPoints.length);
          setData(argovisPoints);
        } else {
          // Fallback to local depth endpoint if Argovis is offline
          const dbRes = await fetch(`${API_BASE}/depth`);
          const dbData = await dbRes.json();
          if (Array.isArray(dbData)) {
            const cleaned = dbData.map(d => ({
              ...d,
              longitude: d.longitude > 180 ? d.longitude - 360 : d.longitude,
            }));
            setData(cleaned);
          }
        }
      } catch (e) {
        console.error('Error fetching global Argovis map data:', e);
        setData(fallbackData);
      }
    }
    fetchData();
  }, []);

  // Ensure only valid points are passed to DeckGL
  const safePoints = (data || []).filter(
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
      opacity: 0.9,
      radiusScale: 10,
      radiusMinPixels: 4,
      radiusMaxPixels: 30,
      getPosition: (d) => [d.longitude, d.latitude],
      getRadius: () => 4,
      getLineColor: [0, 0, 0, 150],
      lineWidthMinPixels: 0.5,
      getFillColor: (d) => {
        if (d.floatType === 'bgc') return [34, 197, 94];   // 🟢 Green for BGC Floats
        if (d.floatType === 'deep') return [59, 130, 246];  // 🔵 Blue for Deep Floats
        return [250, 204, 21];                             // 🟡 Yellow for Core Floats
      },
      onHover: (info) => {
        if (!info || !info.coordinate || !info.object) {
          setHoverInfo(null);
          return;
        }
        setHoverInfo({ x: info.x, y: info.y, coordinate: info.coordinate, object: info.object });
      },
      onClick: (info) => {
        if (info && info.object && onPointClick) {
          onPointClick(info.object.latitude, info.object.longitude);
        }
      },
    }),
  ];

  const coreCount = safePoints.filter(p => p.floatType === 'core').length;
  const bgcCount = safePoints.filter(p => p.floatType === 'bgc').length;
  const deepCount = safePoints.filter(p => p.floatType === 'deep').length;

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* Back to Home */}
      <button
        onClick={() => setActivePage('Home')}
        className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-3 py-1.5 glass-subtle rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/8 transition-all duration-200"
      >
        <ArrowLeft size={14} />
        Back
      </button>

      {/* Point count badge & Argovis Legend */}
      <div className="absolute top-3 right-3 z-10 glass-subtle rounded-lg px-3.5 py-2 flex items-center gap-3 shadow-xl backdrop-blur-md border border-white/10">
        <div className="flex items-center gap-1.5">
          <Layers size={14} className="text-cyan-400" />
          <span className="text-xs font-semibold text-white/90">{safePoints.length.toLocaleString()} Global Floats</span>
        </div>
        <div className="h-4 w-px bg-white/15" />
        <div className="flex items-center gap-2.5 text-[11px] font-medium">
          <span className="flex items-center gap-1 text-yellow-400">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 shadow-[0_0_8px_#facc15]" />
            Core ({coreCount})
          </span>
          <span className="flex items-center gap-1 text-green-400">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e]" />
            BGC ({bgcCount})
          </span>
          <span className="flex items-center gap-1 text-blue-400">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]" />
            Deep ({deepCount})
          </span>
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
          Loading global ARGO dataset...
        </div>
      )}
      {hoverInfo && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(Math.max(8, hoverInfo.x + 12), window.innerWidth - 250),
            top: Math.min(Math.max(8, hoverInfo.y + 12), window.innerHeight - 150)
          }}
          className="tooltip-card"
        >
          {hoverInfo.object && (
            <div className="mb-1">
              {hoverInfo.object.floatType === 'bgc' && (
                <div className="text-[11px] uppercase font-bold text-green-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-400" /> 🟢 ARGO BGC Float #{hoverInfo.object.floatId}
                </div>
              )}
              {hoverInfo.object.floatType === 'deep' && (
                <div className="text-[11px] uppercase font-bold text-blue-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-400" /> 🔵 Deep ARGO Float #{hoverInfo.object.floatId}
                </div>
              )}
              {(!hoverInfo.object.floatType || hoverInfo.object.floatType === 'core') && (
                <div className="text-[11px] uppercase font-bold text-yellow-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-yellow-400" /> 🟡 ARGO Core Float #{hoverInfo.object.floatId || hoverInfo.object.id}
                </div>
              )}
            </div>
          )}
          <div className="text-white/60 text-[11px] mb-1">
            {hoverInfo.coordinate[1].toFixed(3)}°, {hoverInfo.coordinate[0].toFixed(3)}°
          </div>
          {hoverInfo.object && (
            <div className="text-white/80 text-xs">
              <div>Cycle: <span className="text-cyan-300 font-semibold">{hoverInfo.object.cycle || 'Active'}</span></div>
              {hoverInfo.object.temperature != null && (
                <div>Temp: <span className="text-amber-400 font-semibold">{Number(hoverInfo.object.temperature).toFixed(2)}</span> °C</div>
              )}
              {hoverInfo.object.salinity != null && (
                <div>Salinity: <span className="text-purple-400 font-semibold">{Number(hoverInfo.object.salinity).toFixed(2)}</span> PSU</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
