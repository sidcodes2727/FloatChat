import React, { useEffect, useState, useRef, useMemo } from 'react';
import Globe from 'react-globe.gl';
import { API_BASE } from '../config';

export default function GlobeMap() {
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
              color: d.temperature != null ? getColorForTemperature(Number(d.temperature)) : '#00d4ff',
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

  // Helper to color points by temperature (blue to red)
  function getColorForTemperature(temp) {
    const t = Math.max(0, Math.min(1, temp / 30));
    const r = Math.floor(30 + 225 * t);
    const g = Math.floor(80 + 120 * t);
    const b = Math.floor(220 - 200 * t);
    return `rgba(${r}, ${g}, ${b}, 0.8)`;
  }

  const tooltipHtml = useMemo(() => {
    return (d) => `
      <div style="
        background: rgba(4, 12, 26, 0.9);
        border: 1px solid rgba(0, 212, 255, 0.3);
        border-radius: 8px;
        padding: 10px;
        color: white;
        font-family: sans-serif;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
        min-width: 150px;
      ">
        <div style="font-weight: 600; font-size: 13px; margin-bottom: 6px; color: #00d4ff;">Float Point</div>
        <div style="font-size: 12px; color: #ccc;">
          <b>Lat:</b> ${d.lat.toFixed(3)}°<br/>
          <b>Lng:</b> ${d.lng.toFixed(3)}°<br/>
          ${d.depth != null ? `<b>Depth:</b> ${Number(d.depth).toFixed(1)} m<br/>` : ''}
          ${d.temperature != null ? `<b>Temp:</b> ${Number(d.temperature).toFixed(2)} °C<br/>` : ''}
          ${d.salinity != null ? `<b>Salinity:</b> ${Number(d.salinity).toFixed(2)} PSU<br/>` : ''}
          ${d.pressure != null ? `<b>Pressure:</b> ${Number(d.pressure).toFixed(2)} dbar<br/>` : ''}
        </div>
      </div>
    `;
  }, []);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#020a16' }}>
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
      />
      
      {/* HUD Info */}
      <div className="absolute top-4 right-4 z-10 glass-subtle rounded-lg px-4 py-2 shadow-lg" style={{ background: 'rgba(2, 10, 22, 0.7)' }}>
        <div className="text-xs text-white/80 font-medium">Points: {data.length.toLocaleString()}</div>
        <div className="text-[10px] text-white/50 mt-1">Color: Temperature (Blue to Red)</div>
        <div className="text-[10px] text-white/50">Height: Depth</div>
      </div>

      {error && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-red-900/80 text-white px-4 py-2 rounded-lg text-sm shadow-lg">
          Failed to load data: {error}
        </div>
      )}
    </div>
  );
}
