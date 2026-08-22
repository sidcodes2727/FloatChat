import React, { useEffect, useState } from 'react';
import { Layers } from 'lucide-react';
import { LineChart } from './ChartWidgets';

function Pressure() {
    const [pressureData, setPressureData] = useState([]);

    useEffect(() => {
        // Generate sample pressure data - replace with actual API call
        // Pressure increases linearly with depth (approximately 1 dbar per meter)
        const sampleData = Array.from({ length: 50 }, (_, i) => ({
            x: i * 2, // depth in meters
            y: (i * 2) + Math.random() * 2 - 1, // pressure increases with depth
        }));
        setPressureData(sampleData);
    }, []);

    return (
        <div className="p-4 md:p-6 flex flex-col items-center max-w-5xl mx-auto space-y-6">
            <div className="mb-2 text-center">
                <h1 className="text-2xl md:text-3xl font-display font-bold text-white mb-2 tracking-wide">Ocean Pressure Analysis</h1>
                <p className="text-[var(--text-muted)] font-mono text-sm tracking-widest uppercase">Pressure variation with ocean depth</p>
            </div>
            
            <div className="w-full">
                <LineChart
                    title="Pressure vs Depth Profile"
                    data={pressureData}
                    color="var(--color-light-blue)"
                    xLabel="Depth (m)"
                    yLabel="Pressure (dbar)"
                    icon={<Layers size={16} />}
                />
            </div>
            
            <div className="w-full card p-5 md:p-6 border-l-4" style={{ borderLeftColor: 'var(--color-light-blue)' }}>
                <h3 className="text-sm font-semibold text-white mb-3 font-mono tracking-widest uppercase opacity-80">Key Insights</h3>
                <ul className="text-[var(--text-muted)] space-y-2 text-sm leading-relaxed">
                    <li>• Pressure increases linearly with depth (hydrostatic pressure)</li>
                    <li>• Approximately 1 decibar (dbar) increase per meter of depth</li>
                    <li>• Surface pressure is close to atmospheric pressure (0 dbar)</li>
                    <li>• Deep ocean pressures can exceed 1000 dbar at 1000m depth</li>
                </ul>
            </div>
        </div>
    );
}

export default Pressure;
