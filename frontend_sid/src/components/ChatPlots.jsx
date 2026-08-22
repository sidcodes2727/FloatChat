import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Activity, Thermometer, Droplets, Layers } from 'lucide-react';
import { MultiLineChart, StatCard } from './ChartWidgets';

const COLORS = [
    'var(--color-royal-blue)',
    'var(--color-periwinkle)',
    'var(--color-deep-navy)',
    '#3b82f6', // Tailwind blue-500
];

export default function ChatPlots({ data, isOpen, onClose }) {
  const tempDatasets = [];
  const salDatasets = [];
  const oxyDatasets = [];

  function buildSeries(rawPoints, metricKey) {
      if (!rawPoints) return [];
      const pts = rawPoints
          .map(r => ({ x: Number(r.depth), y: Number(r[metricKey]) }))
          .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
      pts.sort((a, b) => a.x - b.x);
      return pts;
  }

  if (data && Array.isArray(data)) {
      data.forEach((summary, idx) => {
          const regionName = summary.region.name || `Region ${idx + 1}`;
          const color = COLORS[idx % COLORS.length];
          const rawPoints = summary.points || [];

          const tempSeries = buildSeries(rawPoints, 'temperature');
          if (tempSeries.length > 0) {
              tempDatasets.push({ name: regionName, color, data: tempSeries });
          }

          const salSeries = buildSeries(rawPoints, 'salinity');
          if (salSeries.length > 0) {
              salDatasets.push({ name: regionName, color, data: salSeries });
          }

          const oxySeries = buildSeries(rawPoints, 'oxygen');
          if (oxySeries.length > 0) {
              oxyDatasets.push({ name: regionName, color, data: oxySeries });
          }
      });
  }

  return (
    <AnimatePresence>
      {isOpen && data && data.length > 0 && (
        <motion.div
        initial={{ opacity: 0, x: -50, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: -50, scale: 0.95 }}
        transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
        className="fixed top-24 left-4 md:left-6 z-40 w-[calc(100vw-2rem)] md:w-[600px] flex flex-col overflow-hidden bg-background border border-border shadow-2xl rounded-2xl"
        style={{
          maxHeight: 'calc(100vh - 120px)',
        }}
      >
        <div className="flex items-center justify-between px-6 py-4 shrink-0 border-b border-border bg-muted/30">
            <h3 className="text-sm font-bold text-foreground tracking-wide uppercase font-display">Ocean Data Comparison</h3>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground hover:bg-muted p-1.5 rounded-md transition-colors">
              <X size={16} />
            </button>
        </div>

        <div className="p-6 space-y-8 overflow-y-auto w-full">
            {/* Stat Cards for all regions */}
            <div className="space-y-6">
                {data.map((summary, idx) => {
                    const regionName = summary.region.name || `Region ${idx + 1}`;
                    const color = COLORS[idx % COLORS.length];
                    return (
                        <div key={idx} className="bg-muted/20 p-4 rounded-xl border border-border">
                            <div className="flex items-center gap-2 mb-3">
                               <div className="w-3 h-3 rounded-sm" style={{ background: color }}></div>
                               <h4 className="text-foreground font-bold text-sm uppercase tracking-widest font-mono opacity-90">{regionName}</h4>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <StatCard
                                    label="Total Records"
                                    value={summary.totals}
                                    icon={<Activity size={12} />}
                                    color={color}
                                />
                                {summary.temperature ? (
                                    <StatCard
                                        label="Avg Temp"
                                        value={summary.temperature.mean}
                                        unit="°C"
                                        icon={<Thermometer size={12} />}
                                        color={color}
                                    />
                                ) : null}
                                {summary.salinity ? (
                                    <StatCard
                                        label="Avg Salinity"
                                        value={summary.salinity.mean}
                                        unit="PSU"
                                        icon={<Droplets size={12} />}
                                        color={color}
                                    />
                                ) : null}
                                {summary.depth ? (
                                    <StatCard
                                        label="Max Depth"
                                        value={summary.depth.max}
                                        unit="m"
                                        icon={<Layers size={12} />}
                                        color={color}
                                    />
                                ) : null}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Unified Multi-Line Area Charts */}
            {(tempDatasets.length > 0 || salDatasets.length > 0 || oxyDatasets.length > 0) && (
                <div className="grid grid-cols-1 gap-6 pt-6 border-t border-border">
                    <h4 className="text-muted-foreground font-semibold text-xs tracking-widest font-mono uppercase mb-1">Comparison Charts</h4>
                    
                    {tempDatasets.length > 0 && (
                        <MultiLineChart
                            title="Temperature vs Depth"
                            datasets={tempDatasets}
                            xLabel="Depth (m)"
                            yLabel="Temperature (°C)"
                            icon={<Thermometer size={16} />}
                        />
                    )}
                    {salDatasets.length > 0 && (
                        <MultiLineChart
                            title="Salinity vs Depth"
                            datasets={salDatasets}
                            xLabel="Depth (m)"
                            yLabel="Salinity (PSU)"
                            icon={<Droplets size={16} />}
                        />
                    )}
                    {oxyDatasets.length > 0 && (
                        <MultiLineChart
                            title="Oxygen vs Depth"
                            datasets={oxyDatasets}
                            xLabel="Depth (m)"
                            yLabel="Oxygen"
                            icon={<Activity size={16} />}
                        />
                    )}
                </div>
            )}
        </div>
      </motion.div>
      )}
    </AnimatePresence>
  );
}
