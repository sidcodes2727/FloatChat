import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';

/* ─── Chart component ─── */
export function LineChart({ data, title, color, accentColor, xLabel = 'Depth', yLabel = 'Value', icon }) {
    const containerRef = useRef();
    const svgRef = useRef();

    useEffect(() => {
        if (!data || data.length === 0) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        const containerWidth = containerRef.current?.clientWidth || 360;
        const width = Math.max(280, containerWidth - 2);
        const height = 220;
        const margin = { top: 20, right: 16, bottom: 38, left: 48 };

        svg.attr('width', width).attr('height', height);

        const x = d3.scaleLinear()
            .domain(d3.extent(data, d => d.x))
            .range([margin.left, width - margin.right]);

        const yExtent = d3.extent(data, d => d.y);
        let yMin = yExtent[0];
        let yMax = yExtent[1];
        if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) { yMin = 0; yMax = 1; }
        if (yMin === yMax) {
            const pad = Math.abs(yMin) > 0 ? Math.abs(yMin) * 0.05 : 1;
            yMin -= pad; yMax += pad;
        }

        const y = d3.scaleLinear()
            .domain([yMin, yMax])
            .nice()
            .range([height - margin.bottom, margin.top]);

        const line = d3.line()
            .x(d => x(d.x))
            .y(d => y(d.y))
            .curve(d3.curveMonotoneX);

        // Subtle gridlines
        svg.append('g')
            .attr('transform', `translate(${margin.left},0)`)
            .call(d3.axisLeft(y).tickSize(-(width - margin.left - margin.right)).tickFormat(''))
            .selectAll('line')
            .attr('stroke', 'rgba(255,255,255,0.04)');
        svg.selectAll('.domain').remove();

        // X axis
        const xAxis = svg.append('g')
            .attr('transform', `translate(0,${height - margin.bottom})`)
            .call(d3.axisBottom(x).ticks(5));
        xAxis.selectAll('text').attr('fill', 'rgba(232,244,253,0.35)').style('font-size', '9px').style('font-family', 'Inter, sans-serif');
        xAxis.selectAll('line').attr('stroke', 'rgba(255,255,255,0.06)');
        xAxis.selectAll('path').attr('stroke', 'rgba(255,255,255,0.06)');

        // Y axis
        const yAxis = svg.append('g')
            .attr('transform', `translate(${margin.left},0)`)
            .call(d3.axisLeft(y).ticks(5));
        yAxis.selectAll('text').attr('fill', 'rgba(232,244,253,0.35)').style('font-size', '9px').style('font-family', 'Inter, sans-serif');
        yAxis.selectAll('line').attr('stroke', 'rgba(255,255,255,0.06)');
        yAxis.selectAll('path').attr('stroke', 'rgba(255,255,255,0.06)');

        // Gradient area fill
        const gradId = `area-${title.replace(/\s+/g, '')}`;
        const grad = svg.append('defs').append('linearGradient')
            .attr('id', gradId)
            .attr('x1', '0').attr('y1', '0')
            .attr('x2', '0').attr('y2', '1');
        grad.append('stop').attr('offset', '0%').attr('stop-color', color).attr('stop-opacity', 0.18);
        grad.append('stop').attr('offset', '100%').attr('stop-color', color).attr('stop-opacity', 0);

        const area = d3.area()
            .x(d => x(d.x))
            .y0(height - margin.bottom)
            .y1(d => y(d.y))
            .curve(d3.curveMonotoneX);

        svg.append('path')
            .datum(data)
            .attr('fill', `url(#${gradId})`)
            .attr('d', area);

        // Line
        svg.append('path')
            .datum(data)
            .attr('fill', 'none')
            .attr('stroke', color)
            .attr('stroke-width', 2)
            .attr('stroke-linejoin', 'round')
            .attr('stroke-linecap', 'round')
            .attr('d', line);

        // Hover interaction
        const focus = svg.append('g').style('display', 'none');
        focus.append('circle')
            .attr('r', 4.5)
            .attr('fill', color)
            .attr('stroke', '#040d18')
            .attr('stroke-width', 2.5);

        // Tooltip group
        const tooltip = focus.append('g');
        tooltip.append('rect')
            .attr('rx', 6).attr('ry', 6)
            .attr('fill', 'rgba(4, 14, 30, 0.92)')
            .attr('stroke', color)
            .attr('stroke-opacity', 0.3)
            .attr('stroke-width', 1)
            .attr('x', -4).attr('y', -32)
            .attr('width', 90).attr('height', 24);

        tooltip.append('text')
            .attr('x', 41).attr('y', -14)
            .attr('text-anchor', 'middle')
            .attr('fill', 'rgba(232,244,253,0.9)')
            .style('font-size', '10px')
            .style('font-family', 'Inter, sans-serif')
            .attr('class', 'tooltip-text');

        const bisect = d3.bisector(d => d.x).center;
        function moved(event) {
            const [mx] = d3.pointer(event);
            const dx = x.invert(mx);
            const i = bisect(data, dx);
            const d = data[Math.max(0, Math.min(data.length - 1, i))];
            const px = x(d.x);
            const py = y(d.y);
            focus.attr('transform', `translate(${px},${py})`);
            focus.select('.tooltip-text').text(`${d.x.toFixed(1)} → ${d.y.toFixed(2)}`);

            // Smart tooltip positioning
            const tooltipX = px > width - 100 ? -90 : -4;
            tooltip.select('rect').attr('x', tooltipX);
            tooltip.select('text').attr('x', tooltipX + 45);
        }

        svg.append('rect')
            .attr('fill', 'transparent')
            .attr('pointer-events', 'all')
            .attr('x', margin.left).attr('y', margin.top)
            .attr('width', width - margin.left - margin.right)
            .attr('height', height - margin.top - margin.bottom)
            .on('mouseenter', () => focus.style('display', null))
            .on('mousemove', moved)
            .on('mouseleave', () => focus.style('display', 'none'));

        // Axis labels
        svg.append('text')
            .attr('x', (width) / 2).attr('y', height - 4)
            .attr('text-anchor', 'middle')
            .attr('fill', 'rgba(232,244,253,0.3)')
            .style('font-size', '9px').style('font-family', 'Inter, sans-serif')
            .text(xLabel);

        svg.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('x', -(height / 2)).attr('y', 12)
            .attr('text-anchor', 'middle')
            .attr('fill', 'rgba(232,244,253,0.3)')
            .style('font-size', '9px').style('font-family', 'Inter, sans-serif')
            .text(yLabel);

    }, [data, title, color, xLabel, yLabel]);

    return (
        <div ref={containerRef} className="card overflow-hidden">
            {/* Card header */}
            <div
                className="flex items-center gap-3 px-5 py-3.5"
                style={{ borderBottom: '1px solid rgba(0,212,255,0.07)' }}
            >
                <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: `${color}15`, border: `1px solid ${color}22` }}
                >
                    <span style={{ color }}>{icon}</span>
                </div>
                <h3
                    className="text-sm font-semibold text-white"
                    style={{ fontFamily: "'Space Grotesk', Inter, sans-serif" }}
                >
                    {title}
                </h3>
                <div className="ml-auto">
                    <TrendingUp size={13} style={{ color: `${color}70` }} />
                </div>
            </div>
            <div className="px-2 pt-2 pb-1 overflow-x-auto">
                <svg ref={svgRef} className="w-full" style={{ minWidth: 260 }} />
            </div>
        </div>
    );
}

/* ─── Stat card ─── */
export function StatCard({ label, value, unit, icon, color = '#00d4ff' }) {
    return (
        <motion.div
            className="stat-card"
            whileHover={{ scale: 1.02, y: -2 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
            <div className="flex items-start justify-between mb-4">
                <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'rgba(232,244,253,0.4)' }}>
                    {label}
                </p>
                <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: `${color}15`, border: `1px solid ${color}22` }}
                >
                    <span style={{ color }}>{icon}</span>
                </div>
            </div>
            <p
                className="text-2xl font-bold text-white"
                style={{ fontFamily: "'Space Grotesk', Inter, sans-serif" }}
            >
                {value}
                {unit && <span className="text-sm ml-1.5 font-normal" style={{ color: 'rgba(232,244,253,0.35)' }}>{unit}</span>}
            </p>
        </motion.div>
    );
}
