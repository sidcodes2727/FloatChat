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

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`${API_BASE}/depth`);
        const rawData = await response.json();

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
        // Periwinkle [118, 146, 255] to Royal Blue [27, 44, 193]
        const r = Math.floor(118 - 91 * t);
        const g = Math.floor(146 - 102 * t);
        const b = Math.floor(255 - 62 * t);
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
         <div className="mt-2">
            <div className="flex justify-between text-[10px] text-muted-foreground mb-1 font-mono">
               <span className="uppercase tracking-widest">{label}</span>
               <span className="text-foreground">{Number(val).toFixed(1)}</span>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden bg-muted">
               <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
            </div>
         </div>
      );
  };

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <button
        onClick={() => setActivePage('Home')}
        className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-2 bg-background/90 backdrop-blur-md border border-border rounded-md text-sm text-foreground shadow-sm hover:bg-muted transition-all cursor-pointer"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <div className="absolute top-4 right-4 z-10 bg-background/90 backdrop-blur-md border border-border shadow-sm rounded-md px-3 py-2 flex items-center gap-2">
        <Layers size={14} className="text-periwinkle" />
        <span className="text-xs text-foreground font-mono tracking-widest">{safePoints.length.toLocaleString()} points</span>
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
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-background border border-border shadow-md px-4 py-2 rounded-md text-xs font-mono uppercase tracking-widest text-muted-foreground">
          No points available to display.
        </div>
      )}
      
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
               {renderMiniChart('Temp (°C)', hoverInfo.object.temperature, 35, 'var(--color-periwinkle)')}
               {renderMiniChart('Salinity (PSU)', hoverInfo.object.salinity, 40, 'var(--color-royal-blue)')}
               <div className="text-[10px] text-periwinkle mt-4 text-center font-sans opacity-80 bg-periwinkle/10 rounded py-1">Click to analyze with AI</div>
            </div>
          ) : (
            <div className="text-muted-foreground text-xs font-mono">No point under cursor</div>
          )}
        </div>
      )}
    </div>
  );
}
