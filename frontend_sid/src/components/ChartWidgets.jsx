import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
import { cn } from '../lib/utils';

/* ─── Chart component ─── */
export function LineChart({ data, title, color, xLabel = 'Depth', yLabel = 'Value', icon }) {
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
            .attr('stroke', 'var(--border)');
        svg.selectAll('.domain').remove();

        // X axis
        const xAxis = svg.append('g')
            .attr('transform', `translate(0,${height - margin.bottom})`)
            .call(d3.axisBottom(x).ticks(5));
        xAxis.selectAll('text').attr('fill', 'var(--muted-foreground)').style('font-size', '10px').style('font-family', "var(--font-mono)");
        xAxis.selectAll('line').attr('stroke', 'var(--border)');
        xAxis.selectAll('path').attr('stroke', 'var(--border)');

        // Y axis
        const yAxis = svg.append('g')
            .attr('transform', `translate(${margin.left},0)`)
            .call(d3.axisLeft(y).ticks(5));
        yAxis.selectAll('text').attr('fill', 'var(--muted-foreground)').style('font-size', '10px').style('font-family', "var(--font-mono)");
        yAxis.selectAll('line').attr('stroke', 'var(--border)');
        yAxis.selectAll('path').attr('stroke', 'var(--border)');

        // Gradient area fill
        const gradId = `area-${title.replace(/\s+/g, '')}`;
        const grad = svg.append('defs').append('linearGradient')
            .attr('id', gradId)
            .attr('x1', '0').attr('y1', '0')
            .attr('x2', '0').attr('y2', '1');
        grad.append('stop').attr('offset', '0%').attr('stop-color', color).attr('stop-opacity', 0.1);
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
            .attr('stroke', 'var(--background)')
            .attr('stroke-width', 2.5);

        // Tooltip group
        const tooltip = focus.append('g');
        tooltip.append('rect')
            .attr('rx', 4).attr('ry', 4)
            .attr('fill', 'var(--background)')
            .attr('stroke', 'var(--border)')
            .attr('stroke-width', 1)
            .attr('x', -4).attr('y', -32)
            .attr('width', 90).attr('height', 24)
            .style('filter', 'drop-shadow(0 4px 6px rgba(0,0,0,0.05))');

        tooltip.append('text')
            .attr('x', 41).attr('y', -14)
            .attr('text-anchor', 'middle')
            .attr('fill', 'var(--foreground)')
            .style('font-size', '10px')
            .style('font-family', "var(--font-mono)")
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
            .attr('fill', 'var(--muted-foreground)')
            .style('font-size', '10px').style('font-family', "var(--font-sans)")
            .text(xLabel);

        svg.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('x', -(height / 2)).attr('y', 12)
            .attr('text-anchor', 'middle')
            .attr('fill', 'var(--muted-foreground)')
            .style('font-size', '10px').style('font-family', "var(--font-sans)")
            .text(yLabel);

    }, [data, title, color, xLabel, yLabel]);

    return (
        <div ref={containerRef} className="card overflow-hidden w-full bg-background border-border">
            {/* Card header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
                <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                    <span style={{ color }}>{icon}</span>
                </div>
                <h3 className="text-base font-medium text-foreground whitespace-nowrap overflow-hidden text-ellipsis flex-1 font-display">
                    {title}
                </h3>
                <div className="ml-auto shrink-0">
                    <TrendingUp size={14} className="text-muted-foreground" />
                </div>
            </div>
            <div className="px-2 pt-4 pb-2 overflow-x-auto w-full">
                <svg ref={svgRef} className="w-full min-w-full" />
            </div>
        </div>
    );
}

/* ─── Stat card ─── */
export function StatCard({ label, value, unit, icon, color = 'var(--color-periwinkle)' }) {
    return (
        <motion.div
            className="card p-5 w-full bg-background border-border flex flex-col justify-between"
            whileHover={{ y: -2 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
            <div className="flex items-start justify-between mb-4">
                <p className="text-[10px] uppercase tracking-widest font-semibold font-mono text-muted-foreground">
                    {label}
                </p>
                <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                    <span style={{ color }}>{icon}</span>
                </div>
            </div>
            <p className="text-3xl font-bold text-foreground break-all font-display tracking-tight">
                {value}
                {unit && <span className="text-sm ml-1 text-muted-foreground font-sans font-normal">{unit}</span>}
            </p>
        </motion.div>
    );
}

/* ─── Multi-Line Chart component ─── */
export function MultiLineChart({ datasets, title, icon, xLabel = 'Depth', yLabel = 'Value' }) {
    const containerRef = useRef();
    const svgRef = useRef();

    useEffect(() => {
        if (!datasets || datasets.length === 0) return;

        const allData = datasets.flatMap(d => d.data);
        if (allData.length === 0) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        const containerWidth = containerRef.current?.clientWidth || 360;
        const width = Math.max(280, containerWidth - 2);
        const height = 220;
        const margin = { top: 20, right: 16, bottom: 38, left: 48 };

        svg.attr('width', width).attr('height', height);

        const x = d3.scaleLinear()
            .domain(d3.extent(allData, d => d.x))
            .range([margin.left, width - margin.right]);

        const yExtent = d3.extent(allData, d => d.y);
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

        svg.append('g')
            .attr('transform', `translate(${margin.left},0)`)
            .call(d3.axisLeft(y).tickSize(-(width - margin.left - margin.right)).tickFormat(''))
            .selectAll('line')
            .attr('stroke', 'var(--border)');
        svg.selectAll('.domain').remove();

        const xAxis = svg.append('g')
            .attr('transform', `translate(0,${height - margin.bottom})`)
            .call(d3.axisBottom(x).ticks(5));
        xAxis.selectAll('text').attr('fill', 'var(--muted-foreground)').style('font-size', '10px').style('font-family', "var(--font-mono)");
        xAxis.selectAll('line').attr('stroke', 'var(--border)');
        xAxis.selectAll('path').attr('stroke', 'var(--border)');

        const yAxis = svg.append('g')
            .attr('transform', `translate(${margin.left},0)`)
            .call(d3.axisLeft(y).ticks(5));
        yAxis.selectAll('text').attr('fill', 'var(--muted-foreground)').style('font-size', '10px').style('font-family', "var(--font-mono)");
        yAxis.selectAll('line').attr('stroke', 'var(--border)');
        yAxis.selectAll('path').attr('stroke', 'var(--border)');

        datasets.forEach((ds, i) => {
            if (!ds.data || ds.data.length === 0) return;
            
            const gradId = `area-${title.replace(/[^a-zA-Z]/g, '')}-${i}`;
            const grad = svg.append('defs').append('linearGradient')
                .attr('id', gradId)
                .attr('x1', '0').attr('y1', '0')
                .attr('x2', '0').attr('y2', '1');
            grad.append('stop').attr('offset', '0%').attr('stop-color', ds.color).attr('stop-opacity', 0.1);
            grad.append('stop').attr('offset', '100%').attr('stop-color', ds.color).attr('stop-opacity', 0);

            const area = d3.area()
                .x(d => x(d.x))
                .y0(height - margin.bottom)
                .y1(d => y(d.y))
                .curve(d3.curveMonotoneX);

            svg.append('path')
                .datum(ds.data)
                .attr('fill', `url(#${gradId})`)
                .attr('d', area);

            svg.append('path')
                .datum(ds.data)
                .attr('fill', 'none')
                .attr('stroke', ds.color)
                .attr('stroke-width', 2)
                .attr('stroke-linejoin', 'round')
                .attr('stroke-linecap', 'round')
                .attr('d', line);
        });

        const focusGroup = svg.append('g').style('display', 'none');
        
        const focusCircles = datasets.map(ds => {
             return focusGroup.append('circle')
                .attr('r', 4.5)
                .attr('fill', ds.color)
                .attr('stroke', 'var(--background)')
                .attr('stroke-width', 2.5);
        });

        const tooltip = focusGroup.append('g');
        const tooltipHeight = 16 + (datasets.length * 16);
        
        const tooltipBg = tooltip.append('rect')
            .attr('rx', 4).attr('ry', 4)
            .attr('fill', 'var(--background)')
            .attr('stroke', 'var(--border)')
            .attr('stroke-width', 1)
            .attr('width', 130).attr('height', tooltipHeight)
            .style('filter', 'drop-shadow(0 4px 6px rgba(0,0,0,0.05))');

        const tooltipTexts = datasets.map((ds, i) => {
             return tooltip.append('text')
                .attr('x', 65).attr('y', 20 + (i * 16))
                .attr('text-anchor', 'middle')
                .attr('fill', ds.color)
                .style('font-size', '10px')
                .style('font-family', "var(--font-mono)");
        });

        const bisect = d3.bisector(d => d.x).center;
        
        function moved(event) {
            const [mx] = d3.pointer(event);
            const dx = x.invert(mx);
            
            const points = datasets.map(ds => {
                if (!ds.data || !ds.data.length) return null;
                const i = bisect(ds.data, dx);
                return ds.data[Math.max(0, Math.min(ds.data.length - 1, i))];
            });

            const px = mx;
            
            points.forEach((pt, i) => {
                if (pt) {
                    focusCircles[i].attr('transform', `translate(${x(pt.x)},${y(pt.y)})`).style('display', null);
                    tooltipTexts[i].text(`${datasets[i].name}: ${pt.y.toFixed(2)}`);
                } else {
                    focusCircles[i].style('display', 'none');
                    tooltipTexts[i].text('');
                }
            });

            focusGroup.attr('transform', `translate(0, 0)`); 
            
            const tooltipX = px > width - 140 ? px - 134 : px + 8;
            tooltipBg.attr('x', tooltipX).attr('y', margin.top);
            tooltipTexts.forEach((text, i) => {
                text.attr('x', tooltipX + 65).attr('y', margin.top + 16 + (i * 16));
            });
        }

        svg.append('rect')
            .attr('fill', 'transparent')
            .attr('pointer-events', 'all')
            .attr('x', margin.left).attr('y', margin.top)
            .attr('width', width - margin.left - margin.right)
            .attr('height', height - margin.top - margin.bottom)
            .on('mouseenter', () => focusGroup.style('display', null))
            .on('mousemove', moved)
            .on('mouseleave', () => focusGroup.style('display', 'none'));

        svg.append('text')
            .attr('x', (width) / 2).attr('y', height - 4)
            .attr('text-anchor', 'middle')
            .attr('fill', 'var(--muted-foreground)')
            .style('font-size', '10px').style('font-family', "var(--font-sans)")
            .text(xLabel);

        svg.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('x', -(height / 2)).attr('y', 12)
            .attr('text-anchor', 'middle')
            .attr('fill', 'var(--muted-foreground)')
            .style('font-size', '10px').style('font-family', "var(--font-sans)")
            .text(yLabel);

    }, [datasets, title, xLabel, yLabel]);

    return (
        <div ref={containerRef} className="card overflow-hidden w-full bg-background border-border">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
                <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                    <span className="text-foreground">{icon}</span>
                </div>
                <h3 className="text-base font-medium text-foreground whitespace-nowrap overflow-hidden text-ellipsis flex-1 font-display">
                    {title}
                </h3>
            </div>
            
            <div className="flex flex-wrap gap-4 px-5 pt-4">
               {datasets.map((ds, i) => (
                  <div key={i} className="flex items-center gap-2 font-mono">
                      <div className="w-3 h-3 rounded-sm" style={{ background: ds.color }} />
                      <span className="text-[10px] text-muted-foreground uppercase tracking-widest">{ds.name}</span>
                  </div>
               ))}
            </div>

            <div className="px-2 pt-4 pb-2 overflow-x-auto w-full">
                <svg ref={svgRef} className="w-full min-w-full" />
            </div>
        </div>
    );
}
