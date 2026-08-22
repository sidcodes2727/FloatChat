import React, { useEffect, useState, useRef, useMemo } from 'react';
import Globe from 'react-globe.gl';
import { API_BASE } from '../config';

export default function GlobeMap({ onMapClick }) {
  const [data, setData] = useState([]);
  const [error, setError] = useState(null);
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const globeRef = useRef();

  // Handle window resize for the globe
  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`${API_BASE}/depth`);
        const rawData = await response.json();

        if (rawData.length) {
          const cleaned = rawData
            .filter(
              (d) =>
                d.latitude != null &&
                d.longitude != null &&
                Number.isFinite(Number(d.latitude)) &&
                Number.isFinite(Number(d.longitude))
            )
            .map((d) => ({
              ...d,
              lat: Number(d.latitude),
              lng: Number(d.longitude),
              // Map depth to a reasonable altitude scale for the 3D bars (0 to ~0.5)
              altitude: d.depth != null ? Math.min(0.5, Number(d.depth) / 10000) : 0.05,
              color: d.temperature != null ? getColorForTemperature(Number(d.temperature)) : '#7692FF',
            }));
          setData(cleaned);
        }
      } catch (e) {
        console.error('Error fetching data for Globe Map:', e);
        setError(e.message);
      }
    }
    fetchData();
  }, []);

  // Helper to color points by temperature using exact palette
  function getColorForTemperature(temp) {
    const t = Math.max(0, Math.min(1, temp / 30));
    // Interpolate from Royal Blue [27, 44, 193] to Light Ocean Blue [171, 210, 250]
    const r = Math.round(27 + (171 - 27) * t);
    const g = Math.round(44 + (210 - 44) * t);
    const b = Math.round(193 + (250 - 193) * t);
    return `rgba(${r}, ${g}, ${b}, 0.8)`;
  }

  const tooltipHtml = useMemo(() => {
    return (d) => `
      <div style="
        background: var(--background);
        border: 1px solid var(--border);
        border-radius: 6px;
        padding: 12px;
        color: var(--foreground);
        font-family: var(--font-mono);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        min-width: 180px;
      ">
        <div style="font-weight: 700; font-size: 10px; margin-bottom: 8px; color: var(--muted-foreground); text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 1px solid var(--border); padding-bottom: 6px;">Float Point</div>
        <div style="font-size: 11px; color: var(--foreground); line-height: 1.6;">
          <b>Lat:</b> ${d.lat.toFixed(3)}°<br/>
          <b>Lng:</b> ${d.lng.toFixed(3)}°<br/>
          ${d.depth != null ? `<b>Depth:</b> ${Number(d.depth).toFixed(1)} m<br/>` : ''}
          ${d.temperature != null ? `<b>Temp:</b> ${Number(d.temperature).toFixed(2)} °C<br/>` : ''}
          ${d.salinity != null ? `<b>Salinity:</b> ${Number(d.salinity).toFixed(2)} PSU<br/>` : ''}
          ${d.pressure != null ? `<b>Pressure:</b> ${Number(d.pressure).toFixed(2)} dbar<br/>` : ''}
          <div style="margin-top: 12px; font-size: 9px; color: var(--color-periwinkle); text-align: center; background: rgba(118,146,255,0.1); padding: 4px; border-radius: 4px;">Click point to analyze with AI</div>
        </div>
      </div>
    `;
  }, []);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#091540' }}>
      <Globe
        ref={globeRef}
        width={dimensions.width}
        height={dimensions.height}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        pointsData={data}
        pointLat="lat"
        pointLng="lng"
        pointColor="color"
        pointAltitude="altitude"
        pointRadius={0.3}
        pointsMerge={false}
        pointResolution={12}
        pointLabel={tooltipHtml}
        onPointClick={(point) => {
          if (point && onMapClick) {
            onMapClick(point.lat, point.lng);
          }
        }}
      />
      
      {/* HUD Info */}
      <div className="absolute top-4 right-4 z-10 bg-background/90 backdrop-blur-md border border-border shadow-sm rounded-md px-4 py-3 font-mono">
        <div className="text-xs text-foreground font-bold uppercase tracking-widest mb-2 border-b border-border pb-2">Points: {data.length.toLocaleString()}</div>
        <div className="text-[10px] text-muted-foreground mb-1">Color: Temp (Navy to Light Blue)</div>
        <div className="text-[10px] text-muted-foreground">Height: Depth</div>
      </div>

      {error && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-md text-sm shadow-sm font-mono">
          Failed to load data: {error}
        </div>
      )}
    </div>
  );
}
