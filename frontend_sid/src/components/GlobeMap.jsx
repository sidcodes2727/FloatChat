import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import Globe from 'react-globe.gl';
import { Thermometer, Droplets, Eye } from 'lucide-react';
import { API_BASE } from '../config';

const HEATMAP_MODES = [
  { key: 'none', label: 'Points', icon: Eye },
  { key: 'temperature', label: 'Temp', icon: Thermometer },
  { key: 'salinity', label: 'Salinity', icon: Droplets },
];

// Color interpolation for heatmap: temperature (blue → orange → red)
function tempColorFn(t) {
  // Vivid: deep blue → bright yellow → hot red, semi-transparent
  const r = Math.floor(20 + 235 * t);
  const g = Math.floor(40 + 215 * Math.min(1, t * 2) - 215 * Math.max(0, t - 0.5) * 2);
  const b = Math.floor(255 - 245 * t);
  return `rgba(${r},${g},${b},0.75)`;
}

// Color interpolation for heatmap: salinity (light cyan → teal → deep purple)
function salColorFn(t) {
  // Vivid: bright cyan → electric teal → neon purple, semi-transparent
  let r, g, b;
  if (t < 0.5) {
    const s = t * 2;
    r = Math.floor(100 * (1 - s));
    g = Math.floor(255 * (1 - s) + 220 * s);
    b = Math.floor(255 * (1 - s) + 180 * s);
  } else {
    const s = (t - 0.5) * 2;
    r = Math.floor(0 * (1 - s) + 200 * s);
    g = Math.floor(220 * (1 - s) + 30 * s);
    b = Math.floor(180 * (1 - s) + 255 * s);
  }
  return `rgba(${r},${g},${b},0.75)`;
}

export default function GlobeMap({ onMapClick }) {
  const [data, setData] = useState([]);
  const [tempData, setTempData] = useState([]);
  const [salData, setSalData] = useState([]);
  const [error, setError] = useState(null);
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const [selectedYear, setSelectedYear] = useState('All');
  const [availableYears, setAvailableYears] = useState([]);
  const [heatmapMode, setHeatmapMode] = useState('temperature');
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
        // Fetch all three datasets in parallel
        const [depthRes, tempRes, salRes] = await Promise.all([
          fetch(`${API_BASE}/depth`),
          fetch(`${API_BASE}/temperature`),
          fetch(`${API_BASE}/salinity`),
        ]);
        const [rawDepth, rawTemp, rawSal] = await Promise.all([
          depthRes.json(),
          tempRes.json(),
          salRes.json(),
        ]);

        // Clean depth / points data (same as before)
        if (rawDepth.length) {
          const cleaned = rawDepth
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
              altitude: d.depth != null ? Math.min(0.5, Number(d.depth) / 10000) : 0.05,
              color: d.temperature != null ? getColorForTemperature(Number(d.temperature)) : '#00d4ff',
              year: d.year != null ? Number(d.year) : null,
            }));
          setData(cleaned);
          const years = [...new Set(cleaned.map(d => d.year).filter(y => y != null))].sort((a, b) => b - a);
          setAvailableYears(years);
        }

        // Clean temperature data for heatmap
        const cleanedTemp = (Array.isArray(rawTemp) ? rawTemp : [])
          .filter(d => d.latitude != null && d.longitude != null && d.temperature != null && Number.isFinite(Number(d.temperature)))
          .map(d => ({
            lat: Number(d.latitude),
            lng: Number(d.longitude > 180 ? d.longitude - 360 : d.longitude),
            weight: Math.max(0.01, Math.min(1, Number(d.temperature) / 30)),
            value: Number(d.temperature),
            year: d.year != null ? Number(d.year) : null,
          }));
        setTempData(cleanedTemp);

        // Clean salinity data for heatmap
        const cleanedSal = (Array.isArray(rawSal) ? rawSal : [])
          .filter(d => d.latitude != null && d.longitude != null && d.salinity != null && Number.isFinite(Number(d.salinity)))
          .map(d => ({
            lat: Number(d.latitude),
            lng: Number(d.longitude > 180 ? d.longitude - 360 : d.longitude),
            weight: Math.max(0.01, Math.min(1, (Number(d.salinity) - 30) / 8)),
            value: Number(d.salinity),
            year: d.year != null ? Number(d.year) : null,
          }));
        setSalData(cleanedSal);
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

  // Tooltip for depth points (Points mode)
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
          ${d.year ? `<b>Year:</b> ${d.year}<br/>` : ''}
          <b>Lat:</b> ${d.lat.toFixed(3)}°<br/>
          <b>Lng:</b> ${d.lng.toFixed(3)}°<br/>
          ${d.depth != null ? `<b>Depth:</b> ${Number(d.depth).toFixed(1)} m<br/>` : ''}
          ${d.temperature != null ? `<b>Temp:</b> ${Number(d.temperature).toFixed(2)} °C<br/>` : ''}
          ${d.salinity != null ? `<b>Salinity:</b> ${Number(d.salinity).toFixed(2)} PSU<br/>` : ''}
          ${d.pressure != null ? `<b>Pressure:</b> ${Number(d.pressure).toFixed(2)} dbar<br/>` : ''}
          <div style="margin-top: 8px; font-size: 10px; font-style: italic; color: #888; text-align: center;">Click point to analyze with AI</div>
        </div>
      </div>
    `;
  }, []);

  // Tooltip for heatmap hover points (Temperature / Salinity mode)
  const tempTooltipHtml = useMemo(() => {
    return (d) => `
      <div style="
        background: rgba(4, 12, 26, 0.92);
        border: 1px solid rgba(255, 138, 101, 0.4);
        border-radius: 8px;
        padding: 10px;
        color: white;
        font-family: sans-serif;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
        min-width: 140px;
      ">
        <div style="font-weight: 600; font-size: 13px; margin-bottom: 6px; color: #ff8a65;">🌡 Temperature</div>
        <div style="font-size: 12px; color: #ccc;">
          <b>Lat:</b> ${d.lat.toFixed(3)}°<br/>
          <b>Lng:</b> ${d.lng.toFixed(3)}°<br/>
          <div style="margin-top: 6px; font-size: 18px; font-weight: 700; color: #ff8a65;">${d.value.toFixed(2)} °C</div>
        </div>
      </div>
    `;
  }, []);

  const salTooltipHtml = useMemo(() => {
    return (d) => `
      <div style="
        background: rgba(4, 12, 26, 0.92);
        border: 1px solid rgba(177, 3, 252, 0.4);
        border-radius: 8px;
        padding: 10px;
        color: white;
        font-family: sans-serif;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
        min-width: 140px;
      ">
        <div style="font-weight: 600; font-size: 13px; margin-bottom: 6px; color: #b103fc;">💧 Salinity</div>
        <div style="font-size: 12px; color: #ccc;">
          <b>Lat:</b> ${d.lat.toFixed(3)}°<br/>
          <b>Lng:</b> ${d.lng.toFixed(3)}°<br/>
          <div style="margin-top: 6px; font-size: 18px; font-weight: 700; color: #b103fc;">${d.value.toFixed(2)} PSU</div>
        </div>
      </div>
    `;
  }, []);

  // Filter all datasets by year
  const filteredData = useMemo(() =>
    selectedYear === 'All' ? data : data.filter(d => d.year === selectedYear),
    [data, selectedYear]
  );

  const filteredTempData = useMemo(() =>
    selectedYear === 'All' ? tempData : tempData.filter(d => d.year === selectedYear),
    [tempData, selectedYear]
  );

  const filteredSalData = useMemo(() =>
    selectedYear === 'All' ? salData : salData.filter(d => d.year === selectedYear),
    [salData, selectedYear]
  );

  // Heatmap dataset: array of arrays (one heatmap at a time)
  const heatmapDataset = useMemo(() => {
    if (heatmapMode === 'temperature' && filteredTempData.length > 0) return [filteredTempData];
    if (heatmapMode === 'salinity' && filteredSalData.length > 0) return [filteredSalData];
    return [];
  }, [heatmapMode, filteredTempData, filteredSalData]);

  // Heatmap color function — switches based on mode
  const heatmapColorAccessor = useMemo(() => {
    if (heatmapMode === 'salinity') return () => salColorFn;
    return () => tempColorFn;
  }, [heatmapMode]);

  // Points layer: in heatmap mode, render transparent hover-target dots from heatmap data
  // In points mode, render the original colored depth points
  const visiblePoints = useMemo(() => {
    if (heatmapMode === 'temperature') {
      return filteredTempData.map(d => ({
        ...d,
        altitude: 0.015, // slightly above heatmap surface so it's hoverable
        color: 'rgba(0,0,0,0)', // invisible
      }));
    }
    if (heatmapMode === 'salinity') {
      return filteredSalData.map(d => ({
        ...d,
        altitude: 0.015,
        color: 'rgba(0,0,0,0)', // invisible
      }));
    }
    return filteredData;
  }, [heatmapMode, filteredData, filteredTempData, filteredSalData]);

  // Choose the right tooltip based on mode
  const activeTooltip = useMemo(() => {
    if (heatmapMode === 'temperature') return tempTooltipHtml;
    if (heatmapMode === 'salinity') return salTooltipHtml;
    return tooltipHtml;
  }, [heatmapMode, tooltipHtml, tempTooltipHtml, salTooltipHtml]);

  // Legend config for the active heatmap
  const legendConfig = useMemo(() => {
    if (heatmapMode === 'temperature') {
      return {
        label: 'Temperature',
        unit: '°C',
        min: 0,
        max: 30,
        gradient: 'linear-gradient(90deg, rgb(30,60,220), rgb(80,140,170), rgb(160,200,80), rgb(220,180,40), rgb(255,120,20))',
      };
    }
    if (heatmapMode === 'salinity') {
      return {
        label: 'Salinity',
        unit: 'PSU',
        min: 30,
        max: 38,
        gradient: 'linear-gradient(90deg, #e0f7fa, #4dd0e1, #00897b, #7c24a8, #b103fc)',
      };
    }
    return null;
  }, [heatmapMode]);

  const handlePointClick = useCallback((point) => {
    if (point && onMapClick) {
      onMapClick(point.lat, point.lng);
    }
  }, [onMapClick]);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#020a16' }}>
      <Globe
        ref={globeRef}
        width={dimensions.width}
        height={dimensions.height}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        // Points layer — visible colored in Points mode, invisible hover targets in heatmap mode
        pointsData={visiblePoints}
        pointLat="lat"
        pointLng="lng"
        pointColor="color"
        pointAltitude="altitude"
        pointRadius={heatmapMode === 'none' ? 0.3 : 0.5}
        pointsMerge={false}
        pointResolution={12}
        pointLabel={activeTooltip}
        onPointClick={handlePointClick}
        // Heatmap layer
        heatmapsData={heatmapDataset}
        heatmapPointLat="lat"
        heatmapPointLng="lng"
        heatmapPointWeight="weight"
        heatmapTopAltitude={0.01}
        heatmapBandwidth={0.9}
        heatmapColorFn={heatmapColorAccessor}
        heatmapColorSaturation={2.2}
        heatmapsTransitionDuration={1200}
      />
      
      {/* HUD Info */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 items-end">
        {/* Year filter */}
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value === 'All' ? 'All' : Number(e.target.value))}
          className="glass-subtle rounded-lg px-2 py-1.5 text-xs text-white/80 bg-[rgba(2,10,22,0.7)] border-none outline-none cursor-pointer"
        >
          <option value="All" className="bg-[#040c1a]">All Years</option>
          {availableYears.map(year => (
            <option key={year} value={year} className="bg-[#040c1a]">{year}</option>
          ))}
        </select>

        {/* Heatmap toggle */}
        <div
          className="rounded-xl p-0.5 flex gap-0.5"
          style={{
            background: 'rgba(2, 10, 22, 0.7)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {HEATMAP_MODES.map(({ key, label, icon: Icon }) => {
            const isActive = heatmapMode === key;
            return (
              <button
                key={key}
                onClick={() => setHeatmapMode(key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200"
                style={{
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.45)',
                  background: isActive
                    ? key === 'temperature'
                      ? 'rgba(255, 138, 101, 0.18)'
                      : key === 'salinity'
                        ? 'rgba(177, 3, 252, 0.18)'
                        : 'rgba(0, 212, 255, 0.12)'
                    : 'transparent',
                  border: isActive
                    ? key === 'temperature'
                      ? '1px solid rgba(255, 138, 101, 0.35)'
                      : key === 'salinity'
                        ? '1px solid rgba(177, 3, 252, 0.35)'
                        : '1px solid rgba(0, 212, 255, 0.2)'
                    : '1px solid transparent',
                }}
              >
                <Icon size={12} style={{
                  color: isActive
                    ? key === 'temperature' ? '#ff8a65' : key === 'salinity' ? '#b103fc' : '#00d4ff'
                    : 'inherit',
                }} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Points info */}
        <div className="glass-subtle rounded-lg px-4 py-2 shadow-lg" style={{ background: 'rgba(2, 10, 22, 0.7)' }}>
          {heatmapMode === 'none' ? (
            <>
              <div className="text-xs text-white/80 font-medium">Points: {filteredData.length.toLocaleString()}</div>
              <div className="text-[10px] text-white/50 mt-1">Color: Temperature (Blue → Red)</div>
              <div className="text-[10px] text-white/50">Height: Depth</div>
            </>
          ) : (
            <>
              <div className="text-xs font-medium" style={{
                color: heatmapMode === 'temperature' ? '#ff8a65' : '#b103fc',
              }}>
                {heatmapMode === 'temperature' ? '🌡 Temperature' : '💧 Salinity'} Heatmap
              </div>
              <div className="text-[10px] text-white/50 mt-1">
                {heatmapMode === 'temperature' ? filteredTempData.length : filteredSalData.length} data points
              </div>
              <div className="text-[10px] text-white/40 mt-0.5">Hover to see values</div>
            </>
          )}
        </div>
      </div>

      {/* Color Legend */}
      {legendConfig && (
        <div
          style={{ position: 'absolute', left: 12, bottom: 12, width: 260 }}
          className="rounded-xl p-3"
        >
          <div
            style={{
              background: 'rgba(2, 10, 22, 0.78)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 12,
              padding: 12,
            }}
          >
            <div className="flex items-center justify-between text-[11px] text-white/55 mb-2 font-medium">
              <span className="uppercase tracking-wider flex items-center gap-1.5">
                {heatmapMode === 'temperature'
                  ? <Thermometer size={12} style={{ color: '#ff8a65' }} />
                  : <Droplets size={12} style={{ color: '#b103fc' }} />
                }
                {legendConfig.label} Heatmap
              </span>
              <span className="text-white/40">{legendConfig.unit}</span>
            </div>
            <div
              className="h-2.5 w-full rounded-full overflow-hidden"
              style={{
                background: legendConfig.gradient,
                boxShadow: '0 0 8px rgba(0,0,0,0.3)',
              }}
            />
            <div className="flex items-center justify-between text-[10px] text-white/40 mt-1.5">
              <span>{legendConfig.min}</span>
              <span>{((legendConfig.min + legendConfig.max) / 2).toFixed(0)}</span>
              <span>{legendConfig.max}</span>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-red-900/80 text-white px-4 py-2 rounded-lg text-sm shadow-lg">
          Failed to load data: {error}
        </div>
      )}
    </div>
  );
}
