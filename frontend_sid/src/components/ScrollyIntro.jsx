import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowDown } from 'lucide-react';
import { cn } from '../lib/utils';

import imgArgo from '../assets/argo-buoy.png';
import imgDatabase from '../assets/database-ingestion.jpg';
import imgDashboard from '../assets/dashboard-ui.png';

export default function ScrollyIntro({ scrollContainer }) {
  const sectionRef = useRef(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    container: scrollContainer,
    offset: ["start start", "end end"]
  });

  // Opacities for the text on the left
  const op1 = useTransform(scrollYProgress, [0, 0.25, 0.33], [1, 1, 0]);
  const op2 = useTransform(scrollYProgress, [0.25, 0.33, 0.58, 0.66], [0, 1, 1, 0]);
  const op3 = useTransform(scrollYProgress, [0.58, 0.66, 0.9, 1], [0, 1, 1, 0]);

  // Y transforms for text
  const y1 = useTransform(scrollYProgress, [0, 0.33], [0, -50]);
  const y2 = useTransform(scrollYProgress, [0.25, 0.66], [50, -50]);
  const y3 = useTransform(scrollYProgress, [0.58, 1], [50, -50]);

  // Opacities for images on the right
  const imgOp1 = useTransform(scrollYProgress, [0, 0.33], [1, 0]);
  const imgOp2 = useTransform(scrollYProgress, [0.25, 0.33, 0.66], [0, 1, 0]);
  const imgOp3 = useTransform(scrollYProgress, [0.58, 0.66, 1], [0, 1, 1]);

  return (
    <div ref={sectionRef} className="relative w-full" style={{ height: '400vh' }}>
      <div className="sticky top-0 left-0 w-full h-screen overflow-hidden bg-background border-b border-border">
        
        <div className="max-w-7xl mx-auto h-full px-6 md:px-12 flex flex-col md:flex-row items-center justify-between">
          
          {/* Left Text Content */}
          <div className="w-full md:w-1/2 relative h-full flex items-center">
            
            {/* Slide 1 */}
            <motion.div className="absolute inset-x-0" style={{ opacity: op1, y: y1 }}>
              <span className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground mb-6 block">Phase 01: Collection</span>
              <h2 className="text-4xl md:text-5xl lg:text-6xl text-foreground font-display mb-6">
                Autonomous <span className="italic text-periwinkle">Sensing</span>
              </h2>
              <p className="text-lg text-muted-foreground font-sans leading-relaxed max-w-md">
                Thousands of autonomous Argo floats patrol the deep ocean. They continuously collect real-time, critical telemetry on temperature, salinity, and pressure from beneath the waves.
              </p>
            </motion.div>

            {/* Slide 2 */}
            <motion.div className="absolute inset-x-0" style={{ opacity: op2, y: y2 }}>
              <span className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground mb-6 block">Phase 02: Ingestion</span>
              <h2 className="text-4xl md:text-5xl lg:text-6xl text-foreground font-display mb-6">
                Data <span className="italic text-royal-blue">Pipeline</span>
              </h2>
              <p className="text-lg text-muted-foreground font-sans leading-relaxed max-w-md">
                Every data point collected is instantly ingested into a scalable database, securely storing the ocean's metrics for real-time access and AI analysis.
              </p>
            </motion.div>

            {/* Slide 3 */}
            <motion.div className="absolute inset-x-0" style={{ opacity: op3, y: y3 }}>
              <span className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground mb-6 block">Phase 03: Analysis</span>
              <h2 className="text-4xl md:text-5xl lg:text-6xl text-foreground font-display mb-6">
                Interactive <span className="italic text-deep-navy">Telemetry</span>
              </h2>
              <p className="text-lg text-muted-foreground font-sans leading-relaxed max-w-md mb-8">
                Query the ocean in real-time. Our interactive AI platform brings the deep sea directly to your screen with precise, insightful visualizations.
              </p>
              <div className="inline-flex font-mono text-xs uppercase tracking-widest border border-border px-4 py-2 rounded-md bg-muted">
                System Active
              </div>
            </motion.div>

          </div>

          {/* Right Image Container */}
          <div className="w-full md:w-1/2 h-[60vh] md:h-[80vh] relative mt-12 md:mt-0 rounded-2xl overflow-hidden border border-border shadow-sm">
            <motion.img 
              src={imgArgo} 
              className="absolute inset-0 w-full h-full object-cover"
              style={{ opacity: imgOp1 }}
              alt="Argo Float"
            />
            <motion.img 
              src={imgDatabase} 
              className="absolute inset-0 w-full h-full object-cover"
              style={{ opacity: imgOp2 }}
              alt="Database"
            />
            <motion.img 
              src={imgDashboard} 
              className="absolute inset-0 w-full h-full object-cover"
              style={{ opacity: imgOp3 }}
              alt="Dashboard"
            />
            {/* Subtle inner shadow for polish */}
            <div className="absolute inset-0 shadow-[inset_0_0_0_1px_rgba(9,21,64,0.1)] rounded-2xl pointer-events-none" />
          </div>

        </div>

        {/* Scroll Indicator */}
        <motion.div
          className="absolute bottom-8 left-12 z-50 pointer-events-none hidden md:flex items-center gap-4"
          style={{ opacity: useTransform(scrollYProgress, [0.9, 1], [1, 0]) }}
        >
          <span className="font-mono text-xs tracking-widest text-muted-foreground">SCROLL</span>
          <ArrowDown size={14} className="text-muted-foreground animate-bounce" />
        </motion.div>

        {/* Progress Bar */}
        <div className="absolute bottom-0 left-0 w-full h-[2px] bg-muted z-50">
          <motion.div
            className="h-full bg-periwinkle"
            style={{ width: useTransform(scrollYProgress, [0, 1], ['0%', '100%']) }}
          />
        </div>

      </div>
    </div>
  );
}
