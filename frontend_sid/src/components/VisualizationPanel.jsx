import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as d3 from 'd3';
import { X, MapPin, Activity, Thermometer, Droplets, Layers, GitCompare, TrendingUp } from 'lucide-react';
import { LineChart, StatCard } from './Charts';
import { API_BASE } from '../config';

// Vibrant palette for multi-location comparisons
const SERIES_COLORS = [
    '#00d4ff', // cyan
    '#ff3366', // coral
    '#00ffcc', // mint
    '#ffaa00', // amber
    '#9933ff', // purple
    '#ff6b35', // orange
];

/* ─── Build depth-binned series for comparison multi-line charts ─── */
function buildMultiSeries(records, metricKey) {
    const pts = (records || [])
        .map(r => ({ x: Number(r.depth), y: Number(r[metricKey]) }))
        .filter(d => Number.isFinite(d.x) && Number.isFinite(d.y) && d.x >= 0);
    pts.sort((a, b) => a.x - b.x);

    const binSize = 25;
    const bins = {};
    for (const p of pts) {
        const bin = Math.floor(p.x / binSize) * binSize;
        if (!bins[bin]) bins[bin] = [];
        bins[bin].push(p.y);
    }
    return Object.entries(bins)
        .map(([bin, vals]) => ({
            x: Number(bin),
            y: vals.reduce((s, v) => s + v, 0) / vals.length,
        }))
        .sort((a, b) => a.x - b.x);
}

/* ─── Multi-series SVG Line Chart component ─── */
function MultiLineChart({ seriesList, title, icon, color, yUnit = '' }) {
    const svgRef = useRef();
    const containerRef = useRef();

    useEffect(() => {
        const validSeries = seriesList.filter(s => s.data && s.data.length > 0);
        if (validSeries.length === 0) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        const containerWidth = containerRef.current?.clientWidth || 370;
        const width = Math.max(280, containerWidth - 4);
        const height = 220;
        const margin = { top: 20, right: 16, bottom: 40, left: 48 };

        svg.attr('width', width).attr('height', height);

        const allX = validSeries.flatMap(s => s.data.map(d => d.x));
        const allY = validSeries.flatMap(s => s.data.map(d => d.y));

        const x = d3.scaleLinear()
            .domain([0, d3.max(allX) || 1])
            .range([margin.left, width - margin.right]);

        let [yMin, yMax] = d3.extent(allY);
        if (!Number.isFinite(yMin)) { yMin = 0; yMax = 1; }
        if (yMin === yMax) { const pad = Math.abs(yMin) * 0.05 || 1; yMin -= pad; yMax += pad; }

        const y = d3.scaleLinear()
            .domain([yMin, yMax])
            .nice()
            .range([height - margin.bottom, margin.top]);

        // Gridlines
        svg.append('g')
            .attr('transform', `translate(${margin.left},0)`)
            .call(d3.axisLeft(y).tickSize(-(width - margin.left - margin.right)).tickFormat(''))
            .selectAll('line').attr('stroke', 'rgba(255,255,255,0.04)');
        svg.selectAll('.domain').remove();

        // Axes
        const xAxis = svg.append('g')
            .attr('transform', `translate(0,${height - margin.bottom})`)
            .call(d3.axisBottom(x).ticks(5));
        xAxis.selectAll('text').attr('fill', 'rgba(232,244,253,0.35)').style('font-size', '9px').style('font-family', 'Inter, sans-serif');
        xAxis.selectAll('line').attr('stroke', 'rgba(255,255,255,0.06)');
        xAxis.selectAll('path').attr('stroke', 'rgba(255,255,255,0.06)');

        const yAxis = svg.append('g')
            .attr('transform', `translate(${margin.left},0)`)
            .call(d3.axisLeft(y).ticks(5));
        yAxis.selectAll('text').attr('fill', 'rgba(232,244,253,0.35)').style('font-size', '9px').style('font-family', 'Inter, sans-serif');
        yAxis.selectAll('line').attr('stroke', 'rgba(255,255,255,0.06)');
        yAxis.selectAll('path').attr('stroke', 'rgba(255,255,255,0.06)');

        // X axis label
        svg.append('text')
            .attr('x', (width - margin.left - margin.right) / 2 + margin.left)
            .attr('y', height - 4)
            .attr('text-anchor', 'middle')
            .attr('fill', 'rgba(232,244,253,0.3)')
            .style('font-size', '9px').style('font-family', 'Inter, sans-serif')
            .text('Depth (m)');

        // Y axis label
        svg.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('x', -(height / 2))
            .attr('y', 12)
            .attr('text-anchor', 'middle')
            .attr('fill', 'rgba(232,244,253,0.3)')
            .style('font-size', '9px').style('font-family', 'Inter, sans-serif')
            .text(yUnit);

        const lineGen = d3.line()
            .x(d => x(d.x))
            .y(d => y(d.y))
            .curve(d3.curveMonotoneX);

        // Draw each series line
        validSeries.forEach((series, idx) => {
            const c = series.color;

            // Area gradient
            const gradId = `area-${title.replace(/\s+/g, '')}-${idx}`;
            const grad = svg.append('defs').append('linearGradient')
                .attr('id', gradId).attr('x1', '0').attr('y1', '0').attr('x2', '0').attr('y2', '1');
            grad.append('stop').attr('offset', '0%').attr('stop-color', c).attr('stop-opacity', 0.12);
            grad.append('stop').attr('offset', '100%').attr('stop-color', c).attr('stop-opacity', 0);

            const area = d3.area().x(d => x(d.x)).y0(height - margin.bottom).y1(d => y(d.y)).curve(d3.curveMonotoneX);
            svg.append('path').datum(series.data).attr('fill', `url(#${gradId})`).attr('d', area);

            // Path stroke
            svg.append('path')
                .datum(series.data)
                .attr('fill', 'none')
                .attr('stroke', c)
                .attr('stroke-width', 2)
                .attr('stroke-linejoin', 'round')
                .attr('stroke-linecap', 'round')
                .attr('stroke-dasharray', idx === 0 ? 'none' : idx % 2 === 0 ? '6,3' : '2,2')
                .attr('d', lineGen);
        });

        // Hover crosshair & tooltip
        const bisect = d3.bisector(d => d.x).center;
        const crosshair = svg.append('line')
            .attr('stroke', 'rgba(255,255,255,0.15)')
            .attr('stroke-width', 1)
            .attr('y1', margin.top)
            .attr('y2', height - margin.bottom)
            .style('display', 'none');

        const dots = validSeries.map((series) => {
            return svg.append('circle')
                .attr('r', 4)
                .attr('fill', series.color)
                .attr('stroke', '#040d18')
                .attr('stroke-width', 2)
                .style('display', 'none');
        });

        const tooltipG = svg.append('g').style('display', 'none');
        const tooltipBg = tooltipG.append('rect')
            .attr('rx', 6).attr('fill', 'rgba(4,14,30,0.95)')
            .attr('stroke', 'rgba(0,212,255,0.25)').attr('stroke-width', 1);
        const tooltipLines = validSeries.map((series) =>
            tooltipG.append('text')
                .attr('fill', series.color)
                .style('font-size', '9px').style('font-family', 'Inter, sans-serif')
        );
        const tooltipDepthLabel = tooltipG.append('text')
            .attr('fill', 'rgba(232,244,253,0.5)')
            .style('font-size', '9px').style('font-family', 'Inter, sans-serif');

        svg.append('rect')
            .attr('fill', 'transparent').attr('pointer-events', 'all')
            .attr('x', margin.left).attr('y', margin.top)
            .attr('width', width - margin.left - margin.right)
            .attr('height', height - margin.top - margin.bottom)
            .on('mouseenter', () => {
                crosshair.style('display', null);
                tooltipG.style('display', null);
                dots.forEach(d => d.style('display', null));
            })
            .on('mouseleave', () => {
                crosshair.style('display', 'none');
                tooltipG.style('display', 'none');
                dots.forEach(d => d.style('display', 'none'));
            })
            .on('mousemove', (event) => {
                const [mx] = d3.pointer(event);
                const depthVal = x.invert(mx);
                crosshair.attr('x1', mx).attr('x2', mx);

                const lineHeight = 13;
                const padding = 8;
                const tooltipWidth = 120;
                const tooltipHeight = padding + (validSeries.length + 1) * lineHeight + padding;

                let txPos = mx + 10;
                if (txPos + tooltipWidth > width - margin.right) txPos = mx - tooltipWidth - 10;

                tooltipBg.attr('x', txPos).attr('y', margin.top)
                    .attr('width', tooltipWidth).attr('height', tooltipHeight);
                tooltipDepthLabel
                    .attr('x', txPos + padding).attr('y', margin.top + padding + lineHeight - 2)
                    .text(`Depth: ${depthVal.toFixed(0)}m`);

                validSeries.forEach((series, idx) => {
                    const i = bisect(series.data, depthVal);
                    const d = series.data[Math.max(0, Math.min(series.data.length - 1, i))];
                    if (d) {
                        dots[idx].attr('cx', x(d.x)).attr('cy', y(d.y));
                        tooltipLines[idx]
                            .attr('x', txPos + padding)
                            .attr('y', margin.top + padding + (idx + 2) * lineHeight - 2)
                            .text(`${series.label.length > 10 ? series.label.slice(0, 10) + '…' : series.label}: ${d.y.toFixed(2)}`);
                    }
                });
            });

    }, [seriesList, title, yUnit]);

    return (
        <div
            className="card overflow-hidden"
            style={{
                background: 'rgba(4,14,30,0.6)',
                border: '1px solid rgba(0,212,255,0.1)',
                borderRadius: 12,
            }}
        >
            <div
                className="flex items-center gap-2 px-4 py-3"
                style={{ borderBottom: '1px solid rgba(0,212,255,0.07)' }}
            >
                <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: `${color}15`, border: `1px solid ${color}22` }}
                >
                    <span style={{ color }}>{icon}</span>
                </div>
                <h3 className="text-sm font-semibold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    {title}
                </h3>
                <TrendingUp size={12} style={{ color: `${color}70`, marginLeft: 'auto' }} />
            </div>
            <div className="px-2 pt-2 pb-1 overflow-x-auto">
                <svg ref={svgRef} style={{ minWidth: 260, width: '100%' }} />
            </div>
        </div>
    );
}

/* ─── Legend Component for Comparison ─── */
function ComparisonLegend({ locations }) {
    return (
        <div className="flex flex-wrap gap-x-3 gap-y-1.5 px-1 pb-2">
            {locations.map((loc, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                    <span
                        className="block rounded-full shrink-0"
                        style={{
                            width: 20, height: 3,
                            background: SERIES_COLORS[idx % SERIES_COLORS.length],
                            borderRadius: 2,
                        }}
                    />
                    <span className="text-[11px] truncate max-w-[110px]" style={{ color: SERIES_COLORS[idx % SERIES_COLORS.length] }}>
                        {loc.label}
                    </span>
                    {loc.isFallback && (
                        <span className="text-[9px] px-1 rounded" style={{ color: 'rgba(255,170,0,0.8)', background: 'rgba(255,170,0,0.08)', border: '1px solid rgba(255,170,0,0.2)' }}>
                            approx
                        </span>
                    )}
                </div>
            ))}
        </div>
    );
}

export default function VisualizationPanel({ coords, comparisonLocations, onClose }) {
    // Determine active mode: comparison vs single location
    const isComparisonMode = Array.isArray(comparisonLocations) && comparisonLocations.length > 0;
    const isSingleMode = !isComparisonMode && Boolean(coords);
    const isOpen = isComparisonMode || isSingleMode;

    // Single location state
    const [singleRecords, setSingleRecords] = useState([]);
    const [singleLoading, setSingleLoading] = useState(false);
    const [singleError, setSingleError] = useState(null);

    // Multi location comparison state
    const [compareData, setCompareData] = useState([]);
    const [compareLoading, setCompareLoading] = useState(false);
    const [compareError, setCompareError] = useState(null);

    // ── Single Location Data Fetching ──
    useEffect(() => {
        if (!coords || isComparisonMode) return;
        let aborted = false;

        async function fetchSingleData() {
            try {
                setSingleLoading(true);
                setSingleError(null);
                const url = new URL(`${API_BASE}/profiles`);
                url.searchParams.set('lat', String(coords.lat));
                url.searchParams.set('lon', String(coords.lon));
                url.searchParams.set('rangeDeg', '2');
                const res = await fetch(url.toString());
                if (!res.ok) throw new Error('Failed to fetch data');
                const data = await res.json();
                if (!aborted) setSingleRecords(Array.isArray(data) ? data : []);
            } catch (err) {
                if (!aborted) setSingleError(err.message);
            } finally {
                if (!aborted) setSingleLoading(false);
            }
        }
        
        fetchSingleData();
        return () => { aborted = true; };
    }, [coords, isComparisonMode]);

    // ── Comparison Data Fetching ──
    useEffect(() => {
        if (!isComparisonMode) return;
        let aborted = false;

        async function fetchComparisonData() {
            try {
                setCompareLoading(true);
                setCompareError(null);
                const res = await fetch(`${API_BASE}/compare`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ locations: comparisonLocations }),
                });
                if (!res.ok) throw new Error('Failed to fetch comparison data');
                const json = await res.json();
                if (!aborted) setCompareData(json.locations || []);
            } catch (err) {
                if (!aborted) setCompareError(err.message);
            } finally {
                if (!aborted) setCompareLoading(false);
            }
        }

        fetchComparisonData();
        return () => { aborted = true; };
    }, [comparisonLocations, isComparisonMode]);

    // Single-location statistics & series
    const totalSingle = singleRecords.length;
    const avgTempSingle = singleRecords.reduce((s, r) => s + (Number(r.temperature) || 0), 0) / (totalSingle || 1);
    const avgSalSingle = singleRecords.reduce((s, r) => s + (Number(r.salinity) || 0), 0) / (totalSingle || 1);
    const maxDepthSingle = singleRecords.reduce((m, r) => Math.max(m, Number(r.depth) || 0), 0);

    function buildSingleSeries(metricKey) {
        const pts = singleRecords
            .map(r => ({ x: Number(r.depth), y: Number(r[metricKey]) }))
            .filter(d => Number.isFinite(d.x) && Number.isFinite(d.y));
        pts.sort((a, b) => a.x - b.x);
        const res = [];
        let currGroup = [];
        for (let i = 0; i < pts.length; i++) {
            currGroup.push(pts[i]);
            if (i === pts.length - 1 || Math.abs(pts[i + 1].x - pts[i].x) > 20) {
                const avgX = currGroup.reduce((s, p) => s + p.x, 0) / currGroup.length;
                const avgY = currGroup.reduce((s, p) => s + p.y, 0) / currGroup.length;
                res.push({ x: avgX, y: avgY });
                currGroup = [];
            }
        }
        return res;
    }

    const singleTemp = buildSingleSeries('temperature');
    const singleSal = buildSingleSeries('salinity');
    const singleOxy = buildSingleSeries('oxygen');

    // Comparison series
    const compTempSeries = (compareData || []).map((loc, idx) => ({
        label: loc.label,
        color: SERIES_COLORS[idx % SERIES_COLORS.length],
        data: buildMultiSeries(loc.records || [], 'temperature'),
    }));
    const compSalSeries = (compareData || []).map((loc, idx) => ({
        label: loc.label,
        color: SERIES_COLORS[idx % SERIES_COLORS.length],
        data: buildMultiSeries(loc.records || [], 'salinity'),
    }));
    const compOxySeries = (compareData || []).map((loc, idx) => ({
        label: loc.label,
        color: SERIES_COLORS[idx % SERIES_COLORS.length],
        data: buildMultiSeries(loc.records || [], 'oxygen'),
    }));

    const hasCompareData = (compareData || []).some(loc => (loc.records || []).length > 0);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="fixed top-0 bottom-0 left-0 z-50 flex flex-col"
                    style={{
                        width: '420px',
                        backgroundColor: 'rgba(4, 14, 30, 0.72)',
                        backdropFilter: 'blur(24px)',
                        WebkitBackdropFilter: 'blur(24px)',
                        borderRight: '1px solid rgba(0, 212, 255, 0.12)',
                        boxShadow: '8px 0 32px rgba(0, 0, 0, 0.5)'
                    }}
                    initial={{ x: -420 }}
                    animate={{ x: 0 }}
                    exit={{ x: -420 }}
                    transition={{ type: 'spring', damping: 24, stiffness: 200 }}
                >
                    {/* Panel Header */}
                    <div className="flex items-center justify-between p-5 border-b border-white/5 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#00d4ff]/10 flex items-center justify-center border border-[#00d4ff]/20">
                                {isComparisonMode ? (
                                    <GitCompare size={16} className="text-[#00d4ff]" />
                                ) : (
                                    <MapPin size={16} className="text-[#00d4ff]" />
                                )}
                            </div>
                            <div>
                                <h2 className="text-white font-semibold text-lg leading-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                                    {isComparisonMode ? 'Region Comparison' : 'Region Analysis'}
                                </h2>
                                <p className="text-[#00d4ff]/60 text-xs mt-0.5">
                                    {isComparisonMode ? (
                                        `${comparisonLocations.length} locations selected`
                                    ) : coords ? (
                                        `${Math.abs(coords.lat).toFixed(2)}°${coords.lat >= 0 ? 'N' : 'S'}, ${Math.abs(coords.lon).toFixed(2)}°${coords.lon >= 0 ? 'E' : 'W'}`
                                    ) : ''}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 text-white/50 hover:text-white hover:bg-white/5 rounded-full transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Content Scrollable Area */}
                    <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                        {isComparisonMode ? (
                            /* ── MULTI-LOCATION COMPARISON VIEW ── */
                            compareLoading ? (
                                <div className="flex flex-col items-center justify-center h-40 space-y-4">
                                    <div className="w-8 h-8 border-2 border-[#00d4ff]/30 border-t-[#00d4ff] rounded-full animate-spin" />
                                    <p className="text-white/50 text-sm">Fetching comparison profiles...</p>
                                </div>
                            ) : compareError ? (
                                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                                    {compareError}
                                </div>
                            ) : !hasCompareData ? (
                                <div className="flex flex-col items-center justify-center h-40 text-center">
                                    <Activity size={32} className="text-white/20 mb-3" />
                                    <p className="text-white/60">No float data found for comparison.</p>
                                    <p className="text-white/40 text-xs mt-1">Try selecting different ocean regions.</p>
                                </div>
                            ) : (
                                <div className="space-y-6 pb-20">
                                    {/* Per-location Mini Stats Grid */}
                                    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(compareData.length, 2)}, 1fr)` }}>
                                        {compareData.map((loc, idx) => {
                                            const recs = loc.records || [];
                                            const avgTemp = recs.length ? recs.reduce((s, r) => s + (Number(r.temperature) || 0), 0) / recs.length : 0;
                                            const avgSal = recs.length ? recs.reduce((s, r) => s + (Number(r.salinity) || 0), 0) / recs.length : 0;
                                            const color = SERIES_COLORS[idx % SERIES_COLORS.length];
                                            return (
                                                <div
                                                    key={idx}
                                                    className="rounded-xl p-3"
                                                    style={{ background: `${color}08`, border: `1px solid ${color}20` }}
                                                >
                                                    <p className="text-[11px] font-bold mb-1.5 truncate" style={{ color }}>
                                                        {loc.label}
                                                    </p>
                                                    <div className="space-y-0.5 text-[11px]" style={{ color: 'rgba(232,244,253,0.75)' }}>
                                                        <div className="flex justify-between">
                                                            <span style={{ color: 'rgba(232,244,253,0.4)' }}>Temp</span>
                                                            <span className="font-medium">{avgTemp.toFixed(1)}°C</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span style={{ color: 'rgba(232,244,253,0.4)' }}>Salinity</span>
                                                            <span className="font-medium">{avgSal.toFixed(2)} PSU</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span style={{ color: 'rgba(232,244,253,0.4)' }}>Obs</span>
                                                            <span className="font-medium">{recs.length}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Legend */}
                                    <ComparisonLegend locations={compareData.map((loc, idx) => ({ label: loc.label, isFallback: loc.isFallback }))} />

                                    {/* Multi-line Charts */}
                                    <div className="space-y-4">
                                        {compTempSeries.some(s => s.data.length > 0) && (
                                            <MultiLineChart
                                                seriesList={compTempSeries}
                                                title="Temperature vs Depth"
                                                icon={<Thermometer size={14} />}
                                                color="#ff3366"
                                                yUnit="°C"
                                            />
                                        )}
                                        {compSalSeries.some(s => s.data.length > 0) && (
                                            <MultiLineChart
                                                seriesList={compSalSeries}
                                                title="Salinity vs Depth"
                                                icon={<Droplets size={14} />}
                                                color="#00ffcc"
                                                yUnit="PSU"
                                            />
                                        )}
                                        {compOxySeries.some(s => s.data.length > 0) && (
                                            <MultiLineChart
                                                seriesList={compOxySeries}
                                                title="Oxygen vs Depth"
                                                icon={<Activity size={14} />}
                                                color="#00d4ff"
                                                yUnit="µmol/kg"
                                            />
                                        )}
                                    </div>
                                </div>
                            )
                        ) : (
                            /* ── SINGLE LOCATION VIEW ── */
                            singleLoading ? (
                                <div className="flex flex-col items-center justify-center h-40 space-y-4">
                                    <div className="w-8 h-8 border-2 border-[#00d4ff]/30 border-t-[#00d4ff] rounded-full animate-spin" />
                                    <p className="text-white/50 text-sm">Fetching region data...</p>
                                </div>
                            ) : singleError ? (
                                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                                    {singleError}
                                </div>
                            ) : totalSingle === 0 ? (
                                <div className="flex flex-col items-center justify-center h-40 text-center">
                                    <Activity size={32} className="text-white/20 mb-3" />
                                    <p className="text-white/60">No float data found in this region.</p>
                                    <p className="text-white/40 text-xs mt-1">Try expanding the search or selecting a different point.</p>
                                </div>
                            ) : (
                                <div className="space-y-6 pb-20">
                                    {/* Key Metrics Grid */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <StatCard
                                            label="Total Profiles"
                                            value={totalSingle.toLocaleString()}
                                            icon={<Activity size={14} />}
                                            color="#00d4ff"
                                        />
                                        <StatCard
                                            label="Avg Temp"
                                            value={avgTempSingle.toFixed(1)}
                                            unit="°C"
                                            icon={<Thermometer size={14} />}
                                            color="#ff3366"
                                        />
                                        <StatCard
                                            label="Avg Salinity"
                                            value={avgSalSingle.toFixed(2)}
                                            unit="PSU"
                                            icon={<Droplets size={14} />}
                                            color="#00ffcc"
                                        />
                                        <StatCard
                                            label="Max Depth"
                                            value={maxDepthSingle.toFixed(0)}
                                            unit="m"
                                            icon={<Layers size={14} />}
                                            color="#9933ff"
                                        />
                                    </div>

                                    {/* Single Location Charts */}
                                    <div className="space-y-4">
                                        {singleTemp.length > 0 && (
                                            <LineChart
                                                data={singleTemp}
                                                title="Temperature vs Depth"
                                                color="#ff3366"
                                                icon={<Thermometer size={14} />}
                                            />
                                        )}
                                        {singleSal.length > 0 && (
                                            <LineChart
                                                data={singleSal}
                                                title="Salinity vs Depth"
                                                color="#00ffcc"
                                                icon={<Droplets size={14} />}
                                            />
                                        )}
                                        {singleOxy.length > 0 && (
                                            <LineChart
                                                data={singleOxy}
                                                title="Oxygen vs Depth"
                                                color="#00d4ff"
                                                icon={<Activity size={14} />}
                                            />
                                        )}
                                    </div>
                                </div>
                            )
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
