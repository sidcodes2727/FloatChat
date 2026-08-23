import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Sparkles, ChevronDown } from 'lucide-react';

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

  // 0.00 - 0.33: Image 1 visible
  // 0.33 - 0.66: Image 2 visible
  // 0.66 - 1.00: Image 3 visible

  const op1 = useTransform(scrollYProgress, [0, 0.25, 0.33], [1, 1, 0]);
  const op2 = useTransform(scrollYProgress, [0.25, 0.33, 0.58, 0.66], [0, 1, 1, 0]);
  const op3 = useTransform(scrollYProgress, [0.58, 0.66, 0.9, 1], [0, 1, 1, 0]);

  // Slight zoom effect on images
  const scale1 = useTransform(scrollYProgress, [0, 0.33], [1, 1.1]);
  const scale2 = useTransform(scrollYProgress, [0.25, 0.66], [1, 1.1]);
  const scale3 = useTransform(scrollYProgress, [0.58, 1], [1, 1.1]);

  // Text Y translation for parallax
  const y1 = useTransform(scrollYProgress, [0, 0.33], [0, -50]);
  const y2 = useTransform(scrollYProgress, [0.25, 0.66], [50, -50]);
  const y3 = useTransform(scrollYProgress, [0.58, 1], [50, -50]);

  return (
    <div ref={sectionRef} className="relative w-full" style={{ height: '400vh' }}>

      {/* Sticky container that stays in view */}
      <div className="sticky top-0 left-0 w-full h-screen overflow-hidden bg-[#040c1a]">

        {/* === SLIDE 1: Argo === */}
        <motion.div
          className="absolute inset-0 w-full h-full"
          style={{ opacity: op1 }}
        >
          <motion.img
            src={imgArgo}
            alt="Argo Floats"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ scale: scale1 }}
          />
          {/* Gradients for readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#040c1a]/60 via-[#040c1a]/40 to-[#040c1a]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#040c1a] via-transparent to-transparent" />

          <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center text-center px-6"
            style={{ y: y1 }}
          >
            <span
              className="text-[10px] font-bold uppercase tracking-[0.3em] mb-4 block"
              style={{ color: '#00f5d4', fontFamily: "'Exo 2', sans-serif" }}
            >
              ◆ Phase 01 ◆
            </span>
            <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 tracking-tight" style={{ fontFamily: "'Exo 2', sans-serif" }}>
              Data Collection
            </h2>
            <p className="max-w-2xl text-lg md:text-xl text-cyan-100/80 leading-relaxed" style={{ fontFamily: "'Exo 2', sans-serif" }}>
              Thousands of autonomous Argo floats patrol the deep ocean. They continuously collect real-time, critical data on temperature, salinity, and pressure from beneath the waves.
            </p>
          </motion.div>
        </motion.div>

        {/* === SLIDE 2: Database === */}
        <motion.div
          className="absolute inset-0 w-full h-full"
          style={{ opacity: op2 }}
        >
          <motion.img
            src={imgDatabase}
            alt="Cloud Database"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ scale: scale2 }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#040c1a]/60 via-[#040c1a]/40 to-[#040c1a]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#040c1a] via-transparent to-transparent" />

          <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center text-center px-6"
            style={{ y: y2 }}
          >
            <span
              className="text-[10px] font-bold uppercase tracking-[0.3em] mb-4 block"
              style={{ color: '#00f5d4', fontFamily: "'Exo 2', sans-serif" }}
            >
              ◆ Phase 02 ◆
            </span>
            <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 tracking-tight" style={{ fontFamily: "'Exo 2', sans-serif" }}>
              Data Ingestion
            </h2>
            <p className="max-w-2xl text-lg md:text-xl text-purple-100/80 leading-relaxed" style={{ fontFamily: "'Exo 2', sans-serif" }}>
              Every data point collected is instantly ingested into our database, securely storing the ocean's metrics for real-time access and AI analysis.
            </p>
          </motion.div>
        </motion.div>

        {/* === SLIDE 3: Dashboard === */}
        <motion.div
          className="absolute inset-0 w-full h-full"
          style={{ opacity: op3 }}
        >
          <motion.img
            src={imgDashboard}
            alt="Interactive Dashboard"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ scale: scale3 }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#040c1a]/60 via-[#040c1a]/40 to-[#040c1a]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#040c1a] via-transparent to-transparent" />

          <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center text-center px-6"
            style={{ y: y3 }}
          >
            <span
              className="text-[10px] font-bold uppercase tracking-[0.3em] mb-4 block"
              style={{ color: '#00f5d4', fontFamily: "'Exo 2', sans-serif" }}
            >
              ◆ Phase 03 ◆
            </span>
            <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 tracking-tight" style={{ fontFamily: "'Exo 2', sans-serif" }}>
              Interactive Response
            </h2>
            <p className="max-w-2xl text-lg md:text-xl text-green-100/80 leading-relaxed mb-12" style={{ fontFamily: "'Exo 2', sans-serif" }}>
              Query the ocean in real-time. Our interactive AI dashboard brings the deep sea directly to your screen with beautiful, insightful visualizations.
            </p>

            <div
              className="inline-flex items-center gap-3 px-8 py-4 rounded-full mt-8"
              style={{
                background: 'linear-gradient(135deg, rgba(0, 245, 212, 0.1), rgba(0, 212, 255, 0.08))',
                border: '1px solid rgba(0, 245, 212, 0.3)',
                boxShadow: '0 0 40px rgba(0, 245, 212, 0.15), 0 0 80px rgba(0, 212, 255, 0.08)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <Sparkles size={24} style={{ color: '#00f5d4' }} />
              <span className="text-xl md:text-2xl font-bold tracking-wider" style={{ color: '#00f5d4', fontFamily: "'Exo 2', sans-serif" }}>
                AI-Powered Ocean Intelligence
              </span>
            </div>
          </motion.div>
        </motion.div>

        {/* Scroll down indicator */}
        <motion.div
          className="absolute bottom-16 md:bottom-24 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 z-50 pointer-events-none"
          style={{ opacity: useTransform(scrollYProgress, [0.9, 1], [1, 0]) }}
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <ChevronDown size={24} className="text-white/80 drop-shadow-md" />
          </motion.div>
          <span className="text-[10px] uppercase tracking-[0.25em] text-white/80 font-bold drop-shadow-md" style={{ fontFamily: "'Exo 2', sans-serif" }}>Scroll</span>
        </motion.div>

        {/* Progress Bar at very bottom */}
        <div className="absolute bottom-0 left-0 w-full h-1.5 bg-white/5 z-50">
          <motion.div
            className="h-full"
            style={{
              width: useTransform(scrollYProgress, [0, 1], ['0%', '100%']),
              background: 'linear-gradient(90deg, #00f5d4, #00d4ff, #7c3aed, #22c55e)'
            }}
          />
        </div>

      </div>
    </div>
  );
}
