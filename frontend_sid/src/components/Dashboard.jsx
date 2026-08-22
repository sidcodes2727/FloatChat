import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, Thermometer, Droplets, Layers, SlidersHorizontal } from 'lucide-react';
import { API_BASE } from '../config';

import { LineChart, StatCard } from './ChartWidgets';
import { cn } from '../lib/utils';

function Dashboard() {
    const [allRecords, setAllRecords] = useState([]);
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [lat, setLat] = useState(0);
    const [lon, setLon] = useState(0);
    const [rangeDeg, setRangeDeg] = useState('');

    useEffect(() => {
        async function load() {
            try {
                setLoading(true);
                const res = await fetch(`${API_BASE}/everything`);
                const data = await res.json();
                const arr = Array.isArray(data) ? data : [];
                setAllRecords(arr);
                setRecords(arr);
            } catch (e) {
                setError(e.message || 'Failed to load');
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    useEffect(() => {
        const rangeNum = typeof rangeDeg === 'string' ? parseFloat(rangeDeg) : rangeDeg;
        const hasFinite = Number.isFinite(lat) && Number.isFinite(lon) && Number.isFinite(rangeNum);
        if (!hasFinite) { setRecords(allRecords); return; }
        let aborted = false;
        async function fetchProfiles() {
            try {
                setLoading(true);
                const url = new URL(`${API_BASE}/profiles`);
                url.searchParams.set('lat', String(lat));
                url.searchParams.set('lon', String(lon));
                url.searchParams.set('rangeDeg', String(rangeNum));
                const res = await fetch(url.toString());
                const data = await res.json();
                if (!aborted) setRecords(Array.isArray(data) ? data : []);
            } catch (e) {
                if (!aborted) setError(e.message || 'Failed to load filtered data');
            } finally {
                if (!aborted) setLoading(false);
            }
        }
        fetchProfiles();
        return () => { aborted = true; };
    }, [lat, lon, rangeDeg, allRecords]);

    const filtered = records;
    const total = records.length;
    const avgTemp = records.reduce((s, r) => s + (Number(r.temperature) || 0), 0) / (total || 1);
    const avgSal = records.reduce((s, r) => s + (Number(r.salinity) || 0), 0) / (total || 1);
    const maxDepth = records.reduce((m, r) => Math.max(m, Number(r.depth) || 0), 0);

    function buildSeries(metricKey) {
        const pts = filtered
            .map(r => ({ x: Number(r.depth), y: Number(r[metricKey]) }))
            .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
        pts.sort((a, b) => a.x - b.x);
        return pts;
    }

    const tempData = useMemo(() => buildSeries('temperature'), [filtered]);
    const salData = useMemo(() => buildSeries('salinity'), [filtered]);
    const oxyData = useMemo(() => buildSeries('oxygen'), [filtered]);

    return (
        <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto bg-background text-foreground rounded-xl border border-border mt-6">

            {/* ── Filter Section ── */}
            <motion.div
                className="card p-6 border border-border rounded-lg bg-background"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >
                <div className="flex items-center gap-3 mb-6 border-b border-border pb-4">
                    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-periwinkle">
                        <SlidersHorizontal size={16} />
                    </div>
                    <h3 className="text-base font-medium font-display tracking-wide flex-1">
                        Telemetry Filter Parameters
                    </h3>
                    <div className="text-[10px] px-3 py-1.5 rounded bg-muted font-mono uppercase tracking-widest text-muted-foreground border border-border">
                        {filtered.length} active records
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                        { label: 'Latitude', value: lat, onChange: e => setLat(parseFloat(e.target.value)), step: '0.01', type: 'number' },
                        { label: 'Longitude', value: lon, onChange: e => setLon(parseFloat(e.target.value)), step: '0.01', type: 'number' },
                        { label: 'Radius (°)', value: rangeDeg, onChange: e => { const v = e.target.value; setRangeDeg(v === '' ? '' : parseFloat(v)); }, step: '0.1', placeholder: 'Global', type: 'number' },
                    ].map(f => (
                        <div key={f.label}>
                            <label className="block text-[10px] uppercase tracking-widest font-mono mb-2 text-muted-foreground font-semibold">
                                {f.label}
                            </label>
                            <input
                                type={f.type}
                                step={f.step}
                                value={f.value}
                                onChange={f.onChange}
                                placeholder={f.placeholder}
                                min={f.min}
                                className="w-full bg-background border border-border rounded-md px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-periwinkle focus:ring-1 focus:ring-periwinkle transition-all"
                            />
                        </div>
                    ))}
                </div>
            </motion.div>

            {/* ── Stat Cards ── */}
            <motion.div
                className="grid grid-cols-2 lg:grid-cols-4 gap-4"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.4 }}
            >
                <StatCard
                    label="Total Records"
                    value={loading ? '—' : total.toLocaleString()}
                    icon={<Activity size={16} />}
                    color="var(--color-periwinkle)"
                />
                <StatCard
                    label="Avg Temperature"
                    value={loading ? '—' : avgTemp.toFixed(2)}
                    unit="°C"
                    icon={<Thermometer size={16} />}
                    color="var(--color-light-ocean)"
                />
                <StatCard
                    label="Avg Salinity"
                    value={loading ? '—' : avgSal.toFixed(2)}
                    unit="PSU"
                    icon={<Droplets size={16} />}
                    color="var(--color-royal-blue)"
                />
                <StatCard
                    label="Max Depth"
                    value={loading ? '—' : maxDepth.toFixed(0)}
                    unit="m"
                    icon={<Layers size={16} />}
                    color="var(--color-deep-navy)"
                />
            </motion.div>

            {error && (
                <div className="px-4 py-3 rounded-md text-sm font-mono border border-red-200 bg-red-50 text-red-600">
                    ERROR: {error}
                </div>
            )}

            {/* ── Loading Skeleton ── */}
            {loading && (
                <motion.div
                    className="grid grid-cols-1 md:grid-cols-3 gap-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                >
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="card p-5 border border-border bg-background">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-8 h-8 rounded bg-muted animate-pulse" />
                                <div className="h-4 w-32 rounded bg-muted animate-pulse" />
                            </div>
                            <div className="w-full rounded bg-muted animate-pulse" style={{ height: 220 }} />
                        </div>
                    ))}
                </motion.div>
            )}

            {/* ── Charts ── */}
            {!loading && (
                <motion.div
                    className="grid grid-cols-1 md:grid-cols-3 gap-4"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.45 }}
                >
                    {tempData.length > 0 ? (
                        <LineChart
                            title="Temperature vs Depth"
                            data={tempData}
                            color="var(--color-periwinkle)"
                            xLabel="Depth (m)"
                            yLabel="Temperature (°C)"
                            icon={<Thermometer size={16} />}
                        />
                    ) : (
                        <div className="card p-5 flex flex-col items-center justify-center min-h-[200px] gap-3 bg-background border border-border">
                            <Thermometer size={24} className="text-muted" />
                            <p className="text-xs font-mono text-muted-foreground tracking-widest">NO_DATA_FOUND</p>
                        </div>
                    )}

                    {salData.length > 0 ? (
                        <LineChart
                            title="Salinity vs Depth"
                            data={salData}
                            color="var(--color-royal-blue)"
                            xLabel="Depth (m)"
                            yLabel="Salinity (PSU)"
                            icon={<Droplets size={16} />}
                        />
                    ) : (
                        <div className="card p-5 flex flex-col items-center justify-center min-h-[200px] gap-3 bg-background border border-border">
                            <Droplets size={24} className="text-muted" />
                            <p className="text-xs font-mono text-muted-foreground tracking-widest">NO_DATA_FOUND</p>
                        </div>
                    )}

                    {oxyData.length > 0 ? (
                        <LineChart
                            title="Oxygen vs Depth"
                            data={oxyData}
                            color="var(--color-deep-navy)"
                            xLabel="Depth (m)"
                            yLabel="Oxygen"
                            icon={<Activity size={16} />}
                        />
                    ) : (
                        <div className="card p-5 flex flex-col items-center justify-center min-h-[200px] gap-3 bg-background border border-border">
                            <Activity size={24} className="text-muted" />
                            <p className="text-xs font-mono text-muted-foreground tracking-widest">NO_DATA_FOUND</p>
                        </div>
                    )}
                </motion.div>
            )}
        </div>
    );
}

export default Dashboard;
