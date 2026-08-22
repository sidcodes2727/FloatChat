import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as d3 from 'd3';
import { X, GitCompare, Thermometer, Droplets, Activity, TrendingUp } from 'lucide-react';
import { API_BASE } from '../config';

// Vibrant, perceptually distinct palette for multi-line charts
const SERIES_COLORS = [
    '#00d4ff', // cyan
    '#ff3366', // coral
    '#00ffcc', // mint
    '#ffaa00', // amber
    '#9933ff', // purple
    '#ff6b35', // orange
];

/* ─── Build depth-averaged series from raw records ─── */
function buildSeries(records, metricKey) {
    const pts = records
        .map(r => ({ x: Number(r.depth), y: Number(r[metricKey]) }))
        .filter(d => Number.isFinite(d.x) && Number.isFinite(d.y) && d.x >= 0);
    pts.sort((a, b) => a.x - b.x);

    // Bin by 25m intervals
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

/* ─── Multi-series SVG chart ─── */
function MultiLineChart({ seriesList, title, icon, color, yUnit = '' }) {
    const svgRef = useRef();
    const containerRef = useRef();

    useEffect(() => {
        const validSeries = seriesList.filter(s => s.data && s.data.length > 0);
        if (validSeries.length === 0) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        const containerWidth = containerRef.current?.clientWidth || 460;
        const width = Math.max(300, containerWidth - 4);
        const height = 240;
        const margin = { top: 20, right: 20, bottom: 42, left: 52 };

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
            .call(d3.axisBottom(x).ticks(6));
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
            .attr('y', 13)
            .attr('text-anchor', 'middle')
            .attr('fill', 'rgba(232,244,253,0.3)')
            .style('font-size', '9px').style('font-family', 'Inter, sans-serif')
            .text(yUnit);

        const lineGen = d3.line()
            .x(d => x(d.x))
            .y(d => y(d.y))
            .curve(d3.curveMonotoneX);

        // Draw each series
        validSeries.forEach((series, idx) => {
            const c = series.color;

            // Gradient area
            const gradId = `area-${title.replace(/\s+/g, '')}-${idx}`;
            const grad = svg.append('defs').append('linearGradient')
                .attr('id', gradId).attr('x1', '0').attr('y1', '0').attr('x2', '0').attr('y2', '1');
            grad.append('stop').attr('offset', '0%').attr('stop-color', c).attr('stop-opacity', 0.12);
            grad.append('stop').attr('offset', '100%').attr('stop-color', c).attr('stop-opacity', 0);

            const area = d3.area().x(d => x(d.x)).y0(height - margin.bottom).y1(d => y(d.y)).curve(d3.curveMonotoneX);
            svg.append('path').datum(series.data).attr('fill', `url(#${gradId})`).attr('d', area);

            // Line
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

        // Hover crosshair & multi-tooltip
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
        const tooltipLines = validSeries.map((series, idx) =>
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
                const tooltipWidth = 130;
                const tooltipHeight = padding + (validSeries.length + 1) * lineHeight + padding;

                let txPos = mx + 12;
                if (txPos + tooltipWidth > width - margin.right) txPos = mx - tooltipWidth - 12;

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
                            .text(`${series.label.length > 12 ? series.label.slice(0, 12) + '…' : series.label}: ${d.y.toFixed(2)}`);
                    }
                });
            });

    }, [seriesList, title, yUnit]);

    return (
        <div
            ref={containerRef}
            style={{
                background: 'rgba(4,14,30,0.6)',
                border: '1px solid rgba(0,212,255,0.1)',
                borderRadius: 12,
                overflow: 'hidden',
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
                <svg ref={svgRef} style={{ minWidth: 280, width: '100%' }} />
            </div>
        </div>
    );
}

/* ─── Legend ─── */
function Legend({ locations }) {
    return (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-1 pb-2">
            {locations.map((loc, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                    <span
                        className="block rounded-full"
                        style={{
                            width: 24, height: 3,
                            background: SERIES_COLORS[idx % SERIES_COLORS.length],
                            borderRadius: 2,
                            ...(idx % 3 === 2 ? { background: 'none', borderTop: `2px dashed ${SERIES_COLORS[idx % SERIES_COLORS.length]}`, height: 0 } : {}),
                        }}
                    />
                    <span className="text-[11px]" style={{ color: SERIES_COLORS[idx % SERIES_COLORS.length], opacity: 0.9 }}>
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

/* ─── Main Modal ─── */
export default function ComparisonModal({ locations: locationConfigs, onClose }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!locationConfigs || locationConfigs.length === 0) return;
        let aborted = false;
        async function fetchComparison() {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`${API_BASE}/compare`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ locations: locationConfigs }),
                });
                if (!res.ok) throw new Error('Failed to fetch comparison data');
                const json = await res.json();
                if (!aborted) setData(json.locations || []);
            } catch (e) {
                if (!aborted) setError(e.message);
            } finally {
                if (!aborted) setLoading(false);
            }
        }
        fetchComparison();
        return () => { aborted = true; };
    }, [locationConfigs]);

    // Build series arrays for each chart type
    const tempSeries = (data || []).map((loc, idx) => ({
        label: loc.label,
        color: SERIES_COLORS[idx % SERIES_COLORS.length],
        data: buildSeries(loc.records || [], 'temperature'),
    }));
    const salSeries = (data || []).map((loc, idx) => ({
        label: loc.label,
        color: SERIES_COLORS[idx % SERIES_COLORS.length],
        data: buildSeries(loc.records || [], 'salinity'),
    }));
    const oxySeries = (data || []).map((loc, idx) => ({
        label: loc.label,
        color: SERIES_COLORS[idx % SERIES_COLORS.length],
        data: buildSeries(loc.records || [], 'oxygen'),
    }));

    const hasAnyData = (data || []).some(loc => (loc.records || []).length > 0);

    return (
        <AnimatePresence>
            {locationConfigs && locationConfigs.length > 0 && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        className="fixed inset-0 z-[60]"
                        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />

                    {/* Modal */}
                    <motion.div
                        className="fixed inset-x-4 top-[5vh] bottom-[5vh] z-[61] flex flex-col md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[700px] md:max-w-[90vw] rounded-2xl overflow-hidden"
                        style={{
                            background: 'linear-gradient(160deg, rgba(6,18,40,0.98), rgba(3,10,22,0.99))',
                            border: '1px solid rgba(0,212,255,0.2)',
                            boxShadow: '0 0 0 1px rgba(0,212,255,0.06), 0 32px 80px rgba(0,0,0,0.8), 0 0 60px rgba(0,212,255,0.08)',
                        }}
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.28, ease: [0.34, 1.56, 0.64, 1] }}
                    >
                        {/* Header */}
                        <div
                            className="flex items-center justify-between px-5 py-4 shrink-0"
                            style={{ borderBottom: '1px solid rgba(0,212,255,0.1)' }}
                        >
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                                    style={{
                                        background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(0,150,200,0.1))',
                                        border: '1px solid rgba(0,212,255,0.25)',
                                        boxShadow: '0 0 16px rgba(0,212,255,0.15)',
                                    }}
                                >
                                    <GitCompare size={18} style={{ color: '#00d4ff' }} />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                                        Location Comparison
                                    </h2>
                                    <p className="text-[11px] mt-0.5" style={{ color: 'rgba(0,212,255,0.5)' }}>
                                        {locationConfigs.length} region{locationConfigs.length > 1 ? 's' : ''} · Temperature · Salinity · Oxygen vs Depth
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
                                style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(232,244,253,0.5)' }}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,212,255,0.2) transparent' }}>
                            {loading ? (
                                <div className="flex flex-col items-center justify-center h-48 space-y-4">
                                    <div className="w-10 h-10 border-2 border-[#00d4ff]/30 border-t-[#00d4ff] rounded-full animate-spin" />
                                    <p className="text-sm" style={{ color: 'rgba(232,244,253,0.5)' }}>Fetching data for {locationConfigs.length} regions…</p>
                                </div>
                            ) : error ? (
                                <div className="p-4 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'rgba(248,113,113,0.9)' }}>
                                    {error}
                                </div>
                            ) : !hasAnyData ? (
                                <div className="flex flex-col items-center justify-center h-48 text-center">
                                    <Activity size={36} style={{ color: 'rgba(255,255,255,0.15)', marginBottom: 12 }} />
                                    <p style={{ color: 'rgba(232,244,253,0.5)' }}>No ARGO data found for these locations.</p>
                                    <p className="text-xs mt-1" style={{ color: 'rgba(232,244,253,0.3)' }}>Try different coordinates or a wider region.</p>
                                </div>
                            ) : (
                                <>
                                    {/* Stats comparison row */}
                                    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(data.length, 3)}, 1fr)` }}>
                                        {data.map((loc, idx) => {
                                            const recs = loc.records || [];
                                            const avgTemp = recs.length ? recs.reduce((s, r) => s + (Number(r.temperature) || 0), 0) / recs.length : 0;
                                            const avgSal = recs.length ? recs.reduce((s, r) => s + (Number(r.salinity) || 0), 0) / recs.length : 0;
                                            const maxDepth = recs.reduce((m, r) => Math.max(m, Number(r.depth) || 0), 0);
                                            const color = SERIES_COLORS[idx % SERIES_COLORS.length];
                                            return (
                                                <div
                                                    key={idx}
                                                    className="rounded-xl p-3"
                                                    style={{ background: `${color}08`, border: `1px solid ${color}20` }}
                                                >
                                                    <p className="text-[10px] font-semibold mb-2 truncate" style={{ color }}>
                                                        {loc.label}
                                                        {loc.isFallback && <span className="ml-1 opacity-60">(approx)</span>}
                                                    </p>
                                                    <div className="space-y-1 text-[11px]" style={{ color: 'rgba(232,244,253,0.7)' }}>
                                                        <div className="flex justify-between">
                                                            <span style={{ color: 'rgba(232,244,253,0.4)' }}>Avg Temp</span>
                                                            <span className="font-medium">{avgTemp.toFixed(1)}°C</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span style={{ color: 'rgba(232,244,253,0.4)' }}>Avg Sal</span>
                                                            <span className="font-medium">{avgSal.toFixed(2)} PSU</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span style={{ color: 'rgba(232,244,253,0.4)' }}>Max Depth</span>
                                                            <span className="font-medium">{maxDepth.toFixed(0)}m</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span style={{ color: 'rgba(232,244,253,0.4)' }}>Profiles</span>
                                                            <span className="font-medium">{recs.length.toLocaleString()}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Legend */}
                                    <Legend locations={data.map((loc, idx) => ({ label: loc.label, color: SERIES_COLORS[idx % SERIES_COLORS.length], isFallback: loc.isFallback }))} />

                                    {/* Charts */}
                                    {tempSeries.some(s => s.data.length > 0) && (
                                        <MultiLineChart
                                            seriesList={tempSeries}
                                            title="Temperature vs Depth"
                                            icon={<Thermometer size={14} />}
                                            color="#ff3366"
                                            yUnit="°C"
                                        />
                                    )}
                                    {salSeries.some(s => s.data.length > 0) && (
                                        <MultiLineChart
                                            seriesList={salSeries}
                                            title="Salinity vs Depth"
                                            icon={<Droplets size={14} />}
                                            color="#00ffcc"
                                            yUnit="PSU"
                                        />
                                    )}
                                    {oxySeries.some(s => s.data.length > 0) && (
                                        <MultiLineChart
                                            seriesList={oxySeries}
                                            title="Oxygen vs Depth"
                                            icon={<Activity size={14} />}
                                            color="#00d4ff"
                                            yUnit="µmol/kg"
                                        />
                                    )}
                                </>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
