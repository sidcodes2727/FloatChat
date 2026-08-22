import React, { useEffect, useState } from 'react';
import { Thermometer } from 'lucide-react';
import { LineChart } from './ChartWidgets';

function Temperature() {
    const [temperatureData, setTemperatureData] = useState([]);

    useEffect(() => {
        // Generate sample temperature data - replace with actual API call
        const sampleData = Array.from({ length: 50 }, (_, i) => ({
            x: i * 2, // depth in meters
            y: 25 - (i * 0.3) + Math.random() * 3 - 1.5, // temperature decreases with depth
        }));
        setTemperatureData(sampleData);
    }, []);

    return (
        <div className="p-4 md:p-6 flex flex-col items-center max-w-5xl mx-auto space-y-6">
            <div className="mb-2 text-center">
                <h1 className="text-2xl md:text-3xl font-display font-bold text-white mb-2 tracking-wide">Ocean Temperature Analysis</h1>
                <p className="text-[var(--text-muted)] font-mono text-sm tracking-widest uppercase">Temperature variation with ocean depth</p>
            </div>
            
            <div className="w-full">
                <LineChart
                    title="Temperature vs Depth Profile"
                    data={temperatureData}
                    color="var(--color-periwinkle)"
                    xLabel="Depth (m)"
                    yLabel="Temperature (°C)"
                    icon={<Thermometer size={16} />}
                />
            </div>
            
            <div className="w-full card p-5 md:p-6 border-l-4" style={{ borderLeftColor: 'var(--color-periwinkle)' }}>
                <h3 className="text-sm font-semibold text-white mb-3 font-mono tracking-widest uppercase opacity-80">Key Insights</h3>
                <ul className="text-[var(--text-muted)] space-y-2 text-sm leading-relaxed">
                    <li>• Temperature generally decreases with increasing depth</li>
                    <li>• Surface waters are warmer due to solar heating</li>
                    <li>• Thermocline layer shows rapid temperature change</li>
                    <li>• Deep ocean temperatures remain relatively stable</li>
                </ul>
            </div>
        </div>
    );
}

export default Temperature;
