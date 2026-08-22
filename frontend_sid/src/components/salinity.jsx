import React, { useEffect, useState } from 'react';
import { Droplets } from 'lucide-react';
import { LineChart } from './ChartWidgets';

function Salinity() {
    const [salinityData, setSalinityData] = useState([]);

    useEffect(() => {
        // Generate sample salinity data - replace with actual API call
        const sampleData = Array.from({ length: 50 }, (_, i) => ({
            x: i * 2, // depth in meters
            y: 34 + (i * 0.02) + Math.random() * 0.5 - 0.25, // salinity increases slightly with depth
        }));
        setSalinityData(sampleData);
    }, []);

    return (
        <div className="p-4 md:p-6 flex flex-col items-center max-w-5xl mx-auto space-y-6">
            <div className="mb-2 text-center">
                <h1 className="text-2xl md:text-3xl font-display font-bold text-white mb-2 tracking-wide">Ocean Salinity Analysis</h1>
                <p className="text-[var(--text-muted)] font-mono text-sm tracking-widest uppercase">Salinity variation with ocean depth</p>
            </div>
            
            <div className="w-full">
                <LineChart
                    title="Salinity vs Depth Profile"
                    data={salinityData}
                    color="var(--color-royal-blue)"
                    xLabel="Depth (m)"
                    yLabel="Salinity (PSU)"
                    icon={<Droplets size={16} />}
                />
            </div>
            
            <div className="w-full card p-5 md:p-6 border-l-4" style={{ borderLeftColor: 'var(--color-royal-blue)' }}>
                <h3 className="text-sm font-semibold text-white mb-3 font-mono tracking-widest uppercase opacity-80">Key Insights</h3>
                <ul className="text-[var(--text-muted)] space-y-2 text-sm leading-relaxed">
                    <li>• Salinity typically increases with depth in most ocean regions</li>
                    <li>• Surface waters may have lower salinity due to precipitation and freshwater input</li>
                    <li>• Halocline layer shows rapid salinity changes</li>
                    <li>• Deep ocean salinity is relatively stable around 34.5-35 PSU</li>
                </ul>
            </div>
        </div>
    );
}

export default Salinity;