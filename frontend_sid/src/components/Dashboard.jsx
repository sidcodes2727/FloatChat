import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { motion } from 'framer-motion';
import { Activity, Thermometer, Droplets, Layers, SlidersHorizontal, TrendingUp, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { API_BASE } from '../config';

import { LineChart, StatCard } from './ChartWidgets';

/* ─── Dashboard ─── */
function Dashboard() {
    const [allRecords, setAllRecords] = useState([]);
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isExporting, setIsExporting] = useState(false);
    const dashboardRef = useRef(null);

    const [lat, setLat] = useState('0');
    const [lon, setLon] = useState('0');
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
        const latNum = parseFloat(lat);
        const lonNum = parseFloat(lon);
        const rangeNum = rangeDeg === '' ? 5 : parseFloat(rangeDeg);
        const hasFinite = Number.isFinite(latNum) && Number.isFinite(lonNum) && Number.isFinite(rangeNum);
        if (!hasFinite) { setRecords(allRecords); return; }
        let aborted = false;
        async function fetchProfiles() {
            try {
                setLoading(true);
                const url = new URL(`${API_BASE}/profiles`);
                url.searchParams.set('lat', String(latNum));
                url.searchParams.set('lon', String(lonNum));
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

    useEffect(() => {
        console.log('Series sizes -> temp:', tempData.length, 'sal:', salData.length, 'oxy:', oxyData.length);
    }, [tempData, salData, oxyData]);

    const exportToPDF = async () => {
        setIsExporting(true);
        try {
            const pdf = new jsPDF('p', 'pt', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            
            // 1. Header and Metadata
            const currentDateTime = new Date().toLocaleString();
            
            pdf.setFontSize(12);
            pdf.setTextColor(120, 120, 120);
            pdf.text('FloatChat Analytics', 40, 35);
            
            const dateWidth = pdf.getStringUnitWidth(currentDateTime) * pdf.internal.getFontSize();
            pdf.text(currentDateTime, pageWidth - 40 - dateWidth, 35);
            
            pdf.setFontSize(24);
            pdf.setTextColor(0, 150, 200); // Ocean blue
            pdf.text('Ocean Depth Profiles Report', 40, 60);
            
            pdf.setDrawColor(0, 150, 200);
            pdf.setLineWidth(1.5);
            pdf.line(40, 75, pageWidth - 40, 75);
            
            pdf.setFontSize(11);
            pdf.setTextColor(60, 60, 60);
            pdf.text(`Location: ${lat}°, ${lon}°`, 40, 100);
            pdf.text(`Search Radius: ${rangeDeg || 5}°`, 240, 100);
            
            pdf.text(`Total Records: ${total.toLocaleString()}`, 40, 120);
            pdf.text(`Max Depth: ${maxDepth.toFixed(0)} m`, 240, 120);
            
            pdf.text(`Avg Temperature: ${avgTemp.toFixed(2)} °C`, 40, 140);
            pdf.text(`Avg Salinity: ${avgSal.toFixed(2)} PSU`, 240, 140);
            
            // 2. Data Table (Limit to 150 rows)
            const tableData = filtered.slice(0, 150).map(r => [
                r.depth ? Number(r.depth).toFixed(1) : '-',
                r.temperature ? Number(r.temperature).toFixed(2) : '-',
                r.salinity ? Number(r.salinity).toFixed(2) : '-',
                r.oxygen ? Number(r.oxygen).toFixed(2) : '-'
            ]);
            
            autoTable(pdf, {
                startY: 160,
                head: [['Depth (m)', 'Temperature (°C)', 'Salinity (PSU)', 'Oxygen']],
                body: tableData,
                theme: 'striped',
                headStyles: { fillColor: [0, 150, 200] },
                styles: { fontSize: 9, cellPadding: 4 },
                margin: { top: 40, right: 40, bottom: 40, left: 40 }
            });
            
            // 3. Append Charts
            const chartIds = ['chart-temp', 'chart-sal', 'chart-oxy'];
            let currentY = 50;
            pdf.addPage();
            
            for (let i = 0; i < chartIds.length; i++) {
                const chartElement = document.getElementById(chartIds[i]);
                if (chartElement) {
                    if (currentY > 500) {
                        pdf.addPage();
                        currentY = 50;
                    }
                    
                    pdf.setFontSize(14);
                    pdf.setTextColor(40, 40, 40);
                    
                    let title = "Chart";
                    if (chartIds[i] === 'chart-temp') title = "Temperature Profile Overview";
                    if (chartIds[i] === 'chart-sal') title = "Salinity Profile Overview";
                    if (chartIds[i] === 'chart-oxy') title = "Oxygen Profile Overview";
                    
                    pdf.text(title, 40, currentY);
                    
                    const canvas = await html2canvas(chartElement, { scale: 2, backgroundColor: '#020813' });
                    const imgData = canvas.toDataURL('image/png');
                    const imgWidth = 460;
                    const imgHeight = (canvas.height * imgWidth) / canvas.width;
                    const xOffset = (pageWidth - imgWidth) / 2;
                    
                    pdf.addImage(imgData, 'PNG', xOffset, currentY + 15, imgWidth, imgHeight);
                    currentY += imgHeight + 60;
                }
            }
            
            pdf.save('depth_profiles_report.pdf');
        } catch (err) {
            console.error('Failed to export PDF', err);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">

            {/* ── Filter Section ── */}
            <motion.div
                className="card p-5"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >
                <div className="flex items-center gap-2 mb-4">
                    <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.18)' }}
                    >
                        <SlidersHorizontal size={14} style={{ color: '#00d4ff' }} />
                    </div>
                    <h3
                        className="text-sm font-semibold text-white"
                        style={{ fontFamily: "'Space Grotesk', Inter, sans-serif" }}
                    >
                        Filter by Location
                    </h3>
                    <div className="ml-auto flex items-center gap-3">
                        <div
                            className="text-xs px-2.5 py-1 rounded-full"
                            style={{ background: 'rgba(0,212,255,0.08)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.15)' }}
                        >
                            {filtered.length} records
                        </div>
                        <button
                            onClick={exportToPDF}
                            disabled={isExporting}
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md cursor-pointer transition-colors"
                            style={{ background: '#00d4ff', color: '#020813', fontWeight: 600, border: 'none', opacity: isExporting ? 0.7 : 1 }}
                        >
                            <Download size={14} />
                            {isExporting ? 'Exporting...' : 'Export PDF'}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: 'Latitude', value: lat, onChange: e => setLat(e.target.value), step: '0.01', type: 'number' },
                        { label: 'Longitude', value: lon, onChange: e => setLon(e.target.value), step: '0.01', type: 'number' },
                        { label: 'Range (°)', value: rangeDeg, onChange: e => setRangeDeg(e.target.value), step: '0.1', placeholder: 'No filter', type: 'number' },
                    ].map(f => (
                        <div key={f.label}>
                            <label
                                className="block text-[10px] uppercase tracking-wider font-semibold mb-1.5"
                                style={{ color: 'rgba(232,244,253,0.4)' }}
                            >
                                {f.label}
                            </label>
                            <input
                                type={f.type}
                                step={f.step}
                                value={f.value}
                                onChange={f.onChange}
                                placeholder={f.placeholder}
                                min={f.min}
                                className="input-field"
                            />
                        </div>
                    ))}
                </div>
            </motion.div>

            {/* ── Stat Cards ── */}
            <motion.div
                className="grid grid-cols-2 lg:grid-cols-4 gap-3"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.4 }}
            >
                <StatCard
                    label="Total Records"
                    value={loading ? '—' : total.toLocaleString()}
                    icon={<Activity size={14} />}
                    color="#00d4ff"
                />
                <StatCard
                    label="Avg Temperature"
                    value={loading ? '—' : avgTemp.toFixed(2)}
                    unit="°C"
                    icon={<Thermometer size={14} />}
                    color="#f97316"
                />
                <StatCard
                    label="Avg Salinity"
                    value={loading ? '—' : avgSal.toFixed(2)}
                    unit="PSU"
                    icon={<Droplets size={14} />}
                    color="#7c3aed"
                />
                <StatCard
                    label="Max Depth"
                    value={loading ? '—' : maxDepth.toFixed(0)}
                    unit="m"
                    icon={<Layers size={14} />}
                    color="#22c55e"
                />
            </motion.div>

            {error && (
                <div
                    className="px-4 py-3 rounded-xl text-sm"
                    style={{ color: 'rgba(248,113,113,0.9)', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}
                >
                    Error: {error}
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
                        <div key={i} className="card p-5">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="skeleton w-7 h-7 rounded-lg" />
                                <div className="skeleton h-3 w-32 rounded" />
                            </div>
                            <div className="skeleton w-full rounded" style={{ height: 220 }} />
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
                            id="chart-temp"
                            title="Temperature vs Depth"
                            data={tempData}
                            color="#f97316"
                            xLabel="Depth (m)"
                            yLabel="Temperature (°C)"
                            icon={<Thermometer size={14} />}
                        />
                    ) : (
                        <div className="card p-5 flex flex-col items-center justify-center min-h-[200px] gap-3">
                            <Thermometer size={24} style={{ color: 'rgba(232,244,253,0.2)' }} />
                            <p className="text-sm" style={{ color: 'rgba(232,244,253,0.3)' }}>No temperature data</p>
                        </div>
                    )}

                    {salData.length > 0 ? (
                        <LineChart
                            id="chart-sal"
                            title="Salinity vs Depth"
                            data={salData}
                            color="#7c3aed"
                            xLabel="Depth (m)"
                            yLabel="Salinity (PSU)"
                            icon={<Droplets size={14} />}
                        />
                    ) : (
                        <div className="card p-5 flex flex-col items-center justify-center min-h-[200px] gap-3">
                            <Droplets size={24} style={{ color: 'rgba(232,244,253,0.2)' }} />
                            <p className="text-sm" style={{ color: 'rgba(232,244,253,0.3)' }}>No salinity data</p>
                        </div>
                    )}

                    {oxyData.length > 0 ? (
                        <LineChart
                            id="chart-oxy"
                            title="Oxygen vs Depth"
                            data={oxyData}
                            color="#22c55e"
                            xLabel="Depth (m)"
                            yLabel="Oxygen"
                            icon={<Activity size={14} />}
                        />
                    ) : (
                        <div className="card p-5 flex flex-col items-center justify-center min-h-[200px] gap-3">
                            <Activity size={24} style={{ color: 'rgba(232,244,253,0.2)' }} />
                            <p className="text-sm" style={{ color: 'rgba(232,244,253,0.3)' }}>No oxygen data</p>
                        </div>
                    )}
                </motion.div>
            )}
        </div>
    );
}

export default Dashboard;
