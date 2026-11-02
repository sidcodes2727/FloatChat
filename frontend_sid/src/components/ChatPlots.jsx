import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Activity, Thermometer, Droplets, Layers, Download, FileText } from 'lucide-react';
import { MultiLineChart, StatCard } from './ChartWidgets';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

// High contrast palette for distinguishing regions on multi-line chart
const COLORS = [
    '#00d4ff', // Cyan
    '#f87171', // Red
    '#a3e635', // Lime
    '#facc15', // Yellow
    '#c084fc', // Purple
];

export default function ChatPlots({ data, onClose }) {
  const [isExporting, setIsExporting] = React.useState(false);

  if (!data || data.length === 0) return null;

  // Build combined datasets for the unified charts
  const tempDatasets = [];
  const salDatasets = [];
  const oxyDatasets = [];

   function buildSeries(rawPoints, metricKey) {
       if (!rawPoints) return [];
       const pts = rawPoints
           .filter(r => r.depth != null && r[metricKey] != null)
           .map(r => ({ x: Number(r.depth), y: Number(r[metricKey]) }))
           .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
           
       // Deduplicate by depth to prevent vertical lines and jagged charts when multiple floats exist
       const depthGroups = {};
       pts.forEach(p => {
           if (!depthGroups[p.x]) depthGroups[p.x] = [];
           depthGroups[p.x].push(p.y);
       });
       
       const smoothPts = Object.keys(depthGroups).map(x => {
           const yVals = depthGroups[x];
           const avgY = yVals.reduce((sum, val) => sum + val, 0) / yVals.length;
           return { x: Number(x), y: avgY };
       });
       
       smoothPts.sort((a, b) => a.x - b.x);
       return smoothPts;
   }

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

  // Time Series Fallback (if no depth data is available but we have temporal data)
  const timeTempDatasets = [];
  const timeSalDatasets = [];
  
  function buildTimeSeries(rawPoints, metricKey) {
      if (!rawPoints) return [];
      const pts = rawPoints
          .filter(r => r.time_ts != null && r[metricKey] != null)
          .map(r => ({ x: new Date(r.time_ts).getTime(), y: Number(r[metricKey]) }))
          .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
          
      // Group by exact timestamp instead of truncating to day
      const timeGroups = {};
      pts.forEach(p => {
          const time = p.x;
          if (!timeGroups[time]) timeGroups[time] = [];
          timeGroups[time].push(p.y);
      });
      
      const smoothPts = Object.keys(timeGroups).map(time => {
          const yVals = timeGroups[time];
          return { x: Number(time), y: yVals.reduce((sum, v) => sum + v, 0) / yVals.length };
      });
      smoothPts.sort((a, b) => a.x - b.x);
      return smoothPts;
  }
  
  // Only build time series if we are missing depth data entirely, to avoid chart clutter
  const missingDepth = tempDatasets.length === 0 && salDatasets.length === 0 && oxyDatasets.length === 0;
  
  if (missingDepth) {
      data.forEach((summary, idx) => {
          const regionName = summary.region.name || `Region ${idx + 1}`;
          const color = COLORS[idx % COLORS.length];
          const rawPoints = summary.points || [];
          
          const tempSeries = buildTimeSeries(rawPoints, 'temperature');
          if (tempSeries.length > 0) timeTempDatasets.push({ name: regionName, color, data: tempSeries });
          
          const salSeries = buildTimeSeries(rawPoints, 'salinity');
          if (salSeries.length > 0) timeSalDatasets.push({ name: regionName, color, data: salSeries });
      });
  }

  const hasAnyCharts = tempDatasets.length > 0 || salDatasets.length > 0 || oxyDatasets.length > 0 || timeTempDatasets.length > 0 || timeSalDatasets.length > 0;

  const handleDownload = () => {
    if (!data || data.length === 0) return;
    
    let csvContent = "region,latitude,longitude,time,depth,temperature,salinity,oxygen\n";
    
    data.forEach(summary => {
      const regionName = summary.region.name || "Custom Region";
      if (summary.points) {
        summary.points.forEach(p => {
          csvContent += `"${regionName}",${p.latitude || ''},${p.longitude || ''},${p.time_ts || ''},${p.depth || ''},${p.temperature || ''},${p.salinity || ''},${p.oxygen || ''}\n`;
        });
      }
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'argo_data_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = async () => {
    setIsExporting(true);
    try {
        const pdf = new jsPDF('p', 'pt', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const currentDateTime = new Date().toLocaleString();
        
        // Header
        pdf.setFontSize(12);
        pdf.setTextColor(120, 120, 120);
        pdf.text('FloatChat Analytics', 40, 35);
        
        const dateWidth = pdf.getStringUnitWidth(currentDateTime) * pdf.internal.getFontSize();
        pdf.text(currentDateTime, pageWidth - 40 - dateWidth, 35);
        
        pdf.setFontSize(24);
        pdf.setTextColor(0, 150, 200);
        pdf.text('Ocean Region Comparison Report', 40, 60);
        
        pdf.setDrawColor(0, 150, 200);
        pdf.setLineWidth(1.5);
        pdf.line(40, 75, pageWidth - 40, 75);
        
        // Regions Stats Table
        const statsData = data.map((summary, idx) => {
            const regionName = summary.region.name || `Region ${idx + 1}`;
            return [
                regionName,
                summary.totals || '-',
                summary.temperature ? Number(summary.temperature.mean).toFixed(2) : '-',
                summary.salinity ? Number(summary.salinity.mean).toFixed(2) : '-',
                summary.depth ? Number(summary.depth.max).toFixed(0) : '-'
            ];
        });
        
        autoTable(pdf, {
            startY: 95,
            head: [['Region', 'Records', 'Avg Temp (°C)', 'Avg Salinity (PSU)', 'Max Depth (m)']],
            body: statsData,
            theme: 'striped',
            headStyles: { fillColor: [0, 150, 200] },
            styles: { fontSize: 10, cellPadding: 4 },
            margin: { top: 40, right: 40, bottom: 40, left: 40 }
        });
        
        // Charts
        const chartIds = ['chat-multi-temp', 'chat-multi-sal', 'chat-multi-oxy', 'chat-time-temp', 'chat-time-sal'];
        let currentY = 95 + (statsData.length * 25) + 50; // Manual calculation instead of pdf.lastAutoTable.finalY
        
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
                if (chartIds[i] === 'chat-multi-temp') title = "Temperature Comparison";
                if (chartIds[i] === 'chat-multi-sal') title = "Salinity Comparison";
                if (chartIds[i] === 'chat-multi-oxy') title = "Oxygen Comparison";
                if (chartIds[i] === 'chat-time-temp') title = "Temperature vs Time Comparison";
                if (chartIds[i] === 'chat-time-sal') title = "Salinity vs Time Comparison";
                
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
        
        pdf.save('ocean_comparison_report.pdf');
    } catch (err) {
        console.error('Failed to export PDF', err);
    } finally {
        setIsExporting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: -50, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: -50, scale: 0.95 }}
        transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
        className="fixed top-24 left-4 md:left-6 z-40 w-[calc(100vw-2rem)] md:w-[600px] flex flex-col overflow-hidden shadow-2xl"
        style={{
          maxHeight: 'calc(100vh - 120px)',
          background: 'linear-gradient(160deg, rgba(6, 18, 40, 0.97), rgba(3, 10, 22, 0.98))',
          border: '1px solid rgba(0, 212, 255, 0.18)',
          borderRadius: 20,
          boxShadow: '0 0 0 1px rgba(0,212,255,0.06), 0 24px 60px rgba(0,0,0,0.7), 0 0 40px rgba(0,212,255,0.06)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid rgba(0,212,255,0.1)' }}>
            <h3 className="text-md font-bold text-white tracking-wide" style={{ fontFamily: "'Space Grotesk', Inter, sans-serif" }}>Ocean Data Comparison</h3>
            <div className="flex items-center gap-2">
                <button 
                  onClick={handleDownload} 
                  className="flex items-center gap-1.5 text-xs text-white/80 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-md"
                  title="Download ASCII (CSV)"
                >
                  <Download size={14} />
                  <span>CSV</span>
                </button>
                <button 
                  onClick={exportToPDF}
                  disabled={isExporting}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md cursor-pointer transition-colors"
                  style={{ background: '#00d4ff', color: '#020813', fontWeight: 600, border: 'none', opacity: isExporting ? 0.7 : 1 }}
                  title="Export PDF Report"
                >
                  <FileText size={14} />
                  {isExporting ? 'Exporting...' : 'PDF'}
                </button>
                <button onClick={onClose} className="text-white/50 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-1.5 rounded-md ml-1">
                  <X size={16} />
                </button>
            </div>
        </div>

        <div className="p-5 space-y-8 overflow-y-auto w-full">
            {/* Stat Cards for all regions */}
            <div className="space-y-4">
                {data.map((summary, idx) => {
                    const regionName = summary.region.name || `Region ${idx + 1}`;
                    const color = COLORS[idx % COLORS.length];
                    return (
                        <div key={idx}>
                            <div className="flex items-center gap-2 mb-2">
                               <div className="w-3 h-3 rounded-full" style={{ background: color }}></div>
                               <h4 className="text-white font-bold text-sm" style={{ fontFamily: "'Space Grotesk', Inter, sans-serif" }}>{regionName}</h4>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
            {hasAnyCharts && (
                <div className="grid grid-cols-1 gap-4 pt-4" style={{ borderTop: '1px solid rgba(0,212,255,0.1)' }}>
                    <h4 className="text-white/60 font-semibold text-xs tracking-wider uppercase mb-2">Comparison Charts</h4>
                    
                    {tempDatasets.length > 0 && (
                        <MultiLineChart
                            id="chat-multi-temp"
                            title="Temperature vs Depth"
                            datasets={tempDatasets}
                            xLabel="Depth (m)"
                            yLabel="Temperature (°C)"
                            icon={<Thermometer size={14} />}
                        />
                    )}
                    {salDatasets.length > 0 && (
                        <MultiLineChart
                            id="chat-multi-sal"
                            title="Salinity vs Depth"
                            datasets={salDatasets}
                            xLabel="Depth (m)"
                            yLabel="Salinity (PSU)"
                            icon={<Droplets size={14} />}
                        />
                    )}
                    {oxyDatasets.length > 0 && (
                        <MultiLineChart
                            id="chat-multi-oxy"
                            title="Oxygen vs Depth"
                            datasets={oxyDatasets}
                            xLabel="Depth (m)"
                            yLabel="Oxygen"
                            icon={<Activity size={14} />}
                        />
                    )}
                    
                    {/* Time Series Alternatives if no Depth is available */}
                    {timeTempDatasets.length > 0 && (
                        <MultiLineChart
                            id="chat-time-temp"
                            title="Temperature vs Time"
                            datasets={timeTempDatasets}
                            xLabel="Time"
                            yLabel="Temperature (°C)"
                            icon={<Thermometer size={14} />}
                            xScaleType="time"
                        />
                    )}
                    {timeSalDatasets.length > 0 && (
                        <MultiLineChart
                            id="chat-time-sal"
                            title="Salinity vs Time"
                            datasets={timeSalDatasets}
                            xLabel="Time"
                            yLabel="Salinity (PSU)"
                            icon={<Droplets size={14} />}
                            xScaleType="time"
                        />
                    )}
                </div>
            )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
