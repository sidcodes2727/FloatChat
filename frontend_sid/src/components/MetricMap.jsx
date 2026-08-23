import React, { useEffect, useMemo, useState, useRef } from "react";
import { Play, Pause } from "lucide-react";
import Map from "react-map-gl/maplibre";
import DeckGL from "@deck.gl/react";
import { ScatterplotLayer, GeoJsonLayer } from "@deck.gl/layers";
import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import maplibregl from "maplibre-gl";
import { API_BASE } from "../config";

const MAP_STYLE =
  "https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json";

const INITIAL_VIEW_STATE = {
  longitude: 0,
  latitude: 0,
  zoom: 2,
  pitch: 0,
  bearing: 0,
};

const LAND_GEOJSON_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson";

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
    case "salinity":
      // 30-38 PSU
      t = Math.max(0, Math.min(1, (value - 30) / 8));
      break;
    case "temperature":
      // 0-30C
      t = Math.max(0, Math.min(1, value / 30));
      break;
    case "pressure":
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
    Math.round(c1[2] + (c2[2] - c1[2]) * frac),
  ];
}

// Legend specification per metric
function getLegendSpec(metric) {
  switch (metric) {
    case "salinity":
      return { min: 30, max: 38, unit: "PSU", label: "Salinity" };
    case "temperature":
      return { min: 0, max: 30, unit: "°C", label: "Temperature" };
    case "pressure":
      return { min: 0, max: 1000, unit: "dbar", label: "Pressure" };
    default:
      return { min: 0, max: 1, unit: "", label: metric };
  }
}

function toRgb(c) {
  const [r, g, b] = c;
  return `rgb(${r}, ${g}, ${b})`;
}

export default function MetricMap({ metric = "salinity", onMapClick }) {
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [hoverInfo, setHoverInfo] = useState(null); // {x,y,coordinate,object}
  const [land, setLand] = useState(null); // Natural Earth land polygons

  // Time Filter State
  const [selectedYear, setSelectedYear] = useState("All");
  const [selectedMonth, setSelectedMonth] = useState("All");
  const [selectedDay, setSelectedDay] = useState("All");

  useEffect(() => {
    async function load() {
      try {
        setError(null);
        const res = await fetch(`${API_BASE}/${metric}`);
        const data = await res.json();
        const cleaned = (Array.isArray(data) ? data : [])
          .filter(
            (d) =>
              d.latitude != null &&
              d.longitude != null &&
              Math.abs(d.latitude) <= 90 &&
              Math.abs(d.longitude) <= 360,
          )
          .map((d) => ({
            ...d,
            parsedTime: d.time_ts ? new Date(d.time_ts).getTime() : 0,
          }));
        setRows(cleaned);
        if (cleaned.length) {
          const avgLat =
            cleaned.reduce((s, d) => s + Number(d.latitude), 0) /
            cleaned.length;
          const avgLon =
            cleaned.reduce(
              (s, d) =>
                s +
                (Number(d.longitude) > 180
                  ? Number(d.longitude) - 360
                  : Number(d.longitude)),
              0,
            ) / cleaned.length;
          setViewState((v) => ({
            ...v,
            latitude: avgLat,
            longitude: avgLon,
            zoom: 3,
          }));
        }
      } catch (e) {
        setError(e.message || "Failed to load");
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
    return () => {
      cancelled = true;
    };
  }, []);

  const availableYears = useMemo(() => {
    const years = new Set();
    rows.forEach((r) => {
      if (r.parsedTime) {
        years.add(new Date(r.parsedTime).getFullYear());
      }
    });
    return Array.from(years).sort((a, b) => b - a); // descending
  }, [rows]);



  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (selectedYear !== "All") {
        if (!r.parsedTime) return false;
        const d = new Date(r.parsedTime);
        if (d.getFullYear().toString() !== selectedYear.toString())
          return false;
        if (
          selectedMonth !== "All" &&
          (d.getMonth() + 1).toString() !== selectedMonth.toString()
        )
          return false;
        if (
          selectedDay !== "All" &&
          d.getDate().toString() !== selectedDay.toString()
        )
          return false;
      }
      return true;
    });
  }, [rows, selectedYear, selectedMonth, selectedDay]);

  // Unified color scale for heatmaps
  const SCIENTIFIC_RANGE = useMemo(
    () => [
      [9, 21, 64, 255], // Deep Navy
      [15, 30, 110, 255], // Transition
      [27, 44, 193, 255], // Royal Blue
      [65, 80, 210, 255], // Transition
      [118, 146, 255, 255], // Periwinkle Blue
      [145, 175, 252, 255], // Transition
      [171, 210, 250, 255], // Light Ocean Blue
    ],
    [],
  );

  // Heatmap layer for continuous surface
  const heatmapLayer = useMemo(
    () =>
      new HeatmapLayer({
        id: `${metric}-heat`,
        data: filteredRows,
        getPosition: (d) => [
          Number(d.longitude) > 180
            ? Number(d.longitude) - 360
            : Number(d.longitude),
          Number(d.latitude),
        ],
        getWeight: (d) => {
          const raw = d[metric] ?? d.value;
          const v = Number.isFinite(Number(raw)) ? Number(raw) : 0;
          // Normalize per metric range to keep brightness comparable
          const spec = getLegendSpec(metric);
          const t = Math.max(
            0,
            Math.min(1, (v - spec.min) / (spec.max - spec.min || 1)),
          );
          return 1 + t; // emphasize higher values slightly
        },
        radiusPixels: Math.max(
          18,
          Math.min(90, Math.round(18 * (viewState?.zoom || 2))),
        ),
        intensity: 1.0,
        threshold: 0.05,
        colorRange: SCIENTIFIC_RANGE,
        weightsTextureSize: 512,
      }),
    [filteredRows, metric, viewState, SCIENTIFIC_RANGE],
  );

  // White dot markers for actual coordinates
  const pointsLayer = useMemo(
    () =>
      new ScatterplotLayer({
        id: `${metric}-points`,
        data: filteredRows,
        pickable: true,
        opacity: 0.95,
        radiusScale: 10,
        radiusMinPixels: 5,
        radiusMaxPixels: 50,
        getPosition: (d) => [
          Number(d.longitude) > 180
            ? Number(d.longitude) - 360
            : Number(d.longitude),
          Number(d.latitude),
        ],
        getRadius: () => 6,
        getFillColor: (d) => {
          const val = Number(d[metric]);
          if (!Number.isFinite(val)) return [150, 150, 150, 200];
          return getColor(val, metric);
        },
        getLineColor: [255, 255, 255, 100],
        lineWidthUnits: "pixels",
        stroked: true,
        lineWidthMinPixels: 0.5,
        onHover: (info) => {
          if (!info || !info.coordinate || !info.object) {
            setHoverInfo(null);
            return;
          }
          setHoverInfo({
            x: info.x,
            y: info.y,
            coordinate: info.coordinate,
            object: info.object,
          });
        },
        onClick: (info) => {
          if (info && info.coordinate && onMapClick) {
            onMapClick(info.coordinate[1], info.coordinate[0]);
          }
        },
      }),
    [filteredRows, metric, onMapClick],
  );

  // Land mask layer (overdraw on top to hide heat on land)
  const landMask = useMemo(() => {
    if (!land) return null;
    return new GeoJsonLayer({
      id: "land-mask",
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
    const gradient = `linear-gradient(90deg, ${stops.join(", ")})`;
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
          <span className="text-foreground font-semibold">
            {Number(val).toFixed(1)}
          </span>
        </div>
        <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>
      </div>
    );
  };

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <DeckGL
        initialViewState={viewState}
        controller
        layers={[heatmapLayer, pointsLayer, landMask].filter(Boolean)}
        onViewStateChange={({ viewState }) => setViewState(viewState)}
      >
        <Map
          mapLib={maplibregl}
          reuseMaps
          mapStyle={MAP_STYLE}
          attributionControl={false}
          {...viewState}
        />
      </DeckGL>
      {/* Time Filter UI */}
      <div
        style={{ position: "absolute", top: 24, left: 24, zIndex: 10 }}
        className="flex gap-2"
      >
        <div className="bg-background/95 backdrop-blur-md border border-border rounded-lg shadow-md p-2 flex items-center gap-3">
          <div className="flex flex-col">
            <label className="text-[9px] font-mono tracking-widest text-muted-foreground uppercase px-1 mb-0.5">
              Year
            </label>
            <select
              className="bg-transparent text-foreground text-sm font-semibold outline-none cursor-pointer focus:ring-0"
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(e.target.value);
                setSelectedMonth("All");
                setSelectedDay("All");
              }}
            >
              <option value="All">All Years</option>
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div className="w-px h-8 bg-border"></div>

          <div className="flex flex-col">
            <label className="text-[9px] font-mono tracking-widest text-muted-foreground uppercase px-1 mb-0.5">
              Month
            </label>
            <select
              className="bg-transparent text-foreground text-sm font-semibold outline-none cursor-pointer focus:ring-0 disabled:opacity-50"
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setSelectedDay("All");
              }}
              disabled={selectedYear === "All"}
            >
              <option value="All">All Months</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {new Date(2000, m - 1).toLocaleString("default", {
                    month: "short",
                  })}
                </option>
              ))}
            </select>
          </div>

          <div className="w-px h-8 bg-border"></div>

          <div className="flex flex-col">
            <label className="text-[9px] font-mono tracking-widest text-muted-foreground uppercase px-1 mb-0.5">
              Day
            </label>
            <select
              className="bg-transparent text-foreground text-sm font-semibold outline-none cursor-pointer focus:ring-0 disabled:opacity-50"
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              disabled={selectedMonth === "All"}
            >
              <option value="All">All Days</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Color Legend */}
      <div
        style={{ position: "absolute", left: 16, bottom: 24, width: 240 }}
        className="bg-background/95 backdrop-blur-md border border-border shadow-lg rounded-lg p-4"
      >
        <div className="flex items-center justify-between text-[11px] text-foreground font-bold mb-3 font-mono uppercase tracking-widest border-b border-border pb-2">
          <span>{legend.label}</span>
          <span className="text-muted-foreground">{legend.unit}</span>
        </div>
        <div
          className="h-2.5 w-full rounded-full overflow-hidden shadow-inner"
          style={{ background: legend.gradient }}
        />
        <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-2 font-mono">
          <span>{legend.min}</span>
          <span>{legend.mid}</span>
          <span>{legend.max}</span>
        </div>
      </div>

      {hoverInfo && (
        <div
          style={{
            position: "absolute",
            left: Math.min(
              Math.max(8, hoverInfo.x + 12),
              window.innerWidth - 240,
            ),
            top: Math.min(
              Math.max(8, hoverInfo.y + 12),
              window.innerHeight - 180,
            ),
          }}
          className="bg-background border border-border shadow-lg rounded-md p-4 min-w-[200px]"
        >
          <div className="text-foreground text-xs font-bold mb-3 border-b border-border pb-2 flex justify-between font-mono tracking-wider uppercase">
            <span>Float Point</span>
            <span className="text-muted-foreground">
              {hoverInfo.coordinate[1].toFixed(2)}°,{" "}
              {hoverInfo.coordinate[0].toFixed(2)}°
            </span>
          </div>
          {hoverInfo.object ? (
            <div>
              {renderMiniChart(
                "Depth (m)",
                hoverInfo.object.depth,
                2000,
                "var(--color-light-ocean)",
              )}
              {metric === "temperature" &&
                renderMiniChart(
                  "Temp (°C)",
                  hoverInfo.object.temperature,
                  35,
                  "var(--color-periwinkle)",
                )}
              {metric === "salinity" &&
                renderMiniChart(
                  "Salinity (PSU)",
                  hoverInfo.object.salinity,
                  40,
                  "var(--color-royal-blue)",
                )}
              {metric === "pressure" &&
                renderMiniChart(
                  "Pressure (dbar)",
                  hoverInfo.object.pressure,
                  2000,
                  "var(--color-periwinkle)",
                )}
              <div className="text-[10px] text-periwinkle mt-4 text-center font-sans opacity-80 bg-periwinkle/10 rounded py-1">
                Click to analyze with AI
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground text-xs font-mono">
              No point under cursor
            </div>
          )}
        </div>
      )}

      {error && (
        <div
          style={{ position: "absolute", top: 16, right: 16 }}
          className="bg-red-50 border border-red-200 shadow-md rounded-md px-4 py-2 text-red-600 text-xs font-mono"
        >
          Failed to load {metric}: {error}
        </div>
      )}
    </div>
  );
}
