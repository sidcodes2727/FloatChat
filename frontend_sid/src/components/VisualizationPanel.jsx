import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Activity, Thermometer, Droplets, Layers } from 'lucide-react';
import { LineChart, StatCard } from './Charts';
import { API_BASE } from '../config';

export default function VisualizationPanel({ coords, onClose }) {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!coords) return;
        let aborted = false;

        async function fetchData() {
            try {
                setLoading(true);
                setError(null);
                const url = new URL(`${API_BASE}/profiles`);
                url.searchParams.set('lat', String(coords.lat));
                url.searchParams.set('lon', String(coords.lon));
                url.searchParams.set('rangeDeg', '2'); // 2 degree bounding box
                const res = await fetch(url.toString());
                if (!res.ok) throw new Error('Failed to fetch data');
                const data = await res.json();
                if (!aborted) setRecords(Array.isArray(data) ? data : []);
            } catch (err) {
                if (!aborted) setError(err.message);
            } finally {
                if (!aborted) setLoading(false);
            }
        }
        
        fetchData();
        return () => { aborted = true; };
    }, [coords]);

    // Derived statistics
    const total = records.length;
    const avgTemp = records.reduce((s, r) => s + (Number(r.temperature) || 0), 0) / (total || 1);
    const avgSal = records.reduce((s, r) => s + (Number(r.salinity) || 0), 0) / (total || 1);
    const maxDepth = records.reduce((m, r) => Math.max(m, Number(r.depth) || 0), 0);

    function buildSeries(metricKey) {
        const pts = records
            .map(r => ({ x: Number(r.depth), y: Number(r[metricKey]) }))
            .filter(d => Number.isFinite(d.x) && Number.isFinite(d.y));
        pts.sort((a, b) => a.x - b.x);
        // smooth it roughly by averaging close depths
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

    const tempData = buildSeries('temperature');
    const salData = buildSeries('salinity');
    const oxyData = buildSeries('oxygen');

    return (
        <AnimatePresence>
            {coords && (
                <motion.div
                    className="fixed top-0 bottom-0 left-0 z-50 flex flex-col"
                    style={{
                        width: '420px',
                        backgroundColor: 'rgba(4, 14, 30, 0.65)',
                        backdropFilter: 'blur(24px)',
                        WebkitBackdropFilter: 'blur(24px)',
                        borderRight: '1px solid rgba(0, 212, 255, 0.1)',
                        boxShadow: '8px 0 32px rgba(0, 0, 0, 0.4)'
                    }}
                    initial={{ x: -420 }}
                    animate={{ x: 0 }}
                    exit={{ x: -420 }}
                    transition={{ type: 'spring', damping: 24, stiffness: 200 }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-5 border-b border-white/5">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#00d4ff]/10 flex items-center justify-center border border-[#00d4ff]/20">
                                <MapPin size={16} className="text-[#00d4ff]" />
                            </div>
                            <div>
                                <h2 className="text-white font-semibold text-lg leading-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                                    Region Analysis
                                </h2>
                                <p className="text-[#00d4ff]/60 text-xs mt-0.5">
                                    {Math.abs(coords.lat).toFixed(2)}°{coords.lat >= 0 ? 'N' : 'S'}, {Math.abs(coords.lon).toFixed(2)}°{coords.lon >= 0 ? 'E' : 'W'}
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
                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-40 space-y-4">
                                <div className="w-8 h-8 border-2 border-[#00d4ff]/30 border-t-[#00d4ff] rounded-full animate-spin" />
                                <p className="text-white/50 text-sm">Fetching region data...</p>
                            </div>
                        ) : error ? (
                            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                                {error}
                            </div>
                        ) : total === 0 ? (
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
                                        value={total.toLocaleString()}
                                        icon={<Activity size={14} />}
                                        color="#00d4ff"
                                    />
                                    <StatCard
                                        label="Avg Temp"
                                        value={avgTemp.toFixed(1)}
                                        unit="°C"
                                        icon={<Thermometer size={14} />}
                                        color="#ff3366"
                                    />
                                    <StatCard
                                        label="Avg Salinity"
                                        value={avgSal.toFixed(2)}
                                        unit="PSU"
                                        icon={<Droplets size={14} />}
                                        color="#00ffcc"
                                    />
                                    <StatCard
                                        label="Max Depth"
                                        value={maxDepth.toFixed(0)}
                                        unit="m"
                                        icon={<Layers size={14} />}
                                        color="#9933ff"
                                    />
                                </div>

                                {/* Charts */}
                                <div className="space-y-4">
                                    {tempData.length > 0 && (
                                        <LineChart
                                            data={tempData}
                                            title="Temperature vs Depth"
                                            color="#ff3366"
                                            icon={<Thermometer size={14} />}
                                        />
                                    )}
                                    {salData.length > 0 && (
                                        <LineChart
                                            data={salData}
                                            title="Salinity vs Depth"
                                            color="#00ffcc"
                                            icon={<Droplets size={14} />}
                                        />
                                    )}
                                    {oxyData.length > 0 && (
                                        <LineChart
                                            data={oxyData}
                                            title="Oxygen vs Depth"
                                            color="#00d4ff"
                                            icon={<Activity size={14} />}
                                        />
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
